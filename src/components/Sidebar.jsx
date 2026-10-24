import { ALL_STAFF, ADMIN, FINANCE_ROLES, EXAM_ROLES } from '../lib/roles'

const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▣', roles: ALL_STAFF },
  { id: 'students', label: 'Students', icon: '◎', roles: ALL_STAFF },
  { id: 'import', label: 'Import centre', icon: '⇩', roles: [...ADMIN, 'Secretary'] },
  { id: 'admissions', label: 'Admissions', icon: '＋', roles: [...ADMIN, 'Secretary'] },
  { id: 'circulars', label: 'Circulars', icon: '✉', roles: ALL_STAFF },
  { id: 'finance', label: 'Student Finance', icon: '₵', roles: FINANCE_ROLES },
  { id: 'exams', label: 'Examinations', icon: '✎', roles: EXAM_ROLES },
  { id: 'reports', label: 'Report Cards', icon: '☰', roles: EXAM_ROLES },
  { id: 'attendance', label: 'Attendance', icon: '✓', roles: ALL_STAFF },
  { id: 'timetable', label: 'Timetable', icon: '▦', roles: ALL_STAFF },
  { id: 'school-finance', label: 'School Finance', icon: '◈', roles: ADMIN },
  { id: 'resources', label: 'Resources', icon: '▤', roles: [...ADMIN, 'Secretary'] },
  { id: 'messages', label: 'Messages', icon: '✉', roles: [...ADMIN, 'Secretary'] },
  { id: 'setup', label: 'School Setup', icon: '⚙', roles: ADMIN },
]

export default function Sidebar({ open, onClose, page, onPage, role }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20 md:hidden sk-backdrop-in" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 flex flex-col bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white shadow-2xl transform transition-transform duration-300 ease-out md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black text-sm shadow-lg shadow-blue-500/30">
              SK
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">ShuleKit</h1>
              <p className="text-[11px] text-cyan-300/80 font-medium">BigDataKE Technologies</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto sk-scroll">
          {ITEMS.filter((i) => i.roles.includes(role)).map((i) => {
            const active = page === i.id
            return (
              <button
                key={i.id}
                onClick={() => onPage(i.id)}
                className={`w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl font-semibold text-sm transition ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${active ? 'bg-white/20' : 'bg-white/5'}`}>
                  {i.icon}
                </span>
                {i.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
          <span className="text-slate-300 font-semibold">ShuleKit</span>
          <br />© BigDataKE Technologies
        </div>
      </aside>
    </>
  )
}
