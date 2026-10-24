export type StorageTool = 'view' | 'moveOne' | 'groupMove'

const TOOLS: readonly { id: StorageTool; label: string; icon?: string }[] = [
  {
    id: 'view',
    label: 'View',
  },
  {
    id: 'moveOne',
    label: 'Move one',
    icon: 'M3 8h17m0 0-4-4m4 4-4 4M21 16H4m0 0 4-4m-4 4 4 4',
  },
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
          <svg
            className={tool.id === 'view' ? 'tool-icon-view' : undefined}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            {tool.id === 'view' ? (
              <>
                <circle
                  className="tool-icon-view-shell"
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="var(--camp-text)"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 12h18"
                  stroke="var(--camp-text)"
                  strokeWidth="1.8"
                />
                <circle
                  className="tool-icon-view-center"
                  cx="12"
                  cy="12"
                  r="3.2"
                  stroke="var(--camp-text)"
                  strokeWidth="1.8"
                />
              </>
            ) : (
              <path
                d={tool.icon}
                fill={tool.id === 'groupMove' ? 'currentColor' : 'none'}
                stroke={tool.id === 'groupMove' ? 'none' : 'currentColor'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      ))}
    </div>
  )
}
