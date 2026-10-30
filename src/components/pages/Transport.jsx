import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btnGreen, th, td } from '../ui'
import { TRANSPORT_ROLES, canEditData } from '../../lib/roles'

export default function Transport({ school, user }) {
  const canEdit = TRANSPORT_ROLES.includes(user?.role) || canEditData(user?.role) || ['Principal','Deputy Principal','Senior Teacher','Secretary'].includes(user?.role)
  const [vehicles, setVehicles] = useState([])
  const [trips, setTrips] = useState([])
  const [error, setError] = useState('')
  const [vForm, setVForm] = useState({ plate: '', vehicle_name: '', capacity: 30, driver_name: '', driver_phone: '' })
  const [tForm, setTForm] = useState({ vehicle_id: '', trip_date: new Date().toISOString().slice(0, 10), destination: '', purpose: '', expense_amount: '', driver_summary: '' })

  const load = useCallback(async () => {
    const [{ data: v }, { data: t }] = await Promise.all([
      supabase.from('fleet_vehicles').select('*').eq('school_id', school.id).order('plate'),
      supabase.from('transport_trips').select('*, fleet_vehicles(plate, vehicle_name)').eq('school_id', school.id).order('trip_date', { ascending: false }).limit(50),
    ])
    setVehicles(v || [])
    setTrips(t || [])
  }, [school.id])

  useEffect(() => { load() }, [load])

  const saveVehicle = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setError('')
    const { error: err } = await supabase.from('fleet_vehicles').insert([{ school_id: school.id, ...vForm, capacity: Number(vForm.capacity) || 0 }])
    if (err) return setError(err.message + ' — run 23_v38_modules.sql')
    setVForm({ plate: '', vehicle_name: '', capacity: 30, driver_name: '', driver_phone: '' })
    load()
  }

  const saveTrip = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    setError('')
    const { error: err } = await supabase.from('transport_trips').insert([{
      school_id: school.id,
      vehicle_id: tForm.vehicle_id || null,
      trip_date: tForm.trip_date,
      destination: tForm.destination,
      purpose: tForm.purpose,
      expense_amount: Number(tForm.expense_amount) || 0,
      driver_summary: tForm.driver_summary,
      created_by: user?.id,
      status: 'completed',
    }])
    if (err) return setError(err.message)
    setTForm({ vehicle_id: '', trip_date: new Date().toISOString().slice(0, 10), destination: '', purpose: '', expense_amount: '', driver_summary: '' })
    load()
  }

  const delVehicle = async (id) => {
    if (!canEdit || !confirm('Delete this vehicle?')) return
    const { error: err } = await supabase.from('fleet_vehicles').delete().eq('id', id)
    if (err) setError(err.message)
    else load()
  }
  const delTrip = async (id) => {
    if (!canEdit || !confirm('Delete this trip?')) return
    const { error: err } = await supabase.from('transport_trips').delete().eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Transport" subtitle="Fleet, trips and driver expense summaries (Premium)" />
      <Alert kind="error">{error}</Alert>
      {canEdit && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Register vehicle">
            <form onSubmit={saveVehicle} className="space-y-2">
              <input className={input} placeholder="Number plate" value={vForm.plate} onChange={(e) => setVForm({ ...vForm, plate: e.target.value })} required />
              <input className={input} placeholder="Name / route" value={vForm.vehicle_name} onChange={(e) => setVForm({ ...vForm, vehicle_name: e.target.value })} />
              <input className={input} placeholder="Driver name" value={vForm.driver_name} onChange={(e) => setVForm({ ...vForm, driver_name: e.target.value })} />
              <input className={input} placeholder="Driver phone" value={vForm.driver_phone} onChange={(e) => setVForm({ ...vForm, driver_phone: e.target.value })} />
              <button className={btnGreen}>Save vehicle</button>
            </form>
          </Card>
          <Card title="Log trip / expense">
            <form onSubmit={saveTrip} className="space-y-2">
              <select className={input} value={tForm.vehicle_id} onChange={(e) => setTForm({ ...tForm, vehicle_id: e.target.value })}>
                <option value="">Vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} {v.vehicle_name || ''}</option>)}
              </select>
              <input className={input} type="date" value={tForm.trip_date} onChange={(e) => setTForm({ ...tForm, trip_date: e.target.value })} />
              <input className={input} placeholder="Destination" value={tForm.destination} onChange={(e) => setTForm({ ...tForm, destination: e.target.value })} />
              <input className={input} placeholder="Purpose" value={tForm.purpose} onChange={(e) => setTForm({ ...tForm, purpose: e.target.value })} />
              <input className={input} type="number" placeholder="Expense KES" value={tForm.expense_amount} onChange={(e) => setTForm({ ...tForm, expense_amount: e.target.value })} />
              <textarea className={input} rows={2} placeholder="Driver summary" value={tForm.driver_summary} onChange={(e) => setTForm({ ...tForm, driver_summary: e.target.value })} />
              <button className={btnGreen}>Save trip</button>
            </form>
          </Card>
        </div>
      )}
      <Card title="Fleet">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead><tr><th className={th}>Plate</th><th className={th}>Name</th><th className={th}>Driver</th>{canEdit && <th className={th}></th>}</tr></thead>
            <tbody>{vehicles.map((v) => (
              <tr key={v.id}>
                <td className={td}>{v.plate}</td>
                <td className={td}>{v.vehicle_name}</td>
                <td className={td}>{v.driver_name} {v.driver_phone}</td>
                {canEdit && <td className={td}><button type="button" className="text-red-600 text-xs font-bold" onClick={() => delVehicle(v.id)}>Delete</button></td>}
              </tr>
            ))}</tbody>
          </table>
        </Scroll>
      </Card>
      <Card title="Recent trips">
        <Scroll>
          <table className="min-w-full text-sm">
            <thead><tr><th className={th}>Date</th><th className={th}>Vehicle</th><th className={th}>Destination</th><th className={th}>Expense</th>{canEdit && <th className={th}></th>}</tr></thead>
            <tbody>{trips.map((tr) => (
              <tr key={tr.id}>
                <td className={td}>{tr.trip_date}</td>
                <td className={td}>{tr.fleet_vehicles?.plate || '—'}</td>
                <td className={td}>{tr.destination}</td>
                <td className={td}>KES {Number(tr.expense_amount || 0).toLocaleString()}</td>
                {canEdit && <td className={td}><button type="button" className="text-red-600 text-xs font-bold" onClick={() => delTrip(tr.id)}>Delete</button></td>}
              </tr>
            ))}</tbody>
          </table>
        </Scroll>
      </Card>
    </div>
  )
}
