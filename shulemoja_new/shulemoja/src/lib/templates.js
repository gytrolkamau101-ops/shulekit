/** Download Excel-friendly CSV templates and helpers */

export function downloadCsv(filename, rows) {
  const lines = rows.map((row) =>
    row
      .map((cell) => {
        const s = cell == null ? '' : String(cell)
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      })
      .join(',')
  )
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function studentTemplate() {
  downloadCsv('shulekit_students_template.csv', [
    ['admission_no', 'first_name', 'last_name', 'gender', 'date_of_birth', 'date_admitted', 'parent_name', 'parent_phone', 'parent_email', 'status'],
    ['ADM001', 'Jane', 'Wanjiku', 'F', '2015-03-12', '2024-01-15', 'Mary Wanjiku', '0712345678', 'mary@email.com', 'Active'],
  ])
}

export function marksTemplate() {
  downloadCsv('shulekit_marks_template.csv', [
    ['admission_no', 'subject_name', 'marks'],
    ['ADM001', 'Mathematics', '78'],
    ['ADM001', 'English', '82'],
  ])
}

export function feesTemplate() {
  downloadCsv('shulekit_fee_payments_template.csv', [
    ['admission_no', 'amount_paid', 'payment_method', 'receipt_no', 'payment_date', 'notes'],
    ['ADM001', '5000', 'M-Pesa', 'RCPT001', '2024-02-01', 'Term fees'],
  ])
}

export function admissionsTemplate() {
  downloadCsv('shulekit_admissions_template.csv', [
    ['full_name', 'gender', 'date_of_birth', 'guardian_name', 'guardian_phone', 'applying_grade', 'status', 'notes'],
    ['John Otieno', 'M', '2016-05-01', 'Grace Otieno', '0722000000', 'Grade 1', 'enquiry', ''],
  ])
}

/** Parse simple CSV text → array of objects using first row as headers */
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const o = {}
    headers.forEach((h, i) => {
      o[h] = (cols[i] ?? '').trim()
    })
    return o
  })
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}
