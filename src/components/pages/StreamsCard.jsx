import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, input, btnGreen, th, td, Scroll, Alert } from '../ui'

export default function StreamsCard({ school }) {
  const [streams, setStreams] = useState([])
  const [grades, setGrades] = useState([])
  const [name, setName] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase.from('streams').select('*, grades(grade_name)').eq('school_id', school.id).order('stream_name'),
      supabase.from('grades').select('id, grade_name').eq('school_id', school.id).order('grade_name'),
    ])
    setStreams(s || [])
    setGrades(g || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return
    const { error: err } = await supabase.from('streams').insert([
      { school_id: school.id, stream_name: name.trim(), grade_id: gradeId || null },
    ])
    if (err) {
      setError(err.message + (err.message.includes('streams') ? ' — run 22_v37_streams_status.sql' : ''))
      return
    }
    setName('')
    setGradeId('')
    load()
  }

  const remove = async (id) => {
    await supabase.from('streams').delete().eq('id', id)
    load()
  }

  return (
    <Card title="Streams (A, B, East, West…)">
      <Alert kind="error">{error}</Alert>
      <form onSubmit={save} className="flex flex-wrap gap-2 items-end mb-3">
        <label className="text-xs font-black uppercase text-slate-600">
          Stream name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. East" required />
        </label>
        <label className="text-xs font-black uppercase text-slate-600">
          Grade (optional)
          <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            <option value="">All grades</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.grade_name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnGreen}>
          Add stream
        </button>
      </form>
      <Scroll>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Stream</th>
              <th className={th}>Grade</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {streams.map((s) => (
              <tr key={s.id}>
                <td className={td}>{s.stream_name}</td>
                <td className={td}>{s.grades?.grade_name || '—'}</td>
                <td className={td}>
                  <button type="button" className="text-xs font-bold text-red-600" onClick={() => remove(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    </Card>
  )
}
