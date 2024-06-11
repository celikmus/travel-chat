import * as React from 'react'
import Link from 'next/link'
import {auth} from '@/auth'
import {Button} from '@/components/ui/button'
import {IconNextChat, IconSeparator} from '@/components/ui/icons'
import {UserMenu} from '@/components/user-menu'
import {SidebarMobile} from './sidebar-mobile'
import {SidebarToggle} from './sidebar-toggle'
import {ChatHistory} from './chat-history'
import {Session} from '@/lib/types'
import Image from 'next/image'
import NearMaxLogo from '@/public/NearMax brand3.svg'

async function UserOrLogin() {
  const session = (await auth()) as Session
  return (
    <div className="flex align-items">
      {session?.user ? (
        <>
          <SidebarMobile>
            <ChatHistory userId={session.user.id}/>
          </SidebarMobile>
          <SidebarToggle/>
        </>
      ) : (
        <Link href="/new" rel="nofollow">
          <IconNextChat className="size-6 mr-2 dark:hidden" inverted/>
          <IconNextChat className="hidden size-6 mr-2 dark:block"/>
        </Link>
      )}
      <div className="flex items-center">
        <IconSeparator className="size-6 text-muted-foreground/50"/>
        {session?.user ? (
          <UserMenu user={session.user}/>
        ) : (
          <Button variant="link" asChild className="-ml-2">
            <Link href="/login">Login</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 border-b shrink-0 bg-gradient-to-b from-background/10 via-background/50 to-background/80 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between">
        <Link
          href={`https://www.nearmax.co.uk`}
          className="flex h-full"
        >
        <span className="-m-6 flex items-center space-x-2 text-2xl font-medium text-indigo-500 dark:text-gray-100">
          <Image src={NearMaxLogo} width={300} alt="Near Max" />
        </span>
        </Link>
        <React.Suspense fallback={<div className="flex-1 overflow-auto"/>}>
          <UserOrLogin/>
        </React.Suspense>
      </div>
    </header>
  )
}
