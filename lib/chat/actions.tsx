import 'server-only'

import {createAI, createStreamableUI, createStreamableValue, getAIState, getMutableAIState, streamUI,} from 'ai/rsc'
import {openai} from '@ai-sdk/openai'

import {BotMessage, spinner, SystemMessage,} from '@/components/stocks'

import {z} from 'zod'
import {formatNumber, gatherLandmarkUrl, nanoid, runAsyncFnWithoutBlocking, sleep} from '@/lib/utils'
import {saveChat} from '@/app/actions'
import {BotMessageStream, SpinnerMessage, UserMessage} from '@/components/stocks/message'
import {Chat, Message} from '@/lib/types'
import {auth} from '@/auth'
import {generateObject} from 'ai'
import {renderLandmark} from '@/lib/renderUtils'

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

const STREAM_STATES = {
  INITIAL: 'INITIAL',
  BUILDING_LOCATION: 'BUILDING_LOCATION',
  LOCATION_BUILT: 'LOCATION_BUILT',
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
  let locationStream = createStreamableValue('')
  const textUIStream = createStreamableUI(<BotMessageStream content={textStream.value} location={locationStream.value}
                                                            landmark={landmarkStream.value}/>)
  let currentState = STREAM_STATES.INITIAL;
  let location = '';
  let containsLocation = false;

  function handleStream(delta: string) {
    switch (currentState) {
      case STREAM_STATES.INITIAL:
        if (delta.includes('[[')) {
          containsLocation = true;
          location = delta.replace(/\[{2}/, '')
          textStream.update(location);
          landmarkStream.update(<div className="h-full flex justify-center items-center w-1/2 transition-width duration-300 min-h-40">{spinner}</div>);
          currentState = STREAM_STATES.BUILDING_LOCATION
        } else {
          textStream.update(delta);
        }
        break;

      case STREAM_STATES.BUILDING_LOCATION:
        if (delta.includes(']]')) {
          const plainDelta = delta.replace(/\]{2}/, '')
          location += plainDelta
          ;(async () => {
            const {name, info} = await gatherLandmarkInfo(location);
            const url = await gatherLandmarkUrl(name)
            const renderedLandmark = renderLandmark(location, url, info)
            landmarkStream.done(renderedLandmark)
            textUIStream.done()

            const lastMessage = aiState.get().messages.at(-1) || {content: ''}
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
          })()
          locationStream.done(location);
          textStream.update(plainDelta);
          currentState = STREAM_STATES.LOCATION_BUILT
        } else {
          location += delta;
          textStream.update(delta);
        }
        break
      case STREAM_STATES.LOCATION_BUILT:
        const plainDelta = delta.replace(/\[{2}|\]{2}/g, '')
        textStream.update(plainDelta)
        break
      default:
        console.log('unknown state: ', currentState)
        break;
    }
  }

  await streamUI({
    model: openai('gpt-3.5-turbo'),
    temperature: 0.5,
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
    - "The Australian city closest to Sumatra is [[Darwin]]".
    - "Bora Bora is not as big as [[London]]."
    - "[[Philadelphia]] is a city near New York City."
    - "Consider exploring the city of [[Bordeaux]]."
    - "Yes, [[Burgundy]] is quite far."
    - "[[Bordeaux]] is located in southwestern France."
    - "Some well-known cities in the Burgundy region include [[Dijon]] and Beaune."

    Remember, it is essential to enclose every location name you mention within double brackets.
    Also, it is crucial that you keep this in mind for all messages in the conversation. 
    Even if the user does not ask about a location directly, if a location name appears in your response, it must be enclosed in double brackets.
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
        textStream.done();
        if (!containsLocation) {
          landmarkStream.done();
          locationStream.done();
          textUIStream.done();
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
        });
      } else {
        handleStream(delta)
      }
      return textUIStream.value
    },
  })

  return {
    id: nanoid(),
    text: textUIStream.value,
  }

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
  const {name, info} = response.object as any

  return {name, info};
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
  initialAIState: {chatId: nanoid(), messages: []},
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        return getUIStateFromAIState(aiState as any)
      }
    } else {
      return
    }
  },
  onSetAIState: async ({state}) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const {chatId, messages} = state

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
        <BotMessage content={message.content} location={message.location}
                    landmark={message.location && message.landmark ? renderLandmark(message.location, message.landmark.url, message.landmark.info) : undefined}/>
      ) : null,
    }))
}
