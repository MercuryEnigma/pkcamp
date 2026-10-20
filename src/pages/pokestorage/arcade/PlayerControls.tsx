import { SPEEDS, type Speed } from './speeds'

export function SpeedPicker({
  labelId,
  speed,
  onChange,
}: {
  labelId: string
  speed: Speed
  onChange(speed: Speed): void
}) {
  return (
    <div className="arcade-speed" role="group" aria-labelledby={labelId}>
      {SPEEDS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={speed === option}
          onClick={() => onChange(option)}
        >
          ×{option}
        </button>
      ))}
    </div>
  )
}

/** A round cabinet button (Menu, Restart) with its name underneath. */
export function ToolbarButton({
  label,
  glyph,
  onClick,
  className,
  disabled,
  title,
  opensDialog,
}: {
  label: string
  glyph: string
  onClick: () => void
  className: string
  disabled?: boolean
  title?: string
  opensDialog?: boolean
}) {
  return (
    <button
      type="button"
      className={`arcade-round ${className}`}
      aria-label={label}
      aria-haspopup={opensDialog ? 'dialog' : undefined}
      title={title}
      disabled={disabled}
      // Called without the event, so handlers with options keep defaults.
      onClick={() => onClick()}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="arcade-round-caption" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}
