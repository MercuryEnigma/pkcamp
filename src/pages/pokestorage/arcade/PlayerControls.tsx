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
