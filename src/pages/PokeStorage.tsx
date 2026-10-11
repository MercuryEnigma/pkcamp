import { PokeStorageMain } from './pokestorage/PokeStorageMain'

export function PokeStorage({
  onUnsavedChangesChange,
  onBack,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
  onBack?: () => void
}) {
  return (
    <>
      <PokeStorageMain
        onUnsavedChangesChange={onUnsavedChangesChange}
        onBack={onBack}
      />
    </>
  )
}
