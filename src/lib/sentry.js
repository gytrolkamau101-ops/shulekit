/** Optional Sentry browser SDK via CDN when VITE_SENTRY_DSN is set. */

const DSN = import.meta.env.VITE_SENTRY_DSN || ''

export function initSentry() {
  if (!DSN || typeof window === 'undefined') return
  if (window.__shulemoja_sentry__) return
  window.__shulemoja_sentry__ = true
  const s = document.createElement('script')
  s.src = 'https://browser.sentry-cdn.com/7.120.0/bundle.tracing.min.js'
  s.crossOrigin = 'anonymous'
  s.onload = () => {
    try {
      window.Sentry?.init({
        dsn: DSN,
        integrations: [window.Sentry.browserTracingIntegration?.()].filter(Boolean),
        tracesSampleRate: 0.1,
        environment: import.meta.env.MODE || 'production',
        release: 'shulemoja@52',
      })
    } catch (e) {
      console.warn('Sentry init failed', e)
    }
  }
  document.head.appendChild(s)
}

export function captureException(err, ctx) {
  try {
    window.Sentry?.captureException?.(err, ctx ? { extra: ctx } : undefined)
  } catch (_) {}
}
