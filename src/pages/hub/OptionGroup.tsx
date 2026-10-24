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
}: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  layout?: 'row' | 'rail' | 'grid'
  disabled?: boolean
}) {
  return (
    <div
      className={`option-group option-group--${layout}`}
      role="group"
      aria-label={label}
    >
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
