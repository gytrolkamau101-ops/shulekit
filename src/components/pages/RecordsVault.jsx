import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'
import { canEditData } from '../../lib/roles'
import ImagePicker from '../ImagePicker'

const CATS = ['receipt', 'tender', 'salary', 'contract', 'other']

export default function RecordsVault({ school, user }) {
  const canEdit = canEditData(user.role)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ category: 'receipt', title: '', notes: '', file_url: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('school_records').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(100)
    setRows(data || [])
  }, [school.id])

  useEffect(() => { load() }, [load])

  const save = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setError('')
    const { error: err } = await supabase.from('school_records').insert([{
      school_id: school.id,
      category: form.category,
      title: form.title,
      notes: form.notes || null,
      file_url: form.file_url || null,
      created_by: user.id,
    }])
    if (err) return setError(err.message + ' — run 23_v38_modules.sql')
    setForm({ category: 'receipt', title: '', notes: '', file_url: '' })
    load()
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Records vault" subtitle="Receipts, tenders, salaries (sensitive — Principal/Secretary only)" />
      <Alert kind="error">{error}</Alert>
      {canEdit && (
        <Card title="Add record">
          <form onSubmit={save} className="space-y-2">
            <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <textarea className={input} rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <ImagePicker label="Attach scan / photo" value={form.file_url} onChange={(url) => setForm({ ...form, file_url: url })} maxW={1200} />
            <button className={btnGreen}>Save record</button>
          </form>
        </Card>
      )}
      <Card className="!p-0">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead><tr><th className={th}>Category</th><th className={th}>Title</th><th className={th}>Date</th><th className={th}>File</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.category}</td>
                  <td className={td}>{r.title}<div className="text-xs text-slate-500">{r.notes}</div></td>
                  <td className={td}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                  <td className={td}>{r.file_url ? <a className="text-blue-600 font-semibold" href={r.file_url} target="_blank" rel="noreferrer">Open</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
