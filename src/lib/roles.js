/** Role helpers — Deputy Principal matches Principal on most admin powers */
export const ALL_STAFF = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary', 'Teacher']
export const ADMIN = ['Principal', 'Deputy Principal', 'Senior Teacher']
export const LEADERSHIP = ['Principal', 'Deputy Principal']
export const FINANCE_ROLES = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary']
export const EXAM_ROLES = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Teacher']

export function isAdmin(role) {
  return ADMIN.includes(role)
}
export function isLeadership(role) {
  return LEADERSHIP.includes(role)
}
