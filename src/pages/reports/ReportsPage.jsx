import { useMemo, useState } from 'react'
import { ArrowRight, CalendarRange, Download, FileSpreadsheet, FilterX, SearchX } from 'lucide-react'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { exportToCSV, fmtDate, toDate } from '../../utils/helpers'
import { Loader } from '../../components/ui/Loader'

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

export const ReportsPage = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [hasGenerated, setHasGenerated] = useState(false)

  const { data: cylinders, loading: cylindersLoading } = useFirestoreCollection('cylinders')
  const { data: fillings, loading: fillingsLoading } = useFirestoreCollection('fillings')
  const { data: customers, loading: customersLoading } = useFirestoreCollection('customers')
  const { data: gasTypes, loading: gasTypesLoading } = useFirestoreCollection('gasTypes')

  const loading = cylindersLoading || fillingsLoading || customersLoading || gasTypesLoading

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

  const filteredRecords = useMemo(() => {
    if (!hasGenerated) return []

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

      if (appliedFilters.gasType && record.gasType !== appliedFilters.gasType) return false
      if (appliedFilters.movementType && record.movementType !== appliedFilters.movementType) return false
      if (appliedFilters.client && record.client !== appliedFilters.client) return false
      if (appliedFilters.cylinderCode && record.cylinderCode !== appliedFilters.cylinderCode) return false

      return true
    })
  }, [appliedFilters, hasGenerated, records])

  const exportRows = useMemo(() => {
    return filteredRecords.map((record) => ({
      Date: record.dateLabel,
      'DCC Number': record.dccNumber || '—',
      'Gas Type': record.gasType,
      'Movement Type': record.movementLabel,
      Client: record.client || '—',
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

  const handleGenerate = () => {
    setAppliedFilters(filters)
    setHasGenerated(true)
  }

  const handleClear = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setHasGenerated(false)
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
        <h1 className="page-title">Stock Report</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Filter movement records and export the generated report.</p>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-300">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Report Filters</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Use the filters below to search stock movements.</p>
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
              {MOVEMENT_TYPES.map((movement) => (
                <option key={movement.value} value={movement.value}>{movement.label}</option>
              ))}
            </select>
          </ReportField>

          <ReportField label="Client">
            <select
              value={filters.client}
              onChange={handleFilterChange('client')}
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-primary-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:bg-slate-900"
            >
              <option value="">Select client</option>
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
              {cylinderOptions.map((cylinderCode) => (
                <option key={cylinderCode} value={cylinderCode}>{cylinderCode}</option>
              ))}
            </select>
          </ReportField>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleGenerate}
            className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Generate Report
          </button>
          <button
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <FilterX className="h-4 w-4" />
            Clear Filters
          </button>
        </div>
      </section>

      {!hasGenerated && renderEmptyState(
        'Apply filters to generate report',
        'Use the filters above to search for stock movements.'
      )}

      {hasGenerated && filteredRecords.length === 0 && renderEmptyState(
        'No matching stock movements',
        'Try a wider date range or clear some filters to find report data.'
      )}

      {hasGenerated && filteredRecords.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:p-6">
          <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Generated Report</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filteredRecords.length} movement record{filteredRecords.length === 1 ? '' : 's'} found
                {activeFilterCount > 0 ? ` using ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : ''}.
              </p>
            </div>
            <button
              onClick={() => exportToCSV(exportRows, 'stock-report')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  {['Date', 'DCC Number', 'Gas Type', 'Movement Type', 'Client', 'Cylinder', 'Capacity', 'Status', 'Source'].map((heading) => (
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
        </section>
      )}
    </div>
  )
}
