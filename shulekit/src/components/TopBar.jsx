import { useState, useEffect } from 'react'
import { queueCount, isOnline } from '../lib/offline'

export default function TopBar({ school, user, term, onLogout, onMenu }) {
  const [online, setOnline] = useState(true)
  const [q, setQ] = useState(0)
  useEffect(() => {
    const tick = () => {
      setOnline(isOnline())
      setQ(queueCount())
    }
    tick()
    window.addEventListener('online', tick)
    window.addEventListener('offline', tick)
    const id = setInterval(tick, 4000)
    return () => {
      window.removeEventListener('online', tick)
      window.removeEventListener('offline', tick)
      clearInterval(id)
    }
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const termLabel = term ? `Term ${term.term}, ${term.year}` : 'No term set'

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center gap-3 shadow-sm">
      <button
        onClick={onMenu}
        className="md:hidden w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 text-lg"
        aria-label="Menu"
      >
        ☰
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="text-base md:text-lg font-bold text-slate-900 truncate">{school?.school_name}</h2>
        <p className="text-xs text-slate-500 font-medium">
          {today}
          <span className="mx-1.5 text-slate-300">·</span>
          <span className={term ? 'text-blue-600' : 'text-amber-600'}>{termLabel}</span>
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <div className="text-right">
          <p className="font-bold text-slate-800 text-sm leading-tight">{user?.full_name}</p>
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">{user?.role}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
          {(user?.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
      </div>
      {!online && (
        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">Offline</span>
      )}
      {q > 0 && (
        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-lg">{q} queued</span>
      )}
      <button
        onClick={onLogout}
        className="px-3 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition"
      >
        Logout
      </button>
    </header>
  )
}
