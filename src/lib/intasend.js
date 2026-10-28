/**
 * IntaSend client helpers.
 * - STK: server-side only (secret key never in browser). Amounts decided on server.
 * - Hosted checkout: uses platform publishable key only (same wallet as secret).
 * Client cannot choose a different IntaSend account or underpay plans.
 */

import { supabase } from '../supabaseClient'

export function intasendConfig() {
  const publicKey = import.meta.env.VITE_INTASEND_PUBLIC_KEY || ''
  const live = String(import.meta.env.VITE_INTASEND_LIVE || 'false').toLowerCase() === 'true'
  return { publicKey, live }
}

export function normalizeKePhone(phone) {
  if (!phone) return null
  let p = String(phone).replace(/\D/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('7') && p.length === 9) p = '254' + p
  if (p.startsWith('1') && p.length === 9) p = '254' + p
  if (!p.startsWith('254') || p.length < 12) return null
  return p
}

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Platform plan subscribe — server sets amount from plan_id */
export async function payPlatformPlan({ planId, phone, email }) {
  const ph = normalizeKePhone(phone)
  if (!ph) throw new Error('Enter a valid M-Pesa number (07… or 2547…)')
  const res = await fetch('/.netlify/functions/intasend-stk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ kind: 'platform_subscribe', plan_id: planId, phone_number: ph, email }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'STK failed')
  return data
}

/** @deprecated School fees are not collected via platform STK (v23+). */
export async function paySchoolFeeStk() {
  throw new Error('School fees are paid to the school Till/Paybill only. Platform STK is disabled for fees.')
}

/** Super Admin bill school */
export async function payAdminBillStk({ schoolId, amount, phone, planId, email }) {
  const ph = normalizeKePhone(phone)
  if (!ph) throw new Error('Enter a valid M-Pesa number (07… or 2547…)')
  const res = await fetch('/.netlify/functions/intasend-stk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      kind: 'admin_bill',
      school_id: schoolId,
      amount: Number(amount),
      plan_id: planId || 'basic',
      phone_number: ph,
      email,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'STK failed')
  return data
}

/** Hosted checkout fallback — platform public key only (same account as secret) */
export async function hostedCheckoutPlatform({ amount, email, phone, apiRef, comment }) {
  const { publicKey, live } = intasendConfig()
  if (!publicKey) throw new Error('Missing VITE_INTASEND_PUBLIC_KEY')
  const base = live ? 'https://payment.intasend.com' : 'https://sandbox.intasend.com'
  const payload = {
    public_key: publicKey,
    amount: Number(amount),
    currency: 'KES',
    email: email || 'billing@shulekit.app',
    api_ref: apiRef || `shulekit-${Date.now()}`,
    comment: comment || 'ShuleMoja',
    redirect_url: typeof window !== 'undefined' ? window.location.href : undefined,
  }
  const ph = normalizeKePhone(phone)
  if (ph) payload.phone_number = ph
  const res = await fetch(`${base}/api/v1/checkout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.message || data.error || 'Checkout failed')
  const url = data.url || data.checkout_url
  if (!url) throw new Error('No checkout URL')
  window.location.href = url
  return data
}

/**
 * Legacy helper — prefers secure STK for plans when phone present.
 * @deprecated prefer payPlatformPlan / paySchoolFeeStk
 */
export async function payWithIntaSend(opts) {
  if (opts.planId && opts.phone) {
    return payPlatformPlan({ planId: opts.planId, phone: opts.phone, email: opts.email })
  }
  if (opts.preferStk !== false && opts.phone && opts.amount) {
    try {
      const ph = normalizeKePhone(opts.phone)
      const res = await fetch('/.netlify/functions/intasend-stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          kind: opts.kind || 'platform_subscribe',
          plan_id: opts.planId || opts.apiRef?.split('-')[1],
          amount: opts.amount,
          phone_number: ph,
          email: opts.email,
          school_id: opts.schoolId,
          student_id: opts.studentId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return data
      if (import.meta.env.DEV) console.warn('STK failed', data.error)
    } catch (e) {
      if (import.meta.env.DEV) console.warn(e)
    }
  }
  return hostedCheckoutPlatform(opts)
}
