import { useId, useState } from 'react'

const MAX_SHOWN = 100

/**
 * A text field that suggests values as the player types. The text itself is
 * the filter, so a value that is not in the list is still allowed.
 */
export function PcCombobox({
  label,
  placeholder,
  value,
  options,
  onChange,
  openUp = false,
}: {
  label: string
  placeholder: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  /** Opens the list above the field, for fields near the bottom of a screen. */
  openUp?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const needle = value.trim().toLowerCase()
  const shown = options
    .filter((option) => option.toLowerCase().includes(needle))
    .slice(0, MAX_SHOWN)
  const expanded = open && shown.length > 0

  const choose = (option: string) => {
    onChange(option)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="pc-combo" data-open-up={openUp}>
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive((current) =>
              shown.length === 0
                ? -1
                : (current + step + shown.length) % shown.length
            )
          } else if (event.key === 'Enter' && expanded && active >= 0) {
            event.preventDefault()
            choose(shown[active])
          } else if (event.key === 'Escape' && expanded) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {expanded && (
        <ul id={`${id}-list`} className="pc-combo-list" role="listbox">
          {shown.map((option, index) => (
            <li
              key={option}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              // Keeps focus in the field so the list is not closed by blur.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
