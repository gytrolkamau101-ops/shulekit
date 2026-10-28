/** Build WhatsApp URL; number like 2547… or 07… */
export function whatsappUrl(raw, text) {
  if (!raw) return null
  let n = String(raw).replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  if (n.length < 9) return null
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${n}${q}`
}

export function smsUrl(raw, text) {
  if (!raw) return null
  let n = String(raw).replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  const body = text ? `?body=${encodeURIComponent(text)}` : ''
  return `sms:${n}${body}`
}
