import { i18n } from '../../../services/i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ArcadePlayer } from './ArcadePlayer'
import { enableIsolation } from './enableIsolation'
import { resolveRoute } from '../../routing'

const syncTitle = () => {
  document.title = i18n.t('common:document.arcadeTitle')
}
i18n.on('languageChanged', syncTitle)
syncTitle()

const resolved = resolveRoute(window.location)
if (resolved.kind === 'redirect') {
  window.location.replace(resolved.href)
} else if (resolved.route.page !== 'arcade') {
  window.location.replace(import.meta.env.BASE_URL)
} else
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
        root.textContent = i18n.t('arcade:playerMain.arcadeIsolationFailed', {
          value1: String(cause),
        })
      }
    })
