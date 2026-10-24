import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'
import { ADMIN } from '../../lib/roles'

export default function Circulars({ school, user }) {
  const canPost = ADMIN.includes(user.role) || user.role === 'Secretary'
  const [list, setList] = useState([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('circulars')
      .select('*')
      .eq('school_id', school.id)
      .order('published_at', { ascending: false })
      .limit(50)
    setList(data || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const post = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('circulars').insert([
      { school_id: school.id, title, body, audience, created_by: user.id },
    ])
    if (error) return setError(error.message)
    setTitle('')
    setBody('')
    load()
  }

  return (
    <div className="space-y-6">
      <PageTitle>Circulars & notices</PageTitle>
      {canPost && (
        <Card title="Post notice">
          <form onSubmit={post} className="space-y-3">
            <input className={input} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <textarea className={`${input} min-h-[100px]`} placeholder="Message / homework / announcement" value={body} onChange={(e) => setBody(e.target.value)} required />
            <select className={input} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">Everyone</option>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
            </select>
            <Alert>{error}</Alert>
            <button className={btnGreen}>Publish</button>
          </form>
        </Card>
      )}
      <Card title="Published" className="!p-0">
        <Scroll>
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Title</th>
                <th className={th}>Audience</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b align-top">
                  <td className={td}>{new Date(c.published_at || c.created_at).toLocaleString('en-GB')}</td>
                  <td className={td}>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap mt-1">{c.body}</p>
                  </td>
                  <td className={td}>{c.audience}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className={td} colSpan={3}>
                    No circulars yet
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
