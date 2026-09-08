const { createAdminNotification } = require('./adminNotifications')
const { userHasPermission } = require('../constants/permissions')
const { formatDate, TIME_SLOTS, ensureReservationsSchema, addDaysIso } = require('./reservations')
const { formatTimeRange12Hour } = require('../config/siteData')

const REMINDER_INTERVAL_MS = Number.parseInt(process.env.RESERVATION_REMINDER_INTERVAL_MS, 10) || 10 * 60 * 1000

let reminderRun = null
let reminderTimer = null

function slotLabel(timeSlot) {
  const normalized = String(timeSlot || '').slice(0, 5)
  const found = TIME_SLOTS.find((slot) => slot.value === normalized)
  if (found) return found.label
  if (!/^\d{2}:\d{2}$/.test(normalized)) return normalized
  const [hour, minute] = normalized.split(':').map(Number)
  const end = new Date(2000, 0, 1, hour, minute)
  end.setMinutes(end.getMinutes() + 120)
  const endValue = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
  return formatTimeRange12Hour(normalized, endValue)
}

async function listReminderRecipients(db) {
  const [rows] = await db.execute('SELECT id, role, permissions FROM users')
  return rows.filter((user) => userHasPermission(user, 'table') || userHasPermission(user, 'reservations'))
}

async function notificationExists(db, { type, reservationId, recipientUserId }) {
  try {
    const [rows] = await db.execute(
      `
      SELECT id FROM admin_notifications
      WHERE recipient_user_id = ?
        AND type = ?
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.reservationId')) AS CHAR) = ?
      LIMIT 1
      `,
      [recipientUserId, type, String(reservationId)],
    )
    return rows.length > 0
  } catch {
    const [rows] = await db.execute(
      `
      SELECT id, meta FROM admin_notifications
      WHERE recipient_user_id = ? AND type = ?
      ORDER BY id DESC
      LIMIT 50
      `,
      [recipientUserId, type],
    )
    return rows.some((row) => {
      let meta = row.meta
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta)
        } catch {
          meta = {}
        }
      }
      return String(meta?.reservationId) === String(reservationId)
    })
  }
}

async function notifyRecipients(db, recipients, { type, title, message, meta }) {
  for (const recipient of recipients) {
    const alreadySent = await notificationExists(db, {
      type,
      reservationId: meta.reservationId,
      recipientUserId: recipient.id,
    })
    if (alreadySent) continue
    await createAdminNotification(db, {
      recipientUserId: recipient.id,
      type,
      title,
      message,
      meta,
    })
  }
}

async function runReminderPass(db) {
  await ensureReservationsSchema(db)

  const recipients = await listReminderRecipients(db)
  if (!recipients.length) return { created: 0 }

  const today = formatDate(new Date())
  const inThreeDays = addDaysIso(today, 3)
  const tomorrow = addDaysIso(today, 1)
  let created = 0

  const [threeDayRows] = await db.execute(
    `
    SELECT r.id, r.customer_name, r.phone, r.reservation_date, r.time_slot, r.guest_count,
           r.table_id, t.table_name
    FROM reservations r
    JOIN tables t ON t.id = r.table_id
    WHERE r.reservation_date = ?
      AND r.status IN ('Pending', 'Confirmed', 'Reserved')
      AND r.reminder_3d_sent = 0
    `,
    [inThreeDays],
  )

  for (const row of threeDayRows) {
    const date = formatDate(row.reservation_date)
    const tableName = row.table_name || `Table ${row.table_id}`
    await notifyRecipients(db, recipients, {
      type: 'reservation_3d',
      title: 'Reservation in 3 days',
      message: `Upcoming reservation for ${row.customer_name} at ${tableName} on ${date} (${slotLabel(row.time_slot)}).`,
      meta: {
        reservationId: row.id,
        customerName: row.customer_name,
        phone: row.phone,
        tableId: row.table_id,
        tableName,
        guestCount: row.guest_count,
        reservationDate: date,
        timeSlot: String(row.time_slot).slice(0, 5),
      },
    })
    await db.execute('UPDATE reservations SET reminder_3d_sent = 1 WHERE id = ? AND reminder_3d_sent = 0', [row.id])
    created += 1
  }

  const [oneDayRows] = await db.execute(
    `
    SELECT r.id, r.customer_name, r.phone, r.reservation_date, r.time_slot, r.guest_count,
           r.table_id, t.table_name
    FROM reservations r
    JOIN tables t ON t.id = r.table_id
    WHERE r.reservation_date = ?
      AND r.status IN ('Pending', 'Confirmed', 'Reserved')
      AND r.reminder_1d_sent = 0
    `,
    [tomorrow],
  )

  for (const row of oneDayRows) {
    const tableName = row.table_name || `Table ${row.table_id}`
    await notifyRecipients(db, recipients, {
      type: 'reservation_1d',
      title: 'Tomorrow: upcoming reservation',
      message: `Tomorrow: Upcoming reservation for ${row.customer_name} at ${tableName}.`,
      meta: {
        reservationId: row.id,
        customerName: row.customer_name,
        phone: row.phone,
        tableId: row.table_id,
        tableName,
        guestCount: row.guest_count,
        reservationDate: formatDate(row.reservation_date),
        timeSlot: String(row.time_slot).slice(0, 5),
      },
    })
    await db.execute('UPDATE reservations SET reminder_1d_sent = 1 WHERE id = ? AND reminder_1d_sent = 0', [row.id])
    created += 1
  }

  return { created }
}

async function processReservationReminders(db) {
  if (reminderRun) return reminderRun
  reminderRun = runReminderPass(db).finally(() => {
    reminderRun = null
  })
  return reminderRun
}

function startReservationReminderJob(db) {
  if (reminderTimer) return reminderTimer

  const run = () => {
    processReservationReminders(db).catch((error) => {
      console.warn('⚠️ Reservation reminder job failed:', error.message)
    })
  }

  run()
  reminderTimer = setInterval(run, REMINDER_INTERVAL_MS)
  if (typeof reminderTimer.unref === 'function') reminderTimer.unref()
  return reminderTimer
}

module.exports = {
  processReservationReminders,
  startReservationReminderJob,
  REMINDER_INTERVAL_MS,
}
