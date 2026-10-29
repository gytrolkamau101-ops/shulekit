import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, btnGreen, btnGhost, th, td, Modal, toast } from '../ui'
import ImagePicker from '../ImagePicker'
import { suspensionLetterText, transferLetterText, waCompose, printBrandedLetter } from '../../lib/letters'
import { planEntitlements } from '../../lib/plans'

import { canEditData } from '../../lib/roles'
import { assertStudentCap } from '../../lib/caps'

function nullIfEmpty(v) {
  return v === '' || v == null ? null : v
}

const blank = {
  first_name: '',
  last_name: '',
  admission_no: '',
  gender: 'Male',
  grade_id: '',
  date_of_birth: '',
  date_admitted: new Date().toISOString().slice(0, 10),
  parent_name: '',
  parent_phone: '',
  parent_email: '',
  photo_url: '',
}

export default function Students({ school, user, term }) {
  const canEdit = canEditData(user.role)
  const [students, setStudents] = useState([])
  const [enrollMap, setEnrollMap] = useState({}) // student_id -> { enrollment_id, grade_id, grade_name }
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [movingId, setMovingId] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase
        .from('students')
        .select('*')
        .eq('school_id', school.id)
        
        .order('first_name'),
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
    ])
    setStudents(s || [])
    setGrades(g || [])

    if (term) {
      const { data: enr } = await supabase
        .from('student_enrollments')
        .select('id, student_id, grade_id, grades(grade_name)')
        .eq('school_id', school.id)
        .eq('term_id', term.id)
      const map = {}
      ;(enr || []).forEach((e) => {
        map[e.student_id] = { enrollment_id: e.id, grade_id: e.grade_id, grade_name: e.grades?.grade_name }
      })
      setEnrollMap(map)
    } else {
      setEnrollMap({})
    }
    setLoading(false)
  }, [school.id, term])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    const matchesSearch =
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.admission_no.toLowerCase().includes(q)
    const matchesGrade = gradeFilter === 'all' || enrollMap[s.id]?.grade_id === gradeFilter
    return matchesSearch && matchesGrade
  })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (term && !form.grade_id) {
      setError('Select a grade / class so the student is enrolled for the current term.')
      return
    }
    setSaving(true)
    const { grade_id, ...studentFields } = form
    const payload = {
      ...studentFields,
      school_id: school.id,
      date_of_birth: nullIfEmpty(studentFields.date_of_birth),
      parent_name: nullIfEmpty(studentFields.parent_name),
      parent_phone: nullIfEmpty(studentFields.parent_phone),
      parent_email: nullIfEmpty(studentFields.parent_email),
      first_name: (studentFields.first_name || '').trim(),
      last_name: (studentFields.last_name || '').trim(),
      admission_no: (studentFields.admission_no || '').trim(),
    }
    if (!payload.id) {
      try { await assertStudentCap(school) } catch (capErr) { setError(capErr.message); return }
    }
    const { data: created, error } = await supabase
      .from('students')
      .insert([payload]) /* cap checked above */
      .select()
      .single()
    if (error) {
      setSaving(false)
      return setError(
        error.code === '23505' ? 'That admission number is already used by another student.' : error.message
      )
    }
    if (grade_id && term) {
      const { error: enrollErr } = await supabase
        .from('student_enrollments')
        .insert([{ school_id: school.id, student_id: created.id, term_id: term.id, grade_id }])
      if (enrollErr) {
        setSaving(false)
        setError(`Student saved, but could not assign grade: ${enrollErr.message}`)
        setForm(blank)
        setShowForm(false)
        fetchAll()
        return
      }
    }
    setSaving(false)
    setForm(blank)
    setShowForm(false)
    fetchAll()
  }



  const exportNemis = () => {
    const header = ['admission_no', 'first_name', 'last_name', 'gender', 'date_of_birth', 'date_admitted', 'parent_name', 'parent_phone', 'parent_email', 'status', 'nemis_ready']
    const lines = [header.join(',')]
    students.forEach((s) => {
      const row = { ...s, nemis_ready: 'Y' }
      lines.push(
        header
          .map((h) => {
            const v = row[h] ?? ''
            const str = String(v).replace(/"/g, '""')
            return str.includes(',') ? `"${str}"` : str
          })
          .join(',')
      )
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shulekit_students_${school.school_code || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importCsv = async (file) => {
    if (!file || !canEdit) return
    setError('')
    const text = await file.text()
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) return setError('CSV needs a header row and at least one student.')
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
    const idx = (name) => header.indexOf(name)
    const need = ['admission_no', 'first_name', 'last_name']
    for (const n of need) {
      if (idx(n) < 0) return setError(`CSV must include column: ${n}`)
    }
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const admission_no = cols[idx('admission_no')]
      const first_name = cols[idx('first_name')]
      const last_name = cols[idx('last_name')]
      if (!admission_no || !first_name || !last_name) continue
      const genderRaw = idx('gender') >= 0 ? cols[idx('gender')] : 'Male'
      const gender = /f/i.test(genderRaw) ? 'Female' : 'Male'
      rows.push({
        school_id: school.id,
        admission_no,
        first_name,
        last_name,
        gender,
        parent_name: idx('parent_name') >= 0 ? cols[idx('parent_name')] || null : null,
        parent_phone: idx('parent_phone') >= 0 ? cols[idx('parent_phone')] || null : null,
        parent_email: idx('parent_email') >= 0 ? cols[idx('parent_email')] || null : null,
        status: 'Active',
      })
    }
    if (rows.length === 0) return setError('No valid rows found.')
    setSaving(true)
    const { error } = await supabase.from('students').insert(rows)
    setSaving(false)
    if (error) return setError(error.message)
    setError('')
    alert(`Imported ${rows.length} student(s). Assign grades with the class dropdown if needed.`)
    fetchAll()
  }

  const removeStudent = async (s) => {
    if (!confirm(`Remove ${s.first_name} ${s.last_name} from the active list?`)) return
    await supabase.from('students').update({ status: 'Inactive' }).eq('id', s.id)
    fetchAll()
  }

  const setGrade = async (studentId, gradeId) => {
    if (!term) return
    setMovingId(studentId)
    const existing = enrollMap[studentId]
    let err
    if (existing) {
      const { error } = await supabase
        .from('student_enrollments')
        .update({ grade_id: gradeId })
        .eq('id', existing.enrollment_id)
      err = error
    } else {
      const { error } = await supabase
        .from('student_enrollments')
        .insert([{ school_id: school.id, student_id: studentId, term_id: term.id, grade_id: gradeId }])
      err = error
    }
    setMovingId(null)
    if (err) return setError(err.message)
    fetchAll()
  }

  return (
    <div className="space-y-6">
      <PageTitle
        right={
          canEdit && (
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" onClick={exportNemis} className={btnGhost}>
                Export CSV
              </button>
              <label className={`${btnGhost} cursor-pointer`}>
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) importCsv(f)
                    e.target.value = ''
                  }}
                />
              </label>
              <button onClick={() => setShowForm((v) => !v)} className={btnGreen}>
                {showForm ? 'Cancel' : '+ Add student'}
              </button>
            </div>
          )
        }
      >
        Students
      </PageTitle>

      {!term && <NeedTerm />}

      {showForm && canEdit && (
        <Card title="Add new student">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="First name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
            <input
              className={input}
              placeholder="Last name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
            <input
              className={input}
              placeholder="Admission number"
              value={form.admission_no}
              onChange={(e) => setForm({ ...form, admission_no: e.target.value })}
              required
            />
            <select
              className={input}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option>Male</option>
              <option>Female</option>
            </select>
            <select
              className={input}
              value={form.grade_id}
              onChange={(e) => setForm({ ...form, grade_id: e.target.value })}
              disabled={!term}
            >
              <option value="">{term ? 'Assign grade/class (optional)' : 'No current term set'}</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grade_name}
                </option>
              ))}
            </select>
            <div />
            <label className="text-sm text-gray-600 md:col-span-2 -mb-2">Date of birth</label>
            <input
              type="date"
              className={input}
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
            <label className="text-sm text-gray-600 -mb-2">Date admitted</label>
            <input
              type="date"
              className={input}
              value={form.date_admitted}
              onChange={(e) => setForm({ ...form, date_admitted: e.target.value })}
              required
            />
            <input
              className={input}
              placeholder="Parent / guardian name"
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            />
            <input
              className={input}
              placeholder="Parent phone"
              value={form.parent_phone}
              onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
            />
            <input
              className={input}
              placeholder="Parent email (optional, for parent portal)"
              value={form.parent_email}
              onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
            />
            <label className="text-xs font-bold text-slate-600">Status
              <select className={input} value={form.status || 'Active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Transferred">Transferred</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <ImagePicker
                label="Passport photo (optional)"
                value={form.photo_url || ''}
                onChange={(url) => setForm((prev) => ({ ...prev, photo_url: url }))}
                maxW={480}
                previewClass="w-20 h-20 rounded-xl object-cover border-2 border-slate-200 shadow"
              />
            </div>
            <div className="md:col-span-2">
              <Alert>{error}</Alert>
            </div>
            <button disabled={saving} className={`${btnGreen} md:col-span-2`}>
              {saving ? 'Saving...' : 'Save student'}
            </button>
          </form>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <input
          className={`${input} flex-1`}
          placeholder="Search by name or admission number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={input} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="all">All grades</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.grade_name}
            </option>
          ))}
        </select>
      </div>

      <Card className="!p-0">
        {loading ? (
          <p className="p-6 text-gray-600">Loading students...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-gray-600 text-center">No students found</p>
        ) : (
          <Scroll>
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className={th}>Adm No</th>
                  <th className={th}>Name</th>
                  <th className={th}>Gender</th>
                  <th className={th}>Grade {term ? `(${term.term === 1 ? 'Term 1' : `T${term.term}`})` : ''}</th>
                  <th className={th}>Parent contact</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className={td}>{s.admission_no}</td>
                    <td className={td}>
                      {s.first_name} {s.last_name}
                    </td>
                    <td className={td}>{s.gender}</td>
                    <td className={td}>
                      {canEdit && term ? (
                        <select
                          className="p-1.5 border rounded text-sm"
                          value={enrollMap[s.id]?.grade_id || ''}
                          disabled={movingId === s.id}
                          onChange={(e) => setGrade(s.id, e.target.value)}
                        >
                          <option value="">Not assigned</option>
                          {grades.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.grade_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        enrollMap[s.id]?.grade_name || '-'
                      )}
                    </td>
                    <td className={td}>{s.parent_phone || '-'}</td>
                    <td className={td}>
                      <button onClick={() => setSelected(s)} className="text-blue-600 hover:underline mr-3">
                        View
                      </button>
                      {canEdit && (
                        <button onClick={() => removeStudent(s)} className="text-red-600 hover:underline">
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Card>

      {selected && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-40 sk-backdrop-in"
          onClick={() => setSelected(null)}
        >
          <div className="sk-glass rounded-2xl p-6 max-w-sm w-full space-y-2 sk-modal-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold">
              {selected.first_name} {selected.last_name}
            </h3>
            <p className="text-sm text-gray-600">Admission No: {selected.admission_no}</p>
            <p className="text-sm text-gray-600">Grade: {enrollMap[selected.id]?.grade_name || 'Not assigned'}</p>
            <p className="text-sm text-gray-600">Status: {selected.status || 'Active'}</p>
            {canEdit && (
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-200"
                  onClick={async () => {
                    await supabase.from('students').update({ status: 'Suspended' }).eq('id', selected.id)
                    const text = suspensionLetterText({ schoolName: school.school_name, studentName: selected.first_name + ' ' + selected.last_name, admissionNo: selected.admission_no })
                    const wa = waCompose(selected.parent_phone, text)
                    if (wa) window.open(wa, '_blank')
                    printBrandedLetter({ school, title: 'Suspension notice', bodyHtml: text.replace(/\n/g, '<br/>'), watermark: planEntitlements(school).reportWatermark })
                    setSelected(null)
                    load()
                  }}>Suspend + letter</button>
                <button type="button" className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-200 text-slate-900 border border-slate-300"
                  onClick={async () => {
                    await supabase.from('students').update({ status: 'Transferred' }).eq('id', selected.id)
                    const text = transferLetterText({ schoolName: school.school_name, studentName: selected.first_name + ' ' + selected.last_name, admissionNo: selected.admission_no })
                    const wa = waCompose(selected.parent_phone, text)
                    if (wa) window.open(wa, '_blank')
                    printBrandedLetter({ school, title: 'Transfer letter', bodyHtml: text.replace(/\n/g, '<br/>'), watermark: planEntitlements(school).reportWatermark })
                    setSelected(null)
                    load()
                  }}>Transfer + letter</button>
              </div>
            )}
            <p className="text-sm text-gray-600">Gender: {selected.gender}</p>
            <p className="text-sm text-gray-600">
              DOB: {selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-GB') : '-'}
            </p>
            <p className="text-sm text-gray-600">Parent: {selected.parent_name || '-'}</p>
            <p className="text-sm text-gray-600">Phone: {selected.parent_phone || '-'}</p>
            <p className="text-sm text-gray-600">Email: {selected.parent_email || '-'}</p>
            <button onClick={() => setSelected(null)} className={`${btnGhost} w-full mt-2`}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
