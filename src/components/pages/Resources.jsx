import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'

const TYPES = ['Book', 'Material', 'Equipment', 'Furniture', 'Curriculum', 'Exam paper', 'Other']
const CAN_EDIT = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary']
const BUCKET = 'school-resources'

export default function Resources({ school, user }) {
  const canEdit = CAN_EDIT.includes(user.role)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState(TYPES[0])
  const [qty, setQty] = useState(1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [condition, setCondition] = useState('Good')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchResources = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('school_resources').select('*').eq('school_id', school.id).order('resource_name')
    if (filter !== 'all') q = q.eq('resource_type', filter)
    const { data } = await q
    setResources(data || [])
    setLoading(false)
  }, [school.id, filter])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    let file_url = null
    let storage_path = null
    let file_size = null

    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${school.id}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })
      if (upErr) {
        setSaving(false)
        return setError(
          upErr.message.includes('Bucket not found') || upErr.message.includes('not found')
            ? 'Storage bucket "school-resources" not set up yet. In Supabase → Storage create a public or authenticated bucket named school-resources. Record saved without file if you retry without a file.'
            : upErr.message
        )
      }
      storage_path = path
      file_size = file.size
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      file_url = pub?.publicUrl || null
    }

    const { error } = await supabase.from('school_resources').insert([
      {
        school_id: school.id,
        resource_name: name,
        resource_type: type,
        quantity: Number(qty),
        year: Number(year),
        condition,
        notes,
        file_url,
        storage_path,
        file_size,
      },
    ])
    setSaving(false)
    if (error) return setError(error.message)
    setName('')
    setQty(1)
    setNotes('')
    setFile(null)
    setShowForm(false)
    fetchResources()
  }

  const conditionColor = (c) =>
    c === 'Good' ? 'bg-green-100 text-green-800' : c === 'Fair' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'

  return (
    <div className="space-y-6">
      <PageTitle
        right={
          canEdit && (
            <button onClick={() => setShowForm((v) => !v)} className={btnGreen}>
              {showForm ? 'Cancel' : '+ Add resource'}
            </button>
          )
        }
      >
        School Resources
      </PageTitle>

      {showForm && canEdit && (
        <Card title="Add resource / upload file">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={input} placeholder="Resource name" value={name} onChange={(e) => setName(e.target.value)} required />
            <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input type="number" min="1" className={input} placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} required />
            <input type="number" className={input} placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
            <select className={input} value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
            <input className={input} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">File (PDF, image, doc — optional)</label>
              <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf" className={input} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-slate-500">Gallery photos, camera images, or documents</p>
            </div>
            <div className="md:col-span-2">
              <Alert>{error}</Alert>
            </div>
            <button disabled={saving} className={`${btnGreen} md:col-span-2`}>
              {saving ? 'Saving...' : 'Save resource'}
            </button>
          </form>
        </Card>
      )}

      <select className={`${input} w-fit`} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All resources</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <Card className="!p-0">
        {loading ? (
          <p className="p-6 text-gray-600">Loading...</p>
        ) : resources.length === 0 ? (
          <p className="p-6 text-gray-600 text-center">No resources found</p>
        ) : (
          <Scroll>
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Type</th>
                  <th className={th}>Qty</th>
                  <th className={th}>Year</th>
                  <th className={th}>Condition</th>
                  <th className={th}>File</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className={td}>{r.resource_name}</td>
                    <td className={td}>{r.resource_type}</td>
                    <td className={td}>{r.quantity}</td>
                    <td className={td}>{r.year || '—'}</td>
                    <td className={td}>
                      <span className={`text-xs px-2 py-0.5 rounded ${conditionColor(r.condition)}`}>{r.condition || '—'}</span>
                    </td>
                    <td className={td}>
                      {r.file_url ? (
                        <a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Card>
    </div>
  )
}
