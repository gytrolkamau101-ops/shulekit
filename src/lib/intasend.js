/** IntaSend — prefer STK (brief) when phone given; else hosted checkout */

export function intasendConfig() {
  const publicKey = import.meta.env.VITE_INTASEND_PUBLIC_KEY || ''
  const live = String(import.meta.env.VITE_INTASEND_LIVE || 'false').toLowerCase() === 'true'
  return { publicKey, live }
}

function normalizeKePhone(phone) {
  if (!phone) return null
  let p = String(phone).replace(/\D/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('7') && p.length === 9) p = '254' + p
  if (p.length < 12) return null
  return p
}

/** Hosted checkout — optional method hint for M-Pesa-first UX where supported */
async function hostedCheckout({ publicKey, live, amount, email, phone, apiRef, comment }) {
  const base = live ? 'https://payment.intasend.com' : 'https://sandbox.intasend.com'
  const payload = {
    public_key: publicKey,
    amount: Number(amount),
    currency: 'KES',
    email: email || 'billing@shulekit.app',
    api_ref: apiRef || `shulekit-${Date.now()}`,
    comment: comment || 'ShuleKit subscription',
    redirect_url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined,
  }
  const ph = normalizeKePhone(phone)
  if (ph) payload.phone_number = ph

  const res = await fetch(`${base}/api/v1/checkout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

/** STK via Netlify function (secret key server-side) — one prompt on phone */
async function stkPush({ amount, phone, apiRef, email }) {
  const ph = normalizeKePhone(phone)
  if (!ph) throw new Error('Enter a valid M-Pesa number (07… or 2547…)')
  const res = await fetch('/.netlify/functions/intasend-stk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Number(amount),
      phone_number: ph,
      api_ref: apiRef,
      email,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.detail || data.message || 'STK push failed')
  }
  return data
}

/**
 * @param {{ amount, email?, phone?, apiRef?, comment?, preferStk?: boolean, onComplete?, onFailed? }} opts
 * preferStk true → try M-Pesa STK first (needs Netlify function + secret key)
 */
export async function payWithIntaSend(opts) {
  const { publicKey, live } = intasendConfig()
  if (!publicKey) throw new Error('Missing VITE_INTASEND_PUBLIC_KEY in .env')

  const preferStk = opts.preferStk !== false
  if (preferStk && opts.phone) {
    try {
      return await stkPush({
        amount: opts.amount,
        phone: opts.phone,
        apiRef: opts.apiRef,
        email: opts.email,
      })
    } catch (e) {
      // Fall through to hosted if function missing (localhost) or error
      if (import.meta.env.DEV) {
        console.warn('STK unavailable, using hosted checkout:', e.message)
      }
    }
  }

  return hostedCheckout({
    publicKey,
    live,
    amount: opts.amount,
    email: opts.email,
    phone: opts.phone,
    apiRef: opts.apiRef,
    comment: opts.comment,
  })
}
