const fs = require('fs')
const path = require('path')
const PDFDocument = require('pdfkit')
const { STORE } = require('../config/store')
const { formatGeneratedAt, pdfSafe } = require('./exportParams')

const COLORS = {
  forest: '#059669',
  forestDark: '#064e3b',
  headerBg: '#d1fae5',
  altRow: '#f0fdf4',
  totalBg: '#ecfdf5',
  text: '#1c1916',
  muted: '#57534e',
  line: '#a7f3d0',
  white: '#ffffff',
}

const LOGO_CANDIDATES = [
  path.join(__dirname, '../assets/logo-pdf.png'),
  path.join(__dirname, '../../../frontend/public/logo/logo.png'),
]
let logoBuffer = null
try {
  const logoPath = LOGO_CANDIDATES.find((candidate) => fs.existsSync(candidate))
  if (logoPath) logoBuffer = fs.readFileSync(logoPath)
} catch {
  logoBuffer = null
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function renderPdf(draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    draw(doc)

    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(index)
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      doc.text(
        `Page ${index + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - 28,
        {
          width: contentWidth(doc),
          align: 'right',
          lineBreak: false,
          height: 12,
        },
      )
    }
    doc.end()
  })
}

function drawDocumentHeader(doc, { title, periodLabel, generatedBy }) {
  const left = doc.page.margins.left
  const top = doc.page.margins.top
  let textX = left
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, left, top, { fit: [44, 44] })
      textX = left + 52
    } catch {
      textX = left
    }
  }

  const textWidth = doc.page.width - textX - doc.page.margins.right
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.forestDark)
  doc.text(pdfSafe(STORE.officialName), textX, top, { width: textWidth, lineBreak: false, height: 16 })
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.forest)
  doc.text(pdfSafe(title), textX, top + 16, { width: textWidth, lineBreak: false, height: 14 })
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
  doc.text(`Period: ${pdfSafe(periodLabel)}`, textX, top + 32, { width: textWidth, lineBreak: false, height: 12 })
  doc.text(
    `Generated: ${formatGeneratedAt()}    By: ${pdfSafe(generatedBy)}`,
    textX,
    top + 44,
    { width: textWidth, lineBreak: false, height: 12 },
  )

  const ruleY = top + 62
  doc.moveTo(left, ruleY).lineTo(doc.page.width - doc.page.margins.right, ruleY)
    .strokeColor(COLORS.forest)
    .lineWidth(1.25)
    .stroke()
  return ruleY + 14
}

function ensureSpace(doc, y, needed) {
  const limit = doc.page.height - 48
  if (y + needed <= limit) return y
  doc.addPage()
  return doc.page.margins.top
}

function drawSectionTitle(doc, y, title) {
  const nextY = ensureSpace(doc, y, 36)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.forestDark)
  doc.text(pdfSafe(title), doc.page.margins.left, nextY, {
    width: contentWidth(doc),
    lineBreak: false,
    height: 14,
  })
  return nextY + 18
}

function drawNote(doc, y, text) {
  const nextY = ensureSpace(doc, y, 28)
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
  doc.text(pdfSafe(text), doc.page.margins.left, nextY, {
    width: contentWidth(doc),
    height: 24,
  })
  return doc.y + 8
}

function drawTable(doc, startY, columns, rows) {
  const left = doc.page.margins.left
  const width = contentWidth(doc)
  const scale = width / columns.reduce((sum, column) => sum + column.width, 0)
  const sized = columns.map((column) => ({ ...column, width: column.width * scale }))
  const rowHeight = 16
  let y = startY

  const paintHeader = () => {
    y = ensureSpace(doc, y, rowHeight + 8)
    let x = left
    doc.save()
    doc.rect(left, y, width, rowHeight).fill(COLORS.headerBg)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.forestDark)
    for (const column of sized) {
      doc.text(column.label, x + 4, y + 4, {
        width: column.width - 8,
        align: column.align || 'left',
        lineBreak: false,
        height: 10,
      })
      x += column.width
    }
    doc.restore()
    y += rowHeight
  }

  paintHeader()

  if (!rows.length) {
    y = ensureSpace(doc, y, rowHeight)
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    doc.text('None', left + 4, y + 4, { width: width - 8, lineBreak: false, height: 10 })
    return y + rowHeight + 10
  }

  rows.forEach((row, index) => {
    if (y + rowHeight > doc.page.height - 48) {
      doc.addPage()
      y = doc.page.margins.top
      paintHeader()
    }
    const background = row.total ? COLORS.totalBg : (index % 2 === 1 ? COLORS.altRow : COLORS.white)
    doc.save()
    doc.rect(left, y, width, rowHeight).fill(background)
    doc.font(row.total ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLORS.text)
    let x = left
    sized.forEach((column, columnIndex) => {
      doc.text(pdfSafe(row.values[columnIndex]), x + 4, y + 4, {
        width: column.width - 8,
        align: column.align || 'left',
        lineBreak: false,
        height: 10,
      })
      x += column.width
    })
    doc.restore()
    y += rowHeight
  })

  return y + 12
}

module.exports = {
  COLORS,
  renderPdf,
  drawDocumentHeader,
  drawSectionTitle,
  drawNote,
  drawTable,
}
