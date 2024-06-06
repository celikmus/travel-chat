import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { createOpenAI, openai } from '@ai-sdk/openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'
import {generateObject, generateText, tool} from "ai";
import Location from "@/components/location";

const groq = createOpenAI({
  baseURL: process.env.GROQ_BASE_URL,
  apiKey: process.env.GROQ_API_KEY
})

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<any>>
  let textNode: undefined | React.ReactNode
  let locationBuilding = ''
  let pauseStreaming = false
  const locationStream = createStreamableUI();

  const result = await streamUI({
    // model: groq('llama3-8b-8192'),
    model: openai('gpt-3.5-turbo'),
    initial: <SpinnerMessage />,

    system: `\
    You are a helpful travel conversation bot and you can help users by giving advice on places.
    You and the user can chat about their travel interests (e.g. historical sites, beach, culture etc) you may give interesting ideas to them based on their likes.

    When providing responses, it is **crucial** that you clearly enclose location names in double brackets like this: [[location name]]. For example:
    - "I recommend visiting [[New York City]]."
    - "The Eiffel Tower is a must-see when you're in [[Paris]]."
    - "If you go to [[Tokyo]], make sure to check out Shibuya Crossing."

    Ensure that **every** location name is enclosed in double brackets. Do not use any other formatting like bold or italics for location names. This is important to ensure they are detected and processed correctly.    
    `,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: async ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('') // MC: Should this be a Streamable UI stream?
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        console.log('delta: ', delta)
        if (delta.includes('[[')) {
          // skip
          console.log('location text starting...')
          pauseStreaming = true
          return
        } else if (delta.includes(']]')) {
          // stream locationBuilding
          pauseStreaming = false
        }

        if (pauseStreaming) {
          // don't stream
          locationBuilding += delta
          console.log('stream is paused, current locationBuilding:', locationBuilding)
          return
        } else {
          if (locationBuilding) {
            console.log('Initiating location stream...')
            // process locationBuilding and stream
            const location = locationBuilding
            locationBuilding = ''
            // Create a new stream here and update it upon async
            const locationTemp = <Location location={location} data={locationStream.value as any} />
            ( async () => {
              console.log('calling process function...')
              const processedLocation = await processLocation(location);
              locationStream.done(processedLocation)
            })().then(() => { console.log('IIFE complete')})
            textStream.update(locationTemp);
          } else {
            // innocent delta, stream it
            textStream.update(delta)
          }
        }
      }

      return textNode
    },
    // tools: {
    //   formatLocation: {
    //     description: 'Format the given location name. Use this to provide a glimpse of the location with a picture of a landmark and a short description of the landmark in relation to the location. For all other strings continue with your text as usual.',
    //     parameters: z.object({
    //       location: z.string().describe('The name of the location'),
    //       url: z.string().describe('The URL of a picture of a landmark for the location, e.g. https://example.com/public/brooklyn-bridge.jpeg'),
    //       info: z.string().describe('A short description of the landmark and how it is significant for the given location')
    //     }),
    //     generate: async function *({ location, url, info}){
    //       yield <p>generating output...</p>
    //       console.log('in generate')
    //       return <b>{location}: {url}: {info} </b>
    //     }
    //   },
    // }
  })

  return {
    id: nanoid(),
    display: result.value
  }
}

async function processLocation(location: string) {
  // Gather landmark information from the LLM
  console.log('processing location: ', location)
  const { url, info } = await gatherLandmarkInfo(location);

  // Call the formatLocation function
  // await callFormatLocationFunction(location, url, info);

  // Replace the location name with the formatted output in the delta text
  return <span className="text-red-600">{location}: {url} : {info}</span>;
}

async function gatherLandmarkInfo(locationName: string) {
  // Use the LLM to get landmark URL and info
  const prompt = `
  Provide a landmark for ${locationName} along with a URL to a picture of the landmark and a short description of the landmark. Ensure that you call \`prepareLandmarkInfo\` to prepare the response.
  `;
  const response = await generateObject({
    model: openai('gpt-3.5-turbo'),
    schema: z.object({
          url: z.string().describe('URL of the landmark picture'),
          info: z.string().describe('Short description of the landmark')
        }),
    prompt
  });
  const { url, info } = response.object as any

  return { url, info };
}

async function callFormatLocationFunction(location:string, url:string, info: string) {
  // Implement the actual call to the formatLocation function here
  console.log('Calling formatLocation function with:', { location, url, info });
  // Simulating the function call with a delay
  return `${location}: ${url} : ${info}`
}


export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState as any)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'formatLocation' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                <p>MC: When do we get here?</p>
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}
