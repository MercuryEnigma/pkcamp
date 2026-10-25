import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['trade', 'common'] as const)

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
    <Panel label={t('TradePanel.trade')} className="trade-panel">
      <div className="trade-sides">
        <TradeSidePanel
          key="left"
          name={t('TradePanel.yourSide')}
          {...sideProps('left')}
        />
        <TradeSidePanel
          key="right"
          name={t('TradePanel.otherSide')}
          {...sideProps('right')}
        />
      </div>

      {viaSwitch && (
        <div>
          <p>{t('TradePanel.onTheSwitchLeadATradeCenterGroupUpstairsIn')}</p>
          <p>
            {gbaSide?.device === 'gb-link' && gbaSide.gbaGame === 'wireless'
              ? t('TradePanel.onTheGbaJoinTheGroup')
              : gbaSide?.device === 'gb-link' && gbaSide.gbaGame === 'cable'
                ? t('TradePanel.onTheGbaTalkToTheMiddleCounterUpstairsIn')
                : t('TradePanel.chooseTheGameOnTheGba')}
          </p>
          <p>
            {t('TradePanel.bothPlayersChooseTheirPokeMonOnTheirOwnConsole')}
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
              ? t('TradePanel.stopLink')
              : t('TradePanel.startLink')
            : busy
              ? t('TradePanel.trading')
              : t('TradePanel.startTrade')}
        </button>
        {busy && !viaSwitch && (
          <button
            type="button"
            className="camp-upload-btn"
            onClick={cancelTrade}
          >
            {t('TradePanel.cancelTrade')}
          </button>
        )}
        {!busy && lastTrade && (
          <button
            type="button"
            className="camp-upload-btn"
            disabled={offline}
            onClick={() => void undoTrade()}
          >
            {t('TradePanel.revertTrade')}
          </button>
        )}
      </div>

      {offline && writesStorage && (
        <p>
          {t(
            'TradePanel.dropboxIsUnreachableTradesThatChangePkcampStorageArePaused'
          )}
        </p>
      )}
      {message && <p aria-live="polite">{message}</p>}
    </Panel>
  )
}
