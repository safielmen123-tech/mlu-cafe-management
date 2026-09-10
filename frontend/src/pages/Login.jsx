import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import ThemeToggle from '../components/ui/ThemeToggle'
import LanguageToggle from '../components/ui/LanguageToggle'
import { API_BASE } from '../services/apiClient'
import { consumeConnectionLost } from '../services/sessionStorage'
import BrandLogo from '../components/common/BrandLogo'

export default function Login({ onLogin }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConnectionNotice, setShowConnectionNotice] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetStatus, setResetStatus] = useState({ type: '', message: '' })
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    if (consumeConnectionLost()) {
      setShowConnectionNotice(true)
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isLoading) return
    setError('')
    setShowConnectionNotice(false)
    setIsLoading(true)
    try {
      await onLogin({ username: email.trim(), password })
    } catch (err) {
      setError(err.message || t('auth.loginFailed'))
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
      setResetStatus({ type: 'error', message: t('auth.usernameRequired') })
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
        throw new Error(data.message || t('auth.resetRequestFailed'))
      }

      setResetStatus({
        type: 'success',
        message: data.message || t('auth.resetRequestSent'),
      })
    } catch (err) {
      setResetStatus({
        type: 'error',
        message: err.message || t('auth.resetRequestFailed'),
      })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground transition-colors duration-300">
      {/* Calm, on-brand gradient backdrop (replaces the old cafe photo). */}
      <div className="login-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />

      <div className="absolute right-4 top-4 z-50 flex items-center gap-2 sm:right-8 sm:top-8">
        <LanguageToggle />
        <ThemeToggle variant="icon" />
      </div>

      <div className="login-page relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center gap-x-10 px-4 py-10 sm:px-8 lg:gap-x-16 lg:px-12">
        <div className="hidden lg:flex lg:w-[42%] lg:items-center lg:justify-center">
          <BrandLogo glow className="h-auto w-full max-h-[380px] max-w-[320px] object-contain" />
        </div>

        <div className="flex w-full items-center justify-center lg:w-[58%]">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLogo glow className="h-auto w-full max-h-[180px] max-w-[180px] object-contain sm:max-h-[220px] sm:max-w-[220px]" />
            </div>

            <div className="flex w-full flex-col gap-5 rounded-3xl border border-cocoa-100/80 bg-white/70 p-6 shadow-xl shadow-cocoa-900/10 ring-1 ring-white/40 backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-zinc-900/55 dark:shadow-black/30 dark:ring-white/10">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl dark:text-zinc-50">
                {t('auth.staffSignIn')}
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-2 block text-sm font-medium text-slate-700 lg:text-base dark:text-zinc-300"
                  >
                    {t('auth.username')}
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/85 px-4 py-3.5 text-base text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 lg:min-h-[52px] lg:px-5 lg:text-lg dark:border-zinc-600/80 dark:bg-zinc-800/90 dark:text-zinc-100 dark:focus:ring-emerald-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(255_255_255_/_0.9)] [&:-webkit-autofill]:[-webkit-text-fill-color:#1d1d1f] dark:[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(39_39_42_/_0.95)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fafafa]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-2 block text-sm font-medium text-slate-700 lg:text-base dark:text-zinc-300"
                  >
                    {t('auth.password')}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200/80 bg-white/85 px-4 py-3.5 text-base text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 lg:min-h-[52px] lg:px-5 lg:text-lg dark:border-zinc-600/80 dark:bg-zinc-800/90 dark:text-zinc-100 dark:focus:ring-emerald-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(255_255_255_/_0.9)] [&:-webkit-autofill]:[-webkit-text-fill-color:#1d1d1f] dark:[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(39_39_42_/_0.95)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fafafa]"
                  />
                  <div className="mt-2.5 flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-600 transition-colors hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400"
                      onClick={openResetModal}
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  </div>
                </div>

                {showConnectionNotice && !error ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                    {t('auth.connectionLost')}
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
                  className="relative w-full overflow-hidden rounded-full bg-forest-500 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-[52px] lg:text-lg"
                >
                  <span className={isLoading ? 'opacity-0' : 'opacity-100'}>{t('auth.login')}</span>
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
            aria-label={t('a11y.closePasswordReset')}
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
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id="reset-title" className="pr-8 text-xl font-semibold text-slate-900 dark:text-zinc-100">
              {t('auth.resetPassword')}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              {t('auth.resetInstructions')}
            </p>

            <form onSubmit={handleResetSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="reset-username"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-zinc-400"
                >
                  {t('auth.username')}
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
                  {t('common.close')}
                </button>
                {resetStatus.type !== 'success' ? (
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="rounded-full bg-[#10b981] px-5 py-2 text-sm font-semibold text-white hover:bg-[#059669] disabled:opacity-50"
                  >
                    {resetLoading ? t('auth.sending') : t('auth.sendResetRequest')}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  )
}
