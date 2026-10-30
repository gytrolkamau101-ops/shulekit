import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Scroll, Alert, PageTitle, input, btn, btnGreen, th, td } from '../ui'

const DEFAULT_TEMPLATES = [
  {
    key: 'fee',
    title: 'Fee reminder',
    body: 'Dear Parent, this is a reminder that school fees are due. Please clear the balance at your earliest convenience. — {school}',
  },
  {
    key: 'meeting',
    title: 'Parents meeting',
    body: 'Dear Parent, you are invited to a parents meeting at {school}. Kindly confirm attendance.',
  },
  {
    key: 'general',
    title: 'General notice',
    body: 'Dear Parent, {school} shares the following notice: ',
  },
]

export default function Messaging({ school }) {
  const [channel, setChannel] = useState('WhatsApp')
  const [templates, setTemplates] = useState([])
  const [tplKey, setTplKey] = useState('fee')
  const [body, setBody] = useState('')
  const [log, setLog] = useState([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const schoolName = school?.school_name || 'School'

  const applyTemplate = (key, list) => {
    const all = list?.length ? list : DEFAULT_TEMPLATES
    const t = all.find((x) => (x.template_key || x.key) === key) || all[0]
    const raw = t?.body || ''
    setBody(raw.replace(/\{school\}/gi, schoolName))
  }

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: tpls }] = await Promise.all([
      supabase
        .from('message_outbox')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('message_templates').select('*').eq('school_id', school.id).order('title'),
    ])
    setLog(msgs || [])
    const merged =
      tpls?.length > 0
        ? tpls.map((t) => ({ key: t.template_key, title: t.title, body: t.body }))
        : DEFAULT_TEMPLATES
    setTemplates(merged)
    applyTemplate(tplKey, merged)
  }, [school.id])

  useEffect(() => {
    load()
  }, [load])

  const openChannel = async () => {
    setError('')
    setInfo('')
    const text = (body || '').trim()
    if (!text) {
      setError('Type or edit the message first.')
      return
    }
    try {
      if (channel === 'WhatsApp') {
        // Opens WhatsApp; user picks contact(s) in the app
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      } else {
        // Opens device SMS composer with body; user picks recipients
        window.location.href = `sms:?body=${encodeURIComponent(text)}`
      }
      await supabase.from('message_outbox').insert([
        {
          school_id: school.id,
          channel: channel.toLowerCase(),
          recipient: 'device-composer',
          body: text.slice(0, 500),
        },
      ])
      setInfo(
        channel === 'WhatsApp'
          ? 'WhatsApp opened. Choose the parent(s) there, edit if needed, then send.'
          : 'SMS app opened. Choose the parent(s) there, edit if needed, then send.'
      )
      load()
    } catch (e) {
      setError(e?.message || 'Could not open messaging app')
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle>Messages</PageTitle>
      <Card title="Open SMS / WhatsApp">
        <p className="text-sm text-slate-600 mb-3">
          Edit the message below, then open SMS or WhatsApp. You choose who to send to in your phone app — no multi-select list here, no paid SMS gateway.
        </p>
        <select
          className={`${input} mb-2`}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="WhatsApp">WhatsApp</option>
          <option value="SMS">SMS</option>
        </select>
        <select
          className={`${input} mb-2`}
          value={tplKey}
          onChange={(e) => {
            setTplKey(e.target.value)
            applyTemplate(e.target.value, templates)
          }}
        >
          {(templates.length ? templates : DEFAULT_TEMPLATES).map((t) => (
            <option key={t.key || t.title} value={t.key || t.template_key}>
              {t.title}
            </option>
          ))}
        </select>
        <textarea
          className={`${input} min-h-[140px] mb-3`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message…"
        />
        <Alert>{error}</Alert>
        {info && <Alert kind="ok">{info}</Alert>}
        <button type="button" onClick={openChannel} className={btnGreen}>
          Open {channel} with this message
        </button>
      </Card>
      <Card title="Recent outbox" className="!p-0">
        <Scroll>
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Channel</th>
                <th className={th}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className={td}>{new Date(m.created_at).toLocaleString('en-GB')}</td>
                  <td className={td}>{m.channel}</td>
                  <td className={td}>{String(m.body || '').slice(0, 80)}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td className={td} colSpan={3}>
                    No messages logged yet
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
