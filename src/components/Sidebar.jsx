import { useState } from 'react'
import { canAccessModule } from '../lib/plans'

const DATA_EDITORS = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary']
const DESK_ROLES = ['Kitchen', 'Watchman', 'Matron', 'Driver', 'Staff']
const BOARDING_ROLES = [...DATA_EDITORS, 'Matron']
const ALL_STAFF = [...DATA_EDITORS, 'Teacher', ...DESK_ROLES]

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
  { id: 'messages', label: 'Messages', icon: '💬', premium: true },
  { id: 'attendance', label: 'Attendance', icon: '✅', premium: true },
  { id: 'timetable', label: 'Timetable', icon: '🗓️', premium: true },
  { id: 'circulars', label: 'Circulars', icon: '📢', premium: true },
  { id: 'import', label: 'Import centre', icon: '📥', premium: true },
  { id: 'records', label: 'Records vault', icon: '🗂️', premium: true },
  { id: 'support', label: 'Support', icon: '🎧', premium: true },
  { id: 'referrals', label: 'Invite · Earn', icon: '🏆', premium: true },
]

const PRO_ITEMS = [
  { id: 'boarding', label: 'Boarding', icon: '🏠', pro: true },
  { id: 'transport', label: 'Transport', icon: '🚌', pro: true },
  { id: 'bom', label: 'BOM portal', icon: '🏛️', pro: true },
  { id: 'staff-desk', label: 'Staff desk', icon: '🛠', pro: true },
  { id: 'games', label: 'Games', icon: '⚽', pro: true },
]

function roleOk(item, role) {
  if (item.id === 'staff-desk') return DESK_ROLES.includes(role) || DATA_EDITORS.includes(role)
  if (item.id === 'boarding') return BOARDING_ROLES.includes(role)
  if (item.id === 'bom') return ['Principal', 'Deputy Principal', 'Secretary'].includes(role)
  return true
}

function NavBtn({ item, active, locked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
        active ? 'bg-blue-600 text-white shadow' : locked ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span>{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {locked && <span className="text-[10px] font-black uppercase text-amber-600">Lock</span>}
    </button>
  )
}

function Group({ title, open, setOpen, children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-800',
    blue: 'bg-blue-50 text-blue-900 border border-blue-100',
    amber: 'bg-amber-50 text-amber-900 border border-amber-100',
  }
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide ${tones[tone]}`}
      >
        {title}
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="mt-1 space-y-0.5 pl-1">{children}</div>}
    </div>
  )
}

export default function Sidebar({ page, onPage, user, school, open, onClose }) {
  const role = user?.role || ''
  const [basicOpen, setBasicOpen] = useState(true)
  const [premOpen, setPremOpen] = useState(true)
  const [proOpen, setProOpen] = useState(true)

  // Staff-desk-only roles: only staff desk + logout path
  const deskOnly = DESK_ROLES.includes(role) && !DATA_EDITORS.includes(role)

  const go = (id) => {
    onPage?.(id)
    onClose?.()
  }

  const body = (
    <div className="p-3 h-full overflow-y-auto">
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1">Menu</p>
      {deskOnly ? (
        <NavBtn item={{ id: 'staff-desk', label: 'Staff desk', icon: '🛠' }} active={page === 'staff-desk'} onClick={() => go('staff-desk')} />
      ) : (
        <>
          <Group title="Core" open={basicOpen} setOpen={setBasicOpen} tone="slate">
            {BASIC_ITEMS.map((item) => (
              <NavBtn key={item.id} item={item} active={page === item.id} onClick={() => go(item.id)} />
            ))}
          </Group>
          <Group title="Premium" open={premOpen} setOpen={setPremOpen} tone="blue">
            {PREMIUM_ITEMS.map((item) => {
              const locked = !canAccessModule(school, item.id)
              return (
                <NavBtn
                  key={item.id}
                  item={item}
                  active={page === item.id}
                  locked={locked}
                  onClick={() => go(item.id)}
                />
              )
            })}
          </Group>
          <Group title="Pro kit" open={proOpen} setOpen={setProOpen} tone="amber">
            {PRO_ITEMS.map((item) => {
              const locked = !canAccessModule(school, item.id)
              return (
                <NavBtn
                  key={item.id}
                  item={item}
                  active={page === item.id}
                  locked={locked}
                  onClick={() => go(item.id)}
                />
              )
            })}
          </Group>
        </>
      )}
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-3.5rem)]">
        {body}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(88vw,20rem)] bg-white shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-black text-slate-800">Menu</span>
              <button type="button" className="text-sm font-bold text-blue-600" onClick={onClose}>
                Close
              </button>
            </div>
            {body}
          </aside>
        </div>
      )}
    </>
  )
}
