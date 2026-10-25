/** M-Pesa STK Push — requires INTASEND_SECRET_KEY on Netlify only */

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
      body: JSON.stringify({ error: 'STK not configured (set INTASEND_SECRET_KEY on Netlify)' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const amount = Number(body.amount)
  const phone = body.phone_number || body.phone
  if (!amount || !phone) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'amount and phone_number required' }) }
  }

  const base = live ? 'https://payment.intasend.com' : 'https://sandbox.intasend.com'
  const res = await fetch(`${base}/api/v1/payment/mpesa-stk-push/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      phone_number: phone,
      api_ref: body.api_ref || `stk-${Date.now()}`,
      email: body.email || undefined,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      statusCode: res.status,
      headers: cors(),
      body: JSON.stringify({ error: data.detail || data.message || data.error || 'STK failed', raw: data }),
    }
  }
  return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, ...data }) }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}
