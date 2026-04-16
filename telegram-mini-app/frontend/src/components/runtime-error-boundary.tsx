"use client"

import React from "react"

type RuntimeErrorBoundaryProps = {
  children: React.ReactNode
}

type RuntimeErrorBoundaryState = {
  errorMessage: string | null
}

export class RuntimeErrorBoundary extends React.Component<
  RuntimeErrorBoundaryProps,
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = {
    errorMessage: null,
  }

  static getDerivedStateFromError(error: unknown): RuntimeErrorBoundaryState {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка интерфейса"
    return { errorMessage: message }
  }

  componentDidCatch(error: unknown) {
    console.error("RuntimeErrorBoundary caught:", error)
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="mx-auto flex min-h-svh max-w-[430px] items-center justify-center bg-background px-6">
          <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-left">
            <p className="text-sm font-semibold text-red-700">Mini App упал в runtime</p>
            <p className="mt-2 break-words text-sm text-red-900">{this.state.errorMessage}</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
