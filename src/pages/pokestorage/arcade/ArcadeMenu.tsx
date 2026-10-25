import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import type { SyncState } from './arcadeSync'
import {
  getBindingGroups,
  getBindingName as BUTTON_NAME,
  keyLabel,
  type Bindable,
  type KeyBindings,
} from './keyBindings'
import { SpeedPicker } from './PlayerControls'
import { SkinManager } from './skins/delta/SkinManager'
import type { SkinLibraryState } from './skins/delta/useSkinLibrary'
import type { Speed } from './speeds'
import './arcadeMenu.css'

/**
 * Pause menu views stay mounted while inactive to preserve control state.
 */
export type MenuView = 'main' | 'buttons' | 'skins' | 'advanced'

const getViewTitle = (): Readonly<
  Record<Exclude<MenuView, 'main'>, string>
> => ({
  buttons: i18n.t('arcade:ArcadeMenu.controls'),
  skins: i18n.t('arcade:ArcadeMenu.skins'),
  advanced: i18n.t('arcade:ArcadeMenu.advanced'),
})

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
  skinLibrary: SkinLibraryState
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
  skinLibrary,
}: ArcadeMenuProps) {
  const { t } = useTranslation(['arcade', 'common'] as const)

  const subView = (view: Exclude<MenuView, 'main'>) => (
    <header className="arcade-menu-header">
      <button
        type="button"
        className="arcade-menu-back"
        onClick={() => setMenuView('main')}
      >
        {t('ArcadeMenu.menu')}
      </button>
      <h2 id={`arcade-menu-title-${view}`}>{getViewTitle()[view]}</h2>
    </header>
  )
  return (
    <>
      <div className="arcade-menu-view" hidden={menuView !== 'main'}>
        <header className="arcade-menu-header">
          <h2 id="arcade-menu-title-main">
            {running ? t('ArcadeMenu.paused') : t('ArcadeMenu.menu2')}
          </h2>
        </header>
        {(running || sync.status === 'saving' || sync.status === 'saved') && (
          <p className="arcade-menu-save" data-status={sync.status}>
            {sync.status === 'saving'
              ? t('ArcadeMenu.savingYourGame')
              : sync.status === 'saved'
                ? t('ArcadeMenu.yourGameIsSaved')
                : t('ArcadeMenu.saveInsideTheGameBeforeYouLeave')}
          </p>
        )}
        <div className="arcade-menu-list">
          <button
            type="button"
            className="arcade-menu-item arcade-menu-item--primary"
            onClick={() => close()}
          >
            {running ? t('ArcadeMenu.keepPlaying') : t('ArcadeMenu.closeMenu')}
          </button>
          <div
            className="arcade-menu-setting"
            role="group"
            aria-labelledby="arcade-menu-sound"
          >
            <span id="arcade-menu-sound">{t('ArcadeMenu.sound')}</span>
            <div className="arcade-menu-sound">
              <label className="arcade-menu-check">
                <input type="checkbox" checked={muted} onChange={toggleMute} />
                {t('ArcadeMenu.mute')}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                aria-label={t('ArcadeMenu.volume')}
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
              {fullscreen
                ? t('ArcadeMenu.leaveFullScreen')
                : t('ArcadeMenu.fullScreen')}
            </button>
          )}
          <div
            className="arcade-menu-setting"
            role="group"
            aria-labelledby="arcade-menu-speed"
          >
            <span id="arcade-menu-speed">{t('ArcadeMenu.speed')}</span>
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
            {t('ArcadeMenu.controls')}
          </button>
          <button
            type="button"
            className="arcade-menu-item arcade-menu-item--next"
            onClick={() => setMenuView('skins')}
          >
            {t('ArcadeMenu.skins')}
          </button>
          <button
            type="button"
            className="arcade-menu-item"
            onClick={exitFromMenu}
          >
            {t('ArcadeMenu.exitArcade')}
          </button>
        </div>
        <button
          type="button"
          className="arcade-menu-advanced"
          onClick={() => setMenuView('advanced')}
        >
          {t('ArcadeMenu.advancedOptions')}
        </button>
      </div>

      <div className="arcade-menu-view" hidden={menuView !== 'buttons'}>
        {subView('buttons')}
        <div className="arcade-menu-body">
          <p className="arcade-menu-note">
            {t('ArcadeMenu.selectAnActionThenPressItsNewKeyEscCancels')}
          </p>
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
                        button === 'restart'
                          ? 'arcade-binding-restart'
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className="arcade-binding"
                        aria-label={t('ArcadeMenu.keyChange', {
                          value1: BUTTON_NAME()[button],
                          value2: keyLabel(bindings[button]),
                        })}
                        aria-pressed={capturing === button}
                        onClick={() => captureKey(button)}
                      >
                        <span>{BUTTON_NAME()[button]}</span>
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
                        <label className="arcade-menu-check arcade-restart-confirm">
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
      </div>

      <div className="arcade-menu-view" hidden={menuView !== 'skins'}>
        {subView('skins')}
        <div className="arcade-menu-body">
          <SkinManager library={skinLibrary} />
        </div>
      </div>

      <div className="arcade-menu-view" hidden={menuView !== 'advanced'}>
        {subView('advanced')}
        <div className="arcade-menu-body">
          {sync.status === 'failed' && (
            <p className="arcade-menu-alert">
              {t('ArcadeMenu.yourLastGameSaveCouldNotReachCampUseTry', {
                message: sync.message,
              })}
            </p>
          )}
          {sync.status === 'conflict' && (
            <p className="arcade-menu-alert">
              {t('ArcadeMenu.theSaveInCampChangedSomewhereElseSoThisGame')}
            </p>
          )}
          <section
            className="arcade-advanced-section"
            aria-labelledby="arcade-save-tools"
          >
            <h3 id="arcade-save-tools">{t('ArcadeMenu.saveFiles')}</h3>
            <div className="arcade-menu-files">
              <button
                type="button"
                disabled={!canDownload}
                aria-describedby={
                  canDownload ? undefined : 'arcade-no-save-note'
                }
                onClick={downloadSave}
              >
                {t('ArcadeMenu.downloadSav')}
              </button>
              <button
                type="button"
                disabled={filesLocked}
                aria-describedby="arcade-upload-note"
                onClick={() => chooseSave()}
              >
                {t('ArcadeMenu.uploadNewSav')}
              </button>
            </div>
            <p id="arcade-upload-note" className="arcade-menu-note">
              {t('ArcadeMenu.anUploadedSavStartsANewSessionAndReachesCamp')}
            </p>
            {!canDownload && (
              <p id="arcade-no-save-note" className="arcade-menu-note">
                {t('ArcadeMenu.thereIsNoSavToDownloadUntilYouSaveInside')}
              </p>
            )}
          </section>
          <section
            className="arcade-advanced-section"
            aria-labelledby="arcade-cartridge-tools"
          >
            <h3 id="arcade-cartridge-tools">{t('ArcadeMenu.gameCartridge')}</h3>
            <div className="arcade-menu-files">
              <button
                type="button"
                disabled={!rom}
                aria-describedby={rom ? undefined : 'arcade-no-rom-note'}
                onClick={() => downloadRom()}
              >
                {t('ArcadeMenu.downloadRom')}
              </button>
              <button
                type="button"
                disabled={filesLocked}
                onClick={() => chooseRom()}
              >
                {rom ? t('ArcadeMenu.replaceRom') : t('ArcadeMenu.insertRom')}
              </button>
            </div>
            {!rom && (
              <p id="arcade-no-rom-note" className="arcade-menu-note">
                {t('ArcadeMenu.insertARomToDownloadItLater')}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
