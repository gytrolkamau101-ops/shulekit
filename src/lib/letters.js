/** Compose messages that open WhatsApp / SMS with editable text */

export function waCompose(phone, text) {
  if (!phone) return null
  let n = String(phone).replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  if (n.length < 9) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

export function smsCompose(phone, text) {
  if (!phone) return null
  let n = String(phone).replace(/\D/g, '')
  if (n.startsWith('0')) n = '254' + n.slice(1)
  return `sms:${n}?body=${encodeURIComponent(text)}`
}

export function suspensionLetterText({ schoolName, studentName, admissionNo, reason, date }) {
  return (
    `${schoolName || 'School'}\n` +
    `SUSPENSION NOTICE\n\n` +
    `Student: ${studentName || '—'}${admissionNo ? ` (${admissionNo})` : ''}\n` +
    `Date: ${date || new Date().toLocaleDateString('en-GB')}\n` +
    `Reason: ${reason || 'As discussed with the school administration.'}\n\n` +
    `Please contact the school office for further information.\n` +
    `— Principal / Secretary`
  )
}

export function transferLetterText({ schoolName, studentName, admissionNo, destination, date }) {
  return (
    `${schoolName || 'School'}\n` +
    `TRANSFER / CLEARANCE LETTER\n\n` +
    `This is to confirm that ${studentName || 'the student'}` +
    `${admissionNo ? ` (Adm. ${admissionNo})` : ''} ` +
    `was a learner at ${schoolName || 'our school'}.\n\n` +
    `Effective: ${date || new Date().toLocaleDateString('en-GB')}\n` +
    `${destination ? `Destination: ${destination}\n` : ''}` +
    `\nWe wish them well in their future studies.\n` +
    `— Principal`
  )
}

/** Open printable HTML and trigger print/save as PDF */
export function printBrandedLetter({ school, title, bodyHtml, watermark }) {
  const logo = school?.logo_url
    ? `<img src="${school.logo_url}" style="max-height:64px;margin:0 auto 8px;display:block"/>`
    : ''
  const wm = watermark
    ? `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.08;font-size:64px;font-weight:900;transform:rotate(-28deg);color:#0f172a">ShuleMoja</div>`
    : ''
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
  <style>
    body{font-family:system-ui,Segoe UI,sans-serif;max-width:720px;margin:24px auto;padding:16px;color:#0f172a}
    h1{text-align:center;font-size:20px;margin:4px 0}
    .sub{text-align:center;color:#475569;font-size:13px;margin-bottom:24px}
    .body{line-height:1.55;font-size:14px;white-space:pre-wrap}
    .foot{margin-top:48px;text-align:center;font-size:11px;color:#94a3b8}
  </style></head><body>
  ${wm}
  ${logo}
  <h1>${school?.school_name || 'School'}</h1>
  <div class="sub">${school?.po_box || ''} ${school?.motto ? '· ' + school.motto : ''}</div>
  <h1 style="font-size:16px;margin-top:24px">${title}</h1>
  <div class="body">${bodyHtml}</div>
  <div class="foot">${watermark ? 'Generated with ShuleMoja' : 'ShuleMoja'}</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
