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
 * The Arcade's key bindings, restart confirmation, and controller skins. These
 * are the same settings, and the same controls, as the Arcade's pause menu, so
 * a change here applies the next time the Arcade opens.
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
      <section className="lab-arcade-skin" aria-labelledby="settings-skin">
        <h3 id="settings-skin">{t('ArcadeSettings.controllerSkin')}</h3>
        <SkinManager library={skinLibrary} />
      </section>
    </div>
  )
}
