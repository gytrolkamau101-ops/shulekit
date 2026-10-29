import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, btn, th, td } from '../ui'
import { canEditData } from '../../lib/roles'

const STATUSES = ['enquiry', 'interview', 'accepted', 'rejected', 'enrolled']

export default function Admissions({ school, user }) {
  const canEdit = canEditData(user.role)
  const [rows, setRows] = useState([])
  const [grades, setGrades] = useState([])
  const [streams, setStreams] = useState([])
  const [form, setForm] = useState({
    full_name: '',
    guardian_phone: '',
    guardian_name: '',
    grade_id: '',
    stream_id: '',
    applying_grade: '',
  })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data }, { data: g }, { data: st }] = await Promise.all([
      supabase.from('admissions').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      supabase.from('streams').select('*').eq('school_id', school.id).order('stream_name'),
    ])
    setRows(data || [])
    setGrades(g || [])
    setStreams(st || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const streamsForGrade = form.grade_id
    ? streams.filter((s) => !s.grade_id || s.grade_id === form.grade_id)
    : streams

  const submit = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setError('')
    const gradeName = grades.find((g) => g.id === form.grade_id)?.grade_name || form.applying_grade
    const { error: err } = await supabase.from('admissions').insert([
      {
        school_id: school.id,
        full_name: form.full_name.trim(),
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        applying_grade: gradeName || null,
        grade_id: form.grade_id || null,
        stream_id: form.stream_id || null,
        status: 'enquiry',
      },
    ])
    if (err) {
      setError(err.message + (err.message.includes('stream') ? ' — run 22_v37_streams_status.sql' : ''))
      return
    }
    setForm({ full_name: '', guardian_phone: '', guardian_name: '', grade_id: '', stream_id: '', applying_grade: '' })
    load()
  }

  const setStatus = async (id, status) => {
    if (!canEdit) return
    await supabase.from('admissions').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Admissions" subtitle="Enquiries and applications" />
      {canEdit && (
        <Card title="New enquiry">
          <form onSubmit={submit} className="grid gap-2 md:grid-cols-2">
            <input className={input} placeholder="Learner full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            <input className={input} placeholder="Guardian name" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            <input className={input} placeholder="Guardian phone" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
            <label className="text-xs font-bold text-slate-600">
              Grade
              <select
                className={input}
                value={form.grade_id}
                onChange={(e) => setForm({ ...form, grade_id: e.target.value, stream_id: '' })}
              >
                <option value="">Select grade</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grade_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Stream (optional)
              <select className={input} value={form.stream_id} onChange={(e) => setForm({ ...form, stream_id: e.target.value })}>
                <option value="">—</option>
                {streamsForGrade.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stream_name}
                  </option>
                ))}
              </select>
            </label>
            <Alert kind="error">{error}</Alert>
            <button className={`${btnGreen} md:col-span-2`}>Save enquiry</button>
          </form>
          {grades.length === 0 && (
            <p className="text-xs text-amber-700 mt-2">Add grades in School Setup first. Streams: run SQL 22 then add in Setup.</p>
          )}
        </Card>
      )}
      <Card className="!p-0">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Grade</th>
                <th className={th}>Guardian</th>
                <th className={th}>Status</th>
                {canEdit && <th className={th}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.full_name}</td>
                  <td className={td}>{r.applying_grade || '—'}</td>
                  <td className={td}>
                    {r.guardian_name || '—'}
                    <div className="text-xs text-slate-500">{r.guardian_phone}</div>
                  </td>
                  <td className={td}>{r.status}</td>
                  {canEdit && (
                    <td className={td}>
                      <select className={input} value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
