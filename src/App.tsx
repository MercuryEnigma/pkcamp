import { Campsite } from './pages/Campsite'
import { PkHexProvider } from './pages/context/PkHexProvider'

function App() {
  return (
    <PkHexProvider>
      <Campsite />
    </PkHexProvider>
  )
}

export default App
