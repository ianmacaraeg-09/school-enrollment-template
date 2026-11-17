import { Navigate, Route, Routes } from 'react-router-dom'
import { useData } from './core/DataContext.tsx'
import Dashboard from './features/Dashboard.tsx'
import ApplicationsList from './features/ApplicationsList.tsx'
import ApplicationEditor from './features/ApplicationEditor.tsx'
import ApplicationDetail from './features/ApplicationDetail.tsx'
import Landing from './features/Landing.tsx'
import PublicApply from './features/PublicApply.tsx'
import Track from './features/Track.tsx'
import Sections from './features/Sections.tsx'
import Payments from './features/Payments.tsx'
import Reports from './features/Reports.tsx'
import Settings from './features/Settings.tsx'
import { AdminLayout, Guard, PublicLayout } from './ui/Layout.tsx'

export default function App() {
  const { ready, config } = useData()
  if (!ready) return <div className="boot">Loading…</div>
  return (
    <Routes>
      {/* Public website */}
      <Route path="/" element={<Landing />} />
      <Route element={<PublicLayout />}>
        <Route path="/apply" element={config.rules.onlineApplication ? <PublicApply /> : <Navigate to="/" replace />} />
        <Route path="/track" element={config.rules.onlineApplication ? <Track /> : <Navigate to="/" replace />} />
      </Route>
      {/* Staff system */}
      <Route path="/app" element={<AdminLayout />}>
        <Route index element={<Guard perm="applications.view"><Dashboard /></Guard>} />
        <Route path="applications" element={<Guard perm="applications.view"><ApplicationsList /></Guard>} />
        <Route path="applications/new" element={<Guard perm="applications.edit"><ApplicationEditor /></Guard>} />
        <Route path="applications/:id" element={<Guard perm="applications.view"><ApplicationDetail /></Guard>} />
        <Route path="applications/:id/edit" element={<Guard perm="applications.edit"><ApplicationEditor /></Guard>} />
        <Route path="sections" element={<Guard perm="applications.view"><Sections /></Guard>} />
        <Route path="payments" element={<Guard perm="payments.view"><Payments /></Guard>} />
        <Route path="reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
        <Route path="settings" element={<Guard perm="settings.edit"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
