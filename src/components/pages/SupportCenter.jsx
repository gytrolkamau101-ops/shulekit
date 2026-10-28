import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, input, btn, btnGreen, Alert, Spinner } from '../ui'
import { getSettings } from '../../lib/platform'
import { whatsappUrl, smsUrl } from '../../lib/support'
import { isPremium } from '../../lib/plans'
import { t } from '../../lib/i18n'
import ImagePicker from '../ImagePicker'

export default function SupportCenter({ school, user, lang = 'en' }) {
  const [cfg, setCfg] = useState({ whatsapp: '', phone: '', email: '' })
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [tickets, setTickets] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const s = await getSettings(['contacts', 'support'])
      const c = s.contacts || {}
      const sup = s.support || {}
      setCfg({
        whatsapp: sup.whatsapp || c.whatsapp || '',
        phone: sup.phone || c.phone || '',
        email: c.email || 'support@bigdatake.local',
      })
      if (school?.id) {
        const { data } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('school_id', school.id)
          .order('created_at', { ascending: false })
          .limit(30)
        setTickets(data || [])
      }
    } catch (e) {
      setErr(e.message || 'Load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [school?.id])

  if (!isPremium(school)) {
    return (
      <Card title={t(lang, 'contactSupport')}>
        <p className="text-sm text-slate-600">Premium schools get priority support channels and in-app tickets.</p>
      </Card>
    )
  }

  const text = `ShuleMoja Premium support\nSchool: ${school?.school_name || ''}\nUser: ${user?.full_name || ''} (${user?.role || ''})\n`
  const wa = whatsappUrl(cfg.whatsapp || cfg.phone, text)
  const sms = smsUrl(cfg.phone || cfg.whatsapp, text)
  const tel = cfg.phone ? `tel:${String(cfg.phone).replace(/\s/g, '')}` : null
  const mail = cfg.email ? `mailto:${cfg.email}?subject=${encodeURIComponent('ShuleMoja support — ' + (school?.school_name || ''))}` : null

  const sendTicket = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    const { error } = await supabase.from('support_tickets').insert({
      school_id: school.id,
      user_id: user.id,
      subject: subject.trim(),
      body: body.trim(),
      media_url: mediaUrl.trim() || null,
      channel: 'in_app',
      status: 'open',
    })
    setBusy(false)
    if (error) {
      setErr(error.message + ' — run 21_v34_support.sql in Supabase if table is missing')
      return
    }
    setSubject('')
    setBody('')
    setMediaUrl('')
    setMsg('Ticket sent. Track replies below.')
    load()
  }

  return (
    <div className="space-y-4 sk-animate-in">
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Premium</p>
        <h1 className="text-2xl font-black">{t(lang, 'contactSupport')}</h1>
        <p className="text-cyan-100/90 text-sm mt-1">WhatsApp, SMS, call, email, or message BigDataKE in-app.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="sm-gold-btn justify-center">
            ✦ WhatsApp
          </a>
        )}
        {sms && (
          <a href={sms} className="sm-gold-btn justify-center">
            💬 SMS
          </a>
        )}
        {tel && (
          <a href={tel} className="sm-gold-btn justify-center">
            ☎ {t(lang, 'call')}
          </a>
        )}
        {mail && (
          <a href={mail} className="sm-gold-btn justify-center">
            ✉ {t(lang, 'email')}
          </a>
        )}
      </div>

      {!wa && !sms && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Direct channels not configured yet. You can still send an in-app ticket. Super Admin → Pages / support.
        </p>
      )}

      <Card title={t(lang, 'sendTicket')}>
        <Alert kind="error" onClose={() => setErr('')}>{err}</Alert>
        <Alert kind="ok" onClose={() => setMsg('')}>{msg}</Alert>
        <form onSubmit={sendTicket} className="space-y-3">
          <input className={input} placeholder={t(lang, 'subject')} value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <textarea className={input} rows={4} placeholder={t(lang, 'message')} value={body} onChange={(e) => setBody(e.target.value)} required />
          <ImagePicker
            label={t(lang, 'mediaUrl')}
            value={mediaUrl}
            onChange={setMediaUrl}
            maxW={1200}
            previewClass="h-28 max-w-full object-contain rounded-xl border-2 border-slate-200"
          />
          <p className="text-[11px] text-slate-500">Pick a screenshot from gallery/camera, or paste a link.</p>
          <button disabled={busy} className={`${btnGreen} w-full`}>{busy ? '…' : t(lang, 'sendTicket')}</button>
        </form>
      </Card>

      <Card title={t(lang, 'yourTickets')}>
        {loading ? (
          <Spinner dark />
        ) : tickets.length === 0 ? (
          <p className="text-sm text-slate-500">No tickets yet.</p>
        ) : (
          <ul className="space-y-3">
            {tickets.map((tk) => (
              <li key={tk.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <p className="font-bold text-slate-900">{tk.subject}</p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${tk.status === 'replied' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                    {tk.status === 'replied' ? t(lang, 'replied') : t(lang, 'open')}
                  </span>
                </div>
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{tk.body}</p>
                {tk.media_url && (
                  <a href={tk.media_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-semibold">Media</a>
                )}
                {tk.admin_reply && (
                  <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-100 p-2 text-emerald-900">
                    <p className="text-[10px] font-black uppercase">BigDataKE</p>
                    <p className="whitespace-pre-wrap">{tk.admin_reply}</p>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">{new Date(tk.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
