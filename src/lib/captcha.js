/** Cloudflare Turnstile (optional). Set VITE_TURNSTILE_SITE_KEY in Netlify. */

const SITE = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

export function captchaRequired() {
  return Boolean(SITE && String(SITE).length > 5)
}

export function getTurnstileSiteKey() {
  return SITE
}

let loading = null

export function loadTurnstile() {
  if (!captchaRequired()) return Promise.resolve(false)
  if (window.turnstile) return Promise.resolve(true)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return loading
}

export async function renderTurnstile(container, onToken) {
  if (!captchaRequired() || !container) return null
  const ok = await loadTurnstile()
  if (!ok || !window.turnstile) return null
  container.innerHTML = ''
  try {
    return window.turnstile.render(container, {
      sitekey: SITE,
      theme: 'light',
      callback: (token) => onToken?.(token),
      'expired-callback': () => onToken?.(''),
      'error-callback': () => onToken?.(''),
    })
  } catch {
    return null
  }
}

export function resetTurnstile(widgetId) {
  try {
    if (widgetId != null && window.turnstile) window.turnstile.reset(widgetId)
  } catch (_) {}
}
