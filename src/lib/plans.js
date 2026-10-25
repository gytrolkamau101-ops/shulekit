/** Basic vs Premium — Premium-only modules: Messages, Attendance, Timetable, Circulars, Import */

export const PREMIUM_MODULES = ['messages', 'attendance', 'timetable', 'circulars', 'import']

export const PLAN_FEATURES = {
  basic: {
    messages: false,
    attendance: false,
    timetable: false,
    circulars: false,
    import: false,
    parentPay: false,
    bulkMessaging: false,
    messageTemplates: false,
    notifyAbsent: false,
    feeHeads: true,
    defaulterBlast: false,
    prioritySupport: false,
    defaultCap: 250,
  },
  free: {
    messages: false,
    attendance: false,
    timetable: false,
    circulars: false,
    import: false,
    parentPay: false,
    bulkMessaging: false,
    messageTemplates: false,
    notifyAbsent: false,
    feeHeads: false,
    defaulterBlast: false,
    prioritySupport: false,
    defaultCap: 100,
  },
  trial: {
    messages: true,
    attendance: true,
    timetable: true,
    circulars: true,
    import: true,
    parentPay: true,
    bulkMessaging: true,
    messageTemplates: true,
    notifyAbsent: true,
    feeHeads: true,
    defaulterBlast: true,
    prioritySupport: false,
    defaultCap: 250,
  },
  premium: {
    messages: true,
    attendance: true,
    timetable: true,
    circulars: true,
    import: true,
    parentPay: true,
    bulkMessaging: true,
    messageTemplates: true,
    notifyAbsent: true,
    feeHeads: true,
    defaulterBlast: true,
    prioritySupport: true,
    defaultCap: 500,
  },
  pro: {
    messages: true,
    attendance: true,
    timetable: true,
    circulars: true,
    import: true,
    parentPay: true,
    bulkMessaging: true,
    messageTemplates: true,
    notifyAbsent: true,
    feeHeads: true,
    defaulterBlast: true,
    prioritySupport: true,
    defaultCap: 1000,
  },
  termly: {
    messages: false,
    attendance: false,
    timetable: false,
    circulars: false,
    import: false,
    parentPay: false,
    bulkMessaging: false,
    messageTemplates: false,
    notifyAbsent: false,
    feeHeads: true,
    defaulterBlast: false,
    prioritySupport: false,
    defaultCap: 250,
  },
  yearly: {
    messages: true,
    attendance: true,
    timetable: true,
    circulars: true,
    import: true,
    parentPay: true,
    bulkMessaging: true,
    messageTemplates: true,
    notifyAbsent: true,
    feeHeads: true,
    defaulterBlast: true,
    prioritySupport: true,
    defaultCap: 500,
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
  if (!PREMIUM_MODULES.includes(moduleId)) return true
  const e = planEntitlements(school)
  return !!e[moduleId]
}

export function isPremium(school) {
  const e = planEntitlements(school)
  return !!(e.messages || e.attendance || e.planId === 'premium' || e.planId === 'trial')
}

export const DEFAULT_PLANS = {
  currency: 'KES',
  plans: [
    {
      id: 'premium',
      name: 'Premium',
      price: 4000,
      period: 'per term',
      days: 120,
      highlight: true,
      features: [
        'Everything in Basic',
        'Messages (bulk WhatsApp / SMS)',
        'Attendance + absent alerts',
        'Timetable',
        'Circulars',
        'Import centre (Excel/CSV)',
        'Up to 500 learners',
      ],
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 2000,
      period: 'per term',
      days: 120,
      highlight: false,
      features: [
        'Students, fees, exams, report cards',
        'Admissions, resources, school setup',
        'Parent view portal',
        'Up to 250 learners',
        'No Messages / Attendance / Timetable / Circulars / Import',
      ],
    },
  ],
}
