import { i18n } from '../../../services/i18n'
import type { GbaButton } from '../../../services/emulator/input'

/** Player shortcuts: open the menu, mute, cycle speed, guide, restart. */
export type ArcadeAction = 'menu' | 'mute' | 'speed' | 'guide' | 'restart'

/** Anything a key can be bound to. */
export type Bindable = GbaButton | ArcadeAction

/** One keyboard key (`KeyboardEvent.code`) per button or shortcut, or null. */
export type KeyBindings = Readonly<Record<Bindable, string | null>>

export const GBA_BUTTONS: readonly GbaButton[] = [
  'up',
  'down',
  'left',
  'right',
  'a',
  'b',
  'l',
  'r',
  'start',
  'select',
]

export const ARCADE_ACTIONS: readonly ArcadeAction[] = [
  'menu',
  'mute',
  'speed',
  'guide',
  'restart',
]

/** Everything bindable, in the order the Button layout page lists it. */
export const BINDING_ORDER: readonly Bindable[] = [
  'up',
  'down',
  'left',
  'right',
  'a',
  'b',
  'start',
  'select',
  'l',
  'r',
  ...ARCADE_ACTIONS,
]

const BINDABLE = BINDING_ORDER

export const getBindingName = (): Readonly<Record<Bindable, string>> => ({
  up: i18n.t('arcade:keyBindings.up'),
  down: i18n.t('arcade:keyBindings.down'),
  left: i18n.t('arcade:keyBindings.left'),
  right: i18n.t('arcade:keyBindings.right'),
  a: 'A',
  b: 'B',
  l: 'L',
  r: 'R',
  start: i18n.t('common:actions.start'),
  select: i18n.t('arcade:keyBindings.select'),
  menu: i18n.t('arcade:keyBindings.menu'),
  mute: i18n.t('arcade:keyBindings.muteSound'),
  speed: i18n.t('arcade:keyBindings.speedToggle'),
  guide: i18n.t('arcade:keyBindings.guide'),
  restart: i18n.t('arcade:keyBindings.restart'),
})

/** The Controls page's sections, like a game's key-binding settings. */
export const getBindingGroups = (): readonly {
  id: string
  title: string
  items: readonly Bindable[]
}[] => [
  {
    id: 'dpad',
    title: i18n.t('arcade:keyBindings.dPad'),
    items: ['up', 'down', 'left', 'right'],
  },
  {
    id: 'buttons',
    title: i18n.t('arcade:keyBindings.buttons'),
    items: ['a', 'b', 'start', 'select', 'l', 'r'],
  },
  {
    id: 'shortcuts',
    title: i18n.t('arcade:keyBindings.shortcuts'),
    items: ['menu', 'mute', 'speed', 'guide', 'restart'],
  },
]

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  a: 'KeyA',
  b: 'KeyS',
  l: 'KeyQ',
  r: 'KeyW',
  start: 'Enter',
  select: 'ShiftRight',
  menu: 'KeyX',
  mute: 'KeyZ',
  speed: 'KeyD',
  guide: 'KeyE',
  restart: 'KeyP',
}

// v2: the defaults changed before release, so earlier test bindings reset.
const STORAGE_KEY = 'pkcamp:arcade:key-bindings:v2'
const CONFIRM_RESTART_KEY = 'pkcamp:arcade:confirm-restart'

/** Keys that keep their page meaning and can never be bound. */
const RESERVED = new Set(['Escape', 'Tab'])

export function canBind(code: string): boolean {
  return code !== '' && !RESERVED.has(code)
}

/**
 * Binds `code` to `button`. A key belongs to one button or shortcut at a
 * time, so whatever already had it is left unbound for the player to
 * reassign.
 */
export function assignKey(
  bindings: KeyBindings,
  button: Bindable,
  code: string
): KeyBindings {
  if (!canBind(code)) return bindings
  const next = { ...bindings }
  for (const other of BINDABLE) {
    if (other !== button && next[other] === code) next[other] = null
  }
  next[button] = code
  return next
}

/** The GBA button bound to a key, if any. */
export function buttonForCode(
  bindings: KeyBindings,
  code: string
): GbaButton | null {
  return GBA_BUTTONS.find((button) => bindings[button] === code) ?? null
}

/** The shortcut bound to a key, if any. */
export function actionForCode(
  bindings: KeyBindings,
  code: string
): ArcadeAction | null {
  return ARCADE_ACTIONS.find((action) => bindings[action] === code) ?? null
}

/** Readable name for a `KeyboardEvent.code`, e.g. `KeyX` → `X`. */
export function keyLabel(code: string | null): string {
  if (!code) return i18n.t('common:actions.none')
  const named: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: i18n.t('arcade:keyBindings.leftShift'),
    ShiftRight: i18n.t('arcade:keyBindings.rightShift'),
    ControlLeft: i18n.t('arcade:keyBindings.leftCtrl'),
    ControlRight: i18n.t('arcade:keyBindings.rightCtrl'),
    AltLeft: i18n.t('arcade:keyBindings.leftAlt'),
    AltRight: i18n.t('arcade:keyBindings.rightAlt'),
    MetaLeft: i18n.t('arcade:keyBindings.left2'),
    MetaRight: i18n.t('arcade:keyBindings.right2'),
    Space: i18n.t('arcade:keyBindings.space'),
    Enter: i18n.t('arcade:keyBindings.enter'),
    Backspace: i18n.t('arcade:keyBindings.backspace'),
  }
  if (named[code]) return named[code]
  const match = /^(?:Key|Digit)(.)$/.exec(code)
  if (match) return match[1]
  if (code.startsWith('Numpad'))
    return i18n.t('arcade:keyBindings.num', { value1: code.slice(6) })
  return code
}

/**
 * Validates stored bindings; anything unusable falls back to defaults. An
 * entry missing entirely (saved before that shortcut existed) gets its
 * default key unless a stored binding already uses it.
 */
export function parseKeyBindings(raw: string | null): KeyBindings {
  if (!raw) return DEFAULT_KEY_BINDINGS
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return DEFAULT_KEY_BINDINGS
    const stored = value as Record<string, unknown>
    let bindings: KeyBindings = Object.fromEntries(
      BINDABLE.map((button) => [button, null])
    ) as KeyBindings
    for (const button of BINDABLE) {
      const code = stored[button]
      if (typeof code === 'string') bindings = assignKey(bindings, button, code)
    }
    for (const button of BINDABLE) {
      const code = DEFAULT_KEY_BINDINGS[button]
      const taken = BINDABLE.some((other) => bindings[other] === code)
      if (!(button in stored) && code && !taken) {
        bindings = { ...bindings, [button]: code }
      }
    }
    return bindings
  } catch {
    return DEFAULT_KEY_BINDINGS
  }
}

/** Per-device preference; storage may be unavailable (private browsing). */
export function loadKeyBindings(): KeyBindings {
  try {
    return parseKeyBindings(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_KEY_BINDINGS
  }
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
  } catch {
    // Bindings still apply for this visit.
  }
}

/** Whether Restart asks first; yes unless the player turned it off. */
export function loadConfirmRestart(): boolean {
  try {
    return localStorage.getItem(CONFIRM_RESTART_KEY) !== 'false'
  } catch {
    return true
  }
}

export function saveConfirmRestart(confirm: boolean): void {
  try {
    localStorage.setItem(CONFIRM_RESTART_KEY, String(confirm))
  } catch {
    // The choice still applies for this visit.
  }
}
