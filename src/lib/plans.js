/** Basic vs Premium entitlements */

export const PLAN_FEATURES = {
  basic: {
    parentPay: false,
    bulkMessaging: false,
    messageTemplates: false,
    notifyAbsent: false,
    feeHeads: false,
    defaulterBlast: false,
    prioritySupport: false,
    defaultCap: 250,
  },
  trial: {
    parentPay: true,
    bulkMessaging: true,
    messageTemplates: true,
    notifyAbsent: true,
    feeHeads: true,
    defaulterBlast: true,
    prioritySupport: false,
    defaultCap: 250,
  },
  free: {
    parentPay: false,
    bulkMessaging: false,
    messageTemplates: false,
    notifyAbsent: false,
    feeHeads: false,
    defaulterBlast: false,
    prioritySupport: false,
    defaultCap: 100,
  },
  premium: {
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
    parentPay: false,
    bulkMessaging: false,
    messageTemplates: false,
    notifyAbsent: false,
    feeHeads: false,
    defaulterBlast: false,
    prioritySupport: false,
    defaultCap: 250,
  },
  yearly: {
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
  // Expired paid plan → treat as basic limits if past expiry
  if (school?.plan_expires_at) {
    const exp = new Date(school.plan_expires_at).getTime()
    if (exp < Date.now() && id !== 'trial' && id !== 'free') {
      return { ...PLAN_FEATURES.basic, defaultCap: cap, expired: true, planId: id }
    }
  }
  return { ...base, defaultCap: cap, expired: false, planId: id }
}

export function isPremium(school) {
  const e = planEntitlements(school)
  return e.parentPay || e.bulkMessaging
}
