import { useState, useCallback } from 'react'
import { Toast, ToastContainer, Toast as ToastType } from '@/components/ui/toast'

let toastCounter = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastType[]>([])

  const toast = useCallback(
    ({
      title,
      description,
      variant = 'default',
      duration = 3000,
    }: {
      title?: string
      description?: string
      variant?: 'default' | 'success' | 'error' | 'warning'
      duration?: number
    }) => {
      const id = `toast-${++toastCounter}`
      const newToast: ToastType = { id, title, description, variant }

      setToasts((prev) => [...prev, newToast])

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)

      return id
    },
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const ToastRenderer = useCallback(
    () => (
      <ToastContainer>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
        ))}
      </ToastContainer>
    ),
    [toasts, dismissToast]
  )

  return { toast, ToastRenderer }
}
