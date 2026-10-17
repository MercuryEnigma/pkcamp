import type { SpriteDisplay } from './spriteDisplay'

export function SpriteCredit({ display }: { display: SpriteDisplay }) {
  const credit = display.attribution
  if (!credit) return null
  return (
    <a
      className="camp-sprite-credit"
      href={credit.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Image credit: ${credit.name} (opens source in a new tab)`}
    >
      {credit.name}
    </a>
  )
}
