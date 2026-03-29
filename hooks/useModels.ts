'use client'

import { useState, useEffect } from 'react'

interface ModelOption {
  id: string
  name: string
}

export function useModels() {
  const [models, setModels] = useState<ModelOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then((data: ModelOption[]) => {
        setModels(data)
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [])

  return { models, isLoading }
}
