import { supabase } from '../supabaseClient'

export async function getSetting(key) {
  const { data } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle()
  return data?.value || null
}

export async function getSettings(keys) {
  const { data } = await supabase.from('platform_settings').select('key, value').in('key', keys)
  const map = {}
  ;(data || []).forEach((r) => {
    map[r.key] = r.value
  })
  return map
}

export async function saveSetting(key, value) {
  const { error } = await supabase.from('platform_settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
