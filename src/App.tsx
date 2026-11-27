import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Pending from './pages/Pending'
import Home from './pages/Home'
import Journal from './pages/Journal'
import Grades from './pages/Grades'
import Lessons from './pages/Lessons'
import LessonPage from './pages/LessonPage'
import Tasks from './pages/Tasks'
import TaskPage from './pages/TaskPage'
import Applications from './pages/admin/Applications'
import Subjects from './pages/admin/Subjects'
import Users from './pages/admin/Users'
import Ratings from './pages/admin/Ratings'
import CourseTemplate from './pages/admin/CourseTemplate'
import ParentHome from './pages/parent/ParentHome'
import ChildPage from './pages/parent/ChildPage'
import ParentFeedback from './pages/parent/ParentFeedback'

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return (
    <Routes>
      <Route path="/kirish" element={<Login />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  )
  if (!profile || profile.status !== 'active') return <Pending />
  const admin = profile.role === 'admin'
  if (profile.role === 'parent') return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ParentHome />} />
        <Route path="farzand/:id" element={<ChildPage />} />
        <Route path="fikr" element={<ParentFeedback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="darslar" element={<Lessons />} />
        <Route path="dars/:id" element={<LessonPage />} />
        <Route path="vazifalar" element={<Tasks />} />
        <Route path="vazifa/:id" element={<TaskPage />} />
        <Route path="baholar" element={<Grades />} />
        <Route path="jurnal" element={<Journal />} />
        {admin && <Route path="admin/arizalar" element={<Applications />} />}
        {admin && <Route path="admin/fanlar" element={<Subjects />} />}
        {admin && <Route path="admin/foydalanuvchilar" element={<Users />} />}
        {admin && <Route path="admin/reyting" element={<Ratings />} />}
        {admin && <Route path="admin/kurs" element={<CourseTemplate />} />}
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
