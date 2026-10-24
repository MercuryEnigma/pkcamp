import type { ReactNode } from 'react'
import type { Gen3GameId } from '../../services/saveLibrary'
import { useAppNavigation } from '../context/appNavigation'
import { routeHref } from '../routing'
import { PageHeader } from './PageHeader'
import './siteComponents.css'

/**
 * The shared page frame: one board that fills the viewport, with the shared
 * header on top and a body that takes the remaining height. Pages lay out
 * their body in percentages of it and scroll long content inside panels, so
 * the page itself never scrolls.
 */
export function SitePage({
  page,
  gameId,
  onBack,
  className,
  bodyClassName,
  children,
}: {
  page: string
  gameId: Gen3GameId | null
  onBack: () => void
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const { navigate } = useAppNavigation()
  return (
    <main className={`camp-root hub-root site-page ${className ?? ''}`}>
      <section className="site-board">
        <PageHeader
          page={page}
          gameId={gameId}
          onBack={onBack}
          // The badge has already confirmed leaving.
          onOpenSettings={() =>
            navigate(
              routeHref('lab', { gameId, mode: 'settings', tab: 'storage' }),
              { guard: false }
            )
          }
        />
        <div className={`site-body ${bodyClassName ?? ''}`}>{children}</div>
      </section>
    </main>
  )
}
