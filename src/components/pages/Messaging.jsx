import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { planEntitlements } from '../../lib/plans'
import { Card, Scroll, Alert, PageTitle, input, btn, btnGreen, th, td, toast } from '../ui'
import { FINANCE_ROLES, ADMIN } from '../../lib/roles'

function toWaPhone(raw) {
  if (!raw) return ''
  let p = String(raw).replace(/\D/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (p.length === 9) p = '254' + p
  return p
}

function smsHref(phone, body) {
  const p = String(phone || '').replace(/\s/g, '')
  // sms: works on Android/iOS; body param varies by platform
  return `sms:${p}?body=${encodeURIComponent(body)}`
}

export default function Messaging({ school, user, term }) {
  const ent = planEntitlements(school)
  const canSend = [...FINANCE_ROLES, ...ADMIN].includes(user.role)
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState({})
  const [channel, setChannel] = useState('whatsapp')
  const [template, setTemplate] = useState('fees')
  const [body, setBody] = useState('')
  const [log, setLog] = useState([])
  const [error, setError] = useState('')
  const [payInfo, setPayInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [templates, setTemplates] = useState([])
  const [tplTitle, setTplTitle] = useState('')
  const [tplBody, setTplBody] = useState('')
  const canEditTpl = ['Principal', 'Deputy Principal', 'Secretary', 'Senior Teacher'].includes(user?.role)

  const load = useCallback(async () => {
    const [{ data: s }, { data: schoolRow }, { data: msgs }] = await Promise.all([
      supabase
        .from('students')
        .select('id, admission_no, first_name, last_name, parent_phone, parent_name')
        .eq('school_id', school.id)
        .eq('status', 'Active')
        .order('first_name'),
      supabase
        .from('schools')
        .select('mpesa_paybill, mpesa_account_ref, fee_payment_instructions, school_name')
        .eq('id', school.id)
        .maybeSingle(),
      supabase
        .from('message_outbox')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(40),
    ])
    setStudents(s || [])
    setPayInfo(schoolRow)
    setLog(msgs || [])
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('message_templates').select('*').eq('school_id', school.id).order('title')
      setTemplates(data || [])
    })()
  }, [school.id])

  const saveTemplate = async (e) => {
    e.preventDefault()
    const key = tplTitle.toLowerCase().replace(/\s+/g, '_').slice(0, 40) || 'custom'
    const { error } = await supabase.from('message_templates').upsert(
      [{ school_id: school.id, template_key: key, title: tplTitle, body: tplBody, updated_at: new Date().toISOString() }],
      { onConflict: 'school_id,template_key' }
    )
    if (error) setError(error.message)
    else {
      setTplTitle('')
      setTplBody('')
      const { data } = await supabase.from('message_templates').select('*').eq('school_id', school.id).order('title')
      setTemplates(data || [])
    }
  }

  const buildBody = useCallback(
    (st) => {
      const name = st ? `${st.first_name} ${st.last_name}` : 'your child'
      const schoolName = payInfo?.school_name || school.school_name || 'school'
      const termLabel = term ? `Term ${term.term} ${term.year}` : 'this term'
      const pay = [
        payInfo?.mpesa_paybill ? `Paybill ${payInfo.mpesa_paybill}` : null,
        payInfo?.mpesa_account_ref ? `Acc ${payInfo.mpesa_account_ref}` : null,
        payInfo?.fee_payment_instructions,
      ]
        .filter(Boolean)
        .join(' · ')

      const templates = {
        fees: `Habari, this is ${schoolName}. Fee reminder for ${name} (${termLabel}). ${pay || 'Please clear outstanding fees.'} — ShuleMoja`,
        results: `Habari, ${schoolName}: exam results for ${name} are ready. Open the parent portal or contact the school. — ShuleMoja`,
        attendance: `Habari, ${schoolName}: attendance notice for ${name}. Please contact the class teacher if needed. — ShuleMoja`,
        custom: body,
      }
      return templates[template] || body
    },
    [template, body, payInfo, school, term]
  )

  useEffect(() => {
    if (template !== 'custom') setBody(buildBody(null))
  }, [template, payInfo, term])

  const selectedList = students.filter((s) => selected[s.id])
  const withPhone = selectedList.filter((s) => s.parent_phone)

  const toggleAll = (on) => {
    const next = {}
    if (on) students.forEach((s) => (next[s.id] = true))
    setSelected(next)
  }

  const openBulk = async () => {
    setError('')
    if (!selectedList.length) return setError('Select at least one parent/student')
    if (channel !== 'copy' && !withPhone.length) {
      return setError('Selected learners have no parent phone numbers')
    }
    setBusy(true)

    const targets = channel === 'copy' ? selectedList : withPhone
    // Open apps one-by-one with a short delay so mobile OS can handle multiple intents
    for (let i = 0; i < targets.length; i++) {
      const st = targets[i]
      const msg = template === 'custom' ? body : buildBody(st)
      const phone = st.parent_phone || ''
      await supabase.from('message_outbox').insert([
        {
          school_id: school.id,
          channel,
          recipient: phone || null,
          body: msg,
          related_student_id: st.id,
          status: 'copied',
          created_by: user.id,
        },
      ])

      if (channel === 'whatsapp') {
        const wa = toWaPhone(phone)
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank')
      } else if (channel === 'sms') {
        window.open(smsHref(phone, msg), '_blank')
      } else {
        try {
          await navigator.clipboard.writeText(msg)
        } catch (_) {}
      }
      // pause between opens (mobile browsers often block rapid popups)
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 600))
    }

    if (channel === 'copy') toast('Messages copied one-by-one to clipboard', 'ok')
    else toast(`Opened ${targets.length} ${channel} draft(s). Send from the app.`, 'ok')
    setBusy(false)
    load()
  }

  if (!canSend) {
    return (
      <div className="space-y-4">
        <PageTitle>Parent messages</PageTitle>
        <Alert kind="warn">Only office roles can prepare parent messages.</Alert>
      </div>
    )
  }



  return (
    <div className="space-y-6">
      <PageTitle>Parent messages</PageTitle>
      {canEditTpl && (
        <Card title="Message templates">
          <p className="text-sm text-slate-600 mb-2">Save reusable text, then tap Use when sending.</p>
          <form onSubmit={saveTemplate} className="space-y-2 mb-3">
            <input className={input} placeholder="Title" value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} required />
            <textarea className={input + " min-h-[80px]"} placeholder="Body" value={tplBody} onChange={(e) => setTplBody(e.target.value)} required />
            <button type="submit" className={btnGreen}>Save template</button>
          </form>
          <ul className="text-sm space-y-1">
            {templates.map((t) => (
              <li key={t.id}>
                <button type="button" className="text-blue-700 font-semibold" onClick={() => { setTemplate("custom"); setBody(t.body); }}>
                  Use: {t.title}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Bulk open SMS / WhatsApp">
        <p className="text-sm text-slate-600 mb-3">
          Select parents, choose channel, then ShuleMoja opens the phone&apos;s SMS or WhatsApp app with the
          message filled in. You confirm and send — no paid SMS gateway.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <select className={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">Phone SMS app</option>
            <option value="copy">Copy only</option>
          </select>
          <select className={input} value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="fees">Fee reminder</option>
            <option value="results">Results ready</option>
            <option value="attendance">Attendance</option>
            <option value="custom">Custom text</option>
          </select>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => toggleAll(true)}>
              Select all
            </button>
            <button type="button" className={btn} onClick={() => toggleAll(false)}>
              Clear
            </button>
          </div>
        </div>
        {template === 'custom' && (
          <textarea
            className={`${input} mb-3 min-h-[80px]`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Custom message (same text for all selected)"
          />
        )}
        <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y mb-3">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={!!selected[s.id]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))}
              />
              <span className="flex-1 font-medium">
                {s.admission_no} — {s.first_name} {s.last_name}
              </span>
              <span className="text-xs text-slate-500">{s.parent_phone || 'No phone'}</span>
            </label>
          ))}
          {students.length === 0 && <p className="p-4 text-slate-500 text-sm">No active students</p>}
        </div>
        <Alert>{error}</Alert>
        <p className="text-xs text-slate-500 mb-2">
          Selected: {selectedList.length} · With phone: {withPhone.length}
        </p>
        <button type="button" disabled={busy} onClick={openBulk} className={btnGreen}>
          {busy ? 'Opening…' : `Open ${channel} for selected`}
        </button>
      </Card>
      <Card title="Recent outbox" className="!p-0">
        <Scroll>
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Channel</th>
                <th className={th}>To</th>
                <th className={th}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className={td}>{new Date(m.created_at).toLocaleString('en-GB')}</td>
                  <td className={td}>{m.channel}</td>
                  <td className={td}>{m.recipient || '—'}</td>
                  <td className={td}>{String(m.body).slice(0, 50)}…</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td className={td} colSpan={4}>
                    No messages yet
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
