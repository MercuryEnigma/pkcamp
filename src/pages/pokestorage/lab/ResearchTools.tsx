import { useEffect, useRef } from 'react'
import './researchTools.css'
import './researchPage.css'

type ToolAction = 'saves' | 'dumps' | 'gifts' | 'transporter'

const tools: readonly {
  title: string
  description: string
  open: { action: ToolAction; label: string }
}[] = [
  {
    title: 'Cartridge Saves',
    description:
      'Download GBA saves or restore a .sav to a cartridge. Switch backup is in research.',
    open: { action: 'saves', label: 'Open save tools →' },
  },
  {
    title: 'ROM & BIOS Dumps',
    description: 'Download cartridge ROMs and the GBA BIOS with GB-Link.',
    open: { action: 'dumps', label: 'Open dump tools →' },
  },
  {
    title: 'Mystery Gifts',
    description:
      'Send Wonder Cards to a GBA or the Switch: Fast Forward, PC Anywhere and more.',
    open: { action: 'gifts', label: 'Open Mystery Gifts →' },
  },
  {
    title: 'Poké Transporter GB',
    description: 'Move Pokémon from Gen 1–2 into Gen 3.',
    open: { action: 'transporter', label: 'Open transporter →' },
  },
]

export function ResearchTools({
  onBack,
  onOpenSaves,
  onOpenDumps,
  onOpenGifts,
  onOpenTransporter,
}: {
  onBack: () => void
  onOpenSaves: () => void
  onOpenDumps: () => void
  onOpenGifts: () => void
  onOpenTransporter: () => void
}) {
  const handlers: Record<ToolAction, () => void> = {
    saves: onOpenSaves,
    dumps: onOpenDumps,
    gifts: onOpenGifts,
    transporter: onOpenTransporter,
  }
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <div className="camp-root research-tools-root research-page">
      <div className="camp-content research-tools-content research-page-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Lab Zone</p>
            <h1 className="camp-title" ref={heading} tabIndex={-1}>
              Research Tools
            </h1>
            <p className="camp-page-subtitle">
              Work with cartridges and connected games.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div
          className="research-tools-grid research-page-body"
          aria-label="Research tools"
        >
          {tools.map((tool) => (
            <button
              type="button"
              className="lab-station research-tool-card"
              key={tool.title}
              onClick={handlers[tool.open.action]}
            >
              <span className="lab-station-title">{tool.title}</span>
              <span className="lab-station-desc">{tool.description}</span>
              <span className="lab-station-action">{tool.open.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
