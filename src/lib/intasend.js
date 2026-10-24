/** IntaSend — publishable key only. Hosted checkout first (most reliable). */

export function intasendConfig() {
  const publicKey = import.meta.env.VITE_INTASEND_PUBLIC_KEY || ''
  const live = String(import.meta.env.VITE_INTASEND_LIVE || 'false').toLowerCase() === 'true'
  return { publicKey, live }
}

const SDK_URL = 'https://unpkg.com/intasend-inlinejs-sdk@4.0.6/build/intasend-inline.js'

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.IntaSend) return resolve(window.IntaSend)
    const existing = document.querySelector('script[data-intasend]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.IntaSend))
      existing.addEventListener('error', () => reject(new Error('IntaSend script failed')))
      if (window.IntaSend) resolve(window.IntaSend)
      return
    }
    const s = document.createElement('script')
    s.src = SDK_URL
    s.async = true
    s.dataset.intasend = '1'
    s.onload = () => resolve(window.IntaSend)
    s.onerror = () => reject(new Error('Could not load IntaSend SDK'))
    document.head.appendChild(s)
  })
}

async function hostedCheckout({ publicKey, live, amount, email, phone, apiRef, comment }) {
  const base = live ? 'https://payment.intasend.com' : 'https://sandbox.intasend.com'
  const res = await fetch(`${base}/api/v1/checkout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: publicKey,
      amount: Number(amount),
      currency: 'KES',
      email: email || 'billing@shulekit.app',
      phone_number: phone || undefined,
      api_ref: apiRef || `shulekit-${Date.now()}`,
      comment: comment || 'ShuleKit subscription',
      redirect_url: typeof window !== 'undefined' ? window.location.href : undefined,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || data.message || data.error || `Checkout failed (${res.status})`)
  }
  const url = data.url || data.checkout_url
  if (!url) throw new Error(typeof data === 'object' ? JSON.stringify(data) : 'No checkout URL')
  window.location.href = url
  return data
}

export async function payWithIntaSend({ amount, email, phone, apiRef, comment, onComplete, onFailed }) {
  const { publicKey, live } = intasendConfig()
  if (!publicKey) throw new Error('Missing VITE_INTASEND_PUBLIC_KEY in .env')

  try {
    return await hostedCheckout({ publicKey, live, amount, email, phone, apiRef, comment })
  } catch (hostedErr) {
    try {
      await loadScript()
      const IS = window.IntaSend
      if (!IS) throw hostedErr
      const opts = { publicAPIKey: publicKey, live, redirectURL: window.location.href }
      let instance
      try {
        instance = typeof IS === 'function' ? new IS(opts) : IS(opts)
      } catch {
        instance = IS(opts)
      }
      if (instance && typeof instance.on === 'function' && typeof instance.run === 'function') {
        return new Promise((resolve, reject) => {
          instance
            .on('COMPLETE', (r) => {
              onComplete?.(r)
              resolve(r)
            })
            .on('FAILED', (r) => {
              onFailed?.(r)
              reject(r || new Error('Payment failed'))
            })
          instance.run({
            amount: Number(amount),
            currency: 'KES',
            email: email || undefined,
            phone_number: phone || undefined,
            api_ref: apiRef || `shulekit-${Date.now()}`,
            comment: comment || 'ShuleKit',
          })
        })
      }
      throw hostedErr
    } catch {
      throw hostedErr
    }
  }
}
