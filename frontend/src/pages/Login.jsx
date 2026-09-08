import { useEffect, useState } from 'react'
import { Moon, Sun, X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { API_BASE } from '../services/apiClient'
import { consumeConnectionLost } from '../services/sessionStorage'
import BrandLogo from '../components/common/BrandLogo'

export default function Login({ onLogin }) {
  const { isDark, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [connectionNotice, setConnectionNotice] = useState('')

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetStatus, setResetStatus] = useState({ type: '', message: '' })
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    if (consumeConnectionLost()) {
      setConnectionNotice('Connection lost. Sign in again to continue.')
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isLoading) return
    setError('')
    setConnectionNotice('')
    setIsLoading(true)
    try {
      await onLogin({ username: email.trim(), password })
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const openResetModal = (event) => {
    event.preventDefault()
    setResetUsername(email.trim())
    setResetStatus({ type: '', message: '' })
    setResetOpen(true)
  }

  const closeResetModal = () => {
    if (resetLoading) return
    setResetOpen(false)
    setResetStatus({ type: '', message: '' })
  }

  const handleResetSubmit = async (event) => {
    event.preventDefault()
    if (resetLoading) return

    const username = resetUsername.trim()
    if (!username) {
      setResetStatus({ type: 'error', message: 'Please enter your username.' })
      return
    }

    setResetLoading(true)
    setResetStatus({ type: '', message: '' })

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Unable to send the reset request.')
      }

      setResetStatus({
        type: 'success',
        message:
          data.message ||
          'If an account exists for that username, a reset request has been sent. An administrator will follow up shortly.',
      })
    } catch (err) {
      setResetStatus({
        type: 'error',
        message: err.message || 'Unable to send the reset request.',
      })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-8 top-8 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:bg-card active:scale-95"
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Sun className="h-5 w-5 text-primary" />
        ) : (
          <Moon className="h-5 w-5 text-primary" />
        )}
      </button>

      <div className="flex min-h-screen items-center lg:justify-center lg:gap-x-14 lg:px-12 xl:gap-x-16 xl:px-16">
        <div className="hidden min-h-screen lg:flex lg:flex-1 items-center justify-center py-12">
          <BrandLogo className="h-auto w-full max-h-[420px] max-w-[360px] object-contain animate-fadeIn" />
        </div>

        <div className="flex w-full min-h-screen lg:flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-0">
          <div className="w-full max-w-[460px] lg:max-w-[500px]">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLogo className="h-auto w-full max-h-[280px] max-w-[280px] object-contain" />
            </div>

            <div className="flex w-full flex-col gap-6 rounded-3xl border border-slate-100 bg-white p-10 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-3xl font-light text-slate-900 lg:text-4xl dark:text-zinc-100">
                Staff POS sign-in
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-2 block text-sm font-medium text-slate-600 lg:text-base dark:text-zinc-400"
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 lg:min-h-[52px] lg:px-5 lg:text-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-emerald-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(248_250_252)] [&:-webkit-autofill]:[-webkit-text-fill-color:#1d1d1f] dark:[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(39_39_42)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fafafa]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-2 block text-sm font-medium text-slate-600 lg:text-base dark:text-zinc-400"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 lg:min-h-[52px] lg:px-5 lg:text-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-emerald-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(248_250_252)] [&:-webkit-autofill]:[-webkit-text-fill-color:#1d1d1f] dark:[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(39_39_42)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fafafa]"
                  />
                  <div className="mt-2.5 flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                      onClick={openResetModal}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {connectionNotice && !error ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                    {connectionNotice}
                  </p>
                ) : null}

                {error ? (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full overflow-hidden rounded-full bg-[#10b981] py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-[52px] lg:text-lg"
                >
                  <span className={isLoading ? 'opacity-0' : 'opacity-100'}>Login</span>
                  {isLoading ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </span>
                  ) : null}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {resetOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm"
            aria-label="Close password reset"
            onClick={closeResetModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={closeResetModal}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id="reset-title" className="pr-8 text-xl font-semibold text-slate-900 dark:text-zinc-100">
              Reset password
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              Enter your staff username. Administrator accounts receive a reset email at the recovery
              inbox. Staff requests create an internal alert on the Admin dashboard with your account
              details and a temporary password.
            </p>

            <form onSubmit={handleResetSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="reset-username"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-zinc-400"
                >
                  Username
                </label>
                <input
                  id="reset-username"
                  type="text"
                  value={resetUsername}
                  onChange={(event) => setResetUsername(event.target.value)}
                  autoComplete="username"
                  disabled={resetLoading || resetStatus.type === 'success'}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {resetStatus.message ? (
                <p
                  role="status"
                  className={
                    resetStatus.type === 'error'
                      ? 'text-sm text-red-600 dark:text-red-400'
                      : 'text-sm text-emerald-700 dark:text-emerald-400'
                  }
                >
                  {resetStatus.message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
                {resetStatus.type !== 'success' ? (
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="rounded-full bg-[#10b981] px-5 py-2 text-sm font-semibold text-white hover:bg-[#059669] disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending…' : 'Send reset request'}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 blur-3xl" />
        <div className="absolute -left-1/4 -bottom-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-tr from-accent/5 to-primary/5 blur-3xl" />
      </div>
    </div>
  )
}
