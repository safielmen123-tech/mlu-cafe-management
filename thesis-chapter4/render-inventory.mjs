import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="980" height="1480" viewBox="0 0 980 1480">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#222"/>
    </marker>
  </defs>
  <rect width="980" height="1480" fill="#ffffff"/>
  <text x="490" y="48" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#222">Flowchart Inventory</text>
  <text x="490" y="76" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#555">Mlu Kitchen &amp; Cafe Siem Reap</text>

  <rect x="380" y="110" width="220" height="50" rx="25" fill="#d5e8d4" stroke="#82b366" stroke-width="2"/>
  <text x="490" y="142" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">Start</text>
  <line x1="490" y1="160" x2="490" y2="200" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="300" y="200" width="380" height="56" rx="4" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="234" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Open Inventory &amp; Stock</text>
  <line x1="490" y1="256" x2="490" y2="296" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="290,296 690,296 650,360 250,360" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="336" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Select item and Restock</text>
  <line x1="490" y1="360" x2="490" y2="404" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="270,404 710,404 670,468 230,468" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="444" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Enter amount to add or set stock</text>
  <line x1="490" y1="468" x2="490" y2="512" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="490,512 680,602 490,692 300,602" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="490" y="594" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Quantity valid</text>
  <text x="490" y="614" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">(0 or more)?</text>

  <line x1="300" y1="602" x2="140" y2="602" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="210" y="590" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="40" y="648" width="200" height="56" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="140" y="682" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Enter a valid quantity</text>
  <line x1="140" y1="648" x2="140" y2="436" stroke="#222" stroke-width="1.6"/>
  <line x1="140" y1="436" x2="270" y2="436" stroke="#222" stroke-width="1.6" marker-end="url(#arrow)"/>

  <line x1="490" y1="692" x2="490" y2="736" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="510" y="718" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <rect x="300" y="736" width="380" height="56" rx="4" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="770" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Find item in database</text>
  <line x1="490" y1="792" x2="490" y2="836" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="490,836 680,926 490,1016 300,926" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="490" y="922" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Item found?</text>

  <line x1="680" y1="926" x2="850" y2="926" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="760" y="914" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="750" y="968" width="200" height="56" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="850" y="1002" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Item not found</text>
  <line x1="850" y1="1024" x2="850" y2="1340" stroke="#222" stroke-width="1.6"/>
  <line x1="850" y1="1340" x2="490" y2="1340" stroke="#222" stroke-width="1.6"/>

  <line x1="490" y1="1016" x2="490" y2="1060" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="510" y="1042" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <rect x="250" y="1060" width="480" height="70" rx="4" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="1090" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Update stock quantity</text>
  <text x="490" y="1112" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Set status: In / Low / Very Low / Out</text>
  <line x1="490" y1="1130" x2="490" y2="1174" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="300" y="1174" width="380" height="56" rx="4" fill="#d5e8d4" stroke="#82b366" stroke-width="2"/>
  <text x="490" y="1208" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Show success message</text>
  <line x1="490" y1="1230" x2="490" y2="1340" stroke="#222" stroke-width="2"/>
  <line x1="490" y1="1340" x2="490" y2="1368" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="380" y="1368" width="220" height="50" rx="25" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="490" y="1400" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">End</text>
</svg>
`

writeFileSync(join(here, '4.12-flowchart-inventory.svg'), svg, 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1100 }, background: '#ffffff' })
writeFileSync(join(here, '4.12-flowchart-inventory.png'), resvg.render().asPng())
console.log('Wrote 4.12-flowchart-inventory.png')
