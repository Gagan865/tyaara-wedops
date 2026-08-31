'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'

// Replaces window.confirm(), which blocks the main thread, cannot be styled, is
// suppressible by the browser, and looks nothing like the rest of the app.
//
//   const confirm = useConfirm()
//   if (!await confirm({ title: 'Remove this vendor?', destructive: true })) return

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options = {}) => {
    setState({
      title: options.title || 'Are you sure?',
      description: options.description || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      destructive: Boolean(options.destructive)
    })
    return new Promise(resolve => { resolverRef.current = resolve })
  }, [])

  const settle = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setState(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={Boolean(state)} onOpenChange={(open) => { if (!open) settle(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title}</AlertDialogTitle>
            {state?.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{state?.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={state?.destructive ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-600' : 'bg-[#0F4C3A] hover:bg-[#0B3A2C]'}
            >
              {state?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
