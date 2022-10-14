import { ReactNode, Suspense, useEffect } from 'react'
import { QueryClient } from 'react-query'
import { bool, num, str } from './utils'
import { ErrorBoundary } from 'react-error-boundary'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      suspense: true,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 10, // https://react-query-v2.tanstack.com/guides/caching
    },
  },
})

interface Fetch {
  children: ReactNode
  fallback?: ReactNode
}

export function Fetch({ children, fallback }: Fetch) {
  return (
    <ErrorBoundary fallbackRender={({ error }) => <FetchingState error={error} />}>
      <Suspense fallback={fallback ?? <FetchingState />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export interface FetchingState {
  error?: { message?: str }
  hidden?: bool
  width?: num
  height?: str
  padding?: str
}

export function FetchingState({ error, width, hidden, height, padding }: FetchingState) {
  if (error?.message && !hidden) return <Error message={error.message} />
  // Error boundaries catch everything (message exist only on Errors)
  // Always use Promise.reject(new Error('msg')) not Promise.reject('msg')
  if (error && !hidden) return <Error message={'Caught: ' + error} />
  if (!hidden) return <Loading />
  return null
}

interface Error {
  message: str
}

function Error({ message }: Error) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ color: 'red', fontWeight: 'bold' }}>Error!</p>
      <p style={{ color: 'red' }}>{message}</p>
    </div>
  )
}

function Loading() {
  return <p>Loading...</p>
}
