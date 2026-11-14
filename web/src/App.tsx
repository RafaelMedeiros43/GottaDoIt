import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/hoje" element={<h1 className="text-2xl font-semibold">Hoje</h1>} />
      </Route>
      <Route path="*" element={<Navigate to="/hoje" replace />} />
    </Routes>
  )
}
