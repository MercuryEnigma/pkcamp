import type { ReactNode } from 'react'

/** A bordered surface that scrolls its own content, never the page. */
export function Panel({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`site-panel ${className}`} aria-label={label}>
      {children}
    </section>
  )
}
