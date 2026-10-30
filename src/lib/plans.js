/** Basic / Premium / Pro — termly */

export const PREMIUM_MODULES = [
  'messages', 'attendance', 'timetable', 'circulars', 'import',
  'support', 'referrals', 'records',
  'boarding', 'transport', 'bom', 'staff-desk', 'games',
]

const CORE = {
  messages: false, attendance: false, timetable: false, circulars: false, import: false,
  boarding: false, transport: false, bom: false, records: false, staffDesk: false, games: false,
  parentPay: false, bulkMessaging: false, messageTemplates: false, notifyAbsent: false,
  feeHeads: true, defaulterBlast: false, prioritySupport: false, fullBranding: false,
  parentDownloads: false, reportWatermark: true,
}

const PREMIUM_SUITE = {
  ...CORE,
  messages: true, attendance: true, timetable: true, circulars: true, import: true,
  records: true, parentPay: true, bulkMessaging: true, messageTemplates: true, notifyAbsent: true,
  defaulterBlast: true, prioritySupport: true, fullBranding: true,
  parentDownloads: true, reportWatermark: false,
}

const PRO_SUITE = {
  ...PREMIUM_SUITE,
  boarding: true, transport: true, bom: true, staffDesk: true, games: true,
}

export const PLAN_FEATURES = {
  free: { ...CORE, defaultCap: 100, staffCap: 10, parentCap: 80 },
  trial: { ...PRO_SUITE, prioritySupport: false, defaultCap: 250, staffCap: 30, parentCap: 200 },
  basic: { ...CORE, defaultCap: 200, staffCap: 25, parentCap: 150 },
  premium: { ...PREMIUM_SUITE, defaultCap: 500, staffCap: 50, parentCap: 350 },
  pro: { ...PRO_SUITE, defaultCap: 1000, staffCap: 80, parentCap: 800 },
  custom: { ...PRO_SUITE, defaultCap: 1000, staffCap: 80, parentCap: 800 },
  termly: { ...CORE, defaultCap: 200, staffCap: 25, parentCap: 150 },
  yearly: { ...PREMIUM_SUITE, defaultCap: 500, staffCap: 50, parentCap: 350 },
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
    return isPremiumOrPro(school)
  }
  if (!PREMIUM_MODULES.includes(moduleId)) return true
  const e = planEntitlements(school)
  const key = moduleId === 'staff-desk' ? 'staffDesk' : moduleId
  return !!e[key]
}

export function isPremiumOrPro(school) {
  const e = planEntitlements(school)
  if (e.expired) return false
  const id = e.planId || ''
  return id === 'premium' || id === 'pro' || id === 'trial' || id === 'custom' || !!e.messages
}

export function isPremium(school) {
  return isPremiumOrPro(school)
}

export function isPro(school) {
  const e = planEntitlements(school)
  if (e.expired) return false
  const id = e.planId || ''
  return id === 'pro' || id === 'trial' || id === 'custom' || !!e.boarding
}

export const DEFAULT_PLANS = {
  currency: 'KES',
  billing: 'termly',
  plans: [
    {
      id: 'pro',
      name: 'Pro',
      price: 5000,
      period: 'per term',
      highlight: true,
      features: [
        'Up to 1000 students',
        'Everything in Premium',
        'Boarding · Transport · BOM · Staff desk · Games',
        'Full operations suite',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 3500,
      period: 'per term',
      features: [
        'Up to 500 students',
        'Messages, Attendance, Timetable, Circulars, Import',
        'Records · parent downloads · priority support',
        'Referrals · earn free terms',
      ],
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 2000,
      period: 'per term',
      features: [
        'Up to 200 students',
        'Students, fees, exams & report cards',
        'Parent portal (view balances)',
      ],
    },
  ],
}
