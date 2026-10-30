import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'
import { BOM_ROLES, canEditData } from '../../lib/roles'

export default function BomPortal({ school, user }) {
  const canEdit = BOM_ROLES.includes(user?.role) || canEditData(user?.role) || ['Principal','Deputy Principal','Secretary'].includes(user?.role)
  const [ann, setAnn] = useState([])
  const [polls, setPolls] = useState([])
  const [error, setError] = useState('')
  const [aForm, setAForm] = useState({ title: '', body: '' })
  const [pForm, setPForm] = useState({ question: '', options: 'Yes, No, Abstain' })

  const load = useCallback(async () => {
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from('bom_announcements').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('bom_polls').select('*').eq('school_id', school.id).order('created_at', { ascending: false }).limit(20),
    ])
    setAnn(a || [])
    setPolls(p || [])
  }, [school.id])

  useEffect(() => { load() }, [load])

  const postAnn = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    const { error: err } = await supabase.from('bom_announcements').insert([{ school_id: school.id, title: aForm.title, body: aForm.body, created_by: user?.id }])
    if (err) return setError(err.message + ' — run 23_v38_modules.sql')
    setAForm({ title: '', body: '' })
    load()
  }

  const postPoll = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    const options = pForm.options.split(',').map((s) => s.trim()).filter(Boolean)
    const { error: err } = await supabase.from('bom_polls').insert([{ school_id: school.id, question: pForm.question, options, created_by: user?.id }])
    if (err) return setError(err.message)
    setPForm({ question: '', options: 'Yes, No, Abstain' })
    load()
  }

  return (
    <div className="space-y-4">
      <PageTitle title="BOM portal" subtitle="Board announcements and simple polls (Premium)" />
      <Alert kind="error">{error}</Alert>
      {canEdit && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Announcement">
            <form onSubmit={postAnn} className="space-y-2">
              <input className={input} placeholder="Title" value={aForm.title} onChange={(e) => setAForm({ ...aForm, title: e.target.value })} required />
              <textarea className={input} rows={3} placeholder="Body" value={aForm.body} onChange={(e) => setAForm({ ...aForm, body: e.target.value })} required />
              <button className={btnGreen}>Publish</button>
            </form>
          </Card>
          <Card title="New poll">
            <form onSubmit={postPoll} className="space-y-2">
              <input className={input} placeholder="Question" value={pForm.question} onChange={(e) => setPForm({ ...pForm, question: e.target.value })} required />
              <input className={input} placeholder="Options (comma-separated)" value={pForm.options} onChange={(e) => setPForm({ ...pForm, options: e.target.value })} />
              <button className={btnGreen}>Create poll</button>
            </form>
          </Card>
        </div>
      )}
      <Card title="Announcements">
        <ul className="space-y-3">
          {ann.map((a) => (
            <li key={a.id} className="border-b border-slate-100 pb-2">
              <p className="font-bold text-slate-900">{a.title}</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.body}</p>
              <p className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Polls">
        <ul className="space-y-2">
          {polls.map((p) => (
            <li key={p.id} className="text-sm">
              <p className="font-bold">{p.question}</p>
              <p className="text-xs text-slate-500">{(p.options || []).join(' · ')}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
