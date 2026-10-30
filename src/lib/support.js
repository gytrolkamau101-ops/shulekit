/** WhatsApp + SMS helpers (Kenya-friendly). Prefer WA when available; always offer SMS fallback. */

export function normalizePhone(phone) {
  if (!phone) return ''
  let p = String(phone).replace(/\D/g, '')
  if (p.startsWith('0') && p.length === 10) p = '254' + p.slice(1)
  if ((p.startsWith('7') || p.startsWith('1')) && p.length === 9) p = '254' + p
  return p
}

/** Build WhatsApp URL; number like 2547… or 07… */
export function whatsappUrl(phone, text = '') {
  const p = normalizePhone(phone)
  if (!p || p.length < 10) return null
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${p}${q}`
}

/** SMS URL — works on mobile; editable message */
export function smsUrl(phone, text = '') {
  const p = normalizePhone(phone)
  if (!p || p.length < 10) return null
  // iOS prefers &body= ; Android ?body=
  const body = encodeURIComponent(text || '')
  return `sms:${p}?body=${body}&body=${body}`
}

/** tel: link */
export function telUrl(phone) {
  const p = normalizePhone(phone)
  if (!p) return null
  return `tel:+${p}`
}

/**
 * Open best available channel: WhatsApp → SMS → tel.
 * Returns which channel was used or null.
 */
export function openParentNotify(phone, text) {
  const wa = whatsappUrl(phone, text)
  if (wa && typeof window !== 'undefined') {
    window.open(wa, '_blank', 'noopener,noreferrer')
    return 'whatsapp'
  }
  const sms = smsUrl(phone, text)
  if (sms && typeof window !== 'undefined') {
    window.location.href = sms
    return 'sms'
  }
  const tel = telUrl(phone)
  if (tel && typeof window !== 'undefined') {
    window.location.href = tel
    return 'tel'
  }
  return null
}
