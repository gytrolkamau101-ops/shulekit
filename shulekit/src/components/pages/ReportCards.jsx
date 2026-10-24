import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, th, td, btn } from '../ui'

export default function ReportCards({ school, term }) {
  const [grades, setGrades] = useState([])
  const [gradeId, setGradeId] = useState('')
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      if (!term) return
      const [{ data: g }, { data: e }] = await Promise.all([
        supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
        supabase.from('exams').select('*').eq('school_id', school.id).eq('term_id', term.id).order('exam_date', { ascending: false }),
      ])
      setGrades(g || [])
      setExams(e || [])
      if (g?.length && !gradeId) setGradeId(g[0].id)
      if (e?.length && !examId) setExamId(e[0].id)
    })()
  }, [school.id, term])

  const loadReport = useCallback(async () => {
    if (!term || !gradeId || !examId) return
    setLoading(true)
    setError('')
    const { data: enr } = await supabase
      .from('student_enrollments')
      .select('students(id, admission_no, first_name, last_name)')
      .eq('term_id', term.id)
      .eq('grade_id', gradeId)
    const students = (enr || []).map((e) => e.students).filter(Boolean)
    const { data: results } = await supabase
      .from('exam_results')
      .select('student_id, subject_id, marks_obtained, grade, subjects(subject_name)')
      .eq('exam_id', examId)
      .eq('school_id', school.id)
    const byStudent = {}
    students.forEach((s) => {
      byStudent[s.id] = { student: s, subjects: {}, total: 0, count: 0 }
    })
    ;(results || []).forEach((r) => {
      if (!byStudent[r.student_id]) return
      byStudent[r.student_id].subjects[r.subjects?.subject_name || r.subject_id] = {
        marks: r.marks_obtained,
        grade: r.grade,
      }
      byStudent[r.student_id].total += Number(r.marks_obtained || 0)
      byStudent[r.student_id].count += 1
    })
    const list = Object.values(byStudent).map((row) => ({
      ...row,
      average: row.count ? row.total / row.count : null,
    }))
    list.sort((a, b) => (b.average || 0) - (a.average || 0))
    setRows(list)
    setLoading(false)
  }, [school.id, term, gradeId, examId])

  useEffect(() => { loadReport() }, [loadReport])

  const subjectNames = Array.from(new Set(rows.flatMap((r) => Object.keys(r.subjects)))).sort()
  const gradeName = grades.find((g) => g.id === gradeId)?.grade_name || ''
  const examName = exams.find((e) => e.id === examId)?.exam_name || ''

  const printCards = () => {
    const w = window.open('', '_blank')
    if (!w) return setError('Allow pop-ups to print report cards')
    const cards = rows.map((r, i) => {
      const subs = subjectNames.map((n) => {
        const x = r.subjects[n]
        return `<tr><td>${n}</td><td>${x ? x.marks : '—'}</td><td>${x?.grade || '—'}</td></tr>`
      }).join('')
      return `<section class="card">
        <header><h1>${school.school_name || 'School'}</h1><p>${school.po_box ? 'P.O. Box ' + school.po_box : ''}${school.physical_address ? ' · ' + school.physical_address : ''}</p><p>${school.motto || 'ShuleKit · Report Card'}</p></header>
        <h2>${r.student.first_name} ${r.student.last_name}</h2>
        <p>Adm: ${r.student.admission_no} · Class: ${gradeName} · ${examName}</p>
        <p>Term ${term.term}, ${term.year} · Position: ${i + 1} of ${rows.length}</p>
        <table><thead><tr><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead><tbody>${subs}</tbody></table>
        <p class="avg"><strong>Average:</strong> ${r.average != null ? r.average.toFixed(1) : '—'}</p>
        <p class="sign">Class teacher ________________ · Principal ________________</p>
        <p class="foot">© BigDataKE Technologies · ShuleKit</p>
      </section>`
    }).join('')
    w.document.write(`<!doctype html><html><head><title>Report Cards</title>
      <style>
        body{font-family:system-ui,sans-serif;color:#0f172a}
        .card{page-break-after:always;border:1px solid #cbd5e1;padding:24px;margin-bottom:16px;border-radius:12px}
        h1{font-size:18px;margin:0}h2{margin:12px 0 4px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:13px}
        th{background:#f1f5f9}.avg{margin-top:12px}.sign{margin-top:28px;font-size:13px}
        .foot{font-size:11px;color:#64748b;margin-top:16px}
      </style></head><body>${cards}<script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  if (!term) return (<div className="space-y-6"><PageTitle>Report Cards</PageTitle><NeedTerm /></div>)

  return (
    <div className="space-y-6">
      <PageTitle right={rows.length > 0 && <button type="button" onClick={printCards} className={btn}>Print / PDF cards</button>}>
        Report Cards
      </PageTitle>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
          <select className={input} value={examId} onChange={(e) => setExamId(e.target.value)}>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
        </div>
        <Alert>{error}</Alert>
      </Card>
      {loading ? <p className="text-slate-600">Loading…</p> : rows.length === 0 ? (
        <Alert kind="ok">No enrolled students or results for this selection.</Alert>
      ) : (
        <Card className="!p-0" title="Class ranking">
          <Scroll>
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className={th}>#</th><th className={th}>Adm</th><th className={th}>Name</th>
                  {subjectNames.map((n) => <th key={n} className={th}>{n}</th>)}
                  <th className={th}>Avg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.student.id} className="border-b">
                    <td className={td}>{i + 1}</td>
                    <td className={td}>{r.student.admission_no}</td>
                    <td className={td}>{r.student.first_name} {r.student.last_name}</td>
                    {subjectNames.map((n) => (
                      <td key={n} className={td}>
                        {r.subjects[n] ? `${r.subjects[n].marks}${r.subjects[n].grade ? ` (${r.subjects[n].grade})` : ''}` : '—'}
                      </td>
                    ))}
                    <td className={`${td} font-semibold`}>{r.average != null ? r.average.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </Card>
      )}
    </div>
  )
}
