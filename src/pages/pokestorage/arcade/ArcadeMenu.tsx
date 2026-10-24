import type { SyncState } from './arcadeSync'
import {
  BINDING_GROUPS,
  BINDING_NAME as BUTTON_NAME,
  keyLabel,
  type Bindable,
  type KeyBindings,
} from './keyBindings'
import { SpeedPicker } from './PlayerControls'
import type { Speed } from './speeds'
import './arcadeMenu.css'

/**
 * Pause menu views stay mounted while inactive to preserve control state.
 */
export type MenuView = 'main' | 'buttons' | 'advanced'

const VIEW_TITLE: Readonly<Record<Exclude<MenuView, 'main'>, string>> = {
  buttons: 'Controls',
  advanced: 'Advanced',
}

interface ArcadeMenuProps {
  menuView: MenuView
  setMenuView(view: MenuView): void
  running: boolean
  sync: SyncState
  close(): void
  muted: boolean
  toggleMute(): void
  volume: number
  changeVolume(value: number): void
  speed: Speed
  changeSpeed(value: Speed): void
  fullscreenAvailable: boolean
  fullscreen: boolean
  toggleFullscreen(): void
  exitFromMenu(): void
  bindings: KeyBindings
  capturing: Bindable | null
  captureKey(button: Bindable): void
  confirmRestart: boolean
  changeConfirmRestart(value: boolean): void
  restoreDefaultKeys(): void
  canDownload: boolean
  downloadSave(): void
  filesLocked: boolean
  chooseSave(): void
  rom: Uint8Array | null
  downloadRom(): void
  chooseRom(): void
}

export function ArcadeMenu({
  menuView,
  setMenuView,
  running,
  sync,
  close,
  muted,
  toggleMute,
  volume,
  changeVolume,
  speed,
  changeSpeed,
  fullscreenAvailable,
  fullscreen,
  toggleFullscreen,
  exitFromMenu,
  bindings,
  capturing,
  captureKey,
  confirmRestart,
  changeConfirmRestart,
  restoreDefaultKeys,
  canDownload,
  downloadSave,
  filesLocked,
  chooseSave,
  rom,
  downloadRom,
  chooseRom,
}: ArcadeMenuProps) {
  const subView = (view: Exclude<MenuView, 'main'>) => (
    <header className="arcade-menu-header">
      <button
        type="button"
        className="arcade-menu-back"
        onClick={() => setMenuView('main')}
      >
        ‹ Menu
      </button>
      <h2 id={`arcade-menu-title-${view}`}>{VIEW_TITLE[view]}</h2>
    </header>
  )
  return (
    <>
      <div className="arcade-menu-view" hidden={menuView !== 'main'}>
        <header className="arcade-menu-header">
          <h2 id="arcade-menu-title-main">{running ? 'Paused' : 'Menu'}</h2>
        </header>
        {(running || sync.status === 'saving' || sync.status === 'saved') && (
          <p className="arcade-menu-save" data-status={sync.status}>
            {sync.status === 'saving'
              ? 'Saving your game…'
              : sync.status === 'saved'
                ? 'Your game is saved.'
                : 'Save inside the game before you leave.'}
          </p>
        )}
        <div className="arcade-menu-list">
          <button
            type="button"
            className="arcade-menu-item arcade-menu-item--primary"
            onClick={() => close()}
          >
            {running ? '▶ Keep playing' : 'Close menu'}
          </button>
          <div
            className="arcade-menu-setting"
            role="group"
            aria-labelledby="arcade-menu-sound"
          >
            <span id="arcade-menu-sound">Sound</span>
            <div className="arcade-menu-sound">
              <label className="arcade-menu-check">
                <input type="checkbox" checked={muted} onChange={toggleMute} />
                Mute
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                aria-label="Volume"
                onChange={(event) => changeVolume(Number(event.target.value))}
              />
            </div>
          </div>
          {fullscreenAvailable && (
            <button
              type="button"
              className="arcade-menu-item"
              aria-pressed={fullscreen}
              onClick={() => {
                close()
                toggleFullscreen()
              }}
            >
              {fullscreen ? '⛶ Leave full screen' : '⛶ Full screen'}
            </button>
          )}
          <div
            className="arcade-menu-setting"
            role="group"
            aria-labelledby="arcade-menu-speed"
          >
            <span id="arcade-menu-speed">Speed</span>
            {
              <SpeedPicker
                labelId="arcade-menu-speed"
                speed={speed}
                onChange={changeSpeed}
              />
            }
          </div>
          <button
            type="button"
            className="arcade-menu-item arcade-menu-item--next"
            onClick={() => setMenuView('buttons')}
          >
            Controls
          </button>
          <button
            type="button"
            className="arcade-menu-item"
            onClick={exitFromMenu}
          >
            Exit Arcade
          </button>
        </div>
        <button
          type="button"
          className="arcade-menu-advanced"
          onClick={() => setMenuView('advanced')}
        >
          Advanced options
        </button>
      </div>

      <div className="arcade-menu-view" hidden={menuView !== 'buttons'}>
        {subView('buttons')}
        <div className="arcade-menu-body">
          <p className="arcade-menu-note">
            Select an action, then press its new key. Esc cancels.
          </p>
          <div className="arcade-bindings">
            {BINDING_GROUPS.map((group) => (
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
                        button === 'restart'
                          ? 'arcade-binding-restart'
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className="arcade-binding"
                        aria-label={`${BUTTON_NAME[button]} key: ${keyLabel(bindings[button])}. Change`}
                        aria-pressed={capturing === button}
                        onClick={() => captureKey(button)}
                      >
                        <span>{BUTTON_NAME[button]}</span>
                        <kbd
                          className="arcade-keycap"
                          data-empty={bindings[button] ? undefined : ''}
                        >
                          {capturing === button
                            ? 'Press a key…'
                            : keyLabel(bindings[button])}
                        </kbd>
                      </button>
                      {button === 'restart' && (
                        <label className="arcade-menu-check arcade-restart-confirm">
                          <input
                            type="checkbox"
                            checked={confirmRestart}
                            onChange={(event) =>
                              changeConfirmRestart(event.target.checked)
                            }
                          />
                          Confirm before restarting
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
            Restore default keys
          </button>
        </div>
      </div>

      <div className="arcade-menu-view" hidden={menuView !== 'advanced'}>
        {subView('advanced')}
        <div className="arcade-menu-body">
          {sync.status === 'failed' && (
            <p className="arcade-menu-alert">
              Your last game save could not reach Camp ({sync.message}). Use Try
              again under the screen, or Download SAV.
            </p>
          )}
          {sync.status === 'conflict' && (
            <p className="arcade-menu-alert">
              The save in Camp changed somewhere else, so this game’s save was
              not copied over it. Download SAV to keep it.
            </p>
          )}
          <section
            className="arcade-advanced-section"
            aria-labelledby="arcade-save-tools"
          >
            <h3 id="arcade-save-tools">Save files</h3>
            <div className="arcade-menu-files">
              <button
                type="button"
                disabled={!canDownload}
                aria-describedby={
                  canDownload ? undefined : 'arcade-no-save-note'
                }
                onClick={downloadSave}
              >
                Download SAV
              </button>
              <button
                type="button"
                disabled={filesLocked}
                aria-describedby="arcade-upload-note"
                onClick={() => chooseSave()}
              >
                Upload new SAV
              </button>
            </div>
            <p id="arcade-upload-note" className="arcade-menu-note">
              An uploaded SAV starts a new session and reaches Camp once you
              save inside the game.
            </p>
            {!canDownload && (
              <p id="arcade-no-save-note" className="arcade-menu-note">
                There is no SAV to download until you save inside the game.
              </p>
            )}
          </section>
          <section
            className="arcade-advanced-section"
            aria-labelledby="arcade-cartridge-tools"
          >
            <h3 id="arcade-cartridge-tools">Game cartridge</h3>
            <div className="arcade-menu-files">
              <button
                type="button"
                disabled={!rom}
                aria-describedby={rom ? undefined : 'arcade-no-rom-note'}
                onClick={() => downloadRom()}
              >
                Download ROM
              </button>
              <button
                type="button"
                disabled={filesLocked}
                onClick={() => chooseRom()}
              >
                {rom ? 'Replace ROM' : 'Insert ROM'}
              </button>
            </div>
            {!rom && (
              <p id="arcade-no-rom-note" className="arcade-menu-note">
                Insert a ROM to download it later.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
