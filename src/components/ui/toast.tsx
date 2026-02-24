import * as React from "react"
import { X } from "lucide-react"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "success" | "error" | "warning"
}

interface ToastProps {
  toast: Toast
  onClose: () => void
}

export function Toast({ toast, onClose }: ToastProps) {
  const variantStyles = {
    default: "bg-white border-gray-200",
    success: "bg-green-50 border-green-500",
    error: "bg-red-50 border-red-500",
    warning: "bg-amber-50 border-amber-500"
  }

  const titleStyles = {
    default: "text-gray-900",
    success: "text-green-900",
    error: "text-red-900",
    warning: "text-amber-900"
  }

  const descStyles = {
    default: "text-gray-600",
    success: "text-green-700",
    error: "text-red-700",
    warning: "text-amber-700"
  }

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-md rounded-lg border-2 p-4 shadow-lg transition-all ${variantStyles[toast.variant || "default"]
        }`}
    >
      <div className="flex-1">
        {toast.title && (
          <div className={`text-sm font-semibold ${titleStyles[toast.variant || "default"]}`}>
            {toast.title}
          </div>
        )}
        {toast.description && (
          <div className={`mt-1 text-sm ${descStyles[toast.variant || "default"]}`}>
            {toast.description}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="ml-4 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {children}
    </div>
  )
}
