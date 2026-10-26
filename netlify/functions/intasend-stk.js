/**
 * Secure M-Pesa STK — amounts set on server only (never trust client amount for plan/fee).
 * Money always settles to the IntaSend account of INTASEND_SECRET_KEY (platform wallet).
 * School till/paybill is for parent instructions / reconciliation — STK cannot be redirected
 * to an arbitrary till without that till's own M-Pesa API credentials.
 *
 * Env: INTASEND_SECRET_KEY, INTASEND_LIVE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const PLAN_PRICES = {
  basic: 2000,
  premium: 4000,
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function normalizeKePhone(phone) {
  if (!phone) return null
  let p = String(phone).replace(/\D/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.startsWith('7') && p.length === 9) p = '254' + p
  if (p.startsWith('1') && p.length === 9) p = '254' + p
  if (!p.startsWith('254') || p.length < 12) return null
  return p
}

async function supabaseUser(jwt) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !jwt) return null
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: key },
  })
  if (!res.ok) return null
  return res.json()
}

async function sb(path, opts = {}) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) }
  }

  const secret = process.env.INTASEND_SECRET_KEY
  const live = String(process.env.INTASEND_LIVE || process.env.VITE_INTASEND_LIVE || 'false').toLowerCase() === 'true'
  if (!secret) {
    return {
      statusCode: 503,
      headers: cors(),
      body: JSON.stringify({
        error: 'STK not configured. Set INTASEND_SECRET_KEY on Netlify (never in the phone app).',
      }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const phone = normalizeKePhone(body.phone_number || body.phone)
  if (!phone) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Valid M-Pesa number required (07… / 2547…)' }) }
  }

  const kind = body.kind || 'platform_subscribe' // platform_subscribe | school_fee | admin_bill
  let amount = 0
  let apiRef = ''
  let email = body.email || undefined
  let meta = {}

  // Optional auth
  const auth = event.headers.authorization || event.headers.Authorization || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const user = jwt ? await supabaseUser(jwt) : null

  if (kind === 'platform_subscribe') {
    const planId = String(body.plan_id || '').toLowerCase()
    if (!PLAN_PRICES[planId]) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid plan' }) }
    }
    // Server sets price — client cannot lower it
    amount = PLAN_PRICES[planId]
    apiRef = `plan-${planId}-pending-${Date.now()}`
    meta = { plan_id: planId, kind }
  } else if (kind === 'school_fee') {
    return {
      statusCode: 403,
      headers: cors(),
      body: JSON.stringify({
        error:
          'School fees are not collected via platform STK. Parents pay the school Till/Paybill; staff record payment in Student Finance.',
      }),
    }
  } else if (kind === 'admin_bill') {
    // Super admin only — verify platform_admins
    if (!user) {
      return { statusCode: 401, headers: cors(), body: JSON.stringify({ error: 'Login required' }) }
    }
    const { data: admins } = await sb(`platform_admins?id=eq.${user.id}&select=id`)
    if (!Array.isArray(admins) || !admins[0]) {
      return { statusCode: 403, headers: cors(), body: JSON.stringify({ error: 'Not a platform admin' }) }
    }
    const schoolId = body.school_id
    let requested = Number(body.amount)
    if (!schoolId || !requested || requested < 1 || requested > 500000) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Valid school_id and amount required' }) }
    }
    amount = Math.round(requested)
    const planId = String(body.plan_id || 'basic').toLowerCase()
    apiRef = `plan-${planId}-${schoolId}-${Date.now()}`
    meta = { kind, school_id: schoolId, plan_id: planId, admin_id: user.id }
  } else {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Unknown payment kind' }) }
  }

  // Log intent before STK
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await sb('subscription_events', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        school_id: meta.school_id || null,
        api_ref: apiRef,
        state: 'STK_INIT',
        amount,
        plan_id: meta.plan_id || null,
        raw: meta,
      }),
    })
  }

  const base = live ? 'https://payment.intasend.com' : 'https://sandbox.intasend.com'
  const phoneMasked = phone.length >= 6 ? phone.slice(0, 5) + '***' + phone.slice(-3) : '***'

  const res = await fetch(`${base}/api/v1/payment/mpesa-stk-push/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      phone_number: phone,
      api_ref: apiRef,
      email,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errMsg = data.detail || data.message || data.error || 'STK failed'
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await sb('subscription_events', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify({
          school_id: meta.school_id || null,
          api_ref: apiRef,
          state: 'FAILED',
          amount,
          plan_id: meta.plan_id || null,
          kind: meta.kind || kind,
          phone_masked: phoneMasked,
          error_message: String(errMsg).slice(0, 500),
          student_id: meta.student_id || null,
          raw: { source: 'stk_push', status: res.status },
        }),
      })
    }
    return {
      statusCode: res.status,
      headers: cors(),
      body: JSON.stringify({ error: errMsg }),
    }
  }

  const invoiceId = data.invoice?.invoice_id || data.invoice_id || null
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await sb('subscription_events', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        school_id: meta.school_id || null,
        api_ref: apiRef,
        invoice_id: invoiceId ? String(invoiceId) : null,
        state: 'STK_SENT',
        amount,
        plan_id: meta.plan_id || null,
        kind: meta.kind || kind,
        phone_masked: phoneMasked,
        student_id: meta.student_id || null,
        raw: { source: 'stk_push' },
      }),
    })
  }

  return {
    statusCode: 200,
    headers: cors(),
    body: JSON.stringify({
      ok: true,
      message: 'STK push sent — enter M-Pesa PIN on your phone',
      amount,
      api_ref: apiRef,
      invoice_id: invoiceId,
    }),
  }
}
