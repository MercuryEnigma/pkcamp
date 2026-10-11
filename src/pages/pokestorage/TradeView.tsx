import './camp.css'
import { TradeSidePanel } from './TradeSidePanel'
import { useTradeSession, type TradeViewProps } from './useTradeSession'

/** The Camp Zone Trading Post. Trade logic lives in `useTradeSession`. */
export function TradeView(props: TradeViewProps) {
  const {
    initialGameId,
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
    handleBack,
    sideProps,
  } = useTradeSession(props)

  return (
    <div className="camp-root">
      <div className="camp-content camp-content--trade">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={handleBack}>
            {initialGameId ? '← Back to Cabin' : '← Back'}
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Trading Post</p>
            <h1 className="camp-title">Choose two trainers to trade</h1>
            <p className="camp-page-subtitle">Select trainers for each side.</p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="camp-trade-columns">
          <TradeSidePanel
            key="left"
            name="Trainer Side A"
            {...sideProps('left')}
          />
          <div className="camp-trade-between" aria-hidden="true">
            ↔
          </div>
          <TradeSidePanel
            key="right"
            name="Trainer Side B"
            {...sideProps('right')}
          />
        </div>

        {viaSwitch && (
          <div className="camp-trade-note">
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
              Both players choose their Pokémon on their own console. PkCamp
              doesn't store anything from this trade.
            </p>
          </div>
        )}

        <div className="camp-trade-actions">
          <button
            type="button"
            className="camp-confirm-btn"
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
          <p className="camp-status">
            Dropbox is unreachable. Trades that change PkCamp storage are paused
            until it reconnects.
          </p>
        )}

        {message && (
          <p className="camp-status" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
