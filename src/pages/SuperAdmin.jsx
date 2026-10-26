import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { payAdminBillStk, intasendConfig } from '../lib/intasend'
import { getSetting, saveSetting } from '../lib/platform'
import { Card, Scroll, Alert, darkField, btn, btnGreen, th, td, toast, Spinner } from '../components/ui'
import { DEFAULT_PLANS } from '../lib/plans'

const saField = darkField

const TABS = ['overview', 'schools', 'billing', 'payments', 'theme', 'pricing', 'pages', 'audit']

export default function SuperAdmin({ session }) {
  const [admin, setAdmin] = useState(null)
  const [schools, setSchools] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [billSchool, setBillSchool] = useState('')
  const [billAmount, setBillAmount] = useState('5000')
  const [billing, setBilling] = useState(false)
  const [billPhone, setBillPhone] = useState('')
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState('overview')
  const [theme, setTheme] = useState({ primary: '#1d4ed8', accent: '#06b6d4', bg_style: 'gradient', bg_from: '#0f172a', bg_to: '#1e3a8a', logo_text: 'SK' })
  const [pricing, setPricing] = useState({ currency: 'KES', plans: [] })
  const [terms, setTerms] = useState({ title: 'Terms & Conditions', body: '' })
  const [how, setHow] = useState({ title: 'How it works', body: '' })
  const [contacts, setContacts] = useState({ title: 'Contact us', email: '', phone: '', whatsapp: '', address: '' })
  const [savingCms, setSavingCms] = useState(false)
  const [payEvents, setPayEvents] = useState([])
  const [payFilter, setPayFilter] = useState('all') // all | success | failed | pending

  const load = useCallback(async () => {
    setLoading(true)
    const { data: me } = await supabase.from('platform_admins').select('*').eq('id', session.user.id).maybeSingle()
    setAdmin(me)
    if (!me) {
      setLoading(false)
      return
    }
    const [{ data: sch }, { data: aud }, { data: pays }] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('subscription_events').select('*').order('created_at', { ascending: false }).limit(300),
    ])
    setSchools(sch || [])
    setEvents(aud || [])
    setPayEvents(pays || [])
    const [th, pr, te, hi, co] = await Promise.all([
      getSetting('theme'),
      getSetting('pricing'),
      getSetting('terms'),
      getSetting('how_it_works'),
      getSetting('contacts'),
    ])
    if (th) setTheme((p) => ({ ...p, ...th }))
    if (pr?.plans?.length) setPricing(pr)
    else setPricing(DEFAULT_PLANS)
    if (te) setTerms(te)
    if (hi) setHow(hi)
    if (co) setContacts(co)
    setLoading(false)
  }, [session.user.id])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const suspended = schools.filter((s) => s.is_suspended).length
    const paid = schools.filter((s) => s.plan && s.plan !== 'free' && s.plan !== 'trial').length
    const trial = schools.filter((s) => !s.plan || s.plan === 'trial' || s.plan === 'free').length
    const st = (s) => (s || '').toUpperCase()
    const payOk = payEvents.filter((e) => ['COMPLETE', 'COMPLETED', 'PAID'].includes(st(e.state))).length
    const payFail = payEvents.filter((e) => ['FAILED', 'CANCELED', 'CANCELLED'].includes(st(e.state))).length
    const payPending = payEvents.filter((e) =>
      ['STK_INIT', 'STK_SENT', 'PENDING', 'PROCESSING', 'RETRY', 'PARTIAL'].includes(st(e.state))
    ).length
    return { total: schools.length, suspended, paid, trial, audit: events.length, payOk, payFail, payPending }
  }, [schools, events, payEvents])

  const filteredPays = useMemo(() => {
    const st = (s) => (s || '').toUpperCase()
    return payEvents.filter((e) => {
      const s = st(e.state)
      if (payFilter === 'success') return ['COMPLETE', 'COMPLETED', 'PAID'].includes(s)
      if (payFilter === 'failed') return ['FAILED', 'CANCELED', 'CANCELLED'].includes(s)
      if (payFilter === 'pending') return ['STK_INIT', 'STK_SENT', 'PENDING', 'PROCESSING', 'RETRY', 'PARTIAL'].includes(s)
      return true
    })
  }, [payEvents, payFilter])

  const schoolName = (id) => {
    if (!id) return '—'
    const s = schools.find((x) => x.id === id)
    return s?.school_name || String(id).slice(0, 8) + '…'
  }

  const payStatusBadge = (state) => {
    const s = (state || '').toUpperCase()
    if (['COMPLETE', 'COMPLETED', 'PAID'].includes(s))
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    if (['FAILED', 'CANCELED', 'CANCELLED'].includes(s))
      return 'bg-red-500/20 text-red-300 border-red-500/40'
    return 'bg-amber-500/20 text-amber-200 border-amber-500/40'
  }

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
    load()
  }

  const setPlan = async (s, plan) => {
    const { error } = await supabase.from('schools').update({ plan }).eq('id', s.id)
    if (error) return setError(error.message)
    load()
  }

  const setExpiry = async (s, days) => {
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

  const saveCms = async (key, value) => {
    setSavingCms(true)
    setError('')
    try {
      await saveSetting(key, value)
      toast('Saved — live on login & platform', 'ok')
    } catch (e) {
      setError(e.message)
    }
    setSavingCms(false)
  }

  const updatePlanField = (idx, field, val) => {
    setPricing((p) => {
      const plans = [...(p.plans || [])]
      plans[idx] = { ...plans[idx], [field]: field === 'price' || field === 'days' ? Number(val) : val }
      return { ...p, plans }
    })
  }

  const removePlan = (idx) => {
    if (!confirm('Delete this plan from the public pricing list?')) return
    setPricing((p) => ({
      ...p,
      plans: (p.plans || []).filter((_, i) => i !== idx),
    }))
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
          <p className="text-slate-400 text-sm">Not a platform admin.</p>
          <button onClick={logout} className={btn}>
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              theme.bg_style === 'solid'
                ? theme.bg_from
                : `linear-gradient(135deg, ${theme.bg_from}, ${theme.bg_to})`,
          }}
        />
        <div className="relative px-4 md:px-8 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-lg"
              style={{ background: theme.primary }}
            >
              {theme.logo_text || 'SK'}
            </div>
            <div>
              <p className="text-cyan-200/90 text-xs font-bold tracking-widest uppercase">Platform command centre</p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">ShuleKit</h1>
              <p className="text-sm text-blue-100/80">{admin.full_name || session.user.email} · BigDataKE Technologies</p>
            </div>
          </div>
          <button onClick={logout} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold">
            Logout
          </button>
        </div>
        <div className="relative px-4 md:px-8 pb-4 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap capitalize ${
                tab === t ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 space-y-6 max-w-6xl mx-auto">
        <Alert>{error}</Alert>

        {(tab === 'overview' || tab === 'schools') && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Schools', value: stats.total, c: 'from-blue-500 to-cyan-500' },
              { label: 'Paid', value: stats.paid, c: 'from-emerald-500 to-teal-600' },
              { label: 'Trial/free', value: stats.trial, c: 'from-amber-500 to-orange-600' },
              { label: 'Suspended', value: stats.suspended, c: 'from-rose-500 to-red-600' },
            ].map((x) => (
              <div key={x.label} className={`rounded-2xl p-4 bg-gradient-to-br ${x.c} shadow-lg`}>
                <p className="text-xs font-semibold text-white/85 uppercase">{x.label}</p>
                <p className="text-3xl font-black mt-1">{x.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'overview' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-sm text-slate-400">
            Edit <strong className="text-white">Theme</strong>, <strong className="text-white">Pricing</strong>, and public{' '}
            <strong className="text-white">Pages</strong> (Terms, How it works, Contacts). Changes apply on the login page for every visitor.
          </div>
        )}

        {tab === 'schools' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <input className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <Scroll>
              <table className="w-full">
                <thead className="bg-slate-950">
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
                        <select className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white" value={s.plan || 'free'} onChange={(e) => setPlan(s, e.target.value)}>
                          <option value="free">free</option>
                          <option value="trial">trial</option>
                          <option value="basic">basic</option>
                          <option value="pro">pro</option>
                          <option value="termly">termly</option>
                          <option value="yearly">yearly</option>
                        </select>
                      </td>
                      <td className={td}>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${s.is_suspended ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {s.is_suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className={`${td} space-y-1`}>
                        <button type="button" onClick={() => toggleSuspend(s)} className="block text-sm text-blue-400">
                          {s.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button type="button" onClick={() => setExpiry(s, 90)} className="block text-xs text-emerald-400">
                          +90 days
                        </button>
                        <button type="button" onClick={() => setExpiry(s, 365)} className="block text-xs text-emerald-400">
                          +1 year
                        </button>
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
            <h2 className="text-xl font-black">Bill a school (IntaSend)</h2>
            <p className="text-xs font-mono text-cyan-400">
              {cfg.publicKey ? (cfg.live ? 'LIVE key' : 'SANDBOX key') : 'No VITE_INTASEND_PUBLIC_KEY'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                className={saField}
                value={billSchool}
                onChange={(e) => setBillSchool(e.target.value)}
              >
                <option value="">School to bill</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.school_name}
                  </option>
                ))}
              </select>
              <input
                className={saField}
                type="number"
                min="1"
                placeholder="Amount KES"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
              />
              <input
                className={saField}
                placeholder="M-Pesa 07… (STK)"
                value={billPhone}
                onChange={(e) => setBillPhone(e.target.value)}
              />
              <button
                type="button"
                disabled={billing}
                className={btn}
                onClick={async () => {
                  if (!billSchool) return setError('Pick a school')
                  if (!billPhone) return setError('Enter M-Pesa number for STK')
                  setBilling(true)
                  setError('')
                  try {
                    const r = await payAdminBillStk({
                      schoolId: billSchool,
                      amount: Number(billAmount) || 5000,
                      phone: billPhone,
                      planId: 'basic',
                      email: session.user.email,
                    })
                    toast(r.message || 'STK sent — complete PIN on phone', 'ok')
                  } catch (e) {
                    setError(e?.message || 'Payment failed')
                  }
                  setBilling(false)
                }}
              >
                {billing ? 'Opening…' : 'Pay with IntaSend'}
              </button>
            </div>
          </div>
        )}

        {tab === 'theme' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <h2 className="text-xl font-black">Platform look</h2>
            <p className="text-sm text-slate-400">Applies to Super Admin header and public login branding.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="text-xs text-slate-400">
                Primary
                <input type="color" className="block w-full h-10 mt-1 rounded" value={theme.primary} onChange={(e) => setTheme({ ...theme, primary: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">
                Accent
                <input type="color" className="block w-full h-10 mt-1 rounded" value={theme.accent} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">
                Icon letters
                <input className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} maxLength={3} value={theme.logo_text} onChange={(e) => setTheme({ ...theme, logo_text: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">
                Background from
                <input type="color" className="block w-full h-10 mt-1 rounded" value={theme.bg_from} onChange={(e) => setTheme({ ...theme, bg_from: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">
                Background to
                <input type="color" className="block w-full h-10 mt-1 rounded" value={theme.bg_to} onChange={(e) => setTheme({ ...theme, bg_to: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">
                Style
                <select className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} value={theme.bg_style} onChange={(e) => setTheme({ ...theme, bg_style: e.target.value })}>
                  <option value="gradient">Gradient</option>
                  <option value="solid">Solid</option>
                </select>
              </label>
            </div>
            <div
              className="h-24 rounded-2xl border border-white/10 flex items-center justify-center font-black text-2xl"
              style={{
                background: theme.bg_style === 'solid' ? theme.bg_from : `linear-gradient(135deg, ${theme.bg_from}, ${theme.bg_to})`,
              }}
            >
              <span className="px-4 py-2 rounded-xl text-white" style={{ background: theme.primary }}>
                {theme.logo_text || 'SK'} Preview
              </span>
            </div>
            <button type="button" disabled={savingCms} className={btnGreen} onClick={() => saveCms('theme', theme)}>
              Save theme for whole platform
            </button>
          </div>
        )}

        {tab === 'pricing' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <h2 className="text-xl font-black">Public pricing plans</h2>
            <p className="text-sm text-slate-400">Shown on the login page. Schools pick a plan and pay via IntaSend.</p>
            {(pricing.plans || []).map((plan, idx) => (
              <div key={plan.id || idx} className="space-y-2 border border-slate-700 rounded-xl p-3 bg-slate-950/50">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <input className={saField} value={plan.name || ''} onChange={(e) => updatePlanField(idx, 'name', e.target.value)} placeholder="Name" style={{ color: '#fff', backgroundColor: '#1e293b' }} />
                  <input className={saField} type="number" value={plan.price ?? 0} onChange={(e) => updatePlanField(idx, 'price', e.target.value)} placeholder="Price" style={{ color: '#fff', backgroundColor: '#1e293b' }} />
                  <input className={saField} value={plan.period || ''} onChange={(e) => updatePlanField(idx, 'period', e.target.value)} placeholder="per term" style={{ color: '#fff', backgroundColor: '#1e293b' }} />
                  <input className={saField} type="number" value={plan.days ?? 90} onChange={(e) => updatePlanField(idx, 'days', e.target.value)} placeholder="Days" style={{ color: '#fff', backgroundColor: '#1e293b' }} />
                  <input className={saField} value={plan.id || ''} onChange={(e) => updatePlanField(idx, 'id', e.target.value)} placeholder="id" style={{ color: '#fff', backgroundColor: '#1e293b' }} />
                </div>
                <textarea
                  className={`${saField} min-h-[72px]`}
                  style={{ color: '#fff', backgroundColor: '#1e293b' }}
                  placeholder="Features (one per line)"
                  value={(plan.features || []).join('\n')}
                  onChange={(e) =>
                    updatePlanField(
                      idx,
                      'features',
                      e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)
                    )
                  }
                />
                <div className="flex justify-end">
                  <button type="button" onClick={() => removePlan(idx)} className="text-sm font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/40">
                    Delete plan
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={btn}
              onClick={() =>
                setPricing((p) => ({
                  ...p,
                  plans: [...(p.plans || []), { id: `plan${Date.now()}`, name: 'New plan', price: 0, period: 'per term', days: 90, features: [] }],
                }))
              }
            >
              + Add plan
            </button>
            <button type="button" disabled={savingCms} className={btnGreen} onClick={() => saveCms('pricing', pricing)}>
              Save pricing
            </button>
          </div>
        )}

        {tab === 'pages' && (
          <div className="space-y-4">
            {[
              { key: 'terms', label: 'Terms & Conditions', state: terms, set: setTerms },
              { key: 'how_it_works', label: 'How it works', state: how, set: setHow },
            ].map((block) => (
              <div key={block.key} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                <h2 className="font-black">{block.label}</h2>
                <input
                  className={saField}
                  value={block.state.title || ''}
                  onChange={(e) => block.set({ ...block.state, title: e.target.value })}
                />
                <textarea
                  className={saField}
                  value={block.state.body || ''}
                  onChange={(e) => block.set({ ...block.state, body: e.target.value })}
                />
                <button type="button" disabled={savingCms} className={btnGreen} onClick={() => saveCms(block.key, block.state)}>
                  Save {block.label}
                </button>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h2 className="font-black">Contacts</h2>
              <input className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} placeholder="Email" value={contacts.email || ''} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} />
              <input className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} placeholder="Phone" value={contacts.phone || ''} onChange={(e) => setContacts({ ...contacts, phone: e.target.value })} />
              <input className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} placeholder="WhatsApp" value={contacts.whatsapp || ''} onChange={(e) => setContacts({ ...contacts, whatsapp: e.target.value })} />
              <input className={saField} style={{ color: "#f8fafc", backgroundColor: "#1e293b" }} placeholder="Address" value={contacts.address || ''} onChange={(e) => setContacts({ ...contacts, address: e.target.value })} />
              <button type="button" disabled={savingCms} className={btnGreen} onClick={() => saveCms('contacts', contacts)}>
                Save contacts
              </button>
            </div>
          </div>
        )}


        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <p className="text-2xl font-black text-emerald-300">{stats.payOk}</p>
                <p className="text-xs text-emerald-200/80">Successful</p>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                <p className="text-2xl font-black text-red-300">{stats.payFail}</p>
                <p className="text-xs text-red-200/80">Failed</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                <p className="text-2xl font-black text-amber-200">{stats.payPending}</p>
                <p className="text-xs text-amber-100/80">Pending / STK</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'success', label: 'Successful' },
                { id: 'failed', label: 'Failed' },
                { id: 'pending', label: 'Pending' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPayFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                    payFilter === f.id
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button type="button" className="ml-auto text-sm text-cyan-400 font-semibold" onClick={load}>
                Refresh
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
              <div className="p-4 font-bold border-b border-slate-800 flex justify-between">
                <span>Payment log</span>
                <span className="text-xs font-normal text-slate-400">{filteredPays.length} shown · latest 300</span>
              </div>
              <Scroll>
                <table className="w-full">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className={`${th} bg-transparent text-slate-400`}>When</th>
                      <th className={`${th} bg-transparent text-slate-400`}>Status</th>
                      <th className={`${th} bg-transparent text-slate-400`}>Amount</th>
                      <th className={`${th} bg-transparent text-slate-400`}>Kind / Plan</th>
                      <th className={`${th} bg-transparent text-slate-400`}>School</th>
                      <th className={`${th} bg-transparent text-slate-400`}>Ref / Invoice</th>
                      <th className={`${th} bg-transparent text-slate-400`}>Phone</th>
                      <th className={`${th} bg-transparent text-slate-400`}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPays.length === 0 && (
                      <tr>
                        <td colSpan={8} className={`${td} text-slate-500 text-center py-8`}>
                          No payment events yet. STK attempts and IntaSend webhooks appear here.
                        </td>
                      </tr>
                    )}
                    {filteredPays.map((e) => (
                      <tr key={e.id} className="border-t border-slate-800 align-top">
                        <td className={`${td} text-xs text-slate-400 whitespace-nowrap`}>
                          {e.created_at ? new Date(e.created_at).toLocaleString('en-GB') : '—'}
                        </td>
                        <td className={td}>
                          <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${payStatusBadge(e.state)}`}>
                            {e.state || '—'}
                          </span>
                        </td>
                        <td className={`${td} font-mono text-slate-200`}>
                          {e.amount != null ? `KES ${Number(e.amount).toLocaleString()}` : '—'}
                        </td>
                        <td className={`${td} text-xs text-slate-300`}>
                          {e.kind || '—'}
                          {e.plan_id ? ` · ${e.plan_id}` : ''}
                        </td>
                        <td className={`${td} text-xs text-slate-300`}>{schoolName(e.school_id)}</td>
                        <td className={`${td} text-[10px] font-mono text-slate-500 max-w-[140px] break-all`}>
                          {e.invoice_id || e.api_ref || '—'}
                        </td>
                        <td className={`${td} text-xs text-slate-400`}>{e.phone_masked || '—'}</td>
                        <td className={`${td} text-xs text-red-300 max-w-[160px]`}>{e.error_message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </div>
            <p className="text-xs text-slate-500">
              Successful = COMPLETE/PAID from IntaSend webhook. Failed = STK or payment failure. Pending = STK sent or processing.
            </p>
          </div>
        )}

        {tab === 'audit' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="p-4 font-bold border-b border-slate-800">Audit (latest 100)</div>
            <Scroll>
              <table className="w-full">
                <thead className="bg-slate-950">
                  <tr>
                    <th className={`${th} bg-transparent text-slate-400`}>When</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Actor</th>
                    <th className={`${th} bg-transparent text-slate-400`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-t border-slate-800">
                      <td className={`${td} text-xs text-slate-400`}>{new Date(e.created_at).toLocaleString('en-GB')}</td>
                      <td className={td}>{e.actor_email || '—'}</td>
                      <td className={`${td} text-cyan-300`}>{e.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 pb-8">© BigDataKE Technologies · ShuleKit</p>
      </main>
    </div>
  )
}
