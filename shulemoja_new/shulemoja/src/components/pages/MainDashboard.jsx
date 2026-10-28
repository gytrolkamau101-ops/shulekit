import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, NeedTerm, fmt, StatPill } from '../ui'
import { planEntitlements } from '../../lib/plans'
import { referralProgress, whatsappShareUrl } from '../../lib/referral'
import { ADMIN, FINANCE_ROLES, EXAM_ROLES } from '../../lib/roles'
import { whatsappUrl, smsUrl } from '../../lib/support'
import { getSettings } from '../../lib/platform'
import { t } from '../../lib/i18n'

export default function MainDashboard({ user, school, term, onNavigate, onPage, lang = 'en' }) {
  const go = onPage || onNavigate
  const ent = planEntitlements(school || {})
  const isPrem = !!(ent.prioritySupport || ent.messages)
  const [stats, setStats] = useState({ total: 0, girls: 0, boys: 0, collected: 0, expenses: 0 })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [support, setSupport] = useState({ whatsapp: '', phone: '' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await getSettings(['contacts', 'support'])
        if (!alive) return
        const c = s.contacts || {}
        const sup = s.support || {}
        setSupport({
          whatsapp: sup.whatsapp || c.whatsapp || '',
          phone: sup.phone || c.phone || '',
        })
      } catch (_) {}
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    if (!school?.id) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      try {
        const { data: students } = await supabase
          .from('students')
          .select('gender')
          .eq('school_id', school.id)
          .eq('status', 'Active')

        let collected = 0
        let expenses = 0
        if (term?.id) {
          if (FINANCE_ROLES.includes(user?.role)) {
            const { data: payments } = await supabase
              .from('fee_payments')
              .select('amount_paid')
              .eq('school_id', school.id)
              .eq('term_id', term.id)
            collected = (payments || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0)
          }
          if (ADMIN.includes(user?.role)) {
            const { data: exp } = await supabase
              .from('expenses')
              .select('amount')
              .eq('school_id', school.id)
              .eq('term_id', term.id)
            expenses = (exp || []).reduce((s, e) => s + Number(e.amount || 0), 0)
          }
        }

        const { data: upcoming } = await supabase
          .from('school_events')
          .select('*')
          .eq('school_id', school.id)
          .gte('event_date', new Date().toISOString().slice(0, 10))
          .order('event_date')
          .limit(4)

        if (!alive) return
        const list = students || []
        setStats({
          total: list.length,
          girls: list.filter((s) => s.gender === 'Female').length,
          boys: list.filter((s) => s.gender === 'Male').length,
          collected,
          expenses,
        })
        setEvents(upcoming || [])
      } catch (e) {
        console.error(e)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [school?.id, term?.id, user?.role])

  const canFinance = FINANCE_ROLES.includes(user?.role)
  const canExams = EXAM_ROLES.includes(user?.role)
  const isLeader = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary'].includes(user?.role)
  const rp = referralProgress(school || {})
  const trialActive =
    school?.trial_ends_at &&
    new Date(school.trial_ends_at) > new Date() &&
    (school.plan === 'trial' || !school.plan)

  const supportText = `ShuleMoja support\nSchool: ${school?.school_name || ''}\nUser: ${user?.full_name || ''}`
  const wa = whatsappUrl(support.whatsapp || support.phone, supportText)
  const sms = smsUrl(support.phone || support.whatsapp, supportText)

  const actions = [
    { label: t(lang, 'students'), go: 'students', show: true, icon: '◎' },
    { label: t(lang, 'fees'), go: 'finance', show: canFinance, icon: '₵' },
    { label: t(lang, 'exams'), go: 'exams', show: canExams, icon: '✎' },
    { label: t(lang, 'setup'), go: 'setup', show: isLeader, icon: '⚙' },
  ].filter((a) => a.show)

  return (
    <div className="space-y-4 sm-dash">
      {/* Hero — mobile safe */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white bg-gradient-to-br from-slate-900 via-blue-800 to-cyan-600 shadow-xl">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-blue-100/90 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
              {t(lang, 'dashboard')}
            </span>
            {isPrem ? (
              <span className="text-[9px] sm:text-[10px] font-black uppercase bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">
                {t(lang, 'premium')}
              </span>
            ) : (
              <span className="text-[9px] sm:text-[10px] font-bold uppercase bg-white/20 px-2 py-0.5 rounded-full">
                {t(lang, 'basic')}
              </span>
            )}
            {trialActive && (
              <span className="text-[9px] sm:text-[10px] font-bold uppercase bg-white/15 border border-white/25 px-2 py-0.5 rounded-full">
                {t(lang, 'trial')}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight truncate">
            {user?.full_name || '—'}
          </h1>
          <p className="text-cyan-100/90 text-sm font-medium truncate">{school?.school_name}</p>
          {term && (
            <p className="text-cyan-100/70 text-xs mt-1">
              {t(lang, 'term')} {term.term} · {term.year}
            </p>
          )}
        </div>
      </div>

      {/* Gold: Contact Support + Invite · Earn → full pages */}
      <div className="flex flex-wrap gap-2">
        {isPrem && (
          <button type="button" onClick={() => go?.('support')} className="sm-gold-btn">
            <span className="sm-gold-icon">☎</span>
            {t(lang, 'contactSupport')}
          </button>
        )}
        {isPrem && isLeader && (
          <button type="button" onClick={() => go?.('referrals')} className="sm-gold-btn">
            <span className="sm-gold-icon">🏆</span>
            {t(lang, 'inviteEarn')}
          </button>
        )}
      </div>

      {!term && <NeedTerm />}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="sk-spinner" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatPill label={t(lang, 'students')} value={stats.total} tone="blue" />
            <StatPill label={t(lang, 'girls')} value={stats.girls} tone="pink" />
            <StatPill label={t(lang, 'boys')} value={stats.boys} tone="violet" />
            {canFinance && (
              <StatPill label={t(lang, 'feesTerm')} value={`KES ${fmt(stats.collected)}`} tone="green" />
            )}
          </div>

          {/* Quick Actions — dark banner tiles */}
          <div className="rounded-2xl border-2 border-slate-800/80 bg-slate-900/95 p-3 sm:p-4 shadow-xl">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-400/90 mb-3 px-1">
              {t(lang, 'quickActions')}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {actions.map((a) => (
                <button
                  key={a.go}
                  type="button"
                  onClick={() => go?.(a.go)}
                  className="sm-qa-banner"
                >
                  <span className="text-lg opacity-90">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title={t(lang, 'upcoming')}>
              {events.length === 0 ? (
                <p className="text-slate-500 text-sm">{t(lang, 'noEvents')}</p>
              ) : (
                <ul className="space-y-2">
                  {events.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2 text-sm border-l-4 border-cyan-500 pl-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {e.event_name}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">
                        {new Date(e.event_date).toLocaleDateString('en-GB')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
