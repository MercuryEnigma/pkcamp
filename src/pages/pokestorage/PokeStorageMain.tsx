import { usePkHex } from '../context/PkHexProvider'
import { useState } from 'react'

export function PokeStorageMain() {
  const { pkhex, loading } = usePkHex()
  const [game, setGame] = useState(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pkhex) return

    const bytes = await file.arrayBuffer()
    const save = pkhex.load(new Uint8Array(bytes))
    setGame(save)
  }

  if (loading) return <div>Loading PKHeX...</div>

  return (
    <div>
      <h1>Switch trading coming soon...</h1>
      <h2>Pokémon Storage</h2>
      <input type="file" accept=".sav" onChange={handleFileUpload} />
      {game && <div>Save loaded! Party has {game.party().length} Pokémon</div>}
    </div>
  )
}
