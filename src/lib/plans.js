/** Basic + Premium only — billed termly */

export const PREMIUM_MODULES = [
  'messages',
  'attendance',
  'timetable',
  'circulars',
  'import',
  'support',
  'referrals',
  'boarding',
  'transport',
  'bom',
  'records',
  'staff-desk',
]

const PREMIUM_FEATURES = {
  messages: true,
  attendance: true,
  timetable: true,
  circulars: true,
  import: true,
  boarding: true,
  transport: true,
  bom: true,
  records: true,
  staffDesk: true,
  parentPay: true,
  bulkMessaging: true,
  messageTemplates: true,
  notifyAbsent: true,
  feeHeads: true,
  defaulterBlast: true,
  prioritySupport: true,
  fullBranding: true,
  parentDownloads: true,
  reportWatermark: false,
}

const BASIC_FEATURES = {
  messages: false,
  attendance: false,
  timetable: false,
  circulars: false,
  import: false,
  boarding: false,
  transport: false,
  bom: false,
  records: false,
  staffDesk: false,
  parentPay: false,
  bulkMessaging: false,
  messageTemplates: false,
  notifyAbsent: false,
  feeHeads: true,
  defaulterBlast: false,
  prioritySupport: false,
  fullBranding: false,
  parentDownloads: false,
  reportWatermark: true,
}

export const PLAN_FEATURES = {
  free: { ...BASIC_FEATURES, defaultCap: 100, staffCap: 10, parentCap: 80 },
  trial: {
    ...PREMIUM_FEATURES,
    prioritySupport: false,
    defaultCap: 250,
    staffCap: 30,
    parentCap: 200,
  },
  basic: {
    ...BASIC_FEATURES,
    defaultCap: 200,
    staffCap: 25,
    parentCap: 150,
  },
  premium: {
    ...PREMIUM_FEATURES,
    defaultCap: 500,
    staffCap: 50,
    parentCap: 350,
  },
  // Legacy ids → treat as premium (no longer sold)
  pro: { ...PREMIUM_FEATURES, defaultCap: 500, staffCap: 50, parentCap: 350 },
  custom: { ...PREMIUM_FEATURES, defaultCap: 500, staffCap: 50, parentCap: 350 },
  termly: { ...BASIC_FEATURES, defaultCap: 200, staffCap: 25, parentCap: 150 },
  yearly: { ...PREMIUM_FEATURES, defaultCap: 500, staffCap: 50, parentCap: 350 },
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
    return isPremium(school)
  }
  if (!PREMIUM_MODULES.includes(moduleId)) return true
  const e = planEntitlements(school)
  const key = moduleId === 'staff-desk' ? 'staffDesk' : moduleId
  return !!e[key]
}

export function isPremium(school) {
  const e = planEntitlements(school)
  const id = e.planId || ''
  if (e.expired) return false
  return id === 'premium' || id === 'trial' || id === 'pro' || id === 'custom' || !!e.messages
}

/** Public pricing — Basic + Premium, termly only */
export const DEFAULT_PLANS = {
  currency: 'KES',
  billing: 'termly',
  plans: [
    {
      id: 'premium',
      name: 'Premium',
      price: 3500,
      period: 'per term',
      highlight: true,
      features: [
        'Up to 500 students · 50 staff · 350 parents',
        'Attendance, Messages, Timetable, Circulars, Import',
        'Boarding, Transport, BOM, Records, Staff desk',
        'Full branding · no report watermark',
        'Parent downloads (fee statement / reports)',
        'Priority WhatsApp support',
        'Invite schools · earn free terms',
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
  ],
}
