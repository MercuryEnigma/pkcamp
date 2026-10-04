export interface BridgeStats {
  toAdapterFrames: number
  toAdapterBytes: number
  fromAdapterBytes: number
  reattached: number
  since: number
}

// Events: 'failed' (CustomEvent<Error>)
export class Bridge extends EventTarget {
  constructor(
    esp: unknown,
    adapter: unknown,
    options?: { bypassNationally?: boolean }
  )
  running: boolean
  stats: BridgeStats
  start(): Promise<void>
  stop(): Promise<void>
  setBypass(value: boolean): void
}
