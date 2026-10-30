import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { getTheme, setTheme as persistTheme, getLang, setLang as persistLang, applyTheme } from '../lib/prefs'
import { supabase } from '../supabaseClient'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { flushQueue, queueCount, isOnline } from '../lib/offline'
import { toast, btn, Spinner } from '../components/ui'
import PremiumGate from '../components/PremiumGate'

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
const Games = lazy(() => import('../components/pages/Games'))

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
  const deskOnlyRoles = ['Kitchen', 'Watchman', 'Matron', 'Driver', 'Staff']
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
      if (!session?.user?.id) {
        setError('Session expired. Sign in again.')
        return
      }
      const { data: u, error: ue } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
      if (ue) throw ue
      if (!u) {
        setError('No staff profile found for this login. Ask the Principal to approve your account under School Setup → Staff.')
        return
      }
      setUser(u)
      if (!u.school_id) {
        setError('Your profile is not linked to a school yet.')
        setSchool(null)
        return
      }
      const [{ data: sch, error: se }, { data: terms, error: te }] = await Promise.all([
        supabase.from('schools').select('*').eq('id', u.school_id).maybeSingle(),
        supabase.from('terms').select('*').eq('school_id', u.school_id).order('year', { ascending: false }),
      ])
      if (se) throw se
      if (te) console.warn(te.message)
      if (!sch) {
        setError('School record not found. Contact Super Admin.')
        setSchool(null)
        return
      }
      setSchool(sch)
      const list = terms || []
      const cur = list.find((t) => t.is_current) || list[0] || null
      setTerm(cur)
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return
      const n = queueCount()
      if (n > 0) {
        const r = await flushQueue({})
        if (r.flushed) toast(`Synced ${r.flushed} offline item(s)`, 'ok')
        else if (r.left) console.info('Offline queue items waiting for handlers', r.left)
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

  // Hooks must run every render — never after early returns (React #310)
  const isDeskOnly = !!(
    user &&
    deskOnlyRoles.includes(user.role) &&
    !['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary', 'Teacher'].includes(user.role)
  )
  useEffect(() => {
    if (isDeskOnly && page !== 'staff-desk') setPage('staff-desk')
  }, [isDeskOnly, page])

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
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full text-center space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-lg font-black text-slate-900">Could not open dashboard</p>
          <p className="text-red-600 text-sm font-semibold">{error || 'School profile missing'}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button type="button" className={btn} onClick={() => load()}>
              Try again
            </button>
            <button type="button" className={btn} onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    )
  }

  const props = { school, user, term, onTermChange: setTerm, session }

  return (
    <div className={`min-h-screen flex bg-slate-50 sm-app-shell theme-root`} data-theme={theme}>
      <Sidebar school={school} user={user} open={menuOpen} onClose={() => setMenuOpen(false)} page={page} onPage={go} />
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
            {page === 'games' && (
              <PremiumGate school={school} moduleName="games">
                <Games {...props} />
              </PremiumGate>
            )}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
