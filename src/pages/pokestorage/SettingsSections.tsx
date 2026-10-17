import type { Gen3GameId } from '../../services/saveLibrary'
import type { SpriteRequest } from '../../services/sprites'
import { CAMP_SITE_SIZE, storage } from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { DEFAULT_CAMP_SITE_COUNT, MAX_CAMP_SITE_COUNT } from './campPositions'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'
import { SPRITE_SOURCES } from '../../services/sprites/catalog'
import { GAME_LABEL } from './gameDisplay'
import { GbaSavePanel } from './GbaSavePanel'
import {
  formatBackupDate,
  GBA_GENERATION,
  GEN_3_GAMES,
  type CabinSelection,
  type SettingsForm,
} from './useSettingsForm'

/*
 * The controls inside each settings tab, driven by `useSettingsForm`. Pages
 * wrap them with their own section headings and intro text.
 */

/**
 * Five requests picked to exercise the axes a sprite source can differ on:
 * base vs. shiny (Bulbasaur), a same-species gender request (Venusaur ♀/♂ —
 * some sources have distinct art per gender, some don't and honestly fall
 * back to one shared sprite for both), and an alternate form (Deoxys's
 * Attack forme. Unsupported combinations honestly fall back to base art.
 */
const SPRITE_SHOWCASE: ReadonlyArray<{
  key: string
  label: string
  request: SpriteRequest
}> = [
  {
    key: 'bulbasaur',
    label: 'Bulbasaur',
    request: { nationalDex: 1, displayName: 'Bulbasaur' },
  },
  {
    key: 'bulbasaur-shiny',
    label: 'Bulbasaur (Shiny)',
    request: { nationalDex: 1, displayName: 'Bulbasaur', shiny: true },
  },
  {
    key: 'venusaur-f',
    label: 'Venusaur ♀',
    request: { nationalDex: 3, displayName: 'Venusaur', gender: 'female' },
  },
  {
    key: 'venusaur-m',
    label: 'Venusaur ♂',
    request: { nationalDex: 3, displayName: 'Venusaur', gender: 'male' },
  },
  {
    key: 'deoxys-defense',
    label: 'Deoxys (Defense)',
    request: {
      nationalDex: 386,
      displayName: 'Deoxys',
      formId: 'deoxys-defense',
    },
  },
]

/** Picks which GBA Lodge Cabin, or the Campsites, the Backup tab shows. */
export function CabinPicker({ form }: { form: SettingsForm }) {
  const { selectedCabin, selectCabin } = form
  return (
    <label className="camp-settings-field">
      <span>Cabin</span>
      <select
        className="camp-select"
        value={selectedCabin}
        onChange={(event) => {
          selectCabin(event.target.value as CabinSelection)
        }}
      >
        {GEN_3_GAMES.map((gameId) => (
          <option key={gameId} value={gameId}>
            {GAME_LABEL[gameId]} Cabin
          </option>
        ))}
        <option value="campsites">Campsites</option>
      </select>
    </label>
  )
}

/** One Cabin's backup record with its transfer actions. */
export function CabinBackupCard({
  form,
  gameId,
}: {
  form: SettingsForm
  gameId: Gen3GameId
}) {
  const {
    adapter,
    offline,
    backups,
    gbaAction,
    setGbaAction,
    setMessage,
    confirmReplaceBackup,
    handleBackupUpload,
    handleBackupRead,
    handleBackupWrite,
    handleBackupExport,
    handleBackupRemove,
  } = form
  const status = backups?.[gameId]
  const hasSave = status?.hasSave ?? false
  const fromGbaBtn = (
    <button
      type="button"
      className="camp-transfer-btn"
      disabled={gbaAction !== null || offline || backups === null}
      onClick={() => {
        if (confirmReplaceBackup(gameId)) setGbaAction({ gameId, mode: 'read' })
      }}
    >
      From GBA
    </button>
  )
  const fromFileBtn = (
    <label className="camp-transfer-btn">
      From file
      <input
        className="camp-file-input--hidden"
        type="file"
        accept=".sav"
        disabled={!adapter || offline}
        onChange={(event) => void handleBackupUpload(gameId, event)}
      />
    </label>
  )
  return (
    <div className="camp-cabin-card">
      <div className="camp-cabin-head">
        <strong className="camp-cabin-name">{GAME_LABEL[gameId]} Cabin</strong>
        {hasSave && status?.updatedAt && (
          <span className="camp-cabin-date">
            Updated {formatBackupDate(status.updatedAt)}
          </span>
        )}
      </div>
      <p className="camp-cabin-status">
        {backups === null
          ? 'Checking…'
          : hasSave
            ? 'Backup on file'
            : 'No backup on file'}
      </p>

      {hasSave ? (
        <div className="camp-transfer-groups">
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">
              Bring a save into camp
            </span>
            {fromGbaBtn}
            {fromFileBtn}
          </div>
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">
              Take this save out
            </span>
            <button
              type="button"
              className="camp-transfer-btn"
              disabled={gbaAction !== null}
              onClick={() => void handleBackupWrite(gameId)}
            >
              To GBA
            </button>
            <button
              type="button"
              className="camp-transfer-btn"
              onClick={() => void handleBackupExport(gameId)}
            >
              Download file
            </button>
          </div>
        </div>
      ) : (
        <div className="camp-transfer-groups">
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">Add a save</span>
            {fromGbaBtn}
            {fromFileBtn}
          </div>
        </div>
      )}

      {hasSave && (
        <div className="camp-cabin-footer">
          <button
            type="button"
            className="camp-text-btn camp-text-btn--danger"
            disabled={offline}
            onClick={() => void handleBackupRemove(gameId)}
          >
            Remove backup
          </button>
        </div>
      )}

      {gbaAction?.gameId === gameId &&
        (gbaAction.mode === 'read' ? (
          <GbaSavePanel
            mode="read"
            gameId={gameId}
            onSave={() => void handleBackupRead(gameId)}
            onClose={() => setGbaAction(null)}
          />
        ) : (
          <GbaSavePanel
            mode="write"
            gameId={gameId}
            save={gbaAction.save}
            onWritten={() => {
              setGbaAction(null)
              setMessage(`${GAME_LABEL[gameId]} Cabin was restored to the GBA.`)
            }}
            onClose={() => setGbaAction(null)}
          />
        ))}
    </div>
  )
}

/** The GBA Lodge Camp Site count and campsite download. */
export function CampsitesCard({ form }: { form: SettingsForm }) {
  const {
    siteCounts,
    setSiteCounts,
    saving,
    campsiteMinimum,
    handleDownloadCampsite,
  } = form
  const siteCount = Math.max(
    siteCounts?.[GBA_GENERATION] ?? DEFAULT_CAMP_SITE_COUNT,
    campsiteMinimum
  )
  return (
    <div className="camp-cabin-card">
      <div className="camp-cabin-head">
        <strong className="camp-cabin-name">Campsites</strong>
      </div>
      <p className="camp-cabin-status">
        Each Camp Site adds {CAMP_SITE_SIZE} Camping Pokémon spaces to the GBA
        Lodge.
      </p>

      <label className="camp-settings-field">
        <span>Number of Camp Sites</span>
        <input
          className="camp-number-input"
          type="number"
          min={campsiteMinimum}
          max={MAX_CAMP_SITE_COUNT}
          step={1}
          value={siteCount}
          disabled={!siteCounts || saving}
          onChange={(event) => {
            const next =
              Number.parseInt(event.target.value, 10) || campsiteMinimum
            setSiteCounts((current) => ({
              ...current!,
              [GBA_GENERATION]: Math.min(
                MAX_CAMP_SITE_COUNT,
                Math.max(campsiteMinimum, next)
              ),
            }))
          }}
        />
        <small>
          Need at least {campsiteMinimum} Camp Site
          {campsiteMinimum === 1 ? '' : 's'}: Pokémon keep their positions, so
          the last Camp Site with a camper stays. Save settings to apply a new
          count.
        </small>
      </label>

      <div className="camp-transfer-groups">
        <div className="camp-transfer-group">
          <span className="camp-transfer-group-label">
            Take the campsite out
          </span>
          <button
            type="button"
            className="camp-transfer-btn"
            onClick={() => void handleDownloadCampsite()}
          >
            Download campsite (.zip)
          </button>
        </div>
      </div>
    </div>
  )
}

/** Sprite source picker with a live preview. */
export function SpriteSourcePicker({ form }: { form: SettingsForm }) {
  const {
    spriteSourceId,
    setSpriteSourceId,
    spriteResolver,
    selectedSpriteSource,
  } = form
  return (
    <>
      <label className="camp-settings-field">
        <span>Sprite resource</span>
        <select
          className="camp-select"
          value={spriteSourceId}
          onChange={(event) => setSpriteSourceId(event.target.value)}
        >
          {SPRITE_SOURCES.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <div className="camp-sprite-preview-row">
        {SPRITE_SHOWCASE.map(({ key, label, request }) => {
          const display = resolveSpriteDisplay(spriteResolver, request)
          return (
            <div className="camp-sprite-preview-item" key={key}>
              <img
                className="camp-sprite-preview-img"
                src={spriteDisplayImageSrc(display)}
                alt={display.label}
                title={display.label}
              />
              <span className="camp-sprite-preview-label">{label}</span>
            </div>
          )
        })}
      </div>
      <a
        className="camp-sprite-source-link"
        href={selectedSpriteSource.homepage}
        target="_blank"
        rel="noreferrer"
      >
        View {selectedSpriteSource.label.split(' — ')[0]} resource ↗
      </a>
    </>
  )
}

/** Active storage and the Dropbox connection. */
export function DataStorageControls({ form }: { form: SettingsForm }) {
  const { provider, dropboxStatus, handleDropbox } = form
  return (
    <>
      <p>
        <strong>Active storage:</strong> {storage.label}
      </p>
      {dropboxAccount.isConfigured() ? (
        <>
          <p className="camp-status">
            Dropbox:{' '}
            {dropboxStatus.state === 'connected'
              ? 'connected'
              : dropboxStatus.state === 'connecting'
                ? 'connecting…'
                : dropboxStatus.state === 'error'
                  ? 'unreachable'
                  : 'not connected'}
            {dropboxStatus.message ? ` · ${dropboxStatus.message}` : ''}
          </p>
          <div className="camp-local-actions">
            {provider.id === 'dropbox' ? (
              <button
                type="button"
                className="camp-upload-btn camp-danger-btn"
                onClick={() => void handleDropbox(false)}
              >
                Disconnect Dropbox
              </button>
            ) : (
              <button
                type="button"
                className="camp-upload-btn camp-upload-btn--primary"
                disabled={dropboxStatus.state === 'connecting'}
                onClick={() => void handleDropbox(true)}
              >
                Connect Dropbox
              </button>
            )}
          </div>
          <small>
            Connecting copies this browser's data to Dropbox. The copy in this
            browser is kept, and disconnecting returns to it.
          </small>
        </>
      ) : (
        <p className="camp-status">
          Dropbox isn't configured for this build, so your data stays in this
          browser.
        </p>
      )}
    </>
  )
}
