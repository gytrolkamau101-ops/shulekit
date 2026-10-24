import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, btn, th, td } from '../ui'
import { ADMIN } from '../../lib/roles'

const STATUSES = ['enquiry', 'interview', 'accepted', 'rejected', 'enrolled']

export default function Admissions({ school, user }) {
  const canEdit = ADMIN.includes(user.role) || user.role === 'Secretary'
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ full_name: '', guardian_phone: '', applying_grade: '', guardian_name: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('admissions')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false })
    setRows(data || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const add = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('admissions').insert([{ school_id: school.id, ...form, status: 'enquiry' }])
    if (error) return setError(error.message)
    setForm({ full_name: '', guardian_phone: '', applying_grade: '', guardian_name: '' })
    load()
  }

  const setStatus = async (id, status) => {
    await supabase.from('admissions').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <PageTitle>Admissions pipeline</PageTitle>
      {canEdit && (
        <Card title="New enquiry">
          <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={input} placeholder="Learner full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            <input className={input} placeholder="Applying grade / class" value={form.applying_grade} onChange={(e) => setForm({ ...form, applying_grade: e.target.value })} />
            <input className={input} placeholder="Guardian name" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            <input className={input} placeholder="Guardian phone" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
            <Alert>{error}</Alert>
            <button className={`${btnGreen} md:col-span-2`}>Save enquiry</button>
          </form>
        </Card>
      )}
      <Card className="!p-0" title="Pipeline">
        <Scroll>
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Grade</th>
                <th className={th}>Guardian</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className={td}>{r.full_name}</td>
                  <td className={td}>{r.applying_grade || '—'}</td>
                  <td className={td}>
                    {r.guardian_name || '—'}
                    <div className="text-xs text-slate-500">{r.guardian_phone}</div>
                  </td>
                  <td className={td}>
                    {canEdit ? (
                      <select className="border rounded-lg px-2 py-1 text-sm" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      r.status
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className={td} colSpan={4}>
                    No applications yet — or import CSV from Import centre
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
