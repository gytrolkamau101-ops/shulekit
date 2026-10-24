import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import MainDashboard from '../components/pages/MainDashboard'
import Students from '../components/pages/Students'
import StudentFinance from '../components/pages/StudentFinance'
import Exams from '../components/pages/Exams'
import Attendance from '../components/pages/Attendance'
import SchoolFinance from '../components/pages/SchoolFinance'
import Resources from '../components/pages/Resources'
import Timetable from '../components/pages/Timetable'
import ReportCards from '../components/pages/ReportCards'
import Setup from '../components/pages/Setup'
import Messaging from '../components/pages/Messaging'
import ImportCenter from '../components/pages/ImportCenter'
import Circulars from '../components/pages/Circulars'
import Admissions from '../components/pages/Admissions'
import { flushQueue, queueCount, isOnline } from '../lib/offline'
import { toast } from '../components/ui'
import { btn } from '../components/ui'

export default function Dashboard({ session }) {
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [school, setSchool] = useState(null)
  const [term, setTerm] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadTerm = useCallback(async (schoolId) => {
    const { data } = await supabase
      .from('terms')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle()
    setTerm(data || null)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: u, error: uErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
        if (!alive) return
        if (uErr) console.warn('profile load', uErr.message)
        setUser(u || null)
        if (u && u.status === 'active' && u.school_id) {
          const { data: s } = await supabase
            .from('schools')
            .select('*')
            .eq('id', u.school_id)
            .maybeSingle()
          if (!alive) return
          setSchool(s || null)
          if (s) await loadTerm(u.school_id)
        } else {
          setSchool(null)
          setTerm(null)
        }
      } catch (e) {
        console.warn(e)
        if (alive) {
          setUser(null)
          setSchool(null)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [session, loadTerm])


  useEffect(() => {
    if (!school || !user || user.status !== 'active') return
    const sync = async () => {
      if (!isOnline() || queueCount() === 0) return
      const { ok, fail, left } = await flushQueue({
        attendance_upsert: async (payload) => {
          const { error } = await supabase.from('attendance').upsert(payload.rows, {
            onConflict: 'school_id,student_id,date',
          })
          if (error) throw error
        },
        fee_payment: async (payload) => {
          const { error } = await supabase.from('fee_payments').insert([payload])
          if (error) throw error
        },
      })
      if (ok) toast(`Synced ${ok} offline action(s)`, 'ok')
      if (fail) toast(`${fail} offline action(s) still pending`, 'warn')
    }
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [school, user])

  const logout = () => supabase.auth.signOut()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>
  }

  if (school?.is_suspended) {
    return (
      <div className="min-h-screen sk-mesh-light flex items-center justify-center p-4">
        <div className="sk-glass rounded-2xl p-6 max-w-md w-full text-center space-y-4 sk-animate-in">
          <h1 className="text-2xl font-bold text-blue-600">ShuleKit</h1>
          <p className="text-gray-700">
            This school account has been suspended by the platform. Contact BigDataKE Technologies support.
          </p>
          <button onClick={logout} className="text-red-600 underline">
            Logout
          </button>
        </div>
      </div>
    )
  }

  if (!user || user.status !== 'active') {
    return (
      <div className="min-h-screen sk-mesh-light flex items-center justify-center p-4">
        <div className="sk-glass rounded-2xl p-6 max-w-md w-full text-center space-y-4 sk-animate-in">
          <h1 className="text-2xl font-bold text-blue-600">ShuleKit</h1>
          <p className="text-gray-700">
            {!user
              ? 'Your account has no school profile yet.'
              : user.status === 'suspended'
              ? 'Your account has been suspended. Contact your Principal.'
              : 'Your account is waiting for approval. Ask your Principal or Senior Teacher to approve you under School Setup > Staff, then refresh.'}
          </p>
          <button onClick={() => window.location.reload()} className={btn}>
            Refresh
          </button>{' '}
          <button onClick={logout} className="text-red-600 underline">
            Logout
          </button>
        </div>
      </div>
    )
  }

  const props = { school, user, term }
  const go = (p) => {
    setPage(p)
    setMenuOpen(false)
  }

  return (
    <div className="flex h-screen sk-mesh-light">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} page={page} onPage={go} role={user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar school={school} user={user} term={term} onLogout={logout} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6 sk-animate-in">
          {page === 'dashboard' && <MainDashboard {...props} onNavigate={go} />}
          {page === 'students' && <Students {...props} />}
          {page === 'finance' && <StudentFinance {...props} />}
          {page === 'exams' && <Exams {...props} />}
          {page === 'attendance' && <Attendance {...props} />}
          {page === 'school-finance' && <SchoolFinance {...props} />}
          {page === 'resources' && <Resources {...props} />}
          {page === 'timetable' && <Timetable {...props} />}
          {page === 'reports' && <ReportCards {...props} />}
          {page === 'messages' && <Messaging {...props} />}
          {page === 'import' && <ImportCenter {...props} />}
          {page === 'circulars' && <Circulars {...props} />}
          {page === 'admissions' && <Admissions {...props} />}
          {page === 'setup' && <Setup {...props} onTermChange={() => loadTerm(school.id)} />}
        </main>
      </div>
    </div>
  )
}
