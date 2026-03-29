'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { GalleryImage } from '@/hooks/useWorkspaceArtifacts'
import { ImageLightbox } from './ImageLightbox'

interface ImageGalleryProps {
  images: GalleryImage[]
}

function downloadImage(base64: string, mimeType: string, filename: string) {
  const byteChars = atob(base64)
  const byteArray = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i)
  }
  const blob = new Blob([byteArray], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)
  const thumbnailRef = useRef<HTMLDivElement>(null)

  // Keep selection valid when images change
  useEffect(() => {
    if (selectedIndex >= images.length) {
      setSelectedIndex(Math.max(0, images.length - 1))
    }
  }, [images.length, selectedIndex])

  const current = images[selectedIndex]

  const handleDownload = useCallback(() => {
    if (!current) return
    const filename = current.path.split('/').pop() ?? 'image.png'
    downloadImage(current.content, current.mimeType, filename)
  }, [current])

  if (!current) return null

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Main display area */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div
            className="relative group cursor-zoom-in max-w-full max-h-full"
            onClick={() => setShowLightbox(true)}
          >
            <img
              src={`data:${current.mimeType};base64,${current.content}`}
              alt={current.label}
              className="max-w-full max-h-[calc(100vh-280px)] object-contain rounded-lg
                         shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-stone-200/60
                         transition-shadow duration-200 group-hover:shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
            />
            <div className="absolute inset-0 rounded-lg bg-stone-900/0 group-hover:bg-stone-900/5
                          flex items-center justify-center transition-all duration-200">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200
                            bg-white/90 backdrop-blur-sm text-stone-600 text-xs font-medium
                            px-3 py-1.5 rounded-full shadow-sm">
                <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                点击放大
              </span>
            </div>
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className="flex-shrink-0 border-t border-stone-200/60 bg-stone-50/30">
          <div
            ref={thumbnailRef}
            className="flex items-center gap-1.5 px-3 py-2.5 overflow-x-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {images.map((img, i) => (
              <button
                key={img.path}
                onClick={() => setSelectedIndex(i)}
                className={`flex-shrink-0 relative rounded-md overflow-hidden transition-all duration-150
                  ${i === selectedIndex
                    ? 'ring-2 ring-blue-500 ring-offset-1'
                    : 'ring-1 ring-stone-200 hover:ring-stone-300 opacity-70 hover:opacity-100'
                  }`}
                title={img.label}
              >
                <img
                  src={`data:${img.mimeType};base64,${img.content}`}
                  alt={img.label}
                  className="w-16 h-16 object-cover"
                />
                {/* Label overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
                  <span className="text-[9px] text-white font-medium leading-none truncate block">
                    {img.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex-shrink-0 border-t border-stone-200/60 px-4 py-2 flex items-center gap-2 bg-stone-50/50">
          <span className="text-xs text-stone-400">
            {selectedIndex + 1} / {images.length}
          </span>
          <span className="text-xs text-stone-500 font-medium">
            {current.label}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
                       text-stone-600 bg-white border border-stone-200 rounded-md
                       hover:bg-stone-50 hover:border-stone-300 transition-colors duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载
            </button>
            <button
              onClick={() => setShowLightbox(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
                       text-stone-600 bg-white border border-stone-200 rounded-md
                       hover:bg-stone-50 hover:border-stone-300 transition-colors duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              全屏
            </button>
          </div>
        </div>
      </div>

      {showLightbox && (
        <ImageLightbox
          base64={current.content}
          mimeType={current.mimeType}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  )
}
