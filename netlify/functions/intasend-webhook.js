/**
 * IntaSend webhook — endpoint:
 *   https://YOUR-SITE.netlify.app/.netlify/functions/intasend-webhook
 *
 * Env: INTASEND_WEBHOOK_CHALLENGE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const PLAN_DAYS = { basic: 120, premium: 120, trial: 90 }
const PLAN_CAPS = { basic: 250, premium: 500, trial: 250 }

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
  if (challenge && incoming && incoming !== challenge) {
    return { statusCode: 401, body: 'Invalid challenge' }
  }

  const state = (body.state || body.invoice?.state || '').toUpperCase()
  const apiRef = body.api_ref || body.invoice?.api_ref || body.apiRef || ''
  const amount = body.value || body.amount || body.invoice?.amount || null
  const invoiceId = body.invoice_id || body.invoice?.id || null

  let planId = 'basic'
  let schoolId = null
  if (apiRef.startsWith('plan-')) {
    const parts = apiRef.split('-')
    planId = parts[1] || 'basic'
    if (parts.length >= 4 && parts[2].length > 20) schoolId = parts[2]
  } else if (apiRef.startsWith('sk-')) {
    const parts = apiRef.split('-')
    schoolId = parts[1] || null
    planId = 'basic'
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { statusCode: 500, body: 'Server missing SUPABASE_URL or SERVICE_ROLE_KEY' }
  }

  await fetch(`${url}/rest/v1/subscription_events`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      school_id: schoolId,
      api_ref: apiRef,
      invoice_id: invoiceId ? String(invoiceId) : null,
      state,
      amount,
      plan_id: planId,
      raw: body,
    }),
  })

  if (state === 'COMPLETE' || state === 'COMPLETED' || state === 'PAID') {
    if (schoolId) {
      const days = PLAN_DAYS[planId] || 120
      const cap = PLAN_CAPS[planId] || 250
      const exp = new Date()
      exp.setDate(exp.getDate() + days)
      await fetch(`${url}/rest/v1/schools?id=eq.${schoolId}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          plan: planId,
          plan_expires_at: exp.toISOString(),
          student_cap: cap,
        }),
      })
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
