/**
 * Secure M-Pesa STK — amounts set on server only.
 * Env (Netlify): INTASEND_SECRET_KEY, INTASEND_LIVE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const PLAN_PRICES = {
  basic: 2000,
  premium: 3500,
  pro: 5000,
}

/** Map CMS names/ids → canonical plan */
function resolvePlanId(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (PLAN_PRICES[s]) return s
  if (s.includes('pro') && !s.includes('premium')) return 'pro'
  if (s.includes('premium') || s.includes('termly premium') || s === 'yearly' || s === 'termly_premium') return 'premium'
  if (s.includes('basic') || s === 'termly' || s === 'starter') return 'basic'
  if (s.includes('custom')) return null // contact sales
  return null
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
  if (p.startsWith('0') && p.length === 10) p = '254' + p.slice(1)
  if ((p.startsWith('7') || p.startsWith('1')) && p.length === 9) p = '254' + p
  // 2547XXXXXXXX or 2541XXXXXXXX = 12 digits
  if (!/^254[71]\d{8}$/.test(p)) return null
  return p
}

function formatIntasendError(data, status) {
  if (!data) return `STK failed (HTTP ${status})`
  if (typeof data === 'string') return data
  const d = data.detail || data.message || data.error || data.errors
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d
      .map((x) => (typeof x === 'string' ? x : x?.msg || x?.message || JSON.stringify(x)))
      .join('; ')
  }
  if (d && typeof d === 'object') return JSON.stringify(d)
  try {
    return JSON.stringify(data).slice(0, 400)
  } catch {
    return `STK failed (HTTP ${status})`
  }
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
  if (!url || !key) return { ok: false, status: 0, data: null }
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

function intasendBase(live, secret) {
  const isTestKey = String(secret || '').includes('_test_')
  // Prefer official hosts; test keys must hit sandbox
  if (isTestKey || !live) return 'https://sandbox.intasend.com'
  // Current IntaSend docs use api.intasend.com for live STK
  return 'https://api.intasend.com'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'POST only' }) }
  }

  const secret = (process.env.INTASEND_SECRET_KEY || '').trim()
  const liveFlag = String(process.env.INTASEND_LIVE || process.env.VITE_INTASEND_LIVE || 'false').toLowerCase() === 'true'
  if (!secret) {
    return {
      statusCode: 503,
      headers: cors(),
      body: JSON.stringify({
        error:
          'STK not configured. On Netlify → Site settings → Environment variables, set INTASEND_SECRET_KEY (ISSecretKey_…), then redeploy.',
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
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'Valid M-Pesa number required (e.g. 07XXXXXXXX or 2547XXXXXXXX)' }),
    }
  }

  const kind = body.kind || 'platform_subscribe'
  let amount = 0
  let apiRef = ''
  let email = body.email || undefined
  let meta = {}

  const auth = event.headers.authorization || event.headers.Authorization || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const user = jwt ? await supabaseUser(jwt) : null

  if (kind === 'platform_subscribe') {
    const planId = resolvePlanId(body.plan_id || body.plan_name || body.name)
    if (!planId) {
      return {
        statusCode: 400,
        headers: cors(),
        body: JSON.stringify({
          error:
            'Invalid plan. Use plan id basic, premium, or pro (or a name containing those words). Super Admin → Pricing → set id to premium for Termly Premium.',
        }),
      }
    }
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

  amount = Math.round(Number(amount))
  if (!amount || amount < 1) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid amount' }) }
  }

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

  const base = intasendBase(liveFlag, secret)
  const phoneMasked = phone.slice(0, 5) + '***' + phone.slice(-3)

  const payload = {
    amount,
    phone_number: phone,
    api_ref: apiRef,
  }
  if (email) payload.email = email

  let res
  let data = {}
  try {
    res = await fetch(`${base}/api/v1/payment/mpesa-stk-push/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: 'Could not reach IntaSend: ' + (e.message || 'network error') }),
    }
  }

  // Fallback: live secret but api.intasend.com failed → try payment.intasend.com
  if (!res.ok && base === 'https://api.intasend.com') {
    try {
      const res2 = await fetch('https://payment.intasend.com/api/v1/payment/mpesa-stk-push/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data2 = await res2.json().catch(() => ({}))
      if (res2.ok) {
        res = res2
        data = data2
      }
    } catch (_) {}
  }

  if (!res.ok) {
    let errMsg = formatIntasendError(data, res.status)
    const isTestKey = secret.includes('_test_')
    if (res.status === 401 || res.status === 403) {
      errMsg =
        'IntaSend rejected the secret key. Check INTASEND_SECRET_KEY on Netlify matches sandbox vs live (ISSecretKey_test_ vs _live_).'
    } else if (isTestKey && liveFlag) {
      errMsg += ' (You have a TEST secret but INTASEND_LIVE=true — set INTASEND_LIVE=false.)'
    } else if (!isTestKey && !liveFlag) {
      errMsg += ' (You have a LIVE secret but INTASEND_LIVE=false — set INTASEND_LIVE=true.)'
    }

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
          raw: { source: 'stk_push', status: res.status, host: base },
        }),
      })
    }
    return {
      statusCode: res.status >= 400 && res.status < 600 ? res.status : 502,
      headers: cors(),
      body: JSON.stringify({ error: errMsg }),
    }
  }

  const invoiceId = data.invoice?.invoice_id || data.invoice_id || data.id || null
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
        raw: { source: 'stk_push', host: base },
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
