import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

function passwordMeetsPolicy(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
}

export default function ForcePasswordChange() {
  const { t } = useTranslation()
  const { completePasswordChange, logout } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError(t('users.errors.passwordMismatch'))
      return
    }
    if (!passwordMeetsPolicy(password)) {
      setError(t('users.errors.passwordLength'))
      return
    }

    setSaving(true)
    try {
      await completePasswordChange({ password, confirmPassword })
    } catch (err) {
      setError(err.message || t('users.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-obsidian-950">
      <form onSubmit={handleSubmit} className="surface-card w-full max-w-md p-6">
        <h1 className="text-heading text-xl font-semibold">{t('auth.mustChangeTitle')}</h1>
        <p className="text-muted mt-2 text-sm">{t('auth.mustChangeBody')}</p>
        <label className="mt-5 block text-xs font-medium text-slate-600 dark:text-zinc-400" htmlFor="new-password">
          {t('auth.newPassword')}
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input-field mt-1 w-full px-3 py-2 text-sm"
        />
        <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-zinc-400" htmlFor="confirm-password">
          {t('auth.confirmPassword')}
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="input-field mt-1 w-full px-3 py-2 text-sm"
        />
        <p className="text-muted mt-2 text-xs">{t('users.errors.passwordLength')}</p>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={logout}>
            {t('nav.signOut')}
          </button>
          <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={saving}>
            {saving ? t('auth.updatingPassword') : t('auth.updatePassword')}
          </button>
        </div>
      </form>
    </div>
  )
}
