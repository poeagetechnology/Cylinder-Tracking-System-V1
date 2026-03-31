import { useFirestoreCollection } from '../../hooks/useFirestore'
import { AlertTriangle, Package, CheckCircle, XCircle, Clock } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Table } from '../../components/ui/Table'
import { useTable } from '../../hooks/useTable'

const ALERT_THRESHOLD = 5

export const InventoryPage = () => {
  const { data: cylinders, loading } = useFirestoreCollection('cylinders')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')

  // Group by gas type
  const inventoryByGas = gasTypes.map((gas) => {
    const gasCylinders = cylinders.filter((c) => c.gasTypeId === gas.id)
    return {
      id: gas.id,
      gasName: gas.gasName,
      total: gasCylinders.length,
      full: gasCylinders.filter((c) => c.status === 'full').length,
      empty: gasCylinders.filter((c) => c.status === 'empty').length,
      in_use: gasCylinders.filter((c) => c.status === 'in_use').length,
      maintenance: gasCylinders.filter((c) => c.status === 'maintenance').length,
      alert: gasCylinders.filter((c) => c.status === 'full').length < ALERT_THRESHOLD,
    }
  })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    inventoryByGas, ['gasName'], 10
  )

  const lowStockItems = inventoryByGas.filter((i) => i.alert && i.total > 0)

  const columns = [
    { key: 'gasName', label: 'Gas Type', sortable: true },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'full', label: 'Full', render: (row) => <span className="text-green-600 font-semibold">{row.full}</span> },
    { key: 'empty', label: 'Empty', render: (row) => <span className="text-red-600 font-semibold">{row.empty}</span> },
    { key: 'in_use', label: 'In Use', render: (row) => <span className="text-yellow-600 font-semibold">{row.in_use}</span> },
    { key: 'maintenance', label: 'Maintenance', render: (row) => <span className="text-gray-500 font-semibold">{row.maintenance}</span> },
    { key: 'alert', label: 'Stock Alert', render: (row) => (
      row.alert && row.total > 0 ? (
        <span className="flex items-center gap-1 badge-red">
          <AlertTriangle className="h-3 w-3" /> Low Stock
        </span>
      ) : (
        <span className="flex items-center gap-1 badge-green">
          <CheckCircle className="h-3 w-3" /> OK
        </span>
      )
    )},
  ]

  const totalFull = cylinders.filter((c) => c.status === 'full').length
  const totalEmpty = cylinders.filter((c) => c.status === 'empty').length
  const totalInUse = cylinders.filter((c) => c.status === 'in_use').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Inventory</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time cylinder inventory status</p>
      </div>

      {/* Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-700 dark:text-red-400">Low Stock Alerts</h3>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            The following gas types have fewer than {ALERT_THRESHOLD} full cylinders:{' '}
            <strong>{lowStockItems.map((i) => i.gasName).join(', ')}</strong>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Cylinders" value={cylinders.length} icon={Package} color="blue" />
        <StatCard title="Full Cylinders" value={totalFull} icon={CheckCircle} color="green" />
        <StatCard title="Empty Cylinders" value={totalEmpty} icon={XCircle} color="red" />
        <StatCard title="In Use" value={totalInUse} icon={Clock} color="yellow" />
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Inventory by Gas Type</h2>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
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
            searchPlaceholder="Search gas type..."
            emptyMessage="No inventory data. Add gas types and cylinders to get started."
          />
        )}
      </div>

      {/* All Cylinders Table */}
      <div className="card">
        <h2 className="section-title mb-4">All Cylinders</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="table-header">Code</th>
                <th className="table-header">Gas Type</th>
                <th className="table-header">Capacity</th>
                <th className="table-header">Status</th>
                <th className="table-header">Location</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {cylinders.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-mono text-sm">{c.cylinderCode}</td>
                  <td className="table-cell">{c.gasTypeName}</td>
                  <td className="table-cell">{c.capacity} kg</td>
                  <td className="table-cell"><Badge status={c.status} label={c.status?.replace('_', ' ')} /></td>
                  <td className="table-cell">{c.location}</td>
                </tr>
              ))}
              {cylinders.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No cylinders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
