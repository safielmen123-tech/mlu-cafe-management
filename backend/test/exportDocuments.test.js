const test = require('node:test')
const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')
const { parseReportMonth, parseReportSections } = require('../src/utils/exportParams')
const { buildSalesPdfBuffer } = require('../src/utils/salesPdf')
const { buildReportPdfBuffer, buildReportWorkbook } = require('../src/utils/reportExport')

test('report month accepts YYYY-MM and all, and rejects junk', () => {
  assert.equal(parseReportMonth('all').scope, 'all')
  assert.equal(parseReportMonth('2026-09').fileKey, '2026-09')
  assert.equal(parseReportMonth('2026-09').startDate, '2026-09-01')
  assert.equal(parseReportMonth('2026-09').endDate, '2026-10-01')
  assert.throws(() => parseReportMonth('2026-13'), /Invalid month/)
  assert.throws(() => parseReportMonth('September'), /Invalid month/)
  assert.throws(() => parseReportMonth(''), /Invalid month/)
})

test('report sections require a known selection', () => {
  assert.deepEqual(parseReportSections('spending,income,income'), ['income', 'spending'])
  assert.throws(() => parseReportSections(''), /at least one/)
  assert.throws(() => parseReportSections('payroll'), /Invalid report section/)
})

test('sales PDF is a real PDF buffer', async () => {
  const buffer = await buildSalesPdfBuffer({
    period: { scope: 'all', label: 'All Time' },
    generatedBy: 'admin',
    summary: {
      months: [{ monthKey: '2026-09', orders: 2, gross: 10, cash: 4, bank: 6, other: 0 }],
      totals: { orders: 2, gross: 10, cash: 4, bank: 6, other: 0 },
    },
  })
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
})

test('report workbook keeps numbers and only selected sheets', async () => {
  const data = {
    period: { scope: 'month', label: 'September 2026', fileKey: '2026-09' },
    summary: { revenue: 12.5, expenses: 2, profit: 10.5, orders: 3 },
    breakdownLabel: 'Daily breakdown',
    breakdown: [{ label: '2026-09-01', orders: 3, revenue: 12.5, expenses: 2, profit: 10.5 }],
    spending: [{ category: 'Payroll', amount: 2 }],
  }
  const raw = await buildReportWorkbook(data, ['income', 'monthly'])
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(raw)
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Summary', 'Daily'])
  const income = workbook.getWorksheet('Summary').getRow(2)
  assert.equal(income.getCell(1).value, 'Income')
  assert.equal(income.getCell(2).value, 12.5)
  assert.equal(income.getCell(2).numFmt, '$#,##0.00')

  const pdf = await buildReportPdfBuffer(data, ['spending'], 'admin')
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
})
