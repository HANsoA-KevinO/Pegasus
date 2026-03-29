'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Moveable from 'react-moveable'
import { XmlViewer } from '../XmlViewer'
import { EditorProvider, useEditorContext, type ToolName } from './EditorContext'
import { getTool, handleMiddlePan, SELECTABLE_TAGS } from './tools'
import { EditorToolbar } from './ui/EditorToolbar'
import { PropertyPanel } from './ui/PropertyPanel'
import { InlineTextEditor } from './ui/InlineTextEditor'

export interface SvgEditorProps {
  svgContent: string
  onUpdate: (newSvgContent: string) => void
}

export function SvgEditor({ svgContent, onUpdate }: SvgEditorProps) {
  return (
    <EditorProvider onUpdate={onUpdate}>
      <SvgEditorInner svgContent={svgContent} onUpdate={onUpdate} />
    </EditorProvider>
  )
}

function SvgEditorInner({ svgContent, onUpdate }: SvgEditorProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual')
  const ctx = useEditorContext()
  const {
    state, dispatch, containerRef, svgWrapRef,
    getSvgRoot, commitChanges, renderSvg, screenToSvg, fitView, lastSerializedRef,
  } = ctx

  const moveableRef = useRef<Moveable>(null)
  const spaceHeldRef = useRef(false)
  const prevToolRef = useRef<ToolName>('select')

  // ── Initial render + re-render on external updates ──
  useEffect(() => {
    if (svgContent === lastSerializedRef.current) return
    renderSvg(svgContent)
    lastSerializedRef.current = svgContent
    dispatch({ type: 'SET_SELECTED', element: null })
    dispatch({ type: 'CLEAR_HISTORY' })
    fitView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgContent])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when editing text
      if (state.isEditingText) return
      // Ignore when focused on an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Space → temporary pan
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        spaceHeldRef.current = true
        prevToolRef.current = state.activeTool
        dispatch({ type: 'SET_TOOL', tool: 'pan' })
        return
      }

      // Escape → deselect
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_SELECTED', element: null })
        dispatch({ type: 'SET_EDITING_TEXT', isEditingText: false })
        return
      }

      // Delete / Backspace → remove selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedElement) {
        const el = state.selectedElement
        if (el.tagName.toLowerCase() !== 'svg') {
          el.remove()
          dispatch({ type: 'SET_SELECTED', element: null })
          commitChanges()
        }
        return
      }

      // Undo / Redo
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (e.shiftKey) {
          // Redo
          if (state.redoStack.length === 0) return
          const current = lastSerializedRef.current
          const next = state.redoStack[state.redoStack.length - 1]
          dispatch({ type: 'REDO', current })
          renderSvg(next)
          lastSerializedRef.current = next
        } else {
          // Undo
          if (state.undoStack.length === 0) return
          const current = lastSerializedRef.current
          const prev = state.undoStack[state.undoStack.length - 1]
          dispatch({ type: 'UNDO', current })
          renderSvg(prev)
          lastSerializedRef.current = prev
        }
        // Old DOM nodes are gone after re-render — deselect
        dispatch({ type: 'SET_SELECTED', element: null })
        return
      }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (state.redoStack.length === 0) return
        const current = lastSerializedRef.current
        const next = state.redoStack[state.redoStack.length - 1]
        dispatch({ type: 'REDO', current })
        renderSvg(next)
        lastSerializedRef.current = next
        dispatch({ type: 'SET_SELECTED', element: null })
        return
      }

      // Tool hotkeys
      const hotkeys: Record<string, ToolName> = {
        v: 'select', h: 'pan', r: 'rect', c: 'circle',
        e: 'ellipse', l: 'line', a: 'arrow', t: 'text', i: 'image',
      }
      const tool = hotkeys[e.key.toLowerCase()]
      if (tool && !e.ctrlKey && !e.metaKey) {
        dispatch({ type: 'SET_TOOL', tool })
        return
      }

      // Arrow nudge
      if (state.selectedElement) {
        const step = e.shiftKey ? 10 : 1
        let dx = 0, dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        else if (e.key === 'ArrowRight') dx = step
        else if (e.key === 'ArrowUp') dy = -step
        else if (e.key === 'ArrowDown') dy = step
        else return

        e.preventDefault()
        const existing = state.selectedElement.getAttribute('transform') || ''
        state.selectedElement.setAttribute('transform', `${existing} translate(${dx},${dy})`.trim())
        commitChanges()
        moveableRef.current?.updateRect()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && spaceHeldRef.current) {
        spaceHeldRef.current = false
        dispatch({ type: 'SET_TOOL', tool: prevToolRef.current })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [state, dispatch, commitChanges, renderSvg, lastSerializedRef, fitView])

  // ── Sync Moveable handles when zoom/pan changes ──
  useEffect(() => {
    try {
      moveableRef.current?.updateRect()
    } catch {
      // Moveable may access unmounted DOM — safe to ignore
    }
  }, [state.zoom, state.pan])

  // ── Wheel zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const prevZoom = state.zoom
    const nextZoom = Math.max(0.1, Math.min(5, prevZoom * factor))

    dispatch({ type: 'SET_ZOOM', zoom: nextZoom })
    dispatch({
      type: 'SET_PAN',
      pan: {
        x: mouseX - (mouseX - state.pan.x) * (nextZoom / prevZoom),
        y: mouseY - (mouseY - state.pan.y) * (nextZoom / prevZoom),
      },
    })
  }, [containerRef, state.zoom, state.pan, dispatch])

  // ── Tool event delegation ──
  const activeTool = getTool(state.activeTool)
  const toolCtx = {
    svgRoot: getSvgRoot()!,
    zoom: state.zoom,
    pan: state.pan,
    selectedElement: state.selectedElement,
    screenToSvg,
    commitChanges,
    setSelectedElement: (el: SVGElement | null) => dispatch({ type: 'SET_SELECTED', element: el }),
    dispatch,
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Middle-click/alt-drag pan works in all tool modes
    if (handleMiddlePan('down', e, toolCtx)) return
    if (getSvgRoot() && activeTool.onPointerDown) {
      activeTool.onPointerDown(e, toolCtx)
    }
  }, [activeTool, toolCtx, getSvgRoot])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (handleMiddlePan('move', e, toolCtx)) return
    if (getSvgRoot() && activeTool.onPointerMove) {
      activeTool.onPointerMove(e, toolCtx)
    }
  }, [activeTool, toolCtx, getSvgRoot])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (handleMiddlePan('up', e, toolCtx)) return
    if (getSvgRoot() && activeTool.onPointerUp) {
      activeTool.onPointerUp(e, toolCtx)
    }
  }, [activeTool, toolCtx, getSvgRoot])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (state.isDrawing) return
    if (getSvgRoot() && activeTool.onClick) {
      activeTool.onClick(e, toolCtx)
    }
  }, [activeTool, toolCtx, state.isDrawing, getSvgRoot])

  // ── Double-click: select element (+ inline text edit for <text>) ──
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as Element
    let el: Element | null = target
    let foundText = false
    let foundSelectable: SVGElement | null = null

    while (el && el !== svgWrapRef.current) {
      const tag = el.tagName.toLowerCase()
      if (tag === 'text' && !foundText) {
        foundText = true
        foundSelectable = el as SVGElement
      } else if (!foundSelectable && SELECTABLE_TAGS.has(tag)) {
        foundSelectable = el as SVGElement
      }
      el = el.parentElement
    }

    if (foundSelectable) {
      dispatch({ type: 'SET_SELECTED', element: foundSelectable })
      if (foundText) {
        dispatch({ type: 'SET_EDITING_TEXT', isEditingText: true })
      }
    }
  }, [dispatch, svgWrapRef])

  // ── Moveable callbacks ──
  const handleDrag = useCallback((e: { target: HTMLElement | SVGElement; transform: string }) => {
    e.target.style.transform = e.transform
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!state.selectedElement) return
    const el = state.selectedElement
    const transform = el.style.transform
    if (transform) {
      const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/)
      if (match) {
        // Moveable with zoom={state.zoom} gives values in SVG coordinate space
        const dx = parseFloat(match[1])
        const dy = parseFloat(match[2])
        const existing = el.getAttribute('transform') || ''
        el.setAttribute('transform', `${existing} translate(${dx},${dy})`.trim())
      }
      el.style.transform = ''
    }
    commitChanges()
    moveableRef.current?.updateRect()
  }, [state.selectedElement, commitChanges])

  const handleResize = useCallback((e: {
    target: HTMLElement | SVGElement
    width: number; height: number
    delta: number[]
    direction: number[]
    drag: { transform: string }
  }) => {
    const el = e.target as SVGElement
    e.target.style.transform = e.drag.transform
    const tag = el.tagName.toLowerCase()
    // Moveable with zoom={state.zoom} already converts to SVG coordinate space
    if (tag === 'rect' || tag === 'image' || tag === 'foreignObject') {
      el.setAttribute('width', String(Math.max(1, e.width)))
      el.setAttribute('height', String(Math.max(1, e.height)))
    } else if (tag === 'circle') {
      el.setAttribute('r', String(Math.max(1, Math.min(e.width, e.height) / 2)))
    } else if (tag === 'ellipse') {
      el.setAttribute('rx', String(Math.max(1, e.width / 2)))
      el.setAttribute('ry', String(Math.max(1, e.height / 2)))
    }
  }, [])

  const handleResizeEnd = useCallback(() => {
    if (!state.selectedElement) return
    const el = state.selectedElement
    const transform = el.style.transform
    if (transform) {
      const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/)
      if (match) {
        const dx = parseFloat(match[1])
        const dy = parseFloat(match[2])
        const existing = el.getAttribute('transform') || ''
        el.setAttribute('transform', `${existing} translate(${dx},${dy})`.trim())
      }
      el.style.transform = ''
    }
    commitChanges()
    moveableRef.current?.updateRect()
  }, [state.selectedElement, commitChanges])

  // ── Download SVG ──
  const handleDownload = useCallback(() => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [svgContent])

  // ── Download PNG ──
  const handleDownloadPng = useCallback(() => {
    const svgEl = getSvgRoot()
    if (!svgEl) return

    // Serialize the current SVG
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgEl)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    // Get SVG natural dimensions
    const vb = svgEl.getAttribute('viewBox')
    let w = parseFloat(svgEl.getAttribute('width') || '800')
    let h = parseFloat(svgEl.getAttribute('height') || '600')
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      if (parts.length === 4) { w = parts[2]; h = parts[3] }
    }

    // Scale up for higher quality (2x)
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return

    const img = new Image()
    img.onload = () => {
      ctx2d.drawImage(img, 0, 0, w * scale, h * scale)
      URL.revokeObjectURL(svgUrl)
      canvas.toBlob((blob) => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = 'diagram.png'
        a.click()
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      console.error('[SvgEditor] Failed to render SVG to PNG')
    }
    img.src = svgUrl
  }, [getSvgRoot])

  // ── Code view ──
  if (viewMode === 'code') {
    return (
      <div className="flex flex-col h-full">
        <EditorToolbar viewMode="code" onToggleView={() => setViewMode('visual')}
          onResetView={fitView} onDownload={handleDownload} onDownloadPng={handleDownloadPng} />
        <div className="flex-1 min-h-0">
          <XmlViewer xml={svgContent} fileName="diagram.svg" />
        </div>
      </div>
    )
  }

  // ── Visual editor ──
  return (
    <div className="flex flex-col h-full">
      <EditorToolbar viewMode="visual" onToggleView={() => setViewMode('code')}
        onResetView={fitView} onDownload={handleDownload} onDownloadPng={handleDownloadPng} />

      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 overflow-hidden bg-stone-100/50 relative"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            touchAction: 'none',
            cursor: state.activeTool === 'select' ? 'grab' : activeTool.cursor,
          }}
        >
          {/* Checkerboard background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `
              linear-gradient(45deg, #f5f5f4 25%, transparent 25%),
              linear-gradient(-45deg, #f5f5f4 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #f5f5f4 75%),
              linear-gradient(-45deg, transparent 75%, #f5f5f4 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }} />

          {/* SVG content layer */}
          <div
            ref={svgWrapRef}
            className="absolute origin-top-left"
            style={{
              transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`,
            }}
          />

          {/* Inline text editor overlay */}
          <InlineTextEditor />

          {/* Moveable handles for selected element (only in select tool) */}
          {state.selectedElement && state.activeTool === 'select' && (
            <Moveable
              ref={moveableRef}
              target={state.selectedElement}
              container={containerRef.current}
              draggable
              resizable
              rotatable
              snappable
              origin={false}
              throttleDrag={0}
              throttleResize={0}
              throttleRotate={0}
              keepRatio={false}
              renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
              edge={false}
              zoom={state.zoom}
              padding={{ left: 0, top: 0, right: 0, bottom: 0 }}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              onRotate={({ target, transform }) => {
                target.style.transform = transform
              }}
              onRotateEnd={() => {
                if (!state.selectedElement) return
                const el = state.selectedElement
                const transform = el.style.transform
                if (transform) {
                  const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/)
                  if (rotateMatch) {
                    const deg = parseFloat(rotateMatch[1])
                    const bbox = el.getBoundingClientRect()
                    const cx = bbox.width / (2 * state.zoom)
                    const cy = bbox.height / (2 * state.zoom)
                    const existing = el.getAttribute('transform') || ''
                    el.setAttribute(
                      'transform',
                      `${existing} rotate(${deg},${cx},${cy})`.trim()
                    )
                  }
                  el.style.transform = ''
                }
                commitChanges()
                moveableRef.current?.updateRect()
              }}
            />
          )}
        </div>

        {/* Property panel — right side */}
        {state.activeTool === 'select' && <PropertyPanel />}
      </div>
    </div>
  )
}
