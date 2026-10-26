import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../services/i18n'
import { useTradeSession } from '../useTradeSession'
import { TradePanel } from './TradePanel'

vi.mock('../useTradeSession', () => ({ useTradeSession: vi.fn() }))
vi.mock('../TradeSidePanel', () => ({ TradeSidePanel: () => null }))

beforeEach(() => vi.clearAllMocks())

describe('Camp trade controls', () => {
  it.each([
    { busy: false, completed: false, relay: false, label: 'Start trade' },
    { busy: true, completed: false, relay: false, label: 'Cancel trade' },
    { busy: true, completed: true, relay: false, label: 'End trade' },
    { busy: false, completed: true, relay: false, label: 'End trade' },
    { busy: false, completed: false, relay: true, label: 'Start link' },
    { busy: true, completed: false, relay: true, label: 'Stop link' },
  ])(
    'shows only $label for busy=$busy, completed=$completed, relay=$relay',
    ({ busy, completed, relay, label }) => {
      vi.mocked(useTradeSession).mockReturnValue({
        busy,
        lastTrade: completed ? [{}] : null,
        viaSwitch: relay,
        ready: true,
        sideProps: () => ({}),
      } as unknown as ReturnType<typeof useTradeSession>)
      const html = renderToStaticMarkup(
        <TradePanel gameId="emerald" onTraded={vi.fn()} onEnd={vi.fn()} />
      )
      expect(html.match(/<button\b/g)).toHaveLength(1)
      expect(html).toContain(`>${label}</button>`)
    }
  )
})
