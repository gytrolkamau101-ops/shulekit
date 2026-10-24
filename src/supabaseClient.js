import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key || String(url).includes('YOUR-PROJECT') || String(key).includes('YOUR-ANON')) {
  console.error(
    'ShuleKit: missing Supabase credentials. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')
