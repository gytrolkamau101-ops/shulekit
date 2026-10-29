import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'
import { DESK_ROLES, canEditData } from '../../lib/roles'

export default function StaffDesk({ school, user }) {
  const deskRole = DESK_ROLES.includes(user.role) ? user.role : 'Staff'
  const canPost = DESK_ROLES.includes(user.role) || canEditData(user.role)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ desk_role: deskRole, title: '', body: '', entry_date: new Date().toISOString().slice(0, 10) })

  const load = useCallback(async () => {
    let q = supabase.from('staff_desk_entries').select('*').eq('school_id', school.id).order('entry_date', { ascending: false }).limit(50)
    if (DESK_ROLES.includes(user.role) && !canEditData(user.role)) {
      q = q.eq('desk_role', user.role)
    }
    const { data } = await q
    setRows(data || [])
  }, [school.id, user.role])

  useEffect(() => { load() }, [load])

  const save = async (e) => {
    e.preventDefault()
    if (!canPost) return
    setError('')
    const { error: err } = await supabase.from('staff_desk_entries').insert([{
      school_id: school.id,
      desk_role: form.desk_role,
      title: form.title,
      body: form.body,
      entry_date: form.entry_date,
      created_by: user.id,
    }])
    if (err) return setError(err.message + ' — run 23_v38_modules.sql')
    setForm({ ...form, title: '', body: '' })
    load()
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Staff desk" subtitle="Kitchen menu, watchman notes, matron logs (Premium)" />
      <Alert kind="error">{error}</Alert>
      {canPost && (
        <Card title="New entry">
          <form onSubmit={save} className="space-y-2">
            <select className={input} value={form.desk_role} onChange={(e) => setForm({ ...form, desk_role: e.target.value })}>
              {['Kitchen', 'Watchman', 'Matron', 'Driver', 'Staff'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input className={input} type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            <input className={input} placeholder="Title (e.g. Today menu / Gate log)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <textarea className={input} rows={3} placeholder="Details" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <button className={btnGreen}>Save entry</button>
          </form>
        </Card>
      )}
      <Card title="Log">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead><tr><th className={th}>Date</th><th className={th}>Role</th><th className={th}>Title</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.entry_date}</td>
                  <td className={td}>{r.desk_role}</td>
                  <td className={td}>{r.title}<div className="text-xs text-slate-500 whitespace-pre-wrap">{r.body}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
