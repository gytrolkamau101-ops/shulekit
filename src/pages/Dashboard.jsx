import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { getTheme, setTheme as persistTheme, getLang, setLang as persistLang, applyTheme } from '../lib/prefs'
import { supabase } from '../supabaseClient'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { flushQueue, queueCount, isOnline } from '../lib/offline'
import { toast, btn, Spinner } from '../components/ui'
import PremiumGate from '../components/PremiumGate'
import { PremiumSupportFab } from '../components/PremiumSupport'

const MainDashboard = lazy(() => import('../components/pages/MainDashboard'))
const Students = lazy(() => import('../components/pages/Students'))
const StudentFinance = lazy(() => import('../components/pages/StudentFinance'))
const Exams = lazy(() => import('../components/pages/Exams'))
const Attendance = lazy(() => import('../components/pages/Attendance'))
const SchoolFinance = lazy(() => import('../components/pages/SchoolFinance'))
const Resources = lazy(() => import('../components/pages/Resources'))
const Timetable = lazy(() => import('../components/pages/Timetable'))
const ReportCards = lazy(() => import('../components/pages/ReportCards'))
const Setup = lazy(() => import('../components/pages/Setup'))
const Messaging = lazy(() => import('../components/pages/Messaging'))
const ImportCenter = lazy(() => import('../components/pages/ImportCenter'))
const Circulars = lazy(() => import('../components/pages/Circulars'))
const Admissions = lazy(() => import('../components/pages/Admissions'))
const SupportCenter = lazy(() => import('../components/pages/SupportCenter'))
const ReferralsCenter = lazy(() => import('../components/pages/ReferralsCenter'))
const Boarding = lazy(() => import('../components/pages/Boarding'))
const Transport = lazy(() => import('../components/pages/Transport'))
const BomPortal = lazy(() => import('../components/pages/BomPortal'))
const RecordsVault = lazy(() => import('../components/pages/RecordsVault'))
const StaffDesk = lazy(() => import('../components/pages/StaffDesk'))

function PageFallback() {
  return (
    // themed shell
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner dark />
      <p className="text-sm text-slate-500 font-medium">Loading page…</p>
    </div>
  )
}

export default function Dashboard({ session }) {
  const [user, setUser] = useState(null)
  const [school, setSchool] = useState(null)
  const [term, setTerm] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setThemeState] = useState(() => getTheme())
  const [lang, setLangState] = useState(() => getLang())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const changeTheme = (th) => {
    setThemeState(th)
    persistTheme(th)
  }
  const changeLang = (l) => {
    setLangState(l)
    persistLang(l)
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: u, error: ue } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle()
      if (ue) throw ue
      if (!u) {
        setError('No staff profile found.')
        setLoading(false)
        return
      }
      setUser(u)
      const [{ data: sch }, { data: terms }] = await Promise.all([
        supabase.from('schools').select('*').eq('id', u.school_id).maybeSingle(),
        supabase.from('terms').select('*').eq('school_id', u.school_id).order('year', { ascending: false }),
      ])
      setSchool(sch)
      const cur = (terms || []).find((t) => t.is_current) || (terms || [])[0] || null
      setTerm(cur)
    } catch (e) {
      setError(e?.message || 'Failed to load')
    }
    setLoading(false)
  }, [session.user.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return
      const n = queueCount()
      if (n > 0) {
        const r = await flushQueue(supabase)
        if (r.flushed) toast(`Synced ${r.flushed} offline item(s)`, 'ok')
      }
    }
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [])

  const logout = () => supabase.auth.signOut()
  const go = (p) => {
    setPage(p)
    setMenuOpen(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen sk-mesh-light flex flex-col items-center justify-center gap-3 sm-app-shell">
        <Spinner dark />
        <p className="text-slate-600 text-sm">Loading school…</p>
      </div>
    )
  }

  if (error || !user || !school) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-red-600 font-semibold">{error || 'School profile missing'}</p>
          <button type="button" className={btn} onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    )
  }

  const props = { school, user, term, onTermChange: setTerm, session }

  return (
    <div className={`min-h-screen flex bg-slate-50 sm-app-shell theme-root`} data-theme={theme}>
      <Sidebar school={school} open={menuOpen} onClose={() => setMenuOpen(false)} page={page} onPage={go} role={user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar school={school} user={user} term={term} page={page} onLogout={logout} onMenu={() => setMenuOpen(true)} lang={lang} theme={theme} onTheme={changeTheme} onLang={changeLang} />
        <main className="flex-1 p-3 md:p-6 overflow-auto">
          <Suspense fallback={<PageFallback />}>
            {page === 'dashboard' && <MainDashboard {...props} onPage={go} onNavigate={go} lang={lang} />}
            {page === 'students' && <Students {...props} />}
            {page === 'admissions' && <Admissions {...props} />}
            {page === 'finance' && <StudentFinance {...props} />}
            {page === 'exams' && <Exams {...props} />}
            {page === 'reports' && <ReportCards {...props} />}
            {page === 'school-finance' && <SchoolFinance {...props} />}
            {page === 'resources' && <Resources {...props} />}
            {page === 'setup' && <Setup {...props} />}
            {page === 'attendance' && (
              <PremiumGate school={school} moduleName="attendance">
                <Attendance {...props} />
              </PremiumGate>
            )}
            {page === 'timetable' && (
              <PremiumGate school={school} moduleName="timetable">
                <Timetable {...props} />
              </PremiumGate>
            )}
            {page === 'messages' && (
              <PremiumGate school={school} moduleName="messages">
                <Messaging {...props} />
              </PremiumGate>
            )}
            {page === 'import' && (
              <PremiumGate school={school} moduleName="import">
                <ImportCenter {...props} />
              </PremiumGate>
            )}
            {page === 'circulars' && (
              <PremiumGate school={school} moduleName="circulars">
                <Circulars {...props} />
              </PremiumGate>
            )}
            {page === 'support' && (
              <PremiumGate school={school} moduleName="support">
                <SupportCenter {...props} lang={lang} />
              </PremiumGate>
            )}
            {page === 'referrals' && (
              <PremiumGate school={school} moduleName="referrals">
                <ReferralsCenter {...props} lang={lang} />
              </PremiumGate>
            )}
            {page === 'boarding' && (
              <PremiumGate school={school} moduleName="boarding">
                <Boarding {...props} />
              </PremiumGate>
            )}
            {page === 'transport' && (
              <PremiumGate school={school} moduleName="transport">
                <Transport {...props} />
              </PremiumGate>
            )}
            {page === 'bom' && (
              <PremiumGate school={school} moduleName="bom">
                <BomPortal {...props} />
              </PremiumGate>
            )}
            {page === 'records' && (
              <PremiumGate school={school} moduleName="records">
                <RecordsVault {...props} />
              </PremiumGate>
            )}
            {page === 'staff-desk' && (
              <PremiumGate school={school} moduleName="staff-desk">
                <StaffDesk {...props} />
              </PremiumGate>
            )}
          </Suspense>
        </main>
        <PremiumSupportFab school={school} user={user} />
      </div>
    </div>
  )
}
