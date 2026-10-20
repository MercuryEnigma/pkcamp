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
            {decision.kind === 'ask' ? decision.title : 'Leave the Arcade?'}
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
              : 'Your game save is in Camp.'}
          </p>
          {decision.kind === 'ask' && (decision.retry || decision.download) && (
            <div className="arcade-menu-row">
              {decision.retry && (
                <button type="button" onClick={retrySave}>
                  Try again
                </button>
              )}
              {decision.download && (
                <button type="button" onClick={downloadSave}>
                  Download SAV
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
              {running ? '▶ Keep playing' : 'Stay here'}
            </button>
            <button
              type="button"
              className="arcade-menu-item"
              onClick={navigateAway}
            >
              Exit Arcade
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
          <h2 id="arcade-restart-title">Restart the game?</h2>
        </header>
        <div className="arcade-menu-body">
          <p className="arcade-menu-save">
            Anything since your last save inside the game will be lost.
          </p>
          <div className="arcade-menu-list">
            <button
              type="button"
              className="arcade-menu-item arcade-menu-item--primary"
              onClick={() => restartRef.current?.close()}
            >
              ▶ Keep playing
            </button>
            <button
              type="button"
              className="arcade-menu-item"
              onClick={() => {
                restartNow()
                restartRef.current?.close()
              }}
            >
              ↻ Restart
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
