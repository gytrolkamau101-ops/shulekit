import { planEntitlements } from './plans'
import { supabase } from '../supabaseClient'

export function capsFor(school) {
  const e = planEntitlements(school)
  return {
    students: school?.student_cap || e.defaultCap || 200,
    staff: school?.staff_cap || e.staffCap || 25,
    parents: school?.parent_cap || e.parentCap || 150,
  }
}

export async function countStudents(schoolId) {
  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .neq('status', 'Transferred')
  return count || 0
}

export async function assertStudentCap(school) {
  const caps = capsFor(school)
  const n = await countStudents(school.id)
  if (n >= caps.students) {
    throw new Error(
      `Student limit reached (${caps.students}). Upgrade plan or raise cap with Super Admin.`
    )
  }
}
