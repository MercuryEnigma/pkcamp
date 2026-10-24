import type { Gen3GameId } from '../../services/saveLibrary'
import { GAME_LABEL } from '../pokestorage/gameDisplay'
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
  const RomControl = onRom ? 'button' : 'span'
  return (
    <article className="game-cartridge" data-version={gameId}>
      <span className="game-cartridge-mark" aria-hidden="true">
        GAME BOY ADVANCE
      </span>
      <div className="game-cartridge-label">
        <button
          type="button"
          className="game-cartridge-main"
          onClick={onSelect}
          aria-label={`${GAME_LABEL[gameId]}: ${saveStatus}`}
        >
          <span className="game-cartridge-name">{GAME_LABEL[gameId]}</span>
          <span className="game-cartridge-save">{saveStatus}</span>
        </button>
        <RomControl
          {...(onRom ? { type: 'button' as const, onClick: onRom } : {})}
          className="game-cartridge-rom"
          data-ready={romReady}
          aria-label={
            onRom
              ? `${GAME_LABEL[gameId]}: ${romStatus}. Manage ROM.`
              : undefined
          }
        >
          {romStatus}
        </RomControl>
      </div>
    </article>
  )
}
