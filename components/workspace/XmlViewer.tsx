'use client'

import { useState, useCallback } from 'react'

interface XmlViewerProps {
  xml: string
  fileName?: string
}

export function XmlViewer({ xml, fileName = 'diagram.xml' }: XmlViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(xml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [xml])

  const handleDownload = useCallback(() => {
    const blob = new Blob([xml], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [xml, fileName])

  const lines = xml.split('\n')

  return (
    <div className="flex flex-col h-full">
      {/* Code area */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <pre className="text-[12px] leading-5 font-mono text-stone-700">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="flex hover:bg-stone-100/60 -mx-4 px-4 transition-colors duration-75">
                  <span className="select-none w-10 flex-shrink-0 text-right pr-4 text-stone-300 text-[11px]">
                    {i + 1}
                  </span>
                  <span className="flex-1 whitespace-pre overflow-x-auto">{line || ' '}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 border-t border-stone-200/60 px-4 py-2.5 flex items-center gap-2 bg-stone-50/50">
        <span className="text-[11px] text-stone-400 mr-auto font-mono">{lines.length} lines</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                   text-stone-600 bg-white border border-stone-200 rounded-md
                   hover:bg-stone-50 hover:border-stone-300 transition-colors duration-150"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制
            </>
          )}
        </button>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                   text-stone-600 bg-white border border-stone-200 rounded-md
                   hover:bg-stone-50 hover:border-stone-300 transition-colors duration-150"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载 XML
        </button>
      </div>
    </div>
  )
}
