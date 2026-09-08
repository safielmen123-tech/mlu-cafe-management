import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))

function store(x, y, w, label) {
  const h = 44
  return `
  <path d="M${x},${y} h${w} m0,0 v${h} m0,0 h${-w}" fill="none" stroke="#222" stroke-width="1.6"/>
  <line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="#222" stroke-width="1.6"/>
  <text x="${x + 12}" y="${y + 28}" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#222">${label}</text>`
}

function processBox(x, y, w, h, num, name) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#f2f2f2" stroke="#222" stroke-width="1.6"/>
  <text x="${x + 16}" y="${y + h / 2 + 5}" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#222">${num}</text>
  <text x="${x + 56}" y="${y + h / 2 + 5}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#222">${name}</text>`
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1280" viewBox="0 0 1500 1280">
  <defs>
    <marker id="arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 Z" fill="#222"/>
    </marker>
  </defs>
  <rect width="1500" height="1280" fill="#ffffff"/>
  <text x="750" y="42" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="#222">Data Flow Diagram Level 0</text>
  <text x="750" y="68" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#555">Mlu Kitchen &amp; Cafe Siem Reap</text>

  <!-- Admin -->
  <rect x="36" y="100" width="130" height="50" fill="#fff" stroke="#222" stroke-width="1.7"/>
  <text x="101" y="132" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">Admin</text>
  <line x1="101" y1="150" x2="101" y2="1188" stroke="#222" stroke-width="1.6"/>

  <!-- Staff -->
  <rect x="36" y="620" width="130" height="50" fill="#fff" stroke="#222" stroke-width="1.7"/>
  <text x="101" y="652" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">Staff</text>

  <!-- External -->
  <rect x="36" y="1088" width="130" height="64" fill="#fff" stroke="#222" stroke-width="1.7"/>
  <text x="101" y="1114" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700">External</text>
  <text x="101" y="1134" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#444">Email, Weather, FX</text>

  <!-- 1.0 -->
  <line x1="101" y1="200" x2="210" y2="200" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="11">Manage Users</text>
  ${processBox(220, 174, 300, 52, '1.0', 'User &amp; Auth Mgmt')}
  <line x1="520" y1="200" x2="610" y2="200" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="540" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="11">CRUD</text>
  ${store(620, 178, 240, 'D1  users')}

  <!-- 2.0 -->
  <line x1="101" y1="300" x2="210" y2="300" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="11">Manage Menu</text>
  ${processBox(220, 274, 300, 52, '2.0', 'Menu Mgmt')}
  <line x1="520" y1="300" x2="610" y2="300" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="540" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="11">CRUD</text>
  ${store(620, 278, 240, 'D2  menu_items')}

  <!-- 3.0 -->
  <line x1="101" y1="400" x2="210" y2="400" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="390" font-family="Segoe UI, Arial, sans-serif" font-size="11">Manage / Restock</text>
  ${processBox(220, 374, 300, 52, '3.0', 'Inventory &amp; Expense')}
  <line x1="520" y1="400" x2="610" y2="400" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="540" y="390" font-family="Segoe UI, Arial, sans-serif" font-size="11">CRUD</text>
  ${store(620, 378, 280, 'D5  inventory / expenses')}

  <!-- 4.0 POS - larger -->
  <line x1="101" y1="530" x2="210" y2="530" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="520" font-family="Segoe UI, Arial, sans-serif" font-size="11">View / Payment</text>
  ${processBox(220, 490, 300, 80, '4.0', 'Order &amp; Payment  (POS)')}
  <line x1="101" y1="645" x2="170" y2="645" stroke="#222" stroke-width="1.5"/>
  <line x1="170" y1="645" x2="170" y2="550" stroke="#222" stroke-width="1.5"/>
  <line x1="170" y1="550" x2="220" y2="550" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="575" font-family="Segoe UI, Arial, sans-serif" font-size="11">Create / Edit Order</text>
  <line x1="520" y1="516" x2="610" y2="516" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="540" y="506" font-family="Segoe UI, Arial, sans-serif" font-size="11">CRUD</text>
  ${store(620, 494, 280, 'D3  orders / order_items')}
  <line x1="370" y1="570" x2="370" y2="610" stroke="#222" stroke-width="1.4"/>
  <line x1="370" y1="610" x2="610" y2="610" stroke="#222" stroke-width="1.4" marker-end="url(#arrow)"/>
  <text x="400" y="600" font-family="Segoe UI, Arial, sans-serif" font-size="11">select menu</text>
  ${store(620, 588, 240, 'D2  menu_items')}
  <line x1="370" y1="610" x2="370" y2="670" stroke="#222" stroke-width="1.4"/>
  <line x1="370" y1="670" x2="610" y2="670" stroke="#222" stroke-width="1.4" marker-end="url(#arrow)"/>
  <text x="400" y="660" font-family="Segoe UI, Arial, sans-serif" font-size="11">select table</text>
  ${store(620, 648, 220, 'D4  tables')}

  <!-- 5.0 -->
  <line x1="101" y1="720" x2="210" y2="720" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="710" font-family="Segoe UI, Arial, sans-serif" font-size="11">Manage bookings</text>
  ${processBox(220, 694, 300, 52, '5.0', 'Table &amp; Reservation')}
  <line x1="170" y1="645" x2="170" y2="720" stroke="#222" stroke-width="1.5"/>
  <line x1="170" y1="720" x2="220" y2="720" stroke="#222" stroke-width="1.4"/>
  <text x="108" y="668" font-family="Segoe UI, Arial, sans-serif" font-size="11">Create booking</text>
  <line x1="520" y1="720" x2="610" y2="720" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="540" y="710" font-family="Segoe UI, Arial, sans-serif" font-size="11">CRUD</text>
  ${store(620, 698, 280, 'D4  tables / reservations')}

  <!-- 6.0 -->
  <line x1="101" y1="860" x2="210" y2="860" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="850" font-family="Segoe UI, Arial, sans-serif" font-size="11">View reports</text>
  ${processBox(220, 834, 300, 52, '6.0', 'Reports &amp; AI Forecast')}
  <line x1="101" y1="1120" x2="170" y2="1120" stroke="#222" stroke-width="1.4"/>
  <line x1="170" y1="1120" x2="170" y2="860" stroke="#222" stroke-width="1.4"/>
  <line x1="170" y1="860" x2="220" y2="860" stroke="#222" stroke-width="1.4" marker-end="url(#arrow)"/>
  <text x="178" y="990" font-family="Segoe UI, Arial, sans-serif" font-size="11">weather, FX</text>
  <line x1="520" y1="848" x2="610" y2="848" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="528" y="838" font-family="Segoe UI, Arial, sans-serif" font-size="11">read</text>
  ${store(620, 826, 240, 'D3  orders')}
  <line x1="520" y1="888" x2="610" y2="888" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="528" y="878" font-family="Segoe UI, Arial, sans-serif" font-size="11">read</text>
  ${store(620, 866, 240, 'D5  inventory / expenses')}

  <!-- 7.0 -->
  <line x1="101" y1="1020" x2="210" y2="1020" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="108" y="1010" font-family="Segoe UI, Arial, sans-serif" font-size="11">Trigger Backup</text>
  ${processBox(220, 994, 300, 52, '7.0', 'Backup &amp; Audit')}
  <line x1="520" y1="1020" x2="610" y2="1020" stroke="#222" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="528" y="1010" font-family="Segoe UI, Arial, sans-serif" font-size="11">log / export</text>
  ${store(620, 998, 240, 'D6  audit_logs')}
</svg>
`

writeFileSync(join(here, '4.5-dfd-level-0.svg'), svg, 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1800 }, background: '#ffffff' })
writeFileSync(join(here, '4.5-dfd-level-0.png'), resvg.render().asPng())
console.log('Wrote 4.5-dfd-level-0.png')
