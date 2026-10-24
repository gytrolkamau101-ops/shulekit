import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Alert, PageTitle, btn, btnGreen, toast } from '../ui'
import { studentTemplate, marksTemplate, feesTemplate, admissionsTemplate, parseCsv } from '../../lib/templates'
import { logAudit } from '../../lib/audit'

export default function ImportCenter({ school, term, user }) {
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (kind, file) => {
    setError('')
    setInfo('')
    if (!file) return
    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) return setError('No data rows found. Use the template and save as CSV.')
    setBusy(true)
    try {
      if (kind === 'students') await importStudents(rows)
      else if (kind === 'fees') await importFees(rows)
      else if (kind === 'admissions') await importAdmissions(rows)
      else if (kind === 'marks') setInfo('Marks CSV: open Examinations, pick exam/class/subject, or paste marks there. Template is for offline prep.')
    } catch (e) {
      setError(e.message || String(e))
    }
    setBusy(false)
  }

  const importStudents = async (rows) => {
    let ok = 0
    let fail = 0
    for (const r of rows) {
      if (!r.admission_no || !r.first_name) {
        fail++
        continue
      }
      const { error } = await supabase.from('students').upsert(
        [
          {
            school_id: school.id,
            admission_no: r.admission_no,
            first_name: r.first_name,
            last_name: r.last_name || '',
            gender: r.gender || null,
            date_of_birth: r.date_of_birth || null,
            date_admitted: r.date_admitted || null,
            parent_name: r.parent_name || null,
            parent_phone: r.parent_phone || null,
            parent_email: r.parent_email || null,
            status: r.status || 'Active',
          },
        ],
        { onConflict: 'school_id,admission_no' }
      )
      if (error) fail++
      else ok++
    }
    await logAudit('import.students', 'students', null, { ok, fail })
    setInfo(`Students: ${ok} saved, ${fail} skipped/failed.`)
    toast(`Imported ${ok} students`, 'ok')
  }

  const importFees = async (rows) => {
    if (!term) throw new Error('Set a current term before importing fee payments.')
    const { data: students } = await supabase
      .from('students')
      .select('id, admission_no')
      .eq('school_id', school.id)
    const byAdm = Object.fromEntries((students || []).map((s) => [s.admission_no, s.id]))
    let ok = 0
    let fail = 0
    for (const r of rows) {
      const sid = byAdm[r.admission_no]
      if (!sid || !r.amount_paid) {
        fail++
        continue
      }
      const { error } = await supabase.from('fee_payments').insert([
        {
          school_id: school.id,
          term_id: term.id,
          student_id: sid,
          amount_paid: Number(r.amount_paid),
          payment_method: r.payment_method || 'Cash',
          receipt_no: r.receipt_no || null,
          payment_date: r.payment_date || new Date().toISOString().slice(0, 10),
          notes: r.notes || 'CSV import',
        },
      ])
      if (error) fail++
      else ok++
    }
    setInfo(`Fee payments: ${ok} saved, ${fail} skipped/failed.`)
    toast(`Imported ${ok} payments`, 'ok')
  }

  const importAdmissions = async (rows) => {
    let ok = 0
    for (const r of rows) {
      if (!r.full_name) continue
      const { error } = await supabase.from('admissions').insert([
        {
          school_id: school.id,
          full_name: r.full_name,
          gender: r.gender || null,
          date_of_birth: r.date_of_birth || null,
          guardian_name: r.guardian_name || null,
          guardian_phone: r.guardian_phone || null,
          applying_grade: r.applying_grade || null,
          status: r.status || 'enquiry',
          notes: r.notes || null,
        },
      ])
      if (!error) ok++
    }
    setInfo(`Admissions: ${ok} rows imported.`)
    toast(`Imported ${ok} applications`, 'ok')
  }

  return (
    <div className="space-y-6">
      <PageTitle>Import centre</PageTitle>
      <Card title="How to move from Excel / Word">
        <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-2">
          <li>Download a template below (opens in Excel, Google Sheets, or LibreOffice).</li>
          <li>Copy data from your old Excel/Word into the columns. Save as <strong>CSV (UTF-8)</strong>.</li>
          <li>Upload the CSV here. Word tables: paste into Excel first, then save as CSV.</li>
        </ol>
        <p className="text-xs text-slate-500 mt-3">
          Mobile tip: after download, open the file with Excel or Sheets, edit, export CSV, then upload.
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Students">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={studentTemplate}>
              Download Excel template
            </button>
            <label className={`${btnGreen} cursor-pointer`}>
              {busy ? 'Working…' : 'Upload CSV'}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile('students', e.target.files?.[0])} />
            </label>
          </div>
        </Card>
        <Card title="Fee payments">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={feesTemplate}>
              Download Excel template
            </button>
            <label className={`${btnGreen} cursor-pointer`}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile('fees', e.target.files?.[0])} />
            </label>
          </div>
        </Card>
        <Card title="Exam marks (prep offline)">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={marksTemplate}>
              Download marks template
            </button>
            <p className="text-xs text-slate-500 w-full">Fill offline, then enter under Examinations (or ask for bulk marks upload next).</p>
          </div>
        </Card>
        <Card title="Admissions">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={admissionsTemplate}>
              Download template
            </button>
            <label className={`${btnGreen} cursor-pointer`}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile('admissions', e.target.files?.[0])} />
            </label>
          </div>
        </Card>
      </div>
      <Alert>{error}</Alert>
      <Alert kind="ok">{info}</Alert>
    </div>
  )
}
