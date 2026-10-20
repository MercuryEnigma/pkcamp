import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { GbaButton } from '../../../services/emulator/input'
import { dpadDirections } from './dpad'

type ButtonHandler = (
  button: GbaButton,
  pressed: boolean,
  source: string
) => void

const NAME: Readonly<Record<GbaButton, string>> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  a: 'A',
  b: 'B',
  l: 'L',
  r: 'R',
  start: 'Start',
  select: 'Select',
}

/** A keyboard or screen-reader activation taps the button briefly. */
function tapOnKeyboardClick(
  event: ReactMouseEvent<HTMLButtonElement>,
  button: GbaButton,
  onButton: ButtonHandler
) {
  if (event.detail !== 0) return // pointer clicks are handled by pointer events
  const source = `click:${button}`
  onButton(button, true, source)
  setTimeout(() => onButton(button, false, source), 120)
}

function PadButton({
  button,
  className,
  label,
  disabled,
  onButton,
}: {
  button: GbaButton
  className: string
  label: string
  disabled: boolean
  onButton: ButtonHandler
}) {
  // `:active` is unreliable for captured touches, so pressing is marked here.
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    delete event.currentTarget.dataset.pressed
    onButton(button, false, `pointer:${event.pointerId}`)
  }
  return (
    <button
      type="button"
      className={`arcade-controller-button ${className}`}
      aria-label={NAME[button]}
      disabled={disabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.dataset.pressed = ''
        onButton(button, true, `pointer:${event.pointerId}`)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onClick={(event) => tapOnKeyboardClick(event, button, onButton)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span aria-hidden="true">{label}</span>
    </button>
  )
}

/**
 * The on-screen GBA controller. The D-pad is one 8-way touch surface, so a
 * thumb can roll into diagonals; every other button tracks its own pointers.
 * Each pointer is its own input source, so simultaneous touches combine.
 */
export function GbaController({
  disabled,
  onButton,
  center,
}: {
  disabled: boolean
  onButton: ButtonHandler
  /** Shown between L and R, e.g. the player's Menu button. */
  center?: ReactNode
}) {
  const pad = (button: GbaButton, className: string, label: string) => (
    <PadButton
      button={button}
      className={className}
      label={label}
      disabled={disabled}
      onButton={onButton}
    />
  )
  const dpadRef = useRef<HTMLDivElement>(null)
  /** Directions held by each pointer captured on the D-pad, until it lifts. */
  const held = useRef(new Map<number, readonly GbaButton[]>())

  /** Marks held directions for styling; the pad surface owns the pointer. */
  const showHeld = () => {
    const directions = new Set([...held.current.values()].flat())
    if (dpadRef.current)
      dpadRef.current.dataset.held = [...directions].join(' ')
  }

  // The parent releases every input when play stops; forget the pad state too.
  useEffect(() => {
    if (!disabled) return
    held.current.clear()
    showHeld()
  }, [disabled])

  const setDpad = (pointerId: number, next: readonly GbaButton[]) => {
    const previous = held.current.get(pointerId) ?? []
    for (const button of previous) {
      if (!next.includes(button)) {
        onButton(button, false, `dpad:${pointerId}:${button}`)
      }
    }
    for (const button of next) {
      if (!previous.includes(button)) {
        onButton(button, true, `dpad:${pointerId}:${button}`)
      }
    }
    held.current.set(pointerId, next)
    showHeld()
  }

  const trackDpad = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !held.current.has(event.pointerId)) return
    const rect = event.currentTarget.getBoundingClientRect()
    setDpad(
      event.pointerId,
      dpadDirections(
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2),
        rect.width / 2
      )
    )
  }
  const releaseDpad = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!held.current.has(event.pointerId)) return
    setDpad(event.pointerId, [])
    held.current.delete(event.pointerId)
    showHeld()
  }

  return (
    <div className="arcade-controller" role="group" aria-label="GBA controls">
      {pad(
        'l',
        'arcade-controller-shoulder arcade-controller-shoulder--l',
        'L'
      )}
      {pad(
        'r',
        'arcade-controller-shoulder arcade-controller-shoulder--r',
        'R'
      )}

      <div
        ref={dpadRef}
        className="arcade-controller-dpad"
        role="group"
        aria-label="D-pad"
        aria-disabled={disabled}
        onPointerDown={(event) => {
          if (disabled) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          held.current.set(event.pointerId, [])
          trackDpad(event)
        }}
        onPointerMove={trackDpad}
        onPointerUp={releaseDpad}
        onPointerCancel={releaseDpad}
        onLostPointerCapture={releaseDpad}
        onContextMenu={(event) => event.preventDefault()}
      >
        {(['up', 'left', 'right', 'down'] as const).map((button) => (
          <button
            key={button}
            type="button"
            className={`arcade-controller-dpad-arm arcade-controller-dpad-arm--${button}`}
            aria-label={NAME[button]}
            disabled={disabled}
            // Pointer input belongs to the pad surface; these stay for keyboards.
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => tapOnKeyboardClick(event, button, onButton)}
          />
        ))}
        <span className="arcade-controller-dpad-hub" aria-hidden="true" />
      </div>

      <div className="arcade-controller-face" role="group" aria-label="A and B">
        {pad('b', 'arcade-controller-round arcade-controller-round--b', 'B')}
        {pad('a', 'arcade-controller-round arcade-controller-round--a', 'A')}
      </div>

      {center && <div className="arcade-controller-center">{center}</div>}

      <div
        className="arcade-controller-system"
        role="group"
        aria-label="Select and Start"
      >
        {pad('select', 'arcade-controller-pill', 'SELECT')}
        {pad('start', 'arcade-controller-pill', 'START')}
      </div>
    </div>
  )
}
