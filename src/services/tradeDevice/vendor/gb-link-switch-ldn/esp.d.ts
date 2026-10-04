export class EspDevice extends EventTarget {
  static available(): boolean
  static requestPort(): Promise<unknown>
  attached: boolean
  onAdapterFrame: ((bytes: Uint8Array) => void) | null
  sendAdapter(bytes: Uint8Array): void
  setAdapterPort(where: 'host' | 'uart'): Promise<boolean>
}
