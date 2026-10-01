export class EspDevice {
  static available(): boolean
  static requestPort(): Promise<unknown>
}
