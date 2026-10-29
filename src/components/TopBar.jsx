import { useState, useRef, useEffect } from 'react'
import { t } from '../lib/i18n'

const PAGE_LABELS = {
  dashboard: 'dashboard',
  students: 'students',
  finance: 'fees',
  exams: 'exams',
  setup: 'setup',
  support: 'support',
  referrals: 'referrals',
}

export default function TopBar({
  school,
  user,
  term,
  page,
  onLogout,
  onMenu,
  lang = 'en',
  theme = 'light',
  onTheme,
  onLang,
}) {
  const titleKey = PAGE_LABELS[page] || page
  const title = t(lang, titleKey)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <header className="sm-topbar sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-2.5 py-2 sm:px-4 sm:py-2.5">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          className="shrink-0 h-9 px-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-black shadow-md border border-blue-400/40"
        >
          ☰ {t(lang, 'menu')}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 truncate leading-tight">
            {school?.school_name || '—'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
            <span className="font-semibold text-slate-700">{title}</span>
            {term ? (
              <span>
                {' '}
                · {t(lang, 'term')} {term.term}/{term.year}
              </span>
            ) : (
              <span className="text-amber-600"> · {t(lang, 'term')} —</span>
            )}
          </p>
        </div>

        {/* Compact prefs */}
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm font-bold hover:bg-slate-100"
            title={`${t(lang, 'theme')} / ${t(lang, 'language')}`}
            aria-label="Theme and language"
          >
            ⚙
          </button>
          {open && (
            <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white shadow-xl p-2 z-50 sk-animate-in">
              <p className="text-[10px] font-bold uppercase text-slate-400 px-1 mb-1">{t(lang, 'theme')}</p>
              <div className="flex gap-1 mb-2">
                {['light', 'dim', 'dark'].map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => onTheme?.(th)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${
                      theme === th ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t(lang, th)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase text-slate-400 px-1 mb-1">{t(lang, 'language')}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onLang?.('en')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${
                    lang === 'en' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLang?.('sw')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${
                    lang === 'sw' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  SW
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 border border-red-100"
        >
          {t(lang, 'logout')}
        </button>
      </div>
    </header>
  )
}
