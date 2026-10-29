import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'
import { BOARDING_ROLES, canEditData } from '../../lib/roles'

export default function Boarding({ school, user }) {
  const canEdit = BOARDING_ROLES.includes(user.role) || canEditData(user.role)
  const [houses, setHouses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [houseForm, setHouseForm] = useState({ house_name: '', capacity: 40, matron_name: '' })
  const [asgForm, setAsgForm] = useState({ student_id: '', house_id: '', bed_label: '' })

  const load = useCallback(async () => {
    const [{ data: h }, { data: a }, { data: s }] = await Promise.all([
      supabase.from('boarding_houses').select('*').eq('school_id', school.id).order('house_name'),
      supabase.from('boarding_assignments').select('*, students(first_name,last_name,admission_no), boarding_houses(house_name)').eq('school_id', school.id).eq('status', 'active'),
      supabase.from('students').select('id, first_name, last_name, admission_no').eq('school_id', school.id).eq('status', 'Active').order('last_name').limit(500),
    ])
    setHouses(h || [])
    setAssignments(a || [])
    setStudents(s || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const saveHouse = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setError('')
    const { error: err } = await supabase.from('boarding_houses').insert([{ school_id: school.id, ...houseForm, capacity: Number(houseForm.capacity) || 0 }])
    if (err) return setError(err.message + ' — run 23_v38_modules.sql')
    setHouseForm({ house_name: '', capacity: 40, matron_name: '' })
    load()
  }

  const saveAsg = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setError('')
    const { error: err } = await supabase.from('boarding_assignments').insert([
      { school_id: school.id, student_id: asgForm.student_id, house_id: asgForm.house_id || null, bed_label: asgForm.bed_label || null, status: 'active' },
    ])
    if (err) return setError(err.message)
    setAsgForm({ student_id: '', house_id: '', bed_label: '' })
    load()
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Boarding" subtitle="Houses, beds and boarders (Premium)" />
      <Alert kind="error">{error}</Alert>
      {canEdit && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Add house">
            <form onSubmit={saveHouse} className="space-y-2">
              <input className={input} placeholder="House name" value={houseForm.house_name} onChange={(e) => setHouseForm({ ...houseForm, house_name: e.target.value })} required />
              <input className={input} type="number" placeholder="Capacity" value={houseForm.capacity} onChange={(e) => setHouseForm({ ...houseForm, capacity: e.target.value })} />
              <input className={input} placeholder="Matron name" value={houseForm.matron_name} onChange={(e) => setHouseForm({ ...houseForm, matron_name: e.target.value })} />
              <button className={btnGreen}>Save house</button>
            </form>
          </Card>
          <Card title="Assign boarder">
            <form onSubmit={saveAsg} className="space-y-2">
              <select className={input} value={asgForm.student_id} onChange={(e) => setAsgForm({ ...asgForm, student_id: e.target.value })} required>
                <option value="">Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.admission_no} — {s.first_name} {s.last_name}</option>
                ))}
              </select>
              <select className={input} value={asgForm.house_id} onChange={(e) => setAsgForm({ ...asgForm, house_id: e.target.value })}>
                <option value="">House</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.house_name}</option>
                ))}
              </select>
              <input className={input} placeholder="Bed / dorm label" value={asgForm.bed_label} onChange={(e) => setAsgForm({ ...asgForm, bed_label: e.target.value })} />
              <button className={btnGreen}>Assign</button>
            </form>
          </Card>
        </div>
      )}
      <Card title="Houses">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead><tr><th className={th}>House</th><th className={th}>Capacity</th><th className={th}>Matron</th></tr></thead>
            <tbody>
              {houses.map((h) => (
                <tr key={h.id}><td className={td}>{h.house_name}</td><td className={td}>{h.capacity}</td><td className={td}>{h.matron_name || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
      <Card title="Active boarders">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead><tr><th className={th}>Student</th><th className={th}>House</th><th className={th}>Bed</th></tr></thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className={td}>{a.students?.admission_no} {a.students?.first_name} {a.students?.last_name}</td>
                  <td className={td}>{a.boarding_houses?.house_name || '—'}</td>
                  <td className={td}>{a.bed_label || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
