import { useState } from 'react'
import { canAccessModule } from '../lib/plans'

const DATA_EDITORS = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary']
const DESK_ROLES = ['Kitchen', 'Watchman', 'Matron', 'Driver', 'Staff']
const BOARDING_ROLES = [...DATA_EDITORS, 'Matron']

const BASIC_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'students', label: 'Students', icon: '👥' },
  { id: 'admissions', label: 'Admissions', icon: '📝' },
  { id: 'finance', label: 'Student fees', icon: '💵' },
  { id: 'exams', label: 'Exams', icon: '📋' },
  { id: 'reports', label: 'Report cards', icon: '📄' },
  { id: 'school-finance', label: 'School finance', icon: '📊' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'setup', label: 'School setup', icon: '⚙️' },
]

const PREMIUM_ITEMS = [
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'attendance', label: 'Attendance', icon: '✅' },
  { id: 'timetable', label: 'Timetable', icon: '🗓️' },
  { id: 'circulars', label: 'Circulars', icon: '📢' },
  { id: 'import', label: 'Import centre', icon: '📥' },
  { id: 'records', label: 'Records vault', icon: '🗂️' },
  { id: 'support', label: 'Contact Support', icon: '📞' },
  { id: 'referrals', label: 'Invite · Earn', icon: '🏆' },
]

const PRO_ITEMS = [
  { id: 'boarding', label: 'Boarding', icon: '🏠' },
  { id: 'transport', label: 'Transport', icon: '🚌' },
  { id: 'bom', label: 'BOM portal', icon: '🏛️' },
  { id: 'staff-desk', label: 'Staff desk', icon: '🛠' },
  { id: 'games', label: 'Games', icon: '⚽' },
]

function NavBtn({ item, active, locked, tone, onClick }) {
  const tones = {
    default: active
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
      : locked
        ? 'text-slate-500 bg-white/5'
        : 'text-slate-100 hover:bg-white/10',
    silver: active
      ? 'bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 text-slate-900 shadow-lg shadow-slate-400/40'
      : locked
        ? 'text-slate-500 bg-white/5'
        : 'text-slate-100 bg-slate-700/40 border border-slate-400/30 hover:border-slate-300/60 hover:bg-slate-600/40',
    gold: active
      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-950 shadow-lg shadow-amber-500/40'
      : locked
        ? 'text-slate-500 bg-white/5'
        : 'text-amber-50 bg-amber-950/40 border border-amber-500/40 hover:border-amber-400/70 hover:bg-amber-900/50',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition ${tones[tone] || tones.default}`}
    >
      <span className="text-base">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {locked && <span className="text-[9px] font-black uppercase tracking-wide opacity-80">Lock</span>}
    </button>
  )
}

function Group({ title, open, setOpen, children, tone }) {
  const head =
    tone === 'silver'
      ? 'bg-gradient-to-r from-slate-600 to-slate-500 text-white border border-slate-400/40'
      : tone === 'gold'
        ? 'bg-gradient-to-r from-amber-600 to-yellow-500 text-amber-950 border border-amber-300/50'
        : 'bg-slate-800 text-slate-200 border border-slate-600'
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider ${head}`}
      >
        {title}
        <span className="text-sm">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="mt-1.5 space-y-1">{children}</div>}
    </div>
  )
}

export default function Sidebar({ page, onPage, user, school, open, onClose }) {
  const role = user?.role || ''
  const [basicOpen, setBasicOpen] = useState(true)
  const [premOpen, setPremOpen] = useState(true)
  const [proOpen, setProOpen] = useState(true)
  const deskOnly = DESK_ROLES.includes(role) && !DATA_EDITORS.includes(role)

  const go = (id) => {
    onPage?.(id)
    onClose?.()
  }

  const body = (
    <div className="p-3 h-full overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-lg shadow-lg">🌐</div>
        <div>
          <p className="font-black text-sm leading-tight">Menu</p>
          <p className="text-[10px] text-slate-400">ShuleMoja · BigDataKE</p>
        </div>
      </div>
      {deskOnly ? (
        <NavBtn item={{ id: 'staff-desk', label: 'Staff desk', icon: '🛠' }} active={page === 'staff-desk'} tone="gold" onClick={() => go('staff-desk')} />
      ) : (
        <>
          <Group title="Core" open={basicOpen} setOpen={setBasicOpen}>
            {BASIC_ITEMS.map((item) => (
              <NavBtn key={item.id} item={item} active={page === item.id} onClick={() => go(item.id)} />
            ))}
          </Group>
          <Group title="Premium features" open={premOpen} setOpen={setPremOpen} tone="silver">
            {PREMIUM_ITEMS.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                tone="silver"
                active={page === item.id}
                locked={!canAccessModule(school, item.id)}
                onClick={() => go(item.id)}
              />
            ))}
          </Group>
          <Group title="Pro kit" open={proOpen} setOpen={setProOpen} tone="gold">
            {PRO_ITEMS.map((item) => (
              <NavBtn
                key={item.id}
                item={item}
                tone="gold"
                active={page === item.id}
                locked={!canAccessModule(school, item.id)}
                onClick={() => go(item.id)}
              />
            ))}
          </Group>
        </>
      )}
      <p className="mt-6 px-1 text-[10px] text-slate-500">ShuleMoja<br />© BigDataKE Technologies</p>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-slate-800 min-h-[calc(100vh-3.5rem)]">
        {body}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(90vw,20rem)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-end p-2 bg-slate-950">
              <button type="button" className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold" onClick={onClose}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{body}</div>
          </aside>
        </div>
      )}
    </>
  )
}
