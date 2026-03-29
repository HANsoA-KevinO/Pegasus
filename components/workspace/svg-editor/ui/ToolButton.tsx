'use client'

import type { ReactNode } from 'react'

interface ToolButtonProps {
  active?: boolean
  disabled?: boolean
  title: string
  onClick: () => void
  children: ReactNode
}

export function ToolButton({ active, disabled, title, onClick, children }: ToolButtonProps) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center w-8 h-8 rounded-md
        text-xs font-medium transition-colors duration-150
        ${active
          ? 'bg-stone-700 text-white shadow-sm'
          : disabled
            ? 'text-stone-300 cursor-not-allowed'
            : 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-700'
        }
      `}
    >
      {children}
    </button>
  )
}
