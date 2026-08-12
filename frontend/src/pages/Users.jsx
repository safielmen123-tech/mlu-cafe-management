import { useCallback, useEffect, useState } from 'react'

import { ShieldCheck, UserPlus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { apiFetch } from '../services/apiClient'

import { getPermissionLabel, isAdminRole, normalizePermissions, PERMISSION_OPTIONS, VALID_PERMISSIONS } from '../utils/permissions'



const roleColors = {

  Admin: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50',

  Cashier: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50',

  Staff: 'bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700',

}



function sortUsersWithAdminsFirst(userList) {
  return [...userList].sort((a, b) => {
    const aIsAdmin = isAdminRole(a.role)
    const bIsAdmin = isAdminRole(b.role)
    if (aIsAdmin !== bIsAdmin) return aIsAdmin ? -1 : 1
    return String(a.display_name || '').localeCompare(String(b.display_name || ''))
  })
}



function UserFormModal({ mode, user, onClose, onSave }) {

  const isEdit = mode === 'edit'

  const [displayName, setDisplayName] = useState(user?.display_name || '')

  const [username, setUsername] = useState(user?.username || '')

  const [password, setPassword] = useState('')

  const [confirmPassword, setConfirmPassword] = useState('')

  const [role, setRole] = useState(user?.role || 'Staff')

  const [permissions, setPermissions] = useState(() => normalizePermissions(user?.permissions || []))

  const [error, setError] = useState('')

  const isAdminUser = isAdminRole(role)



  const handlePermissionToggle = (sectionId) => {

    setPermissions((prev) =>

      prev.includes(sectionId)

        ? prev.filter((permission) => permission !== sectionId)

        : [...prev, sectionId],

    )

  }



  const handleSubmit = async (e) => {

    e.preventDefault()

    setError('')



    if (!displayName.trim() || !username.trim()) {

      setError('Display name and username are required.')

      return

    }



    if (!isEdit) {
      if (!password || !confirmPassword) {
        setError('Password and confirmation are required for new users.')
        return
      }
    } else if (password || confirmPassword) {
      if (!password || !confirmPassword) {
        setError('Enter and confirm the new password, or leave both fields blank.')
        return
      }
    }



    if ((password || confirmPassword) && password !== confirmPassword) {

      setError('Passwords do not match. Check spelling entries.')

      return

    }



    if (password && password.length < 6) {

      setError('Security policy requires passwords to be at least 6 characters long.')

      return

    }



    const payload = {

      display_name: displayName.trim(),

      username: username.toLowerCase().replace(/\s+/g, ''),

      role,

      permissions: isAdminUser ? [...VALID_PERMISSIONS] : normalizePermissions(permissions),

    }



    if (password) {

      payload.password = password

    }



    try {
      await onSave(payload)
    } catch (err) {
      setError(err.message || 'Failed to save user')
    }

  }



  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      <button type="button" className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm dark:bg-obsidian-950/60" onClick={onClose} />



      <div className="surface-card relative max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl transition-all duration-300">

        <div className="flex items-start justify-between">

          <div className="flex items-center gap-2.5">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-olive-100 text-forest-600 dark:bg-olive-900/40 dark:text-forest-400">

              <ShieldCheck className="h-5 w-5" />

            </div>

            <div>

              <h3 className="text-heading text-lg font-semibold">

                {isEdit ? 'Edit User Permissions' : 'Add New User'}

              </h3>

              <p className="text-muted text-xs">

                {isEdit

                  ? isAdminUser

                    ? 'Update profile details. Administrators always have full system access.'

                    : 'Update role, password, and feature gates. Changes apply on the user’s next API request.'

                  : 'Establish staff profiles with secure feature gates.'}

              </p>

            </div>

          </div>

          <button type="button" onClick={onClose} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-obsidian-800">

            <X className="h-5 w-5" />

          </button>

        </div>



        <form onSubmit={handleSubmit} className="mt-5 space-y-4">

          <div>

            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-300">Display Name</label>

            <input

              type="text"

              value={displayName}

              onChange={(e) => setDisplayName(e.target.value)}

              placeholder="e.g. Jane Doe"

              className="input-field px-3 py-2 text-sm"

            />

          </div>



          <div>

            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-300">Username (Login ID)</label>

            <input

              type="text"

              value={username}

              onChange={(e) => setUsername(e.target.value)}

              placeholder="e.g. janedoe"

              disabled={isEdit}

              className="input-field px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"

            />

          </div>



          <div className="grid grid-cols-2 gap-3">

            <div>

              <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-300">

                {isEdit ? 'New Password (optional)' : 'Password'}

              </label>

              <input

                type="password"

                value={password}

                onChange={(e) => setPassword(e.target.value)}

                placeholder={isEdit ? 'Leave blank to keep current' : '••••••'}

                autoComplete={isEdit ? 'new-password' : 'new-password'}

                className="input-field px-3 py-2 text-sm"

              />

              {isEdit && (
                <p className="mt-1 text-[11px] text-stone-400">Set a new password to reset this user&apos;s login.</p>
              )}

            </div>

            <div>

              <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-300">Confirm Password</label>

              <input

                type="password"

                value={confirmPassword}

                onChange={(e) => setConfirmPassword(e.target.value)}

                placeholder={isEdit ? 'Re-enter new password' : '••••••'}

                autoComplete="new-password"

                className="input-field px-3 py-2 text-sm"

              />

            </div>

          </div>



          <div>

            <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-300">System Assignment Role</label>

            <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field bg-white px-3 py-2 text-sm dark:bg-obsidian-900">

              <option value="Staff">Staff</option>

              <option value="Cashier">Cashier</option>

              <option value="Admin">Admin</option>

            </select>

          </div>



          {!isAdminUser ? (
          <div>

            <label className="mb-1.5 block text-xs font-medium text-stone-600 dark:text-stone-300">Feature Gated Permissions</label>

            <div className="grid grid-cols-2 gap-2">

              {PERMISSION_OPTIONS.map((section) => (

                <label

                  key={section.id}

                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 p-2.5 text-xs font-medium transition-all hover:bg-stone-50 dark:border-obsidian-800 dark:hover:bg-obsidian-900/50"

                >

                  <input

                    type="checkbox"

                    checked={permissions.includes(section.id)}

                    onChange={() => handlePermissionToggle(section.id)}

                    className="h-4 w-4 rounded border-stone-300 text-forest-600 focus:ring-forest-500"

                  />

                  <span>{section.label}</span>

                </label>

              ))}

            </div>

          </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              Administrators have full system access. Feature gates do not apply to this role.
            </div>
          )}



          {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}



          <div className="flex gap-3 pt-3">

            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-xs font-semibold">Cancel</button>

            <button type="submit" className="btn-primary flex-1 py-2 text-xs font-semibold">

              {isEdit ? 'Save Changes' : 'Create User'}

            </button>

          </div>

        </form>

      </div>

    </div>

  )

}



export default function Users() {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])

  const [modalMode, setModalMode] = useState(null)

  const [selectedUser, setSelectedUser] = useState(null)

  const [error, setError] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load users')
      setUsers(sortUsersWithAdminsFirst(Array.isArray(data) ? data : []))
    } catch (err) {
      console.error('Error fetching system logs:', err)
      setError(err.message || 'Failed to load users')
      setUsers([])
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])



  const openCreateModal = () => {

    setSelectedUser(null)

    setModalMode('create')

  }



  const openEditModal = (user) => {

    setSelectedUser(user)

    setModalMode('edit')

  }



  const closeModal = () => {

    setModalMode(null)

    setSelectedUser(null)

  }



  const handleSaveUser = async (payload) => {

    try {

      setError('')

      const isEdit = modalMode === 'edit' && selectedUser?.id



      const res = await apiFetch(isEdit ? `/users/${selectedUser.id}` : '/users', {

        method: isEdit ? 'PUT' : 'POST',

        body: JSON.stringify(payload),

      })



      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save user')
      }

      closeModal()
      fetchUsers()
    } catch (err) {
      setError(err.message || 'Failed to save user')
      throw err
    }

  }



  return (

    <div className="space-y-6">

      <div className="flex items-center justify-between">

        <div>

          <h3 className="text-heading text-lg font-bold">{t('nav.users')}</h3>

          <p className="text-muted text-sm">Manage staff accounts, roles, and page access permissions.</p>

        </div>

        <button type="button" onClick={openCreateModal} className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold">

          <UserPlus className="h-4 w-4" />

          Add New User

        </button>

      </div>



      {error && (

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">

          {error}

        </div>

      )}



      <div className="table-shell overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[640px] text-left text-sm">

            <thead>

              <tr className="table-head text-xs uppercase tracking-wider">

                <th className="px-6 py-3.5">Name</th>

                <th className="px-6 py-3.5">Role</th>

                <th className="px-6 py-3.5">Active Permissions</th>

              </tr>

            </thead>

            <tbody className="table-divider">

              {users.map((user) => (

                <tr

                  key={user.id}

                  onClick={() => openEditModal(user)}

                  className="table-row cursor-pointer hover:bg-stone-50/50 dark:hover:bg-obsidian-900/20"

                >

                  <td className="px-6 py-4">

                    <p className="text-heading text-sm font-semibold">{user.display_name}</p>

                    <p className="text-xs text-stone-400">@{user.username}</p>

                  </td>

                  <td className="px-6 py-4">

                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${roleColors[user.role] || roleColors.Staff}`}>

                      {user.role}

                    </span>

                  </td>

                  <td className="px-6 py-4">

                    <div className="flex flex-wrap gap-1.5">

                      {isAdminRole(user.role) ? (
                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                          Full system access
                        </span>
                      ) : user.permissions && user.permissions.length > 0 ? (

                        normalizePermissions(user.permissions).map((permission) => (

                          <span key={permission} className="rounded-lg bg-olive-50 px-2 py-0.5 text-[11px] font-medium text-forest-700 dark:bg-olive-900/20 dark:text-forest-400">

                            {getPermissionLabel(permission)}

                          </span>

                        ))

                      ) : (

                        <span className="text-xs italic text-stone-400">No access permissions allowed</span>

                      )}

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>



      {modalMode && (

        <UserFormModal

          key={`${modalMode}-${selectedUser?.id ?? 'new'}`}

          mode={modalMode}

          user={selectedUser}

          onClose={closeModal}

          onSave={handleSaveUser}

        />

      )}

    </div>

  )

}


