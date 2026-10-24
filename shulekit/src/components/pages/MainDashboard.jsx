import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, NeedTerm, fmt, StatPill } from '../ui'

import { ADMIN, FINANCE_ROLES, EXAM_ROLES } from '../../lib/roles'

export default function MainDashboard({ user, school, term, onNavigate }) {
  const [stats, setStats] = useState({ total: 0, girls: 0, boys: 0, collected: 0, expenses: 0 })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data: students } = await supabase
        .from('students')
        .select('gender')
        .eq('school_id', school.id)
        .eq('status', 'Active')

      let collected = 0
      let expenses = 0
      if (term) {
        if (FINANCE_ROLES.includes(user.role)) {
          const { data: payments } = await supabase
            .from('fee_payments')
            .select('amount_paid')
            .eq('school_id', school.id)
            .eq('term_id', term.id)
          collected = (payments || []).reduce((s, p) => s + Number(p.amount_paid), 0)
        }
        if (ADMIN.includes(user.role)) {
          const { data: exp } = await supabase
            .from('expenses')
            .select('amount')
            .eq('school_id', school.id)
            .eq('term_id', term.id)
          expenses = (exp || []).reduce((s, e) => s + Number(e.amount), 0)
        }
      }

      const { data: upcoming } = await supabase
        .from('school_events')
        .select('*')
        .eq('school_id', school.id)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date')
        .limit(5)

      if (!alive) return
      const list = students || []
      setStats({
        total: list.length,
        girls: list.filter((s) => s.gender === 'Female').length,
        boys: list.filter((s) => s.gender === 'Male').length,
        collected,
        expenses,
      })
      setEvents(upcoming || [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [school, term, user.role])


  const canFinance = FINANCE_ROLES.includes(user.role)
  const canExams = EXAM_ROLES.includes(user.role)
  const canSchoolFinance = ADMIN.includes(user.role)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 shadow-xl shadow-blue-900/20">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-6 -bottom-10 w-32 h-32 rounded-full bg-cyan-300/20 blur-2xl" />
        <p className="text-blue-100 text-sm font-semibold relative">Welcome back</p>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight relative mt-1">{user.full_name}</h1>
        <p className="text-cyan-100 mt-1 relative font-medium">{school?.school_name}</p>
      </div>

      {!term && <NeedTerm />}

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : (
        <>
          
      {['Principal', 'Deputy Principal', 'Senior Teacher'].includes(user.role) && (
        <Card title="School setup checklist">
          <ul className="text-sm space-y-2">
            <li className="flex justify-between gap-2"><span>Current term set</span>
              <button type="button" className="text-blue-600 font-semibold" onClick={() => onNavigate?.('setup')}>{term ? '✓ Done' : 'Fix'}</button></li>
            <li className="flex justify-between gap-2"><span>Grades / subjects / baskets</span>
              <button type="button" className="text-blue-600 font-semibold" onClick={() => onNavigate?.('setup')}>Open Setup</button></li>
            <li className="flex justify-between gap-2"><span>Fee structure</span>
              <button type="button" className="text-blue-600 font-semibold" onClick={() => onNavigate?.('setup')}>Open Setup</button></li>
            <li className="flex justify-between gap-2"><span>Add students</span>
              <button type="button" className="text-blue-600 font-semibold" onClick={() => onNavigate?.('students')}>Students</button></li>
            <li className="flex justify-between gap-2"><span>Import Excel/CSV</span>
              <button type="button" className="text-blue-600 font-semibold" onClick={() => onNavigate?.('import')}>Import</button></li>
          </ul>
        </Card>
      )}
<div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatPill label="Students" value={stats.total} tone="blue" />
            <StatPill label="Girls" value={stats.girls} tone="pink" />
            <StatPill label="Boys" value={stats.boys} tone="violet" />
            {canFinance && (
              <StatPill label="Fees collected (term)" value={`KES ${fmt(stats.collected)}`} tone="green" />
            )}
            {canSchoolFinance && (
              <StatPill label="Expenses (term)" value={`KES ${fmt(stats.expenses)}`} tone="red" />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Quick actions">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate('students')}
                  className="p-4 rounded-xl font-bold text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:shadow-md transition text-left"
                >
                  Students
                </button>
                {canFinance && (
                  <button
                    onClick={() => onNavigate('finance')}
                    className="p-4 rounded-xl font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 hover:shadow-md transition text-left"
                  >
                    Record fees
                  </button>
                )}
                {canExams && (
                  <button
                    onClick={() => onNavigate('exams')}
                    className="p-4 rounded-xl font-bold text-violet-700 bg-violet-50 border border-violet-100 hover:bg-violet-100 hover:shadow-md transition text-left"
                  >
                    Exams
                  </button>
                )}
                {canSchoolFinance && (
                  <button
                    onClick={() => onNavigate('school-finance')}
                    className="p-4 rounded-xl font-bold text-orange-700 bg-orange-50 border border-orange-100 hover:bg-orange-100 hover:shadow-md transition text-left"
                  >
                    Expenses
                  </button>
                )}
              </div>
            </Card>

            <Card title="Upcoming events">
              {events.length === 0 ? (
                <p className="text-gray-500 text-sm">No upcoming events</p>
              ) : (
                <ul className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="border-l-4 border-blue-500 pl-3">
                      <p className="font-semibold text-gray-800">{e.event_name}</p>
                      <p className="text-xs text-gray-600">
                        {new Date(e.event_date).toLocaleDateString('en-GB')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
