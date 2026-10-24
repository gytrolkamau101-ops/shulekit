import { supabase } from '../supabaseClient'

export async function logAudit(action, entity = null, entityId = null, detail = {}) {
  try {
    await supabase.rpc('log_audit', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId != null ? String(entityId) : null,
      p_detail: detail,
    })
  } catch (e) {
    console.warn('audit log failed', e)
  }
}
