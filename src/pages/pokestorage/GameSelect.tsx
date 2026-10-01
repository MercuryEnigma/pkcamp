import { useEffect, useState } from 'react'
import {
  ROSTER,
  saveLibrary,
  type Gen3GameId,
} from '../../services/saveLibrary'
import { GAME_LABEL } from './gameDisplay'
import { ZoneCard } from './ZoneCard'

/** ROSTER's value type is the broad GameId union; index 3 is always Gen3GameId by construction. */
const GEN_3_GAMES = ROSTER[3] as readonly Gen3GameId[]

type BackupStatus = { hasSave: boolean; updatedAt: Date | null }

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'June',
  'July',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
] as const

function formatBackupDate(date: Date): string {
  return `${date.getFullYear()} ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
}

export function GameSelect({
  onBack,
  onSelectGame,
  onSelectLocalPokemon,
  activity = 'storage',
}: {
  onBack: () => void
  onSelectGame: (gameId: Gen3GameId) => void
  onSelectLocalPokemon: () => void
  activity?: 'storage' | 'trade'
}) {
  const [backupStatuses, setBackupStatuses] = useState<Partial<
    Record<Gen3GameId, BackupStatus>
  > | null>(null)

  useEffect(() => {
    let cancelled = false

    void saveLibrary.whenReady().then(() => {
      if (cancelled) return
      setBackupStatuses(
        Object.fromEntries(
          GEN_3_GAMES.map((gameId) => [
            gameId,
            {
              hasSave: saveLibrary.getSave(gameId) !== null,
              updatedAt: saveLibrary.getSaveUpdatedAt(gameId),
            },
          ])
        ) as Record<Gen3GameId, BackupStatus>
      )
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">
              {activity === 'trade'
                ? 'Trading Post · GBA Lodge'
                : 'Camp Zone · GBA Lodge'}
            </p>
            <h1 className="camp-title">
              {activity === 'trade'
                ? 'Choose a Pokémon source'
                : 'Welcome to the GBA Lodge'}
            </h1>
            <p className="camp-page-subtitle">
              {activity === 'trade'
                ? 'Select a game cabin or your Camping Pokémon.'
                : 'Choose a game cabin or go camping with your Pokémon.'}
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>
        <div className="camp-grid">
          {GEN_3_GAMES.map((gameId) => {
            const status = backupStatuses?.[gameId]
            const meta =
              backupStatuses === null
                ? 'Checking…'
                : status?.hasSave
                  ? status.updatedAt
                    ? formatBackupDate(status.updatedAt)
                    : 'Backup saved'
                  : 'Upload'

            return (
              <ZoneCard
                key={gameId}
                label={`${GAME_LABEL[gameId]} Cabin`}
                sublabel={meta}
                onClick={() => onSelectGame(gameId)}
              />
            )
          })}
          <ZoneCard
            label="Camp Sites"
            sublabel={
              activity === 'trade'
                ? 'Trade with FireRed or LeafGreen on Switch'
                : 'camping GBA Pokemon'
            }
            onClick={onSelectLocalPokemon}
          />
        </div>
      </div>
    </div>
  )
}
