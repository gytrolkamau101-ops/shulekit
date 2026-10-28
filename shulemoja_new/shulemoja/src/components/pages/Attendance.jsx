import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../supabaseClient'
import { planEntitlements } from '../../lib/plans'
import { isOnline, enqueue } from '../../lib/offline'
import { toast } from '../ui'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, btn, th, td } from '../ui'

const STATUSES = ['Present', 'Absent', 'Late', 'Excused']
const today = () => new Date().toISOString().slice(0, 10)

const CAN_MARK = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Teacher']

export default function Attendance({ school, term, user }) {
  const canMark = CAN_MARK.includes(user.role)
  const [grades, setGrades] = useState([])
  const [gradeId, setGradeId] = useState('')
  const [date, setDate] = useState(today())
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({}) // student_id -> status
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name')
      setGrades(data || [])
      setLoading(false)
    })()
  }, [school.id])

  const loadClass = useCallback(async () => {
    if (!gradeId || !term) {
      setStudents([])
      return
    }
    setLoading(true)
    const { data: enrolled } = await supabase
      .from('student_enrollments')
      .select('students(id, admission_no, first_name, last_name)')
      .eq('school_id', school.id)
      .eq('term_id', term.id)
      .eq('grade_id', gradeId)
    const list = (enrolled || []).map((e) => e.students).filter(Boolean)
    list.sort((a, b) => a.first_name.localeCompare(b.first_name))
    setStudents(list)

    const { data: existing } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('school_id', school.id)
      .eq('date', date)
      .in('student_id', list.map((s) => s.id).length ? list.map((s) => s.id) : ['00000000-0000-0000-0000-000000000000'])
    const m = {}
    list.forEach((s) => (m[s.id] = 'Present')) // default everyone present
    ;(existing || []).forEach((r) => (m[r.student_id] = r.status))
    setMarks(m)
    setLoading(false)
  }, [school.id, term, gradeId, date])

  useEffect(() => {
    loadClass()
  }, [loadClass])

  const summary = useMemo(() => {
    const vals = Object.values(marks)
    return {
      present: vals.filter((v) => v === 'Present').length,
      absent: vals.filter((v) => v === 'Absent').length,
      late: vals.filter((v) => v === 'Late').length,
      excused: vals.filter((v) => v === 'Excused').length,
    }
  }, [marks])


  const ent = planEntitlements(school)
  const notifyAbsentParents = () => {
    if (!ent.notifyAbsent) {
      setError('Absent parent alerts are Premium. Upgrade to message absentees in bulk.')
      return
    }

    const absent = students.filter((s) => marks[s.id] === 'Absent' && s.parent_phone)
    if (!absent.length) {
      setError('No absentees with parent phone numbers.')
      return
    }
    if (!confirm(`Open WhatsApp for ${absent.length} absent learner(s)?`)) return
    absent.forEach((s, i) => {
      let p = String(s.parent_phone).replace(/\D/g, '')
      if (p.startsWith('0')) p = '254' + p.slice(1)
      const msg = `Habari, ${s.first_name} ${s.last_name} was marked Absent on ${new Date(date).toLocaleDateString('en-GB')}. — ${school.school_name || 'School'} (ShuleMoja)`
      setTimeout(() => {
        window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, '_blank')
      }, i * 600)
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setInfo('')
    const rows = students.map((s) => ({
      school_id: school.id,
      student_id: s.id,
      date,
      status: marks[s.id] || 'Present',
    }))
    if (!isOnline()) {
      enqueue('attendance_upsert', { rows })
      setSaving(false)
      toast('Saved offline — will sync when back online', 'info')
      return
    }
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'school_id,student_id,date' })
    setSaving(false)
    if (error) return setError(error.message)
    setInfo(`Saved attendance for ${rows.length} student(s) on ${new Date(date).toLocaleDateString('en-GB')}.`)
  }

  if (!term) {
    return (
      <div className="space-y-6">
        <PageTitle>Attendance</PageTitle>
        <NeedTerm />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle>Attendance</PageTitle>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            <option value="">Select grade/class</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.grade_name}
              </option>
            ))}
          </select>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
        </div>
      </Card>

      {gradeId && (
        <Card title="Mark attendance" className="!p-0">
          {loading ? (
            <p className="p-6 text-gray-600">Loading class list...</p>
          ) : students.length === 0 ? (
            <p className="p-6 text-gray-600 text-center">
              No students are enrolled in this grade for the current term yet.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 p-4 border-b text-sm">
                <span className="text-green-700 font-medium">Present: {summary.present}</span>
                <span className="text-red-600 font-medium">Absent: {summary.absent}</span>
                <span className="text-yellow-700 font-medium">Late: {summary.late}</span>
                <span className="text-blue-700 font-medium">Excused: {summary.excused}</span>
              </div>
              <Scroll>
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className={th}>Adm No</th>
                      <th className={th}>Name</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-b">
                        <td className={td}>{s.admission_no}</td>
                        <td className={td}>
                          {s.first_name} {s.last_name}
                        </td>
                        <td className={td}>
                          <div className="flex gap-1 flex-wrap">
                            {STATUSES.map((st) => (
                              <button
                                key={st}
                                type="button"
                                disabled={!canMark}
                                onClick={() => setMarks({ ...marks, [s.id]: st })}
                                className={`px-2.5 py-1 rounded text-xs font-medium border disabled:opacity-60 ${
                                  marks[s.id] === st
                                    ? st === 'Present'
                                      ? 'bg-green-600 text-white border-green-600'
                                      : st === 'Absent'
                                      ? 'bg-red-600 text-white border-red-600'
                                      : st === 'Late'
                                      ? 'bg-yellow-500 text-white border-yellow-500'
                                      : 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-600 border-gray-300'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
              <div className="p-4 space-y-2">
                <Alert>{error}</Alert>
                <Alert kind="ok">{info}</Alert>
                {canMark ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={save} disabled={saving} className={btn}>
                      {saving ? 'Saving...' : 'Save attendance'}
                    </button>
                    <button
                      type="button"
                      onClick={notifyAbsentParents}
                      className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold"
                    >
                      {ent.notifyAbsent ? 'Notify absent (WhatsApp)' : 'Notify absent (Premium)'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">You can view attendance but not edit it.</p>
                )}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
