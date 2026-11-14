import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { InboxPage } from '@/features/tasks/InboxPage'
import { TodayPage } from '@/features/tasks/TodayPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route path="/caixa-de-entrada" element={<InboxPage />} />
        <Route path="/hoje" element={<TodayPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/hoje" replace />} />
    </Routes>
  )
}
