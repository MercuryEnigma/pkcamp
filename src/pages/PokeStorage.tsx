import {
  PokeStorageMain,
  type CampDestination,
} from './pokestorage/PokeStorageMain'

export function PokeStorage({
  onUnsavedChangesChange,
  onBack,
  destination,
  onReturn,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
  onBack?: () => void
  destination?: CampDestination
  onReturn?: () => void
}) {
  return (
    <>
      <PokeStorageMain
        onUnsavedChangesChange={onUnsavedChangesChange}
        onBack={onBack}
        destination={destination}
        onReturn={onReturn}
      />
    </>
  )
}
