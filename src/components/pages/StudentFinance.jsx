import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../supabaseClient'
import { isOnline, enqueue } from '../../lib/offline'
import { logAudit } from '../../lib/audit'
import { Card, Scroll, Alert, NeedTerm, PageTitle, input, btnGreen, th, td, fmt, toast } from '../ui'

export default function StudentFinance({ school, term }) {
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [openings, setOpenings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [receipt, setReceipt] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [arrearsStudent, setArrearsStudent] = useState('')
  const [arrearsAmt, setArrearsAmt] = useState('')
  const [view, setView] = useState('balances') // balances | payments

  const fetchAll = useCallback(async () => {
    if (!term) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: s }, { data: p }, { data: fs }, { data: enr }, { data: op }] = await Promise.all([
      supabase
        .from('students')
        .select('id, admission_no, first_name, last_name')
        .eq('school_id', school.id)
        .eq('status', 'Active')
        .order('first_name'),
      supabase
        .from('fee_payments')
        .select('*, students(admission_no, first_name, last_name)')
        .eq('school_id', school.id)
        .eq('term_id', term.id)
        .order('payment_date', { ascending: false }),
      supabase.from('fee_structures').select('*').eq('school_id', school.id).eq('term_id', term.id),
      supabase
        .from('student_enrollments')
        .select('student_id, grade_id')
        .eq('school_id', school.id)
        .eq('term_id', term.id),
      supabase
        .from('fee_opening_balances')
        .select('student_id, amount')
        .eq('school_id', school.id)
        .eq('term_id', term.id),
    ])
    setStudents(s || [])
    setPayments(p || [])
    setFeeStructures(fs || [])
    setEnrollments(enr || [])
    setOpenings(op || [])
    setLoading(false)
  }, [school.id, term])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const totalCollected = useMemo(
    () => payments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
    [payments]
  )

  const balances = useMemo(() => {
    const gradeByStudent = {}
    enrollments.forEach((e) => (gradeByStudent[e.student_id] = e.grade_id))
    const feeByGrade = {}
    feeStructures.forEach((f) => (feeByGrade[f.grade_id] = Number(f.total_fee)))
    const paidByStudent = {}
    payments.forEach((p) => {
      paidByStudent[p.student_id] = (paidByStudent[p.student_id] || 0) + Number(p.amount_paid)
    })
    const openByStudent = {}
    openings.forEach((o) => (openByStudent[o.student_id] = Number(o.amount || 0)))
    return students.map((s) => {
      const gradeId = gradeByStudent[s.id]
      const termFee = gradeId !== undefined ? feeByGrade[gradeId] ?? 0 : 0
      const arrears = openByStudent[s.id] || 0
      const totalFee = gradeId !== undefined ? termFee + arrears : arrears || null
      const paid = paidByStudent[s.id] || 0
      return {
        ...s,
        termFee,
        arrears,
        totalFee: totalFee === 0 && gradeId === undefined ? null : totalFee,
        paid,
        balance: totalFee === null || (totalFee === 0 && gradeId === undefined) ? null : totalFee - paid,
      }
    })
  }, [students, enrollments, feeStructures, payments, openings])

  const totalOwed = useMemo(
    () => balances.reduce((sum, b) => sum + (b.balance && b.balance > 0 ? b.balance : 0), 0),
    [balances]
  )


  const saveArrears = async (e) => {
    e.preventDefault()
    if (!arrearsStudent) return setError('Choose student for arrears')
    setSaving(true)
    setError('')
    const { error } = await supabase.from('fee_opening_balances').upsert(
      [
        {
          school_id: school.id,
          student_id: arrearsStudent,
          term_id: term.id,
          amount: Number(arrearsAmt) || 0,
        },
      ],
      { onConflict: 'school_id,student_id,term_id' }
    )
    setSaving(false)
    if (error) return setError(error.message)
    setArrearsStudent('')
    setArrearsAmt('')
    fetchAll()
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!studentId) return setError('Choose a student')
    setSaving(true)
    const row = {
      school_id: school.id,
      term_id: term.id,
      student_id: studentId,
      amount_paid: Number(amount),
      payment_method: method,
      receipt_no: receipt || null,
      notes,
    }
    if (!isOnline()) {
      enqueue('fee_payment', row)
      setSaving(false)
      toast('Payment queued offline — will sync when online', 'info')
      setStudentId('')
      setAmount('')
      setReceipt('')
      setNotes('')
      setShowForm(false)
      return
    }
    const { error } = await supabase.from('fee_payments').insert([row])
    setSaving(false)
    if (error) {
      setError(
        error.code === '23505' ? 'That receipt number has already been used.' : error.message
      )
      return
    }
    await logAudit('fee.payment', 'fee_payments', studentId, { amount: Number(amount), method })
    toast('Payment recorded', 'ok')
    setStudentId('')
    setAmount('')
    setReceipt('')
    setNotes('')
    setShowForm(false)
    fetchAll()
  }

  if (!term) {
    return (
      <div className="space-y-6">
        <PageTitle>Student Finance</PageTitle>
        <p className="text-sm text-slate-600 -mt-2 mb-2">
          Parents pay your school Till/Paybill on M-Pesa. Use <strong>Record payment</strong> here when money has been received so balances stay correct.
        </p>
        <NeedTerm />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageTitle
        right={
          <button onClick={() => setShowForm((v) => !v)} className={btnGreen}>
            {showForm ? 'Cancel' : '+ Record payment'}
          </button>
        }
      >
        Student Finance
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-600">
            Term {term.term}, {term.year} &middot; Total collected
          </p>
          <p className="text-3xl font-bold text-green-700">KES {fmt(totalCollected)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-600">Total outstanding (active balances)</p>
          <p className="text-3xl font-bold text-red-600">KES {fmt(totalOwed)}</p>
        </Card>
      </div>

      {showForm && (
        <Card title="Record fee payment">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className={input}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.admission_no} - {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="0.01"
              className={input}
              placeholder="Amount paid (KES)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Cash</option>
              <option>M-Pesa</option>
              <option>Bank Transfer</option>
              <option>Cheque</option>
            </select>
            <input
              className={input}
              placeholder="Receipt number (optional)"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
            <textarea
              className={`${input} md:col-span-2`}
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="md:col-span-2">
              <Alert>{error}</Alert>
            </div>
            <button disabled={saving} className={`${btnGreen} md:col-span-2`}>
              {saving ? 'Saving...' : 'Save payment'}
            </button>
          </form>
        </Card>
      )}

      {feeStructures.length === 0 && (
        <Alert kind="ok">
          Tip: set a fee amount per grade in School Setup &gt; Fee structure so balances can be
          calculated automatically.
        </Alert>
      )}

      
      <Card title="Brought-forward arrears (opening balance)">
        <form onSubmit={saveArrears} className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className={input} value={arrearsStudent} onChange={(e) => setArrearsStudent(e.target.value)} required>
            <option value="">Student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.admission_no} - {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            className={input}
            placeholder="Arrears amount (KES)"
            value={arrearsAmt}
            onChange={(e) => setArrearsAmt(e.target.value)}
            required
          />
          <button disabled={saving} className={btnGreen}>
            Save arrears
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Added to this term&apos;s fee structure for balance = term fee + arrears − paid.
        </p>
      </Card>
<div className="flex gap-2">
        <button
          onClick={() => setView('balances')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            view === 'balances' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
          }`}
        >
          Balances
        </button>
        <button
          onClick={() => setView('payments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            view === 'payments' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700'
          }`}
        >
          Payment history
        </button>
      </div>

      {view === 'balances' ? (
        <Card title="Balances per student" className="!p-0">
          {loading ? (
            <p className="p-6 text-gray-600">Loading...</p>
          ) : balances.length === 0 ? (
            <p className="p-6 text-gray-600 text-center">No active students yet</p>
          ) : (
            <Scroll>
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className={th}>Adm No</th>
                    <th className={th}>Student</th>
                    <th className={th}>Term fee</th>
                    <th className={th}>Arrears</th>
                    <th className={th}>Paid</th>
                    <th className={th}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-gray-50">
                      <td className={td}>{b.admission_no}</td>
                      <td className={td}>
                        {b.first_name} {b.last_name}
                      </td>
                      <td className={td}>
                        {b.termFee == null && b.totalFee == null ? 'Not set' : `KES ${fmt(b.termFee || 0)}`}
                      </td>
                      <td className={td}>{b.arrears ? `KES ${fmt(b.arrears)}` : '—'}</td>
                      <td className={td}>KES {fmt(b.paid)}</td>
                      <td className={`${td} font-semibold`}>
                        {b.balance === null ? (
                          '-'
                        ) : b.balance > 0 ? (
                          <span className="text-red-600">KES {fmt(b.balance)}</span>
                        ) : b.balance < 0 ? (
                          <span className="text-blue-600">Overpaid KES {fmt(-b.balance)}</span>
                        ) : (
                          <span className="text-green-700">Cleared</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          )}
        </Card>
      ) : (
        <Card title="Recent payments" className="!p-0">
          {loading ? (
            <p className="p-6 text-gray-600">Loading...</p>
          ) : payments.length === 0 ? (
            <p className="p-6 text-gray-600 text-center">No payments recorded this term yet</p>
          ) : (
            <Scroll>
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className={th}>Adm No</th>
                    <th className={th}>Student</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Date</th>
                    <th className={th}>Method</th>
                    <th className={th}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className={td}>{p.students?.admission_no}</td>
                      <td className={td}>
                        {p.students?.first_name} {p.students?.last_name}
                      </td>
                      <td className={`${td} font-semibold`}>KES {fmt(p.amount_paid)}</td>
                      <td className={td}>{new Date(p.payment_date).toLocaleDateString('en-GB')}</td>
                      <td className={td}>{p.payment_method}</td>
                      <td className={td}>{p.receipt_no || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          )}
        </Card>
      )}

      <Card title="Defaulters (balance > 0)">
        <p className="text-sm text-slate-600 mb-2">Learners still owing this term. Use Messages to open WhatsApp reminders.</p>
        <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
          {balances.filter((b) => b.balance > 0).slice(0, 30).map((b) => (
            <li key={b.student_id} className="flex justify-between border-b border-slate-100 py-1">
              <span>{b.name}</span>
              <span className="font-semibold text-red-600">KES {fmt(b.balance)}</span>
            </li>
          ))}
          {balances.filter((b) => b.balance > 0).length === 0 && (
            <li className="text-slate-500">No outstanding balances</li>
          )}
        </ul>
      </Card>

    </div>
  )
}
