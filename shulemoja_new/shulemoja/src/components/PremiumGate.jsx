import { planEntitlements, isPremium } from '../lib/plans'

export default function PremiumGate({ school, moduleName, children }) {
  const e = planEntitlements(school)
  let ok = true
  if (moduleName === 'messages') ok = !!e.messages
  else if (moduleName === 'attendance') ok = !!e.attendance
  else if (moduleName === 'timetable') ok = !!e.timetable
  else if (moduleName === 'circulars') ok = !!e.circulars
  else if (moduleName === 'import') ok = !!e.import
  else if (moduleName === 'support' || moduleName === 'referrals') ok = isPremium(school)

  if (ok) return children

  return (
    <div className="max-w-lg mx-auto mt-8 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 space-y-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Premium feature</p>
      <h2 className="text-2xl font-black text-slate-900">{moduleNameLabel(moduleName)}</h2>
      <p className="text-sm text-slate-700">
        This module is included on the <strong>Premium</strong> plan. Your school is on{' '}
        <strong>{(e.planId || 'basic').toUpperCase()}</strong>
        {e.expired ? ' (expired)' : ''}.
      </p>
      <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
        <li>Messages, Attendance, Timetable, Circulars, Import</li>
        <li>Contact Support &amp; Invite · Earn tracking</li>
        <li>Upgrade from Login → Subscribe</li>
      </ul>
    </div>
  )
}

function moduleNameLabel(id) {
  const map = {
    messages: 'Messages',
    attendance: 'Attendance',
    timetable: 'Timetable',
    circulars: 'Circulars',
    import: 'Import centre',
    support: 'Contact Support',
    referrals: 'Invite · Earn',
  }
  return map[id] || id
}
