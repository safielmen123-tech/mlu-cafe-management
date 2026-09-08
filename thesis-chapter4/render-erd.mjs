import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))

const W = 260
const HEADER = 36
const ROW = 22
const PAD = 10
const FONT = 'Segoe UI, Arial, sans-serif'

function boxH(n) {
  return HEADER + n * ROW + PAD
}

function entity(x, y, title, attrs) {
  const h = boxH(attrs.length)
  const rows = attrs
    .map((a, i) => {
      const yy = y + HEADER + 16 + i * ROW
      const mark = a.pk ? 'PK' : a.fk ? 'FK' : a.uk ? 'UK' : ''
      const markColor = a.pk ? '#2d6a32' : a.fk ? '#1f4e79' : '#7a4f01'
      const weight = a.pk ? '700' : '400'
      return `
    <text x="${x + 12}" y="${yy}" font-family="${FONT}" font-size="13" font-weight="${weight}" fill="#222">${a.name}</text>
    ${mark ? `<text x="${x + W - 12}" y="${yy}" text-anchor="end" font-family="${FONT}" font-size="11" font-weight="700" fill="${markColor}">${mark}</text>` : ''}`
    })
    .join('')
  return `
  <rect x="${x}" y="${y}" width="${W}" height="${h}" fill="#ffffff" stroke="#6c8ebf" stroke-width="1.8"/>
  <rect x="${x}" y="${y}" width="${W}" height="${HEADER}" fill="#fff2cc" stroke="#d6b656" stroke-width="1.8"/>
  <text x="${x + W / 2}" y="${y + 24}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" fill="#222">${title}</text>
  ${rows}`
}

const parts = []
const lines = []

function crow(x, y, side) {
  const c = 11
  if (side === 'left') {
    lines.push(`<line x1="${x + c}" y1="${y}" x2="${x}" y2="${y - 7}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x + c}" y1="${y}" x2="${x}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x + c}" y1="${y}" x2="${x}" y2="${y + 7}" stroke="#222" stroke-width="1.8"/>`)
  } else if (side === 'right') {
    lines.push(`<line x1="${x - c}" y1="${y}" x2="${x}" y2="${y - 7}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x - c}" y1="${y}" x2="${x}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x - c}" y1="${y}" x2="${x}" y2="${y + 7}" stroke="#222" stroke-width="1.8"/>`)
  } else if (side === 'top') {
    lines.push(`<line x1="${x}" y1="${y + c}" x2="${x - 7}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x}" y1="${y + c}" x2="${x}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x}" y1="${y + c}" x2="${x + 7}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
  } else {
    lines.push(`<line x1="${x}" y1="${y - c}" x2="${x - 7}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x}" y1="${y - c}" x2="${x}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
    lines.push(`<line x1="${x}" y1="${y - c}" x2="${x + 7}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
  }
}

function tickH(x, y) {
  lines.push(`<line x1="${x}" y1="${y - 7}" x2="${x}" y2="${y + 7}" stroke="#222" stroke-width="1.8"/>`)
}
function tickV(x, y) {
  lines.push(`<line x1="${x - 7}" y1="${y}" x2="${x + 7}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
}
function circle(x, y) {
  lines.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="#ffffff" stroke="#222" stroke-width="1.6"/>`)
}

function hSolid(x1, x2, y) {
  lines.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#222" stroke-width="1.8"/>`)
}
function vSolid(x, y1, y2) {
  lines.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#222" stroke-width="1.8"/>`)
}
function hDash(x1, x2, y) {
  lines.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#666" stroke-width="1.7" stroke-dasharray="7 5"/>`)
}
function vDash(x, y1, y2) {
  lines.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#666" stroke-width="1.7" stroke-dasharray="7 5"/>`)
}
function label(x, y, text) {
  lines.push(`<text x="${x}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#555">${text}</text>`)
}

const users = { x: 40, y: 80, n: 6 }
const expenses = { x: 40, y: 360, n: 5 }
const audit = { x: 40, y: 580, n: 5 }
const admin = { x: 40, y: 800, n: 4 }
const reservations = { x: 370, y: 80, n: 7 }
const tables = { x: 370, y: 420, n: 4 }
const orders = { x: 720, y: 420, n: 6 }
const orderItems = { x: 1070, y: 420, n: 6 }
const menuItems = { x: 1070, y: 80, n: 5 }
const inventory = { x: 1420, y: 420, n: 5 }

parts.push(
  entity(users.x, users.y, 'users', [
    { name: 'id', pk: true },
    { name: 'username', uk: true },
    { name: 'email' },
    { name: 'password_hash' },
    { name: 'role' },
    { name: 'permissions' },
  ]),
  entity(reservations.x, reservations.y, 'reservations', [
    { name: 'id', pk: true },
    { name: 'table_id', fk: true },
    { name: 'created_by' },
    { name: 'customer_name' },
    { name: 'reservation_date' },
    { name: 'time_slot' },
    { name: 'status' },
  ]),
  entity(menuItems.x, menuItems.y, 'menu_items', [
    { name: 'id', pk: true },
    { name: 'name' },
    { name: 'category' },
    { name: 'price' },
    { name: 'is_available' },
  ]),
  entity(expenses.x, expenses.y, 'expenses', [
    { name: 'id', pk: true },
    { name: 'category' },
    { name: 'amount' },
    { name: 'expense_date' },
    { name: 'created_by' },
  ]),
  entity(tables.x, tables.y, 'tables', [
    { name: 'id', pk: true },
    { name: 'table_name', uk: true },
    { name: 'section' },
    { name: 'capacity' },
  ]),
  entity(orders.x, orders.y, 'orders', [
    { name: 'id', pk: true },
    { name: 'table_id', fk: true },
    { name: 'source_type' },
    { name: 'payment_type' },
    { name: 'total' },
    { name: 'status' },
  ]),
  entity(orderItems.x, orderItems.y, 'order_items', [
    { name: 'id', pk: true },
    { name: 'order_id', fk: true },
    { name: 'menu_item_id', fk: true },
    { name: 'item_name' },
    { name: 'quantity' },
    { name: 'price' },
  ]),
  entity(inventory.x, inventory.y, 'inventory', [
    { name: 'id', pk: true },
    { name: 'item_name' },
    { name: 'stock_quantity' },
    { name: 'low_threshold' },
    { name: 'stock_status' },
  ]),
  entity(audit.x, audit.y, 'audit_logs', [
    { name: 'id', pk: true },
    { name: 'user_id' },
    { name: 'action' },
    { name: 'module' },
    { name: 'created_at' },
  ]),
  entity(admin.x, admin.y, 'admin_notifications', [
    { name: 'id', pk: true },
    { name: 'recipient_user_id' },
    { name: 'type' },
    { name: 'is_read' },
  ]),
)

const usersR = users.x + W
const usersCy = users.y + boxH(users.n) / 2
const usersB = users.y + boxH(users.n)
const resL = reservations.x
const resB = reservations.y + boxH(reservations.n)
const resCx = reservations.x + W / 2
const tablesT = tables.y
const tablesCx = tables.x + W / 2
const tablesCy = tables.y + boxH(tables.n) / 2
const tablesR = tables.x + W
const ordersL = orders.x
const ordersR = orders.x + W
const oiL = orderItems.x
const oiCy = orderItems.y + boxH(orderItems.n) / 2
const oiT = orderItems.y
const oiCx = orderItems.x + W / 2
const menuB = menuItems.y + boxH(menuItems.n)
const menuCx = menuItems.x + W / 2
const expT = expenses.y
const expCx = expenses.x + W / 2
const audL = audit.x
const audCy = audit.y + boxH(audit.n) / 2
const admL = admin.x
const admCy = admin.y + boxH(admin.n) / 2
const rail = 22

// users 1 --d-- * reservations
hDash(usersR, resL, usersCy)
tickH(usersR + 10, usersCy)
crow(resL, usersCy, 'right')
label((usersR + resL) / 2, usersCy - 10, 'creates')

// users 1 --d-- * expenses
vDash(expCx, usersB, expT)
tickV(expCx, usersB + 10)
crow(expCx, expT, 'bottom')
label(expCx + 36, (usersB + expT) / 2 + 4, 'records')

// users 1 --d-- * audit_logs and admin_notifications (left rail)
hDash(users.x, rail, usersCy)
vDash(rail, usersCy, admCy)
hDash(rail, audL, audCy)
crow(audL, audCy, 'right')
label(audit.x + W + 48, audCy + 4, 'generates')
hDash(rail, admL, admCy)
crow(admL, admCy, 'right')
label(admin.x + W + 48, admCy + 4, 'receives')

// tables 1 -- * reservations
vSolid(tablesCx, resB, tablesT)
tickV(tablesCx, tablesT - 10)
crow(resCx, resB, 'top')
label(tablesCx + 48, (resB + tablesT) / 2 + 4, 'is booked as')

// tables 1 -- o{ orders
hSolid(tablesR, ordersL, tablesCy)
tickH(tablesR + 10, tablesCy)
circle(ordersL - 20, tablesCy)
crow(ordersL, tablesCy, 'right')
label((tablesR + ordersL) / 2, tablesCy - 12, 'hosts')

// orders 1 -- |{ order_items
hSolid(ordersR, oiL, oiCy)
tickH(ordersR + 10, oiCy)
tickH(oiL - 16, oiCy)
crow(oiL, oiCy, 'right')
label((ordersR + oiL) / 2, oiCy - 12, 'contains')

// menu_items o -- o{ order_items
vSolid(menuCx, menuB, oiT)
circle(menuCx, menuB + 14)
circle(oiCx, oiT - 22)
crow(oiCx, oiT, 'bottom')
label(menuCx + 48, (menuB + oiT) / 2 + 4, 'is sold as')

parts.push(`
  <text x="${inventory.x + W / 2}" y="${inventory.y + boxH(inventory.n) + 28}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#b85450">No foreign key</text>
  <text x="${inventory.x + W / 2}" y="${inventory.y + boxH(inventory.n) + 46}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#b85450">(no recipe table)</text>
`)

parts.push(`
  <rect x="1420" y="80" width="260" height="210" fill="#f5f5f5" stroke="#888" stroke-width="1.4"/>
  <text x="1550" y="108" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="#222">Legend</text>
  <line x1="1440" y1="132" x2="1540" y2="132" stroke="#222" stroke-width="1.8"/>
  <text x="1550" y="136" font-family="${FONT}" font-size="12" fill="#222">MySQL FOREIGN KEY</text>
  <line x1="1440" y1="160" x2="1540" y2="160" stroke="#666" stroke-width="1.7" stroke-dasharray="7 5"/>
  <text x="1550" y="164" font-family="${FONT}" font-size="12" fill="#222">App link (no FK)</text>
  <line x1="1440" y1="190" x2="1510" y2="190" stroke="#222" stroke-width="1.8"/>
  <line x1="1510" y1="190" x2="1522" y2="183" stroke="#222" stroke-width="1.8"/>
  <line x1="1510" y1="190" x2="1522" y2="190" stroke="#222" stroke-width="1.8"/>
  <line x1="1510" y1="190" x2="1522" y2="197" stroke="#222" stroke-width="1.8"/>
  <text x="1532" y="194" font-family="${FONT}" font-size="12" fill="#222">One to many</text>
  <circle cx="1452" cy="222" r="4.5" fill="#ffffff" stroke="#222" stroke-width="1.6"/>
  <text x="1466" y="226" font-family="${FONT}" font-size="12" fill="#222">Optional (nullable)</text>
  <text x="1440" y="258" font-family="${FONT}" font-size="12" fill="#2d6a32" font-weight="700">PK</text>
  <text x="1464" y="258" font-family="${FONT}" font-size="12" fill="#222">primary   </text>
  <text x="1536" y="258" font-family="${FONT}" font-size="12" fill="#1f4e79" font-weight="700">FK</text>
  <text x="1558" y="258" font-family="${FONT}" font-size="12" fill="#222">foreign</text>
`)

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1740" height="1020" viewBox="0 0 1740 1020">
  <rect width="1740" height="1020" fill="#ffffff"/>
  <text x="870" y="36" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="#222">Entity Relationship Diagram</text>
  <text x="870" y="60" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#555">Mlu Kitchen &amp; Cafe Siem Reap  —  MySQL</text>
  ${lines.join('\n')}
  ${parts.join('\n')}
</svg>
`

writeFileSync(join(here, '4.14-erd.svg'), svg, 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 2000 }, background: '#ffffff' })
writeFileSync(join(here, '4.14-erd.png'), resvg.render().asPng())
console.log('Wrote 4.14-erd.png')
