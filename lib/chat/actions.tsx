import 'server-only'

import {createAI, createStreamableUI, createStreamableValue, getAIState, getMutableAIState, streamUI,} from 'ai/rsc'
import {openai} from '@ai-sdk/openai'

import {BotMessage, spinner, SystemMessage,} from '@/components/stocks'

import {z} from 'zod'
import {formatNumber, nanoid, runAsyncFnWithoutBlocking, sleep} from '@/lib/utils'
import {saveChat} from '@/app/actions'
import {BotMessageStream, SpinnerMessage, UserMessage} from '@/components/stocks/message'
import {Chat, Message} from '@/lib/types'
import {auth} from '@/auth'
import {generateObject} from "ai";
import {renderLandmark} from "@/lib/renderUtils";

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
  const textStream = createStreamableValue('')
  const landmarkStream = createStreamableValue()
  let containsLocation = false
  let isBuildingLocation = false
  let locationStream = createStreamableValue('')
  let location = ''
  const textUIStream = createStreamableUI(<BotMessageStream content={textStream.value} location={locationStream.value} landmark={landmarkStream.value}/>)
  const result = await streamUI({
    model: openai('gpt-3.5-turbo'),
    initial: <SpinnerMessage/>,
    system: `\
    You are a helpful travel conversation bot and you can help users by giving advice on places.
    You and the user can chat about their travel interests (e.g. historical sites, beach, culture etc) you may give interesting ideas to them based on their likes.

    When providing responses, it is **crucial** that you clearly enclose location names in double brackets like this: [[location name]]. For example:
    - "I recommend visiting [[New York City]]."
    - "The Eiffel Tower is a must-see when you're in [[Paris]]."
    - "If you go to [[Tokyo]], make sure to check out Shibuya Crossing."
    - "[[Athens]] is located in Greece, which is in Southern Europe."
    - "No, Athens is not near [[New York City]]."

    In every response to the user, it is critical that exactly one location name is enclosed in double brackets and only if you haven't done so for that location before. Do not use any other formatting like bold or italics for location names. This is important to ensure they are detected and processed correctly.    
    `,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: async ({content, done, delta}) => {
      if (done) {
        textStream.done()
        if (!containsLocation) {
          landmarkStream.done()
          locationStream.done()
          textUIStream.done()
        }
        aiState.update({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content: content.replace(/\[{2}|\]{2}/g, '')
            }
          ]
        })
      } else {
        if (delta.includes('[[')) {
          isBuildingLocation = true
          containsLocation = true
          landmarkStream.update(<div className="h-full flex justify-center items-center w-1/2 transition-width duration-300 min-h-40">{spinner}</div>)
          textStream.update(delta.replace(/\[{2}/, ''))
          return
        } else if (delta.includes(']]')) {
          isBuildingLocation = false
          textStream.update(delta.replace(/\]{2}/, ''))
          locationStream.done(location)

          ;(async () => {
            const { name, info } = await gatherLandmarkInfo(location);
            const url = await gatherLandmarkUrl(name)
            const renderedLandmark = renderLandmark(location, url, info)
            landmarkStream.done(renderedLandmark)
            textUIStream.done()
            const lastMessage = aiState.get().messages.at(-1) || { content: ''}
            aiState.done({
              ...aiState.get(),
              messages: [
                ...aiState.get().messages.slice(0, -1),
                {
                  id: nanoid(),
                  role: 'assistant',
                  content: lastMessage.content as string,
                  location,
                  landmark: {
                    info,
                    url
                  }
                }
              ]
            })
          })().then(() => { location = ''})
          return
        }

        if (isBuildingLocation) {
          location += delta
          textStream.update(delta)
          return
        } else {
          textStream.update(delta);
        }

      }
      return textUIStream.value
    },
  })

  return {
    id: nanoid(),
    location,
    text: textUIStream.value,
    landmark: landmarkStream.value
  }

}

async function gatherLandmarkUrl(landmarkName: string) {
  const { items } = await fetch(`https://customsearch.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CUSTOM_SEARCH_API}&cx=${process.env.GOOGLE_PSE_CX}&safe=active&searchType=image&imgColorType=color&imgType=photo&imgSize=large&num=1&q=${landmarkName}`).then((response) => response.json())
  return items[0].link.replace(/http:\/\//, 'https://')
}

async function gatherLandmarkInfo(locationName: string) {
  // Use the LLM to get landmark URL and info
  const prompt = `
  Provide a landmark for ${locationName} along with a short description of the landmark.
  `;
  const response = await generateObject({
    model: openai('gpt-3.5-turbo'),
    schema: z.object({
          name: z.string().describe('Name of the landmark'),
          info: z.string().describe('Short description of the landmark')
        }),
    prompt,
  });
  const { name, info } = response.object as any

  return { name, info };
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  text: React.ReactNode
  location?: string
  landmark?: {
    info: string
    url: string
  }
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
      location: message.location,
      landmark: message.landmark,
      text: message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} location={message.location} landmark={message.location && message.landmark ? renderLandmark(message.location, message.landmark.url, message.landmark.info) : undefined} />
        ) : null,
    }))
}
