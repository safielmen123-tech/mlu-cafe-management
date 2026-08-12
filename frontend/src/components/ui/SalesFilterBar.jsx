import { Calendar } from 'lucide-react'

export function MonthFilterSelect({ value, onChange, options, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
        <Calendar className="h-3.5 w-3.5" />
        Filter by month
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field min-w-[220px] px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SalesFilterBar({ selectedMonth, onMonthChange, monthOptions }) {
  return (
    <MonthFilterSelect value={selectedMonth} onChange={onMonthChange} options={monthOptions} />
  )
}
