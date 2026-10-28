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

  return (
    <header className="sm-topbar sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          className="shrink-0 h-10 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-black shadow-md shadow-blue-600/30 border border-blue-400/40"
        >
          ☰ {t(lang, 'menu')}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-black text-slate-900 truncate leading-tight">
            {school?.school_name || '—'}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate">
            <span className="font-semibold text-slate-700">{title}</span>
            {term ? (
              <span className="text-slate-500">
                {' '}
                · {t(lang, 'term')} {term.term}/{term.year}
              </span>
            ) : (
              <span className="text-amber-600"> · {t(lang, 'term')} —</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100"
        >
          {t(lang, 'logout')}
        </button>
      </div>

      {/* Theme + language — second row, never clips term */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-bold">
          {['light', 'dim', 'dark'].map((th) => (
            <button
              key={th}
              type="button"
              onClick={() => onTheme?.(th)}
              className={`px-2.5 py-1 capitalize ${
                theme === th ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
              }`}
            >
              {t(lang, th)}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onLang?.('en')}
            className={`px-2.5 py-1 ${lang === 'en' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLang?.('sw')}
            className={`px-2.5 py-1 ${lang === 'sw' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
          >
            SW
          </button>
        </div>
      </div>
    </header>
  )
}
