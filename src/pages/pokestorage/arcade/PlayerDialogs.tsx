import { useTranslation } from 'react-i18next'
import type { RefObject } from 'react'
import type { ExitDecision } from './arcadeSync'

interface PlayerDialogsProps {
  exitRef: RefObject<HTMLDialogElement | null>
  restartRef: RefObject<HTMLDialogElement | null>
  decision: ExitDecision
  running: boolean
  exitClosed(): void
  restartClosed(): void
  retrySave(): void
  downloadSave(): void
  navigateAway(): void
  restartNow(): void
}

export function PlayerDialogs({
  exitRef,
  restartRef,
  decision,
  running,
  exitClosed,
  restartClosed,
  retrySave,
  downloadSave,
  navigateAway,
  restartNow,
}: PlayerDialogsProps) {
  const { t } = useTranslation(['arcade', 'common'] as const)

  return (
    <>
      <dialog
        ref={exitRef}
        className="arcade-menu arcade-dialog arcade-exit"
        aria-labelledby="arcade-exit-title"
        onClose={exitClosed}
      >
        <header className="arcade-menu-header">
          <h2 id="arcade-exit-title">
            {decision.kind === 'ask'
              ? decision.title
              : t('PlayerDialogs.leaveTheArcade')}
          </h2>
        </header>
        <div className="arcade-menu-body">
          <p
            className={
              decision.kind === 'ask' && decision.severity === 'warning'
                ? 'arcade-menu-alert'
                : 'arcade-menu-save'
            }
          >
            {decision.kind === 'ask'
              ? decision.message
              : t('PlayerDialogs.yourGameSaveIsInCamp')}
          </p>
          {decision.kind === 'ask' && (decision.retry || decision.download) && (
            <div className="arcade-menu-row">
              {decision.retry && (
                <button type="button" onClick={retrySave}>
                  {t('PlayerDialogs.tryAgain')}
                </button>
              )}
              {decision.download && (
                <button type="button" onClick={downloadSave}>
                  {t('PlayerDialogs.downloadSav')}
                </button>
              )}
            </div>
          )}
          <div className="arcade-menu-list">
            <button
              type="button"
              className="arcade-menu-item arcade-menu-item--primary"
              onClick={() => exitRef.current?.close()}
            >
              {running
                ? t('PlayerDialogs.keepPlaying')
                : t('PlayerDialogs.stayHere')}
            </button>
            <button
              type="button"
              className="arcade-menu-item"
              onClick={navigateAway}
            >
              {t('PlayerDialogs.exitArcade')}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={restartRef}
        className="arcade-menu arcade-dialog arcade-restart"
        aria-labelledby="arcade-restart-title"
        onClose={restartClosed}
      >
        <header className="arcade-menu-header">
          <h2 id="arcade-restart-title">{t('PlayerDialogs.restartTheGame')}</h2>
        </header>
        <div className="arcade-menu-body">
          <p className="arcade-menu-save">
            {t('PlayerDialogs.anythingSinceYourLastSaveInsideTheGameWillBe')}
          </p>
          <div className="arcade-menu-list">
            <button
              type="button"
              className="arcade-menu-item arcade-menu-item--primary"
              onClick={() => restartRef.current?.close()}
            >
              {t('PlayerDialogs.keepPlaying')}
            </button>
            <button
              type="button"
              className="arcade-menu-item"
              onClick={() => {
                restartNow()
                restartRef.current?.close()
              }}
            >
              {t('PlayerDialogs.restart')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
