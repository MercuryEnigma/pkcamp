export interface CopyViolation {
  file: string
  line: number
  column: number
  text: string
}
export function findHardcodedCopy(
  source: string,
  filename?: string
): CopyViolation[]
export function checkFiles(root?: string): CopyViolation[]
