import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Pending from './pages/Pending'
import Home from './pages/Home'
import Soon from './pages/Soon'
import Lessons from './pages/Lessons'
import LessonPage from './pages/LessonPage'
import Tasks from './pages/Tasks'
import TaskPage from './pages/TaskPage'
import Applications from './pages/admin/Applications'
import Subjects from './pages/admin/Subjects'
import Users from './pages/admin/Users'

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Login />
  if (!profile || profile.status !== 'active') return <Pending />
  const admin = profile.role === 'admin'
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="darslar" element={<Lessons />} />
        <Route path="dars/:id" element={<LessonPage />} />
        <Route path="vazifalar" element={<Tasks />} />
        <Route path="vazifa/:id" element={<TaskPage />} />
        <Route path="baholar" element={<Soon title="Baholarim" />} />
        <Route path="jurnal" element={<Soon title="Jurnal" />} />
        {admin && <Route path="admin/arizalar" element={<Applications />} />}
        {admin && <Route path="admin/fanlar" element={<Subjects />} />}
        {admin && <Route path="admin/foydalanuvchilar" element={<Users />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}><Gate /></BrowserRouter>
    </AuthProvider>
  )
}
