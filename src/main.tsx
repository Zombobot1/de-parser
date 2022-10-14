import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider, useQuery } from 'react-query'
import { App } from './App'
import { Fetch, queryClient } from './Fetch'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Fetch>
        <App />
      </Fetch>
    </QueryClientProvider>
  </React.StrictMode>,
)
