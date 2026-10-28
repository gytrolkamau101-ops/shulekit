/** Lightweight offline queue — localStorage, sync when online */
const KEY = 'shulekit_offline_queue_v1'

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(q) {
  localStorage.setItem(KEY, JSON.stringify(q))
}

export function enqueue(action, payload) {
  const q = getQueue()
  q.push({ id: Date.now() + Math.random(), action, payload, createdAt: new Date().toISOString() })
  saveQueue(q)
  return q.length
}

export function queueCount() {
  return getQueue().length
}

/** Process queue with handlers: { attendance_upsert: async (payload)=>{}, fee_payment: async ... } */
export async function flushQueue(handlers = {}) {
  const q = getQueue()
  if (!q.length) return { ok: 0, fail: 0 }
  const remain = []
  let ok = 0
  let fail = 0
  for (const item of q) {
    const fn = handlers[item.action]
    if (!fn) {
      remain.push(item)
      continue
    }
    try {
      await fn(item.payload)
      ok++
    } catch (e) {
      console.warn('offline sync fail', item.action, e)
      remain.push(item)
      fail++
    }
  }
  saveQueue(remain)
  return { ok, fail, left: remain.length }
}
