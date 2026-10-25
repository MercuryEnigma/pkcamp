import { useTranslation } from 'react-i18next'
import {
  getBindingGroups,
  getBindingName,
  keyLabel,
  type Bindable,
  type KeyBindings,
} from './keyBindings'
import './keyBindingEditor.css'

/**
 * The key binding lists, restart confirmation, and "Restore default keys".
 * Shared by the pause menu's Controls view and Lab Settings → Arcade, so both
 * look the same. Key capture stays with the caller.
 */
export function KeyBindingEditor({
  bindings,
  capturing,
  captureKey,
  confirmRestart,
  changeConfirmRestart,
  restoreDefaultKeys,
}: {
  bindings: KeyBindings
  capturing: Bindable | null
  captureKey(button: Bindable): void
  confirmRestart: boolean
  changeConfirmRestart(value: boolean): void
  restoreDefaultKeys(): void
}) {
  const { t } = useTranslation(['arcade', 'common'] as const)

  return (
    <div className="arcade-binding-editor">
      <div className="arcade-bindings">
        {getBindingGroups().map((group) => (
          <section
            key={group.id}
            className={`arcade-binding-group arcade-binding-group--${group.id}`}
            aria-labelledby={`arcade-bindings-${group.id}`}
          >
            <h3 id={`arcade-bindings-${group.id}`}>{group.title}</h3>
            <ul>
              {group.items.map((button) => (
                <li
                  key={button}
                  className={
                    button === 'restart' ? 'arcade-binding-restart' : undefined
                  }
                >
                  <button
                    type="button"
                    className="arcade-binding"
                    aria-label={t('ArcadeMenu.keyChange', {
                      value1: getBindingName()[button],
                      value2: keyLabel(bindings[button]),
                    })}
                    aria-pressed={capturing === button}
                    onClick={() => captureKey(button)}
                  >
                    <span>{getBindingName()[button]}</span>
                    <kbd
                      className="arcade-keycap"
                      data-empty={bindings[button] ? undefined : ''}
                    >
                      {capturing === button
                        ? t('ArcadeMenu.pressAKey')
                        : keyLabel(bindings[button])}
                    </kbd>
                  </button>
                  {button === 'restart' && (
                    <label className="arcade-restart-confirm">
                      <input
                        type="checkbox"
                        checked={confirmRestart}
                        onChange={(event) =>
                          changeConfirmRestart(event.target.checked)
                        }
                      />
                      {t('ArcadeMenu.confirmBeforeRestarting')}
                    </label>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="arcade-menu-link"
        onClick={restoreDefaultKeys}
      >
        {t('ArcadeMenu.restoreDefaultKeys')}
      </button>
    </div>
  )
}
