import {ExternalLink} from '@/components/external-link'

export function EmptyScreen() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
        <h1 className="text-lg font-semibold">
          Welcome to Travel Chat Demo
        </h1>
        <p className="leading-normal text-muted-foreground">
          This is an open source AI chatbot proof-of-concept demo application based on Vercel&#39;s <ExternalLink
          href="https://github.com/vercel/ai-chatbot">Next.js AI Chatbot </ExternalLink>.
        </p>
        <p className="leading-normal text-muted-foreground">
          It uses {' '}
          <ExternalLink href="https://vercel.com/blog/ai-sdk-3-generative-ui">
            React Server Components
          </ExternalLink>{' '}
          to combine text with generative UI as output of the LLM. The UI state
          is synced through the <ExternalLink href="https://sdk.vercel.ai">
          Vercel AI SDK
        </ExternalLink> so the model is aware of your interactions
          as they happen.
        </p>
      </div>
    </div>
  )
}
