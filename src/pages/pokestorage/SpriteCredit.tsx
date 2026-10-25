import { useTranslation } from 'react-i18next'
import type { SpriteDisplay } from './spriteDisplay'

export function SpriteCredit({ display }: { display: SpriteDisplay }) {
  const { t } = useTranslation(['camp', 'common'] as const)

  const credit = display.attribution
  if (!credit) return null
  return (
    <a
      className="camp-sprite-credit"
      href={credit.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('SpriteCredit.imageCreditOpensSourceInANewTab', {
        name: credit.name,
      })}
    >
      {credit.name}
    </a>
  )
}
