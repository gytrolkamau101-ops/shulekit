/** Read image from gallery/camera; resize to JPEG data URL (works offline, no Storage required). */
export function pickImageToDataUrl(file, { maxW = 640, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Choose an image file'))
      return
    }
    // Cap ~4MB raw before resize
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Image is too large (max 12MB)'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / (img.width || maxW))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Invalid image'))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/** Read any file as data URL (small docs/screenshots). Prefer images via pickImageToDataUrl. */
export function pickFileToDataUrl(file, { maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'))
      return
    }
    if (file.size > maxBytes) {
      reject(new Error('File too large for in-app attach (max 2MB). Use a link or compress.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}


/** Shrink a data-URL image for platform_settings storage (max ~180KB target). */
export async function compressDataUrl(dataUrl, { maxW = 480, quality = 0.62 } = {}) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image')) return dataUrl
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / (img.width || maxW))
      const w = Math.max(1, Math.round((img.width || maxW) * scale))
      const h = Math.max(1, Math.round((img.height || maxW) * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      let q = quality
      let out = canvas.toDataURL('image/jpeg', q)
      while (out.length > 180000 && q > 0.35) {
        q -= 0.08
        out = canvas.toDataURL('image/jpeg', q)
      }
      resolve(out)
    }
    img.onerror = () => reject(new Error('Could not compress image'))
    img.src = dataUrl
  })
}
