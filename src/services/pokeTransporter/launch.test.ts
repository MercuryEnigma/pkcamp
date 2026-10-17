import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { verifyTransporter } from './launch'

it('verifies the pinned release and refuses modified bytes', async () => {
  const rom = new Uint8Array(
    readFileSync(
      new URL('./vendor/Poke_Transporter_GB_v1.2.1.gba', import.meta.url)
    )
  )
  await expect(verifyTransporter(rom)).resolves.toBeUndefined()
  rom[200] ^= 1
  await expect(verifyTransporter(rom)).rejects.toThrow('verification failed')
  await expect(verifyTransporter(rom.slice(1))).rejects.toThrow(
    'unexpected size'
  )
})
