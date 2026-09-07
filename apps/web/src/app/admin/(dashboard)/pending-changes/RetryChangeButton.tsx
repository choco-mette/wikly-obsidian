'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RetryChangeButton({ changeId }: { changeId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRetry = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/pending-changes/${changeId}/retry`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error('Failed to retry change')
      }
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={loading}
      className="btn-secondary btn-sm flex items-center gap-1"
      title="Reset this operation back to pending"
    >
      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      <span>{loading ? 'Retrying...' : 'Retry'}</span>
    </button>
  )
}
