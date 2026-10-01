export const REQUIRED_KEYS: readonly string[]

export function parseProdKeys(contents: string): {
  keys: Record<string, string>
  missing: string[]
  malformed: string[]
}
