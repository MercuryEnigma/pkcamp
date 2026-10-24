export type StorageTool = 'view' | 'moveOne' | 'groupMove'

const TOOLS: readonly { id: StorageTool; label: string; icon: string }[] = [
  {
    id: 'view',
    label: 'View',
    icon: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  },
  { id: 'moveOne', label: 'Move one', icon: 'M6 6h12v12H6z' },
  {
    id: 'groupMove',
    label: 'Move a group',
    icon: 'M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z',
  },
]

/** Exactly one storage tool is active, and it applies to both grids. */
export function ToolSelector({
  value,
  onChange,
  disabled,
}: {
  value: StorageTool
  onChange: (tool: StorageTool) => void
  /** Tools that cannot be used right now, e.g. while the party is open. */
  disabled?: readonly StorageTool[]
}) {
  return (
    <div className="tool-selector" role="group" aria-label="Storage tool">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          aria-label={tool.label}
          title={tool.label}
          aria-pressed={value === tool.id}
          disabled={disabled?.includes(tool.id)}
          onClick={() => onChange(tool.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={tool.icon} fillRule="evenodd" />
          </svg>
        </button>
      ))}
    </div>
  )
}
