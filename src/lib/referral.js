/** Referral helpers — Premium inviters earn free Premium progress */

export const REFERRAL_THRESHOLD = 300
export const REFERRAL_POINTS_PER_PAID = 100
export const MAX_LIFETIME_INVITES = 6
export const MAX_FREE_PREMIUMS = 2

export function referralProgress(school) {
  const credits = Number(school?.referral_credits || 0)
  const invites = Number(school?.lifetime_invite_count || 0)
  const grants = Number(school?.free_premium_grants || 0)
  const code = school?.referral_code || ''
  return {
    code,
    credits,
    invites,
    grants,
    threshold: REFERRAL_THRESHOLD,
    maxInvites: MAX_LIFETIME_INVITES,
    maxGrants: MAX_FREE_PREMIUMS,
    remainingInvites: Math.max(0, MAX_LIFETIME_INVITES - invites),
    remainingGrants: Math.max(0, MAX_FREE_PREMIUMS - grants),
    progressPct: Math.min(100, Math.round((credits / REFERRAL_THRESHOLD) * 100)),
    canEarn: invites < MAX_LIFETIME_INVITES && grants < MAX_FREE_PREMIUMS,
    nextFreeLabel:
      grants >= MAX_FREE_PREMIUMS
        ? 'Referral rewards complete'
        : `${credits} / ${REFERRAL_THRESHOLD} toward free Premium next term`,
  }
}

export function whatsappShareText(code, schoolName) {
  const name = schoolName || 'our school'
  return (
    `We're using ShuleMoja for fees, reports and parents at ${name}.\n\n` +
    `If you sign up with my code *${code}*, I move closer to a free Premium term — and you get a 1‑month trial.\n\n` +
    `${typeof window !== 'undefined' ? window.location.origin : ''}`
  )
}

export function whatsappShareUrl(code, schoolName) {
  return `https://wa.me/?text=${encodeURIComponent(whatsappShareText(code, schoolName))}`
}
