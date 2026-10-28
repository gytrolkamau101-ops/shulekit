const THEME_KEY = 'sm_theme'
const LANG_KEY = 'sm_lang'

export function getTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'dim' || v === 'light') return v
  } catch (_) {}
  return 'light'
}

export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch (_) {}
  applyTheme(theme)
}

export function getLang() {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'sw' || v === 'en') return v
  } catch (_) {}
  return 'en'
}

export function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch (_) {}
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme || 'light')
  root.classList.remove('theme-light', 'theme-dark', 'theme-dim')
  root.classList.add(`theme-${theme || 'light'}`)
}
