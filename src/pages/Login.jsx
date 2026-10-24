import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { input, btn, Alert, PasswordInput, Spinner } from '../components/ui'

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

  const reset = () => {
    setError('')
    setInfo('')
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

  return (
    <div className="min-h-screen sk-mesh flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-blue-500/25 blur-3xl" />

      <div className="relative w-full max-w-md sk-animate-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 border border-white/25 shadow-xl mb-4 backdrop-blur-md">
            <span className="text-3xl font-black text-white tracking-tighter">SK</span>
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

        <p className="mt-6 text-center text-xs text-white/70 font-medium">
          © BigDataKE Technologies. All rights reserved.
        </p>
      </div>
    </div>
  )
}
