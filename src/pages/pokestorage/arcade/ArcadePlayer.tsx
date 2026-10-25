import { i18n } from '../../../services/i18n'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GbaInputTracker,
  type GbaButton,
} from '../../../services/emulator/input'
import {
  startMgbaSession,
  type MgbaSession,
} from '../../../services/emulator/mgbaRuntime'
import {
  assertArcadeRomMatchesGame,
  identifyArcadeRom,
} from '../../../services/emulator/gbaRom'
import { ROSTER, type Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider } from '../../../services/storage'
import { PageHeader } from '../../hub/PageHeader'
import { GAME_LABEL, getGameLabel } from '../gameDisplay'
import {
  storageErrorMessage,
  useSavedTheme,
  useSpriteStartup,
  useStorageProvider,
} from '../useStorage'
import {
  bootSaveFor,
  completeSnapshot,
  equalBytes,
  type SessionSave,
} from './arcadeSession'
import {
  canReloadFiles,
  createSaveSync,
  exitDecision,
  initialSync,
  unsyncedSave,
  type SaveSync,
  type SyncState,
} from './arcadeSync'
import {
  loadConfirmRestart,
  saveConfirmRestart,
  type ArcadeAction,
} from './keyBindings'
import { useGbaInput } from './useGbaInput'
import { useMediaQuery } from './useMediaQuery'
import { ArcadeMenu, type MenuView } from './ArcadeMenu'
import { SPEEDS, type Speed } from './speeds'
import { PlayerDialogs } from './PlayerDialogs'
import './arcadeStage.css'
import type { SkinAction } from './skins/delta/controllerSkin'
import { DeltaSkinController } from './skins/delta/DeltaSkinController'
import { useDeltaSkin } from './skins/delta/useDeltaSkin'
import { useSkinLibrary } from './skins/delta/useSkinLibrary'
import { routeHref } from '../../routing'
import '../camp.css'
import '../../hub/hub.css'
import './arcadeZone.css'
import './arcadePlayer.css'
import { PokedexGuide } from './PokedexGuide'
import { guide } from '../../../services/guide'

/** How long a shortcut's confirmation shows under the screen. */
const FLASH_MS = 1500

const GAMES = new Set(ROSTER[3] as readonly Gen3GameId[])
/** Quiet period after mGBA syncs a save before it is read and checked. */
const SAVE_SETTLE_MS = 750
function selectedGame(): Gen3GameId | null {
  const value = new URLSearchParams(window.location.search).get('game')
  return value && GAMES.has(value as Gen3GameId) ? (value as Gen3GameId) : null
}

/** Mirrors `lab/downloadFile`, which this entry avoids importing (C2). */
function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer]))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  // Safari can cancel a download whose URL is revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fullscreenSupported(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true
}

/** Touch screens small enough that a skin should use its iPhone layout. */
const PHONE_QUERY =
  '(pointer: coarse) and (max-width: 37.5rem), (pointer: coarse) and (max-height: 37.5rem)'

export function ArcadePlayer() {
  const { t } = useTranslation(['arcade', 'common'] as const)

  const gameId = selectedGame()
  const gameName = gameId
    ? t('ArcadePlayer.pokeMon', { value1: getGameLabel(gameId) })
    : t('ArcadePlayer.arcade')
  const fileBase = gameId
    ? t('ArcadePlayer.pokemon', { value1: GAME_LABEL[gameId] })
    : t('ArcadePlayer.arcade')
  const { provider, ready } = useStorageProvider()
  // Arcade is a separate document for emulator isolation. Hydrate the same
  // Guide and sprite services here at startup, before the Guide can be opened.
  useEffect(() => {
    if (ready) void guide.select(gameId, provider)
  }, [gameId, provider, ready])
  useSpriteStartup()
  useSavedTheme()
  /** The screen alone; fullscreen shows just the game. */
  const screenRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDialogElement>(null)
  const menuViewRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef<HTMLDialogElement>(null)
  const restartRef = useRef<HTMLDialogElement>(null)
  /** Which dialog paused play, so closing that one resumes it. */
  const pausedByRef = useRef<'menu' | 'exit' | 'restart' | 'guide' | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startingRef = useRef<AbortController | null>(null)
  const fileTaskRef = useRef(false)
  const romInputRef = useRef<HTMLInputElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const portrait = useMediaQuery('(orientation: portrait)')
  const phone = useMediaQuery(PHONE_QUERY)
  const skinLibrary = useSkinLibrary()
  const skin = useDeltaSkin(skinLibrary, {
    orientation: portrait ? 'portrait' : 'landscape',
    device: phone ? 'phone' : 'desktop',
  })
  /** Speed to return to when a held fast-forward is released. */
  const fastForwardFromRef = useRef<Speed | null>(null)
  const sessionRef = useRef<MgbaSession | null>(null)
  const inputRef = useRef<GbaInputTracker | null>(null)
  const saveCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leavingRef = useRef(false)
  const [rom, setRom] = useState<Uint8Array | null>(null)
  /** Camp's save (or a loaded SAV file) for the next Start. */
  const [save, setSave] = useState<Uint8Array | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  /** Auto-sync of in-game saves; see `arcadeSync.ts`. */
  const [sync, setSync] = useState<SyncState>(() => initialSync(null))
  const syncRef = useRef<SaveSync | null>(null)
  /** Where this game's saves go, captured at Start. */
  const [destination, setDestination] = useState<StorageProvider | null>(null)
  const destinationRef = useRef<StorageProvider | null>(null)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 0–100, as the menu's slider shows it. */
  const [volume, setVolume] = useState(100)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const [confirmRestart, setConfirmRestart] = useState(loadConfirmRestart)
  const [fullscreen, setFullscreen] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>('main')
  /** The provider whose Camp files are loaded. */
  const [loaded, setLoaded] = useState<StorageProvider | null>(null)
  /** Mirrors `paused` for listeners; updated wherever `paused` is set. */
  const pausedRef = useRef(false)
  /** Runs a shortcut with the current state; kept fresh for the listener. */
  const shortcutRef = useRef<(action: ArcadeAction) => void>(() => {})
  /** A shortcut's short confirmation, e.g. "Speed 2×". */
  const [flash, setFlash] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    bindings,
    bindingsRef,
    capturing,
    capturingRef,
    swallowedKeyRef,
    captureKey,
    restoreDefaultKeys,
    cancelCapture,
  } = useGbaInput(inputRef, pausedRef, shortcutRef)

  const unsynced = unsyncedSave(sync)
  /** Keeps Camp files from reloading over a game or a save Camp lacks. */
  const holdFiles = busy || fileBusy || !canReloadFiles(sync, running)
  // Held files are intentionally kept, so they are not "loading".
  const loadingFiles = gameId !== null && !holdFiles && loaded !== provider
  const decision = exitDecision(sync, running)
  // `beforeunload` reads the latest decision through a ref.
  const leaveRef = useRef(decision.kind === 'leave')
  useEffect(() => {
    leaveRef.current = decision.kind === 'leave'
  }, [decision.kind])
  const notice =
    destination && provider !== destination && (running || unsynced)
      ? t('ArcadePlayer.youSwitchedToThisGameKeepsSavingTo', {
          label: provider.label,
          label2: destination.label,
        })
      : null
  const effectiveVolume = muted ? 0 : volume / 100
  // Speed and volume can change while mGBA starts; apply the latest ones.
  const settingsRef = useRef({ volume: effectiveVolume, speed })
  useEffect(() => {
    settingsRef.current = { volume: effectiveVolume, speed }
  }, [effectiveVolume, speed])

  /** Diagnostics for developers and the browser checks, in the console. */
  const appendLog = (message: string) => console.debug(`[arcade] ${message}`)

  /** Asks before an action that would lose progress; true to proceed. */
  const confirmDiscard = (action: string): boolean =>
    decision.kind === 'leave' ||
    window.confirm(
      t('ArcadePlayer.confirmDiscard', {
        message: decision.message,
        action: action,
      })
    )

  // One sync driver per mounted player. Writes go only to the storage the
  // game started with, through the shared wrapper (cache + change events).
  useEffect(() => {
    const driver = createSaveSync({
      initial: initialSync(null),
      write: async (session, baseline) => {
        const target = destinationRef.current
        if (!gameId || !target)
          throw new Error(t('ArcadePlayer.noStorageForThisGame'))
        const current = await target.getSave(gameId)
        if (!equalBytes(current?.bytes ?? null, baseline)) {
          appendLog(
            t('ArcadePlayer.saveIndexCampChangedElsewhere', {
              saveIndex: session.saveIndex,
            })
          )
          return 'conflict'
        }
        await target.putSave(gameId, session.bytes)
        appendLog(
          t('ArcadePlayer.savedIndexTo', {
            saveIndex: session.saveIndex,
            label: target.label,
          })
        )
        return 'saved'
      },
      onChange: setSync,
      errorMessage: storageErrorMessage,
    })
    syncRef.current = driver
    return () => {
      driver.close()
      if (syncRef.current === driver) syncRef.current = null
    }
    // `appendLog` only writes to the console; `gameId` is fixed per page.
  }, [gameId, t])

  useEffect(() => {
    if (!gameId || !ready || holdFiles) return
    let cancelled = false
    Promise.all([provider.getRom(gameId), provider.getSave(gameId)])
      .then(([storedRom, storedSave]) => {
        if (cancelled) return
        const stored = storedSave?.bytes ?? null
        const boot = bootSaveFor(stored)
        setRom(storedRom?.bytes ?? null)
        setSave(boot.kind === 'save' ? boot.bytes : null)
        setBootError(boot.kind === 'invalid' ? boot.message : null)
        // Only reached with nothing unsynced, so nothing is dropped here.
        syncRef.current?.dispatch({
          type: 'loaded',
          baseline: stored?.slice() ?? null,
        })
        destinationRef.current = null
        setDestination(null)
        appendLog(
          t('ArcadePlayer.romSave', {
            label: provider.label,
            value2: storedRom ? 'loaded' : 'missing',
            value3: stored
              ? t('arcade:ArcadePlayer.bytes', {
                  length: stored.length,
                  kind: boot.kind,
                })
              : 'missing',
          })
        )
      })
      .catch((cause) => {
        if (!cancelled) setError(storageErrorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLoaded(provider)
      })
    return () => {
      cancelled = true
    }
  }, [gameId, provider, ready, holdFiles, t])

  const pause = useCallback((reason: string) => {
    if (!sessionRef.current || pausedRef.current) return
    sessionRef.current.pause()
    inputRef.current?.releaseAll()
    pausedRef.current = true
    setPaused(true)
    appendLog(i18n.t('arcade:ArcadePlayer.paused', { reason: reason }))
  }, [])

  const resume = () => {
    if (!sessionRef.current) return
    sessionRef.current.resume()
    pausedRef.current = false
    pausedByRef.current = null
    setPaused(false)
  }

  // A provider switch pauses play; it never redirects this session's saves.
  useEffect(() => {
    if (destination && provider !== destination)
      pause(t('ArcadePlayer.storageChanged'))
    // `pause` reads only refs and state setters, so it is not a dependency.
  }, [provider, destination, pause, t])

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) pause('hidden')
    }
    // Saving needs async storage, which unload cannot wait for: only warn.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current || leaveRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const fullscreenChange = () =>
      setFullscreen(document.fullscreenElement === screenRef.current)
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('fullscreenchange', fullscreenChange)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('fullscreenchange', fullscreenChange)
      if (saveCheckTimerRef.current) clearTimeout(saveCheckTimerRef.current)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      startingRef.current?.abort()
      startingRef.current = null
      inputRef.current?.releaseAll()
      sessionRef.current?.stop()
      sessionRef.current = null
      inputRef.current = null
    }
    // The stable callback reads only refs and state setters.
  }, [pause])

  // Each menu page starts at its first control.
  useEffect(() => {
    if (menuRef.current?.open) {
      menuViewRef.current
        ?.querySelector<HTMLElement>(
          '.arcade-menu-view:not([hidden]) :is(button, input)'
        )
        ?.focus()
    }
  }, [menuView])

  /** The emulator's current save when complete, without adopting it. */
  const readSnapshot = (): SessionSave | null =>
    completeSnapshot(sessionRef.current?.getSave() ?? null)

  /** Hands the game's settled save to auto-sync when it is complete. */
  const settleSave = () => {
    const snapshot = readSnapshot()
    appendLog(
      snapshot
        ? t('ArcadePlayer.completeSaveIndex', { saveIndex: snapshot.saveIndex })
        : t('ArcadePlayer.saveSnapshotIncompleteKeepingThePreviousSave')
    )
    if (snapshot)
      syncRef.current?.dispatch({ type: 'game-saved', save: snapshot })
  }

  /**
   * Ends the running game without asking; callers confirm first. A save the
   * game just wrote is still synced unless `keepSave` is false.
   */
  const endSession = (keepSave = true) => {
    if (saveCheckTimerRef.current) {
      clearTimeout(saveCheckTimerRef.current)
      saveCheckTimerRef.current = null
      if (keepSave) settleSave()
    }
    inputRef.current?.releaseAll()
    sessionRef.current?.stop()
    inputRef.current = null
    sessionRef.current = null
    setRunning(false)
    pausedRef.current = false
    pausedByRef.current = null
    setPaused(false)
    appendLog(t('ArcadePlayer.mgbaStopped'))
  }

  const importRom = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    setError(null)
    if (!file || startingRef.current || fileTaskRef.current) return
    fileTaskRef.current = true
    setFileBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (startingRef.current) return
      const identity = identifyArcadeRom(bytes)
      if (!identity) {
        setError(t('ArcadePlayer.thatFileIsNotASupportedPokeMonGen3'))
        return
      }
      if (gameId) {
        try {
          assertArcadeRomMatchesGame(gameId, bytes)
        } catch (cause) {
          setError(storageErrorMessage(cause))
          return
        }
        if (running) {
          // Replacing the cartridge stops the game, so ask like leaving.
          if (!confirmDiscard(t('ArcadePlayer.replaceTheRomTheGameWillStop')))
            return
          endSession()
        } else if (
          rom &&
          !window.confirm(
            t('ArcadePlayer.replaceTheStoredRom', { gameName: gameName })
          )
        ) {
          return
        }
        try {
          await provider.putRom(gameId, { bytes, extension: 'gba' })
        } catch (cause) {
          setError(storageErrorMessage(cause))
          return
        }
      }
      setRom(bytes)
      appendLog(
        t('ArcadePlayer.romBytes', {
          gameCode: identity.gameCode,
          length: bytes.length,
        })
      )
    } catch (cause) {
      setError(storageErrorMessage(cause))
    } finally {
      fileTaskRef.current = false
      setFileBusy(false)
    }
  }

  /**
   * Loads a `.sav` into the next game only, stopping a running one. It
   * reaches Camp only through an in-game save, never directly: the player
   * validates structure here, while Cabin owns PKHeX game matching.
   */
  const importSave = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    setError(null)
    if (!file || startingRef.current || fileTaskRef.current) return
    fileTaskRef.current = true
    setFileBusy(true)
    try {
      if (!confirmDiscard(t('ArcadePlayer.replaceItWithThisSavFile'))) return
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (startingRef.current) return
      const boot = bootSaveFor(bytes)
      if (boot.kind === 'invalid') {
        setError(boot.message)
        return
      }
      // The new save needs a fresh boot; the player already agreed to stop.
      if (sessionRef.current) endSession(false)
      const bootBytes = boot.kind === 'save' ? boot.bytes : null
      setSave(bootBytes)
      setBootError(null)
      syncRef.current?.dispatch({ type: 'imported', bytes: bootBytes })
      destinationRef.current = null
      setDestination(null)
      appendLog(
        boot.kind === 'save'
          ? t('ArcadePlayer.savSelectedBytesIndex', {
              length: bytes.length,
              saveIndex: boot.saveIndex,
            })
          : t('ArcadePlayer.blankSavSelectedStartingANewGame')
      )
    } catch (cause) {
      setError(storageErrorMessage(cause))
    } finally {
      fileTaskRef.current = false
      setFileBusy(false)
    }
  }

  /** Bytes the next Start boots: the newest save this page knows of. */
  const bootBytes =
    unsynced?.bytes ?? (sync.lastSyncedAt !== null ? sync.baseline : save)

  const start = async () => {
    if (
      !rom ||
      !canvasRef.current ||
      !crossOriginIsolated ||
      startingRef.current ||
      fileTaskRef.current
    )
      return
    const controller = new AbortController()
    startingRef.current = controller
    setBusy(true)
    setError(null)
    try {
      const session = await startMgbaSession({
        canvas: canvasRef.current,
        rom,
        save: bootBytes ?? undefined,
        signal: controller.signal,
        onSaveChanged: () => {
          appendLog('saveDataUpdatedCallback')
          if (saveCheckTimerRef.current) clearTimeout(saveCheckTimerRef.current)
          saveCheckTimerRef.current = setTimeout(() => {
            saveCheckTimerRef.current = null
            if (sessionRef.current === session) settleSave()
          }, SAVE_SETTLE_MS)
        },
        onCrash: () => {
          if (sessionRef.current === session)
            setError(t('ArcadePlayer.theEmulatorCrashed'))
        },
      })
      if (controller.signal.aborted) {
        session.stop()
        return
      }
      sessionRef.current = session
      inputRef.current = new GbaInputTracker((button, pressed) =>
        session.setButton(button, pressed)
      )
      session.setVolume(settingsRef.current.volume)
      session.setSpeed(settingsRef.current.speed)
      // A save Camp lacks still belongs to the storage it started with.
      if (!(unsynced && destinationRef.current)) {
        destinationRef.current = provider
      }
      setDestination(destinationRef.current)
      setRunning(true)
      pausedRef.current = false
      setPaused(false)
      appendLog(t('ArcadePlayer.mgbaStarted'))
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (startingRef.current === controller) {
        startingRef.current = null
        setBusy(false)
      }
    }
  }

  /** Restarts from the game's last in-game save, then keeps playing. */
  const restartNow = () => {
    if (!sessionRef.current) return
    inputRef.current?.releaseAll()
    sessionRef.current.reset()
    if (pausedRef.current) resume()
    appendLog('reset')
  }

  /** Restart, asking first unless the player turned that off. */
  const restart = () => {
    if (!sessionRef.current) return
    if (!confirmRestart) {
      restartNow()
      return
    }
    // Hold the game still while the question is up.
    if (!pausedRef.current) {
      pause(t('ArcadePlayer.restartQuestion'))
      pausedByRef.current = 'restart'
    }
    restartRef.current?.showModal()
    restartRef.current
      ?.querySelector<HTMLElement>('.arcade-menu-item--primary')
      ?.focus()
  }
  const restartClosed = () => {
    const pausedByRestart = pausedByRef.current === 'restart'
    pausedByRef.current = null
    if (pausedByRestart && sessionRef.current && pausedRef.current) resume()
  }

  const retrySave = () => syncRef.current?.dispatch({ type: 'retry' })

  /** Where leaving goes once any unsaved progress is dealt with. */
  const exitTargetRef = useRef<string | null>(null)
  const navigateAway = () => {
    leavingRef.current = true
    window.location.assign(
      exitTargetRef.current ?? routeHref('hub', { gameId })
    )
  }

  /** Back and Exit Arcade: leave directly only when nothing is at stake. */
  const leave = (target: string | null = null) => {
    exitTargetRef.current = target
    if (decision.kind === 'leave') {
      navigateAway()
      return
    }
    if (running && !pausedRef.current) {
      pause('exit')
      pausedByRef.current = 'exit'
    }
    exitRef.current?.showModal()
    // The safe choice, not the first recovery action, starts focused.
    exitRef.current
      ?.querySelector<HTMLElement>('.arcade-menu-item--primary')
      ?.focus()
  }
  const exitClosed = () => {
    const pausedByExit = pausedByRef.current === 'exit'
    pausedByRef.current = null
    if (pausedByExit && sessionRef.current && pausedRef.current) resume()
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void screenRef.current?.requestFullscreen().catch(() => {})
  }

  /** The pause menu: opening it pauses play, closing it resumes. */
  const openMenu = (view: MenuView = 'main') => {
    if (running && !pausedRef.current) {
      pause('menu')
      pausedByRef.current = 'menu'
    }
    setMenuView(view)
    if (!menuRef.current?.open) menuRef.current?.showModal()
  }
  const menuClosed = () => {
    cancelCapture()
    setMenuView('main')
    if (pausedByRef.current !== 'menu') return
    if (sessionRef.current && pausedRef.current) resume()
  }
  const exitFromMenu = () => {
    // The exit dialog takes over the menu's pause, so play stays paused.
    if (pausedByRef.current === 'menu') pausedByRef.current = 'exit'
    menuRef.current?.close()
    leave()
  }

  const guideFromMenu = () => {
    // The Guide takes over the menu's pause, so play stays paused.
    if (pausedByRef.current === 'menu') pausedByRef.current = 'guide'
    menuRef.current?.close()
    setGuideOpen(true)
  }

  const changeConfirmRestart = (next: boolean) => {
    setConfirmRestart(next)
    saveConfirmRestart(next)
  }

  const changeVolume = (next: number) => {
    setVolume(next)
    if (next > 0) setMuted(false)
    sessionRef.current?.setVolume(next / 100)
  }

  const toggleMute = () => {
    setMuted(!muted)
    sessionRef.current?.setVolume(muted ? volume / 100 : 0)
  }

  const changeSpeed = (next: Speed) => {
    setSpeed(next)
    sessionRef.current?.setSpeed(next)
  }

  const showFlash = (message: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(message)
    flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_MS)
  }

  const runShortcut = (action: ArcadeAction) => {
    switch (action) {
      case 'menu':
        // The Menu key toggles; focus may not be inside the open menu.
        if (menuRef.current?.open) menuRef.current.close()
        else openMenu()
        return
      case 'mute':
        toggleMute()
        showFlash(
          muted
            ? t('arcade:ArcadePlayer.soundOn')
            : t('arcade:ArcadePlayer.soundOff')
        )
        return
      case 'speed': {
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
        changeSpeed(next)
        showFlash(t('arcade:ArcadePlayer.speed', { next: next }))
        return
      }
      case 'guide':
        if (running && !paused) {
          pause('guide')
          pausedByRef.current = 'guide'
        }
        setGuideOpen(true)
        return
      case 'restart':
        restart()
        return
    }
  }
  useEffect(() => {
    shortcutRef.current = runShortcut
  })

  const handleButton = (button: GbaButton, pressed: boolean, source: string) =>
    pressed
      ? inputRef.current?.setSource(source, [button])
      : inputRef.current?.releaseSource(source)

  const handleSkinAction = (action: SkinAction, pressed: boolean) => {
    if (action === 'fastForward') {
      if (pressed) {
        fastForwardFromRef.current ??= speed
        changeSpeed(SPEEDS[SPEEDS.length - 1])
      } else if (fastForwardFromRef.current !== null) {
        changeSpeed(fastForwardFromRef.current)
        fastForwardFromRef.current = null
      }
    } else if (pressed) {
      shortcutRef.current(action)
    }
  }

  /** The newest save to download: the running game's, else the next boot. */
  const downloadSave = () => {
    const bytes = (running ? readSnapshot()?.bytes : null) ?? bootBytes
    if (bytes) download(bytes, `${fileBase} (Arcade).sav`)
    else setError(t('ArcadePlayer.thereIsNoSaveYetSaveInsideTheGameFirst'))
  }
  const canDownload = running || bootBytes !== null

  const status = !crossOriginIsolated
    ? t('arcade:ArcadePlayer.unavailableInThisBrowser')
    : loadingFiles
      ? t('common:actions.loading')
      : busy
        ? t('arcade:ArcadePlayer.starting')
        : gameId && !rom
          ? t('arcade:ArcadePlayer.romNeeded')
          : running
            ? paused
              ? t('arcade:ArcadePlayer.paused2')
              : t('arcade:ArcadePlayer.playing')
            : t('arcade:ArcadePlayer.readyToPlay')

  const canPlay =
    !!rom &&
    !running &&
    !busy &&
    !loadingFiles &&
    crossOriginIsolated &&
    (bootError === null || bootBytes !== save)
  const filesLocked = loadingFiles || fileBusy || busy

  const header = (statusText: string) => (
    <>
      <PageHeader
        page={t('ArcadePlayer.arcade')}
        gameId={gameId}
        onBack={() => leave()}
        // The Dropbox badge reaches storage settings through the same exit
        // protections as Back.
        onOpenSettings={() =>
          leave(routeHref('lab', { gameId, mode: 'settings', tab: 'storage' }))
        }
      />
      <p className="arcade-status" role="status">
        {statusText}
      </p>
    </>
  )

  // Direct entry without a valid `?game=` has nothing to play.
  if (!gameId) {
    return (
      <div className="camp-zone arcade-zone arcade-player">
        <main className="camp-root">
          <div className="camp-content arcade-cabinet">
            {header(t('ArcadePlayer.noGameChosen'))}
            <div className="arcade-messages">
              <p className="arcade-message">
                {t(
                  'ArcadePlayer.chooseRubySapphireEmeraldFireredOrLeafgreenInTheArcade'
                )}{' '}
                <button type="button" onClick={() => leave()}>
                  {t('ArcadePlayer.chooseAGame')}
                </button>
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const saveChip =
    sync.status === 'saving' ? (
      t('common:actions.saving')
    ) : sync.status === 'saved' ? (
      t('ArcadePlayer.saved')
    ) : sync.status === 'failed' ? (
      <button type="button" onClick={retrySave}>
        {t('ArcadePlayer.couldNotSaveTryAgain')}
      </button>
    ) : sync.status === 'conflict' ? (
      <button type="button" onClick={() => openMenu('advanced')}>
        {t('ArcadePlayer.couldNotSaveSeeMenu')}
      </button>
    ) : null

  return (
    <div className="camp-zone arcade-zone arcade-player">
      <main className="camp-root">
        <div className="camp-content arcade-cabinet" data-version={gameId}>
          {header(status)}

          <div className="arcade-messages">
            {!crossOriginIsolated && (
              <p className="arcade-message">
                {t(
                  'ArcadePlayer.thisBrowserCouldNotEnableTheIsolationTheEmulatorNeeds'
                )}
              </p>
            )}
            {notice && <p className="arcade-message">{notice}</p>}
            {!loadingFiles && !rom && (
              <p className="arcade-message">
                {t('ArcadePlayer.noRomInCamp', { game: gameName })}{' '}
                <button
                  type="button"
                  disabled={filesLocked}
                  onClick={() => romInputRef.current?.click()}
                >
                  {t('ArcadePlayer.insertRom')}
                </button>
              </p>
            )}
            {bootError && bootBytes === save && (
              <p className="arcade-message">{bootError}</p>
            )}
            {error && <p className="arcade-message">{error}</p>}
          </div>

          <div className="arcade-stage" data-skin="delta">
            <div className="arcade-screen-area">
              <div className="arcade-screen-column">
                <div className="arcade-bezel">
                  <div className="arcade-border-screen" ref={screenRef}>
                    <canvas
                      ref={canvasRef}
                      className="arcade-screen"
                      width="240"
                      height="160"
                    />
                    {(!running || paused) && (
                      <button
                        type="button"
                        className="arcade-power"
                        disabled={running ? false : !canPlay}
                        onClick={() => (running ? resume() : void start())}
                      >
                        {running
                          ? t('ArcadePlayer.resume')
                          : busy
                            ? t('ArcadePlayer.starting')
                            : bootBytes !== save
                              ? t('ArcadePlayer.continue')
                              : t('ArcadePlayer.play')}
                      </button>
                    )}
                  </div>
                  <div className="arcade-bezel-strip">
                    <p
                      className="arcade-save-chip"
                      role="status"
                      data-status={sync.status}
                    >
                      {flash ?? saveChip}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DeltaSkinController
              skin={skin}
              screenRef={screenRef}
              disabled={!running || paused}
              onButtonDown={(button, source) =>
                handleButton(button, true, source)
              }
              onButtonUp={(button, source) =>
                handleButton(button, false, source)
              }
              onAction={handleSkinAction}
            />
          </div>
        </div>

        <dialog
          ref={menuRef}
          className="arcade-menu"
          data-view={menuView}
          aria-labelledby={`arcade-menu-title-${menuView}`}
          onClose={menuClosed}
          // Escape is handled on keydown: Chrome stops honoring a prevented
          // `cancel` after a few in a row and closes the dialog anyway.
          onKeyDown={(event) => {
            // A key capture's keys are the window listener's.
            if (capturingRef.current) return
            if (event.code === bindingsRef.current.menu) {
              // The Menu key closes the menu it opened. Stop here: once
              // closed, the window listener would read it as "open".
              event.preventDefault()
              event.stopPropagation()
              menuRef.current?.close()
            } else if (event.key === 'Escape' && menuView !== 'main') {
              // On an inner page, Escape goes back to the first page.
              event.preventDefault()
              setMenuView('main')
            }
          }}
          onCancel={(event) => {
            // Escape that cancelled a key capture must not also close it.
            if (swallowedKeyRef.current === 'Escape') event.preventDefault()
          }}
        >
          <div ref={menuViewRef}>
            <ArcadeMenu
              menuView={menuView}
              setMenuView={setMenuView}
              running={running}
              sync={sync}
              close={() => menuRef.current?.close()}
              muted={muted}
              toggleMute={toggleMute}
              volume={volume}
              changeVolume={changeVolume}
              speed={speed}
              changeSpeed={changeSpeed}
              fullscreenAvailable={fullscreenSupported()}
              fullscreen={fullscreen}
              toggleFullscreen={toggleFullscreen}
              exitFromMenu={exitFromMenu}
              openGuide={guideFromMenu}
              bindings={bindings}
              capturing={capturing}
              captureKey={captureKey}
              confirmRestart={confirmRestart}
              changeConfirmRestart={changeConfirmRestart}
              restoreDefaultKeys={restoreDefaultKeys}
              canDownload={canDownload}
              downloadSave={downloadSave}
              filesLocked={filesLocked}
              chooseSave={() => saveInputRef.current?.click()}
              rom={rom}
              downloadRom={() => rom && download(rom, `${fileBase}.gba`)}
              chooseRom={() => romInputRef.current?.click()}
              skinLibrary={skinLibrary}
            />
          </div>
        </dialog>

        <PlayerDialogs
          exitRef={exitRef}
          restartRef={restartRef}
          decision={decision}
          running={running}
          exitClosed={exitClosed}
          restartClosed={restartClosed}
          retrySave={retrySave}
          downloadSave={downloadSave}
          navigateAway={navigateAway}
          restartNow={restartNow}
        />
      </main>

      <input
        ref={romInputRef}
        type="file"
        accept=".gba"
        hidden
        onChange={(event) => void importRom(event.target)}
      />
      {guideOpen && (
        <PokedexGuide
          gameId={gameId}
          onClose={() => {
            setGuideOpen(false)
            if (pausedByRef.current === 'guide') resume()
          }}
        />
      )}
      <input
        ref={saveInputRef}
        type="file"
        accept=".sav"
        hidden
        onChange={(event) => void importSave(event.target)}
      />
    </div>
  )
}
