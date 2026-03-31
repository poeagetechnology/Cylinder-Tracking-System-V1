import { useState, useMemo } from 'react'
import { Download, Filter } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { Table } from '../../components/ui/Table'
import { useTable } from '../../hooks/useTable'
import { fmtDate, fmtCurrency, exportToCSV } from '../../utils/helpers'

const REPORT_TYPES = [
  { key: 'cylinders', label: 'Cylinders Report' },
  { key: 'fillings', label: 'Filling Sessions' },
  { key: 'expenses', label: 'Expenses Report' },
  { key: 'customers', label: 'Customers Report' },
  { key: 'inventory', label: 'Inventory Summary' },
]

export const ReportsPage = () => {
  const [reportType, setReportType] = useState('cylinders')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: cylinders } = useFirestoreCollection('cylinders')
  const { data: fillings } = useFirestoreCollection('fillings')
  const { data: expenses } = useFirestoreCollection('expenses')
  const { data: customers } = useFirestoreCollection('customers')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')

  const filterByDate = (items, dateField = 'createdAt') => {
    return items.filter(item => {
      const d = item[dateField] || item.createdAt
      if (!d) return true
      const dateStr = typeof d === 'string' ? d : (d.seconds ? new Date(d.seconds * 1000).toISOString() : '')
      if (dateFrom && dateStr < dateFrom) return false
      if (dateTo && dateStr > dateTo + 'T23:59:59') return false
      return true
    })
  }

  const reportData = useMemo(() => {
    switch (reportType) {
      case 'cylinders': return filterByDate(cylinders).map(c => ({
        Code: c.cylinderCode, 'Gas Type': c.gasTypeName, 'Capacity (kg)': c.capacity,
        Status: c.status, Location: c.location, 'Added Date': fmtDate(c.createdAt)
      }))
      case 'fillings': return filterByDate(fillings, 'startedAt').map(f => ({
        'Cylinder Code': f.cylinderCode, 'Gas Type': f.gasTypeName, 'Capacity (kg)': f.capacity,
        'Started At': f.startedAt ? new Date(f.startedAt).toLocaleString() : '—',
        'Ended At': f.endedAt ? new Date(f.endedAt).toLocaleString() : '—',
        'Duration (min)': f.duration || '—', Status: f.status, 'Started By': f.startedBy
      }))
      case 'expenses': return filterByDate(expenses, 'date').map(e => ({
        Date: e.date, Category: e.category, Description: e.description, 'Amount (₹)': e.amount
      }))
      case 'customers': return filterByDate(customers).map(c => ({
        Name: c.name, Phone: c.phone, Email: c.email || '—', Address: c.address,
        'Added Date': fmtDate(c.createdAt)
      }))
      case 'inventory': return gasTypes.map(g => {
        const gasCylinders = cylinders.filter(c => c.gasTypeId === g.id)
        return {
          'Gas Type': g.gasName,
          Total: gasCylinders.length,
          Full: gasCylinders.filter(c => c.status === 'full').length,
          Empty: gasCylinders.filter(c => c.status === 'empty').length,
          'In Use': gasCylinders.filter(c => c.status === 'in_use').length,
          Maintenance: gasCylinders.filter(c => c.status === 'maintenance').length,
        }
      })
      default: return []
    }
  }, [reportType, cylinders, fillings, expenses, customers, gasTypes, dateFrom, dateTo])

  const columns = reportData.length > 0
    ? Object.keys(reportData[0]).map(k => ({ key: k, label: k, sortable: true }))
    : []

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    reportData, columns.map(c => c.key), 15
  )

  // Chart data for expenses trend
  const expenseTrend = useMemo(() => {
    const monthly = {}
    expenses.forEach(e => {
      const month = e.date?.slice(0, 7)
      if (month) monthly[month] = (monthly[month] || 0) + (e.amount || 0)
    })
    return Object.entries(monthly).sort().slice(-6).map(([month, amount]) => ({ month, amount }))
  }, [expenses])

  // Cylinder status summary for chart
  const cylinderChart = useMemo(() => {
    const statusMap = { full: 0, empty: 0, in_use: 0, maintenance: 0 }
    cylinders.forEach(c => { if (statusMap[c.status] !== undefined) statusMap[c.status]++ })
    return Object.entries(statusMap).map(([status, count]) => ({ status: status.replace('_', ' '), count }))
  }, [cylinders])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate and export business reports</p>
      </div>

      {/* Summary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title mb-4">Cylinder Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cylinderChart}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Cylinders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2 className="section-title mb-4">Monthly Expenses Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={expenseTrend}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmtCurrency(v)} />
              <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Controls */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Report Type */}
          <div className="flex-1">
            <label className="label">Report Type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              className="input-field"
            >
              {REPORT_TYPES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>

          {/* Date Filters */}
          <div>
            <label className="label">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
          </div>

          {/* Export */}
          <div className="flex items-end">
            <button
              onClick={() => exportToCSV(reportData, reportType)}
              disabled={reportData.length === 0}
              className="btn-success flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {reportData.length} record{reportData.length !== 1 ? 's' : ''} found
          </p>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>

        <Table
          columns={columns}
          rows={rows}
          search={search}
          onSearch={setSearch}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          onPageChange={setPage}
          searchPlaceholder="Search report..."
          emptyMessage="No data for the selected filters."
        />
      </div>
    </div>
  )
}
