import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btn, btnGreen, btnGhost, th, td, fmt } from '../ui'
import { logAudit } from '../../lib/audit'

const TABS = ['School identity', 'Terms', 'Grades & Subjects', 'Class subjects', 'Baskets', 'Grading', 'Fee Structure', 'Fee heads', 'Payments', 'Promotion', 'Calendar', 'Staff', 'Parents', 'Audit']

export default function Setup({ school, user, term, onTermChange }) {
  const [tab, setTab] = useState('Terms')
  return (
    <div className="space-y-6">
      <PageTitle>School Setup</PageTitle>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'School identity' && <SchoolIdentityTab school={school} user={user} />}
      {tab === 'Terms' && <TermsTab school={school} term={term} onTermChange={onTermChange} />}
      {tab === 'Grades & Subjects' && <GradesSubjectsTab school={school} />}
      {tab === 'Class subjects' && <ClassSubjectsTab school={school} term={term} />}
      {tab === 'Baskets' && <BasketsTab school={school} term={term} />}
      {tab === 'Grading' && <GradingTab school={school} />}
      {tab === 'Fee Structure' && <FeeStructureTab school={school} term={term} />}
      {tab === 'Fee heads' && <FeeHeadsTab school={school} />}
      {tab === 'Calendar' && <CalendarTab school={school} />}
      {tab === 'Payments' && <PaymentSettingsTab school={school} />}
      {tab === 'Promotion' && <PromotionTab school={school} term={term} user={user} />}
      {tab === 'Staff' && <StaffTab school={school} user={user} />}
      {tab === 'Parents' && <ParentsTab school={school} />}
      {tab === 'Audit' && <AuditTab school={school} />}
    </div>
  )
}

// ---------------- Terms ----------------
function TermsTab({ school, term, onTermChange }) {
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [num, setNum] = useState(1)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  const fetchTerms = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('terms')
      .select('*')
      .eq('school_id', school.id)
      .order('year', { ascending: false })
      .order('term', { ascending: false })
    setTerms(data || [])
    setLoading(false)
  }, [school.id])

  useEffect(() => {
    fetchTerms()
  }, [fetchTerms])

  const resetForm = () => {
    setEditId(null)
    setYear(new Date().getFullYear())
    setNum(1)
    setStart('')
    setEnd('')
  }

  const startEdit = (t) => {
    setEditId(t.id)
    setYear(t.year)
    setNum(t.term)
    setStart(t.start_date)
    setEnd(t.end_date)
    setError('')
  }

  const saveTerm = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      school_id: school.id,
      year: Number(year),
      term: Number(num),
      start_date: start,
      end_date: end,
    }
    let err
    if (editId) {
      const { error } = await supabase.from('terms').update(payload).eq('id', editId)
      err = error
      if (!error) await logAudit('term.update', 'terms', editId, payload)
    } else {
      const { data, error } = await supabase.from('terms').insert([payload]).select('id').single()
      err = error
      if (!error) await logAudit('term.create', 'terms', data?.id, payload)
    }
    setSaving(false)
    if (err) return setError(err.code === '23505' ? 'That term already exists.' : err.message)
    resetForm()
    fetchTerms()
    onTermChange?.()
  }

  const makeCurrent = async (t) => {
    setError('')
    const prev = terms.find((x) => x.is_current && x.id !== t.id)
    const { error: e1 } = await supabase.from('terms').update({ is_current: false }).eq('school_id', school.id)
    if (e1) return setError(e1.message)
    const { error: e2 } = await supabase.from('terms').update({ is_current: true }).eq('id', t.id)
    if (e2) return setError(e2.message)
    await logAudit('term.set_current', 'terms', t.id, { term: t.term, year: t.year })
    if (prev && confirm('Carry forward unpaid fee balances from the previous current term into this term as arrears?')) {
      const { data, error: cfErr } = await supabase.rpc('carry_forward_fee_arrears', {
        p_school_id: school.id,
        p_from_term_id: prev.id,
        p_to_term_id: t.id,
      })
      if (cfErr) setError('Term set current, but carry-forward failed: ' + cfErr.message)
      else if (data != null) alert(`Carried forward balances for ${data} student(s).`)
    }
    fetchTerms()
    onTermChange?.()
  }

  const deleteTerm = async (t) => {
    if (t.is_current) {
      setError('Cannot delete the current term. Set another term as current first.')
      return
    }
    if (!confirm(`Delete Term ${t.term}, ${t.year}? Related fees/exams for this term may block delete if data exists.`)) return
    setError('')
    const { error } = await supabase.from('terms').delete().eq('id', t.id)
    if (error) {
      setError(
        error.code === '23503'
          ? 'Cannot delete: this term still has linked data (fees, exams, or enrollments). Remove those first or keep the term.'
          : error.message
      )
      return
    }
    await logAudit('term.delete', 'terms', t.id, { term: t.term, year: t.year })
    if (editId === t.id) resetForm()
    fetchTerms()
    onTermChange?.()
  }

  return (
    <div className="space-y-6">
      <Card title="Current term">
        <p className="text-gray-700">
          {term ? (
            <>
              <strong>
                Term {term.term}, {term.year}
              </strong>{' '}
              is active ({new Date(term.start_date).toLocaleDateString('en-GB')} &ndash;{' '}
              {new Date(term.end_date).toLocaleDateString('en-GB')})
            </>
          ) : (
            'No current term set yet. Add one below, then tap "Set as current".'
          )}
        </p>
      </Card>

      <Card title={editId ? 'Edit term' : 'Add a term'}>
        <form onSubmit={saveTerm} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="number"
            className={input}
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
          />
          <select className={input} value={num} onChange={(e) => setNum(e.target.value)}>
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
          <input type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} required />
          <input type="date" className={input} value={end} onChange={(e) => setEnd(e.target.value)} required />
          <div className="md:col-span-4">
            <Alert>{error}</Alert>
          </div>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <button disabled={saving} className={btnGreen}>
              {saving ? 'Saving...' : editId ? 'Update term' : 'Add term'}
            </button>
            {editId && (
              <button type="button" onClick={resetForm} className={btnGhost}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card title="All terms" className="!p-0">
        {loading ? (
          <p className="p-6 text-gray-600">Loading...</p>
        ) : (
          <Scroll>
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className={th}>Term</th>
                  <th className={th}>Year</th>
                  <th className={th}>Dates</th>
                  <th className={th}>Status</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className={td}>Term {t.term}</td>
                    <td className={td}>{t.year}</td>
                    <td className={td}>
                      {new Date(t.start_date).toLocaleDateString('en-GB')} &ndash;{' '}
                      {new Date(t.end_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className={td}>
                      {t.is_current ? (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">Current</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={`${td} space-x-2 whitespace-nowrap`}>
                      {!t.is_current && (
                        <button onClick={() => makeCurrent(t)} className="text-blue-600 hover:underline text-sm">
                          Set current
                        </button>
                      )}
                      <button onClick={() => startEdit(t)} className="text-indigo-600 hover:underline text-sm">
                        Edit
                      </button>
                      <button onClick={() => deleteTerm(t)} className="text-red-600 hover:underline text-sm">
                        Delete
                      </button>
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

// ---------------- Grades & Subjects ----------------
function GradesSubjectsTab({ school }) {
  const [grades, setGrades] = useState([])
  const [subjects, setSubjects] = useState([])
  const [gradeName, setGradeName] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('subject_name'),
    ])
    setGrades(g || [])
    setSubjects(s || [])
    setLoading(false)
  }, [school.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const addGrade = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('grades').insert([{ school_id: school.id, grade_name: gradeName }])
    if (error) return setError(error.code === '23505' ? 'That grade already exists.' : error.message)
    setGradeName('')
    fetchAll()
  }

  const addSubject = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('subjects').insert([{ school_id: school.id, subject_name: subjectName }])
    if (error) return setError(error.code === '23505' ? 'That subject already exists.' : error.message)
    setSubjectName('')
    fetchAll()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card title="Grades / classes">
        <form onSubmit={addGrade} className="flex gap-2 mb-4">
          <input
            className={input}
            placeholder="e.g. Grade 4, Form 2"
            value={gradeName}
            onChange={(e) => setGradeName(e.target.value)}
            required
          />
          <button className={btnGreen}>Add</button>
        </form>
        {loading ? (
          <p className="text-gray-600 text-sm">Loading...</p>
        ) : (
          <ul className="divide-y">
            {grades.map((g) => (
              <li key={g.id} className="py-2 text-gray-800">
                {g.grade_name}
              </li>
            ))}
            {grades.length === 0 && <p className="text-gray-500 text-sm py-2">No grades yet</p>}
          </ul>
        )}
      </Card>

      <Card title="Subjects">
        <form onSubmit={addSubject} className="flex gap-2 mb-4">
          <input
            className={input}
            placeholder="e.g. Mathematics"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <button className={btnGreen}>Add</button>
        </form>
        {loading ? (
          <p className="text-gray-600 text-sm">Loading...</p>
        ) : (
          <ul className="divide-y">
            {subjects.map((s) => (
              <li key={s.id} className="py-2 text-gray-800">
                {s.subject_name}
              </li>
            ))}
            {subjects.length === 0 && <p className="text-gray-500 text-sm py-2">No subjects yet</p>}
          </ul>
        )}
      </Card>

      <div className="md:col-span-2">
        <Alert>{error}</Alert>
      </div>
    </div>
  )
}

// ---------------- Fee Structure ----------------
function FeeStructureTab({ school, term }) {
  const [grades, setGrades] = useState([])
  const [structures, setStructures] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    if (!term) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: g }, { data: fs }] = await Promise.all([
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      supabase.from('fee_structures').select('*').eq('school_id', school.id).eq('term_id', term.id),
    ])
    setGrades(g || [])
    const map = {}
    ;(fs || []).forEach((f) => (map[f.grade_id] = f.total_fee))
    setStructures(map)
    setLoading(false)
  }, [school.id, term])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const save = async (gradeId) => {
    setError('')
    setSaving(gradeId)
    const amount = Number(structures[gradeId] || 0)
    const { error } = await supabase
      .from('fee_structures')
      .upsert(
        [{ school_id: school.id, term_id: term.id, grade_id: gradeId, total_fee: amount }],
        { onConflict: 'school_id,term_id,grade_id' }
      )
    setSaving('')
    if (error) setError(error.message)
  }

  if (!term) {
    return <Alert>Set a current term in the Terms tab first.</Alert>
  }

  return (
    <Card title={`Fee per grade — Term ${term.term}, ${term.year}`}>
      <Alert>{error}</Alert>
      {loading ? (
        <p className="text-gray-600 text-sm">Loading...</p>
      ) : grades.length === 0 ? (
        <p className="text-gray-500 text-sm">Add grades first, in the Grades &amp; Subjects tab.</p>
      ) : (
        <div className="space-y-3 mt-2">
          {grades.map((g) => (
            <div key={g.id} className="flex items-center gap-3">
              <span className="w-32 text-gray-700">{g.grade_name}</span>
              <input
                type="number"
                min="0"
                className={`${input} flex-1`}
                placeholder="Total fee (KES)"
                value={structures[g.id] ?? ''}
                onChange={(e) => setStructures({ ...structures, [g.id]: e.target.value })}
              />
              <button onClick={() => save(g.id)} disabled={saving === g.id} className={btn}>
                {saving === g.id ? '...' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---------------- Calendar ----------------
function CalendarTab({ school }) {
  const [events, setEvents] = useState([])
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('school_events')
      .select('*')
      .eq('school_id', school.id)
      .order('event_date')
    setEvents(data || [])
    setLoading(false)
  }, [school.id])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const addEvent = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase
      .from('school_events')
      .insert([{ school_id: school.id, event_name: name, event_date: date, description: desc }])
    if (error) return setError(error.message)
    setName('')
    setDate('')
    setDesc('')
    fetchEvents()
  }

  return (
    <div className="space-y-6">
      <Card title="CBC / curriculum grade templates">
        <p className="text-sm text-slate-600 mb-2">Seed standard Kenyan grade names and stages for this school.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGreen} onClick={async () => {
            const { error } = await supabase.rpc('seed_cbc_primary_grades', { p_school_id: school.id })
            if (error) alert(error.message); else { alert('Primary CBC grades seeded'); window.location.reload() }
          }}>Seed primary CBC grades</button>
          <button type="button" className={btn} onClick={async () => {
            const { error } = await supabase.rpc('seed_secondary_grades', { p_school_id: school.id })
            if (error) alert(error.message); else { alert('Secondary grades seeded'); window.location.reload() }
          }}>Seed secondary Forms 1–4</button>
        </div>
      </Card>

      <Card title="Add event">
        <form onSubmit={addEvent} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className={input} placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
          <input className={input} placeholder="Notes (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="md:col-span-3">
            <Alert>{error}</Alert>
          </div>
          <button className={`${btnGreen} md:col-span-3`}>Add event</button>
        </form>
      </Card>
      <Card title="All events" className="!p-0">
        {loading ? (
          <p className="p-6 text-gray-600">Loading...</p>
        ) : events.length === 0 ? (
          <p className="p-6 text-gray-600 text-center">No events yet</p>
        ) : (
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="p-4">
                <p className="font-semibold text-gray-800">{e.event_name}</p>
                <p className="text-sm text-gray-600">{new Date(e.event_date).toLocaleDateString('en-GB')}</p>
                {e.description && <p className="text-sm text-gray-700 mt-1">{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}



// ---------------- Subject baskets ----------------


function FeeHeadsTab({ school }) {
  const [heads, setHeads] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('fee_heads').select('*').eq('school_id', school.id).order('head_name')
    setHeads(data || [])
  }, [school.id])
  useEffect(() => { load() }, [load])
  const add = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('fee_heads').insert([{ school_id: school.id, head_name: name.trim() }])
    if (error) return setError(error.message)
    setName('')
    load()
  }
  return (
    <Card title="Fee heads (tuition, lunch, transport…)">
      <p className="text-sm text-slate-600 mb-3">Define components. Use totals on Fee Structure for now; itemized amounts can deepen later.</p>
      <form onSubmit={add} className="flex gap-2">
        <input className={input} placeholder="e.g. Tuition" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className={btnGreen}>Add</button>
      </form>
      <Alert>{error}</Alert>
      <ul className="mt-3 text-sm space-y-1">
        {heads.map((h) => <li key={h.id}>{h.head_name}</li>)}
      </ul>
    </Card>
  )
}


function SchoolIdentityTab({ school, user }) {
  const canEdit = ['Principal', 'Deputy Principal'].includes(user?.role)
  const [form, setForm] = useState({
    school_name: school.school_name || '',
    logo_url: school.logo_url || '',
    po_box: school.po_box || '',
    physical_address: school.physical_address || '',
    motto: school.motto || '',
    phone: school.phone || '',
    email: school.email || '',
  })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const save = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    if (!canEdit) return setError('Only Principal / Deputy can edit school identity.')
    const { error } = await supabase.from('schools').update(form).eq('id', school.id)
    if (error) return setError(error.message)
    setOk('Saved — used on receipts and report cards.')
  }
  return (
    <Card title="School identity (receipts & reports)">
      <form onSubmit={save} className="space-y-3">
        <input className={input} placeholder="School name" value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} required disabled={!canEdit} />
        <input className={input} placeholder="Logo URL (https://…)" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} disabled={!canEdit} />
        <input className={input} placeholder="P.O. Box" value={form.po_box} onChange={(e) => setForm({ ...form, po_box: e.target.value })} disabled={!canEdit} />
        <input className={input} placeholder="Physical address" value={form.physical_address} onChange={(e) => setForm({ ...form, physical_address: e.target.value })} disabled={!canEdit} />
        <input className={input} placeholder="Motto" value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} disabled={!canEdit} />
        <input className={input} placeholder="School phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} />
        <input className={input} placeholder="School email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canEdit} />
        <Alert>{error}</Alert>
        <Alert kind="ok">{ok}</Alert>
        {canEdit && <button className={btnGreen}>Save identity</button>}
      </form>
    </Card>
  )
}

function ClassSubjectsTab({ school, term }) {
  const [grades, setGrades] = useState([])
  const [subjects, setSubjects] = useState([])
  const [gradeId, setGradeId] = useState('')
  const [picked, setPicked] = useState({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('subject_name'),
    ])
    setGrades(g || [])
    setSubjects(s || [])
    if (!gradeId && g?.length) setGradeId(g[0].id)
  }, [school.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    ;(async () => {
      if (!gradeId || !term) { setPicked({}); return }
      const { data } = await supabase
        .from('subject_allocations')
        .select('subject_id')
        .eq('school_id', school.id)
        .eq('grade_id', gradeId)
        .eq('term_id', term.id)
      const map = {}
      ;(data || []).forEach((r) => { map[r.subject_id] = true })
      setPicked(map)
    })()
  }, [gradeId, term, school.id])

  const save = async () => {
    setError('')
    setOk('')
    if (!term) return setError('Set a current term first.')
    if (!gradeId) return setError('Choose a class.')
    setSaving(true)
    await supabase.from('subject_allocations').delete()
      .eq('school_id', school.id).eq('grade_id', gradeId).eq('term_id', term.id)
    const ids = Object.keys(picked).filter((id) => picked[id])
    if (ids.length) {
      const rows = ids.map((subject_id) => ({
        school_id: school.id,
        grade_id: gradeId,
        subject_id,
        term_id: term.id,
      }))
      const { error } = await supabase.from('subject_allocations').insert(rows)
      if (error) { setSaving(false); return setError(error.message) }
    }
    setSaving(false)
    setOk(`Saved ${ids.length} subject(s) for this class.`)
    try { await logAudit('subjects.allocate', 'subject_allocations', gradeId, { count: ids.length }) } catch (_) {}
  }

  return (
    <div className="space-y-6">
      <Card title="Subjects per class">
        <p className="text-sm text-slate-600 mb-3">
          1) Add all school subjects under <strong>Grades &amp; Subjects</strong>.
          2) Pick a class below and tick the subjects taught in that class this term.
          (Optional baskets remain under Baskets for grouping.)
        </p>
        {!term ? (
          <Alert kind="warn">Set a current term first.</Alert>
        ) : (
          <>
            <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.grade_name}</option>
              ))}
            </select>
            {subjects.length === 0 ? (
              <Alert kind="warn">No subjects yet. Add them under Grades &amp; Subjects.</Alert>
            ) : (
              <div className="mt-3 max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!!picked[s.id]}
                      onChange={(e) => setPicked((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                    />
                    <span className="font-medium">{s.subject_name}</span>
                  </label>
                ))}
              </div>
            )}
            <Alert>{error}</Alert>
            <Alert kind="ok">{ok}</Alert>
            <button type="button" disabled={saving} onClick={save} className={`${btnGreen} mt-3`}>
              {saving ? 'Saving…' : 'Save subjects for this class'}
            </button>
          </>
        )}
      </Card>
    </div>
  )
}

function BasketsTab({ school, term }) {
  const [baskets, setBaskets] = useState([])
  const [subjects, setSubjects] = useState([])
  const [grades, setGrades] = useState([])
  const [items, setItems] = useState({})
  const [assignments, setAssignments] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [basketId, setBasketId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [assignBasket, setAssignBasket] = useState('')

  const load = useCallback(async () => {
    const [{ data: b }, { data: s }, { data: g }, { data: it }] = await Promise.all([
      supabase.from('subject_baskets').select('*').eq('school_id', school.id).order('basket_name'),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('subject_name'),
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      supabase.from('subject_basket_items').select('*, subjects(subject_name)').eq('school_id', school.id),
    ])
    setBaskets(b || [])
    setSubjects(s || [])
    setGrades(g || [])
    const map = {}
    ;(it || []).forEach((row) => {
      if (!map[row.basket_id]) map[row.basket_id] = []
      map[row.basket_id].push(row)
    })
    setItems(map)
    if (term) {
      const { data: a } = await supabase
        .from('grade_basket_assignments')
        .select('*, subject_baskets(basket_name), grades(grade_name)')
        .eq('school_id', school.id)
        .eq('term_id', term.id)
      setAssignments(a || [])
    }
  }, [school.id, term])

  useEffect(() => {
    load()
  }, [load])

  const addBasket = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('subject_baskets').insert([{ school_id: school.id, basket_name: name.trim() }])
    if (error) return setError(error.message)
    setName('')
    load()
  }

  const addItem = async (e) => {
    e.preventDefault()
    if (!basketId || !subjectId) return
    setError('')
    const { error } = await supabase
      .from('subject_basket_items')
      .insert([{ school_id: school.id, basket_id: basketId, subject_id: subjectId }])
    if (error) return setError(error.code === '23505' ? 'Subject already in basket.' : error.message)
    setSubjectId('')
    load()
  }

  const assign = async (e) => {
    e.preventDefault()
    if (!term) return setError('Set a current term first.')
    if (!gradeId || !assignBasket) return
    setError('')
    const { error } = await supabase.from('grade_basket_assignments').insert([
      { school_id: school.id, grade_id: gradeId, basket_id: assignBasket, term_id: term.id },
    ])
    if (error) return setError(error.code === '23505' ? 'Already assigned.' : error.message)
    load()
  }

  return (
    <div className="space-y-6">
      <Card title="Create subject basket">
        <form onSubmit={addBasket} className="flex gap-2">
          <input className={input} placeholder="e.g. Sciences, Languages" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className={btnGreen}>Add</button>
        </form>
      </Card>
      <Card title="Add subject to basket">
        <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className={input} value={basketId} onChange={(e) => setBasketId(e.target.value)} required>
            <option value="">Basket</option>
            {baskets.map((b) => (
              <option key={b.id} value={b.id}>{b.basket_name}</option>
            ))}
          </select>
          <select className={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.subject_name}</option>
            ))}
          </select>
          <button className={btnGreen}>Add to basket</button>
        </form>
        <ul className="mt-4 space-y-2">
          {baskets.map((b) => (
            <li key={b.id} className="text-sm">
              <strong>{b.basket_name}:</strong>{' '}
              {(items[b.id] || []).map((i) => i.subjects?.subject_name).filter(Boolean).join(', ') || '—'}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Assign basket to class (current term)">
        {!term ? (
          <Alert>Set a current term first.</Alert>
        ) : (
          <form onSubmit={assign} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)} required>
              <option value="">Grade</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.grade_name}</option>
              ))}
            </select>
            <select className={input} value={assignBasket} onChange={(e) => setAssignBasket(e.target.value)} required>
              <option value="">Basket</option>
              {baskets.map((b) => (
                <option key={b.id} value={b.id}>{b.basket_name}</option>
              ))}
            </select>
            <button className={btnGreen}>Assign</button>
          </form>
        )}
        <ul className="mt-3 text-sm space-y-1">
          {assignments.map((a) => (
            <li key={a.id}>
              {a.grades?.grade_name} ← {a.subject_baskets?.basket_name}
            </li>
          ))}
        </ul>
      </Card>
      <Alert>{error}</Alert>
    </div>
  )
}

// ---------------- Grading scale (CBC / Classic / custom) ----------------
function GradingTab({ school }) {
  const [scales, setScales] = useState([])
  const [bands, setBands] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')
  const [minPct, setMinPct] = useState('')
  const [maxPct, setMaxPct] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: sc } = await supabase
      .from('grade_scales')
      .select('*')
      .eq('school_id', school.id)
      .order('scale_name')
    setScales(sc || [])
    const active = (sc || []).find((s) => s.is_active) || (sc || [])[0]
    setActiveId(active?.id || null)
    if (active) {
      const { data: b } = await supabase
        .from('grade_bands')
        .select('*')
        .eq('scale_id', active.id)
        .order('sort_order')
      setBands(b || [])
    } else setBands([])
    setLoading(false)
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const seed = async (kind) => {
    setError('')
    const fn = kind === 'cbc' ? 'seed_cbc_scale' : 'seed_classic_scale'
    const { error } = await supabase.rpc(fn, { p_school_id: school.id })
    if (error) return setError(error.message)
    await logAudit('grade_scale.seed', 'grade_scales', null, { kind })
    load()
  }

  const setActive = async (id) => {
    setError('')
    await supabase.from('grade_scales').update({ is_active: false }).eq('school_id', school.id)
    const { error } = await supabase.from('grade_scales').update({ is_active: true }).eq('id', id)
    if (error) return setError(error.message)
    await logAudit('grade_scale.activate', 'grade_scales', id)
    load()
  }

  const addBand = async (e) => {
    e.preventDefault()
    if (!activeId) return setError('Create or activate a scale first.')
    setError('')
    const { error } = await supabase.from('grade_bands').insert([
      {
        school_id: school.id,
        scale_id: activeId,
        label: label.trim().toUpperCase(),
        min_pct: Number(minPct),
        max_pct: Number(maxPct),
        sort_order: bands.length + 1,
      },
    ])
    if (error) return setError(error.message)
    setLabel('')
    setMinPct('')
    setMaxPct('')
    load()
  }

  const removeBand = async (id) => {
    await supabase.from('grade_bands').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <Card title="Grading system">
        <p className="text-sm text-gray-600 mb-3">
          CBC schools often use BE / AE / ME / EE. Secondary schools may use A–E. Seed a preset, then
          adjust bands. Exam marks use the <strong>active</strong> scale.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => seed('cbc')} className={btnGreen}>
            Seed CBC (BE–EE)
          </button>
          <button type="button" onClick={() => seed('classic')} className={btn}>
            Seed Classic A–E
          </button>
        </div>
        <Alert>{error}</Alert>
      </Card>

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : (
        <>
          <Card title="Scales">
            {scales.length === 0 ? (
              <p className="text-sm text-gray-500">No scales yet — seed CBC or Classic above.</p>
            ) : (
              <ul className="divide-y">
                {scales.map((s) => (
                  <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">
                      {s.scale_name}{' '}
                      {s.is_active && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                      )}
                    </span>
                    {!s.is_active && (
                      <button onClick={() => setActive(s.id)} className="text-blue-600 text-sm hover:underline">
                        Make active
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Bands on active scale">
            <form onSubmit={addBand} className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <input className={input} placeholder="Label (e.g. ME)" value={label} onChange={(e) => setLabel(e.target.value)} required />
              <input type="number" step="0.01" className={input} placeholder="Min %" value={minPct} onChange={(e) => setMinPct(e.target.value)} required />
              <input type="number" step="0.01" className={input} placeholder="Max %" value={maxPct} onChange={(e) => setMaxPct(e.target.value)} required />
              <button className={btnGreen}>Add band</button>
            </form>
            <Scroll>
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className={th}>Label</th>
                    <th className={th}>Min %</th>
                    <th className={th}>Max %</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className={td}>{b.label}</td>
                      <td className={td}>{b.min_pct}</td>
                      <td className={td}>{b.max_pct}</td>
                      <td className={td}>
                        <button onClick={() => removeBand(b.id)} className="text-red-600 text-sm hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </Card>
        </>
      )}
    </div>
  )
}

// ---------------- Staff ----------------
function StaffTab({ school, user }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('school_id', school.id)
      .order('full_name')
    setStaff(data || [])
    setLoading(false)
  }, [school.id])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  const setStatus = async (id, status) => {
    setError('')
    const { error } = await supabase.from('users').update({ status }).eq('id', id)
    if (error) return setError(error.message)
    fetchStaff()
  }

  const changeRole = async (id, role) => {
    setError('')
    const { error } = await supabase.from('users').update({ role }).eq('id', id)
    if (error) return setError(error.message)
    fetchStaff()
  }

  return (
    <Card title="Staff accounts" className="!p-0">
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-3">
          Share your school code with new staff so they can register and join. Approve them here before
          they can see any school data.
        </p>
        <p className="font-semibold text-gray-800">
          School code: <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{school.school_code}</span>
        </p>
      </div>
      <Alert>{error}</Alert>
      {loading ? (
        <p className="p-6 text-gray-600">Loading...</p>
      ) : (
        <Scroll>
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className={td}>{s.full_name}</td>
                  <td className={td}>{s.email}</td>
                  <td className={td}>{s.role}</td>
                  <td className={td}>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        s.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : s.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className={`${td} space-x-3`}>
                    {s.id === user.id ? (
                      <span className="text-gray-400 text-sm">You</span>
                    ) : (
                      <>
                        {s.status !== 'active' && (
                          <button onClick={() => setStatus(s.id, 'active')} className="text-green-700 hover:underline text-sm">
                            Approve
                          </button>
                        )}
                        {s.status !== 'suspended' && (
                          <button onClick={() => setStatus(s.id, 'suspended')} className="text-red-600 hover:underline text-sm">
                            Suspend
                          </button>
                        )}
                        {user.role === 'Principal' && (
                          <select
                            className="text-xs border rounded px-1 py-0.5 ml-1"
                            value={s.role}
                            onChange={(e) => changeRole(s.id, e.target.value)}
                          >
                            <option>Teacher</option>
                            <option>Secretary</option>
                            <option>Senior Teacher</option>
                            <option>Deputy Principal</option>
                            <option>Principal</option>
                          </select>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </Card>
  )
}

// ---------------- Parents ----------------

// ---------------- Promotion ----------------

function PaymentSettingsTab({ school }) {
  const [paybill, setPaybill] = useState(school.mpesa_paybill || '')
  const [acc, setAcc] = useState(school.mpesa_account_ref || '')
  const [instr, setInstr] = useState(school.fee_payment_instructions || '')
  const [ikey, setIkey] = useState(school.intasend_publishable_key || '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    setSaving(true)
    const { error } = await supabase
      .from('schools')
      .update({
        mpesa_paybill: paybill || null,
        mpesa_account_ref: acc || null,
        fee_payment_instructions: instr || null,
        intasend_publishable_key: ikey || null,
      })
      .eq('id', school.id)
    setSaving(false)
    if (error) return setError(error.message)
    setOk('Payment settings saved.')
    try { await logAudit('school.payment_settings', 'schools', school.id, {}) } catch (_) {}
  }

  return (
    <Card title="Fee payment rails (school)">
      <p className="text-sm text-slate-600 mb-3">
        Paybill and instructions for fee reminders. STK push can use IntaSend later with school keys.
        ShuleKit SaaS billing stays on platform IntaSend.
      </p>
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className={input} placeholder="M-Pesa Paybill / Till" value={paybill} onChange={(e) => setPaybill(e.target.value)} />
        <input className={input} placeholder="Account reference hint" value={acc} onChange={(e) => setAcc(e.target.value)} />
        <input className={input} placeholder="IntaSend publishable key (optional)" value={ikey} onChange={(e) => setIkey(e.target.value)} />
        <textarea className={`${input} md:col-span-2`} placeholder="Payment instructions for parents" value={instr} onChange={(e) => setInstr(e.target.value)} />
        <div className="md:col-span-2 space-y-2">
          <Alert>{error}</Alert>
          <Alert kind="ok">{ok}</Alert>
          <button disabled={saving} className={btnGreen}>{saving ? 'Saving…' : 'Save payment settings'}</button>
        </div>
      </form>
    </Card>
  )
}

function PromotionTab({ school, term, user }) {
  const [terms, setTerms] = useState([])
  const [grades, setGrades] = useState([])
  const [fromTerm, setFromTerm] = useState('')
  const [toTerm, setToTerm] = useState('')
  const [fromGrade, setFromGrade] = useState('')
  const [toGrade, setToGrade] = useState('')
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: t }, { data: g }] = await Promise.all([
        supabase.from('terms').select('*').eq('school_id', school.id).order('year', { ascending: false }),
        supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      ])
      setTerms(t || [])
      setGrades(g || [])
      if (term) setToTerm(term.id)
    })()
  }, [school.id, term])

  const loadStudents = async () => {
    setError('')
    if (!fromTerm || !fromGrade) return
    const { data } = await supabase
      .from('student_enrollments')
      .select('student_id, students(id, admission_no, first_name, last_name, status)')
      .eq('term_id', fromTerm)
      .eq('grade_id', fromGrade)
    const list = (data || []).map((e) => e.students).filter((s) => s && s.status === 'Active')
    setStudents(list)
    const sel = {}
    list.forEach((s) => (sel[s.id] = true))
    setSelected(sel)
  }

  const promote = async () => {
    setError('')
    const ids = Object.keys(selected).filter((id) => selected[id])
    if (!ids.length) return setError('Select at least one student')
    if (!fromTerm || !toTerm || !fromGrade || !toGrade) return setError('Select terms and grades')
    if (!confirm(`Promote ${ids.length} student(s) to the target class/term?`)) return
    setBusy(true)
    const { data, error } = await supabase.rpc('promote_students', {
      p_school_id: school.id,
      p_from_term_id: fromTerm,
      p_to_term_id: toTerm,
      p_from_grade_id: fromGrade,
      p_to_grade_id: toGrade,
      p_student_ids: ids,
    })
    setBusy(false)
    if (error) return setError(error.message)
    alert(`Promoted ${data || ids.length} student(s).`)
  }

  return (
    <div className="space-y-6">
      <Card title="Promote class (Principal / Deputy / Senior Teacher)">
        <p className="text-sm text-slate-600 mb-3">
          Move learners to the next grade for a target term. Uncheck anyone who should repeat or leave.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className={input} value={fromTerm} onChange={(e) => setFromTerm(e.target.value)}>
            <option value="">From term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>Term {t.term}, {t.year}</option>
            ))}
          </select>
          <select className={input} value={toTerm} onChange={(e) => setToTerm(e.target.value)}>
            <option value="">To term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>Term {t.term}, {t.year}{t.is_current ? ' (current)' : ''}</option>
            ))}
          </select>
          <select className={input} value={fromGrade} onChange={(e) => setFromGrade(e.target.value)}>
            <option value="">From class</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.grade_name}{g.stage ? ` · ${g.stage}` : ''}</option>
            ))}
          </select>
          <select className={input} value={toGrade} onChange={(e) => setToGrade(e.target.value)}>
            <option value="">To class</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.grade_name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={loadStudents} className={btnGreen}>Load students</button>
          <button type="button" disabled={busy} onClick={promote} className={btn}>
            {busy ? 'Promoting…' : 'Confirm promotion'}
          </button>
        </div>
        <Alert>{error}</Alert>
        {students.length > 0 && (
          <ul className="mt-4 divide-y max-h-80 overflow-y-auto">
            {students.map((s) => (
              <li key={s.id} className="py-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!selected[s.id]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                />
                <span className="text-sm font-medium">{s.admission_no} — {s.first_name} {s.last_name}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function AuditTab({ school }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('audit_events')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(150)
      setEvents(data || [])
      setLoading(false)
    })()
  }, [school.id])
  return (
    <Card title="School audit log" className="!p-0">
      {loading ? (
        <p className="p-6 text-slate-600">Loading…</p>
      ) : (
        <Scroll>
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Actor</th>
                <th className={th}>Action</th>
                <th className={th}>Entity</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className={td}>{new Date(e.created_at).toLocaleString('en-GB')}</td>
                  <td className={td}>{e.actor_email || '—'}</td>
                  <td className={td}>{e.action}</td>
                  <td className={td}>{e.entity || '—'} {e.entity_id ? String(e.entity_id).slice(0, 8) : ''}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td className={td} colSpan={4}>No events yet</td></tr>
              )}
            </tbody>
          </table>
        </Scroll>
      )}
    </Card>
  )
}

function ParentsTab({ school }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('parent_children')
      .select('*, parents(full_name, email, phone, status), students(admission_no, first_name, last_name)')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false })
    setLinks(data || [])
    setLoading(false)
  }, [school.id])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const decide = async (link, approve) => {
    setError('')
    setBusyId(link.id)
    const { error: linkErr } = await supabase
      .from('parent_children')
      .update({ status: approve ? 'approved' : 'rejected' })
      .eq('id', link.id)
    if (!linkErr && approve) {
      await supabase.from('parents').update({ status: 'active' }).eq('id', link.parent_id)
    }
    setBusyId(null)
    if (linkErr) return setError(linkErr.message)
    fetchLinks()
  }

  return (
    <Card title="Parent sign-up requests" className="!p-0">
      <div className="p-4">
        <p className="text-sm text-gray-600">
          A parent only sees their child's records after you approve the link below. Check that
          the admission number genuinely matches the parent before approving.
        </p>
      </div>
      <Alert>{error}</Alert>
      {loading ? (
        <p className="p-6 text-gray-600">Loading...</p>
      ) : links.length === 0 ? (
        <p className="p-6 text-gray-600 text-center">No parent sign-ups yet</p>
      ) : (
        <Scroll>
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className={th}>Parent</th>
                <th className={th}>Contact</th>
                <th className={th}>Claims child</th>
                <th className={th}>Status</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className={td}>{l.parents?.full_name}</td>
                  <td className={td}>{l.parents?.email}</td>
                  <td className={td}>
                    {l.students?.admission_no} &mdash; {l.students?.first_name} {l.students?.last_name}
                  </td>
                  <td className={td}>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        l.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : l.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className={`${td} space-x-3`}>
                    {l.status === 'pending' && (
                      <>
                        <button
                          disabled={busyId === l.id}
                          onClick={() => decide(l, true)}
                          className="text-green-700 hover:underline text-sm"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busyId === l.id}
                          onClick={() => decide(l, false)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </Card>
  )
}
