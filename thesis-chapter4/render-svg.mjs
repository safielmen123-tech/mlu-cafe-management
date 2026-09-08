import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1180" viewBox="0 0 2000 1180">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#1f4e79"/>
    </marker>
    <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1f4e79" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="2000" height="1180" fill="#ffffff"/>
  <text x="1000" y="58" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" fill="#1f4e79">Context Diagram</text>
  <text x="1000" y="90" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#5a6a7a">Mlu Kitchen &amp; Cafe Siem Reap - Management System</text>

  <rect x="800" y="120" width="400" height="78" rx="2" fill="#dae8fc" stroke="#1f4e79" stroke-width="2" filter="url(#shadow)"/>
  <text x="1000" y="167" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#1f4e79">Administrator</text>

  <rect x="70" y="492" width="300" height="96" rx="2" fill="#dae8fc" stroke="#1f4e79" stroke-width="2" filter="url(#shadow)"/>
  <text x="220" y="532" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#1f4e79">Customer</text>
  <text x="220" y="556" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#3d5a73">no system account</text>

  <rect x="1630" y="480" width="300" height="120" rx="2" fill="#f8cecc" stroke="#b85450" stroke-width="2" filter="url(#shadow)"/>
  <text x="1780" y="522" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#1f4e79">External Services</text>
  <text x="1780" y="548" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#3d5a73">Email, Weather</text>
  <text x="1780" y="570" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#3d5a73">Exchange Rate</text>

  <rect x="800" y="980" width="400" height="78" rx="2" fill="#dae8fc" stroke="#1f4e79" stroke-width="2" filter="url(#shadow)"/>
  <text x="1000" y="1027" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#1f4e79">Staff</text>

  <circle cx="1000" cy="540" r="168" fill="#fff2cc" stroke="#d6b656" stroke-width="3" filter="url(#shadow)"/>
  <text x="1000" y="512" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#7a4f01">Cafe Management</text>
  <text x="1000" y="540" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#7a4f01">System</text>
  <text x="1000" y="572" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#7a4f01">Mlu Kitchen &amp; Cafe</text>
  <text x="1000" y="594" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#7a4f01">Siem Reap</text>

  <line x1="920" y1="198" x2="920" y2="385" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="1080" y1="385" x2="1080" y2="198" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="780" y="270" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">User accounts</text>
  <text x="780" y="290" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Permissions, backup</text>
  <text x="1220" y="270" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Reports, audit log</text>
  <text x="1220" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Backup file</text>

  <line x1="920" y1="980" x2="920" y2="705" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="1080" y1="705" x2="1080" y2="980" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="780" y="820" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Orders, payment</text>
  <text x="780" y="840" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Stock, reservations</text>
  <text x="1220" y="820" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Receipts, table status</text>
  <text x="1220" y="840" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Alerts, reports, forecast</text>

  <line x1="370" y1="510" x2="832" y2="510" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="832" y1="570" x2="370" y2="570" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="600" y="492" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Order / booking request</text>
  <text x="600" y="598" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Receipt / confirmation</text>

  <line x1="1630" y1="510" x2="1168" y2="510" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="1168" y1="570" x2="1630" y2="570" stroke="#1f4e79" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="1400" y="492" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Weather, exchange rate</text>
  <text x="1400" y="598" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#333333">Email (reset, reminder)</text>
</svg>
`

const svgPath = join(here, '4.4-context-diagram.svg')
const pngPath = join(here, '4.4-context-diagram.png')
writeFileSync(svgPath, svg, 'utf8')
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 2400 },
  background: '#ffffff',
})
writeFileSync(pngPath, resvg.render().asPng())
console.log('Wrote', svgPath)
console.log('Wrote', pngPath)
