'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      const isCryptoError = this.state.error?.message.includes('crypto') || 
                            this.state.error?.message.includes('subtle')
                            
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-[24px] shadow-lg max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {isCryptoError ? 'Secure Context Required' : 'Application Error'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {isCryptoError 
                ? "Web3 features (like embedded wallets) require a secure context (HTTPS or localhost). Accessing via a local network IP on mobile is insecure. Please use a tool like ngrok or localtunnel to test on your phone."
                : this.state.error?.message || "An unexpected error occurred while loading the application."}
            </p>
            <button
              className="w-full bg-primary text-white font-bold py-3 px-4 rounded-[16px] hover:bg-primary/90 transition-all active:scale-95"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
