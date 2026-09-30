import { useTranslation } from 'react-i18next'
import StatusBadge from './StatusBadge'

const PAYMENT_BADGE_STYLES = {
  Cash: 'badge-olive',
  'Bank Scan': 'badge-forest',
}

export default function PaymentMethodBadge({ method }) {
  const { t } = useTranslation()
  const style = PAYMENT_BADGE_STYLES[method]
    || 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
  const label = method === 'Bank Scan'
    ? t('payment.methods.bankScan')
    : method === 'Cash'
      ? t('payment.methods.cash')
      : method

  return (
    <StatusBadge className={style}>{label}</StatusBadge>
  )
}
