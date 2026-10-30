import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td, fmt } from '../ui'
import { canEditData } from '../../lib/roles'

export default function Games({ school, term, user }) {
  const canEdit = canEditData(user?.role) || ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary', 'Teacher'].includes(user?.role)
  const [events, setEvents] = useState([])
  const [assets, setAssets] = useState([])
  const [players, setPlayers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState('events')
  const [form, setForm] = useState({ title: '', event_date: '', opponent: '', venue: '', sport: 'Football' })
  const [assetForm, setAssetForm] = useState({ item_name: '', quantity: 1, condition: 'Good' })
  const [expForm, setExpForm] = useState({ description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10) })
  const [playerForm, setPlayerForm] = useState({ student_id: '', sport: 'Football' })

  const load = useCallback(async () => {
    const [e, a, p, x, s] = await Promise.all([
      supabase.from('games_events').select('*').eq('school_id', school.id).order('event_date', { ascending: true }),
      supabase.from('games_assets').select('*').eq('school_id', school.id).order('item_name'),
      supabase.from('games_players').select('*, students(first_name, last_name, admission_no)').eq('school_id', school.id).eq('active', true),
      supabase.from('games_expenses').select('*').eq('school_id', school.id).order('expense_date', { ascending: false }),
      supabase.from('students').select('id, first_name, last_name, admission_no').eq('school_id', school.id).eq('status', 'Active').order('first_name').limit(500),
    ])
    if (e.error || a.error) {
      setError((e.error || a.error)?.message + ' — Run 25_v47_subject_games.sql in Supabase if tables are missing.')
    }
    setEvents(e.data || [])
    setAssets(a.data || [])
    setPlayers(p.data || [])
    setExpenses(x.data || [])
    setStudents(s.data || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const addEvent = async (ev) => {
    ev.preventDefault()
    setError('')
    const { error } = await supabase.from('games_events').insert([{ ...form, school_id: school.id }])
    if (error) return setError(error.message)
    setForm({ title: '', event_date: '', opponent: '', venue: '', sport: 'Football' })
    load()
  }

  const addAsset = async (ev) => {
    ev.preventDefault()
    const { error } = await supabase.from('games_assets').insert([{ ...assetForm, school_id: school.id, quantity: Number(assetForm.quantity) || 1 }])
    if (error) return setError(error.message)
    setAssetForm({ item_name: '', quantity: 1, condition: 'Good' })
    load()
  }

  const addPlayer = async (ev) => {
    ev.preventDefault()
    const { error } = await supabase.from('games_players').insert([{ ...playerForm, school_id: school.id, active: true }])
    if (error) return setError(error.message)
    setPlayerForm({ student_id: '', sport: 'Football' })
    load()
  }

  const addExp = async (ev) => {
    ev.preventDefault()
    const { error } = await supabase.from('games_expenses').insert([
      {
        school_id: school.id,
        term_id: term?.id || null,
        description: expForm.description,
        amount: Number(expForm.amount) || 0,
        expense_date: expForm.expense_date,
      },
    ])
    if (error) return setError(error.message)
    setExpForm({ description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10) })
    load()
  }

  const tabs = [
    ['events', 'Fixtures'],
    ['assets', 'Balls & kit'],
    ['players', 'Players'],
    ['expenses', 'Expenses'],
  ]

  return (
    <div className="space-y-4">
      <PageTitle>Games</PageTitle>
      <Alert>{error}</Alert>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-black ${tab === id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <Card title="Upcoming / fixtures">
          {canEdit && (
            <form onSubmit={addEvent} className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              <input className={input} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <input className={input} type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
              <input className={input} placeholder="Sport" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
              <input className={input} placeholder="Opponent" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
              <input className={input} placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              <button className={btnGreen}>Add fixture</button>
            </form>
          )}
          <Scroll>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Title</th>
                  <th className={th}>Sport</th>
                  <th className={th}>Opponent</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>{e.event_date || '—'}</td>
                    <td className={td}>{e.title}</td>
                    <td className={td}>{e.sport}</td>
                    <td className={td}>{e.opponent || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </Card>
      )}

      {tab === 'assets' && (
        <Card title="Balls, kits & equipment">
          {canEdit && (
            <form onSubmit={addAsset} className="flex flex-wrap gap-2 mb-3">
              <input className={input} placeholder="Item (e.g. Football)" value={assetForm.item_name} onChange={(e) => setAssetForm({ ...assetForm, item_name: e.target.value })} required />
              <input className={input} type="number" min="1" value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })} />
              <input className={input} placeholder="Condition" value={assetForm.condition} onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })} />
              <button className={btnGreen}>Add</button>
            </form>
          )}
          <ul className="text-sm space-y-1">
            {assets.map((a) => (
              <li key={a.id} className="flex justify-between border-b py-1">
                <span>{a.item_name}</span>
                <span className="text-slate-500">×{a.quantity} · {a.condition}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'players' && (
        <Card title="Active players">
          {canEdit && (
            <form onSubmit={addPlayer} className="flex flex-wrap gap-2 mb-3">
              <select className={input} value={playerForm.student_id} onChange={(e) => setPlayerForm({ ...playerForm, student_id: e.target.value })} required>
                <option value="">Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.admission_no})
                  </option>
                ))}
              </select>
              <input className={input} value={playerForm.sport} onChange={(e) => setPlayerForm({ ...playerForm, sport: e.target.value })} />
              <button className={btnGreen}>Add player</button>
            </form>
          )}
          <ul className="text-sm space-y-1">
            {players.map((p) => (
              <li key={p.id}>
                {p.students?.first_name} {p.students?.last_name} · {p.sport}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'expenses' && (
        <Card title="Games expenses">
          {canEdit && (
            <form onSubmit={addExp} className="flex flex-wrap gap-2 mb-3">
              <input className={input} placeholder="Description" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} required />
              <input className={input} type="number" placeholder="Amount" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} required />
              <input className={input} type="date" value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} />
              <button className={btnGreen}>Add expense</button>
            </form>
          )}
          <Scroll>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Description</th>
                  <th className={th}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((x) => (
                  <tr key={x.id}>
                    <td className={td}>{x.expense_date}</td>
                    <td className={td}>{x.description}</td>
                    <td className={td}>KES {fmt(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </Card>
      )}
    </div>
  )
}
