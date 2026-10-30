import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, th, td, btn } from '../ui'
import { planEntitlements } from '../../lib/plans'

export default function ReportCards({ school, term }) {
  const [grades, setGrades] = useState([])
  const [gradeId, setGradeId] = useState('')
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [rows, setRows] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ent = planEntitlements(school)
  const watermark = !!ent.reportWatermark

  useEffect(() => {
    ;(async () => {
      if (!term) return
      const [{ data: g }, { data: e }] = await Promise.all([
        supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
        supabase
          .from('exams')
          .select('*')
          .eq('school_id', school.id)
          .eq('term_id', term.id)
          .order('exam_date', { ascending: false }),
      ])
      setGrades(g || [])
      setExams(e || [])
      if (g?.length) setGradeId((id) => id || g[0].id)
      if (e?.length) setExamId((id) => id || e[0].id)
    })()
  }, [school.id, term])

  const loadReport = useCallback(async () => {
    if (!term || !gradeId || !examId) return
    setLoading(true)
    setError('')
    try {
      const { data: enr } = await supabase
        .from('student_enrollments')
        .select('students(id, admission_no, first_name, last_name, status)')
        .eq('term_id', term.id)
        .eq('grade_id', gradeId)
      const students = (enr || [])
        .map((e) => e.students)
        .filter((s) => s && (!s.status || s.status === 'Active' || s.status === 'Suspended'))
      const [{ data: results }, { data: allSubs }] = await Promise.all([
        supabase
          .from('exam_results')
          .select('student_id, subject_id, marks_obtained, grade, subjects(subject_name)')
          .eq('exam_id', examId)
          .eq('school_id', school.id),
        supabase.from('subjects').select('subject_name').eq('school_id', school.id).order('subject_name'),
      ])
      const subSet = new Set((allSubs || []).map((s) => s.subject_name).filter(Boolean))
      const byStudent = {}
      students.forEach((s) => {
        byStudent[s.id] = { student: s, subjects: {}, total: 0, count: 0 }
      })
      ;(results || []).forEach((r) => {
        const name = r.subjects?.subject_name || String(r.subject_id).slice(0, 6)
        subSet.add(name)
        if (!byStudent[r.student_id]) return
        byStudent[r.student_id].subjects[name] = {
          marks: r.marks_obtained,
          grade: r.grade,
        }
        byStudent[r.student_id].total += Number(r.marks_obtained || 0)
        byStudent[r.student_id].count += 1
      })
      const list = Object.values(byStudent)
        .map((row) => ({
          ...row,
          average: row.count ? (row.total / row.count).toFixed(1) : '—',
        }))
        .sort((a, b) =>
          `${a.student.last_name}${a.student.first_name}`.localeCompare(
            `${b.student.last_name}${b.student.first_name}`
          )
        )
      setSubjects([...subSet].sort())
      setRows(list)
    } catch (e) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [term, gradeId, examId, school.id])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const downloadClassReport = () => {
    const gradeName = grades.find((g) => g.id === gradeId)?.grade_name || 'Class'
    const examName = exams.find((e) => e.id === examId)?.exam_name || 'Exam'
    const logo = school?.logo_url
      ? `<img src="${school.logo_url}" style="max-height:56px;margin:0 auto 6px;display:block"/>`
      : ''
    const wm = watermark
      ? `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.07;font-size:72px;font-weight:900;transform:rotate(-30deg)">ShuleMoja</div>`
      : ''
    const head = subjects.map((s) => `<th style="padding:3px 4px;border:1px solid #cbd5e1;font-size:9px;white-space:nowrap">${s}</th>`).join('')
    const body = rows
      .map((r) => {
        const cells = subjects
          .map((s) => {
            const m = r.subjects[s]
            return `<td style="padding:6px;border:1px solid #e2e8f0;text-align:center;font-size:12px">${m ? m.marks ?? '—' : '—'}</td>`
          })
          .join('')
        return `<tr>
          <td style="padding:6px;border:1px solid #e2e8f0;font-size:12px">${r.student.admission_no || ''}</td>
          <td style="padding:6px;border:1px solid #e2e8f0;font-size:12px">${r.student.first_name} ${r.student.last_name}</td>
          ${cells}
          <td style="padding:6px;border:1px solid #e2e8f0;text-align:center;font-weight:700">${r.average}</td>
        </tr>`
      })
      .join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${gradeName} — ${examName}</title>
      <style>body{font-family:system-ui,sans-serif;margin:20px;color:#0f172a}
      h1,h2{text-align:center;margin:4px 0}.sub{text-align:center;color:#64748b;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse} .foot{text-align:center;margin-top:20px;font-size:10px;color:#94a3b8}
      </style></head><body>
      ${wm}${logo}
      <h1>${school?.school_name || 'School'}</h1>
      <div class="sub">${school?.po_box || ''} ${school?.motto ? '· ' + school.motto : ''}</div>
      <h2>${gradeName} — Class report</h2>
      <div class="sub">${examName} · Term ${term?.term || ''} ${term?.year || ''}</div>
      <table>
        <thead><tr>
          <th style="padding:3px 4px;border:1px solid #cbd5e1;font-size:9px;white-space:nowrap">Adm</th>
          <th style="padding:3px 4px;border:1px solid #cbd5e1;font-size:9px;white-space:nowrap">Name</th>
          ${head}
          <th style="padding:3px 4px;border:1px solid #cbd5e1;font-size:9px;white-space:nowrap">Avg</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="foot">${watermark ? 'Generated with ShuleMoja · Basic plan' : 'ShuleMoja'}</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) {
      setError('Allow pop-ups to download the report')
      return
    }
    w.document.write(html)
    w.document.close()
  }

  if (!term) return <NeedTerm />

  return (
    <div className="space-y-4">
      <PageTitle title="Report cards" subtitle="Class report for the whole grade — print or save as PDF" />
      <Card>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs font-bold text-slate-600">
            Grade
            <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grade_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Exam
            <select className={input} value={examId} onChange={(e) => setExamId(e.target.value)}>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.exam_name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btn} onClick={loadReport} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button type="button" className={btn} onClick={downloadClassReport} disabled={!rows.length}>
            Download class report
          </button>
        </div>
        {watermark && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-3">
            Basic plan: reports include a light ShuleMoja watermark. Upgrade to Premium for clean branding.
          </p>
        )}
        <Alert kind="error">{error}</Alert>
      </Card>
      <Card className="!p-0 overflow-x-auto">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Adm</th>
                <th className={th}>Name</th>
                {subjects.map((s) => (
                  <th key={s} className={th}>
                    {s}
                  </th>
                ))}
                <th className={th}>Avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id}>
                  <td className={td}>{r.student.admission_no}</td>
                  <td className={td}>
                    {r.student.first_name} {r.student.last_name}
                  </td>
                  {subjects.map((s) => (
                    <td key={s} className={td}>
                      {r.subjects[s]?.marks ?? '—'}
                    </td>
                  ))}
                  <td className={td}>{r.average}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
