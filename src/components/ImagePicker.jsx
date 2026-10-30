import { useRef, useState } from 'react'
import { pickImageToDataUrl } from '../lib/media'

/**
 * Gallery + camera image picker. Stores a compressed data URL via onChange.
 * dark: Super Admin dark fields
 */
export default function ImagePicker({
  value,
  onChange,
  label = 'Photo',
  maxW = 800,
  quality = 0.75,
  dark = false,
  showUrlField = true,
  previewClass = 'h-20 max-w-full object-contain rounded-lg border',
}) {
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const btnCls = dark
    ? 'inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
  const inputCls = dark
    ? 'w-full mt-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 text-sm'
    : 'w-full mt-2 rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm'

  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const url = await pickImageToDataUrl(file, { maxW, quality })
      onChange?.(url)
    } catch (e) {
      setErr(e.message || 'Could not use image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</p>
      )}
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <img src={value} alt="" className={previewClass} />
          <button
            type="button"
            className="text-xs font-bold text-red-500 underline"
            onClick={() => onChange?.('')}
          >
            Remove custom image
          </button>
        </div>
      ) : (
        <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>No image selected</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={btnCls} onClick={() => galleryRef.current?.click()}>
          {busy ? '…' : '🖼 Gallery'}
        </button>
        <button type="button" disabled={busy} className={btnCls} onClick={() => cameraRef.current?.click()}>
          {busy ? '…' : '📷 Camera'}
        </button>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            handle(f)
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            handle(f)
          }}
        />
      </div>
      {showUrlField && (
        <input
          className={inputCls}
          placeholder="Or paste image URL (optional)"
          value={value && String(value).startsWith('data:') ? '' : value || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
      {err && <p className="text-xs text-red-500 font-medium">{err}</p>}
    </div>
  )
}
