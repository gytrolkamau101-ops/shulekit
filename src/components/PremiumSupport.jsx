import { useEffect, useState } from 'react'
import { getSettings } from '../lib/platform'
import { planEntitlements } from '../lib/plans'
import { whatsappUrl, smsUrl } from '../lib/support'

/**
 * Premium-only priority support. Public site shows email only.
 */
export default function PremiumSupport({ school, user, compact }) {
  const [cfg, setCfg] = useState({ whatsapp: '', phone: '', email: '' })
  const ent = planEntitlements(school)
  const isPrem = !!(ent.prioritySupport || ent.messages)

  useEffect(() => {
    getSettings(['contacts', 'support']).then((s) => {
      const c = s.contacts || {}
      const sup = s.support || {}
      setCfg({
        whatsapp: sup.whatsapp || c.whatsapp || '',
        phone: sup.phone || c.phone || '',
        email: c.email || '',
      })
    })
  }, [])

  if (!isPrem) {
    if (compact) return null
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-bold">Priority support is a Premium benefit</p>
        <p className="text-xs mt-1 text-amber-900/80">
          Upgrade for one-tap WhatsApp help from BigDataKE. Public contact remains email only.
        </p>
      </div>
    )
  }

  const text = `ShuleMoja Premium support\nSchool: ${school?.school_name || ''}\nPlan: ${school?.plan || 'premium'}\nUser: ${user?.full_name || ''} (${user?.role || ''})\nIssue: `
  const wa = whatsappUrl(cfg.whatsapp || cfg.phone, text)
  const sms = smsUrl(cfg.phone || cfg.whatsapp, text)

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-600 border-2 border-emerald-300 shadow-lg shadow-emerald-600/30"
          >
            WhatsApp Support
          </a>
        )}
        {sms && (
          <a
            href={sms}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm text-slate-800 bg-white border-2 border-slate-300 shadow-md"
          >
            SMS Support
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Premium</p>
          <h3 className="font-black text-slate-900 text-lg">Priority support</h3>
          <p className="text-xs text-slate-600 mt-1">
            Chat with BigDataKE on WhatsApp. We prioritise Premium schools.
          </p>
        </div>
        <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-1 rounded-full">PRO</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-600 border-2 border-emerald-400 shadow-lg"
          >
            Open WhatsApp
          </a>
        ) : (
          <p className="text-xs text-amber-800">Support WhatsApp not configured yet (Super Admin → Pages / support).</p>
        )}
        {sms && (
          <a href={sms} className="inline-flex items-center px-4 py-2.5 rounded-xl font-bold text-sm border-2 border-slate-300 bg-white shadow-md">
            SMS
          </a>
        )}
      </div>
    </div>
  )
}

/** Floating button for Premium staff */
export function PremiumSupportFab({ school, user }) {
  const [cfg, setCfg] = useState({ whatsapp: '', phone: '' })
  const ent = planEntitlements(school)
  const isPrem = !!(ent.prioritySupport || ent.messages)

  useEffect(() => {
    getSettings(['contacts', 'support']).then((s) => {
      const c = s.contacts || {}
      const sup = s.support || {}
      setCfg({ whatsapp: sup.whatsapp || c.whatsapp || '', phone: sup.phone || c.phone || '' })
    })
  }, [])

  if (!isPrem) return null
  const text = `ShuleMoja Premium\n${school?.school_name || ''}\n${user?.full_name || ''}: `
  const wa = whatsappUrl(cfg.whatsapp || cfg.phone, text)
  if (!wa) return null

  return (
    <a
      href={wa}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-emerald-500 to-green-600 border-2 border-white/40 shadow-2xl shadow-emerald-700/40 active:scale-95"
      title="Premium WhatsApp support"
    >
      Support
    </a>
  )
}
