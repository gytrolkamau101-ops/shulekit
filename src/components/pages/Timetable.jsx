import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, btn, btnGreen, th, td } from '../ui'

const DAYS = [
  { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' },
]
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
const CAN_EDIT = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary', 'Teacher']

export default function Timetable({ school, user, term }) {
  const canEdit = CAN_EDIT.includes(user?.role)
  const [grades, setGrades] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [gradeId, setGradeId] = useState('')
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null)
  const [subjectId, setSubjectId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [room, setRoom] = useState('')
  const [saving, setSaving] = useState(false)

  const loadMeta = useCallback(async () => {
    const [{ data: g }, { data: s }, { data: t }] = await Promise.all([
      supabase.from('grades').select('*').eq('school_id', school.id).order('grade_name'),
      supabase.from('subjects').select('*').eq('school_id', school.id).order('subject_name'),
      supabase.from('users').select('id, full_name, role').eq('school_id', school.id).eq('status', 'active').order('full_name'),
    ])
    setGrades(g || [])
    setSubjects(s || [])
    setTeachers(t || [])
    if (!gradeId && g?.length) setGradeId(g[0].id)
  }, [school.id])

  const loadSlots = useCallback(async () => {
    if (!term || !gradeId) { setSlots([]); setLoading(false); return }
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('timetable_slots')
      .select('*, subjects(subject_name)')
      .eq('school_id', school.id)
      .eq('term_id', term.id)
      .eq('grade_id', gradeId)
    if (error) {
      setError(error.message.includes('does not exist') || error.code === '42P01'
        ? 'Timetable table missing. Run 05_v6_features.sql in Supabase.'
        : error.message)
      setSlots([])
    } else setSlots(data || [])
    setLoading(false)
  }, [school.id, term, gradeId])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadSlots() }, [loadSlots])

  const cell = (day, period) => slots.find((s) => s.day_of_week === day && s.period_no === period)

  const openEdit = (day, period) => {
    if (!canEdit) { setError('No permission to edit timetable.'); return }
    const c = cell(day, period)
    setEdit({ day, period })
    setSubjectId(c?.subject_id || '')
    setTeacherId(c?.teacher_id || '')
    setRoom(c?.room || '')
    setError('')
  }

  const saveSlot = async (e) => {
    e?.preventDefault?.()
    if (!edit || !term || !gradeId) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('timetable_slots').upsert({
      school_id: school.id, term_id: term.id, grade_id: gradeId,
      day_of_week: edit.day, period_no: edit.period,
      subject_id: subjectId || null, teacher_id: teacherId || null, room: room || null,
    }, { onConflict: 'school_id,term_id,grade_id,day_of_week,period_no' })
    setSaving(false)
    if (error) return setError(error.message)
    setEdit(null)
    loadSlots()
  }

  const clearSlot = async () => {
    if (!edit) return
    const c = cell(edit.day, edit.period)
    if (c) {
      const { error } = await supabase.from('timetable_slots').delete().eq('id', c.id)
      if (error) return setError(error.message)
    }
    setEdit(null)
    loadSlots()
  }

  const generateDraft = async (reshuffle) => {
    if (!term || !gradeId || !canEdit) return
    setError('')
    if (!subjects.length) return setError('Add subjects under School Setup first.')
    if (!confirm(reshuffle ? 'Clear and reshuffle this class timetable?' : 'Fill empty cells with subject rotation?')) return
    if (reshuffle) {
      await supabase.from('timetable_slots').delete()
        .eq('school_id', school.id).eq('term_id', term.id).eq('grade_id', gradeId)
    }
    const { data: current } = await supabase.from('timetable_slots').select('*')
      .eq('school_id', school.id).eq('term_id', term.id).eq('grade_id', gradeId)
    const existing = current || []
    const rows = []
    let si = Math.floor(Math.random() * subjects.length)
    for (const d of [1, 2, 3, 4, 5]) {
      for (const p of PERIODS) {
        if (!reshuffle && existing.find((s) => s.day_of_week === d && s.period_no === p)?.subject_id) continue
        rows.push({
          school_id: school.id, term_id: term.id, grade_id: gradeId,
          day_of_week: d, period_no: p, subject_id: subjects[si % subjects.length].id,
          teacher_id: null, room: null,
        })
        si++
      }
    }
    if (!rows.length) return setError('Nothing to fill — try Reshuffle.')
    const { error } = await supabase.from('timetable_slots').upsert(rows, {
      onConflict: 'school_id,term_id,grade_id,day_of_week,period_no',
    })
    if (error) setError(error.message)
    else loadSlots()
  }

  if (!term) return (<div className="space-y-6"><PageTitle>Timetable</PageTitle><NeedTerm /></div>)

  return (
    <div className="space-y-6">
      <PageTitle>Timetable</PageTitle>
      <Card>
        <label className="text-sm font-semibold text-slate-600">Class</label>
        <select className={input} value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
        </select>
        <p className="text-xs text-slate-500 mt-2">Term {term.term}, {term.year}. {canEdit ? 'Tap a cell to edit.' : 'View only.'}</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={() => generateDraft(false)} className={btnGreen}>Auto-fill empty</button>
            <button type="button" onClick={() => generateDraft(true)} className={btn}>Reshuffle all</button>
          </div>
        )}
        <Alert>{error}</Alert>
      </Card>
      {loading ? <p className="text-slate-600">Loading…</p> : (
        <Card className="!p-0">
          <Scroll>
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b">
                <tr><th className={th}>P</th>{DAYS.map((d) => <th key={d.n} className={th}>{d.label}</th>)}</tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p} className="border-b">
                    <td className={`${td} font-bold`}>{p}</td>
                    {DAYS.map((d) => {
                      const c = cell(d.n, p)
                      return (
                        <td key={d.n} role="button" tabIndex={0}
                          onClick={() => openEdit(d.n, p)}
                          className={`${td} align-top min-w-[72px] cursor-pointer active:bg-blue-100 hover:bg-blue-50`}>
                          {c?.subjects?.subject_name ? (
                            <>
                              <div className="font-semibold text-xs">{c.subjects.subject_name}</div>
                              <div className="text-[10px] text-slate-500">{(teachers.find((t) => t.id === c.teacher_id) || {}).full_name || ''}</div>
                            </>
                          ) : <span className="text-slate-300 text-lg">+</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </Card>
      )}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{DAYS.find((d) => d.n === edit.day)?.label} · Period {edit.period}</h3>
            <form onSubmit={saveSlot} className="space-y-3">
              <select className={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">— Subject —</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
              <select className={input} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">— Teacher —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <input className={input} placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className={`${btnGreen} flex-1`}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={clearSlot} className={`${btn} flex-1`}>Clear</button>
              </div>
              <button type="button" onClick={() => setEdit(null)} className="w-full text-sm text-slate-500">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
