import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import { formatList } from '../../../services/i18n/format'
import { useState } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import { storage } from '../../../services/storage'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { usePkHex } from '../../context/PkHexContext'
import { getGameLabel } from '../gameDisplay'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import {
  getBootStep,
  getConnectStep,
  readFromCartridge,
  restoreErrorMessage,
  taskErrorMessage,
} from '../gbLinkTask'
import { gameIdsFromSave } from '../saveVersion'
import { useStorageProvider } from '../useStorage'
import { cartridgeFileName, downloadFile } from './downloadFile'
import { ToolPage } from './ToolPage'

type Task = 'read' | 'write'

interface RestoreFile {
  name: string
  bytes: Uint8Array
  /** Ruby/Sapphire saves fit either cartridge; the cartridge decides. */
  gameIds: readonly Gen3GameId[]
}

const getTasks = () =>
  [
    ['read', i18n.t('cartridge-saves:CartridgeSaves.backUp')],
    ['write', i18n.t('cartridge-saves:CartridgeSaves.restore')],
  ] as const

const describeReadError = taskErrorMessage()

/**
 * Backs up and restores GBA cartridge saves over GB-Link. The game comes from
 * the cartridge (backup) or the chosen file (restore), never a menu.
 */
export function CartridgeSaves() {
  const { t } = useTranslation(['cartridge-saves', 'common'] as const)

  const { adapter } = usePkHex()
  const { ready } = useStorageProvider()
  const [task, setTask] = useState<Task>('read')
  const [busy, setBusy] = useState(false)
  const [restore, setRestore] = useState<RestoreFile | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const restoreLabel = restore
    ? formatList(
        restore.gameIds.map((id) => getGameLabel(id)),
        'disjunction'
      )
    : ''

  const chooseFile = async (file: File | undefined) => {
    setRestore(null)
    setFileError(null)
    if (!file || !adapter) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      const loaded = adapter.load(bytes)
      try {
        const gameIds = gameIdsFromSave(loaded)
        if (gameIds.length === 0) {
          setFileError(
            t(
              'CartridgeSaves.isASaveRestoreSupportsRubySapphireEmeraldFireredAnd',
              { name: file.name, aggregated: loaded.version.aggregated }
            )
          )
          return
        }
        setRestore({
          name: file.name,
          bytes,
          gameIds,
        })
      } finally {
        loaded.dispose()
      }
    } catch {
      setFileError(
        t('CartridgeSaves.isnTASaveFilePkhexCanRead', { name: file.name })
      )
    }
  }

  const backUp = (
    <GbLinkTaskPanel
      key="read"
      title={t('CartridgeSaves.backUpACartridgeSave')}
      steps={[getConnectStep(), getBootStep()]}
      progressLabel={t('CartridgeSaves.readingTheSave')}
      onBusyChange={setBusy}
      describeError={describeReadError}
      run={async (task) => {
        const { bytes, cartridge } = await readFromCartridge(task, (t) =>
          gbLinkTradeDevice.readSave(t)
        )
        const name = cartridge
          ? cartridgeFileName(cartridge, 'sav')
          : 'GBA save.sav'
        downloadFile(bytes, name)
        return t('CartridgeSaves.downloaded', { name: name })
      }}
    />
  )

  const restorePanel = restore && (
    <GbLinkTaskPanel
      key={`write-${restore.name}`}
      title={t('CartridgeSaves.restore2', { name: restore.name })}
      steps={[
        getConnectStep(),
        t(
          'cartridge-saves:CartridgeSaves.insertAndPowerOnWhileHoldingStartSelect',
          { label: restoreLabel }
        ),
      ]}
      note={t(
        'cartridge-saves:CartridgeSaves.theCartridgeSCurrentSaveIsStoredFirstAsIts'
      )}

      progressLabel={t('CartridgeSaves.sendingTheSave')}
      disabled={!ready}
      onBusyChange={setBusy}
      onBeforeStart={() =>
        window.confirm(
          t('CartridgeSaves.overwriteTheSaveOnTheCartridgeWith', {
            label: restoreLabel,
            name: restore.name,
          })
        )
      }
      describeError={(cause, cancelled) =>
        restoreErrorMessage(
          cause,
          cancelled,
          t('CartridgeSaves.ifTheFirstStepFinishedItsPreviousSaveIsThat')
        )
      }
      run={async (task) => {
        let cartridgeGame: Gen3GameId = restore.gameIds[0]
        await gbLinkTradeDevice.writeSave({
          ...task,
          gameId: restore.gameIds,
          save: restore.bytes,
          // Stored as the cartridge game's hardware.sav before it is touched.
          backUpCartridgeSave: (cartridgeSave, gameId) => {
            cartridgeGame = gameId
            return storage.putHardwareSave(gameId, cartridgeSave)
          },
        })
        const label = getGameLabel(cartridgeGame)
        return t(
          'CartridgeSaves.restoredToTheCartridgeItsPreviousSaveIsTheCabin',
          { name: restore.name, label: label, label3: label }
        )
      }}
    />
  )

  return (
    <ToolPage
      label={t('CartridgeSaves.chooseATask')}
      options={getTasks()}
      value={task}
      onChange={setTask}
      disabled={busy}
      choices={
        task === 'read' ? (
          <>
            <p>
              {t('CartridgeSaves.downloadTheSaveFromAGbaCartridgeTheGameIs')}
            </p>
            <p>
              {t('CartridgeSaves.switchSaveDownloadIs')}{' '}
              <span className="lab-tag">{t('CartridgeSaves.inResearch')}</span>
            </p>
          </>
        ) : (
          <>
            <p>
              {t(
                'CartridgeSaves.chooseARubySapphireEmeraldFireredOrLeafgreenSavFile'
              )}
            </p>
            <label>
              {t('CartridgeSaves.saveFile')}
              <input
                type="file"
                accept=".sav"
                disabled={busy || !adapter}
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
            </label>
            {!adapter && <p>{t('CartridgeSaves.saveToolsAreStillLoading')}</p>}
            {fileError && <p role="status">{fileError}</p>}
            {restore && (
              <p role="status">
                {t('CartridgeSaves.isAPokeMonSave', {
                  name: restore.name,
                  label: restoreLabel,
                })}
              </p>
            )}
          </>
        )
      }
      task={
        task === 'read'
          ? backUp
          : (restorePanel ?? (
              <p>{t('CartridgeSaves.chooseASaveFileToRestore')}</p>
            ))
      }
    />
  )
}
