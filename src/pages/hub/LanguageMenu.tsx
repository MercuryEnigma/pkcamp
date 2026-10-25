import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { availableLanguages, languageName } from '../../services/i18n/languages'

export function LanguageMenu() {
  const { t, i18n } = useTranslation(['hub', 'common'] as const)
  const menuId = useId()
  const menu = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const language = i18n.resolvedLanguage ?? 'en'

  return (
    <>
      <button
        ref={button}
        type="button"
        className="camp-dropbox-badge camp-language-button"
        aria-label={t('LanguageMenu.language')}
        title={t('LanguageMenu.language')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        popoverTarget={menuId}
        onClick={() => {
          const rect = button.current!.getBoundingClientRect()
          setPosition({
            top: rect.bottom + 6,
            right: window.innerWidth - rect.right,
          })
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            button.current?.click()
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18M5 6.5h14M5 17.5h14" />
          </g>
        </svg>
        <span className="camp-language-code" aria-hidden="true">
          {language.split('-')[0].toUpperCase()}
        </span>
      </button>
      <div
        ref={menu}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={t('LanguageMenu.language')}
        className="camp-language-menu"
        style={position}
        onToggle={(event) => {
          const expanded = event.newState === 'open'
          setOpen(expanded)
          if (expanded)
            menu.current
              ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
              ?.focus()
        }}
        onKeyDown={(event) => {
          const items = Array.from(menu.current!.querySelectorAll('button'))
          const current = items.indexOf(
            document.activeElement as HTMLButtonElement
          )
          const index =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : event.key === 'ArrowDown'
                  ? (current + 1) % items.length
                  : event.key === 'ArrowUp'
                    ? (current - 1 + items.length) % items.length
                    : null
          if (index !== null) {
            event.preventDefault()
            items[index]?.focus()
          }
          if (event.key === 'Tab') menu.current?.hidePopover()
        }}
      >
        {availableLanguages.map((code) => (
          <button
            key={code}
            type="button"
            role="menuitemradio"
            aria-checked={language === code}
            lang={code}
            onClick={() => {
              void i18n.changeLanguage(code)
              menu.current?.hidePopover()
              button.current?.focus()
            }}
          >
            {languageName(code)}
          </button>
        ))}
      </div>
    </>
  )
}
