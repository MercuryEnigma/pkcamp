import React from 'react'
import ReactDOM from 'react-dom/client'
import { ArcadePlayer } from './ArcadePlayer'
import { enableIsolation } from './enableIsolation'

void enableIsolation()
  .then((ready) => {
    if (!ready) return
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ArcadePlayer />
      </React.StrictMode>
    )
  })
  .catch((cause) => {
    const root = document.getElementById('root')
    if (root) {
      root.setAttribute('role', 'alert')
      root.textContent = `Arcade isolation failed: ${String(cause)}`
    }
  })
