import { useEffect, useRef, type ReactNode } from 'react'

/** A bordered surface that scrolls its own content, never the page. */
export function Panel({
  label,
  className = '',
  resetScrollOn,
  children,
}: {
  label: string
  className?: string
  /** Reset a preserved panel's scroll position when its view changes. */
  resetScrollOn?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 })
  }, [resetScrollOn])
  return (
    <section ref={panel} className={`site-panel ${className}`} aria-label={label}>
      {children}
    </section>
  )
}
