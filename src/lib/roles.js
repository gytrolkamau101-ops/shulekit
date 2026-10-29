/** Role helpers — write access + extended staff desks (v38) */

export const ALL_STAFF = [
  'Principal',
  'Deputy Principal',
  'Senior Teacher',
  'Secretary',
  'Teacher',
  'Matron',
  'Driver',
  'Kitchen',
  'Watchman',
  'BOM',
  'Staff',
]
export const ADMIN = ['Principal', 'Deputy Principal', 'Senior Teacher']
export const LEADERSHIP = ['Principal', 'Deputy Principal']
export const DATA_EDITORS = ['Principal', 'Secretary']
export const FINANCE_ROLES = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Secretary']
export const FINANCE_EDITORS = ['Principal', 'Secretary']
export const EXAM_ROLES = ['Principal', 'Deputy Principal', 'Senior Teacher', 'Teacher']
export const RESOURCE_EDITORS = ['Principal', 'Secretary']
export const BOARDING_ROLES = ['Principal', 'Deputy Principal', 'Secretary', 'Matron']
export const TRANSPORT_ROLES = ['Principal', 'Deputy Principal', 'Secretary', 'Driver']
export const BOM_ROLES = ['Principal', 'Deputy Principal', 'Secretary', 'BOM']
export const DESK_ROLES = ['Kitchen', 'Watchman', 'Staff', 'Matron', 'Driver']

export function isAdmin(role) {
  return ADMIN.includes(role)
}
export function isLeadership(role) {
  return LEADERSHIP.includes(role)
}
export function canEditData(role) {
  return DATA_EDITORS.includes(role)
}
export function canEditFinance(role) {
  return FINANCE_EDITORS.includes(role)
}
export function canEditResources(role) {
  return RESOURCE_EDITORS.includes(role)
}
