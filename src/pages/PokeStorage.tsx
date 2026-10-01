import { PokeStorageMain } from './pokestorage/PokeStorageMain'

export function PokeStorage({
  onUnsavedChangesChange,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  return (
    <>
      <PokeStorageMain onUnsavedChangesChange={onUnsavedChangesChange} />
    </>
  )
}
