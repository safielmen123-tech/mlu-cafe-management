import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarRange,
  Database,
  Download,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Upload,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../context/AuthContext'
import { apiDownload, apiUpload } from '../services/apiClient'

function buildPeriodOptions() {
  const options = [{ value: 'all', label: 'All Time', month: null, year: null }]
  const now = new Date()

  for (let offset = 0; offset < 24; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    const value = `${year}-${String(month).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    options.push({ value, label, month, year })
  }

  return options
}

function buildPeriodQuery(selectedPeriod) {
  if (selectedPeriod === 'all') return {}
  const [year, month] = selectedPeriod.split('-')
  return { month, year }
}

function OptionCard({ icon: Icon, title, description, badge, children, variant = 'default' }) {
  const accent =
    variant === 'danger'
      ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
      : 'bg-forest-100 dark:bg-forest-900/40 text-forest-600 dark:text-forest-400'

  return (
    <div className="surface-card flex flex-col gap-5 p-6">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-heading font-semibold">{title}</h4>
            {badge ? (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="text-muted mt-2 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function PeriodSelector({ value, onChange, id }) {
  const options = useMemo(() => buildPeriodOptions(), [])
  const selectedLabel = options.find((option) => option.value === value)?.label || 'All Time'

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        Export period
      </label>
      <div className="relative min-w-[220px]">
        <CalendarRange className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-field w-full appearance-none rounded-xl py-2.5 pl-10 pr-4 text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <span className="text-muted text-xs">Selected: {selectedLabel}</span>
    </div>
  )
}

export default function BackupRecovery() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const fileInputRef = useRef(null)
  const periodOptions = useMemo(() => buildPeriodOptions(), [])

  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [excelLoading, setExcelLoading] = useState(false)
  const [sqlLoading, setSqlLoading] = useState(false)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedPeriodLabel =
    periodOptions.find((option) => option.value === selectedPeriod)?.label || 'All Time'

  const clearMessages = () => {
    setStatusMessage('')
    setErrorMessage('')
  }

  const handleExcelExport = async () => {
    clearMessages()
    setExcelLoading(true)
    try {
      const query = buildPeriodQuery(selectedPeriod)
      const filename = await apiDownload(
        '/system/backup/excel',
        'romduol-business-data.xlsx',
        query,
      )
      setStatusMessage(`Business data exported as ${filename}`)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to export business data')
    } finally {
      setExcelLoading(false)
    }
  }

  const handleSqlBackup = async () => {
    clearMessages()
    setSqlLoading(true)
    try {
      const query = buildPeriodQuery(selectedPeriod)
      const filename = await apiDownload('/system/backup/sql', 'romduol-database.sql', query)
      setStatusMessage(`Database backup saved as ${filename}`)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to create SQL backup')
    } finally {
      setSqlLoading(false)
    }
  }

  const handleFileSelect = (event) => {
    clearMessages()
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const handleRestore = async () => {
    if (!selectedFile) {
      setErrorMessage('Please choose a .sql backup file first')
      return
    }

    const confirmed = window.confirm(
      'This will overwrite matching database records from the uploaded backup. Existing rows for the same period or primary keys will be replaced safely without duplicates. Continue?',
    )
    if (!confirmed) return

    clearMessages()
    setRestoreLoading(true)
    try {
      const result = await apiUpload('/system/backup/restore', 'sqlFile', selectedFile)
      setStatusMessage(result.message || 'Database restored successfully')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to restore database')
    } finally {
      setRestoreLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-heading text-lg">{t('nav.backupRecovery')}</h3>
        <p className="text-muted text-sm">
          Export business data, create full or month-specific database backups, and restore safely
          without duplicate rows
        </p>
      </div>

      {(statusMessage || errorMessage) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            errorMessage
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {errorMessage || statusMessage}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <OptionCard
          icon={FileSpreadsheet}
          title="Export Business Data (Excel)"
          description="Download orders, payments, sales history, menu items, user accounts, inventory, and table data as a multi-sheet Excel workbook. Choose All Time or filter transactional sheets to a specific month."
          badge="Excel / CSV-ready"
        >
          <div className="space-y-4">
            <PeriodSelector
              id="excel-period"
              value={selectedPeriod}
              onChange={setSelectedPeriod}
            />
            <button
              type="button"
              onClick={handleExcelExport}
              disabled={excelLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {excelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {excelLoading ? 'Preparing export…' : `Download Excel (${selectedPeriodLabel})`}
            </button>
          </div>
        </OptionCard>

        <OptionCard
          icon={Database}
          title="System Database Backup (SQL)"
          description="Generate a SQL backup for disaster recovery. All Time creates a full mysqldump with DROP TABLE rules. A specific month exports only that period's orders while safely updating reference tables."
          badge={isAdmin ? 'Admin' : 'Admin only'}
        >
          {isAdmin ? (
            <div className="space-y-4">
              <PeriodSelector
                id="sql-period"
                value={selectedPeriod}
                onChange={setSelectedPeriod}
              />
              <button
                type="button"
                onClick={handleSqlBackup}
                disabled={sqlLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sqlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                {sqlLoading ? 'Creating backup…' : `Download SQL (${selectedPeriodLabel})`}
              </button>
            </div>
          ) : (
            <p className="text-muted text-sm">Administrator access is required to create full SQL backups.</p>
          )}
        </OptionCard>
      </div>

      <OptionCard
        icon={Upload}
        title="Restore Database"
        description="Upload a previously exported .sql backup file. Full backups drop and recreate tables. Month-specific backups delete and replace only that period's orders, using REPLACE INTO to avoid duplicate key errors."
        badge={isAdmin ? 'Safe overwrite' : 'Admin only'}
        variant="danger"
      >
        {isAdmin ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql"
                onChange={handleFileSelect}
                className="text-muted block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-stone-700 hover:file:bg-stone-200 dark:file:bg-stone-800 dark:file:text-stone-200 dark:hover:file:bg-stone-700"
              />
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoreLoading || !selectedFile}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {restoreLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {restoreLoading ? 'Restoring…' : 'Restore from SQL File'}
              </button>
            </div>
            {selectedFile ? (
              <p className="text-muted text-sm">
                Selected file: <span className="text-heading font-medium">{selectedFile.name}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted text-sm">Administrator access is required to restore the database.</p>
        )}
      </OptionCard>
    </div>
  )
}
