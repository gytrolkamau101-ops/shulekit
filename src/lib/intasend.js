/**
 * IntaSend client helpers.
 * STK runs on Netlify Functions only (secret key never in the browser).
 */

import { supabase } from '../supabaseClient'

export function intasendConfig() {
  const publicKey = import.meta.env.VITE_INTASEND_PUBLIC_KEY || ''
  const live = String(import.meta.env.VITE_INTASEND_LIVE || 'false').toLowerCase() === 'true'
  return { publicKey, live }
}

/** Base URL for Netlify functions. Empty = same origin (production Netlify). */
function functionsBase() {
  const b = (import.meta.env.VITE_FUNCTIONS_BASE || '').replace(/\/$/, '')
  return b
}

function stkUrl() {
  const base = functionsBase()
  // Prefer /api/stk alias (netlify.toml) — more reliable than long functions path on some hosts
  return base ? `${base}/api/stk` : '/api/stk'
}

export function normalizePlanId(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (s === 'basic' || s === 'premium' || s === 'pro') return s
  if (s.includes('pro') && !s.includes('premium')) return 'pro'
  if (s.includes('premium') || s.includes('custom') || s.includes('yearly')) return 'premium'
  if (s.includes('basic') || s === 'termly' || s.includes('starter')) return 'basic'
  return s
}

export function normalizeKePhone(phone) {
  if (!phone) return null
  let p = String(phone).replace(/\D/g, '')
  if (p.startsWith('0') && p.length === 10) p = '254' + p.slice(1)
  if ((p.startsWith('7') || p.startsWith('1')) && p.length === 9) p = '254' + p
  if (!/^254[71]\d{8}$/.test(p)) return null
  return p
}

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function postStk(body) {
  const base = functionsBase()
  const origin = base || (typeof window !== 'undefined' ? window.location.origin : '')
  const urls = [
    stkUrl(),
    base ? `${base}/.netlify/functions/intasend-stk` : '/.netlify/functions/intasend-stk',
  ]
  // de-dupe
  const tried = []
  let lastErr = null
  for (const url of urls) {
    if (tried.includes(url)) continue
    tried.push(url)
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      })
    } catch (e) {
      lastErr = new Error(
        'Network error calling STK. On localhost, Netlify functions do not run — use the live site or set VITE_FUNCTIONS_BASE.'
      )
      continue
    }
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        lastErr = new Error(
          'STK got HTML instead of the function (404/SPA). Open ' + origin + '/api/stk — need JSON. Deploy latest and use live Netlify URL.'
        )
        continue
      }
      lastErr = new Error(text.slice(0, 200) || `STK failed (HTTP ${res.status})`)
      continue
    }
    if (res.status === 404) {
      lastErr = new Error('STK 404 at ' + url)
      continue
    }
    if (!res.ok) {
      throw new Error(data.error || data.message || `STK failed (HTTP ${res.status})`)
    }
    return data
  }
  throw lastErr || new Error('STK failed (HTTP 404): function not found on this host')
}

/** Platform plan subscribe — server sets amount from plan_id */
export async function payPlatformPlan({ planId, planName, phone, email }) {
  const ph = normalizeKePhone(phone)
  if (!ph) throw new Error('Enter a valid M-Pesa number (07XXXXXXXX or 2547XXXXXXXX)')
  const resolved = normalizePlanId(planId) || normalizePlanId(planName)
  if (!['basic', 'premium', 'pro'].includes(resolved)) {
    throw new Error(
      'Invalid plan "' + (planId || planName || '') + '". Use Basic or Premium (termly). Super Admin → Pricing: id must be basic or premium.'
    )
  }
  return postStk({
    kind: 'platform_subscribe',
    plan_id: resolved,
    plan_name: planName || planId,
    phone_number: ph,
    email,
  })
}

/** @deprecated School fees are not collected via platform STK */
export async function paySchoolFeeStk() {
  throw new Error('School fees are paid to the school Till/Paybill only. Platform STK is disabled for fees.')
}

/** Super Admin bill school */
export async function payAdminBillStk({ schoolId, amount, phone, planId, email }) {
  const ph = normalizeKePhone(phone)
  if (!ph) throw new Error('Enter a valid M-Pesa number (07XXXXXXXX or 2547XXXXXXXX)')
  return postStk({
    kind: 'admin_bill',
    school_id: schoolId,
    amount: Number(amount),
    plan_id: planId,
    phone_number: ph,
    email,
  })
}

/** Hosted checkout fallback — platform public key only */
export async function hostedCheckoutPlatform({ amount, email, phone, apiRef, comment }) {
  const { publicKey, live } = intasendConfig()
  if (!publicKey) throw new Error('Missing VITE_INTASEND_PUBLIC_KEY in Netlify env')
  const base = live ? 'https://api.intasend.com' : 'https://sandbox.intasend.com'
  const payload = {
    public_key: publicKey,
    amount: Number(amount),
    currency: 'KES',
    email: email || 'billing@shulemoja.app',
    api_ref: apiRef || `shulemoja-${Date.now()}`,
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
  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : data.message || data.error || 'Checkout failed'
    throw new Error(msg)
  }
  const url = data.url || data.checkout_url
  if (!url) throw new Error('No checkout URL from IntaSend')
  window.location.href = url
  return data
}

export async function payWithIntaSend(opts) {
  if (opts.planId && opts.phone) {
    return payPlatformPlan({ planId: opts.planId, phone: opts.phone, email: opts.email })
  }
  return hostedCheckoutPlatform(opts)
}
