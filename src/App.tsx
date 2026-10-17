import { NavigationProvider } from './pages/context/NavigationProvider'
import { Campsite } from './pages/Campsite'
import { PkHexProvider } from './pages/context/PkHexProvider'

function App() {
  return (
    <PkHexProvider>
      <NavigationProvider>
        <Campsite />
      </NavigationProvider>
    </PkHexProvider>
  )
}

export default App
