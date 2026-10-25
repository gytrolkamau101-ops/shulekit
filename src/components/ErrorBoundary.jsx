import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ShuleKit error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg border border-red-100 max-w-md w-full p-6 space-y-3">
            <h1 className="text-xl font-black text-red-700">Something went wrong</h1>
            <p className="text-sm text-slate-600">
              The screen crashed instead of going blank. You can reload and continue. If it keeps happening, note which button you pressed.
            </p>
            <pre className="text-xs bg-slate-50 p-3 rounded-xl overflow-auto max-h-40 text-red-800">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              type="button"
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold"
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
