import { useTranslation } from 'react-i18next'
import { i18n } from '../../services/i18n'
import type { Gen3GameId } from '../../services/saveLibrary'
import type { SpriteRequest } from '../../services/sprites'
import { CAMP_SITE_SIZE } from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { DEFAULT_CAMP_SITE_COUNT, MAX_CAMP_SITE_COUNT } from './campPositions'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'
import { SPRITE_SOURCES } from '../../services/sprites/catalog'
import { getGameLabel } from './gameDisplay'
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
const getSpriteShowcase = (): ReadonlyArray<{
  key: string
  label: string
  request: SpriteRequest
}> => [
  {
    key: 'bulbasaur',
    label: i18n.t('settings:SettingsSections.bulbasaur'),
    request: {
      nationalDex: 1,
      displayName: i18n.t('settings:SettingsSections.bulbasaur'),
    },
  },
  {
    key: 'bulbasaur-shiny',
    label: i18n.t('settings:SettingsSections.bulbasaurShiny'),
    request: {
      nationalDex: 1,
      displayName: i18n.t('settings:SettingsSections.bulbasaur'),
      shiny: true,
    },
  },
  {
    key: 'venusaur-f',
    label: i18n.t('settings:SettingsSections.venusaur'),
    request: {
      nationalDex: 3,
      displayName: i18n.t('settings:SettingsSections.venusaur2'),
      gender: 'female',
    },
  },
  {
    key: 'venusaur-m',
    label: i18n.t('settings:SettingsSections.venusaur3'),
    request: {
      nationalDex: 3,
      displayName: i18n.t('settings:SettingsSections.venusaur2'),
      gender: 'male',
    },
  },
  {
    key: 'deoxys-defense',
    label: i18n.t('settings:SettingsSections.deoxysDefense'),
    request: {
      nationalDex: 386,
      displayName: i18n.t('settings:SettingsSections.deoxys'),
      formId: 'deoxys-defense',
    },
  },
]

/** Picks which GBA Lodge Cabin, or the Campsites, the Backup tab shows. */
export function CabinPicker({ form }: { form: SettingsForm }) {
  const { t } = useTranslation(['settings', 'common'] as const)

  const { selectedCabin, selectCabin } = form
  return (
    <label className="camp-settings-field">
      <span>{t('SettingsSections.cabin')}</span>
      <select
        className="camp-select"
        value={selectedCabin}
        onChange={(event) => {
          selectCabin(event.target.value as CabinSelection)
        }}
      >
        {GEN_3_GAMES.map((gameId) => (
          <option key={gameId} value={gameId}>
            {t('SettingsSections.cabin2', { value1: getGameLabel(gameId) })}
          </option>
        ))}
        <option value="campsites">{t('SettingsSections.campsites')}</option>
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
  const { t } = useTranslation(['settings', 'common'] as const)

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
      {t('SettingsSections.fromGba')}
    </button>
  )
  const fromFileBtn = (
    <label className="camp-transfer-btn">
      {t('SettingsSections.fromFile')}
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
        <strong className="camp-cabin-name">
          {t('SettingsSections.cabin2', { value1: getGameLabel(gameId) })}
        </strong>
        {hasSave && status?.updatedAt && (
          <span className="camp-cabin-date">
            {t('SettingsSections.updated', {
              value1: formatBackupDate(status.updatedAt),
            })}
          </span>
        )}
      </div>
      <p className="camp-cabin-status">
        {backups === null
          ? t('SettingsSections.checking')
          : hasSave
            ? t('SettingsSections.backupOnFile')
            : t('SettingsSections.noBackupOnFile')}
      </p>

      {hasSave ? (
        <div className="camp-transfer-groups">
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">
              {t('SettingsSections.bringASaveIntoCamp')}
            </span>
            {fromGbaBtn}
            {fromFileBtn}
          </div>
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">
              {t('SettingsSections.takeThisSaveOut')}
            </span>
            <button
              type="button"
              className="camp-transfer-btn"
              disabled={gbaAction !== null}
              onClick={() => void handleBackupWrite(gameId)}
            >
              {t('SettingsSections.toGba')}
            </button>
            <button
              type="button"
              className="camp-transfer-btn"
              onClick={() => void handleBackupExport(gameId)}
            >
              {t('SettingsSections.downloadFile')}
            </button>
          </div>
        </div>
      ) : (
        <div className="camp-transfer-groups">
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">
              {t('SettingsSections.addASave')}
            </span>
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
            {t('SettingsSections.removeBackup')}
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
              setMessage(
                t('SettingsSections.cabinWasRestoredToTheGba', {
                  value1: getGameLabel(gameId),
                })
              )
            }}
            onClose={() => setGbaAction(null)}
          />
        ))}
    </div>
  )
}

/** The GBA Lodge Camp Site count and campsite download. */
export function CampsitesCard({ form }: { form: SettingsForm }) {
  const { t } = useTranslation(['settings', 'common'] as const)

  const {
    siteCounts,
    setSiteCounts,
    saving,
    offline,
    camps,
    campsiteMinimum,
    handleDownloadCampsite,
    handleCampsiteRemove,
  } = form
  const hasCampers = (camps?.get(GBA_GENERATION)?.sites ?? []).some((site) =>
    site.some((pokemon) => pokemon !== null)
  )
  const siteCount = Math.max(
    siteCounts?.[GBA_GENERATION] ?? DEFAULT_CAMP_SITE_COUNT,
    campsiteMinimum
  )
  return (
    <div className="camp-cabin-card">
      <div className="camp-cabin-head">
        <strong className="camp-cabin-name">
          {t('SettingsSections.campsites')}
        </strong>
      </div>
      <p className="camp-cabin-status">
        {t('SettingsSections.eachCampSiteAddsCampingPokeMonSpacesToThe', {
          CAMP_SITE_SIZE: CAMP_SITE_SIZE,
        })}
      </p>

      <label className="camp-settings-field">
        <span>{t('SettingsSections.numberOfCampSites')}</span>
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
          {t('SettingsSections.minimumCampSites', { count: campsiteMinimum })}
        </small>
      </label>

      <div className="camp-transfer-groups">
        <div className="camp-transfer-group">
          <span className="camp-transfer-group-label">
            {t('SettingsSections.takeTheCampsiteOut')}
          </span>
          <button
            type="button"
            className="camp-transfer-btn"
            onClick={() => void handleDownloadCampsite()}
          >
            {t('SettingsSections.downloadCampsiteZip')}
          </button>
        </div>
      </div>

      {hasCampers && (
        <div className="camp-cabin-footer">
          <button
            type="button"
            className="camp-text-btn camp-text-btn--danger"
            disabled={offline || saving}
            onClick={() => void handleCampsiteRemove()}
          >
            {t('SettingsSections.deleteCampsite')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Sprite source picker with a live preview. */
export function SpriteSourcePicker({ form }: { form: SettingsForm }) {
  const { t } = useTranslation(['settings', 'common'] as const)

  const {
    spriteSourceId,
    setSpriteSourceId,
    spriteResolver,
    selectedSpriteSource,
  } = form
  return (
    <>
      <label className="camp-settings-field">
        <span>{t('SettingsSections.spriteResource')}</span>
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
        {getSpriteShowcase().map(({ key, label, request }) => {
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
        {t('SettingsSections.viewResource', {
          value1: selectedSpriteSource.label.split(' — ')[0],
        })}
      </a>
    </>
  )
}

/** Active storage and the Dropbox connection. */
export function DataStorageControls({ form }: { form: SettingsForm }) {
  const { t } = useTranslation(['settings', 'common'] as const)

  const { provider, offline, dropboxStatus, handleDropbox } = form
  const inDropbox = provider.id === 'dropbox'
  return (
    <>
      <div className="camp-cabin-card camp-storage-location">
        <div className="camp-cabin-head">
          <strong className="camp-cabin-name">
            {inDropbox
              ? t('SettingsSections.storedOnDropbox')
              : t('SettingsSections.storedLocallyInThisBrowser')}
          </strong>
        </div>
        <p className="camp-cabin-status">
          {inDropbox
            ? offline
              ? t('SettingsSections.yourDataIsInYourDropboxAccountWhichCanT')
              : t(
                  'SettingsSections.yourDataIsSavedToYourDropboxAccountAndFollows'
                )
            : t('SettingsSections.yourDataIsSavedOnlyInThisBrowserOnThis')}
        </p>
      </div>
      {dropboxAccount.isConfigured() ? (
        <>
          <p className="camp-status">
            {t('SettingsSections.dropbox', {
              value1:
                dropboxStatus.state === 'connected'
                  ? 'connected'
                  : dropboxStatus.state === 'connecting'
                    ? 'connecting…'
                    : dropboxStatus.state === 'error'
                      ? 'unreachable'
                      : t('settings:SettingsSections.notConnected'),
              value2: dropboxStatus.message
                ? t('settings:SettingsSections.statusDetail', {
                    message: dropboxStatus.message,
                  })
                : '',
            })}
          </p>
          <div className="camp-local-actions">
            {provider.id === 'dropbox' ? (
              <button
                type="button"
                className="camp-upload-btn camp-danger-btn"
                onClick={() => void handleDropbox(false)}
              >
                {t('SettingsSections.disconnectDropbox')}
              </button>
            ) : (
              <button
                type="button"
                className="camp-upload-btn camp-upload-btn--primary"
                disabled={dropboxStatus.state === 'connecting'}
                onClick={() => void handleDropbox(true)}
              >
                {t('SettingsSections.connectDropbox')}
              </button>
            )}
          </div>
          <small>
            {t(
              'SettingsSections.connectingCopiesThisBrowserSDataToDropboxTheCopy'
            )}
          </small>
        </>
      ) : (
        <p className="camp-status">
          {t('SettingsSections.dropboxIsnTConfiguredForThisBuildSoYourData')}
        </p>
      )}
    </>
  )
}
