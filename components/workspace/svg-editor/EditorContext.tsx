'use client'

import { createContext, useContext, useReducer, useRef, useCallback, type Dispatch, type ReactNode, type RefObject } from 'react'

// ── Tool types ──
export type ToolName = 'select' | 'pan' | 'text' | 'rect' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'image'

// ── Editor state ──
export interface EditorState {
  activeTool: ToolName
  selectedElement: SVGElement | null
  zoom: number
  pan: { x: number; y: number }
  undoStack: string[]
  redoStack: string[]
  isDrawing: boolean
  drawStart: { x: number; y: number } | null
  /** Set to true while inline text editing is active — suppresses tool hotkeys */
  isEditingText: boolean
}

// ── Actions ──
export type EditorAction =
  | { type: 'SET_TOOL'; tool: ToolName }
  | { type: 'SET_SELECTED'; element: SVGElement | null }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'SET_DRAWING'; isDrawing: boolean; start?: { x: number; y: number } | null }
  | { type: 'SET_EDITING_TEXT'; isEditingText: boolean }
  | { type: 'PUSH_UNDO'; snapshot: string }
  | { type: 'UNDO'; current: string }
  | { type: 'REDO'; current: string }
  | { type: 'CLEAR_HISTORY' }

const MAX_UNDO = 50

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, activeTool: action.tool }
    case 'SET_SELECTED':
      return { ...state, selectedElement: action.element }
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom }
    case 'SET_PAN':
      return { ...state, pan: action.pan }
    case 'SET_DRAWING':
      return {
        ...state,
        isDrawing: action.isDrawing,
        drawStart: action.start !== undefined ? action.start : state.drawStart,
      }
    case 'SET_EDITING_TEXT':
      return { ...state, isEditingText: action.isEditingText }
    case 'PUSH_UNDO':
      return {
        ...state,
        undoStack: [...state.undoStack.slice(-(MAX_UNDO - 1)), action.snapshot],
        redoStack: [],
      }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const prev = state.undoStack[state.undoStack.length - 1]
      return {
        ...state,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, action.current],
        // The caller is responsible for applying `prev` to the SVG
        _undoTarget: prev,
      } as EditorState & { _undoTarget: string }
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state
      const next = state.redoStack[state.redoStack.length - 1]
      return {
        ...state,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, action.current],
        _redoTarget: next,
      } as EditorState & { _redoTarget: string }
    }
    case 'CLEAR_HISTORY':
      return { ...state, undoStack: [], redoStack: [] }
    default:
      return state
  }
}

// ── Context value ──
export interface EditorContextValue {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  /** Refs for DOM elements — shared across all sub-components */
  containerRef: RefObject<HTMLDivElement | null>
  svgWrapRef: RefObject<HTMLDivElement | null>
  /** Get the live <svg> element from the wrapper */
  getSvgRoot: () => SVGSVGElement | null
  /** Serialize current SVG and notify parent (with undo snapshot) */
  commitChanges: () => void
  /** Render an SVG string into the wrapper div using DOMParser */
  renderSvg: (svg: string) => void
  /** Convert screen coordinates to SVG coordinate space */
  screenToSvg: (clientX: number, clientY: number) => { x: number; y: number }
  /** Fit SVG to container */
  fitView: () => void
  /** Last serialized SVG (to detect external vs internal updates) */
  lastSerializedRef: RefObject<string>
}

const EditorCtx = createContext<EditorContextValue | null>(null)

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorCtx)
  if (!ctx) throw new Error('useEditorContext must be used within EditorProvider')
  return ctx
}

// ── Initial state ──
const initialState: EditorState = {
  activeTool: 'select',
  selectedElement: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  undoStack: [],
  redoStack: [],
  isDrawing: false,
  drawStart: null,
  isEditingText: false,
}

// ── Provider ──
export function EditorProvider({
  children,
  onUpdate,
}: {
  children: ReactNode
  onUpdate: (svg: string) => void
}) {
  const [state, dispatch] = useReducer(editorReducer, initialState)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const lastSerializedRef = useRef('')

  const getSvgRoot = useCallback((): SVGSVGElement | null => {
    return svgWrapRef.current?.querySelector('svg') ?? null
  }, [])

  const renderSvg = useCallback((svg: string) => {
    if (!svgWrapRef.current) return
    svgWrapRef.current.innerHTML = ''

    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
    const parseError = svgDoc.querySelector('parsererror')
    if (parseError) {
      console.warn('[SvgEditor] SVG parse error, falling back to innerHTML')
      svgWrapRef.current.innerHTML = svg
      return
    }

    const svgEl = document.importNode(svgDoc.documentElement, true) as unknown as SVGSVGElement

    // Let SVG render at its natural size from viewBox/width/height attributes.
    // Do NOT set width/height to 100% — that stretches the SVG and breaks
    // the screenToSvg coordinate mapping.
    const vb = svgEl.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      if (parts.length === 4) {
        svgEl.setAttribute('width', String(parts[2]))
        svgEl.setAttribute('height', String(parts[3]))
      }
    }

    // Allow content outside the viewBox to be visible (infinite canvas feel)
    svgEl.setAttribute('overflow', 'visible')
    svgEl.style.overflow = 'visible'

    const XLINK_NS = 'http://www.w3.org/1999/xlink'
    svgEl.querySelectorAll('image').forEach(img => {
      const href = img.getAttribute('href') || img.getAttributeNS(XLINK_NS, 'href')
      if (href) {
        img.setAttributeNS(XLINK_NS, 'xlink:href', href)
        if (!img.getAttribute('href')) img.setAttribute('href', href)
      }
    })

    svgWrapRef.current.appendChild(svgEl)
  }, [])

  const commitChanges = useCallback(() => {
    const svgEl = getSvgRoot()
    if (!svgEl) return

    // Push undo snapshot before committing
    if (lastSerializedRef.current) {
      dispatch({ type: 'PUSH_UNDO', snapshot: lastSerializedRef.current })
    }

    const s = new XMLSerializer()
    const str = s.serializeToString(svgEl)
    lastSerializedRef.current = str
    onUpdate(str)
  }, [getSvgRoot, onUpdate])

  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    // Use the SVG's own getScreenCTM() for pixel-perfect coordinate conversion.
    // This handles viewBox, pan, zoom, and any other transforms automatically.
    const svgEl = getSvgRoot()
    if (svgEl) {
      const ctm = svgEl.getScreenCTM()
      if (ctm) {
        const inv = ctm.inverse()
        return {
          x: inv.a * clientX + inv.c * clientY + inv.e,
          y: inv.b * clientX + inv.d * clientY + inv.f,
        }
      }
    }

    // Fallback: manual calculation
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - state.pan.x) / state.zoom,
      y: (clientY - rect.top - state.pan.y) / state.zoom,
    }
  }, [state.pan, state.zoom, getSvgRoot])

  const fitView = useCallback(() => {
    if (!containerRef.current) return
    const svgEl = getSvgRoot()
    if (!svgEl) return

    const containerW = containerRef.current.clientWidth
    const containerH = containerRef.current.clientHeight
    const vb = svgEl.getAttribute('viewBox')
    let svgW = 800, svgH = 600
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      if (parts.length === 4) { svgW = parts[2]; svgH = parts[3] }
    } else {
      svgW = parseFloat(svgEl.getAttribute('width') || '800')
      svgH = parseFloat(svgEl.getAttribute('height') || '600')
    }

    const scale = Math.min((containerW - 40) / svgW, (containerH - 40) / svgH, 1.5)
    const panX = (containerW - svgW * scale) / 2
    const panY = (containerH - svgH * scale) / 2
    dispatch({ type: 'SET_ZOOM', zoom: scale })
    dispatch({ type: 'SET_PAN', pan: { x: panX, y: panY } })
  }, [getSvgRoot])

  const value: EditorContextValue = {
    state,
    dispatch,
    containerRef,
    svgWrapRef,
    getSvgRoot,
    commitChanges,
    renderSvg,
    screenToSvg,
    fitView,
    lastSerializedRef,
  }

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>
}
