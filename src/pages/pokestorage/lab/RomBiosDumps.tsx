import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import { useState } from 'react'
import {
  gen3GameIdFromCode,
  type Gen3GameId,
} from '../../../services/saveLibrary'
import { storage } from '../../../services/storage'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { getGameLabel } from '../gameDisplay'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import {
  getBootStep,
  getConnectStep,
  readFromCartridge,
  taskErrorMessage,
} from '../gbLinkTask'
import { cartridgeFileName, downloadFile } from './downloadFile'
import { ToolPage } from './ToolPage'

type DumpTask = 'rom' | 'bios'

const getTasks = () =>
  [
    ['rom', i18n.t('rom-bios-dumps:RomBiosDumps.romDump')],
    ['bios', i18n.t('rom-bios-dumps:RomBiosDumps.biosDump')],
  ] as const

interface RomDump {
  bytes: Uint8Array
  name: string
  /** The Gen 3 game the cartridge is, if it is one. */
  gameId: Gen3GameId | null
}

const getDumperror = () =>
  taskErrorMessage({
    fallback: i18n.t('rom-bios-dumps:RomBiosDumps.theDumpFailedTryAgain'),
  })

/** Downloads a GBA cartridge ROM or the GBA BIOS over GB-Link. */
export function RomBiosDumps() {
  const { t } = useTranslation(['rom-bios-dumps', 'common'] as const)

  const [task, setTask] = useState<DumpTask>('rom')
  const [busy, setBusy] = useState(false)
  const [dump, setDump] = useState<RomDump | null>(null)
  const [stored, setStored] = useState<string | null>(null)

  const backUpToStorage = async (bytes: Uint8Array, gameId: Gen3GameId) => {
    try {
      await storage.putRom(gameId, { bytes, extension: 'gba' })
      setStored(
        t('RomBiosDumps.savedAsTheRom', { value1: getGameLabel(gameId) })
      )
    } catch (cause) {
      setStored(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <ToolPage
      label={t('RomBiosDumps.chooseATask')}
      options={getTasks()}
      value={task}
      onChange={setTask}
      disabled={busy}
      choices={
        task === 'rom' ? (
          <>
            <p>{t('RomBiosDumps.downloadTheRomOfAnyGbaCartridgeTheGameIs')}</p>
            {dump && (
              <>
                <p role="status">
                  {t('RomBiosDumps.dumped', { name: dump.name })}
                </p>
                <button
                  type="button"
                  className="camp-upload-btn"
                  onClick={() => downloadFile(dump.bytes, dump.name)}
                >
                  {t('common:actions.download')}
                </button>
                {dump.gameId && (
                  <button
                    type="button"
                    className="camp-upload-btn"
                    onClick={() =>
                      void backUpToStorage(dump.bytes, dump.gameId!)
                    }
                  >
                    {t('RomBiosDumps.backUpToStorageForTheArcade')}
                  </button>
                )}
                {stored && <p role="status">{stored}</p>}
              </>
            )}
          </>
        ) : (
          <>
            <p>{t('RomBiosDumps.downloadThe16KbBiosFromYourGba')}</p>
            <p>
              {t('RomBiosDumps.downloadsStayOnYourComputerAndAreNeverSynced')}
            </p>
          </>
        )
      }
      task={
        task === 'rom' ? (
          <GbLinkTaskPanel
            key="rom"
            title={t('rom-bios-dumps:RomBiosDumps.dumpRom')}
            steps={[getConnectStep(), getBootStep()]}
            progressLabel={t('RomBiosDumps.readingRom')}
            onBusyChange={setBusy}
            describeError={getDumperror()}
            run={async (task) => {
              setDump(null)
              setStored(null)
              const { bytes, cartridge } = await readFromCartridge(task, (t) =>
                gbLinkTradeDevice.readRom(t)
              )
              const name = cartridge
                ? cartridgeFileName(cartridge, 'gba')
                : 'GBA ROM.gba'
              setDump({
                bytes,
                name,
                gameId: cartridge ? gen3GameIdFromCode(cartridge.code) : null,
              })
              return t('RomBiosDumps.dumped', { name: name })
            }}
          />
        ) : (
          <GbLinkTaskPanel
            key="bios"
            title={t('rom-bios-dumps:RomBiosDumps.dumpBios')}
            steps={[
              getConnectStep(),
              t('rom-bios-dumps:RomBiosDumps.biosBootStep'),
            ]}
            progressLabel={t('RomBiosDumps.readingBios')}
            onBusyChange={setBusy}
            describeError={getDumperror()}
            run={async (dump) => {
              const bytes = await gbLinkTradeDevice.readBios(dump)
              downloadFile(bytes, 'gba_bios.bin')
              return t('RomBiosDumps.downloadedGbaBiosBin')
            }}
          />
        )
      }
    />
  )
}
