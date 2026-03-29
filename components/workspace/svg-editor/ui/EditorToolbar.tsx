'use client'

import { useEditorContext, type ToolName } from '../EditorContext'
import { ToolButton } from './ToolButton'

// ── SVG icons for tools (Heroicons-style, 16x16) ──

function PointerIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.293 3.293a1 1 0 011.414 0L12 10.586V4a1 1 0 112 0v10a1 1 0 01-1.707.707L9 11.414l-5.293 5.293a1 1 0 01-1.414-1.414L7.586 10 3.293 5.707a1 1 0 010-1.414z"/>
    </svg>
  )
}

function HandIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075-5.925v2.25a1.575 1.575 0 013.15 0V8.25m-3.15-2.175a1.575 1.575 0 013.15 0v4.65m0 0a3.15 3.15 0 01-3.15 3.15H9.525a3.15 3.15 0 01-2.228-.922L4.15 9.806a1.575 1.575 0 012.228-2.228l1.672 1.672" />
    </svg>
  )
}

function RectIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function LineIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <line x1="5" y1="19" x2="19" y2="5" strokeLinecap="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <line x1="5" y1="19" x2="17" y2="7" strokeLinecap="round" />
      <polyline points="10,7 17,7 17,14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5h14v3h-2V7H13v10h2v2H9v-2h2V7H7v1H5V5z"/>
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
  )
}

// ── Tool definitions ──

const TOOLS: Array<{ name: ToolName; icon: React.ReactNode; label: string; hotkey: string }> = [
  { name: 'select', icon: <PointerIcon />, label: '选择', hotkey: 'V' },
  { name: 'pan', icon: <HandIcon />, label: '平移', hotkey: 'H' },
  { name: 'rect', icon: <RectIcon />, label: '矩形', hotkey: 'R' },
  { name: 'circle', icon: <CircleIcon />, label: '圆形', hotkey: 'C' },
  { name: 'line', icon: <LineIcon />, label: '直线', hotkey: 'L' },
  { name: 'arrow', icon: <ArrowIcon />, label: '箭头', hotkey: 'A' },
  { name: 'text', icon: <TextIcon />, label: '文本', hotkey: 'T' },
  { name: 'image', icon: <ImageIcon />, label: '图片', hotkey: 'I' },
]

interface EditorToolbarProps {
  viewMode: 'visual' | 'code'
  onToggleView: () => void
  onResetView: () => void
  onDownload: () => void
  onDownloadPng?: () => void
}

export function EditorToolbar({ viewMode, onToggleView, onResetView, onDownload, onDownloadPng }: EditorToolbarProps) {
  const { state, dispatch, commitChanges, renderSvg, lastSerializedRef } = useEditorContext()

  const handleUndo = () => {
    if (state.undoStack.length === 0) return
    const current = lastSerializedRef.current
    const prev = state.undoStack[state.undoStack.length - 1]
    dispatch({ type: 'UNDO', current })
    renderSvg(prev)
    lastSerializedRef.current = prev
    dispatch({ type: 'SET_SELECTED', element: null })
  }

  const handleRedo = () => {
    if (state.redoStack.length === 0) return
    const current = lastSerializedRef.current
    const next = state.redoStack[state.redoStack.length - 1]
    dispatch({ type: 'REDO', current })
    renderSvg(next)
    lastSerializedRef.current = next
    dispatch({ type: 'SET_SELECTED', element: null })
  }

  const btnClass = `inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
    text-stone-600 bg-white border border-stone-200 rounded-md
    hover:bg-stone-50 hover:border-stone-300 transition-colors duration-150`

  return (
    <div className="flex-shrink-0 border-b border-stone-200/60 px-2 py-1.5 flex items-center gap-1 bg-stone-50/50">
      {/* Tool palette */}
      {viewMode === 'visual' && (
        <>
          <div className="flex items-center gap-0.5 mr-1 pr-2 border-r border-stone-200/60">
            {TOOLS.map(t => (
              <ToolButton
                key={t.name}
                active={state.activeTool === t.name}
                title={`${t.label} (${t.hotkey})`}
                onClick={() => dispatch({ type: 'SET_TOOL', tool: t.name })}
              >
                {t.icon}
              </ToolButton>
            ))}
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 mr-1 pr-2 border-r border-stone-200/60">
            <ToolButton
              title="撤销 (Ctrl+Z)"
              disabled={state.undoStack.length === 0}
              onClick={handleUndo}
            >
              <UndoIcon />
            </ToolButton>
            <ToolButton
              title="重做 (Ctrl+Shift+Z)"
              disabled={state.redoStack.length === 0}
              onClick={handleRedo}
            >
              <RedoIcon />
            </ToolButton>
          </div>
        </>
      )}

      {/* View toggle */}
      <button onClick={onToggleView} className={btnClass}>
        {viewMode === 'visual' ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            代码
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            编辑
          </>
        )}
      </button>

      {viewMode === 'visual' && (
        <button onClick={onResetView} className={btnClass}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          </svg>
          适配
        </button>
      )}

      <span className="text-[11px] text-stone-400 ml-auto">
        {Math.round(state.zoom * 100)}%
      </span>

      <button onClick={onDownload} className={btnClass} title="下载 SVG">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        SVG
      </button>

      {onDownloadPng && (
        <button onClick={onDownloadPng} className={btnClass} title="下载 PNG">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PNG
        </button>
      )}
    </div>
  )
}
