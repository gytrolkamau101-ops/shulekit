/**
 * IntaSend webhook — require challenge; upgrade plans only for known prices.
 * Platform SaaS plans only for auto-upgrade. School fees are paid to school till.
 */

const PLAN_DAYS = { basic: 120, premium: 120, trial: 90 }
const PLAN_CAPS = { basic: 250, premium: 500, trial: 250 }
const PLAN_PRICES = { basic: 2000, premium: 4000 }

export async function handler(event) {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: 'ShuleKit IntaSend webhook OK' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const challenge = process.env.INTASEND_WEBHOOK_CHALLENGE || ''
  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const incoming =
    body.challenge ||
    event.headers['x-intasend-challenge'] ||
    event.headers['X-IntaSend-Challenge'] ||
    ''

  // Require challenge when configured (prevents forged plan upgrades)
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
  let studentId = null
  let feeAmount = null
  let refKind = 'unknown'

  if (apiRef.startsWith('fee-')) {
    refKind = 'fee'
    const parts = apiRef.split('-')
    // fee-{uuid}-{uuid}-{amount}-{ts}
    schoolId = parts[1] || null
    studentId = parts[2] || null
    feeAmount = Number(parts[3]) || amount
  } else if (apiRef.startsWith('plan-')) {
    refKind = 'plan'
    const parts = apiRef.split('-')
    planId = parts[1] || 'basic'
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
      raw: { topic: body.topic, state, api_ref: apiRef }, // strip excess PII in storage if needed
    }),
  })

  if (state !== 'COMPLETE' && state !== 'COMPLETED' && state !== 'PAID') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: state }) }
  }

  if (refKind === 'plan' && schoolId && planId) {
    // Only upgrade if amount matches known plan price (blocks forged cheap upgrades)
    const expected = PLAN_PRICES[planId]
    if (expected != null && amount != null && Number(amount) < expected) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'amount_mismatch' }) }
    }
    const days = PLAN_DAYS[planId] || 120
    const cap = PLAN_CAPS[planId] || 250
    const exp = new Date()
    exp.setDate(exp.getDate() + days)
    await fetch(`${url}/rest/v1/schools?id=eq.${schoolId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        plan: planId,
        plan_expires_at: exp.toISOString(),
        student_cap: cap,
      }),
    })
  }

  // School fee STK via platform is disabled (v23+). Do not auto-insert fee_payments.
  if (refKind === 'fee') {
    // Event already logged in subscription_events above for audit.
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
