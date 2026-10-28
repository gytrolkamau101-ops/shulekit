import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, Spinner } from '../ui'
import { referralProgress, whatsappShareUrl } from '../../lib/referral'
import { isPremium } from '../../lib/plans'
import { t } from '../../lib/i18n'

export default function ReferralsCenter({ school, lang = 'en' }) {
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const rp = referralProgress(school || {})

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!school?.referral_code) {
        setLoading(false)
        return
      }
      try {
        const { data } = await supabase
          .from('referral_signups')
          .select('id, school_id, referral_code, created_at')
          .eq('referral_code', school.referral_code)
          .order('created_at', { ascending: false })
          .limit(50)
        if (!alive) return
        setSignups(data || [])
      } catch (_) {
        setSignups([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [school?.referral_code])

  if (!isPremium(school)) {
    return (
      <Card title={t(lang, 'inviteEarn')}>
        <p className="text-sm text-slate-600">Referral rewards are a Premium benefit.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sk-animate-in">
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-amber-600 via-orange-600 to-slate-900 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-100">🏆 Premium</p>
        <h1 className="text-2xl font-black">{t(lang, 'inviteEarn')}</h1>
        <p className="text-amber-50/90 text-sm mt-1">Track codes, invites, and free Premium progress.</p>
      </div>

      <Card title="Your code">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xl font-black tracking-widest bg-slate-900 text-amber-300 px-4 py-2 rounded-xl border border-amber-500/30">
            {rp.code || '—'}
          </code>
          {rp.code && (
            <>
              <button type="button" className="text-sm font-bold text-blue-700" onClick={() => navigator.clipboard?.writeText(rp.code)}>
                {t(lang, 'copy')}
              </button>
              <a className="text-sm font-bold text-emerald-700" href={whatsappShareUrl(rp.code, school?.school_name)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </>
          )}
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-700" style={{ width: `${rp.progressPct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
            <p className="text-lg font-black text-slate-900">{rp.credits}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Credits</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
            <p className="text-lg font-black text-slate-900">{rp.invites}/6</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Invites</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
            <p className="text-lg font-black text-slate-900">{rp.grants}/2</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Free Prem</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-3">{rp.nextFreeLabel}</p>
        <p className="text-[11px] text-slate-500 mt-1">100 credits per paying school you refer · 300 unlocks free Premium (max 2).</p>
      </Card>

      <Card title="Signup activity">
        {loading ? (
          <Spinner dark />
        ) : signups.length === 0 ? (
          <p className="text-sm text-slate-500">No signups with your code yet. Share it with other schools.</p>
        ) : (
          <ul className="space-y-2">
            {signups.map((s) => (
              <li key={s.id} className="flex justify-between text-sm border-b border-slate-100 py-2">
                <span className="font-mono text-xs text-slate-600">{String(s.school_id).slice(0, 8)}…</span>
                <span className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
