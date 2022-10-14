import dayjs from 'dayjs'
import { nanoid } from 'nanoid'

export type num = number
export type str = string
export type bool = boolean

export type strs = str[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSObject = { [key: string]: any }

export const safeSplit = (str: string, sep: string | RegExp) => {
  const parts = str.split(sep)
  return parts.map((s) => s.trim()).filter((e) => e)
}

export const sort = <T>(arr: T[], toNum: (element: T) => number = (e) => e as unknown as number): T[] => {
  arr.sort((a, b) => toNum(a) - toNum(b))
  return arr
}

export function removeUndefined<T extends JSObject>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (k, v) => (v === undefined ? undefined : v))) as T
}

export const safe = <T>(o?: T, hint = ''): Exclude<T, null | undefined> => {
  if (o === undefined || o === null) throw Error(`Object is not safe ${hint}`)
  return o as Exclude<T, null | undefined>
}

export const now = (): number => dayjs().unix() // sec, but dayjs(msec)

export const uuid = ({ short = false } = {}) => {
  return nanoid(short ? 6 : 21)
}
