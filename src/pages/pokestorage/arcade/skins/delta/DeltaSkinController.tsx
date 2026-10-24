import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { GbaButton } from '../../../../../services/emulator/input'
import type { ControllerSkin, SkinAction } from './controllerSkin'
import {
  fitSkin,
  inputsAt,
  toPixels,
  type HeldInputs,
  type SkinTransform,
} from './skinGeometry'
import './deltaSkin.css'

interface DeltaSkinControllerProps {
  skin: ControllerSkin
  /**
   * The element holding the emulator canvas. It is moved and sized to the
   * skin's screen; it stays where React mounted it, so the game keeps running.
   * Its offset parent must share this component's top-left corner.
   */
  screenRef: RefObject<HTMLElement | null>
  /** True while no game is playing: buttons are ignored and released. */
  disabled: boolean
  onButtonDown(button: GbaButton, source: string): void
  onButtonUp(button: GbaButton, source: string): void
  /** Menu and speed controls work with or without a game running. */
  onAction(action: SkinAction, pressed: boolean): void
}

/**
 * Actions that last while touched. The rest are taps, run from the skin's own
 * click so the click that follows a touch cannot land on a menu they open.
 */
const HELD_ACTIONS: ReadonlySet<SkinAction> = new Set(['fastForward'])

const NOTHING: HeldInputs = { buttons: [], actions: [] }

const SCREEN_STYLE = ['position', 'left', 'top', 'width', 'height'] as const

/**
 * Draws a controller skin to fill its positioned parent and puts the screen
 * and the touch regions where the skin says. Layout only: it knows nothing
 * of the emulator beyond the button callbacks.
 */
export function DeltaSkinController({
  skin,
  screenRef,
  disabled,
  onButtonDown,
  onButtonUp,
  onAction,
}: DeltaSkinControllerProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<SkinTransform | null>(null)
  const artRef = useRef<HTMLImageElement>(null)
  /** Buttons held by each pointer, so moving off one releases it. */
  const held = useRef(new Map<number, HeldInputs>())
  const callbacks = useRef({ onButtonDown, onButtonUp, onAction })
  useEffect(() => {
    callbacks.current = { onButtonDown, onButtonUp, onAction }
  })

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const measure = () =>
      setTransform(fitSkin(skin, area.clientWidth, area.clientHeight))
    const observer = new ResizeObserver(measure)
    observer.observe(area)
    measure()
    return () => observer.disconnect()
  }, [skin])

  const ready = transform !== null && transform.scale > 0
  useEffect(() => {
    const art = artRef.current
    if (!art) return
    const url = URL.createObjectURL(skin.background)
    art.src = url
    return () => URL.revokeObjectURL(url)
  }, [skin.background, ready])

  useLayoutEffect(() => {
    const screen = screenRef.current
    if (!screen || !transform) return
    const frame = toPixels(transform, skin.screen)
    screen.style.position = 'absolute'
    screen.style.left = `${frame.x}px`
    screen.style.top = `${frame.y}px`
    screen.style.width = `${frame.width}px`
    screen.style.height = `${frame.height}px`
  }, [screenRef, skin, transform])
  useLayoutEffect(() => {
    const screen = screenRef.current
    return () => {
      for (const property of SCREEN_STYLE)
        screen?.style.removeProperty(property)
    }
  }, [screenRef])

  const setPointer = (pointerId: number, next: HeldInputs) => {
    const previous = held.current.get(pointerId) ?? NOTHING
    for (const button of previous.buttons) {
      if (!next.buttons.includes(button)) {
        callbacks.current.onButtonUp(button, `skin:${pointerId}:${button}`)
      }
    }
    for (const button of next.buttons) {
      if (!previous.buttons.includes(button)) {
        callbacks.current.onButtonDown(button, `skin:${pointerId}:${button}`)
      }
    }
    for (const action of previous.actions) {
      if (HELD_ACTIONS.has(action) && !next.actions.includes(action)) {
        callbacks.current.onAction(action, false)
      }
    }
    for (const action of next.actions) {
      if (HELD_ACTIONS.has(action) && !previous.actions.includes(action)) {
        callbacks.current.onAction(action, true)
      }
    }
    held.current.set(pointerId, next)
  }

  const touchedAt = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    // Same mapping as the drawing, read back from the live bounding box.
    return inputsAt(
      skin,
      ((clientX - rect.left) / rect.width) * skin.nativeWidth,
      ((clientY - rect.top) / rect.height) * skin.nativeHeight
    )
  }

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!held.current.has(event.pointerId)) return
    const touched = touchedAt(event.clientX, event.clientY)
    if (!touched) return
    setPointer(event.pointerId, {
      buttons: disabled ? [] : touched.buttons,
      actions: touched.actions,
    })
  }
  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    setPointer(event.pointerId, NOTHING)
    held.current.delete(event.pointerId)
  }

  // A pointer that never reaches us again must not leave a button stuck.
  useEffect(() => {
    if (!disabled) return
    for (const [pointerId, inputs] of [...held.current]) {
      setPointer(pointerId, { buttons: [], actions: inputs.actions })
    }
  }, [disabled])
  useEffect(
    () => () => {
      for (const pointerId of [...held.current.keys()]) {
        setPointer(pointerId, NOTHING)
        held.current.delete(pointerId)
      }
    },
    []
  )

  const handlers = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      held.current.set(event.pointerId, NOTHING)
      track(event)
    },
    onPointerMove: track,
    onClick: (event: ReactMouseEvent<HTMLDivElement>) => {
      // Keyboards have their own shortcuts; this is for pointers.
      if (event.detail === 0) return
      const touched = touchedAt(event.clientX, event.clientY)
      for (const action of touched?.actions ?? []) {
        if (!HELD_ACTIONS.has(action)) callbacks.current.onAction(action, true)
      }
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) =>
      event.preventDefault(),
  }

  const box = transform && transform.scale > 0 ? transform : null
  const art = skin.artFrame
  const fraction = (value: number, whole: number) => `${(value / whole) * 100}%`
  return (
    <div
      ref={areaRef}
      className="delta-skin"
      role="group"
      aria-label="GBA controls"
    >
      {box && (
        <div
          ref={boxRef}
          className="delta-skin-box"
          data-overlay={skin.overlay ? '' : undefined}
          style={{
            left: box.offsetX,
            top: box.offsetY,
            width: box.width,
            height: box.height,
          }}
        >
          {skin.overlay && <div className="delta-skin-backdrop" />}
          <img
            ref={artRef}
            className="delta-skin-art"
            alt=""
            draggable={false}
            style={{
              left: fraction(art.x, skin.nativeWidth),
              top: fraction(art.y, skin.nativeHeight),
              width: fraction(art.width, skin.nativeWidth),
              height: fraction(art.height, skin.nativeHeight),
              opacity: skin.overlay && skin.translucent ? 0.7 : undefined,
            }}
          />
          {/* Only the buttons take touches, so the screen's own controls stay reachable. */}
          {skin.buttons.map((button) => {
            const area = toPixels(
              { ...box, offsetX: 0, offsetY: 0 },
              button.hitArea
            )
            return (
              <div
                key={button.id}
                className="delta-skin-hit"
                data-debug={skin.debug ? '' : undefined}
                style={{
                  left: area.x,
                  top: area.y,
                  width: area.width,
                  height: area.height,
                }}
                {...handlers}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
