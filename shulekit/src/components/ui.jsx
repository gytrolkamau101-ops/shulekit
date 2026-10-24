import { useEffect, useState } from 'react'

export const input =
  'w-full p-3 border border-slate-200 rounded-xl bg-white text-base text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition'
export const btn =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition'
export const btnGreen =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 active:scale-[0.98] transition'
export const btnDanger =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold shadow-md shadow-red-600/20 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] disabled:opacity-50 transition'
export const th = 'px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap bg-slate-50/95'
export const td = 'px-3 py-3 text-sm text-slate-700'

export const fmt = (n) => Number(n || 0).toLocaleString('en-KE')

export function Card({ title, children, className = '', action }) {
  return (
    <div className={`sk-card p-4 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          {title && <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Scroll({ children }) {
  return <div className="overflow-x-auto sk-scroll rounded-xl">{children}</div>
}

const alertStyles = {
  error: {
    wrap: 'bg-red-50 border-red-200 text-red-800',
    icon: '⚠️',
    bar: 'bg-red-500',
  },
  ok: {
    wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: '✓',
    bar: 'bg-emerald-500',
  },
  info: {
    wrap: 'bg-sky-50 border-sky-200 text-sky-800',
    icon: 'ℹ',
    bar: 'bg-sky-500',
  },
  warn: {
    wrap: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: '!',
    bar: 'bg-amber-500',
  },
}

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null
  const s = alertStyles[kind] || alertStyles.error
  return (
    <div className={`relative overflow-hidden flex gap-3 p-3.5 border rounded-xl text-sm sk-animate-in ${s.wrap}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
      <span className="text-base leading-none mt-0.5 shrink-0 pl-1">{s.icon}</span>
      <div className="flex-1 min-w-0 font-medium leading-snug">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 text-lg leading-none px-1">
          ×
        </button>
      )}
    </div>
  )
}

export function NeedTerm() {
  return (
    <Alert kind="warn">
      No current term is set. Go to <strong>School Setup → Terms</strong>, add a term, then tap{' '}
      <strong>Set as current</strong>. (Principal or Senior Teacher only.)
    </Alert>
  )
}

export function PageTitle({ children, right }) {
  return (
    <div className="flex flex-wrap gap-3 justify-between items-center mb-1">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{children}</h1>
      {right}
    </div>
  )
}

/** Modal / dialog */
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm sk-backdrop-in" onClick={onClose} />
      <div
        className={`relative sk-glass rounded-t-2xl sm:rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto sk-modal-in p-5 md:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          {title && <h3 className="text-xl font-bold text-slate-900">{title}</h3>}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Toast stack — call toast.push({ kind, message }) via useToast helper below */
let toastHandler = null
export function toast(message, kind = 'ok') {
  if (typeof message === 'object') {
    toastHandler?.(message)
  } else {
    toastHandler?.({ message, kind })
  }
}

export function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    toastHandler = (item) => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, kind: 'ok', ...item }])
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 3800)
    }
    return () => {
      toastHandler = null
    }
  }, [])

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
      {items.map((t) => {
        const s = alertStyles[t.kind] || alertStyles.ok
        return (
          <div
            key={t.id}
            className={`pointer-events-auto sk-toast-in flex gap-2 items-start p-3.5 rounded-xl border shadow-lg ${s.wrap}`}
          >
            <span>{s.icon}</span>
            <p className="text-sm font-semibold flex-1">{t.message}</p>
          </div>
        )
      })}
    </div>
  )
}

export function PasswordInput({ value, onChange, placeholder = 'Password', className = '', ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={`${input} pr-12 ${className}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export function Spinner({ dark }) {
  return <span className={dark ? 'sk-spinner sk-spinner-dark' : 'sk-spinner'} />
}

export function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-2xl mb-3">
        📋
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

export function StatPill({ label, value, tone = 'blue' }) {
  const tones = {
    blue: 'from-blue-600 to-indigo-600',
    pink: 'from-pink-500 to-rose-500',
    green: 'from-emerald-500 to-teal-600',
    red: 'from-red-500 to-rose-600',
    violet: 'from-violet-500 to-purple-600',
    slate: 'from-slate-600 to-slate-800',
  }
  return (
    <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${tones[tone] || tones.blue} shadow-lg shadow-slate-900/10`}>
      <p className="text-sm text-white/85 font-medium">{label}</p>
      <p className="text-2xl md:text-3xl font-extrabold mt-1 tracking-tight">{value}</p>
    </div>
  )
}
