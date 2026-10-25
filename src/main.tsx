import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { i18n } from './services/i18n'

const syncTitle = () => {
  document.title = i18n.t('common:document.mainTitle')
}
i18n.on('languageChanged', syncTitle)
syncTitle()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
