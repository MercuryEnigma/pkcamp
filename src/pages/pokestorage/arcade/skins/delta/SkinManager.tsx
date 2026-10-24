import { useId, useRef, useState } from 'react'
import type { SkinLibraryState } from './useSkinLibrary'
import './skinManager.css'

/**
 * Pick, import, and delete controller skins. It owns no heading or frame, so
 * the Arcade's menu and the Lab's settings can each present it their way.
 */
export function SkinManager({ library }: { library: SkinLibraryState }) {
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
      <ul className="skin-manager-list" aria-label="Controller skins">
        <li>{option(null, 'Default')}</li>
        {skins.map((skin) => (
          <li key={skin.id}>
            {option(skin.id, skin.name)}
            <button
              type="button"
              className="skin-manager-delete"
              aria-label={`${confirming === skin.id ? 'Confirm delete' : 'Delete'} ${skin.name}`}
              onClick={() => {
                if (confirming === skin.id) {
                  setConfirming(null)
                  void deleteSkin(skin.id)
                } else setConfirming(skin.id)
              }}
              onBlur={() => setConfirming(null)}
            >
              {confirming === skin.id ? 'Confirm?' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="skin-manager-import"
        onClick={() => fileRef.current?.click()}
      >
        Import Delta Skin…
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
          'Delta .deltaskin files for Game Boy Advance. Skins are saved on this device.'}
      </p>
    </div>
  )
}
