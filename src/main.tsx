import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import type { Api } from './lib/api'
import './styles.css'
import './y2k.css'

// `npm run dev:demo` runs on made-up data with no accounts; the demo code is not in the production bundle.
async function createApi(): Promise<Api> {
  if (import.meta.env.MODE === 'demo') return (await import('./lib/api-demo')).createDemoApi()
  return (await import('./lib/api-supabase')).createSupabaseApi()
}

void createApi().then((api) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App api={api} />
    </StrictMode>,
  )
})
