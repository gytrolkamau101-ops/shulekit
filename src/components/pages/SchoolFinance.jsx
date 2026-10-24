import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, btnGreen, th, td, fmt } from '../ui'

const EXPENSE_TYPES = ['Electricity', 'Water', 'Staff Salary', 'Maintenance', 'Office Supplies', 'Transport', 'Other']

export default function SchoolFinance({ school, term }) {
  const [expenses, setExpenses] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [expType, setExpType] = useState(EXPENSE_TYPES[0])
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10))
  const [expNotes, setExpNotes] = useState('')
  const [evName, setEvName] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evDesc, setEvDesc] = useState('')
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const tasks = [
      supabase.from('school_events').select('*').eq('school_id', school.id).order('event_date'),
    ]
    if (term) {
      tasks.unshift(
        supabase
          .from('expenses')
          .select('*')
          .eq('school_id', school.id)
          .eq('term_id', term.id)
          .order('expense_date', { ascending: false })
      )
    }
    const results = await Promise.all(tasks)
    if (term) {
      setExpenses(results[0].data || [])
      setEvents(results[1].data || [])
    } else {
      setExpenses([])
      setEvents(results[0].data || [])
    }
    setLoading(false)
  }, [school.id, term])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses])

  const saveExpense = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('expenses').insert([
      {
        school_id: school.id,
        term_id: term.id,
        expense_type: expType,
        amount: Number(expAmount),
        expense_date: expDate,
        notes: expNotes,
      },
    ])
    if (error) return setError(error.message)
    setExpAmount('')
    setExpNotes('')
    setShowExpenseForm(false)
    fetchAll()
  }

  const saveEvent = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase
      .from('school_events')
      .insert([{ school_id: school.id, event_name: evName, event_date: evDate, description: evDesc }])
    if (error) return setError(error.message)
    setEvName('')
    setEvDate('')
    setEvDesc('')
    setShowEventForm(false)
    fetchAll()
  }

  return (
    <div className="space-y-6">
      <PageTitle>School Finance</PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <p className="text-red-100 text-sm">Total expenses (term)</p>
          <p className="text-3xl font-bold mt-1">KES {fmt(totalExpenses)}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <p className="text-orange-100 text-sm">Upcoming events</p>
          <p className="text-3xl font-bold mt-1">{events.length}</p>
        </div>
      </div>

      {!term && <NeedTerm />}

      <div className="flex flex-wrap gap-3">
        {term && (
          <button onClick={() => setShowExpenseForm((v) => !v)} className={btnGreen}>
            {showExpenseForm ? 'Cancel' : '+ Record expense'}
          </button>
        )}
        <button onClick={() => setShowEventForm((v) => !v)} className={btnGreen}>
          {showEventForm ? 'Cancel' : '+ Add event'}
        </button>
      </div>

      {showExpenseForm && term && (
        <Card title="Record expense">
          <form onSubmit={saveExpense} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select className={input} value={expType} onChange={(e) => setExpType(e.target.value)}>
              {EXPENSE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="0.01"
              className={input}
              placeholder="Amount (KES)"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              required
            />
            <input type="date" className={input} value={expDate} onChange={(e) => setExpDate(e.target.value)} required />
            <textarea
              className={`${input} md:col-span-2`}
              placeholder="Notes"
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
            />
            <div className="md:col-span-2">
              <Alert>{error}</Alert>
            </div>
            <button className={`${btnGreen} md:col-span-2`}>Save expense</button>
          </form>
        </Card>
      )}

      {showEventForm && (
        <Card title="Add calendar event">
          <form onSubmit={saveEvent} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="Event name"
              value={evName}
              onChange={(e) => setEvName(e.target.value)}
              required
            />
            <input type="date" className={input} value={evDate} onChange={(e) => setEvDate(e.target.value)} required />
            <textarea
              className={`${input} md:col-span-2`}
              placeholder="Description (optional)"
              value={evDesc}
              onChange={(e) => setEvDesc(e.target.value)}
            />
            <div className="md:col-span-2">
              <Alert>{error}</Alert>
            </div>
            <button className={`${btnGreen} md:col-span-2`}>Save event</button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent expenses" className="!p-0">
          {loading ? (
            <p className="p-6 text-gray-600">Loading...</p>
          ) : !term ? (
            <p className="p-6 text-gray-500 text-sm">Set a current term to track expenses</p>
          ) : expenses.length === 0 ? (
            <p className="p-6 text-gray-600 text-center">No expenses recorded</p>
          ) : (
            <Scroll>
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className={th}>Type</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className={td}>{e.expense_type}</td>
                      <td className={`${td} font-semibold`}>KES {fmt(e.amount)}</td>
                      <td className={td}>{new Date(e.expense_date).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          )}
        </Card>

        <Card title="School calendar" className="!p-0">
          {loading ? (
            <p className="p-6 text-gray-600">Loading...</p>
          ) : events.length === 0 ? (
            <p className="p-6 text-gray-600 text-center">No events scheduled</p>
          ) : (
            <div className="p-4 space-y-3">
              {events.map((e) => (
                <div key={e.id} className="border-l-4 border-blue-500 pl-3">
                  <p className="font-semibold text-gray-800">{e.event_name}</p>
                  <p className="text-sm text-gray-600">{new Date(e.event_date).toLocaleDateString('en-GB')}</p>
                  {e.description && <p className="text-sm text-gray-700 mt-1">{e.description}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
