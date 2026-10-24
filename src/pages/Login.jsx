import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { input, btn, btnGreen, Alert, PasswordInput, Spinner } from '../components/ui'
import { getSettings } from '../lib/platform'
import { payWithIntaSend } from '../lib/intasend'

const DEFAULT_PLANS = {
  currency: 'KES',
  plans: [
    {
      id: 'basic',
      name: 'Basic',
      price: 2000,
      period: 'per term',
      days: 120,
      features: ['Full school records', 'Fees, exams, attendance, report cards', 'Parent view portal', 'Up to 250 learners'],
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 4000,
      period: 'per term',
      days: 120,
      features: ['Everything in Basic', 'Parent fee pay', 'Bulk WhatsApp / SMS', 'Templates + absent alerts', 'Up to 500 learners'],
    },
  ],
}


export default function Login() {
  const [mode, setMode] = useState('login')
  const [accountType, setAccountType] = useState('staff')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [regType, setRegType] = useState('join')
  const [schoolName, setSchoolName] = useState('')
  const [schoolLevel, setSchoolLevel] = useState('primary')
  const [referralCode, setReferralCode] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [codeSchool, setCodeSchool] = useState('')
  const [role, setRole] = useState('Teacher')
  const [admissionNo, setAdmissionNo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [view, setView] = useState('auth') // auth | pricing | terms | how | contact
  const [theme, setTheme] = useState({ primary: '#1d4ed8', logo_text: 'SK', bg_from: '#0f172a', bg_to: '#1e3a8a', bg_style: 'gradient' })
  const [pricing, setPricing] = useState(DEFAULT_PLANS)
  const [terms, setTerms] = useState(null)
  const [how, setHow] = useState(null)
  const [contacts, setContacts] = useState(null)
  const [payBusy, setPayBusy] = useState(false)

  const reset = () => {
    setError('')
    setInfo('')
  }

  useEffect(() => {
    ;(async () => {
      try {
        const s = await getSettings(['theme', 'pricing', 'terms', 'how_it_works', 'contacts'])
        if (s.theme) setTheme((p) => ({ ...p, ...s.theme }))
        if (s.pricing?.plans?.length) setPricing(s.pricing)
        else setPricing(DEFAULT_PLANS)
        if (s.terms) setTerms(s.terms)
        if (s.how_it_works) setHow(s.how_it_works)
        if (s.contacts) setContacts(s.contacts)
      } catch (_) {}
    })()
  }, [])

  const subscribePlan = async (plan) => {
    setPayBusy(true)
    setError('')
    try {
      if (!plan.price || Number(plan.price) <= 0) {
        setInfo(`${plan.name} is free — register your school, then start using ShuleKit.`)
        setView('auth')
        setMode('register')
        setRegType('new')
        setPayBusy(false)
        return
      }
      await payWithIntaSend({
        amount: Number(plan.price),
        email: email || undefined,
        apiRef: `plan-${plan.id}-pending-${Date.now()}`,
        comment: `ShuleKit ${plan.name}`,
        onComplete: () => {
          setInfo(`Payment received for ${plan.name}. Register your school (or log in) — Super Admin will confirm plan if webhook is not yet wired.`)
          setView('auth')
          setMode('register')
          setRegType('new')
        },
      })
    } catch (e) {
      setError(e?.message || 'Payment could not start')
    }
    setPayBusy(false)
  }

  const checkCode = async () => {
    setCodeSchool('')
    if (schoolCode.trim().length < 4) return
    const { data } = await supabase.rpc('school_name_for_code', { code: schoolCode })
    setCodeSchool(data || 'not-found')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    reset()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    reset()
    if (accountType === 'staff' && regType === 'join' && codeSchool === 'not-found') {
      setError('School code not found. Ask your Principal for the correct code.')
      return
    }
    if (accountType === 'parent' && codeSchool === 'not-found') {
      setError('School code not found. Ask the school for the correct code.')
      return
    }
    setBusy(true)
    let meta
    if (accountType === 'parent') {
      meta = {
        full_name: fullName,
        school_code: schoolCode,
        admission_no: admissionNo,
        parent_signup: 'true',
      }
    } else {
      meta =
        regType === 'new'
          ? { full_name: fullName, school_name: schoolName, school_level: schoolLevel, referral_code: referralCode }
          : { full_name: fullName, school_code: schoolCode, role }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    })
    if (error) {
      setBusy(false)
      return setError(error.message)
    }

    // Accounts that need approval must not stay logged in — that path caused a blank/stuck app.
    const needsApproval =
      accountType === 'parent' || (accountType === 'staff' && regType === 'join')

    if (needsApproval) {
      if (data.session) {
        await supabase.auth.signOut()
      }
      setBusy(false)
      setMode('login')
      setInfo(
        accountType === 'parent'
          ? 'Registration received. The school must approve your parent link first. After approval, sign in here.'
          : 'Registration received. Your Principal or Senior Teacher must approve you under School Setup → Staff. After approval, sign in here.'
      )
      setPassword('')
      return
    }

    // New school principal — active immediately
    setBusy(false)
    if (!data.session) {
      setInfo('Account created. Check your email and click the confirmation link, then log in.')
      setMode('login')
    }
  }

  const forgot = async () => {
    reset()
    if (!email) return setError('Type your email above first, then tap "Forgot password".')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setError(error.message)
    else setInfo('Password reset link sent. Check your email.')
  }

  const bgStyle =
    theme.bg_style === 'solid'
      ? { background: theme.bg_from || '#0f172a' }
      : { background: `linear-gradient(135deg, ${theme.bg_from || '#0f172a'}, ${theme.bg_to || '#1e3a8a'})` }

  if (view !== 'auth') {
    const page =
      view === 'pricing'
        ? null
        : view === 'terms'
          ? terms
          : view === 'how'
            ? how
            : contacts
    return (
      <div className="min-h-screen flex flex-col items-center p-4" style={bgStyle}>
        <div className="w-full max-w-lg sk-glass rounded-2xl p-6 my-8 space-y-4">
          <button type="button" className="text-sm font-bold text-blue-700" onClick={() => setView('auth')}>
            ← Back
          </button>
          {view === 'pricing' ? (
            <>
              <h2 className="text-2xl font-black text-slate-900">Choose a plan</h2>
              <p className="text-sm text-slate-600">Pay with M-Pesa / card via IntaSend. After payment, register or log in as Principal.</p>
              <Alert>{error}</Alert>
              <Alert kind="ok">{info}</Alert>
              <div className="space-y-3">
                {(pricing.plans || []).map((plan) => (
                  <div key={plan.id || plan.name} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-black text-lg">{plan.name}</p>
                        <p className="text-sm text-slate-500">{plan.period}</p>
                      </div>
                      <p className="font-black text-blue-700">
                        {Number(plan.price) <= 0 ? 'Free' : `${pricing.currency || 'KES'} ${Number(plan.price).toLocaleString()}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={payBusy}
                      className={`${btnGreen} w-full mt-3`}
                      onClick={() => subscribePlan(plan)}
                    >
                      {Number(plan.price) <= 0 ? 'Start free' : 'Pay & subscribe'}
                    </button>
                  </div>
                ))}
                {!(pricing.plans || []).length && (
                  <p className="text-sm text-slate-500">Pricing not configured yet. Super Admin → Pricing.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black text-slate-900">{page?.title || view}</h2>
              {view === 'contact' ? (
                <div className="text-sm text-slate-700 space-y-2">
                  <p>Email: {contacts?.email || '—'}</p>
                  <p>Phone: {contacts?.phone || '—'}</p>
                  <p>WhatsApp: {contacts?.whatsapp || '—'}</p>
                  <p>Address: {contacts?.address || '—'}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{page?.body || 'Content coming soon.'}</p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" style={bgStyle}>
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-blue-500/25 blur-3xl" />

      <div className="relative w-full max-w-md sk-animate-in">
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-xl mb-4 text-white font-black text-2xl"
            style={{ background: theme.primary || '#1d4ed8' }}
          >
            {theme.logo_text || 'SK'}
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-sm">ShuleKit</h1>
          <p className="text-cyan-100/90 mt-1 text-sm font-medium">by BigDataKE Technologies</p>
        </div>

        <div className="sk-glass rounded-2xl p-6 md:p-8">
          {mode === 'register' && (
            <div className="flex gap-1 p-1 mb-5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAccountType('staff')
                  reset()
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                  accountType === 'staff' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                School staff
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountType('parent')
                  reset()
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                  accountType === 'parent' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Parent
              </button>
            </div>
          )}

          <div className="space-y-3 mb-4">
            <Alert kind="error" onClose={() => setError('')}>
              {error}
            </Alert>
            <Alert kind="ok" onClose={() => setInfo('')}>
              {info}
            </Alert>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
            {mode === 'register' && accountType === 'staff' && (
              <>
                <input
                  className={input}
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <select className={input} value={regType} onChange={(e) => setRegType(e.target.value)}>
                  <option value="join">Join an existing school</option>
                  <option value="new">Register a new school (I am the Principal)</option>
                </select>
                {regType === 'new' ? (
                  <>
                  <input
                    className={input}
                    placeholder="School name"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                  />
                  <select className={input} value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value)}>
                    <option value="primary">Primary (CBC: PP1–Grade 9)</option>
                    <option value="secondary">Secondary (Form 1–4)</option>
                    <option value="combined">Combined primary + secondary</option>
                  </select>
                  <input
                    className={input}
                    placeholder="Referral code (optional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                  />
                  </>
                ) : (
                  <>
                    <input
                      className={`${input} uppercase`}
                      placeholder="School code"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      onBlur={checkCode}
                      required
                    />
                    {codeSchool && codeSchool !== 'not-found' && (
                      <Alert kind="ok">Joining: {codeSchool}</Alert>
                    )}
                    {codeSchool === 'not-found' && <Alert>School code not found</Alert>}
                    <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
                      <option>Teacher</option>
                      <option>Secretary</option>
                    </select>
                    <p className="text-xs text-slate-500">
                      Account waits for Principal approval. Higher roles are assigned by the school.
                    </p>
                  </>
                )}
              </>
            )}

            {mode === 'register' && accountType === 'parent' && (
              <>
                <input
                  className={input}
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <input
                  className={`${input} uppercase`}
                  placeholder="School code"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  onBlur={checkCode}
                  required
                />
                {codeSchool && codeSchool !== 'not-found' && (
                  <Alert kind="ok">School: {codeSchool}</Alert>
                )}
                {codeSchool === 'not-found' && <Alert>School code not found</Alert>}
                <input
                  className={input}
                  placeholder="Child's admission number"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500">The school must approve the link before you see records.</p>
              </>
            )}

            <input
              type="email"
              className={input}
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <PasswordInput
              minLength={6}
              required
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button disabled={busy} className={`${btn} w-full py-3.5 text-base`}>
              {busy ? (
                <>
                  <Spinner /> Please wait...
                </>
              ) : mode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2 text-sm">
            <button
              type="button"
              onClick={() => {
                reset()
                setMode(mode === 'login' ? 'register' : 'login')
              }}
              className="text-blue-700 font-bold hover:underline"
            >
              {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Login'}
            </button>
            {mode === 'login' && (
              <button type="button" onClick={forgot} className="block w-full text-slate-500 hover:text-blue-600 font-medium">
                Forgot password?
              </button>
            )}
          </div>
        </div>

        {/* Plan tiers on main page */}
        <div className="mt-6 sk-glass rounded-2xl p-4 space-y-3">
          <h2 className="text-center text-lg font-black text-slate-900">Choose your plan</h2>
          <p className="text-center text-xs text-slate-600">Subscribe for your school — pay with M-Pesa / card</p>
          <div className="grid gap-3">
            {(pricing.plans || DEFAULT_PLANS.plans).map((plan) => (
              <div key={plan.id || plan.name} className="rounded-xl border border-slate-200 bg-white/90 p-3 text-left">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-black text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">{plan.period}</p>
                  </div>
                  <p className="font-black text-blue-700 shrink-0">
                    {Number(plan.price) <= 0 ? 'Free' : `${pricing.currency || 'KES'} ${Number(plan.price).toLocaleString()}`}
                  </p>
                </div>
                {plan.features?.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  disabled={payBusy}
                  className={`${btnGreen} w-full mt-3 text-sm`}
                  onClick={() => subscribePlan(plan)}
                >
                  {Number(plan.price) <= 0 ? 'Start free' : 'Subscribe & pay'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-bold text-white/90">
          <button type="button" className="underline" onClick={() => setView('pricing')}>All plans</button>
          <button type="button" className="underline" onClick={() => setView('how')}>How it works</button>
          <button type="button" className="underline" onClick={() => setView('terms')}>Terms</button>
          <button type="button" className="underline" onClick={() => setView('contact')}>Contact</button>
        </div>
        <p className="mt-4 text-center text-xs text-white/70 font-medium">
          © BigDataKE Technologies. All rights reserved.
        </p>
      </div>
    </div>
  )
}
