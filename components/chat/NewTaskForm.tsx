'use client'

import { useState, useRef, useEffect } from 'react'

const CONFERENCE_GROUPS = [
  {
    label: 'AI / ML',
    items: ['NeurIPS', 'ICML', 'ICLR', 'AAAI', 'IJCAI'],
  },
  {
    label: 'Computer Vision',
    items: ['CVPR', 'ICCV', 'ECCV'],
  },
  {
    label: 'NLP',
    items: ['ACL', 'EMNLP', 'NAACL'],
  },
  {
    label: 'Data / Systems',
    items: ['KDD', 'SIGIR', 'WWW', 'SIGMOD'],
  },
  {
    label: '综合期刊',
    items: ['Nature', 'Science', 'Cell', 'PNAS', 'Nature Methods'],
  },
  {
    label: '生物 / 医学',
    items: ['Nature Cell Biology', 'Nature Neuroscience', 'Lancet'],
  },
  {
    label: '化学 / 材料',
    items: ['JACS', 'Angew. Chem.', 'Nature Materials'],
  },
  {
    label: '物理',
    items: ['Physical Review Letters', 'Nature Physics'],
  },
]

interface NewTaskFormProps {
  onSubmit: (message: string, conference: string) => void
}

export function NewTaskForm({ onSubmit }: NewTaskFormProps) {
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [conference, setConference] = useState('')
  const [customConference, setCustomConference] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const allItems = CONFERENCE_GROUPS.flatMap(g => g.items)
  const filteredGroups = search.trim()
    ? CONFERENCE_GROUPS.map(g => ({
        ...g,
        items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase())),
      })).filter(g => g.items.length > 0)
    : CONFERENCE_GROUPS

  const displayConference = conference === '__custom__'
    ? customConference
    : conference

  const handleSelect = (item: string) => {
    setConference(item)
    setDropdownOpen(false)
    setSearch('')
  }

  const handleSubmit = () => {
    if (!description.trim()) return
    const target = displayConference.trim()

    let message = description.trim()
    if (reference.trim()) {
      message += `\n\n参考内容：\n${reference.trim()}`
    }
    if (target) {
      message += `\n\n目标期刊/会议：${target}`
    }

    onSubmit(message, target)
  }

  return (
    <div className="flex items-center justify-center min-h-full px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-stone-800 mb-1">
            Pegasus
          </h2>
          <p className="text-sm text-stone-400">
            描述你需要的科研图表，我会逐步生成
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              图表描述 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="例如：设计一个 Transformer 架构图，展示 Multi-Head Attention 的内部结构..."
              rows={3}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Reference content */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              参考内容 <span className="text-stone-400 font-normal">(可选)</span>
            </label>
            <textarea
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="粘贴论文摘要、图表说明、或描述你想要的视觉风格..."
              rows={3}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Conference selector */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              目标期刊 / 会议 <span className="text-stone-400 font-normal">(可选)</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {displayConference || (
                  <span className="text-stone-400">选择期刊或会议...</span>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-72 flex flex-col overflow-hidden">
                  <div className="p-2 border-b border-stone-100">
                    <input
                      autoFocus
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="搜索..."
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm placeholder-stone-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 py-1">
                    {filteredGroups.map(group => (
                      <div key={group.label}>
                        <div className="px-3 py-1.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                          {group.label}
                        </div>
                        {group.items.map(item => (
                          <button
                            key={item}
                            onClick={() => handleSelect(item)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors ${
                              conference === item ? 'bg-blue-50 text-blue-700' : 'text-stone-700'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    ))}
                    {filteredGroups.length === 0 && !search.trim() && null}
                    {/* Custom input option */}
                    <div className="border-t border-stone-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setConference('__custom__')
                          setDropdownOpen(false)
                          setSearch('')
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        + 自定义输入
                      </button>
                    </div>
                    {search.trim() && filteredGroups.length === 0 && !allItems.some(i => i.toLowerCase() === search.toLowerCase()) && (
                      <button
                        onClick={() => handleSelect(search.trim())}
                        className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        使用 &quot;{search.trim()}&quot;
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom conference input */}
            {conference === '__custom__' && (
              <input
                autoFocus
                type="text"
                value={customConference}
                onChange={e => setCustomConference(e.target.value)}
                placeholder="输入期刊或会议名称..."
                className="w-full mt-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!description.trim()}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors mt-2"
          >
            开始创作
          </button>
        </div>
      </div>
    </div>
  )
}
