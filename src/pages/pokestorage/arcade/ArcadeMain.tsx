import { useEffect, useState } from 'react'
import { ROSTER, type Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider } from '../../../services/storage'
import { DropboxMenu } from '../../hub/DropboxMenu'
import { GAME_LABEL } from '../gameDisplay'
import { storageErrorMessage, useStorageProvider } from '../useStorage'
import './arcadeZone.css'

const GAMES = ROSTER[3] as readonly Gen3GameId[]

type GameFiles = { rom: boolean; save: boolean }

export function ArcadeMain({ onBack }: { onBack(): void }) {
  const { provider, ready } = useStorageProvider()
  /** File status per game, and the provider it was read from. */
  const [checked, setChecked] = useState<{
    provider: StorageProvider
    files: Partial<Record<Gen3GameId, GameFiles>>
    error: string | null
  } | null>(null)
  const current = checked?.provider === provider ? checked : null

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    // Only metadata for ROMs: their bytes are read when a game is opened.
    Promise.all(
      GAMES.map(async (gameId) => {
        const [rom, save] = await Promise.all([
          provider.hasRom(gameId),
          provider.getSave(gameId),
        ])
        return [gameId, { rom, save: save !== null }] as const
      })
    )
      .then((entries) => {
        if (!cancelled) {
          setChecked({
            provider,
            files: Object.fromEntries(entries),
            error: null,
          })
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setChecked({ provider, files: {}, error: storageErrorMessage(cause) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [provider, ready])

  const openGame = (gameId: Gen3GameId) => {
    const url = new URL(
      'arcade/',
      window.location.origin + import.meta.env.BASE_URL
    )
    url.searchParams.set('game', gameId)
    window.location.assign(url)
  }

  return (
    <div className="camp-zone arcade-zone">
      <DropboxMenu />
      <main className="camp-root">
        <div className="camp-content arcade-select">
          <header className="camp-page-header">
            <button type="button" className="camp-back" onClick={onBack}>
              ← Back
            </button>
            <div className="camp-page-heading">
              <p className="camp-eyebrow">Arcade</p>
              <h1 className="camp-title">Choose a game</h1>
              <p className="camp-page-subtitle">
                Your games and saves come from {provider.label}.
              </p>
            </div>
            <span className="camp-page-header-spacer" aria-hidden="true" />
          </header>
          {current?.error && (
            <p className="camp-error" role="alert">
              {current.error}
            </p>
          )}
          <div className="arcade-game-grid">
            {GAMES.map((gameId) => {
              const files = current?.files[gameId]
              return (
                <button
                  type="button"
                  onClick={() => openGame(gameId)}
                  key={gameId}
                  className="arcade-game-card"
                  data-version={gameId}
                >
                  <span className="arcade-cartridge-mark" aria-hidden="true">
                    GAME BOY ADVANCE
                  </span>
                  <span className="arcade-cartridge-label">
                    <span className="arcade-game-heading">
                      <span className="arcade-game-name">
                        {GAME_LABEL[gameId]}
                      </span>
                    </span>
                    <span className="arcade-game-save">
                      {current?.error
                        ? 'Save unavailable'
                        : !files
                          ? 'Checking save…'
                          : files.save
                            ? 'Save ready'
                            : 'New game'}
                    </span>
                    <span
                      className="arcade-game-rom"
                      data-ready={files?.rom === true}
                    >
                      {current?.error
                        ? 'ROM unavailable'
                        : !files
                          ? 'Checking ROM…'
                          : files.rom
                            ? 'ROM ready'
                            : 'ROM needed'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
