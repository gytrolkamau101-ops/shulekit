/**
 * IntaSend webhook — challenge required for plan upgrades; prices must match STK.
 */

const PLAN_DAYS = { basic: 120, premium: 120, pro: 120, trial: 90 }
const PLAN_CAPS = { basic: 200, premium: 500, pro: 1000, trial: 250 }
const PLAN_PRICES = { basic: 2000, premium: 3500, pro: 5000 }
const PLAN_STAFF = { basic: 25, premium: 50, trial: 30 }
const PLAN_PARENT = { basic: 150, premium: 350, trial: 200 }

function resolvePlanId(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (PLAN_PRICES[s] != null) return s
  if (s.includes('premium') || s.includes('pro') || s.includes('custom') || s === 'yearly') return 'premium'
  if (s.includes('basic') || s === 'termly') return 'basic'
  return null
}

export async function handler(event) {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: 'ShuleMoja IntaSend webhook OK' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const challenge = (process.env.INTASEND_WEBHOOK_CHALLENGE || '').trim()
  let body
  try {
    body = JSON.parse(event.body || '{}')
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
    if (!incoming || incoming !== challenge) {
      return { statusCode: 401, body: 'Invalid challenge' }
    }
  }

  const state = (body.state || body.invoice?.state || '').toUpperCase()
  const apiRef = body.api_ref || body.invoice?.api_ref || body.apiRef || ''
  const amountRaw = body.value || body.amount || body.invoice?.amount || body.net_amount
  const amount = amountRaw != null ? Number(amountRaw) : null
  const invoiceId = body.invoice_id || body.invoice?.id || null

  let planId = null
  let schoolId = null
  let refKind = 'unknown'

  if (apiRef.startsWith('fee-')) {
    refKind = 'fee'
  } else if (apiRef.startsWith('plan-')) {
    refKind = 'plan'
    const parts = apiRef.split('-')
    planId = resolvePlanId(parts[1]) || parts[1] || null
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

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }

  await fetch(`${url}/rest/v1/subscription_events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      school_id: schoolId,
      api_ref: apiRef,
      invoice_id: invoiceId ? String(invoiceId) : null,
      state,
      amount,
      plan_id: planId,
      raw: { topic: body.topic, state, api_ref: apiRef },
    }),
  })

  if (!['COMPLETE', 'COMPLETED', 'PAID'].includes(state)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: state }) }
  }

  // Refuse automatic plan upgrades if webhook challenge is not configured
  if (refKind === 'plan' && schoolId && planId) {
    if (!challenge) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, skipped: 'challenge_not_configured' }),
      }
    }
    const expected = PLAN_PRICES[planId]
    if (expected == null) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'unknown_plan' }) }
    }
    if (amount != null && Number(amount) + 0.01 < expected) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'amount_mismatch' }) }
    }
    const days = PLAN_DAYS[planId] || 120
    const exp = new Date()
    exp.setDate(exp.getDate() + days)
    await fetch(`${url}/rest/v1/schools?id=eq.${schoolId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        plan: planId,
        plan_expires_at: exp.toISOString(),
        student_cap: PLAN_CAPS[planId] || 200,
        staff_cap: PLAN_STAFF[planId] || 25,
        parent_cap: PLAN_PARENT[planId] || 150,
      }),
    })
    try {
      await fetch(`${url}/rest/v1/rpc/credit_referrer_on_payment`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ p_school_id: schoolId, p_plan_id: planId }),
      })
    } catch (_) {}
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
