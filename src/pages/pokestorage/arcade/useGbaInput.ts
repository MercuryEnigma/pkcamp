import { useEffect, useRef, useState, type RefObject } from 'react'
import type { GbaInputTracker } from '../../../services/emulator/input'
import {
  DEFAULT_KEY_BINDINGS,
  actionForCode,
  assignKey,
  buttonForCode,
  canBind,
  loadKeyBindings,
  saveKeyBindings,
  type ArcadeAction,
  type Bindable,
  type KeyBindings,
} from './keyBindings'

/**
 * Keys typed here operate the page, not the game. A focused button outside
 * an open dialog still plays, so clicking Back or Menu never strands input.
 */
const NON_GAME_TARGETS =
  'input, select, textarea, [contenteditable], dialog[open]'

function isGameKeyTarget(target: EventTarget | null): boolean {
  return !(target instanceof Element && target.closest(NON_GAME_TARGETS))
}

export function useGbaInput(
  inputRef: RefObject<GbaInputTracker | null>,
  pausedRef: RefObject<boolean>,
  shortcutRef: RefObject<(action: ArcadeAction) => void>
) {
  const [bindings, setBindings] = useState<KeyBindings>(loadKeyBindings)
  const bindingsRef = useRef(bindings)
  useEffect(() => {
    bindingsRef.current = bindings
  }, [bindings])
  /** The button waiting for its new key in the menu, if any. */
  const [capturing, setCapturing] = useState<Bindable | null>(null)
  const capturingRef = useRef<Bindable | null>(null)
  /** A key consumed by capture, whose keyup must not activate anything. */
  const swallowedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      const target = capturingRef.current
      if (target) {
        // Rebinding: the next key belongs to the menu, Escape cancels.
        event.preventDefault()
        swallowedKeyRef.current = event.code
        capturingRef.current = null
        setCapturing(null)
        if (event.code !== 'Escape' && canBind(event.code)) {
          setBindings((current) => {
            const next = assignKey(current, target, event.code)
            saveKeyBindings(next)
            return next
          })
        }
        return
      }
      const action = actionForCode(bindingsRef.current, event.code)
      if (action) {
        // Shortcuts work with or without a game, even when it is paused.
        if (event.repeat || !isGameKeyTarget(event.target)) return
        event.preventDefault()
        shortcutRef.current(action)
        return
      }
      const button = buttonForCode(bindingsRef.current, event.code)
      if (!button || event.repeat || pausedRef.current) return
      // With no game running, Enter and arrows keep their page behavior.
      if (!inputRef.current || !isGameKeyTarget(event.target)) return
      event.preventDefault()
      inputRef.current?.setSource(`key:${event.code}`, [button])
    }
    const release = (event: KeyboardEvent) => {
      if (swallowedKeyRef.current === event.code) {
        swallowedKeyRef.current = null
        event.preventDefault()
        return
      }
      // Release by key, even if it was rebound or focus moved while held.
      inputRef.current?.releaseSource(`key:${event.code}`)
      if (
        buttonForCode(bindingsRef.current, event.code) &&
        isGameKeyTarget(event.target)
      ) {
        event.preventDefault()
      }
    }
    const releaseAll = () => inputRef.current?.releaseAll()

    window.addEventListener('keydown', press)
    window.addEventListener('keyup', release)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', press)
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', releaseAll)
    }
  }, [inputRef, pausedRef, shortcutRef])
  const captureKey = (button: Bindable) => {
    capturingRef.current = button
    setCapturing(button)
  }
  const cancelCapture = () => {
    capturingRef.current = null
    setCapturing(null)
  }
  const restoreDefaultKeys = () => {
    setBindings(DEFAULT_KEY_BINDINGS)
    saveKeyBindings(DEFAULT_KEY_BINDINGS)
  }
  return {
    bindings,
    bindingsRef,
    capturing,
    capturingRef,
    swallowedKeyRef,
    captureKey,
    restoreDefaultKeys,
    cancelCapture,
  }
}
