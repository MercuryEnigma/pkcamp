/** A large pressable tile, used by the Hub, Lab and Research Tools menus. */
export function SiteCard({
  title,
  description,
  onClick,
  disabled,
  className = '',
}: {
  title: string
  description: string
  onClick?: () => void
  disabled?: boolean
  /** Names the card's grid area or flex share in its page. */
  className?: string
}) {
  return (
    <button
      type="button"
      className={`site-card ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  )
}
