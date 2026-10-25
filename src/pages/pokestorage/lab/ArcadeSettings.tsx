import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import {
  getBindingGroups,
  getBindingName,
  DEFAULT_KEY_BINDINGS,
  assignKey,
  canBind,
  keyLabel,
  loadConfirmRestart,
  loadKeyBindings,
  saveConfirmRestart,
  saveKeyBindings,
  type Bindable,
} from '../arcade/keyBindings'
import { SkinManager } from '../arcade/skins/delta/SkinManager'
import { useSkinLibrary } from '../arcade/skins/delta/useSkinLibrary'

/**
 * The Arcade's key bindings, restart confirmation, and controller skins. These are the same
 * settings as the Arcade's in-game menu, read and written through the same
 * helpers, so a change here applies the next time the Arcade opens.
 */
export function ArcadeSettings() {
  const { t } = useTranslation(['settings', 'common'] as const)

  const [bindings, setBindings] = useState(loadKeyBindings)
  const [confirmRestart, setConfirmRestart] = useState(loadConfirmRestart)
  const [capturing, setCapturing] = useState<Bindable | null>(null)
  const skinLibrary = useSkinLibrary()

  useEffect(() => {
    if (!capturing) return
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.code !== 'Escape' && canBind(event.code)) {
        const next = assignKey(bindings, capturing, event.code)
        setBindings(next)
        saveKeyBindings(next)
      }
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [bindings, capturing])

  return (
    <>
      <p>{t('ArcadeSettings.selectAnActionThenPressItsNewKeyEscCancels')}</p>
      <div className="settings-bindings">
        {getBindingGroups().map((group) => (
          <section key={group.id} aria-labelledby={`bindings-${group.id}`}>
            <h3 id={`bindings-${group.id}`}>{group.title}</h3>
            <ul>
              {group.items.map((button) => (
                <li key={button}>
                  <button
                    type="button"
                    className="settings-binding"
                    aria-label={t('ArcadeSettings.keyChange', {
                      value1: getBindingName()[button],
                      value2: keyLabel(bindings[button]),
                    })}
                    aria-pressed={capturing === button}
                    onClick={() => setCapturing(button)}
                  >
                    <span>{getBindingName()[button]}</span>
                    <kbd>
                      {capturing === button
                        ? t('ArcadeSettings.pressAKey')
                        : keyLabel(bindings[button])}
                    </kbd>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <label className="settings-check">
        <input
          type="checkbox"
          checked={confirmRestart}
          onChange={(event) => {
            setConfirmRestart(event.target.checked)
            saveConfirmRestart(event.target.checked)
          }}
        />
        {t('ArcadeSettings.confirmBeforeRestarting')}
      </label>
      <button
        type="button"
        className="camp-text-btn"
        onClick={() => {
          setBindings(DEFAULT_KEY_BINDINGS)
          saveKeyBindings(DEFAULT_KEY_BINDINGS)
        }}
      >
        {t('ArcadeSettings.restoreDefaultKeys')}
      </button>
      <section aria-labelledby="settings-skin">
        <h3 id="settings-skin">{t('ArcadeSettings.controllerSkin')}</h3>
        <SkinManager library={skinLibrary} />
      </section>
    </>
  )
}
