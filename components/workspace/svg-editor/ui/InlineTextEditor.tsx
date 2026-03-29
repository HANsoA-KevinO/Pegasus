'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorContext } from '../EditorContext'

export function InlineTextEditor() {
  const { state, dispatch, commitChanges, containerRef } = useEditorContext()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')

  const el = state.selectedElement
  const isText = el && el.tagName.toLowerCase() === 'text'
  const isActive = state.isEditingText && isText

  // Recalculate position whenever zoom/pan changes or editor opens
  const position = (() => {
    if (!isActive || !el || !containerRef.current) {
      return { top: 0, left: 0, width: 100, height: 30 }
    }
    const bbox = el.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const pad = 6
    return {
      top: bbox.top - containerRect.top - pad,
      left: bbox.left - containerRect.left - pad,
      width: Math.max(bbox.width + pad * 4, 120),
      height: Math.max(bbox.height + pad * 2, 32),
    }
  })()

  // Initialize value and focus when editor opens
  useEffect(() => {
    if (!isActive || !el) return
    setValue(el.textContent || '')
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }, 0)
  }, [isActive, el])

  const handleConfirm = useCallback(() => {
    if (!el) return
    el.textContent = value
    commitChanges()
    dispatch({ type: 'SET_EDITING_TEXT', isEditingText: false })
  }, [el, value, commitChanges, dispatch])

  const handleCancel = useCallback(() => {
    dispatch({ type: 'SET_EDITING_TEXT', isEditingText: false })
  }, [dispatch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
    // Stop propagation so keyboard shortcuts don't fire
    e.stopPropagation()
  }, [handleConfirm, handleCancel])

  if (!isActive) return null

  // Get font styles from the SVG text element — fontSize from getBoundingClientRect
  // already accounts for zoom, so use the visual size directly
  const svgFontSize = parseFloat(el?.getAttribute('font-size') || '16')
  const fontFamily = el?.getAttribute('font-family') || 'Arial, sans-serif'
  const fontWeight = el?.getAttribute('font-weight') || 'normal'
  const fill = el?.getAttribute('fill') || '#333333'

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleConfirm}
      className="absolute z-50 resize-none border-2 border-blue-400 rounded px-1 py-0.5
                 outline-none bg-white/95 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        minWidth: position.width,
        minHeight: position.height,
        fontSize: `${svgFontSize * state.zoom}px`,
        fontFamily,
        fontWeight,
        color: fill === 'none' ? '#333' : fill,
        lineHeight: 1.2,
      }}
    />
  )
}
