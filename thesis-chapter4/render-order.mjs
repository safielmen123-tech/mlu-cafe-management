import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1560" viewBox="0 0 900 1560">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#222"/>
    </marker>
  </defs>
  <rect width="900" height="1560" fill="#ffffff"/>
  <text x="450" y="48" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#222">Flowchart Order</text>
  <text x="450" y="76" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#555">Mlu Kitchen &amp; Cafe Siem Reap</text>

  <rect x="340" y="110" width="220" height="50" rx="25" fill="#d5e8d4" stroke="#82b366" stroke-width="2"/>
  <text x="450" y="142" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">Start</text>
  <line x1="450" y1="160" x2="450" y2="200" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="270,200 630,200 590,264 230,264" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="450" y="240" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Select Table or Take Out</text>
  <line x1="450" y1="264" x2="450" y2="308" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="270,308 630,308 590,372 230,372" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="450" y="348" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Add menu item to cart</text>
  <line x1="450" y1="372" x2="450" y2="416" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="450,416 640,506 450,596 260,506" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="450" y="498" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Cart has at least</text>
  <text x="450" y="518" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">one item?</text>

  <line x1="260" y1="506" x2="110" y2="506" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="175" y="494" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="20" y="552" width="180" height="56" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="110" y="586" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Add an item first</text>
  <line x1="110" y1="552" x2="110" y2="340" stroke="#222" stroke-width="1.6"/>
  <line x1="110" y1="340" x2="270" y2="340" stroke="#222" stroke-width="1.6" marker-end="url(#arrow)"/>

  <line x1="450" y1="596" x2="450" y2="640" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="470" y="622" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <rect x="250" y="640" width="400" height="56" rx="4" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="450" y="674" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Calculate total (tax = 0)</text>
  <line x1="450" y1="696" x2="450" y2="736" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="230" y="736" width="440" height="70" rx="4" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="450" y="766" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Save order as Pending</text>
  <text x="450" y="788" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">in database</text>
  <line x1="450" y1="806" x2="450" y2="850" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="450,850 640,940 450,1030 260,940" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="450" y="932" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Add more items?</text>

  <line x1="640" y1="940" x2="790" y2="940" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="710" y="928" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>
  <line x1="790" y1="940" x2="790" y2="340" stroke="#222" stroke-width="1.6"/>
  <line x1="790" y1="340" x2="630" y2="340" stroke="#222" stroke-width="1.6" marker-end="url(#arrow)"/>

  <line x1="450" y1="1030" x2="450" y2="1080" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="470" y="1060" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>

  <rect x="250" y="1080" width="400" height="70" rx="4" fill="#d5e8d4" stroke="#82b366" stroke-width="2"/>
  <text x="450" y="1110" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Order ready for payment</text>
  <text x="450" y="1132" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">(see Payment flowchart)</text>
  <line x1="450" y1="1150" x2="450" y2="1440" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="340" y="1440" width="220" height="50" rx="25" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="450" y="1472" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">End</text>
</svg>
`

writeFileSync(join(here, '4.9-flowchart-order.svg'), svg, 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1100 }, background: '#ffffff' })
writeFileSync(join(here, '4.9-flowchart-order.png'), resvg.render().asPng())
console.log('Wrote 4.9-flowchart-order.png')
