/** Basic / Premium / Pro / Custom — caps + feature flags (v38 structure) */

export const PREMIUM_MODULES = ['messages', 'attendance', 'timetable', 'circulars', 'import', 'support', 'referrals', 'boarding', 'transport', 'bom', 'records', 'staff-desk']

export const PLAN_FEATURES = {
  free: {
    messages: false, attendance: false, timetable: false, circulars: false, import: false, boarding: false, transport: false, bom: false, records: false, staffDesk: false,
    parentPay: false, bulkMessaging: false, messageTemplates: false, notifyAbsent: false,
    feeHeads: false, defaulterBlast: false, prioritySupport: false, fullBranding: false,
    parentDownloads: false, reportWatermark: true,
    defaultCap: 100, staffCap: 10, parentCap: 80,
  },
  trial: {
    messages: true, attendance: true, timetable: true, circulars: true, import: true, boarding: true, transport: true, bom: true, records: true, staffDesk: true,
    parentPay: true, bulkMessaging: true, messageTemplates: true, notifyAbsent: true,
    feeHeads: true, defaulterBlast: true, prioritySupport: false, fullBranding: true,
    parentDownloads: true, reportWatermark: false,
    defaultCap: 250, staffCap: 30, parentCap: 200,
  },
  basic: {
    messages: false, attendance: false, timetable: false, circulars: false, import: false, boarding: false, transport: false, bom: false, records: false, staffDesk: false,
    parentPay: false, bulkMessaging: false, messageTemplates: false, notifyAbsent: false,
    feeHeads: true, defaulterBlast: false, prioritySupport: false, fullBranding: false,
    parentDownloads: false, reportWatermark: true,
    defaultCap: 200, staffCap: 25, parentCap: 150,
  },
  premium: {
    messages: true, attendance: true, timetable: true, circulars: true, import: true, boarding: true, transport: true, bom: true, records: true, staffDesk: true,
    parentPay: true, bulkMessaging: true, messageTemplates: true, notifyAbsent: true,
    feeHeads: true, defaulterBlast: true, prioritySupport: true, fullBranding: true,
    parentDownloads: true, reportWatermark: false,
    defaultCap: 500, staffCap: 50, parentCap: 350,
  },
  pro: {
    messages: true, attendance: true, timetable: true, circulars: true, import: true, boarding: true, transport: true, bom: true, records: true, staffDesk: true,
    parentPay: true, bulkMessaging: true, messageTemplates: true, notifyAbsent: true,
    feeHeads: true, defaulterBlast: true, prioritySupport: true, fullBranding: true,
    parentDownloads: true, reportWatermark: false,
    defaultCap: 1000, staffCap: 80, parentCap: 800,
  },
  custom: {
    messages: true, attendance: true, timetable: true, circulars: true, import: true, boarding: true, transport: true, bom: true, records: true, staffDesk: true,
    parentPay: true, bulkMessaging: true, messageTemplates: true, notifyAbsent: true,
    feeHeads: true, defaulterBlast: true, prioritySupport: true, fullBranding: true,
    parentDownloads: true, reportWatermark: false,
    defaultCap: 2000, staffCap: 180, parentCap: 1800,
  },
  termly: {
    messages: false, attendance: false, timetable: false, circulars: false, import: false,
    parentPay: false, bulkMessaging: false, messageTemplates: false, notifyAbsent: false,
    feeHeads: true, defaulterBlast: false, prioritySupport: false, fullBranding: false,
    parentDownloads: false, reportWatermark: true,
    defaultCap: 200, staffCap: 25, parentCap: 150,
  },
  yearly: {
    messages: true, attendance: true, timetable: true, circulars: true, import: true,
    parentPay: true, bulkMessaging: true, messageTemplates: true, notifyAbsent: true,
    feeHeads: true, defaulterBlast: true, prioritySupport: true, fullBranding: true,
    parentDownloads: true, reportWatermark: false,
    defaultCap: 500, staffCap: 50, parentCap: 350,
  },
}

export function planEntitlements(school) {
  const id = (school?.plan || 'basic').toLowerCase()
  const base = PLAN_FEATURES[id] || PLAN_FEATURES.basic
  const cap = school?.student_cap || base.defaultCap
  if (school?.plan_expires_at) {
    const exp = new Date(school.plan_expires_at).getTime()
    if (exp < Date.now() && id !== 'trial' && id !== 'free') {
      return { ...PLAN_FEATURES.basic, defaultCap: cap, expired: true, planId: id }
    }
  }
  return { ...base, defaultCap: cap, expired: false, planId: id }
}

export function canAccessModule(school, moduleId) {
  if (moduleId === 'support' || moduleId === 'referrals') {
    const e = planEntitlements(school)
    return !!(e.messages || e.attendance || e.planId === 'premium' || e.planId === 'trial' || e.planId === 'pro' || e.planId === 'custom')
  }
  if (!PREMIUM_MODULES.includes(moduleId)) return true
  const e = planEntitlements(school)
  return !!e[moduleId]
}

export function isPremium(school) {
  const e = planEntitlements(school)
  return !!(e.messages || e.attendance || e.planId === 'premium' || e.planId === 'trial' || e.planId === 'pro' || e.planId === 'custom')
}

/** Official public pricing (KES / term) */
export const DEFAULT_PLANS = {
  currency: 'KES',
  plans: [
    {
      id: 'premium',
      name: 'Premium',
      price: 3500,
      period: 'per term',
      highlight: true,
      features: [
        'Up to 500 students · 50 staff · 350 parents',
        'Priority WhatsApp support',
        'Full school branding (no report watermark)',
        'Attendance, Messages, Timetable, Circulars, Import',
        'Parent downloads: report cards & fee statements',
        'Invite schools · earn free terms',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 5000,
      period: 'per term',
      features: [
        'Up to 1,000 students · 80 staff · 800 parents',
        'Everything in Premium',
        'Higher capacity for large schools',
      ],
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 2000,
      period: 'per term',
      features: [
        'Up to 200 students · 25 staff · 150 parents',
        'Students, fees, exams & report cards',
        'Parent portal: balances (view)',
        'ShuleMoja watermark on class reports',
        'Email support',
      ],
    },
    {
      id: 'custom',
      name: 'Custom',
      price: 0,
      period: 'contact us',
      features: [
        'From ~1,000+ students with custom caps',
        'Institution setup as agreed',
        'Contact BigDataKE for a quote',
      ],
    },
  ],
  promos: [
    'Buy 3 Premium terms → get 1 Premium free',
    'Buy 2 Pro terms → get 1 Pro free',
  ],
}
