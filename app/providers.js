'use client'
import { Toaster } from 'sonner'
import { ConfirmProvider } from '@/components/app/confirm-dialog'

export function Providers({ children }) {
  return (
    <ConfirmProvider>
      {children}
      <Toaster position="top-right" richColors />
    </ConfirmProvider>
  )
}
