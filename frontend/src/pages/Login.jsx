import { useState } from 'react'
import { Moon, Sun, Coffee } from 'lucide-react'
import { STORE } from '../config/store'
import { useTheme } from '../context/ThemeContext'

export default function Login({ onLogin }) {
  const { isDark, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isLoading) return
    setError('')
    setIsLoading(true)
    try {
      await onLogin({ username: email.trim(), password })
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setIsLoading(false)
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

      <div className="flex min-h-screen">
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-12 py-12">
          <div className="space-y-8 max-w-md text-center">
            <div className="flex justify-center animate-fadeIn">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent/80 shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                <Coffee className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                {STORE.tagline}
              </p>
              <h1 className="text-4xl font-light tracking-tight text-foreground sm:text-5xl">
                {STORE.officialName}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{STORE.location}</p>
            </div>

            <div className="pt-8">
              <div className="h-1 w-12 mx-auto bg-gradient-to-r from-primary via-accent to-primary rounded-full opacity-60" />
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed pt-4">
              Streamline restaurant and cafe operations with our intuitive management system.
              Built for Siem Reap&apos;s tourist and local market — early coffee rushes through
              midday dining.
            </p>
          </div>
        </div>

        <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-3 text-center lg:hidden">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent/80">
                  <Coffee className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <h1 className="text-3xl font-light text-foreground">{STORE.officialName}</h1>
              <p className="text-sm text-muted-foreground">{STORE.location}</p>
            </div>

            <div className="flex w-full flex-col gap-5 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-1">
                <h2 className="text-2xl font-light text-slate-900 dark:text-zinc-100">Welcome Back</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-zinc-400"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-emerald-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(248_250_252)] [&:-webkit-autofill]:[-webkit-text-fill-color:#1d1d1f] dark:[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(39_39_42)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fafafa]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-zinc-400"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-emerald-500 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(248_250_252)] [&:-webkit-autofill]:[-webkit-text-fill-color:#1d1d1f] dark:[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgb(39_39_42)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#fafafa]"
                  />
                  <div className="mt-2 flex justify-end">
                    <a
                      href="#"
                      className="text-xs font-medium text-slate-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                      onClick={(e) => e.preventDefault()}
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>

                {error ? (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full overflow-hidden rounded-full bg-[#10b981] py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={isLoading ? 'opacity-0' : 'opacity-100'}>Login</span>
                  {isLoading ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </span>
                  ) : null}
                </button>

                <p className="border-t border-slate-100 pt-5 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                  Don&apos;t have an account?{' '}
                  <a
                    href="#"
                    className="font-semibold text-slate-900 transition-colors hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400"
                    onClick={(e) => e.preventDefault()}
                  >
                    Sign up
                  </a>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 blur-3xl" />
        <div className="absolute -left-1/4 -bottom-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-tr from-accent/5 to-primary/5 blur-3xl" />
      </div>
    </div>
  )
}
