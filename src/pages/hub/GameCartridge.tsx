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
  /** Empty while the ROM is still being checked; the row keeps its height. */
  romStatus: string
  romReady: boolean
  onSelect: () => void
  /** Only passed when the ROM is missing; the ROM row then adds one. */
  onRom?: () => void
}) {
  const { t } = useTranslation(['start', 'common'] as const)

  const RomControl = onRom ? 'button' : 'span'
  return (
    <article className="game-cartridge" data-version={gameId}>
      <img className="game-cartridge-art" src={cartridgeOutline} alt="" />
      {/* The covering save button names the game and save for screen
          readers, so only an actionable ROM row is exposed here. */}
      <div className="game-cartridge-label">
        <span className="game-cartridge-name" aria-hidden>
          {getGameLabel(gameId)}
        </span>
        <span className="game-cartridge-save" aria-hidden>
          {saveStatus}
        </span>
        <RomControl
          {...(onRom
            ? { type: 'button' as const, onClick: onRom }
            : { 'aria-hidden': true })}
          className="game-cartridge-rom"
          data-ready={romReady}
          aria-label={
            onRom
              ? t('GameCartridge.addRom', {
                  value1: getGameLabel(gameId),
                  romStatus: romStatus,
                })
              : undefined
          }
        >
          {romStatus || ' '}
        </RomControl>
      </div>
      {/* Covers the whole cartridge, so any click outside the ROM row opens
          the save. */}
      <button
        type="button"
        className="game-cartridge-main"
        onClick={onSelect}
        aria-label={t('GameCartridge.saveStatusLabel', {
          value1: getGameLabel(gameId),
          saveStatus: saveStatus,
        })}
      />
    </article>
  )
}
