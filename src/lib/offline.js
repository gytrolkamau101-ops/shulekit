/** Offline queue — localStorage, retry with backoff metadata, sync when online */

const KEY = 'shulemoja_offline_queue_v2'
const LEGACY = 'shulekit_offline_queue_v1'
const MAX_ITEMS = 200
const MAX_ATTEMPTS = 8

function migrate() {
  try {
    const cur = localStorage.getItem(KEY)
    if (cur) return
    const old = localStorage.getItem(LEGACY)
    if (old) {
      localStorage.setItem(KEY, old)
      localStorage.removeItem(LEGACY)
    }
  } catch (_) {}
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getQueue() {
  migrate()
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(q) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX_ITEMS)))
  } catch (_) {}
}

export function enqueue(action, payload) {
  const q = getQueue()
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    action,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  })
  saveQueue(q)
  return q.length
}

export function queueCount() {
  return getQueue().length
}

export function clearQueue() {
  saveQueue([])
}

/**
 * handlers: { attendance_upsert: async (payload)=>{}, fee_payment: async ... }
 * Returns { ok, fail, left, flushed }
 */
export async function flushQueue(handlers = {}) {
  const q = getQueue()
  if (!q.length) return { ok: 0, fail: 0, left: 0, flushed: 0 }
  if (!isOnline()) return { ok: 0, fail: 0, left: q.length, flushed: 0 }

  const remain = []
  let ok = 0
  let fail = 0

  for (const item of q) {
    const fn = typeof handlers === 'function' ? handlers : handlers[item.action]
    // Support legacy Dashboard: flushQueue(supabase) where handlers is client — skip unknown
    if (typeof fn !== 'function') {
      // If handlers looks like supabase client, keep items for later
      remain.push(item)
      continue
    }
    try {
      await fn(item.payload)
      ok++
    } catch (e) {
      const attempts = (item.attempts || 0) + 1
      if (attempts < MAX_ATTEMPTS) {
        remain.push({ ...item, attempts, lastError: String(e?.message || e) })
      }
      fail++
      console.warn('offline sync fail', item.action, e)
    }
  }
  saveQueue(remain)
  return { ok, fail, left: remain.length, flushed: ok }
}
