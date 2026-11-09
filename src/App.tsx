import { useEffect } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { useBle } from './hooks/useBle'
import { DevicePage } from './pages/DevicePage'
import { DeviceSettingsPage } from './pages/DeviceSettingsPage'
import { DevicesPage } from './pages/DevicesPage'
import { LabPage } from './pages/LabPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProtocolPage } from './pages/ProtocolPage'

function MainLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

function App() {
  const { manager } = useBle()

  useEffect(() => {
    void manager.initialize()
  }, [manager])

  useEffect(() => {
    const desktop = window.ankerDesktop
    if (!desktop) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') desktop.hidePanel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="app-frame">
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<DevicesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="device" element={<DevicePage />} />
        <Route path="device/settings" element={<DeviceSettingsPage />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="lab/protocol" element={<ProtocolPage />} />
        <Route path="*" element={<DevicesPage />} />
      </Routes>
    </div>
  )
}

export default App
