import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import PipeDodger from './games/PipeDodger'
import PumpkinRun from './games/PumpkinRun'
import Blackjack from './games/Blackjack'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pipe-dodger" element={<PipeDodger />} />
      <Route path="/dino-run" element={<PumpkinRun />} />
      <Route path="/blackjack" element={<Blackjack />} />
    </Routes>
  )
}
