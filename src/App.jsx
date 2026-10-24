import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import AccountGate from './pages/AccountGate'
import { input, btn, Alert, ToastHost, PasswordInput, Spinner } from './components/ui'

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMsg(error.message)
    else onDone()
  }

  return (
    <div className="min-h-screen sk-mesh flex items-center justify-center p-4">
      <form onSubmit={submit} className="sk-glass rounded-2xl w-full max-w-md p-6 space-y-4 sk-animate-in">
        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        <PasswordInput
          minLength={6}
          required
          placeholder="New password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Alert>{msg}</Alert>
        <button disabled={busy} className={`${btn} w-full`}>
          {busy ? 'Saving...' : 'Save password'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen sk-mesh flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white font-black text-lg">SK</div>
        <h1 className="text-3xl font-black text-white">ShuleKit</h1>
        <span className="sk-spinner" />
      </div>
    )
  }

  if (session && recovering) return <ResetPassword onDone={() => setRecovering(false)} />
  return (
    <>
      <ToastHost />
      {session ? <AccountGate session={session} /> : <Login />}
    </>
  )
}
