import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import {
  DEFAULT_KEY_BINDINGS,
  assignKey,
  canBind,
  loadConfirmRestart,
  loadKeyBindings,
  saveConfirmRestart,
  saveKeyBindings,
  type Bindable,
} from '../arcade/keyBindings'
import { KeyBindingEditor } from '../arcade/KeyBindingEditor'
import { SkinManager } from '../arcade/skins/delta/SkinManager'
import { useSkinLibrary } from '../arcade/skins/delta/useSkinLibrary'

/**
 * The Arcade's key bindings and restart confirmation. These are the same
 * controls as the Arcade pause menu, so a change applies on the next launch.
 */
export function ArcadeControlsSettings() {
  const [bindings, setBindings] = useState(loadKeyBindings)
  const [confirmRestart, setConfirmRestart] = useState(loadConfirmRestart)
  const [capturing, setCapturing] = useState<Bindable | null>(null)
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
    <div className="lab-arcade-settings">
      <KeyBindingEditor
        bindings={bindings}
        capturing={capturing}
        captureKey={setCapturing}
        confirmRestart={confirmRestart}
        changeConfirmRestart={(value) => {
          setConfirmRestart(value)
          saveConfirmRestart(value)
        }}
        restoreDefaultKeys={() => {
          setBindings(DEFAULT_KEY_BINDINGS)
          saveKeyBindings(DEFAULT_KEY_BINDINGS)
        }}
      />
    </div>
  )
}

/** Controller skin library, separated from controls so it has its own URL. */
export function ArcadeSkinSettings() {
  const { t } = useTranslation('settings')
  const skinLibrary = useSkinLibrary()
  return (
    <section
      className="lab-arcade-skin"
      aria-label={t('ArcadeSettings.controllerSkin')}
    >
      <SkinManager library={skinLibrary} />
    </section>
  )
}
