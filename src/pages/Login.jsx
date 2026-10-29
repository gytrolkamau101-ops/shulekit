import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { input, btn, btnGreen, Alert, PasswordInput, Spinner } from '../components/ui'
import { getSettings } from '../lib/platform'
import { payPlatformPlan, hostedCheckoutPlatform } from '../lib/intasend'
import { DEFAULT_PLANS } from '../lib/plans'
import { BRAND_NAME, COMPANY_NAME, TAGLINE, LOGO_TEXT, LOGO_C2, PRODUCT_LINE, COUNTRY_LINE, COPYRIGHT } from '../brand'



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
  const [theme, setTheme] = useState({
    primary: '#1d4ed8',
    logo_text: 'SM',
    bg_from: '#0f172a',
    bg_to: '#1e3a8a',
    bg_style: 'gradient',
    brand_logo_url: '',
    brand_name: BRAND_NAME,
    tagline: TAGLINE,
    product_line: PRODUCT_LINE,
    country_line: COUNTRY_LINE,
    company_line: COMPANY_NAME,
    login_subtext:
      'Fees, exams, parents & terms — not a school directory. School fee money goes to your Till/Paybill.',
    footer_text: COPYRIGHT,
  })
  const [pricing, setPricing] = useState(DEFAULT_PLANS)
  const [terms, setTerms] = useState({
    title: 'Terms & Conditions',
    body: `ShuleMoja is a school management service by BigDataKE Technologies.

1. Accounts. Schools register and appoint staff. You must provide accurate information and keep login credentials secure.
2. Subscriptions. Basic and Premium plans are billed per term (or as shown on the pricing page). Payment is for access to the ShuleMoja platform only.
3. School fees. Fees paid by parents to a school’s Paybill or Till go directly to that school. BigDataKE / ShuleMoja does not collect or hold school fee money.
4. Data. School data remains under the school’s control. You are responsible for lawful processing of student and parent data under applicable Kenyan law.
5. Acceptable use. Do not misuse the system, attempt unauthorised access, or upload unlawful content.
6. Availability. We aim for reliable service but do not guarantee uninterrupted access (network, hosting, or third-party outages may occur).
7. Limitation. To the extent permitted by law, liability is limited to subscription fees paid for the current term.
8. Changes. Terms or pricing may be updated; continued use after notice constitutes acceptance.
9. Contact. Use the Contact page or email provided by the Super Admin.

By using ShuleMoja you agree to these terms.`,
  })
  const [how, setHow] = useState({
    title: 'How ShuleMoja works',
    body: `1. Subscribe — Choose Basic or Premium and pay the platform fee (M-Pesa STK on this site).
2. Register your school — Create a Principal account and school profile (primary or secondary).
3. Set up — Add the current term, grades, subjects, fee structure, and staff.
4. Enrol students — Add learners (with optional passport photo) and assign classes.
5. Run the school — Record fees, exams, attendance (Premium), messages (Premium), and more.
6. Parents — Guardians register with the school code and admission number to view balances, results, and pay instructions for the school’s Till/Paybill.

Basic includes core records and finance. Premium unlocks Messages, Attendance, Timetable, Circulars, and Import Centre.`,
  })
  const [contacts, setContacts] = useState({
    title: 'Contact us',
    email: 'support@bigdatake.example',
    phone: '',
    whatsapp: '',
    address: 'Kenya — BigDataKE Technologies',
  })
  const [payBusy, setPayBusy] = useState(false)
  const [payPhone, setPayPhone] = useState('')
  const [showPricing, setShowPricing] = useState(false)
  const [payStep, setPayStep] = useState(null) // plan object when collecting phone/email
  const [agreedTerms, setAgreedTerms] = useState(false)

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

  const openPayForm = (plan) => {
    setError('')
    setInfo('')
    if (!plan.price || Number(plan.price) <= 0) {
      setInfo(`${plan.name} is free — register your school, then start using ShuleMoja.`)
      setShowPricing(false)
      setMode('register')
      setRegType('new')
      return
    }
    if (!agreedTerms) {
      setError('Please tick “I agree to the Terms & Conditions” before paying.')
      return
    }
    setPayStep(plan)
  }

  const subscribePlan = async (plan, { cardCheckout = false } = {}) => {
    setPayBusy(true)
    setError('')
    setInfo('')
    try {
      if (!plan.price || Number(plan.price) <= 0) {
        setInfo(`${plan.name} is free — register your school, then start using ShuleMoja.`)
        setPayStep(null)
        setShowPricing(false)
        setMode('register')
        setRegType('new')
        setPayBusy(false)
        return
      }
      if (cardCheckout) {
        await hostedCheckoutPlatform({
          amount: Number(plan.price),
          email: email || undefined,
          phone: payPhone || undefined,
          apiRef: `plan-${plan.id}-pending-${Date.now()}`,
          comment: `ShuleMoja ${plan.name}`,
        })
        setPayBusy(false)
        return
      }
      if (!payPhone || payPhone.replace(/\D/g, '').length < 9) {
        setError('Enter a valid M-Pesa number (e.g. 07XXXXXXXX).')
        setPayBusy(false)
        return
      }
      const result = await payPlatformPlan({
        planId: plan.id,
        phone: payPhone,
        email: email || undefined,
      })
      setInfo(
        result.message ||
          `STK sent for KES ${result.amount || plan.price}. Enter your M-Pesa PIN on the phone, then register as Principal.`
      )
      setPayStep(null)
    } catch (e) {
      setError(
        e?.message || 'STK could not start. If you see Invalid plan, set Super Admin → Pricing plan id to basic, premium or pro.'
      )
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
    if (!agreedTerms) {
      setError('Please agree to the Terms & Conditions to create an account.')
      return
    }
    if (accountType === 'staff' && regType === 'join' && codeSchool === 'not-found') {
      setError('School code not found. Ask your Principal for the correct code.')
      return
    }
    if (accountType === 'parent' && codeSchool === 'not-found') {
      setError('School code not found. Ask the school for the correct code.')
      return
    }
    if (accountType === 'staff' && regType === 'new') {
      const code = (referralCode || '').trim()
      if (!code) {
        setError('A referral code is required to register a new school. Ask the school that invited you, or contact support.')
        return
      }
      const { data: v, error: ve } = await supabase.rpc('validate_referral_code', { p_code: code })
      if (ve) {
        setError(ve.message || 'Could not validate referral code')
        return
      }
      if (!v || !v.ok) {
        setError((v && v.error) || 'Invalid referral code')
        return
      }
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
          ? { full_name: fullName, school_name: schoolName, school_level: schoolLevel, referral_code: referralCode.trim().toUpperCase() }
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
                {(pricing?.plans?.length ? pricing.plans : DEFAULT_PLANS.plans).map((plan) => (
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
                      onClick={() => openPayForm(plan)}
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
        <div className="text-center mb-4">
          <img
            src={theme.brand_logo_url || LOGO_C2}
            alt={`${theme.brand_name || BRAND_NAME} — ${theme.product_line || PRODUCT_LINE}`}
            className="mx-auto w-full max-w-md rounded-2xl shadow-2xl shadow-black/50 border border-white/15 object-contain bg-[#0a1628]"
          />
          <p className="text-cyan-100/85 mt-3 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {(theme.product_line || PRODUCT_LINE)}
            {(theme.product_line || PRODUCT_LINE) && (theme.country_line || COUNTRY_LINE) ? ' · ' : ''}
            {theme.country_line || COUNTRY_LINE}
          </p>
          {(theme.company_line || COMPANY_NAME) && (
            <p className="text-cyan-100/55 text-[11px] mt-0.5">by {theme.company_line || COMPANY_NAME}</p>
          )}
          {(theme.login_subtext || '').trim() !== '' && (
            <p className="text-slate-300/70 text-[11px] mt-2 max-w-sm mx-auto leading-relaxed">
              {theme.login_subtext}
            </p>
          )}
        </div>

        <div className="rounded-2xl border-2 border-white/20 bg-white shadow-2xl shadow-black/30 p-6 md:p-8 ring-1 ring-black/5">
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
                    className={`${input} uppercase`}
                    placeholder="Referral code (required) e.g. SM-7K3M9Q"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    required
                  />
                  <p className="text-xs text-slate-500">Valid code required. 1‑month free trial starts after registration.</p>
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
            {mode === 'register' && (
              <label className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    className="text-blue-700 font-bold underline"
                    onClick={() => setView('terms')}
                  >
                    Terms &amp; Conditions
                  </button>
                  {' '}and understand school fees are paid to the school, not through ShuleMoja platform fee collection.
                </span>
              </label>
            )}
            <button disabled={busy || (mode === 'register' && !agreedTerms)} className={`${btn} w-full py-3.5 text-base font-black shadow-lg shadow-blue-600/30 border border-blue-500/30`}>
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

        <button
          type="button"
          onClick={() => {
            setError('')
            setInfo('')
            setShowPricing(true)
          }}
          className="mt-6 w-full py-5 rounded-2xl text-xl font-black text-white border-2 border-amber-300 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 active:scale-[0.99] transition sk-subscribe-pulse"
        >
          Subscribe
        </button>
        <p className="mt-2 text-center text-xs text-white/80">School plans · M-Pesa / card</p>

        {showPricing && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowPricing(false)} />
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 sticky top-0 bg-white pb-2 z-10">
                <h2 className="text-xl font-black text-slate-900">Choose a plan</h2>
                <button
                  type="button"
                  onClick={() => setShowPricing(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-lg hover:bg-slate-200"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-slate-600">
                Enter your details, choose a plan, then confirm on your phone (STK). You stay on ShuleMoja — no redirect for M-Pesa.
              </p>
              <Alert>{error}</Alert>
              <Alert kind="ok">{info}</Alert>
              <label className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                />
                <span>
                  I have read and agree to the{' '}
                  <button type="button" className="text-blue-700 font-bold underline" onClick={() => { setShowPricing(false); setView('terms') }}>
                    Terms &amp; Conditions
                  </button>
                  . School fees are paid to each school; ShuleMoja only bills platform subscriptions.
                </span>
              </label>
            <div className="grid gap-3 max-h-[55vh] overflow-y-auto">
              {[...(pricing?.plans?.length ? pricing.plans : DEFAULT_PLANS.plans)]
                .slice()
                .sort((a, b) => (b.id === 'premium' ? 1 : 0) - (a.id === 'premium' ? 1 : 0) || Number(b.price || 0) - Number(a.price || 0))
                .map((plan) => {
                  const isPrem = plan.id === 'premium' || plan.highlight
                  return (
                    <div
                      key={plan.id || plan.name}
                      className={`rounded-xl p-4 text-left border-2 ${
                        isPrem
                          ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          {isPrem && (
                            <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                          <p className={`font-black text-lg ${isPrem ? 'text-amber-950' : 'text-slate-900'}`}>{plan.name}</p>
                          <p className="text-xs text-slate-500">{plan.period || 'per term'}</p>
                        </div>
                        <p className={`font-black text-lg shrink-0 ${isPrem ? 'text-amber-700' : 'text-blue-700'}`}>
                          {Number(plan.price) <= 0
                            ? 'Free'
                            : `${pricing.currency || 'KES'} ${Number(plan.price).toLocaleString()}`}
                        </p>
                      </div>
                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <ul className="mt-2 text-xs text-slate-700 list-disc pl-4 space-y-0.5">
                          {plan.features.slice(0, 6).map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        disabled={payBusy}
                        className={`w-full mt-3 text-sm font-bold py-3 rounded-xl text-white border-2 shadow-lg ${
                          isPrem
                            ? 'border-amber-300 from-amber-500 to-orange-600 bg-gradient-to-r shadow-amber-500/30'
                            : 'border-blue-300 from-blue-600 to-indigo-600 bg-gradient-to-r shadow-blue-600/30'
                        }`}
                        onClick={() => openPayForm(plan)}
                      >
                        {Number(plan.price) <= 0 ? 'Start free' : 'Continue to pay'}
                      </button>
                    </div>
                  )
                })}
            </div>

            </div>
          </div>
        )}


        {payStep && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={() => !payBusy && setPayStep(null)} />
            <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900">Complete payment</h3>
                <button type="button" className="w-10 h-10 rounded-full bg-slate-100 font-bold" onClick={() => !payBusy && setPayStep(null)}>×</button>
              </div>
              <p className="text-sm text-slate-600">
                <strong>{payStep.name}</strong> — KES {Number(payStep.price).toLocaleString()} ({payStep.period || 'per term'})
              </p>
              <Alert>{error}</Alert>
              <Alert kind="ok">{info}</Alert>
              <input
                className={input}
                type="email"
                placeholder="Email for receipt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className={input}
                inputMode="tel"
                placeholder="e.g. 0700537387"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
              />
              <button
                type="button"
                disabled={payBusy}
                className={`${btnGreen} w-full py-3 border-2 border-emerald-300 shadow-lg`}
                onClick={() => subscribePlan(payStep)}
              >
                {payBusy ? 'Sending STK…' : 'Send M-Pesa STK prompt'}
              </button>
              <button
                type="button"
                disabled={payBusy}
                className="w-full text-sm font-semibold py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 bg-white shadow-md"
                onClick={() => subscribePlan(payStep, { cardCheckout: true })}
              >
                Pay by card / other methods
              </button>
              <button type="button" className="w-full text-sm text-slate-500 font-medium" disabled={payBusy} onClick={() => setPayStep(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-bold text-white/90">
          <button type="button" className="underline" onClick={() => setShowPricing(true)}>Plans</button>
          <button type="button" className="underline" onClick={() => setView('how')}>How it works</button>
          <button type="button" className="underline" onClick={() => setView('terms')}>Terms</button>
          <button type="button" className="underline" onClick={() => setView('contact')}>Contact</button>
        </div>
        <p className="mt-4 text-center text-xs text-white/70 font-medium">
          {theme.footer_text || COPYRIGHT}
        </p>
      </div>
    </div>
  )
}
