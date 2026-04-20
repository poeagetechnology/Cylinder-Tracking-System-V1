import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../context/AuthContext'
import { addDocument } from '../../services/firestoreService'
import { AlertTriangle, Package, CheckCircle, XCircle, Clock, Plus, ShoppingCart, TrendingUp, TrendingDown, Trash2, Search } from 'lucide-react'
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
  supplierName: Yup.string().required('Supplier name is required'),
  date: Yup.string().required('Date is required'),
  dcNumber: Yup.string().required('DC Number is required'),
  cylinders: Yup.array().min(1, 'Add at least one cylinder').of(
    Yup.object({
      cylinderId: Yup.string(),
    })
  ),
  currentAmount: Yup.number().typeError('Amount is required').positive('Amount must be positive').required('Current amount is required'),
  paidAmount: Yup.number().typeError('Paid amount is required').min(0, 'Paid amount cannot be negative').required('Paid amount is required'),
  gst: Yup.number().typeError('GST must be a number').min(0).max(100).nullable().optional(),
  notes: Yup.string(),
})

const saleSchema = Yup.object({
  customerName: Yup.string().required('Customer name is required'),
  date: Yup.string().required('Date is required'),
  dcNumber: Yup.string().required('DC Number is required'),
  cylinders: Yup.array().min(1, 'Add at least one cylinder').of(
    Yup.object({
      cylinderId: Yup.string(),
    })
  ),
  currentAmount: Yup.number().typeError('Amount is required').positive('Amount must be positive').required('Current amount is required'),
  paidAmount: Yup.number().typeError('Paid amount is required').min(0, 'Paid amount cannot be negative').required('Paid amount is required'),
  gst: Yup.number().typeError('GST must be a number').min(0).max(100).nullable().optional(),
  notes: Yup.string(),
})

const emptyReturnSchema = Yup.object({
  customerName: Yup.string().required('Customer name is required'),
  date: Yup.string().required('Date is required'),
  dcNumber: Yup.string().required('DC Number is required'),
  cylinders: Yup.array().min(1, 'Add at least one cylinder').of(
    Yup.object({
      cylinderId: Yup.string().required('Cylinder is required'),
    })
  ),
  notes: Yup.string(),
})

const loadReturnSchema = Yup.object({
  customerName: Yup.string().required('Customer name is required'),
  date: Yup.string().required('Date is required'),
  dcNumber: Yup.string().required('DC Number is required'),
  cylinders: Yup.array().min(1, 'Add at least one cylinder').of(
    Yup.object({
      cylinderId: Yup.string().required('Cylinder is required'),
    })
  ),
  faultDescription: Yup.string().required('Fault description is required'),
  notes: Yup.string(),
})

export const InventoryPage = () => {
  const { userProfile } = useAuth()
  const { data: cylinders, loading } = useFirestoreCollection('cylinders')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')
  const { data: purchases } = useFirestoreCollection('purchases')
  const { data: sales } = useFirestoreCollection('sales')
  const { data: emptyReturns } = useFirestoreCollection('emptyReturns')
  const { data: loadReturns } = useFirestoreCollection('loadReturns')
  const { data: customers } = useFirestoreCollection('customers')
  const { data: suppliers } = useFirestoreCollection('suppliers')

  const [tab, setTab] = useState('inventory')
  const [purchaseModal, setPurchaseModal] = useState(false)
  const [saleModal, setSaleModal] = useState(false)
  const [emptyReturnModal, setEmptyReturnModal] = useState(false)
  const [loadReturnModal, setLoadReturnModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cylinderSearch, setCylinderSearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const purchaseForm = useForm({
    resolver: yupResolver(purchaseSchema),
    defaultValues: {
      supplierName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }],
      currentAmount: '',
      paidAmount: '',
      gst: 0,
      notes: '',
    },
  })

  const saleForm = useForm({
    resolver: yupResolver(saleSchema),
    defaultValues: {
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }],
      currentAmount: '',
      paidAmount: '',
      gst: 0,
      notes: '',
    },
  })

  const emptyReturnForm = useForm({
    resolver: yupResolver(emptyReturnSchema),
    defaultValues: { 
      customerName: '', 
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }], 
      notes: '' 
    },
  })

  const loadReturnForm = useForm({
    resolver: yupResolver(loadReturnSchema),
    defaultValues: { 
      customerName: '', 
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }], 
      faultDescription: '', 
      notes: '' 
    },
  })

  // Get filtered cylinders
  const filteredCylindersForSearch = cylinderSearch
    ? cylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()))
    : []

  const filteredSuppliers = supplierSearch
    ? suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    : []

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : []

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

  const { rows: purchaseRows } = useTable(purchases, ['supplierName', 'dcNumber'], 10)
  const { rows: saleRows } = useTable(sales, ['customerName', 'dcNumber'], 10)
  
  // Flatten emptyReturns data - expand each return into multiple rows (one per cylinder)
  const flattenedEmptyReturns = emptyReturns.flatMap(record =>
    record.cylinders && record.cylinders.length > 0
      ? record.cylinders.map(cyl => ({
          id: `${record.id}-${cyl.cylinderId}`,
          cylinderCode: cyl.cylinderCode || '',
          gasType: cyl.gasType || '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          notes: record.notes,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }))
      : [{
          id: record.id,
          cylinderCode: '',
          gasType: '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          notes: record.notes,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }]
  )

  // Flatten loadReturns data - expand each return into multiple rows (one per cylinder)
  const flattenedLoadReturns = loadReturns.flatMap(record =>
    record.cylinders && record.cylinders.length > 0
      ? record.cylinders.map(cyl => ({
          id: `${record.id}-${cyl.cylinderId}`,
          cylinderCode: cyl.cylinderCode || '',
          gasType: cyl.gasType || '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          faultDescription: record.faultDescription,
          notes: record.notes,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }))
      : [{
          id: record.id,
          cylinderCode: '',
          gasType: '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          faultDescription: record.faultDescription,
          notes: record.notes,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }]
  )

  const { rows: emptyReturnRows } = useTable(flattenedEmptyReturns, ['cylinderCode'], 10)
  const { rows: loadReturnRows } = useTable(flattenedLoadReturns, ['cylinderCode'], 10)

  const lowStockItems = inventoryByGas.filter((i) => i.alert && i.total > 0)
  const totalFull = cylinders.filter((c) => c.status === 'full').length
  const totalEmpty = cylinders.filter((c) => c.status === 'empty').length
  const totalInUse = cylinders.filter((c) => c.status === 'in_use').length

  const onPurchaseSubmit = async (data) => {
    setSaving(true)
    try {
      // Filter out empty cylinder entries
      const validCylinders = data.cylinders.filter(c => c.cylinderId && c.cylinderId.trim() !== '')
      if (validCylinders.length === 0) {
        toast.error('Please select at least one cylinder')
        setSaving(false)
        return
      }
      
      const cylindersList = validCylinders.map(c => {
        const cylinder = cylinders.find(cy => cy.id === c.cylinderId)
        return {
          cylinderId: cylinder?.id,
          cylinderCode: cylinder?.cylinderCode || '',
          gasType: cylinder?.gasTypeName || '',
          capacity: cylinder?.capacity,
        }
      })

      const balanceAmount = data.currentAmount - data.paidAmount
      const gstAmount = (data.currentAmount * (data.gst || 0)) / 100

      await addDocument('purchases', {
        supplierName: data.supplierName,
        date: data.date,
        dcNumber: data.dcNumber,
        cylinders: cylindersList,
        currentAmount: parseFloat(data.currentAmount),
        paidAmount: parseFloat(data.paidAmount),
        balanceAmount: balanceAmount,
        gst: data.gst || 0,
        gstAmount: gstAmount,
        totalAmount: parseFloat(data.currentAmount) + gstAmount,
        notes: data.notes,
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })

      // Record OUT movement for cylinders
      cylindersList.forEach(async (c) => {
        await addDocument('movements', {
          cylinderId: c.cylinderId,
          cylinderCode: c.cylinderCode,
          type: 'OUT',
          reason: `Purchase - ${data.supplierName}`,
          reference: data.dcNumber,
          recordedBy: userProfile?.name || 'System',
          createdAt: new Date().toISOString(),
        })
      })

      toast.success('Purchase recorded')
      resetPurchaseModal()
    } catch (err) {
      toast.error('Failed to record purchase: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const onSaleSubmit = async (data) => {
    setSaving(true)
    try {
      // Filter out empty cylinder entries
      const validCylinders = data.cylinders.filter(c => c.cylinderId && c.cylinderId.trim() !== '')
      if (validCylinders.length === 0) {
        toast.error('Please select at least one cylinder')
        setSaving(false)
        return
      }
      
      const cylindersList = validCylinders.map(c => {
        const cylinder = cylinders.find(cy => cy.id === c.cylinderId)
        return {
          cylinderId: cylinder?.id,
          cylinderCode: cylinder?.cylinderCode || '',
          gasType: cylinder?.gasTypeName || '',
          capacity: cylinder?.capacity,
          status: cylinder?.status,
        }
      })

      // Check if all cylinders are full
      const allFull = cylindersList.every(c => c.status === 'full')
      if (!allFull) {
        toast.error('Sales can only be done with Full (Load) cylinders')
        setSaving(false)
        return
      }

      const balanceAmount = data.currentAmount - data.paidAmount
      const gstAmount = (data.currentAmount * (data.gst || 0)) / 100

      await addDocument('sales', {
        customerName: data.customerName,
        date: data.date,
        dcNumber: data.dcNumber,
        cylinders: cylindersList,
        currentAmount: parseFloat(data.currentAmount),
        paidAmount: parseFloat(data.paidAmount),
        balanceAmount: balanceAmount,
        gst: data.gst || 0,
        gstAmount: gstAmount,
        totalAmount: parseFloat(data.currentAmount) + gstAmount,
        notes: data.notes,
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })

      // Record OUT movement for cylinders
      cylindersList.forEach(async (c) => {
        await addDocument('movements', {
          cylinderId: c.cylinderId,
          cylinderCode: c.cylinderCode,
          type: 'OUT',
          reason: `Sales - ${data.customerName}`,
          reference: data.dcNumber,
          recordedBy: userProfile?.name || 'System',
          createdAt: new Date().toISOString(),
        })
      })

      toast.success('Sale recorded')
      resetSaleModal()
    } catch (err) {
      toast.error('Failed to record sale: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const onEmptyReturnSubmit = async (data) => {
    setSaving(true)
    try {
      // Filter out empty cylinder entries
      const validCylinders = data.cylinders.filter(c => c.cylinderId && c.cylinderId.trim() !== '')
      if (validCylinders.length === 0) {
        toast.error('Please select at least one cylinder')
        setSaving(false)
        return
      }
      
      const cylindersList = validCylinders.map(c => {
        const cylinder = cylinders.find(cy => cy.id === c.cylinderId)
        return {
          cylinderId: cylinder?.id,
          cylinderCode: cylinder?.cylinderCode || '',
          gasType: cylinder?.gasTypeName || '',
        }
      })

      await addDocument('emptyReturns', {
        customerName: data.customerName,
        date: data.date,
        dcNumber: data.dcNumber,
        cylinders: cylindersList,
        notes: data.notes,
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })

      // Record IN movement for each cylinder
      cylindersList.forEach(async (c) => {
        await addDocument('movements', {
          cylinderId: c.cylinderId,
          cylinderCode: c.cylinderCode,
          type: 'IN',
          reason: `Empty Return - ${data.customerName}`,
          reference: data.dcNumber,
          recordedBy: userProfile?.name || 'System',
          createdAt: new Date().toISOString(),
        })
      })

      toast.success('Empty cylinder return recorded')
      resetEmptyReturnModal()
    } catch (err) {
      toast.error('Failed to record empty return: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const onLoadReturnSubmit = async (data) => {
    setSaving(true)
    try {
      // Filter out empty cylinder entries
      const validCylinders = data.cylinders.filter(c => c.cylinderId && c.cylinderId.trim() !== '')
      if (validCylinders.length === 0) {
        toast.error('Please select at least one cylinder')
        setSaving(false)
        return
      }
      
      const cylindersList = validCylinders.map(c => {
        const cylinder = cylinders.find(cy => cy.id === c.cylinderId)
        return {
          cylinderId: cylinder?.id,
          cylinderCode: cylinder?.cylinderCode || '',
          gasType: cylinder?.gasTypeName || '',
          capacity: cylinder?.capacity,
        }
      })

      await addDocument('loadReturns', {
        customerName: data.customerName,
        date: data.date,
        dcNumber: data.dcNumber,
        cylinders: cylindersList,
        faultDescription: data.faultDescription,
        notes: data.notes,
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })

      toast.success('Load return (Fault cylinder) recorded')
      resetLoadReturnModal()
    } catch (err) {
      toast.error('Failed to record load return: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Get cylinders sold to a specific customer
  const getCustomerCylinders = (customerName) => {
    const customerSales = sales.filter(s => s.customerName === customerName)
    const soldCylinderIds = customerSales.flatMap(s => s.cylinders.map(c => c.cylinderId))
    return cylinders.filter(c => soldCylinderIds.includes(c.id))
  }

  // Reset functions
  const resetPurchaseModal = () => {
    setPurchaseModal(false)
    setCylinderSearch('')
    setSupplierSearch('')
    purchaseForm.reset({
      supplierName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }],
      currentAmount: '',
      paidAmount: '',
      gst: 0,
      notes: '',
    })
  }

  const resetSaleModal = () => {
    setSaleModal(false)
    setCylinderSearch('')
    setCustomerSearch('')
    saleForm.reset({
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }],
      currentAmount: '',
      paidAmount: '',
      gst: 0,
      notes: '',
    })
  }

  const resetEmptyReturnModal = () => {
    setEmptyReturnModal(false)
    setCustomerSearch('')
    setCylinderSearch('')
    emptyReturnForm.reset({
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }],
      notes: '',
    })
  }

  const resetLoadReturnModal = () => {
    setLoadReturnModal(false)
    setCustomerSearch('')
    setCylinderSearch('')
    loadReturnForm.reset({
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      cylinders: [{ cylinderId: '' }],
      faultDescription: '',
      notes: '',
    })
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
    { key: 'supplierName', label: 'Supplier', sortable: true },
    { key: 'date', label: 'Date', render: (row) => fmtDate(row.date) },
    { key: 'dcNumber', label: 'DC Number' },
    { key: 'currentAmount', label: 'Amount (₹)', render: (row) => fmtCurrency(row.currentAmount) },
    { key: 'paidAmount', label: 'Paid (₹)', render: (row) => fmtCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Balance (₹)', render: (row) => fmtCurrency(row.balanceAmount) },
    { key: 'gst', label: 'GST %' },
    { key: 'recordedBy', label: 'By' },
  ]

  const saleColumns = [
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'date', label: 'Date', render: (row) => fmtDate(row.date) },
    { key: 'dcNumber', label: 'DC Number' },
    { key: 'currentAmount', label: 'Amount (₹)', render: (row) => fmtCurrency(row.currentAmount) },
    { key: 'paidAmount', label: 'Paid (₹)', render: (row) => fmtCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Balance (₹)', render: (row) => fmtCurrency(row.balanceAmount) },
    { key: 'gst', label: 'GST %' },
    { key: 'recordedBy', label: 'By' },
  ]

  const emptyReturnColumns = [
    { key: 'cylinderCode', label: 'Cylinder Code' },
    { key: 'gasType', label: 'Gas Type' },
    { key: 'notes', label: 'Notes' },
    { key: 'recordedBy', label: 'By' },
    { key: 'createdAt', label: 'Date', render: (row) => fmtDate(row.createdAt) },
  ]

  const loadReturnColumns = [
    { key: 'cylinderCode', label: 'Cylinder Code' },
    { key: 'gasType', label: 'Gas Type' },
    { key: 'faultDescription', label: 'Fault Description' },
    { key: 'notes', label: 'Notes' },
    { key: 'recordedBy', label: 'By' },
    { key: 'createdAt', label: 'Date', render: (row) => fmtDate(row.createdAt) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage inventory, purchases, sales, and returns</p>
        </div>
        <div className="flex gap-2">
          {tab === 'purchase' && <button onClick={() => setPurchaseModal(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Purchase</button>}
          {tab === 'sales' && <button onClick={() => setSaleModal(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Sales</button>}
          {tab === 'empty_return' && <button onClick={() => setEmptyReturnModal(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Return</button>}
          {tab === 'load_return' && <button onClick={() => setLoadReturnModal(true)} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Return</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { key: 'inventory', label: 'Inventory', icon: Package },
          { key: 'purchase', label: 'Purchase', icon: TrendingDown },
          { key: 'sales', label: 'Sales', icon: TrendingUp },
          { key: 'empty_return', label: 'Empty Return', icon: XCircle },
          { key: 'load_return', label: 'Load Return', icon: AlertTriangle },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
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
            searchPlaceholder="Search purchases..."
            emptyMessage="No purchase records found"
          />
        </div>
      )}

      {tab === 'sales' && (
        <div className="card">
          <Table
            columns={saleColumns}
            rows={saleRows}
            searchPlaceholder="Search sales..."
            emptyMessage="No sales records found"
          />
        </div>
      )}

      {tab === 'empty_return' && (
        <div className="card">
          <Table
            columns={emptyReturnColumns}
            rows={emptyReturnRows}
            searchPlaceholder="Search returns..."
            emptyMessage="No empty returns recorded"
          />
        </div>
      )}

      {tab === 'load_return' && (
        <div className="card">
          <Table
            columns={loadReturnColumns}
            rows={loadReturnRows}
            searchPlaceholder="Search load returns..."
            emptyMessage="No load returns recorded"
          />
        </div>
      )}

      {/* Purchase Modal */}
      <Modal isOpen={purchaseModal} onClose={resetPurchaseModal} title="Purchase">
        <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4 max-h-96 overflow-y-auto">
          {/* Supplier Search */}
          <FormField label="Supplier Name" error={purchaseForm.formState.errors.supplierName?.message} required>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search or type supplier name..."
                value={purchaseForm.watch('supplierName') || supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value)
                  if (!e.target.value) purchaseForm.setValue('supplierName', '')
                }}
                className="input-field pl-10"
              />
              {(supplierSearch || purchaseForm.watch('supplierName')) && filteredSuppliers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                  {filteredSuppliers.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        purchaseForm.setValue('supplierName', s.name)
                        setSupplierSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        purchaseForm.watch('supplierName') === s.name
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      ✓ {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" error={purchaseForm.formState.errors.date?.message} required>
              <Input register={purchaseForm.register('date')} error={purchaseForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={purchaseForm.formState.errors.dcNumber?.message} required>
              <Input register={purchaseForm.register('dcNumber')} error={purchaseForm.formState.errors.dcNumber} placeholder="DC Number" />
            </FormField>
          </div>

          {/* Cylinders */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders (Multiple)</h3>
            {purchaseForm.watch('cylinders').map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              return (
                <div key={idx} className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search cylinder..."
                        value={selectedCylinder ? `${selectedCylinder.cylinderCode} — ${selectedCylinder.gasTypeName}` : cylinderSearch}
                        onChange={(e) => {
                          setCylinderSearch(e.target.value)
                          if (!e.target.value) purchaseForm.setValue(`cylinders.${idx}.cylinderId`, '')
                        }}
                        className="input-field pl-10 w-full"
                      />
                      {!selectedCylinder && (cylinderSearch || purchaseForm.watch(`cylinders.${idx}.cylinderId`)) && filteredCylindersForSearch.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {filteredCylindersForSearch.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                purchaseForm.setValue(`cylinders.${idx}.cylinderId`, c.id)
                                setCylinderSearch('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                            >
                              {c.cylinderCode} — {c.gasTypeName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {purchaseForm.watch('cylinders').length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const cyl = purchaseForm.watch('cylinders')
                        purchaseForm.setValue('cylinders', cyl.filter((_, i) => i !== idx))
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => {
                const cyl = purchaseForm.watch('cylinders')
                purchaseForm.setValue('cylinders', [...cyl, { cylinderId: '' }])
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-2"
            >
              + Add Cylinder
            </button>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Amount (₹)" error={purchaseForm.formState.errors.currentAmount?.message} required>
              <Input
                register={purchaseForm.register('currentAmount')}
                error={purchaseForm.formState.errors.currentAmount}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Paid (₹)" error={purchaseForm.formState.errors.paidAmount?.message} required>
              <Input
                register={purchaseForm.register('paidAmount')}
                error={purchaseForm.formState.errors.paidAmount}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Balance (₹)">
              <Input
                value={
                  purchaseForm.watch('currentAmount') && purchaseForm.watch('paidAmount')
                    ? (parseFloat(purchaseForm.watch('currentAmount')) - parseFloat(purchaseForm.watch('paidAmount'))).toFixed(2)
                    : '0.00'
                }
                disabled
                type="number"
              />
            </FormField>
          </div>

          <FormField label="GST %" error={purchaseForm.formState.errors.gst?.message}>
            <Input register={purchaseForm.register('gst')} type="number" min="0" max="100" step="0.01" placeholder="0" />
          </FormField>

          <FormField label="Notes">
            <Textarea register={purchaseForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={resetPurchaseModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Purchase'}</button>
          </div>
        </form>
      </Modal>

      {/* Sales Modal */}
      <Modal isOpen={saleModal} onClose={resetSaleModal} title="Sales">
        <form onSubmit={saleForm.handleSubmit(onSaleSubmit)} className="space-y-4 max-h-96 overflow-y-auto">
          {/* Customer Search */}
          <FormField label="Customer Name" error={saleForm.formState.errors.customerName?.message} required>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search or type customer name..."
                value={saleForm.watch('customerName') || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  if (!e.target.value) saleForm.setValue('customerName', '')
                }}
                className="input-field pl-10"
              />
              {(customerSearch || saleForm.watch('customerName')) && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        saleForm.setValue('customerName', c.name)
                        setCustomerSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        saleForm.watch('customerName') === c.name
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      ✓ {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" error={saleForm.formState.errors.date?.message} required>
              <Input register={saleForm.register('date')} error={saleForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={saleForm.formState.errors.dcNumber?.message} required>
              <Input register={saleForm.register('dcNumber')} error={saleForm.formState.errors.dcNumber} placeholder="DC Number" />
            </FormField>
          </div>

          {/* Cylinders - Full only */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders - Full (Load) Only (Multiple)</h3>
            {saleForm.watch('cylinders').map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              return (
                <div key={idx} className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search cylinder..."
                        value={selectedCylinder ? `${selectedCylinder.cylinderCode} — ${selectedCylinder.gasTypeName}` : cylinderSearch}
                        onChange={(e) => {
                          setCylinderSearch(e.target.value)
                          if (!e.target.value) saleForm.setValue(`cylinders.${idx}.cylinderId`, '')
                        }}
                        className="input-field pl-10 w-full"
                      />
                      {!selectedCylinder && (cylinderSearch || saleForm.watch(`cylinders.${idx}.cylinderId`)) && filteredCylindersForSearch.filter(c => c.status === 'full').length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {filteredCylindersForSearch.filter(c => c.status === 'full').map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                saleForm.setValue(`cylinders.${idx}.cylinderId`, c.id)
                                setCylinderSearch('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                            >
                              {c.cylinderCode} — {c.gasTypeName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {saleForm.watch('cylinders').length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const cyl = saleForm.watch('cylinders')
                        saleForm.setValue('cylinders', cyl.filter((_, i) => i !== idx))
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => {
                const cyl = saleForm.watch('cylinders')
                saleForm.setValue('cylinders', [...cyl, { cylinderId: '' }])
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-2"
            >
              + Add Cylinder
            </button>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Amount (₹)" error={saleForm.formState.errors.currentAmount?.message} required>
              <Input
                register={saleForm.register('currentAmount')}
                error={saleForm.formState.errors.currentAmount}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Paid (₹)" error={saleForm.formState.errors.paidAmount?.message} required>
              <Input
                register={saleForm.register('paidAmount')}
                error={saleForm.formState.errors.paidAmount}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Balance (₹)">
              <Input
                value={
                  saleForm.watch('currentAmount') && saleForm.watch('paidAmount')
                    ? (parseFloat(saleForm.watch('currentAmount')) - parseFloat(saleForm.watch('paidAmount'))).toFixed(2)
                    : '0.00'
                }
                disabled
                type="number"
              />
            </FormField>
          </div>

          <FormField label="GST %" error={saleForm.formState.errors.gst?.message}>
            <Input register={saleForm.register('gst')} type="number" min="0" max="100" step="0.01" placeholder="0" />
          </FormField>

          <FormField label="Notes">
            <Textarea register={saleForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={resetSaleModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Sale'}</button>
          </div>
        </form>
      </Modal>

      {/* Empty Return Modal */}
      <Modal isOpen={emptyReturnModal} onClose={resetEmptyReturnModal} title="Empty Return">
        <form onSubmit={emptyReturnForm.handleSubmit(onEmptyReturnSubmit)} className="space-y-4 max-h-96 overflow-y-auto">
          {/* Customer Search */}
          <FormField label="Customer Name" error={emptyReturnForm.formState.errors.customerName?.message} required>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search or type customer name..."
                value={emptyReturnForm.watch('customerName') || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  if (!e.target.value) emptyReturnForm.setValue('customerName', '')
                }}
                className="input-field pl-10"
              />
              {(customerSearch || emptyReturnForm.watch('customerName')) && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        emptyReturnForm.setValue('customerName', c.name)
                        setCustomerSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        emptyReturnForm.watch('customerName') === c.name
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      ✓ {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input {...emptyReturnForm.register('customerName')} type="hidden" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" error={emptyReturnForm.formState.errors.date?.message} required>
              <Input register={emptyReturnForm.register('date')} error={emptyReturnForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={emptyReturnForm.formState.errors.dcNumber?.message} required>
              <Input register={emptyReturnForm.register('dcNumber')} error={emptyReturnForm.formState.errors.dcNumber} placeholder="DC Number" />
            </FormField>
          </div>

          {/* Cylinders - Customer wise only */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders (Customer wise sales cylinders only) (Multiple)</h3>
            {emptyReturnForm.watch('cylinders')?.map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              const customerCylinders = getCustomerCylinders(emptyReturnForm.watch('customerName'))
              return (
                <div key={idx} className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search cylinder..."
                        value={selectedCylinder ? `${selectedCylinder.cylinderCode} — ${selectedCylinder.gasTypeName}` : cylinderSearch}
                        onChange={(e) => {
                          setCylinderSearch(e.target.value)
                          if (!e.target.value) emptyReturnForm.setValue(`cylinders.${idx}.cylinderId`, '')
                        }}
                        className="input-field pl-10 w-full"
                      />
                      {!selectedCylinder && cylinderSearch && emptyReturnForm.watch('customerName') && customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase())).length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase())).map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                emptyReturnForm.setValue(`cylinders.${idx}.cylinderId`, c.id)
                                setCylinderSearch('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                            >
                              {c.cylinderCode} — {c.gasTypeName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {emptyReturnForm.watch('cylinders').length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const cyl = emptyReturnForm.watch('cylinders')
                        emptyReturnForm.setValue('cylinders', cyl.filter((_, i) => i !== idx))
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => {
                const cyl = emptyReturnForm.watch('cylinders')
                emptyReturnForm.setValue('cylinders', [...cyl, { cylinderId: '' }])
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-2"
            >
              + Add Cylinder
            </button>
          </div>

          <FormField label="Notes">
            <Textarea register={emptyReturnForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={resetEmptyReturnModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Record Return'}</button>
          </div>
        </form>
      </Modal>

      {/* Load Return Modal */}
      <Modal isOpen={loadReturnModal} onClose={resetLoadReturnModal} title="Load Return (Fault Cylinder)">
        <form onSubmit={loadReturnForm.handleSubmit(onLoadReturnSubmit)} className="space-y-4 max-h-96 overflow-y-auto">
          {/* Customer Search */}
          <FormField label="Customer" error={loadReturnForm.formState.errors.customerName?.message} required>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search or type customer name..."
                value={loadReturnForm.watch('customerName') || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  if (!e.target.value) loadReturnForm.setValue('customerName', '')
                }}
                className="input-field pl-10"
              />
              {(customerSearch || loadReturnForm.watch('customerName')) && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        loadReturnForm.setValue('customerName', c.name)
                        setCustomerSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        loadReturnForm.watch('customerName') === c.name
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      ✓ {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input {...loadReturnForm.register('customerName')} type="hidden" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" error={loadReturnForm.formState.errors.date?.message} required>
              <Input register={loadReturnForm.register('date')} error={loadReturnForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={loadReturnForm.formState.errors.dcNumber?.message} required>
              <Input register={loadReturnForm.register('dcNumber')} error={loadReturnForm.formState.errors.dcNumber} placeholder="DC Number" />
            </FormField>
          </div>

          {/* Cylinders - Customer wise only */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders (Customer wise sales cylinders only) (Multiple)</h3>
            {loadReturnForm.watch('cylinders')?.map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              const customerCylinders = getCustomerCylinders(loadReturnForm.watch('customerName'))
              return (
                <div key={idx} className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search cylinder..."
                        value={selectedCylinder ? `${selectedCylinder.cylinderCode} — ${selectedCylinder.gasTypeName}` : cylinderSearch}
                        onChange={(e) => {
                          setCylinderSearch(e.target.value)
                          if (!e.target.value) loadReturnForm.setValue(`cylinders.${idx}.cylinderId`, '')
                        }}
                        className="input-field pl-10 w-full"
                      />
                      {!selectedCylinder && cylinderSearch && loadReturnForm.watch('customerName') && customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase())).length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase())).map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                loadReturnForm.setValue(`cylinders.${idx}.cylinderId`, c.id)
                                setCylinderSearch('')
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                            >
                              {c.cylinderCode} — {c.gasTypeName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {loadReturnForm.watch('cylinders').length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const cyl = loadReturnForm.watch('cylinders')
                        loadReturnForm.setValue('cylinders', cyl.filter((_, i) => i !== idx))
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => {
                const cyl = loadReturnForm.watch('cylinders')
                loadReturnForm.setValue('cylinders', [...cyl, { cylinderId: '' }])
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-2"
            >
              + Add Cylinder
            </button>
          </div>

          <FormField label="Fault Description" error={loadReturnForm.formState.errors.faultDescription?.message} required>
            <Textarea register={loadReturnForm.register('faultDescription')} placeholder="Describe the fault..." rows="3" />
          </FormField>

          <FormField label="Notes">
            <Textarea register={loadReturnForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={resetLoadReturnModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Record Return'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
