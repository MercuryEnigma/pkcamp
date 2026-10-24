import { useEffect, useRef, useState } from 'react'
import { activeGame } from '../../services/activeGame'
import { device } from '../../services/device'
import { assertArcadeRomMatchesGame } from '../../services/emulator/gbaRom'
import { ROSTER, type Gen3GameId } from '../../services/saveLibrary'
import type { StorageProvider } from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { SPRITE_SOURCES } from '../../services/sprites/catalog'
import { useAppNavigation } from '../context/appNavigation'
import { useActiveGame } from '../context/useActiveGame'
import { GbLinkTaskPanel } from '../pokestorage/GbLinkTaskPanel'
import { GAME_LABEL } from '../pokestorage/gameDisplay'
import {
  storageErrorMessage,
  useDropboxStatus,
} from '../pokestorage/useStorage'
import { routeHref } from '../routing'
import { DropboxMenu } from './DropboxMenu'
import { GameCartridge } from './GameCartridge'
import { useHubStartup } from './useHubStartup'

const GAMES = ROSTER[3] as readonly Gen3GameId[]
type GameFiles = { rom: boolean; save: boolean }

export function StartMenu({
  startup,
  gameId,
  onChooseGame,
  onOpenGame,
  onContinueWithoutSave,
  onCancelGame,
}: {
  startup: ReturnType<typeof useHubStartup>
  gameId: Gen3GameId | null
  onChooseGame: (gameId: Gen3GameId) => void
  onOpenGame: (gameId: Gen3GameId) => void
  onContinueWithoutSave: () => void
  onCancelGame: () => void
}) {
  const setupDialog = useRef<HTMLDialogElement>(null)
  const romDialog = useRef<HTMLDialogElement>(null)
  const saveInput = useRef<HTMLInputElement>(null)
  const romInput = useRef<HTMLInputElement>(null)
  const pendingAction = useRef<(() => void) | null>(null)
  const active = useActiveGame()
  const { navigate } = useAppNavigation()
  // Lab Settings is gated on first-run setup; until then the badge keeps the
  // sign-in dialog. The badge has already confirmed leaving.
  const openStorageSettings = startup.sourceId
    ? () =>
        navigate(routeHref('lab', { mode: 'settings', tab: 'storage' }), {
          guard: false,
        })
    : undefined
  const [sourceId, setSourceId] = useState(
    startup.sourceId ?? SPRITE_SOURCES[0].id
  )
  const [romGameId, setRomGameId] = useState<Gen3GameId | null>(null)
  const [deviceTask, setDeviceTask] = useState<'save' | 'rom' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const status = useDropboxStatus()
  const [checked, setChecked] = useState<{
    provider: StorageProvider
    files: Partial<Record<Gen3GameId, GameFiles>>
    error: string | null
  } | null>(null)
  const current = checked?.provider === startup.provider ? checked : null

  useEffect(() => {
    if (!startup.ready) return
    let cancelled = false
    Promise.all(
      GAMES.map(async (id) => {
        const [rom, save] = await Promise.all([
          startup.provider.hasRom(id),
          startup.provider.hasSave(id),
        ])
        return [id, { rom, save }] as const
      })
    )
      .then((entries) => {
        if (!cancelled)
          setChecked({
            provider: startup.provider,
            files: Object.fromEntries(entries),
            error: null,
          })
      })
      .catch((cause) => {
        if (!cancelled)
          setChecked({
            provider: startup.provider,
            files: {},
            error: storageErrorMessage(cause),
          })
      })
    return () => {
      cancelled = true
    }
  }, [refresh, startup.provider, startup.ready])

  const afterSetup = (action: () => void) => {
    if (startup.sourceId) action()
    else {
      pendingAction.current = action
      setupDialog.current?.showModal()
    }
  }
  const saveSetup = async () => {
    setBusy(true)
    setError(null)
    try {
      await startup.provider.saveSettings({ spriteSourceId: sourceId })
      setupDialog.current?.close()
      const action = pendingAction.current
      pendingAction.current = null
      action?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      await dropboxAccount.signIn()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  const choose = (id: Gen3GameId) => {
    const hasSave = current?.files[id]?.save
    afterSetup(() => (hasSave ? onOpenGame(id) : onChooseGame(id)))
  }
  const openRom = (id: Gen3GameId) => {
    setRomGameId(id)
    setDeviceTask(null)
    setError(null)
    romDialog.current?.showModal()
  }
  const replaceSave = async (file: File) => {
    if (!gameId) return
    setBusy(true)
    setError(null)
    try {
      await activeGame.replaceSave(new Uint8Array(await file.arrayBuffer()))
      setRefresh((value) => value + 1)
      onOpenGame(gameId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
      if (saveInput.current) saveInput.current.value = ''
    }
  }
  const storeRom = async (id: Gen3GameId, bytes: Uint8Array, name: string) => {
    assertArcadeRomMatchesGame(id, bytes)
    const extension = name.split('.').pop()?.toLowerCase() || 'gba'
    await startup.provider.putRom(id, { bytes, extension })
    setRefresh((value) => value + 1)
  }

  if (gameId) {
    const files = current?.files[gameId]
    return (
      <main className="camp-root hub-root hub-start">
        <section className="site-board hub-start-board hub-acquire">
          <header className="site-start-header">
            <div className="site-start-actions">
              <DropboxMenu onOpenSettings={openStorageSettings} />
            </div>
          </header>
          <div className="hub-start-body hub-acquire-body">
            <button
              type="button"
              className="hub-inline-back"
              onClick={onCancelGame}
            >
              ← Choose another game
            </button>
            <h1>
              {files?.save
                ? `Continue ${GAME_LABEL[gameId]}`
                : `Add a ${GAME_LABEL[gameId]} save`}
            </h1>
            <p>
              {files?.save
                ? 'Your save is ready. You can continue or replace it.'
                : 'Upload a save file or read it from a cartridge with a GB-Link.'}
            </p>
            {files?.save && (
              <button
                className="hub-primary-action"
                onClick={() => onOpenGame(gameId)}
              >
                Continue to pkCamp
              </button>
            )}
            <div className="hub-acquire-actions">
              <button
                onClick={() => saveInput.current?.click()}
                disabled={busy || active.status !== 'ready'}
              >
                {files?.save ? 'Replace save file' : 'Upload save file'}
              </button>
              <button
                onClick={() =>
                  setDeviceTask(deviceTask === 'save' ? null : 'save')
                }
                disabled={busy || active.status !== 'ready'}
              >
                Read from GBA
              </button>
            </div>
            <input
              ref={saveInput}
              type="file"
              accept=".sav,.srm,application/octet-stream"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void replaceSave(file)
              }}
            />
            {active.status === 'loading' && (
              <p role="status">Preparing {GAME_LABEL[gameId]}…</p>
            )}
            {(active.error || error) && (
              <p role="alert" className="camp-error">
                {error ?? active.error?.message}
              </p>
            )}
            {deviceTask === 'save' && (
              <GbLinkTaskPanel
                title={`Read ${GAME_LABEL[gameId]} save`}
                steps={[
                  'Connect the GB-Link to this device and to a powered-off GBA.',
                  `Insert ${GAME_LABEL[gameId]} and power on while holding START + SELECT.`,
                ]}
                progressLabel="Reading the save"
                startLabel="Continue"
                onClose={() => setDeviceTask(null)}
                describeError={(cause, cancelled) =>
                  cancelled
                    ? 'The save read was cancelled.'
                    : cause instanceof Error
                      ? cause.message
                      : String(cause)
                }
                run={async (task) => {
                  const bytes = await device.readSave({ ...task, gameId })
                  await activeGame.replaceSave(bytes)
                  setRefresh((value) => value + 1)
                  onOpenGame(gameId)
                  return 'Save added.'
                }}
              />
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="camp-root hub-root hub-start">
      <section className="site-board hub-start-board">
        <header className="site-start-header">
          <div className="site-start-actions">
            <DropboxMenu onOpenSettings={openStorageSettings} />
          </div>
        </header>
        <div className="hub-start-body">
          <h1>Select a game to start</h1>
          {!startup.ready && !startup.error && (
            <p role="status">Loading your settings…</p>
          )}
          {(startup.error || current?.error) && (
            <p role="alert" className="camp-error">
              {startup.error ?? current?.error}{' '}
              <button onClick={startup.retry}>Retry</button>
            </p>
          )}
          <div className="hub-start-carts">
            <div className="game-cartridge-grid">
              {GAMES.map((id) => {
                const files = current?.files[id]
                return (
                  <GameCartridge
                    key={id}
                    gameId={id}
                    onSelect={() => choose(id)}
                    onRom={() => openRom(id)}
                    saveStatus={
                      !files
                        ? 'Checking save…'
                        : files.save
                          ? 'Save ready'
                          : 'New game'
                    }
                    romStatus={
                      !files
                        ? 'Checking ROM…'
                        : files.rom
                          ? 'ROM ready'
                          : 'ROM needed'
                    }
                    romReady={files?.rom === true}
                  />
                )
              })}
            </div>
          </div>
          <button
            className="hub-continue-without"
            disabled={!startup.ready}
            onClick={() => afterSetup(onContinueWithoutSave)}
          >
            Continue without a save
          </button>
        </div>
      </section>
      <footer className="hub-start-footer">
        <div className="hub-credits">
          <p>Made possible by these projects and their contributors</p>
          <p>
            <a href="https://github.com/kwsch/PKHeX">PKHeX</a> ·{' '}
            <a href="https://github.com/EthanThatOneKid/pkhex-wasm">
              pkhex-wasm
            </a>{' '}
            ·{' '}
            <a href="https://github.com/GB-Link/GB-Link-Switch-LDN">GB-Link</a>{' '}
            ·{' '}
            <a href="https://github.com/GB-Link/gb-cart-doctor-web">
              GB-Link Cart Doctor
            </a>
          </p>
          <p>
            {SPRITE_SOURCES.map((source, index) => (
              <span key={source.id}>
                {index > 0 && ' · '}
                <a href={source.homepage}>{source.label.split(' — ')[0]}</a>
              </span>
            ))}
          </p>
          <p>Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.</p>
        </div>
        <a
          className="hub-license"
          href="https://github.com/MercuryEnigma/pkcamp/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
        >
          License
        </a>
      </footer>

      <dialog
        ref={setupDialog}
        className="hub-dialog"
        onClose={() => setError(null)}
      >
        <h2>Welcome to pkCamp</h2>
        <label className="hub-source-label">
          Choose your sprite source
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            {SPRITE_SOURCES.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        {status.state !== 'connected' && dropboxAccount.isConfigured() && (
          <>
            <p>
              Sign in to Dropbox to use your saves across devices, or continue
              with browser storage.
            </p>
            <button
              disabled={busy || status.state === 'connecting'}
              onClick={() => void connect()}
            >
              Sign in to Dropbox
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="hub-dialog-actions">
          <button disabled={busy} onClick={() => setupDialog.current?.close()}>
            Close
          </button>
          <button
            disabled={busy || !startup.ready}
            onClick={() => void saveSetup()}
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </dialog>

      <dialog
        ref={romDialog}
        className="hub-dialog"
        onClose={() => {
          setDeviceTask(null)
          setError(null)
        }}
      >
        <h2>{romGameId ? `${GAME_LABEL[romGameId]} ROM` : 'ROM'}</h2>
        <p>Choose a ROM file or read the cartridge with a GB-Link.</p>
        <div className="hub-dialog-actions hub-dialog-actions--start">
          <button onClick={() => romInput.current?.click()} disabled={busy}>
            Choose ROM file
          </button>
          <button
            onClick={() => setDeviceTask(deviceTask === 'rom' ? null : 'rom')}
            disabled={busy}
          >
            Read from GBA
          </button>
        </div>
        <input
          ref={romInput}
          type="file"
          accept=".gba,application/octet-stream"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file || !romGameId) return
            setBusy(true)
            setError(null)
            void file
              .arrayBuffer()
              .then((buffer) =>
                storeRom(romGameId, new Uint8Array(buffer), file.name)
              )
              .then(() => romDialog.current?.close())
              .catch((cause) =>
                setError(cause instanceof Error ? cause.message : String(cause))
              )
              .finally(() => {
                setBusy(false)
                if (romInput.current) romInput.current.value = ''
              })
          }}
        />
        {deviceTask === 'rom' && romGameId && (
          <GbLinkTaskPanel
            title={`Read ${GAME_LABEL[romGameId]} ROM`}
            steps={[
              'Connect the GB-Link to this device and to a powered-off GBA.',
              `Insert ${GAME_LABEL[romGameId]} and power on while holding START + SELECT.`,
            ]}
            progressLabel="Reading the ROM"
            startLabel="Continue"
            onClose={() => setDeviceTask(null)}
            describeError={(cause, cancelled) =>
              cancelled
                ? 'The ROM read was cancelled.'
                : cause instanceof Error
                  ? cause.message
                  : String(cause)
            }
            run={async (task) => {
              const bytes = await device.readRom({
                ...task,
                gameId: romGameId,
              })
              await storeRom(romGameId, bytes, `${romGameId}.gba`)
              romDialog.current?.close()
              return 'ROM added.'
            }}
          />
        )}
        {error && (
          <p role="alert" className="camp-error">
            {error}
          </p>
        )}
        <div className="hub-dialog-actions">
          <button onClick={() => romDialog.current?.close()}>Close</button>
        </div>
      </dialog>
    </main>
  )
}
