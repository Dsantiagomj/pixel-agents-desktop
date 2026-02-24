import { useState, useEffect } from 'react'
import { api } from '../electronApi.js'

interface UpdateStatus {
  status: 'available' | 'downloading' | 'downloaded'
  version?: string
  percent?: number
}

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return api.on('updateStatus', (data: unknown) => {
      const status = data as UpdateStatus
      setUpdate(status)
      if (status.status === 'downloaded') {
        setDismissed(false)
      }
    })
  }, [])

  if (!update || dismissed) return null

  // Only show UI for downloading progress and ready-to-install
  if (update.status === 'available') return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 200,
        background: 'var(--pixel-bg)',
        border: '2px solid var(--pixel-border-light)',
        padding: '6px 10px',
        boxShadow: 'var(--pixel-shadow)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '20px',
        color: 'var(--pixel-text)',
      }}
    >
      {update.status === 'downloading' && (
        <span>Updating... {Math.round(update.percent ?? 0)}%</span>
      )}
      {update.status === 'downloaded' && (
        <>
          <span>v{update.version} ready!</span>
          <button
            onClick={() => api.send('installUpdate')}
            style={{
              background: 'var(--pixel-green)',
              color: '#000',
              border: 'none',
              padding: '2px 8px',
              fontSize: '20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Restart
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pixel-close-text)',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: '22px',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            x
          </button>
        </>
      )}
    </div>
  )
}
