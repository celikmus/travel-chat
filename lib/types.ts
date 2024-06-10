import { CoreMessage } from 'ai'
import {StreamableValue} from "ai/rsc";
import {ReactElement} from "react";

export type Message = CoreMessage & {
  id: string
  location?: string
  landmark?: {
    info: string
    url: string
  }
}

export interface Chat extends Record<string, any> {
  id: string
  title: string
  createdAt: Date
  userId: string
  path: string
  messages: Message[]
  sharePath?: string
}

export type ServerActionResult<Result> = Promise<
  | Result
  | {
      error: string
    }
>

export interface Session {
  user: {
    id: string
    email: string
  }
}

export interface AuthResult {
  type: string
  message: string
}

export interface User extends Record<string, any> {
  id: string
  email: string
  password: string
  salt: string
}
