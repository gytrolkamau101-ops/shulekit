import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { payWithIntaSend, intasendConfig } from '../lib/intasend'
import { Card, Scroll, Alert, input, btn, btnGreen, th, td, toast, Spinner } from '../components/ui'

export default function SuperAdmin({ session }) {
  const [admin, setAdmin] = useState(null)
  const [schools, setSchools] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [billSchool, setBillSchool] = useState('')
  const [billAmount, setBillAmount] = useState('5000')
  const [billing, setBilling] = useState(false)
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState('overview')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: me } = await supabase
      .from('platform_admins')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    setAdmin(me)
    if (!me) {
      setLoading(false)
      return
    }
    const [{ data: sch }, { data: aud }] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setSchools(sch || [])
    setEvents(aud || [])
    setLoading(false)
  }, [session.user.id])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const suspended = schools.filter((s) => s.is_suspended).length
    const paid = schools.filter((s) => s.plan && s.plan !== 'free' && s.plan !== 'trial').length
    const trial = schools.filter((s) => s.plan === 'trial' || s.plan === 'free' || !s.plan).length
    return { total: schools.length, suspended, paid, trial, audit: events.length }
  }, [schools, events])

  const filtered = schools.filter(
    (s) =>
      !filter ||
      (s.school_name || '').toLowerCase().includes(filter.toLowerCase()) ||
      (s.school_code || '').toLowerCase().includes(filter.toLowerCase())
  )

  const toggleSuspend = async (s) => {
    setError('')
    const { error } = await supabase.from('schools').update({ is_suspended: !s.is_suspended }).eq('id', s.id)
    if (error) return setError(error.message)
    try {
      await supabase.rpc('log_audit', {
        p_action: s.is_suspended ? 'school.unsuspend' : 'school.suspend',
        p_entity: 'schools',
        p_entity_id: s.id,
        p_detail: {},
        p_school_id: s.id,
      })
    } catch (_) {}
    load()
  }

  const setPlan = async (s, plan) => {
    setError('')
    const { error } = await supabase.from('schools').update({ plan }).eq('id', s.id)
    if (error) return setError(error.message)
    load()
  }

  const setExpiry = async (s, days) => {
    setError('')
    const d = new Date()
    d.setDate(d.getDate() + Number(days))
    const { error } = await supabase
      .from('schools')
      .update({ plan_expires_at: d.toISOString(), plan: s.plan && s.plan !== 'free' ? s.plan : 'basic' })
      .eq('id', s.id)
    if (error) return setError(error.message)
    toast(`Extended ${s.school_name} by ${days} days`, 'ok')
    load()
  }

  const logout = () => supabase.auth.signOut()
  const cfg = intasendConfig()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-slate-400 text-sm">Loading command centre…</p>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md text-center space-y-4">
          <h1 className="text-2xl font-black text-white">ShuleKit</h1>
          <p className="text-slate-400 text-sm">This account is not a platform admin.</p>
          <button onClick={logout} className={btn}>
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero bar */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-950 opacity-90" />
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative px-4 md:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cyan-200/90 text-xs font-bold tracking-widest uppercase">Platform command centre</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">ShuleKit</h1>
            <p className="text-sm text-blue-100/80 mt-0.5">
              {admin.full_name || session.user.email} · BigDataKE Technologies
            </p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold"
          >
            Logout
          </button>
        </div>
        <div className="relative px-4 md:px-8 pb-4 flex gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'schools', label: 'Schools' },
            { id: 'billing', label: 'Billing' },
            { id: 'audit', label: 'Audit' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
                tab === t.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 space-y-6 max-w-6xl mx-auto">
        <Alert>{error}</Alert>

        {(tab === 'overview' || tab === 'schools') && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Schools', value: stats.total, tone: 'from-blue-500 to-cyan-500' },
              { label: 'Paid plans', value: stats.paid, tone: 'from-emerald-500 to-teal-600' },
              { label: 'Trial / free', value: stats.trial, tone: 'from-amber-500 to-orange-600' },
              { label: 'Suspended', value: stats.suspended, tone: 'from-rose-500 to-red-600' },
            ].map((x) => (
              <div
                key={x.label}
                className={`rounded-2xl p-4 bg-gradient-to-br ${x.tone} shadow-lg shadow-black/30`}
              >
                <p className="text-xs font-semibold text-white/85 uppercase tracking-wide">{x.label}</p>
                <p className="text-3xl font-black mt-1">{x.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="font-bold text-lg mb-3">Recent schools</h2>
              <ul className="space-y-2">
                {schools.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex justify-between text-sm gap-2 border-b border-slate-800 pb-2">
                    <span className="font-medium truncate">{s.school_name}</span>
                    <span className="text-slate-400 shrink-0">{s.plan || 'free'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <h2 className="font-bold text-lg mb-3">Live pulse</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                You control every school on the network: plans, suspension, billing, and audit trail. Paid
                plans: <strong className="text-emerald-400">{stats.paid}</strong> · Open issues in audit:{' '}
                <strong className="text-cyan-400">{stats.audit}</strong> recent events.
              </p>
              <button type="button" className={`${btnGreen} mt-4`} onClick={() => setTab('billing')}>
                Collect subscription
              </button>
            </div>
          </div>
        )}

        {tab === 'schools' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <input
                className={`${input} bg-slate-950 border-slate-700 text-white`}
                placeholder="Filter by name or code…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <Scroll>
              <table className="w-full">
                <thead className="bg-slate-950/80">
                  <tr>
                    <th className={`${th} bg-transparent text-slate-400`}>School</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Code</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Plan</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Status</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-slate-800">
                      <td className={`${td} text-white font-medium`}>{s.school_name}</td>
                      <td className={`${td} text-cyan-400 font-mono text-xs`}>{s.school_code}</td>
                      <td className={td}>
                        <select
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm"
                          value={s.plan || 'free'}
                          onChange={(e) => setPlan(s, e.target.value)}
                        >
                          <option value="free">free</option>
                          <option value="trial">trial</option>
                          <option value="basic">basic</option>
                          <option value="pro">pro</option>
                        </select>
                      </td>
                      <td className={td}>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            s.is_suspended ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {s.is_suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className={`${td} space-y-1`}>
                        <button
                          type="button"
                          onClick={() => toggleSuspend(s)}
                          className="block text-sm text-blue-400 hover:underline"
                        >
                          {s.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button type="button" onClick={() => setExpiry(s, 90)} className="block text-xs text-emerald-400 hover:underline">
                          +90 days
                        </button>
                        <button type="button" onClick={() => setExpiry(s, 365)} className="block text-xs text-emerald-400 hover:underline">
                          +1 year
                        </button>
                        {s.plan_expires_at && (
                          <span className="block text-[10px] text-slate-500">
                            Exp {new Date(s.plan_expires_at).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </div>
        )}

        {tab === 'billing' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <h2 className="text-xl font-black">ShuleKit subscription</h2>
            <p className="text-sm text-slate-400">
              Publishable key only. Secret key stays on IntaSend. After payment, extend plan days for the school.
            </p>
            <p className="text-xs font-mono text-cyan-400/90">
              Config:{' '}
              {cfg.publicKey ? (cfg.live ? 'LIVE key loaded' : 'SANDBOX key loaded') : 'No VITE_INTASEND_PUBLIC_KEY in .env'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                className={`${input} bg-slate-950 border-slate-700 text-white`}
                value={billSchool}
                onChange={(e) => setBillSchool(e.target.value)}
              >
                <option value="">School to bill</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.school_name}
                  </option>
                ))}
              </select>
              <input
                className={`${input} bg-slate-950 border-slate-700 text-white`}
                type="number"
                min="1"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
              />
              <button
                type="button"
                disabled={billing}
                className={btn}
                onClick={async () => {
                  if (!billSchool) return setError('Pick a school')
                  setBilling(true)
                  setError('')
                  try {
                    await payWithIntaSend({
                      amount: Number(billAmount) || 5000,
                      email: session.user.email,
                      apiRef: `shulekit-${billSchool}-${Date.now()}`,
                      comment: 'ShuleKit subscription',
                      onComplete: async () => {
                        toast('Payment complete', 'ok')
                        const d = new Date()
                        d.setDate(d.getDate() + 90)
                        await supabase
                          .from('schools')
                          .update({ plan_expires_at: d.toISOString(), plan: 'basic' })
                          .eq('id', billSchool)
                        load()
                      },
                    })
                  } catch (e) {
                    setError(e?.message || String(e) || 'Payment failed')
                  }
                  setBilling(false)
                }}
              >
                {billing ? 'Opening…' : 'Pay with IntaSend'}
              </button>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm text-slate-400">
              <p className="font-bold text-slate-200 mb-1">Pricing guidance</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Trial — first term free</li>
                <li>Termly — main SKU for Kenyan schools</li>
                <li>Yearly — ~2.5–3× term price</li>
                <li>Band by enrolment later (≤200 / ≤500)</li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'audit' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold">Audit log (latest 100)</div>
            <Scroll>
              <table className="w-full">
                <thead className="bg-slate-950">
                  <tr>
                    <th className={`${th} bg-transparent text-slate-400`}>When</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Actor</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Action</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-slate-800">
                      <td className={`${td} text-slate-400 text-xs`}>{new Date(e.created_at).toLocaleString('en-GB')}</td>
                      <td className={`${td} text-sm`}>{e.actor_email || '—'}</td>
                      <td className={`${td} text-cyan-300 text-sm`}>{e.action}</td>
                      <td className={`${td} text-sm`}>{e.entity || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 pb-8">© BigDataKE Technologies · ShuleKit Platform</p>
      </main>
    </div>
  )
}
