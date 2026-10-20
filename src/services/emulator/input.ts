export type GbaButton =
  'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'l' | 'r' | 'start' | 'select'

export type GbaInputChange = (button: GbaButton, pressed: boolean) => void

/**
 * Combines keyboard and multiple pointer sources without releasing a button
 * until every source holding it has released it.
 */
export class GbaInputTracker {
  private readonly sources = new Map<string, ReadonlySet<GbaButton>>()
  private readonly counts = new Map<GbaButton, number>()
  private readonly onChange: GbaInputChange

  constructor(onChange: GbaInputChange) {
    this.onChange = onChange
  }

  setSource(source: string, buttons: Iterable<GbaButton>): void {
    const previous = this.sources.get(source) ?? new Set<GbaButton>()
    const next = new Set(buttons)

    for (const button of previous) {
      if (!next.has(button)) this.remove(button)
    }
    for (const button of next) {
      if (!previous.has(button)) this.add(button)
    }

    if (next.size === 0) this.sources.delete(source)
    else this.sources.set(source, next)
  }

  releaseSource(source: string): void {
    this.setSource(source, [])
  }

  releaseAll(): void {
    for (const button of this.counts.keys()) this.onChange(button, false)
    this.sources.clear()
    this.counts.clear()
  }

  isPressed(button: GbaButton): boolean {
    return (this.counts.get(button) ?? 0) > 0
  }

  private add(button: GbaButton): void {
    const count = this.counts.get(button) ?? 0
    this.counts.set(button, count + 1)
    if (count === 0) this.onChange(button, true)
  }

  private remove(button: GbaButton): void {
    const count = this.counts.get(button) ?? 0
    if (count <= 1) {
      this.counts.delete(button)
      if (count === 1) this.onChange(button, false)
      return
    }
    this.counts.set(button, count - 1)
  }
}
