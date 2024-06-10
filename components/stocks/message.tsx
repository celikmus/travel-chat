'use client'

import {IconOpenAI, IconUser} from '@/components/ui/icons'
import {cn} from '@/lib/utils'
import {spinner} from './spinner'
import {StreamableValue, useStreamableValue} from 'ai/rsc'
import {useStreamableText} from '@/lib/hooks/use-streamable-text'
import {ReactElement} from "react";

// Different types of message bubbles.

export function UserMessage({children}: { children: React.ReactNode }) {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div
        className="flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border bg-background shadow-sm">
        <IconUser/>
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden pl-2">
        {children}
      </div>
    </div>
  )
}

export function BotMessageStream({
                                   content,
                                   location,
                                   landmark,
                                   className
                                 }: {
  content: string | StreamableValue<string>
  location?: string | StreamableValue<string>
  landmark?: StreamableValue<ReactElement>
  className?: string
}) {
  console.log('rendering Stream message.tsx')
  const text = useStreamableText(content)
  const locationText = useStreamableText(location || '')
  const [landmarkValue] = useStreamableValue(landmark)
  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div
        className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
        <IconOpenAI/>
      </div>
      <div className="ml-4 flex flex-1 space-y-2 overflow-hidden px-1">
        <div
          className={cn("flex-1 min-w-80 p-2 ease-linear duration-300 transition-width", location ? 'w-1/2' : 'w-full')}>
          {text}
        </div>
        <div
          className={cn("bg-gray-700 text-md rounded-md ease-linear transition-width duration-300", locationText && landmark ? 'visible w-1/2' : 'invisible w-0')}>{locationText && landmark && landmarkValue}</div>
      </div>
    </div>
  )
}

export function BotMessage({
                             content,
                             location,
                             landmark,
                             className
                           }: {
  content: string | StreamableValue<string>
  location?: string | StreamableValue<string>
  landmark?: ReactElement
  className?: string
}) {
  const text = useStreamableText(content)
  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div
        className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
        <IconOpenAI/>
      </div>
      <div className="ml-4 flex flex-1 space-y-2 overflow-hidden px-1">
        <div className="flex-1 min-w-80 p-2">
          {text}
        </div>
        {location && landmark && <div className="flex flex-1 dark:bg-gray-700 bg-gray-300 text-md rounded-md">{landmark}</div>}
      </div>
    </div>
  )
}

export function BotCard({
                          children,
                          showAvatar = true
                        }: {
  children: React.ReactNode
  showAvatar?: boolean
}) {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div
        className={cn(
          'flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm',
          !showAvatar && 'invisible'
        )}
      >
        <IconOpenAI/>
      </div>
      <div className="ml-4 flex-1 pl-2">{children}</div>
    </div>
  )
}

export function SystemMessage({children}: { children: React.ReactNode }) {
  return (
    <div
      className={
        'mt-2 flex items-center justify-center gap-2 text-xs text-gray-500'
      }
    >
      <div className={'max-w-[600px] flex-initial p-2'}>{children}</div>
    </div>
  )
}

export function SpinnerMessage() {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div
        className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
        <IconOpenAI/>
      </div>
      <div className="ml-4 h-[24px] flex flex-row items-center flex-1 space-y-2 overflow-hidden px-1">
        {spinner}
      </div>
    </div>
  )
}
