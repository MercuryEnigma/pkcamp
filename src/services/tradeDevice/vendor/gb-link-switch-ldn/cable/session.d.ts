// Events: 'log' (CustomEvent<string>), 'change' (Event), 'failed' (CustomEvent<Error>)
export class CableSession extends EventTarget {
  constructor(
    esp: unknown,
    adapter: unknown,
    options?: { bypassNationally?: boolean }
  )
  running: boolean
  readonly cableOpen: boolean
  readonly linked: boolean
  readonly tradeReady: boolean
  readonly switchNotReady: boolean
  start(): Promise<void>
  stop(): Promise<void>
  setBypass(value: boolean): void
}
