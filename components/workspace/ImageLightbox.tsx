'use client'

import { useEffect, useCallback } from 'react'

interface ImageLightboxProps {
  base64: string
  mimeType: string
  onClose: () => void
}

export function ImageLightbox({ base64, mimeType, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  function handleDownload() {
    const byteChars = atob(base64)
    const byteArray = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i)
    }
    const blob = new Blob([byteArray], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diagram-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <img
          src={`data:${mimeType};base64,${base64}`}
          alt="Generated scientific diagram"
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium
                     text-white bg-white/15 border border-white/20 rounded-lg
                     hover:bg-white/25 transition-colors duration-150 backdrop-blur-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium
                     text-white bg-white/15 border border-white/20 rounded-lg
                     hover:bg-white/25 transition-colors duration-150 backdrop-blur-sm"
          >
            关闭
            <kbd className="ml-1 text-[10px] text-white/50 bg-white/10 px-1 py-0.5 rounded">Esc</kbd>
          </button>
        </div>
      </div>

      {/* Close button (top-right) */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 w-10 h-10 flex items-center justify-center
                 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-150"
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
