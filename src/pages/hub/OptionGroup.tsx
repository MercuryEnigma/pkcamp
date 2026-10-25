/**
 * A set of buttons where one is chosen: a toggle between two options (`row`),
 * a vertical list that becomes a scrolling row on phones (`rail`), or a grid
 * of choices (`grid`).
 */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  layout = 'row',
  disabled,
  mobileSelect = false,
}: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  layout?: 'row' | 'rail' | 'grid'
  disabled?: boolean
  mobileSelect?: boolean
}) {
  return (
    <div
      className={`option-group option-group--${layout}`}
      role="group"
      aria-label={label}
    >
      {mobileSelect && (
        <label className="option-group-mobile-select">
          <span>{label}</span>
          <select
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as T)}
          >
            {options.map(([option, text]) => (
              <option key={option} value={option}>{text}</option>
            ))}
          </select>
        </label>
      )}
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          className="option"
          aria-pressed={value === option}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
