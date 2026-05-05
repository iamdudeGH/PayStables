'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

// ── Simple in-module event bus ─────────────────────────────────────────────
type Listener = (toast: ToastMessage) => void
const listeners: Listener[] = []

function emit(toast: ToastMessage) {
  listeners.forEach((l) => l(toast))
}

// ── Public API ─────────────────────────────────────────────────────────────
export const toast = {
  success: (message: string) =>
    emit({ id: crypto.randomUUID(), type: 'success', message }),
  error: (message: string) =>
    emit({ id: crypto.randomUUID(), type: 'error', message }),
  info: (message: string) =>
    emit({ id: crypto.randomUUID(), type: 'info', message }),
}

// ── Toast container (mount once in layout) ─────────────────────────────────
export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const handler = (t: ToastMessage) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => remove(t.id), 4000)
    }
    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [remove])

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[400px] px-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-elevated pointer-events-auto border text-sm font-semibold ${
              t.type === 'success'
                ? 'bg-success-light border-green-200 text-success'
                : t.type === 'error'
                ? 'bg-danger-light border-red-200 text-danger'
                : 'bg-primary-light border-indigo-200 text-primary'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="w-5 h-5 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
