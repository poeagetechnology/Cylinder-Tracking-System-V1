import { useMemo, useState, useEffect } from 'react'
import { ArrowRight, CalendarRange, Download, FileSpreadsheet, FilterX, SearchX, TrendingUp, TrendingDown, BarChart3, Package, Users, FileJson, Receipt } from 'lucide-react'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { exportToCSV, exportToExcel, fmtDate, toDate, fmtCurrency } from '../../utils/helpers'
import { Loader } from '../../components/ui/Loader'

const REPORT_TYPES = [
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'sales', label: 'Sales Report', icon: BarChart3 },
  { id: 'expenses', label: 'Expenses', icon: TrendingDown },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'customers', label: 'Top Customers', icon: Users },
  { id: 'movements', label: 'Movements', icon: FileSpreadsheet },
]

const EMPTY_FILTERS = {
  dateFrom: '',
  dateTo: '',
  dccNumber: '',
  gasType: '',
  movementType: '',
  client: '',
  cylinderCode: '',
}

const MOVEMENT_TYPES = [
  { value: 'stock_in', label: 'Stock In' },
  { value: 'stock_out', label: 'Stock Out' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'filling', label: 'Filling In Progress' },
  { value: 'filled', label: 'Filled' },
]

const statusMovementMap = {
  full: { value: 'stock_in', label: 'Stock In' },
  empty: { value: 'stock_out', label: 'Stock Out' },
  in_use: { value: 'allocated', label: 'Allocated' },
  maintenance: { value: 'maintenance', label: 'Maintenance' },
}

const normalizeText = (value) => String(value ?? '').trim().toLowerCase()

const getDccNumber = (item) => item?.dccNumber || item?.dccNo || item?.dcNo || ''

const ReportField = ({ label, children }) => (
  <label className="block space-y-2">
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    {children}
  </label>
)

// Profit & Loss Component
const ProfitLossReport = ({ fillings, expenses, gasTypes }) => {
  const data = useMemo(() => {
    let totalSales = 0
    let totalCost = 0
    let totalExpenses = 0

    fillings.forEach((filling) => {
      const saleAmount = filling.saleAmount || filling.amount || 0
      totalSales += saleAmount
      totalCost += filling.costPrice || 0
    })

    expenses.forEach((exp) => {
      totalExpenses += exp.amount || 0
    })

    const grossProfit = totalSales - totalCost
    const netProfit = grossProfit - totalExpenses

    return {
      totalSales,
      totalCost,
      grossProfit,
      totalExpenses,
      netProfit,
      profitMargin: totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(2) : 0,
    }
  }, [fillings, expenses])

  const exportData = [
    { Metric: 'Total Sales', Amount: data.totalSales },
    { Metric: 'Cost of Goods Sold', Amount: data.totalCost },
    { Metric: 'Gross Profit', Amount: data.grossProfit },
    { Metric: 'Operating Expenses', Amount: data.totalExpenses },
    { Metric: 'Net Profit/Loss', Amount: data.netProfit },
    { Metric: 'Profit Margin (%)', Amount: data.profitMargin },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 dark:border-slate-700 dark:from-green-950/30 dark:to-emerald-950/30">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Sales</p>
          <p className="mt-2 text-3xl font-bold text-green-700 dark:text-green-400">{fmtCurrency(data.totalSales)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-red-50 to-pink-50 p-6 dark:border-slate-700 dark:from-red-950/30 dark:to-pink-950/30">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Expenses</p>
          <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">{fmtCurrency(data.totalExpenses)}</p>
        </div>
        <div className={`rounded-2xl border border-slate-200 p-6 dark:border-slate-700 ${data.netProfit >= 0 ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30' : 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30'}`}>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Net Profit/Loss</p>
          <p className={`mt-2 text-3xl font-bold ${data.netProfit >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
            {fmtCurrency(data.netProfit)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Financial Summary</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportToCSV(exportData, 'profit-loss-report')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => exportToExcel(exportData, 'profit-loss-report', 'P&L')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <FileJson className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-300">Total Sales</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtCurrency(data.totalSales)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-300">Cost of Goods Sold</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtCurrency(data.totalCost)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-300">Gross Profit</span>
            <span className="font-semibold text-green-700 dark:text-green-400">{fmtCurrency(data.grossProfit)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-300">Operating Expenses</span>
            <span className="font-semibold text-red-700 dark:text-red-400">{fmtCurrency(data.totalExpenses)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-300">Net Profit/Loss</span>
            <span className={`font-semibold ${data.netProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {fmtCurrency(data.netProfit)}
            </span>
          </div>
          <div className="flex justify-between pt-3">
            <span className="text-slate-700 dark:text-slate-300">Profit Margin</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{data.profitMargin}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sales Report Component — full customised view with filters, transactions table, breakdowns
const SalesReport = ({ salesRecords }) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterGasType, setFilterGasType] = useState('')

  // Derive filter options from data
  const customerOptions = useMemo(() => {
    const names = new Set(salesRecords.filter(s => s.status !== 'voided').map(s => s.customerName).filter(Boolean))
    return Array.from(names).sort()
  }, [salesRecords])

  const gasTypeOptions = useMemo(() => {
    const types = new Set()
    salesRecords.filter(s => s.status !== 'voided').forEach(s => {
      s.cylinders?.forEach(c => { if (c.gasType) types.add(c.gasType) })
    })
    return Array.from(types).sort()
  }, [salesRecords])

  const filteredSales = useMemo(() => {
    return salesRecords.filter(s => {
      if (s.status === 'voided') return false
      const saleDate = s.date || (s.createdAt ? s.createdAt.slice(0, 10) : '')
      if (dateFrom && saleDate && saleDate < dateFrom) return false
      if (dateTo && saleDate && saleDate > dateTo) return false
      if (filterCustomer && s.customerName !== filterCustomer) return false
      if (filterGasType) {
        if (!s.cylinders?.some(c => c.gasType === filterGasType)) return false
      }
      return true
    })
  }, [salesRecords, dateFrom, dateTo, filterCustomer, filterGasType])

  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.totalAmount || s.currentAmount || 0), 0)
    const totalPaid = filteredSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0)
    const totalBalance = filteredSales.reduce((sum, s) => sum + (s.balanceAmount || 0), 0)
    const totalCylinders = filteredSales.reduce((sum, s) => sum + (s.cylinders?.length || 0), 0)

    const byCustomer = {}
    const byGasType = {}
    filteredSales.forEach(sale => {
      const customer = sale.customerName || 'Unknown'
      const amount = sale.totalAmount || sale.currentAmount || 0
      if (!byCustomer[customer]) byCustomer[customer] = { amount: 0, count: 0 }
      byCustomer[customer].amount += amount
      byCustomer[customer].count += 1

      if (sale.cylinders?.length > 0) {
        const perCyl = amount / sale.cylinders.length
        sale.cylinders.forEach(c => {
          const gt = c.gasType || 'Unknown'
          byGasType[gt] = (byGasType[gt] || 0) + perCyl
        })
      }
    })

    return {
      totalRevenue, totalPaid, totalBalance, totalCylinders,
      byCustomer: Object.entries(byCustomer)
        .map(([name, v]) => ({ name, amount: v.amount, count: v.count }))
        .sort((a, b) => b.amount - a.amount),
      byGasType: Object.entries(byGasType)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    }
  }, [filteredSales])

  const exportDetailRows = filteredSales.map(s => ({
    Date: s.date || fmtDate(s.createdAt),
    'DC Number': s.dcNumber || '—',
    Customer: s.customerName || '—',
    Cylinders: s.cylinders?.map(c => c.cylinderCode).join(', ') || '—',
    'Gas Type': [...new Set((s.cylinders || []).map(c => c.gasType).filter(Boolean))].join(', ') || '—',
    'Cylinder Count': s.cylinders?.length || 0,
    'Amount (₹)': s.currentAmount || 0,
    'GST %': s.gst || 0,
    'GST Amount (₹)': s.gstAmount || 0,
    'Total (₹)': s.totalAmount || s.currentAmount || 0,
    'Paid (₹)': s.paidAmount || 0,
    'Balance (₹)': s.balanceAmount || 0,
    'Recorded By': s.recordedBy || '—',
  }))

  const hasActiveFilters = dateFrom || dateTo || filterCustomer || filterGasType
  const inputCls = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900'

  return (
    <div className="space-y-6">

      {/* Filter bar */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-300">
            <Receipt className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Filter Sales Report</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReportField label="Date From">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          </ReportField>
          <ReportField label="Date To">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </ReportField>
          <ReportField label="Customer">
            <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className={inputCls}>
              <option value="">All Customers</option>
              {customerOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </ReportField>
          <ReportField label="Gas Type">
            <select value={filterGasType} onChange={e => setFilterGasType(e.target.value)} className={inputCls}>
              <option value="">All Gas Types</option>
              {gasTypeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </ReportField>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setFilterCustomer(''); setFilterGasType('') }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <FilterX className="h-4 w-4" />
            Clear Filters
          </button>
        )}
      </section>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:border-slate-700 dark:from-blue-950/30 dark:to-indigo-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">{fmtCurrency(summary.totalRevenue)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 dark:border-slate-700 dark:from-green-950/30 dark:to-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount Paid</p>
          <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">{fmtCurrency(summary.totalPaid)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{summary.totalCylinders} cylinder unit{summary.totalCylinders !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-red-50 to-pink-50 p-5 dark:border-slate-700 dark:from-red-950/30 dark:to-pink-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outstanding Balance</p>
          <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">{fmtCurrency(summary.totalBalance)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:border-slate-700 dark:from-amber-950/30 dark:to-orange-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Sale Value</p>
          <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400">
            {fmtCurrency(filteredSales.length > 0 ? summary.totalRevenue / filteredSales.length : 0)}
          </p>
        </div>
      </div>

      {/* Transactions table */}
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Sales Transactions</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredSales.length} record{filteredSales.length !== 1 ? 's' : ''}
              {hasActiveFilters ? ' (filtered)' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportToCSV(exportDetailRows, 'sales-transactions')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={() => exportToExcel(exportDetailRows, 'sales-transactions', 'Sales')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <FileJson className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredSales.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  {['Date', 'DC Number', 'Customer', 'Cylinders', 'Gas Type', 'Amount', 'GST%', 'Total', 'Paid', 'Balance', 'By'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredSales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">{fmtDate(s.date || s.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{s.dcNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.customerName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300 whitespace-nowrap">
                      {s.cylinders?.map(c => c.cylinderCode).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300 whitespace-nowrap">
                      {[...new Set((s.cylinders || []).map(c => c.gasType).filter(Boolean))].join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">{fmtCurrency(s.currentAmount || 0)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300 whitespace-nowrap">{s.gst || 0}%</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{fmtCurrency(s.totalAmount || s.currentAmount || 0)}</td>
                    <td className="px-4 py-3 text-sm text-green-700 dark:text-green-400 whitespace-nowrap">{fmtCurrency(s.paidAmount || 0)}</td>
                    <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap" style={{ color: (s.balanceAmount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      {fmtCurrency(s.balanceAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 whitespace-nowrap">{s.recordedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No sales records match the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* By Customer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Sales by Customer</h3>
            <div className="flex gap-1">
              <button
                onClick={() => exportToCSV(summary.byCustomer.map(i => ({ Customer: i.name, Transactions: i.count, 'Total (₹)': i.amount })), 'sales-by-customer')}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >CSV</button>
              <button
                onClick={() => exportToExcel(summary.byCustomer.map(i => ({ Customer: i.name, Transactions: i.count, 'Total (₹)': i.amount })), 'sales-by-customer', 'By Customer')}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >XL</button>
            </div>
          </div>
          {summary.byCustomer.length > 0 ? (
            <div className="space-y-3">
              {summary.byCustomer.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtCurrency(item.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      style={{ width: `${summary.totalRevenue > 0 ? (item.amount / summary.totalRevenue) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{item.count} transaction{item.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No data</p>
          )}
        </div>

        {/* By Gas Type */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Sales by Gas Type</h3>
            <div className="flex gap-1">
              <button
                onClick={() => exportToCSV(summary.byGasType.map(i => ({ 'Gas Type': i.name, 'Amount (₹)': i.amount })), 'sales-by-gas')}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >CSV</button>
              <button
                onClick={() => exportToExcel(summary.byGasType.map(i => ({ 'Gas Type': i.name, 'Amount (₹)': i.amount })), 'sales-by-gas', 'By Gas')}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >XL</button>
            </div>
          </div>
          {summary.byGasType.length > 0 ? (
            <div className="space-y-3">
              {summary.byGasType.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtCurrency(item.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                      style={{ width: `${summary.totalRevenue > 0 ? (item.amount / summary.totalRevenue) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No data</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Expenses Report Component
const ExpensesReport = ({ expenses }) => {
  const data = useMemo(() => {
    const expensesByCategory = {}
    let totalExpenses = 0

    expenses.forEach((exp) => {
      const category = exp.category || 'Other'
      const amount = exp.amount || 0
      expensesByCategory[category] = (expensesByCategory[category] || 0) + amount
      totalExpenses += amount
    })

    return {
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
      totalExpenses,
      averageExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
      highestCategory: Object.entries(expensesByCategory).length > 0 ? 
        Object.entries(expensesByCategory).reduce((a, b) => a[1] > b[1] ? a : b)[0] : 'None',
    }
  }, [expenses])

  const exportData = data.expensesByCategory.map((item) => ({
    Category: item.name,
    Amount: item.amount,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-red-50 to-pink-50 p-6 dark:border-slate-700 dark:from-red-950/30 dark:to-pink-950/30">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Expenses</p>
          <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">{fmtCurrency(data.totalExpenses)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 to-yellow-50 p-6 dark:border-slate-700 dark:from-orange-950/30 dark:to-yellow-950/30">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No. of Expenses</p>
          <p className="mt-2 text-3xl font-bold text-orange-700 dark:text-orange-400">{expenses.length || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-6 dark:border-slate-700 dark:from-yellow-950/30 dark:to-amber-950/30">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Average Expense</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700 dark:text-yellow-400">{fmtCurrency(data.averageExpense)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Expenses by Category</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportToCSV(exportData, 'expenses-report')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => exportToExcel(exportData, 'expenses-report', 'Expenses')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <FileJson className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {data.expensesByCategory.length > 0 ? (
            data.expensesByCategory.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtCurrency(item.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-pink-500"
                    style={{ width: `${(item.amount / data.totalExpenses) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No expense data</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Inventory Report Component
const InventoryReport = ({ cylinders }) => {
  const data = useMemo(() => {
    const statusMap = {}
    const gasTypeMap = {}

    cylinders.forEach((cyl) => {
      statusMap[cyl.status] = (statusMap[cyl.status] || 0) + 1
      const gasType = cyl.gasTypeName || 'Unknown'
      gasTypeMap[gasType] = (gasTypeMap[gasType] || 0) + 1
    })

    return {
      statusMap: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      gasTypeMap: Object.entries(gasTypeMap).map(([gasType, count]) => ({ gasType, count })),
      totalCylinders: cylinders.length,
    }
  }, [cylinders])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 dark:border-slate-700 dark:from-indigo-950/30 dark:to-blue-950/30">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Cylinders</p>
        <p className="mt-2 text-3xl font-bold text-indigo-700 dark:text-indigo-400">{data.totalCylinders}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cylinders by Status</h3>
          <div className="mt-6 space-y-4">
            {data.statusMap.length > 0 ? (
              data.statusMap.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between pb-2">
                    <span className="capitalize text-slate-700 dark:text-slate-300">{item.status}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      style={{ width: `${(item.count / data.totalCylinders) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 dark:text-slate-400">No inventory data</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Inventory by Gas Type</h3>
          <div className="mt-6 space-y-4">
            {data.gasTypeMap.length > 0 ? (
              data.gasTypeMap.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-slate-700 dark:text-slate-300">{item.gasType}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                      style={{ width: `${(item.count / data.totalCylinders) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 dark:text-slate-400">No inventory data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Top Customers Report Component
const TopCustomersReport = ({ fillings, customers }) => {
  const data = useMemo(() => {
    const customerStats = {}

    fillings.forEach((filling) => {
      const customer = filling.clientName || filling.customerName || 'Unknown'
      if (!customerStats[customer]) {
        customerStats[customer] = { sales: 0, transactions: 0, lastSale: null }
      }
      customerStats[customer].sales += filling.saleAmount || filling.amount || 0
      customerStats[customer].transactions += 1
      const fillingDate = toDate(filling.endedAt || filling.startedAt)
      if (!customerStats[customer].lastSale || fillingDate > customerStats[customer].lastSale) {
        customerStats[customer].lastSale = fillingDate
      }
    })

    return Object.entries(customerStats)
      .map(([name, stats]) => ({
        name,
        ...stats,
        avgSale: stats.transactions > 0 ? stats.sales / stats.transactions : 0,
      }))
      .sort((a, b) => b.sales - a.sales)
  }, [fillings, customers])

  const exportData = data.map((item) => ({
    Customer: item.name,
    'Total Sales': item.sales,
    Transactions: item.transactions,
    'Average Sale': item.avgSale,
    'Last Sale': item.lastSale ? fmtDate(item.lastSale, 'yyyy-MM-dd') : '—',
  }))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Top Customers</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportToCSV(exportData, 'top-customers')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => exportToExcel(exportData, 'top-customers', 'Customers')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <FileJson className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Customer
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Total Sales
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Transactions
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Avg Sale
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Last Sale
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.length > 0 ? (
              data.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{fmtCurrency(item.sales)}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{item.transactions}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{fmtCurrency(item.avgSale)}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                    {item.lastSale ? fmtDate(item.lastSale, 'dd MMM yyyy') : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No customer data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const ReportsPage = () => {
  const [activeReport, setActiveReport] = useState('profit-loss')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [customerFilters, setCustomerFilters] = useState({ selectedCustomers: [] })
  const [customerHasGenerated, setCustomerHasGenerated] = useState(false)

  const { data: cylinders, loading: cylindersLoading } = useFirestoreCollection('cylinders')
  const { data: fillings, loading: fillingsLoading } = useFirestoreCollection('fillings')
  const { data: salesRecords, loading: salesLoading } = useFirestoreCollection('sales')
  const { data: customers, loading: customersLoading } = useFirestoreCollection('customers')
  const { data: gasTypes, loading: gasTypesLoading } = useFirestoreCollection('gasTypes')
  const { data: expenses, loading: expensesLoading } = useFirestoreCollection('expenses')

  const loading = cylindersLoading || fillingsLoading || salesLoading || customersLoading || gasTypesLoading || expensesLoading

  const records = useMemo(() => {
    const cylinderEvents = cylinders.map((cylinder) => {
      const movement = statusMovementMap[cylinder.status] || { value: 'stock_in', label: 'Stock In' }

      return {
        id: `cylinder-${cylinder.id}`,
        eventDate: toDate(cylinder.createdAt),
        dateLabel: fmtDate(cylinder.createdAt, 'dd MMM yyyy'),
        dccNumber: getDccNumber(cylinder),
        gasType: cylinder.gasTypeName || gasTypes.find((gas) => gas.id === cylinder.gasTypeId)?.gasName || 'Unknown',
        movementType: movement.value,
        movementLabel: movement.label,
        client: cylinder.client || cylinder.clientName || cylinder.customerName || (cylinder.location === 'Customer Site' ? 'Customer Site' : ''),
        cylinderCode: cylinder.cylinderCode || 'Unknown',
        capacity: cylinder.capacity ? `${cylinder.capacity} kg` : '—',
        status: cylinder.status ? cylinder.status.replace('_', ' ') : '—',
        source: 'Cylinder Register',
      }
    })

    const fillingEvents = fillings.map((filling) => {
      const isCompleted = filling.status === 'completed'

      return {
        id: `filling-${filling.id}`,
        eventDate: toDate(filling.endedAt || filling.startedAt),
        dateLabel: fmtDate(filling.endedAt || filling.startedAt, 'dd MMM yyyy'),
        dccNumber: getDccNumber(filling),
        gasType: filling.gasTypeName || 'Unknown',
        movementType: isCompleted ? 'filled' : 'filling',
        movementLabel: isCompleted ? 'Filled' : 'Filling In Progress',
        client: filling.clientName || filling.customerName || '',
        cylinderCode: filling.cylinderCode || 'Unknown',
        capacity: filling.capacity ? `${filling.capacity} kg` : '—',
        status: isCompleted ? 'Completed' : 'In Progress',
        source: 'Filling Session',
      }
    })

    return [...cylinderEvents, ...fillingEvents].sort((left, right) => {
      const leftTime = left.eventDate?.getTime?.() || 0
      const rightTime = right.eventDate?.getTime?.() || 0
      return rightTime - leftTime
    })
  }, [cylinders, fillings, gasTypes])

  const gasTypeOptions = useMemo(() => {
    const values = new Set()

    gasTypes.forEach((gas) => {
      if (gas.gasName) values.add(gas.gasName)
    })

    records.forEach((record) => {
      if (record.gasType && record.gasType !== 'Unknown') values.add(record.gasType)
    })

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [gasTypes, records])

  const clientOptions = useMemo(() => {
    const values = new Set()

    customers.forEach((customer) => {
      if (customer.name) values.add(customer.name)
    })

    records.forEach((record) => {
      if (record.client) values.add(record.client)
    })

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [customers, records])

  const cylinderOptions = useMemo(() => {
    const values = new Set()

    cylinders.forEach((cylinder) => {
      if (cylinder.cylinderCode) values.add(cylinder.cylinderCode)
    })

    records.forEach((record) => {
      if (record.cylinderCode && record.cylinderCode !== 'Unknown') values.add(record.cylinderCode)
    })

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [cylinders, records])

  // Set default customer and cylinder when movements report is activated
  useEffect(() => {
    if (activeReport === 'movements') {
      setFilters((current) => ({
        ...current,
        client: '',
        cylinderCode: '',
      }))
    }
  }, [activeReport])

  const filteredRecords = useMemo(() => {
    if (!hasGenerated || activeReport !== 'movements') return []

    return records.filter((record) => {
      const recordDate = record.eventDate
      const fromDate = appliedFilters.dateFrom ? new Date(`${appliedFilters.dateFrom}T00:00:00`) : null
      const toDateFilter = appliedFilters.dateTo ? new Date(`${appliedFilters.dateTo}T23:59:59`) : null

      if (fromDate && recordDate && recordDate < fromDate) return false
      if (toDateFilter && recordDate && recordDate > toDateFilter) return false
      if (appliedFilters.dateFrom && !recordDate) return false
      if (appliedFilters.dateTo && !recordDate) return false

      if (appliedFilters.dccNumber && !normalizeText(record.dccNumber).includes(normalizeText(appliedFilters.dccNumber))) {
        return false
      }

      if (appliedFilters.gasType && appliedFilters.gasType !== 'all' && record.gasType !== appliedFilters.gasType) return false
      if (appliedFilters.movementType && appliedFilters.movementType !== 'all' && record.movementType !== appliedFilters.movementType) return false
      if (appliedFilters.client && appliedFilters.client !== 'all' && record.client !== appliedFilters.client) return false
      if (appliedFilters.cylinderCode && appliedFilters.cylinderCode !== 'all' && record.cylinderCode !== appliedFilters.cylinderCode) return false

      return true
    })
  }, [appliedFilters, hasGenerated, records, activeReport])

  const exportRows = useMemo(() => {
    return filteredRecords.map((record) => ({
      Date: record.dateLabel,
      'DCC Number': record.dccNumber || '—',
      'Gas Type': record.gasType,
      'Movement Type': record.movementLabel,
      Customer: record.client || '—',
      Cylinder: record.cylinderCode,
      Capacity: record.capacity,
      Status: record.status,
      Source: record.source,
    }))
  }, [filteredRecords])

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length

  const handleFilterChange = (key) => (event) => {
    const value = event.target.value
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const handleGenerateMovements = () => {
    setAppliedFilters(filters)
    setHasGenerated(true)
  }

  const handleClearMovements = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setHasGenerated(false)
  }

  const handleSelectAllCustomers = () => {
    if (customerFilters.selectedCustomers.length === clientOptions.length) {
      setCustomerFilters({ selectedCustomers: [] })
    } else {
      setCustomerFilters({ selectedCustomers: [...clientOptions] })
    }
  }

  const handleCustomerCheckboxChange = (customer) => {
    setCustomerFilters((current) => {
      const isSelected = current.selectedCustomers.includes(customer)
      return {
        selectedCustomers: isSelected
          ? current.selectedCustomers.filter((c) => c !== customer)
          : [...current.selectedCustomers, customer],
      }
    })
  }

  const handleGenerateCustomers = () => {
    setCustomerHasGenerated(true)
  }

  const handleClearCustomers = () => {
    setCustomerFilters({ selectedCustomers: [] })
    setCustomerHasGenerated(false)
  }

  const renderEmptyState = (title, description) => (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-300 dark:bg-slate-700/70 dark:text-slate-500">
        <SearchX className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      <p className="mt-3 max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  )

  if (loading) {
    return <Loader fullScreen />
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View detailed business analytics and reports.</p>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:gap-3 md:p-3">
        {REPORT_TYPES.map((report) => {
          const Icon = report.icon
          const isActive = activeReport === report.id
          return (
            <button
              key={report.id}
              onClick={() => {
                setActiveReport(report.id)
                setHasGenerated(false)
                setCustomerHasGenerated(false)
              }}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 font-medium transition ${
                isActive
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{report.label}</span>
            </button>
          )
        })}
      </div>

      {/* Customer Report Filters */}
      {activeReport === 'customers' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 dark:bg-purple-500/10 dark:text-purple-300">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Top Customers Filter</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Select customers to view their detailed reports.</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select Customers</label>
              <button
                onClick={handleSelectAllCustomers}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {customerFilters.selectedCustomers.length === clientOptions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
              {clientOptions.length > 0 ? (
                clientOptions.map((customer) => (
                  <label key={customer} className="flex items-center gap-3 cursor-pointer hover:bg-white dark:hover:bg-slate-800 p-2 rounded transition">
                    <input
                      type="checkbox"
                      checked={customerFilters.selectedCustomers.includes(customer)}
                      onChange={() => handleCustomerCheckboxChange(customer)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{customer}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No customers available</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateCustomers}
              disabled={customerFilters.selectedCustomers.length === 0}
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              Generate Report
            </button>
            <button
              onClick={handleClearCustomers}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <FilterX className="h-4 w-4" />
              Clear Filters
            </button>
          </div>
        </section>
      )}

      {/* Movement Report Filters */}
      {activeReport === 'movements' && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Stock Movement Report</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Filter stock movements and export data.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ReportField label="Date Range">
              <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 shadow-sm transition-colors focus-within:border-primary-500 focus-within:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:focus-within:bg-slate-900">
                <CalendarRange className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={handleFilterChange('dateFrom')}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200"
                />
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={handleFilterChange('dateTo')}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200"
                />
              </div>
            </ReportField>

            <ReportField label="DCC Number">
              <input
                type="text"
                value={filters.dccNumber}
                onChange={handleFilterChange('dccNumber')}
                placeholder="Enter DCC number"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900"
              />
            </ReportField>

            <ReportField label="Gas Type">
              <select
                value={filters.gasType}
                onChange={handleFilterChange('gasType')}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900"
              >
                <option value="">Select gas type</option>
                <option value="all">All Gas Types</option>
                {gasTypeOptions.map((gasType) => (
                  <option key={gasType} value={gasType}>{gasType}</option>
                ))}
              </select>
            </ReportField>

            <ReportField label="Movement Type">
              <select
                value={filters.movementType}
                onChange={handleFilterChange('movementType')}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900"
              >
                <option value="">Select type</option>
                <option value="all">All Movement Types</option>
                {MOVEMENT_TYPES.map((movement) => (
                  <option key={movement.value} value={movement.value}>{movement.label}</option>
                ))}
              </select>
            </ReportField>

            <ReportField label="Customer">
              <select
                value={filters.client}
                onChange={handleFilterChange('client')}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900"
              >
                <option value="">Select Customer</option>
                <option value="all">All Customers</option>
                {clientOptions.map((client) => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            </ReportField>

            <ReportField label="Cylinder">
              <select
                value={filters.cylinderCode}
                onChange={handleFilterChange('cylinderCode')}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900"
              >
                <option value="">Select cylinder</option>
                <option value="all">All Cylinders</option>
                {cylinderOptions.map((cylinderCode) => (
                  <option key={cylinderCode} value={cylinderCode}>{cylinderCode}</option>
                ))}
              </select>
            </ReportField>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleGenerateMovements}
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              Generate Report
            </button>
            <button
              onClick={handleClearMovements}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <FilterX className="h-4 w-4" />
              Clear Filters
            </button>
          </div>
        </section>
      )}

      {/* Report Content */}
      <section className="space-y-6">
        {activeReport === 'profit-loss' && <ProfitLossReport fillings={fillings} expenses={expenses} gasTypes={gasTypes} />}
        {activeReport === 'sales' && <SalesReport salesRecords={salesRecords} />}
        {activeReport === 'expenses' && <ExpensesReport expenses={expenses} />}
        {activeReport === 'inventory' && <InventoryReport cylinders={cylinders} />}
        {activeReport === 'customers' && (
          <>
            {!customerHasGenerated ? (
              <TopCustomersReport fillings={fillings} customers={customers} />
            ) : (
              <TopCustomersReport 
                fillings={fillings.filter((f) => {
                  const customer = f.clientName || f.customerName || 'Unknown'
                  return customerFilters.selectedCustomers.includes(customer)
                })} 
                customers={customers} 
              />
            )}
          </>
        )}

        {/* Movements Report */}
        {activeReport === 'movements' && (
          <>
            {!hasGenerated && renderEmptyState(
              'Apply filters to generate report',
              'Use the filters above to search for stock movements.'
            )}

            {hasGenerated && filteredRecords.length === 0 && renderEmptyState(
              'No matching stock movements',
              'Try a wider date range or clear some filters to find report data.'
            )}

            {hasGenerated && filteredRecords.length > 0 && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-6">
                <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Generated Report</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {filteredRecords.length} movement record{filteredRecords.length === 1 ? '' : 's'} found
                      {activeFilterCount > 0 ? ` using ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : ''}.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => exportToCSV(exportRows, 'stock-report')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => exportToExcel(exportRows, 'stock-report', 'Movements')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
                    >
                      <FileJson className="h-4 w-4" />
                      Excel
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr>
                        {['Date', 'DCC Number', 'Gas Type', 'Movement Type', 'Customer', 'Cylinder', 'Capacity', 'Status', 'Source'].map((heading) => (
                          <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800">
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{record.dateLabel}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">{record.dccNumber || '—'}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{record.gasType}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{record.movementLabel}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">{record.client || '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{record.cylinderCode}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">{record.capacity}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">{record.status}</td>
                          <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-300">{record.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
