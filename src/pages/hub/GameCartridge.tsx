import { useTranslation } from 'react-i18next'
import type { Gen3GameId } from '../../services/saveLibrary'
import { getGameLabel } from '../pokestorage/gameDisplay'
import cartridgeOutline from '../../assets/gba-cartridge.png'
import './gameCartridge.css'

export function GameCartridge({
  gameId,
  saveStatus,
  romStatus,
  romReady,
  onSelect,
  onRom,
}: {
  gameId: Gen3GameId
  saveStatus: string
  romStatus: string
  romReady: boolean
  onSelect: () => void
  onRom?: () => void
}) {
  const { t } = useTranslation(['start', 'common'] as const)

  const RomControl = onRom ? 'button' : 'span'
  return (
    <article className="game-cartridge" data-version={gameId}>
      <img className="game-cartridge-art" src={cartridgeOutline} alt="" />
      <div className="game-cartridge-label">
        <button
          type="button"
          className="game-cartridge-main"
          onClick={onSelect}
          aria-label={t('GameCartridge.saveStatusLabel', {
            value1: getGameLabel(gameId),
            saveStatus: saveStatus,
          })}
        >
          <span className="game-cartridge-name">{getGameLabel(gameId)}</span>
          <span className="game-cartridge-save">{saveStatus}</span>
        </button>
        <RomControl
          {...(onRom ? { type: 'button' as const, onClick: onRom } : {})}
          className="game-cartridge-rom"
          data-ready={romReady}
          aria-label={
            onRom
              ? t('GameCartridge.manageRom', {
                  value1: getGameLabel(gameId),
                  romStatus: romStatus,
                })
              : undefined
          }
        >
          {romStatus}
        </RomControl>
      </div>
    </article>
  )
}
