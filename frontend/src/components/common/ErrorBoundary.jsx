import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Keeps a crash inside one page from unmounting the whole dashboard.
 * Resets automatically when `resetKey` changes so navigating away recovers.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="surface-card mx-auto flex max-w-lg flex-col items-center px-8 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-heading mt-4 text-lg font-semibold">This page ran into a problem</h3>
        <p className="text-muted mt-2 text-sm">
          The rest of the dashboard is still working — pick another page from the menu, or try loading
          this one again.
        </p>
        <p className="text-muted mt-3 break-words font-mono text-xs opacity-70">{String(error.message || error)}</p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="btn-primary mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    )
  }
}
