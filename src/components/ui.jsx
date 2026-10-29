import { useEffect, useState } from 'react'

export const input =
  'w-full p-3 border-2 border-slate-300 rounded-xl bg-white text-base text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition'

/** Dark UI fields — always visible on slate-950 backgrounds */
export const darkField =
  'w-full p-3 rounded-xl border-2 border-slate-500 bg-slate-800 text-white text-base placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400'

/** 3D raised primary button */
export const btn =
  'sm-btn-3d sm-btn-3d-blue inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-black text-sm tracking-wide disabled:opacity-50 disabled:pointer-events-none transition-transform'

export const btnGreen =
  'sm-btn-3d sm-btn-3d-green inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-black text-sm tracking-wide disabled:opacity-50 disabled:pointer-events-none transition-transform'

export const btnGhost =
  'sm-btn-3d sm-btn-3d-ghost inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-800 disabled:opacity-50 transition-transform'

export const btnDanger =
  'sm-btn-3d sm-btn-3d-red inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-black text-sm tracking-wide disabled:opacity-50 transition-transform'

export const th =
  'px-3 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-600 whitespace-nowrap bg-slate-100 border-b-2 border-slate-200'

export const td = 'px-3 py-3 text-sm text-slate-800 border-b border-slate-100'

export const fmt = (n) => Number(n || 0).toLocaleString('en-KE')

/** Visible field label + control */
export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      {label && (
        <span className="block text-xs font-black uppercase tracking-wide text-slate-600">{label}</span>
      )}
      {children}
      {hint && <span className="block text-[11px] text-slate-500 leading-snug">{hint}</span>}
    </label>
  )
}

export function Card({ title, children, className = '', action }) {
  return (
    <div className={`sk-card p-4 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          {title && <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Scroll({ children }) {
  return <div className="overflow-x-auto sk-scroll rounded-xl border border-slate-200">{children}</div>
}

const alertStyles = {
  error: 'bg-red-50 border-red-300 text-red-900',
  ok: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  info: 'bg-blue-50 border-blue-300 text-blue-900',
  warn: 'bg-amber-50 border-amber-300 text-amber-950',
}

export function Alert({ children, kind = 'error', onClose }) {
  if (!children) return null
  return (
    <div className={`relative rounded-xl border-2 px-3 py-2.5 text-sm font-medium ${alertStyles[kind] || alertStyles.error}`}>
      {children}
      {onClose && (
        <button type="button" onClick={onClose} className="absolute top-1 right-2 text-lg leading-none opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  )
}

export function PageTitle({ title, subtitle }) {
  return (
    <div className="mb-1">
      <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-slate-600 mt-0.5 font-medium">{subtitle}</p>}
    </div>
  )
}

export function NeedTerm() {
  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 font-medium">
      Set a <strong>current term</strong> in School Setup before recording fees, exams or attendance.
    </div>
  )
}

export function Spinner({ dark }) {
  return <span className={`sk-spinner ${dark ? 'border-slate-700 border-t-blue-600' : ''}`} />
}

export function StatPill({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'from-blue-600 to-cyan-500',
    pink: 'from-pink-500 to-rose-500',
    violet: 'from-violet-600 to-purple-500',
    green: 'from-emerald-600 to-teal-500',
    red: 'from-red-500 to-orange-500',
  }
  return (
    <div className={`rounded-2xl p-4 text-white bg-gradient-to-br ${tones[tone] || tones.blue} shadow-lg border border-white/20`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-white/90">{label}</p>
      <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border-2 border-slate-200 p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 font-bold text-slate-700">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const toastListeners = new Set()

export function toast(message, kind = 'ok') {
  const payload = { id: Date.now() + Math.random(), message, kind }
  toastListeners.forEach((fn) => fn(payload))
  // Fallback if ToastHost is not mounted
  if (toastListeners.size === 0 && typeof document !== 'undefined') {
    const el = document.createElement('div')
    el.className = `fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl border-2 shadow-xl text-sm font-bold max-w-sm ${
      kind === 'error' ? 'bg-red-50 border-red-300 text-red-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
    }`
    el.textContent = message
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3200)
  }
}

/** Mount once in App — shows toast() messages */
export function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const onToast = (payload) => {
      setItems((prev) => [...prev.slice(-4), payload])
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== payload.id))
      }, 3200)
    }
    toastListeners.add(onToast)
    return () => toastListeners.delete(onToast)
  }, [])
  if (!items.length) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(92vw,24rem)] pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl border-2 shadow-xl text-sm font-bold ${
            t.kind === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : t.kind === 'info'
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

export function PasswordInput({ value, onChange, placeholder = 'Password', className = '', ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={`${input} pr-14 ${className}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-blue-700 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100"
        onClick={() => setShow((v) => !v)}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
