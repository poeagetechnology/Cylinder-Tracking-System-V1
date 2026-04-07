import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../context/AuthContext'
import { addDocument } from '../../services/firestoreService'
import { AlertTriangle, Package, CheckCircle, XCircle, Clock, Plus, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import * as Yup from 'yup'
import toast from 'react-hot-toast'
import { fmtDate, fmtCurrency } from '../../utils/helpers'

const ALERT_THRESHOLD = 5

const purchaseSchema = Yup.object({
  cylinderId: Yup.string().required('Cylinder is required'),
  quantity: Yup.number().positive().required('Quantity is required'),
  supplier: Yup.string().required('Supplier is required'),
  cost: Yup.number().positive().required('Cost is required'),
  notes: Yup.string(),
})

const saleSchema = Yup.object({
  cylinderId: Yup.string().required('Cylinder is required'),
  customer: Yup.string().required('Customer is required'),
  quantity: Yup.number().positive().required('Quantity is required'),
  amount: Yup.number().positive().required('Amount is required'),
  notes: Yup.string(),
})

export const InventoryPage = () => {
  const { userProfile } = useAuth()
  const { data: cylinders, loading } = useFirestoreCollection('cylinders')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')
  const { data: purchases } = useFirestoreCollection('purchases')
  const { data: sales } = useFirestoreCollection('sales')
  const { data: customers } = useFirestoreCollection('customers')
  const { data: suppliers } = useFirestoreCollection('suppliers')

  const [tab, setTab] = useState('inventory')
  const [purchaseModal, setPurchaseModal] = useState(false)
  const [saleModal, setSaleModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const purchaseForm = useForm({
    resolver: yupResolver(purchaseSchema),
    defaultValues: { cylinderId: '', quantity: '1', supplier: '', cost: '', notes: '' },
  })

  const saleForm = useForm({
    resolver: yupResolver(saleSchema),
    defaultValues: { cylinderId: '', customer: '', quantity: '1', amount: '', notes: '' },
  })

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

  const { rows: invRows, search: invSearch, setSearch: setInvSearch, sortKey: invSortKey, sortDir: invSortDir, handleSort: handleInvSort, page: invPage, setPage: setInvPage, totalPages: invTotalPages, totalRows: invTotalRows } = useTable(
    inventoryByGas, ['gasName'], 10
  )

  const { rows: purchaseRows, search: purchaseSearch, setSearch: setPurchaseSearch, sortKey: purchaseSortKey, sortDir: purchaseSortDir, handleSort: handlePurchaseSort, page: purchasePage, setPage: setPurchasePage, totalPages: purchaseTotalPages, totalRows: purchaseTotalRows } = useTable(
    purchases, ['supplier', 'cylinderId'], 10
  )

  const { rows: saleRows, search: saleSearch, setSearch: setSaleSearch, sortKey: saleSortKey, sortDir: saleSortDir, handleSort: handleSaleSort, page: salePage, setPage: setSalePage, totalPages: saleTotalPages, totalRows: saleTotalRows } = useTable(
    sales, ['customer', 'cylinderId'], 10
  )

  const lowStockItems = inventoryByGas.filter((i) => i.alert && i.total > 0)
  const totalFull = cylinders.filter((c) => c.status === 'full').length
  const totalEmpty = cylinders.filter((c) => c.status === 'empty').length
  const totalInUse = cylinders.filter((c) => c.status === 'in_use').length

  const onPurchaseSubmit = async (data) => {
    setSaving(true)
    try {
      const cylinder = cylinders.find(c => c.id === data.cylinderId)
      await addDocument('purchases', {
        ...data,
        cylinderCode: cylinder?.cylinderCode || '',
        gasType: cylinder?.gasTypeName || '',
        quantity: parseInt(data.quantity),
        cost: parseFloat(data.cost),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })
      toast.success('Purchase recorded')
      setPurchaseModal(false)
      purchaseForm.reset()
    } catch (err) {
      toast.error('Failed to record purchase: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const onSaleSubmit = async (data) => {
    setSaving(true)
    try {
      const cylinder = cylinders.find(c => c.id === data.cylinderId)
      await addDocument('sales', {
        ...data,
        cylinderCode: cylinder?.cylinderCode || '',
        gasType: cylinder?.gasTypeName || '',
        quantity: parseInt(data.quantity),
        amount: parseFloat(data.amount),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })
      toast.success('Sale recorded')
      setSaleModal(false)
      saleForm.reset()
    } catch (err) {
      toast.error('Failed to record sale: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const invColumns = [
    { key: 'gasName', label: 'Gas Type', sortable: true },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'full', label: 'Full', render: (row) => <span className="text-green-600 font-semibold">{row.full}</span> },
    { key: 'empty', label: 'Empty', render: (row) => <span className="text-red-600 font-semibold">{row.empty}</span> },
    { key: 'in_use', label: 'In Use', render: (row) => <span className="text-yellow-600 font-semibold">{row.in_use}</span> },
    { key: 'maintenance', label: 'Maintenance', render: (row) => <span className="text-gray-500 font-semibold">{row.maintenance}</span> },
    { key: 'alert', label: 'Stock Alert', render: (row) => (
      row.alert && row.total > 0 ? (
        <span className="flex items-center gap-1 badge-red"><AlertTriangle className="h-3 w-3" /> Low Stock</span>
      ) : (
        <span className="flex items-center gap-1 badge-green"><CheckCircle className="h-3 w-3" /> OK</span>
      )
    )},
  ]

  const purchaseColumns = [
    { key: 'cylinderCode', label: 'Cylinder', sortable: true },
    { key: 'gasType', label: 'Gas Type' },
    { key: 'supplier', label: 'Supplier', sortable: true },
    { key: 'quantity', label: 'Qty' },
    { key: 'cost', label: 'Cost (₹)', render: (row) => fmtCurrency(row.cost) },
    { key: 'recordedBy', label: 'Recorded By' },
    { key: 'createdAt', label: 'Date', render: (row) => fmtDate(row.createdAt) },
  ]

  const saleColumns = [
    { key: 'cylinderCode', label: 'Cylinder', sortable: true },
    { key: 'gasType', label: 'Gas Type' },
    { key: 'customer', label: 'Customer', sortable: true },
    { key: 'quantity', label: 'Qty' },
    { key: 'amount', label: 'Amount (₹)', render: (row) => fmtCurrency(row.amount) },
    { key: 'recordedBy', label: 'Recorded By' },
    { key: 'createdAt', label: 'Date', render: (row) => fmtDate(row.createdAt) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track cylinders, purchases, and sales</p>
        </div>
        <div className="flex gap-2">
          {tab === 'purchase' && <button onClick={() => setPurchaseModal(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add Purchase</button>}
          {tab === 'sale' && <button onClick={() => setSaleModal(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add Sale</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'inventory', label: 'Inventory', icon: Package },
          { key: 'purchase', label: 'Purchase', icon: TrendingDown },
          { key: 'sale', label: 'Sale', icon: TrendingUp },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <>
          {lowStockItems.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-700 dark:text-red-400">Low Stock Alerts</h3>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">
                {lowStockItems.map((i) => i.gasName).join(', ')} have less than {ALERT_THRESHOLD} full cylinders
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Total Cylinders" value={cylinders.length} icon={Package} color="blue" />
            <StatCard title="Full" value={totalFull} icon={CheckCircle} color="green" />
            <StatCard title="Empty" value={totalEmpty} icon={XCircle} color="red" />
            <StatCard title="In Use" value={totalInUse} icon={Clock} color="yellow" />
          </div>

          <div className="card">
            <h2 className="section-title mb-4">By Gas Type</h2>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : (
              <Table
                columns={invColumns}
                rows={invRows}
                search={invSearch}
                onSearch={setInvSearch}
                sortKey={invSortKey}
                sortDir={invSortDir}
                onSort={handleInvSort}
                page={invPage}
                totalPages={invTotalPages}
                totalRows={invTotalRows}
                onPageChange={setInvPage}
                searchPlaceholder="Search gas type..."
                emptyMessage="No inventory data available"
              />
            )}
          </div>
        </>
      )}

      {tab === 'purchase' && (
        <div className="card">
          <Table
            columns={purchaseColumns}
            rows={purchaseRows}
            search={purchaseSearch}
            onSearch={setPurchaseSearch}
            sortKey={purchaseSortKey}
            sortDir={purchaseSortDir}
            onSort={handlePurchaseSort}
            page={purchasePage}
            totalPages={purchaseTotalPages}
            totalRows={purchaseTotalRows}
            onPageChange={setPurchasePage}
            searchPlaceholder="Search purchases..."
            emptyMessage="No purchase records found"
          />
        </div>
      )}

      {tab === 'sale' && (
        <div className="card">
          <Table
            columns={saleColumns}
            rows={saleRows}
            search={saleSearch}
            onSearch={setSaleSearch}
            sortKey={saleSortKey}
            sortDir={saleSortDir}
            onSort={handleSaleSort}
            page={salePage}
            totalPages={saleTotalPages}
            totalRows={saleTotalRows}
            onPageChange={setSalePage}
            searchPlaceholder="Search sales..."
            emptyMessage="No sales records found"
          />
        </div>
      )}

      {/* Purchase Modal */}
      <Modal isOpen={purchaseModal} onClose={() => setPurchaseModal(false)} title="Add Purchase">
        <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4">
          <FormField label="Cylinder" error={purchaseForm.formState.errors.cylinderId?.message} required>
            <Select register={purchaseForm.register('cylinderId')} error={purchaseForm.formState.errors.cylinderId}>
              <option value="">Select cylinder</option>
              {cylinders.map(c => <option key={c.id} value={c.id}>{c.cylinderCode} - {c.gasTypeName}</option>)}
            </Select>
          </FormField>
          <FormField label="Supplier" error={purchaseForm.formState.errors.supplier?.message} required>
            <Input register={purchaseForm.register('supplier')} error={purchaseForm.formState.errors.supplier} placeholder="Supplier name" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Quantity" error={purchaseForm.formState.errors.quantity?.message} required>
              <Input register={purchaseForm.register('quantity')} error={purchaseForm.formState.errors.quantity} type="number" min="1" placeholder="1" />
            </FormField>
            <FormField label="Cost (₹)" error={purchaseForm.formState.errors.cost?.message} required>
              <Input register={purchaseForm.register('cost')} error={purchaseForm.formState.errors.cost} type="number" min="0" step="0.01" placeholder="0.00" />
            </FormField>
          </div>
          <FormField label="Notes">
            <Input register={purchaseForm.register('notes')} placeholder="Optional notes" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPurchaseModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Sale Modal */}
      <Modal isOpen={saleModal} onClose={() => setSaleModal(false)} title="Add Sale">
        <form onSubmit={saleForm.handleSubmit(onSaleSubmit)} className="space-y-4">
          <FormField label="Cylinder" error={saleForm.formState.errors.cylinderId?.message} required>
            <Select register={saleForm.register('cylinderId')} error={saleForm.formState.errors.cylinderId}>
              <option value="">Select cylinder</option>
              {cylinders.map(c => <option key={c.id} value={c.id}>{c.cylinderCode} - {c.gasTypeName}</option>)}
            </Select>
          </FormField>
          <FormField label="Customer" error={saleForm.formState.errors.customer?.message} required>
            <Select register={saleForm.register('customer')} error={saleForm.formState.errors.customer}>
              <option value="">Select customer or enter name</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Quantity" error={saleForm.formState.errors.quantity?.message} required>
              <Input register={saleForm.register('quantity')} error={saleForm.formState.errors.quantity} type="number" min="1" placeholder="1" />
            </FormField>
            <FormField label="Amount (₹)" error={saleForm.formState.errors.amount?.message} required>
              <Input register={saleForm.register('amount')} error={saleForm.formState.errors.amount} type="number" min="0" step="0.01" placeholder="0.00" />
            </FormField>
          </div>
          <FormField label="Notes">
            <Input register={saleForm.register('notes')} placeholder="Optional notes" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSaleModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
