/**
 * IntaSend webhook — challenge + optional HMAC, idempotent plan/fee handling.
 * Env: INTASEND_WEBHOOK_CHALLENGE (required for plan upgrades)
 *      INTASEND_WEBHOOK_SECRET (optional HMAC of raw body, hex or base64)
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import crypto from 'crypto'

const PLAN_DAYS = { basic: 120, premium: 120, pro: 120, trial: 90 }
const PLAN_CAPS = { basic: 200, premium: 500, pro: 1000, trial: 250 }
const PLAN_PRICES = { basic: 2000, premium: 3500, pro: 5000 }
const PLAN_STAFF = { basic: 25, premium: 50, pro: 80, trial: 30 }
const PLAN_PARENT = { basic: 150, premium: 350, pro: 800, trial: 200 }

function resolvePlanId(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (PLAN_PRICES[s] != null) return s
  if (s === 'pro' || (s.includes('pro') && !s.includes('premium'))) return 'pro'
  if (s.includes('premium') || s.includes('custom') || s === 'yearly') return 'premium'
  if (s.includes('basic') || s === 'termly') return 'basic'
  return null
}

function timingSafeEqualStr(a, b) {
  try {
    const ba = Buffer.from(String(a))
    const bb = Buffer.from(String(b))
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

function verifyHmac(rawBody, secret, headers) {
  if (!secret) return { ok: true, mode: 'skipped' }
  const sig =
    headers['x-intasend-signature'] ||
    headers['X-IntaSend-Signature'] ||
    headers['x-signature'] ||
    headers['x-hub-signature-256'] ||
    ''
  if (!sig) return { ok: false, mode: 'missing_sig' }
  const clean = String(sig).replace(/^sha256=/i, '').trim()
  const hex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const b64 = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  if (timingSafeEqualStr(clean, hex) || timingSafeEqualStr(clean, b64)) {
    return { ok: true, mode: 'hmac' }
  }
  return { ok: false, mode: 'bad_sig' }
}

async function sbFetch(url, key, path, options = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=minimal',
    ...(options.headers || {}),
  }
  return fetch(`${url}/rest/v1/${path}`, { ...options, headers })
}

export async function handler(event) {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: 'ShuleMoja IntaSend webhook OK' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const rawBody = event.body || '{}'
  const challenge = (process.env.INTASEND_WEBHOOK_CHALLENGE || '').trim()
  const hmacSecret = (process.env.INTASEND_WEBHOOK_SECRET || '').trim()

  const hmac = verifyHmac(rawBody, hmacSecret, event.headers || {})
  if (hmacSecret && !hmac.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: 'invalid_signature', mode: hmac.mode }) }
  }

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const incoming = String(
    body.challenge ||
      event.headers['x-intasend-challenge'] ||
      event.headers['X-IntaSend-Challenge'] ||
      ''
  ).trim()

  if (challenge) {
    if (!incoming || !timingSafeEqualStr(incoming, challenge)) {
      return { statusCode: 401, body: 'Invalid challenge' }
    }
  }

  const state = (body.state || body.invoice?.state || '').toUpperCase()
  const apiRef = body.api_ref || body.invoice?.api_ref || body.apiRef || ''
  const amountRaw = body.value || body.amount || body.invoice?.amount || body.net_amount
  const amount = amountRaw != null ? Number(amountRaw) : null
  const invoiceId = body.invoice_id || body.invoice?.invoice_id || body.invoice?.id || null
  const invKey = invoiceId != null ? String(invoiceId) : null

  let planId = null
  let schoolId = null
  let refKind = 'unknown'
  let studentId = null

  if (apiRef.startsWith('fee-')) {
    refKind = 'fee'
    // fee-{schoolId}-{studentId}-{ts}
    const parts = apiRef.split('-')
    if (parts.length >= 3 && parts[1]?.length > 20) schoolId = parts[1]
    if (parts.length >= 4 && parts[2]?.length > 20) studentId = parts[2]
  } else if (apiRef.startsWith('plan-')) {
    refKind = 'plan'
    const parts = apiRef.split('-')
    planId = resolvePlanId(parts[1]) || null
    if (parts.length >= 4 && parts[2] && parts[2].length > 20) schoolId = parts[2]
  } else if (apiRef.startsWith('sk-')) {
    refKind = 'plan'
    const parts = apiRef.split('-')
    schoolId = parts[1] || null
    planId = 'basic'
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { statusCode: 500, body: 'Server missing SUPABASE_URL or SERVICE_ROLE_KEY' }
  }

  // --- Idempotency: same invoice already applied successfully → no-op ---
  if (invKey) {
    try {
      const q = new URLSearchParams({
        select: 'id,state,plan_id',
        invoice_id: `eq.${invKey}`,
        state: 'in.(COMPLETE,COMPLETED,PAID,APPLIED)',
        limit: '1',
      })
      const prev = await fetch(`${url}/rest/v1/subscription_events?${q}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      if (prev.ok) {
        const rows = await prev.json()
        if (Array.isArray(rows) && rows.length > 0) {
          return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, duplicate: true, invoice_id: invKey }),
          }
        }
      }
    } catch (_) {}
  }

  // Log event (unique invoice_id index may reject duplicates)
  const logRes = await sbFetch(url, key, 'subscription_events', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      school_id: schoolId,
      api_ref: apiRef,
      invoice_id: invKey,
      state,
      amount,
      plan_id: planId,
      student_id: studentId,
      raw: { topic: body.topic, state, api_ref: apiRef, hmac: hmac.mode },
    }),
  })

  if (!logRes.ok) {
    const txt = await logRes.text()
    // Unique violation → treat as already processed
    if (logRes.status === 409 || /duplicate|unique/i.test(txt)) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, duplicate: true }) }
    }
  }

  if (!['COMPLETE', 'COMPLETED', 'PAID'].includes(state)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: state }) }
  }

  // --- Plan upgrade ---
  if (refKind === 'plan' && schoolId && planId) {
    if (!challenge && !hmacSecret) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, skipped: 'auth_not_configured' }),
      }
    }
    const expected = PLAN_PRICES[planId]
    if (expected == null) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'unknown_plan' }) }
    }
    if (amount != null && Number(amount) + 0.01 < expected) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'amount_mismatch', expected, amount }) }
    }
    const days = PLAN_DAYS[planId] || 120
    const exp = new Date()
    exp.setDate(exp.getDate() + days)
    await sbFetch(url, key, `schools?id=eq.${schoolId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        plan: planId,
        plan_expires_at: exp.toISOString(),
        student_cap: PLAN_CAPS[planId] || 200,
        staff_cap: PLAN_STAFF[planId] || 25,
        parent_cap: PLAN_PARENT[planId] || 150,
      }),
    })
    try {
      await sbFetch(url, key, 'rpc/credit_referrer_on_payment', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify({ p_school_id: schoolId, p_plan_id: planId }),
      })
    } catch (_) {}
    // Mark applied
    if (invKey) {
      await sbFetch(url, key, `subscription_events?invoice_id=eq.${encodeURIComponent(invKey)}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'APPLIED', updated_at: new Date().toISOString() }),
      })
    }
  }

  // --- Fee payment: record only if amount looks sane; school confirms offline/M-Pesa till ---
  if (refKind === 'fee' && schoolId && studentId && amount != null && amount > 0) {
    // Optional: refuse absurd amounts
    if (amount > 500000) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'fee_amount_too_high' }) }
    }
    try {
      // Find current term
      const tq = new URLSearchParams({
        select: 'id',
        school_id: `eq.${schoolId}`,
        is_current: 'eq.true',
        limit: '1',
      })
      const tr = await fetch(`${url}/rest/v1/terms?${tq}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      let termId = null
      if (tr.ok) {
        const rows = await tr.json()
        termId = rows?.[0]?.id || null
      }
      await sbFetch(url, key, 'fee_payments', {
        method: 'POST',
        body: JSON.stringify({
          school_id: schoolId,
          student_id: studentId,
          term_id: termId,
          amount_paid: amount,
          payment_method: 'M-Pesa STK',
          payment_date: new Date().toISOString().slice(0, 10),
          receipt_no: invKey || apiRef,
          notes: 'Auto from IntaSend webhook',
        }),
      })
    } catch (_) {}
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
