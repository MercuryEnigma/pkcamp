import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'
import { savedLanguage, saveLanguage } from './languages'

// All catalogs are bundled; synchronous initialization also covers boot failures.
void i18next.use(initReactI18next).init({
  resources,
  lng: savedLanguage(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: Object.keys(resources.en),
  initAsync: false,
  interpolation: { escapeValue: false },
})

// Keep document metadata in step with the language actually being rendered.
const syncDocumentLanguage = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18next.resolvedLanguage ?? 'en'
  }
}
i18next.on('languageChanged', syncDocumentLanguage)
i18next.on('languageChanged', saveLanguage)
syncDocumentLanguage()

export default i18next
