'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditorContext } from '../EditorContext'

interface PropertyGroup {
  label: string
  fields: PropertyField[]
}

interface PropertyField {
  key: string
  label: string
  type: 'number' | 'color' | 'text' | 'select'
  options?: string[]
  step?: number
}

function getPropertyGroups(el: SVGElement): PropertyGroup[] {
  const tag = el.tagName.toLowerCase()
  const groups: PropertyGroup[] = []

  // Position & Size
  if (tag === 'rect' || tag === 'image') {
    groups.push({
      label: '位置 & 大小',
      fields: [
        { key: 'x', label: 'X', type: 'number', step: 1 },
        { key: 'y', label: 'Y', type: 'number', step: 1 },
        { key: 'width', label: '宽', type: 'number', step: 1 },
        { key: 'height', label: '高', type: 'number', step: 1 },
      ],
    })
  } else if (tag === 'circle') {
    groups.push({
      label: '位置 & 大小',
      fields: [
        { key: 'cx', label: 'CX', type: 'number', step: 1 },
        { key: 'cy', label: 'CY', type: 'number', step: 1 },
        { key: 'r', label: '半径', type: 'number', step: 1 },
      ],
    })
  } else if (tag === 'ellipse') {
    groups.push({
      label: '位置 & 大小',
      fields: [
        { key: 'cx', label: 'CX', type: 'number', step: 1 },
        { key: 'cy', label: 'CY', type: 'number', step: 1 },
        { key: 'rx', label: 'RX', type: 'number', step: 1 },
        { key: 'ry', label: 'RY', type: 'number', step: 1 },
      ],
    })
  } else if (tag === 'line') {
    groups.push({
      label: '坐标',
      fields: [
        { key: 'x1', label: 'X1', type: 'number', step: 1 },
        { key: 'y1', label: 'Y1', type: 'number', step: 1 },
        { key: 'x2', label: 'X2', type: 'number', step: 1 },
        { key: 'y2', label: 'Y2', type: 'number', step: 1 },
      ],
    })
  } else if (tag === 'text') {
    groups.push({
      label: '位置',
      fields: [
        { key: 'x', label: 'X', type: 'number', step: 1 },
        { key: 'y', label: 'Y', type: 'number', step: 1 },
      ],
    })
  }

  // Fill & Stroke (for shapes, not images)
  if (['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline'].includes(tag)) {
    groups.push({
      label: '填充 & 描边',
      fields: [
        { key: 'fill', label: '填充', type: 'color' },
        { key: 'fill-opacity', label: '填充透明', type: 'number', step: 0.1 },
        { key: 'stroke', label: '描边', type: 'color' },
        { key: 'stroke-width', label: '描边宽', type: 'number', step: 0.5 },
        { key: 'stroke-dasharray', label: '线型', type: 'select', options: ['', '4', '4 2', '1 3'] },
      ],
    })
  }

  // Line stroke
  if (tag === 'line') {
    groups.push({
      label: '描边',
      fields: [
        { key: 'stroke', label: '颜色', type: 'color' },
        { key: 'stroke-width', label: '宽度', type: 'number', step: 0.5 },
        { key: 'stroke-dasharray', label: '线型', type: 'select', options: ['', '4', '4 2', '1 3'] },
      ],
    })
  }

  // Text properties
  if (tag === 'text') {
    groups.push({
      label: '文本样式',
      fields: [
        { key: 'font-family', label: '字体', type: 'select', options: ['Arial, sans-serif', 'Times New Roman, serif', 'Courier New, monospace', 'Georgia, serif', 'Verdana, sans-serif'] },
        { key: 'font-size', label: '字号', type: 'number', step: 1 },
        { key: 'font-weight', label: '粗细', type: 'select', options: ['normal', 'bold', '300', '500', '700'] },
        { key: 'fill', label: '颜色', type: 'color' },
        { key: 'text-anchor', label: '对齐', type: 'select', options: ['start', 'middle', 'end'] },
      ],
    })
  }

  // Opacity (all elements)
  groups.push({
    label: '通用',
    fields: [
      { key: 'opacity', label: '透明度', type: 'number', step: 0.1 },
    ],
  })

  return groups
}

function getAttrValue(el: SVGElement, key: string): string {
  // Check inline style first, then attribute
  const style = el.style.getPropertyValue(key)
  if (style) return style
  return el.getAttribute(key) ?? ''
}

function normalizeColor(val: string): string {
  if (!val || val === 'none' || val === 'transparent') return '#000000'
  // If it's already hex, return as-is
  if (val.startsWith('#')) {
    if (val.length === 4) {
      // Expand #rgb to #rrggbb
      return '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3]
    }
    return val
  }
  // Try to parse rgb(r,g,b)
  const match = val.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    const hex = (n: string) => parseInt(n).toString(16).padStart(2, '0')
    return '#' + hex(match[1]) + hex(match[2]) + hex(match[3])
  }
  return '#000000'
}

export function PropertyPanel() {
  const { state, commitChanges } = useEditorContext()
  const el = state.selectedElement
  const [, forceUpdate] = useState(0)

  // Re-render when selected element changes
  useEffect(() => {
    forceUpdate(n => n + 1)
  }, [el])

  const handleChange = useCallback((key: string, value: string) => {
    if (!el) return
    el.setAttribute(key, value)
    commitChanges()
    forceUpdate(n => n + 1)
  }, [el, commitChanges])

  if (!el) {
    return (
      <div className="w-56 border-l border-stone-200/60 bg-stone-50/30 flex items-center justify-center">
        <p className="text-xs text-stone-400 text-center px-4">
          选择元素查看属性
        </p>
      </div>
    )
  }

  const groups = getPropertyGroups(el)
  const tag = el.tagName.toLowerCase()

  return (
    <div className="w-56 border-l border-stone-200/60 bg-white overflow-y-auto">
      {/* Element type header */}
      <div className="px-3 py-2 border-b border-stone-200/60 bg-stone-50/50">
        <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
          {tag === 'image' ? '图片' : tag === 'text' ? '文本' : tag === 'rect' ? '矩形' : tag === 'circle' ? '圆形' : tag === 'ellipse' ? '椭圆' : tag === 'line' ? '线条' : tag}
        </span>
      </div>

      {groups.map(group => (
        <div key={group.label} className="border-b border-stone-100">
          <div className="px-3 py-1.5 bg-stone-50/30">
            <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">{group.label}</span>
          </div>
          <div className="px-3 py-2 space-y-2">
            {group.fields.map(field => (
              <FieldRow
                key={field.key}
                field={field}
                value={getAttrValue(el, field.key)}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Delete button */}
      <div className="px-3 py-3">
        <button
          onClick={() => {
            if (!el || el.tagName.toLowerCase() === 'svg') return
            el.remove()
            commitChanges()
          }}
          className="w-full py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200
                     rounded-md hover:bg-red-100 transition-colors duration-150"
        >
          删除元素
        </button>
      </div>
    </div>
  )
}

function FieldRow({ field, value, onChange }: {
  field: PropertyField
  value: string
  onChange: (key: string, value: string) => void
}) {
  if (field.type === 'color') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-stone-500 w-12 flex-shrink-0">{field.label}</label>
        <div className="flex items-center gap-1 flex-1">
          <input
            type="color"
            value={normalizeColor(value)}
            onChange={e => onChange(field.key, e.target.value)}
            className="w-6 h-6 rounded border border-stone-200 cursor-pointer"
          />
          <input
            type="text"
            value={value || 'none'}
            onChange={e => onChange(field.key, e.target.value)}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] font-mono border border-stone-200 rounded
                       focus:outline-none focus:border-stone-400"
          />
        </div>
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-stone-500 w-12 flex-shrink-0">{field.label}</label>
        <select
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] border border-stone-200 rounded
                     focus:outline-none focus:border-stone-400 bg-white"
        >
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt || '实线'}</option>
          ))}
        </select>
      </div>
    )
  }

  // number or text
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-stone-500 w-12 flex-shrink-0">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        step={field.step}
        onChange={e => onChange(field.key, e.target.value)}
        className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] font-mono border border-stone-200 rounded
                   focus:outline-none focus:border-stone-400"
      />
    </div>
  )
}
