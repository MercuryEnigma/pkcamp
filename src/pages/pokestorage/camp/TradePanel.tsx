import type { Gen3GameId } from '../../../services/saveLibrary'
import { Panel } from '../../hub/Panel'
import { TradeSidePanel } from '../TradeSidePanel'
import { useTradeSession } from '../useTradeSession'

/**
 * The trade section of Camp: the selected game's save on one side and the
 * counterpart (another save, a device or the Camp Sites) on the other.
 */
export function TradePanel({
  gameId,
  onTraded,
}: {
  gameId: Gen3GameId | null
  /** Called after a trade or revert changed what is stored. */
  onTraded: () => void
}) {
  const {
    viaSwitch,
    gbaSide,
    writesStorage,
    ready,
    busy,
    message,
    lastTrade,
    offline,
    startTrade,
    undoTrade,
    cancelTrade,
    sideProps,
  } = useTradeSession({ initialGameId: gameId ?? undefined, onTraded })

  return (
    <Panel label="Trade" className="trade-panel">
      <div className="trade-sides">
        <TradeSidePanel key="left" name="Your side" {...sideProps('left')} />
        <TradeSidePanel key="right" name="Other side" {...sideProps('right')} />
      </div>

      {viaSwitch && (
        <div>
          <p>
            On the Switch, lead a Trade Center group upstairs in a Pokémon
            Center.
          </p>
          <p>
            {gbaSide?.device === 'gb-link' && gbaSide.gbaGame === 'wireless'
              ? 'On the GBA, join the group.'
              : gbaSide?.device === 'gb-link' && gbaSide.gbaGame === 'cable'
                ? 'On the GBA, talk to the middle counter upstairs in a Pokémon Center.'
                : 'Choose the game on the GBA.'}
          </p>
          <p>
            Both players choose their Pokémon on their own console. pkCamp
            doesn't store anything from this trade.
          </p>
        </div>
      )}

      <div className="trade-actions">
        <button
          type="button"
          className="camp-upload-btn camp-upload-btn--primary"
          disabled={viaSwitch && busy ? false : !ready || busy}
          onClick={() =>
            viaSwitch && busy ? cancelTrade() : void startTrade()
          }
        >
          {viaSwitch
            ? busy
              ? 'Stop link'
              : 'Start link'
            : busy
              ? 'Trading…'
              : 'Start trade'}
        </button>
        {busy && !viaSwitch && (
          <button
            type="button"
            className="camp-upload-btn"
            onClick={cancelTrade}
          >
            Cancel trade
          </button>
        )}
        {!busy && lastTrade && (
          <button
            type="button"
            className="camp-upload-btn"
            disabled={offline}
            onClick={() => void undoTrade()}
          >
            Revert trade
          </button>
        )}
      </div>

      {offline && writesStorage && (
        <p>
          Dropbox is unreachable. Trades that change pkCamp storage are paused
          until it reconnects.
        </p>
      )}
      {message && <p aria-live="polite">{message}</p>}
    </Panel>
  )
}
