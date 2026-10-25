import { useTranslation } from 'react-i18next'
import { useId, useRef, useState } from 'react'
import type { SkinLibraryState } from './useSkinLibrary'
import './skinManager.css'

/**
 * Pick, import, and delete controller skins. It owns no heading or frame, so
 * the Arcade's menu and the Lab's settings can each present it their way.
 */
export function SkinManager({ library }: { library: SkinLibraryState }) {
  const { t } = useTranslation(['arcade', 'common'] as const)

  const { skins, selectedId, error, importSkin, selectSkin, deleteSkin } =
    library
  const group = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  /** The skin whose Delete was pressed once and awaits confirmation. */
  const [confirming, setConfirming] = useState<string | null>(null)

  const option = (id: string | null, name: string) => (
    <label className="skin-manager-choice">
      <input
        type="radio"
        name={group}
        checked={selectedId === id}
        onChange={() => void selectSkin(id)}
      />
      <span>{name}</span>
    </label>
  )

  return (
    <div className="skin-manager">
      <ul
        className="skin-manager-list"
        aria-label={t('SkinManager.controllerSkins')}
      >
        <li>{option(null, t('common:actions.default'))}</li>
        {skins.map((skin) => (
          <li key={skin.id}>
            {option(skin.id, skin.name)}
            <button
              type="button"
              className="skin-manager-delete"
              aria-label={t('SkinManager.deleteSkinLabel', {
                value1:
                  confirming === skin.id
                    ? t('arcade:SkinManager.confirmDelete')
                    : t('common:actions.delete'),
                name: skin.name,
              })}
              onClick={() => {
                if (confirming === skin.id) {
                  setConfirming(null)
                  void deleteSkin(skin.id)
                } else setConfirming(skin.id)
              }}
              onBlur={() => setConfirming(null)}
            >
              {confirming === skin.id
                ? t('SkinManager.confirm')
                : t('common:actions.delete')}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="skin-manager-import"
        onClick={() => fileRef.current?.click()}
      >
        {t('SkinManager.importDeltaSkin')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".deltaskin,.zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importSkin(file)
        }}
      />
      <p className="skin-manager-note" role="status" data-error={!!error}>
        {error ??
          t('SkinManager.deltaDeltaskinFilesForGameBoyAdvanceSkinsAreSaved')}
      </p>
    </div>
  )
}
