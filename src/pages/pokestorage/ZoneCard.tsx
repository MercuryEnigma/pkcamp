/**
 * A single selectable tile used across the Camp Zone sub-flow (activities,
 * generation picker, game picker). One consistent shape everywhere — a bold
 * label and an optional detail line — so every one of these screens reads
 * as the same campground "menu" rather than three different UI patterns.
 * `comingSoon` renders it disabled with a badge rather than omitting it, so
 * the full roster stays visible. `primary` makes it the one featured, full-
 * width option on a screen (e.g. "Organize" on the activities menu) so the
 * most important choice doesn't have to compete visually with the rest.
 */
export function ZoneCard({
  label,
  sublabel,
  comingSoon = false,
  onClick,
  title,
  primary = false,
}: {
  label: string
  sublabel?: string
  comingSoon?: boolean
  onClick?: () => void
  title?: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      className={`camp-card${primary ? ' camp-card--primary' : ''}${comingSoon ? ' camp-card--soon' : ''}`}
      onClick={onClick}
      disabled={comingSoon}
      aria-disabled={comingSoon}
      title={title}
    >
      <span className="camp-card-label">{label}</span>
      {sublabel && !comingSoon && <span className="camp-card-sub">{sublabel}</span>}
      {comingSoon && <span className="camp-badge-soon">Coming soon</span>}
    </button>
  )
}
