export interface PicobootSession {
  device: { opened?: boolean; close(): Promise<void> }
  connect(): Promise<{ reboot(delayMs: number): Promise<void> }>
  disconnect(): Promise<void>
  flashEraseAndWrite(address: number, data: Uint8Array): Promise<void>
  flashRead(address: number, size: number): Promise<Uint8Array>
}
export const Picoboot: { fromDevice(device: unknown): PicobootSession }
