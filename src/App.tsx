import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './pages/LoginPage'
import { Layout } from './components/Layout'
import { OverviewPage } from './pages/OverviewPage'
import { BuildingsPage } from './pages/BuildingsPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { ShipyardPage } from './pages/ShipyardPage'
import { FleetPage } from './pages/FleetPage'
import { MissionsPage } from './pages/MissionsPage'
import { GalaxyMapPage } from './pages/GalaxyMapPage'
import { ResearchPage } from './pages/ResearchPage'
import { InboxPage } from './pages/InboxPage'
import { AchievementsPage } from './pages/AchievementsPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="buildings" element={<BuildingsPage />} />
          <Route path="buildings/:buildingId" element={<BuildingsPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="shipyard" element={<ShipyardPage />} />
          <Route path="fleet" element={<FleetPage />} />
          <Route path="galaxy" element={<GalaxyMapPage />} />
          <Route path="missions" element={<MissionsPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="achievements" element={<AchievementsPage />} />
          <Route path="inbox" element={<InboxPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
