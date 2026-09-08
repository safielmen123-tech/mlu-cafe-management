import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="980" height="1780" viewBox="0 0 980 1780">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#222"/>
    </marker>
  </defs>
  <rect width="980" height="1780" fill="#ffffff"/>
  <text x="490" y="48" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#222">Flowchart Reservation</text>
  <text x="490" y="76" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#555">Mlu Kitchen &amp; Cafe Siem Reap</text>

  <rect x="380" y="110" width="220" height="50" rx="25" fill="#d5e8d4" stroke="#82b366" stroke-width="2"/>
  <text x="490" y="142" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">Start</text>
  <line x1="490" y1="160" x2="490" y2="200" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="280,200 700,200 660,280 240,280" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="236" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Enter name, phone, date,</text>
  <text x="490" y="256" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">time slot, table, guests</text>
  <line x1="490" y1="280" x2="490" y2="324" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <polygon points="490,324 680,414 490,504 300,414" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="490" y="406" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Required fields</text>
  <text x="490" y="426" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">filled?</text>

  <line x1="300" y1="414" x2="140" y2="414" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="210" y="402" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="40" y="460" width="200" height="56" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="140" y="494" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Fill required fields</text>
  <line x1="140" y1="460" x2="140" y2="240" stroke="#222" stroke-width="1.6"/>
  <line x1="140" y1="240" x2="280" y2="240" stroke="#222" stroke-width="1.6" marker-end="url(#arrow)"/>

  <line x1="490" y1="504" x2="490" y2="548" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="510" y="530" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <polygon points="490,548 700,638 490,728 280,638" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="490" y="626" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Cafe open that day?</text>
  <text x="490" y="646" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">(closed on Monday)</text>

  <line x1="700" y1="638" x2="850" y2="638" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="770" y="626" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="750" y="680" width="200" height="70" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="850" y="708" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Choose another date</text>
  <text x="850" y="728" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11">or time slot</text>
  <line x1="850" y1="680" x2="850" y2="240" stroke="#222" stroke-width="1.6"/>
  <line x1="850" y1="240" x2="700" y2="240" stroke="#222" stroke-width="1.6" marker-end="url(#arrow)"/>

  <line x1="490" y1="728" x2="490" y2="772" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="510" y="754" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <polygon points="490,772 700,862 490,952 280,862" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="490" y="850" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Table free at that</text>
  <text x="490" y="870" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">date and time?</text>

  <line x1="280" y1="862" x2="140" y2="862" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="200" y="850" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="40" y="900" width="200" height="56" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="140" y="934" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Table already booked</text>
  <line x1="140" y1="956" x2="140" y2="1640" stroke="#222" stroke-width="1.6"/>
  <line x1="140" y1="1640" x2="490" y2="1640" stroke="#222" stroke-width="1.6"/>

  <line x1="490" y1="952" x2="490" y2="996" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="510" y="978" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <polygon points="490,996 700,1086 490,1176 280,1086" fill="#fff2cc" stroke="#d6b656" stroke-width="2"/>
  <text x="490" y="1074" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">Guests within</text>
  <text x="490" y="1094" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13">table capacity?</text>

  <line x1="700" y1="1086" x2="850" y2="1086" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="770" y="1074" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#b85450">No</text>
  <rect x="750" y="1128" width="200" height="56" rx="4" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="850" y="1162" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12">Choose a bigger table</text>
  <line x1="850" y1="1184" x2="850" y2="1640" stroke="#222" stroke-width="1.6"/>
  <line x1="850" y1="1640" x2="490" y2="1640" stroke="#222" stroke-width="1.6"/>

  <line x1="490" y1="1176" x2="490" y2="1220" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="510" y="1202" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#2d6a32">Yes</text>

  <rect x="270" y="1220" width="440" height="56" rx="4" fill="#dae8fc" stroke="#6c8ebf" stroke-width="2"/>
  <text x="490" y="1254" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Save reservation (Confirmed)</text>
  <line x1="490" y1="1276" x2="490" y2="1316" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="270" y="1316" width="440" height="56" rx="4" fill="#d5e8d4" stroke="#82b366" stroke-width="2"/>
  <text x="490" y="1350" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14">Show success message</text>
  <line x1="490" y1="1372" x2="490" y2="1640" stroke="#222" stroke-width="2" marker-end="url(#arrow)"/>

  <rect x="380" y="1640" width="220" height="50" rx="25" fill="#f8cecc" stroke="#b85450" stroke-width="2"/>
  <text x="490" y="1672" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700">End</text>
</svg>
`

writeFileSync(join(here, '4.11-flowchart-reservation.svg'), svg, 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, background: '#ffffff' })
writeFileSync(join(here, '4.11-flowchart-reservation.png'), resvg.render().asPng())
console.log('Wrote 4.11-flowchart-reservation.png')
