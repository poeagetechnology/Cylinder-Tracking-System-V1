import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Play, Square, Wind, Search, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Badge } from '../../components/ui/Badge'
import { FormField, Input, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { fmtDateTime, fmtDate, fmtCurrency } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import {
  LIQUID_OXYGEN_TYPE as OXYGEN_TYPE,
  formatCubicMeters,
  getFillingCubicMeters,
  getLiquidOxygenStockSummary,
  getPurchaseCubicMeters,
  parseStockNumber,
} from '../../utils/liquidOxygenStock'
import { writeAuditLog, writeStockTransaction } from '../../utils/audit'
import { getVoidPayload, hasDuplicateValue, normalizeText } from '../../utils/records'

export const FillingPage = () => {
  const { userProfile } = useAuth()
  const { data: fillings, loading } = useFirestoreCollection('fillings')
  const { data: cylinders } = useFirestoreCollection('cylinders')
  const { data: fillingPurchases } = useFirestoreCollection('fillingPurchases')
  const { data: stockTransactions } = useFirestoreCollection('stockTransactions')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cylinderSearch, setCylinderSearch] = useState('')
  const [selectedCylinders, setSelectedCylinders] = useState([])
  const [lessCubic, setLessCubic] = useState('')
  const [purchaseEditItem, setPurchaseEditItem] = useState(null)
  const [purchaseVoidItem, setPurchaseVoidItem] = useState(null)
  const [fillingEditItem, setFillingEditItem] = useState(null)
  const [fillingVoidItem, setFillingVoidItem] = useState(null)
  const [editLessCubic, setEditLessCubic] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Purchase modal state
  const [purchaseModal, setPurchaseModal] = useState(false)
  const [purchaseSaving, setPurchaseSaving] = useState(false)

  // Purchase form
  const purchaseForm = useForm({
    defaultValues: {
      supplierName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      oxygenType: OXYGEN_TYPE,
      cubicMeters: '',
      currentAmount: '',
      paidAmount: '',
      gst: 0,
      notes: '',
    },
  })
  const [balance, setBalance] = useState('0.00')
  const currentAmount = purchaseForm.watch('currentAmount')
  const paidAmount = purchaseForm.watch('paidAmount')
  const gstPercent = purchaseForm.watch('gst') || 0
  const purchaseCubicMeters = purchaseForm.watch('cubicMeters')

  useEffect(() => {
    const amount = parseFloat(currentAmount) || 0
    const paid = parseFloat(paidAmount) || 0
    const gstAmount = (amount * gstPercent) / 100
    const totalAmount = amount + gstAmount
    setBalance((totalAmount - paid).toFixed(2))
  }, [currentAmount, paidAmount, gstPercent])
  // Filter purchases for filling only (no longer needed since we have separate collection)
  const { rows: purchaseRows } = useTable(fillingPurchases, ['supplierName', 'dcNumber', 'oxygenType'], 10)

  const stockSummary = getLiquidOxygenStockSummary(fillingPurchases, fillings, stockTransactions)
  const {
    totalCubicMeterStock,
    availableStock,
    filledQuantity,
    remainingQuantity,
  } = stockSummary
  const purchaseStockAfter = availableStock + parseStockNumber(purchaseCubicMeters)

  const openPurchaseEdit = (purchase) => {
    setPurchaseEditItem(purchase)
    purchaseForm.reset({
      supplierName: purchase.supplierName || '',
      date: purchase.date || new Date().toISOString().split('T')[0],
      dcNumber: purchase.dcNumber || '',
      oxygenType: purchase.oxygenType || OXYGEN_TYPE,
      cubicMeters: getPurchaseCubicMeters(purchase),
      currentAmount: purchase.currentAmount || '',
      paidAmount: purchase.paidAmount || '',
      gst: purchase.gst || 0,
      notes: purchase.notes || '',
    })
    setPurchaseModal(true)
  }

  // Purchase columns
  const purchaseColumns = [
    { key: 'supplierName', label: 'Supplier', sortable: true },
    { key: 'date', label: 'Date', render: (row) => fmtDate(row.date) },
    { key: 'dcNumber', label: 'DC Number' },
    { key: 'oxygenType', label: 'Oxygen Type', render: (row) => row.oxygenType || OXYGEN_TYPE },
    { key: 'cubicMeters', label: 'Cubic Meters', render: (row) => formatCubicMeters(getPurchaseCubicMeters(row)) },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'voided' ? 'rejected' : 'approved'} label={row.status === 'voided' ? 'Voided' : 'Active'} /> },
    { key: 'currentAmount', label: 'Amount (₹)', render: (row) => fmtCurrency(row.currentAmount) },
    { key: 'gst', label: 'GST %' },
    { key: 'gstAmount', label: 'Tax (₹)', render: (row) => fmtCurrency(row.gstAmount) },
    { key: 'totalAmount', label: 'Total Amount (₹)', render: (row) => fmtCurrency(row.totalAmount) },
    { key: 'paidAmount', label: 'Paid (₹)', render: (row) => fmtCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Balance (₹)', render: (row) => fmtCurrency(row.balanceAmount) },
    { key: 'recordedBy', label: 'By' },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openPurchaseEdit(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 disabled:opacity-40 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setPurchaseVoidItem(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-40 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )},
  ]
  // Purchase modal handlers
  const resetPurchaseModal = () => {
    setPurchaseModal(false)
    setPurchaseEditItem(null)
    purchaseForm.reset({
      supplierName: '',
      date: new Date().toISOString().split('T')[0],
      dcNumber: '',
      oxygenType: OXYGEN_TYPE,
      cubicMeters: '',
      currentAmount: '',
      paidAmount: '',
      gst: 0,
      notes: '',
    })
  }

  const onPurchaseSubmit = async (data) => {
    setPurchaseSaving(true)
    try {
      const supplierName = normalizeText(data.supplierName)
      const dcNumber = normalizeText(data.dcNumber)
      const cubicMeters = parseStockNumber(data.cubicMeters)
      if (!supplierName) {
        toast.error('Supplier name is required')
        setPurchaseSaving(false)
        return
      }
      if (!dcNumber) {
        toast.error('DC Number is required')
        setPurchaseSaving(false)
        return
      }
      if (hasDuplicateValue(fillingPurchases, 'dcNumber', dcNumber, purchaseEditItem?.id)) {
        toast.error('A filling purchase with this DC Number already exists')
        setPurchaseSaving(false)
        return
      }
      if (cubicMeters <= 0) {
        toast.error('Please enter cubic meters for Liquid Oxygen')
        setPurchaseSaving(false)
        return
      }
      const currentAmount = parseFloat(data.currentAmount) || 0
      const paidAmount = parseFloat(data.paidAmount) || 0
      const gst = data.gst || 0
      const gstAmount = (currentAmount * gst) / 100
      const totalAmount = currentAmount + gstAmount
      const balanceAmount = totalAmount - paidAmount
      const purchaseData = {
        supplierName,
        date: data.date || new Date().toISOString().split('T')[0],
        dcNumber,
        oxygenType: data.oxygenType || OXYGEN_TYPE,
        cubicMeters,
        currentAmount,
        paidAmount,
        balanceAmount,
        gst,
        gstAmount,
        totalAmount: currentAmount + gstAmount,
        notes: normalizeText(data.notes),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      }
      if (purchaseEditItem) {
        const previousCubicMeters = getPurchaseCubicMeters(purchaseEditItem)
        const delta = cubicMeters - previousCubicMeters
        if (delta < 0 && Math.abs(delta) > availableStock) {
          toast.error('Cannot reduce purchase below already consumed stock')
          setPurchaseSaving(false)
          return
        }
        await updateDocument('fillingPurchases', purchaseEditItem.id, purchaseData)
        await writeAuditLog({
          action: 'edit',
          collectionName: 'fillingPurchases',
          recordId: purchaseEditItem.id,
          recordLabel: dcNumber,
          before: purchaseEditItem,
          after: purchaseData,
          quantityCubicMeters: delta,
          userProfile,
        })
        if (delta !== 0) {
          await writeStockTransaction({
            type: delta > 0 ? 'purchase_in' : 'manual_adjustment',
            sourceCollection: 'fillingPurchases',
            sourceId: purchaseEditItem.id,
            quantityCubicMeters: Math.abs(delta),
            stockBefore: availableStock,
            stockAfter: availableStock + delta,
            userProfile,
          })
        }
        toast.success('Purchase updated')
      } else {
        const id = await addDocument('fillingPurchases', purchaseData)
        await writeStockTransaction({
          type: 'purchase_in',
          sourceCollection: 'fillingPurchases',
          sourceId: id,
          quantityCubicMeters: cubicMeters,
          stockBefore: availableStock,
          stockAfter: availableStock + cubicMeters,
          userProfile,
        })
        await writeAuditLog({
          action: 'stock_in',
          collectionName: 'fillingPurchases',
          recordId: id,
          recordLabel: dcNumber,
          after: purchaseData,
          quantityCubicMeters: cubicMeters,
          stockBefore: availableStock,
          stockAfter: availableStock + cubicMeters,
          userProfile,
        })
        toast.success('Purchase recorded for Filling')
      }
      resetPurchaseModal()
    } catch (err) {
      toast.error('Failed to record purchase: ' + err.message)
    } finally {
      setPurchaseSaving(false)
    }
  }

  const { reset } = useForm()

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    fillings, ['oxygenType', 'cylinderCode', 'gasTypeName', 'status'], 10
  )

  // Filter to only Oxygen gas type
  const oxygenCylinders = cylinders.filter((c) => c.gasTypeName?.toLowerCase().includes('oxygen'))
  const emptyCylinders = oxygenCylinders.filter((c) => c.status === 'empty')
  const filteredCylinders = cylinderSearch 
    ? emptyCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()))
    : emptyCylinders
  const selectedFillingCubicMeters = selectedCylinders.reduce((sum, cylinderId) => {
    const cylinder = cylinders.find((c) => c.id === cylinderId)
    return sum + parseStockNumber(cylinder?.capacity)
  }, 0)
  const manualLessCubic = parseStockNumber(lessCubic)
  const totalFillingDeduction = selectedFillingCubicMeters + manualLessCubic
  const remainingAfterSelectedFilling = availableStock - totalFillingDeduction

  const getCapacityUnit = (gasName) => {
    const cubicGases = ['Oxygen', 'Argon', 'Nitrogen']
    return cubicGases.some(g => gasName?.toLowerCase().includes(g.toLowerCase())) ? 'cubic' : 'kg'
  }

  const onStart = async () => {
    if (selectedCylinders.length === 0) {
      toast.error('Please select at least one cylinder')
      return
    }
    if (selectedFillingCubicMeters <= 0) {
      toast.error('Selected cylinders must have cubic meter capacity')
      return
    }
    if (manualLessCubic < 0) {
      toast.error('Less Cubic cannot be negative')
      return
    }
    if (totalFillingDeduction > availableStock) {
      toast.error(`Insufficient Liquid Oxygen stock. Available: ${formatCubicMeters(availableStock)}`)
      return
    }

    setSaving(true)
    try {
      let runningStock = availableStock
      const selectedCylinderDetails = selectedCylinders
        .map((cylinderId) => cylinders.find((c) => c.id === cylinderId))
        .filter(Boolean)

      for (const [index, cylinder] of selectedCylinderDetails.entries()) {
        const capacityUnit = getCapacityUnit(cylinder?.gasTypeName)
        const cubicMetersUsed = parseStockNumber(cylinder?.capacity)
        const lessCubicForRecord = index === 0 ? manualLessCubic : 0
        const totalCubicMetersUsed = cubicMetersUsed + lessCubicForRecord
        const stockBefore = runningStock
        runningStock = Math.max(runningStock - totalCubicMetersUsed, 0)
        const fillingData = {
          cylinderId: cylinder.id,
          cylinderCode: cylinder?.cylinderCode,
          gasTypeName: OXYGEN_TYPE,
          oxygenType: OXYGEN_TYPE,
          capacity: cylinder?.capacity,
          capacityUnit,
          cubicMetersUsed,
          lessCubic: lessCubicForRecord,
          totalCubicMetersUsed,
          stockBefore,
          stockAfter: runningStock,
          startedAt: new Date().toISOString(),
          endedAt: null,
          duration: null,
          status: 'in_progress',
          startedBy: userProfile?.name,
        }
        const fillingId = await addDocument('fillings', fillingData)
        await writeStockTransaction({
          type: 'filling_out',
          sourceCollection: 'fillings',
          sourceId: fillingId,
          quantityCubicMeters: totalCubicMetersUsed,
          stockBefore,
          stockAfter: runningStock,
          userProfile,
        })
        await writeAuditLog({
          action: lessCubicForRecord > 0 ? 'manual_deduction' : 'stock_out',
          collectionName: 'fillings',
          recordId: fillingId,
          recordLabel: cylinder?.cylinderCode,
          after: fillingData,
          quantityCubicMeters: totalCubicMetersUsed,
          stockBefore,
          stockAfter: runningStock,
          userProfile,
        })
        await updateDocument('cylinders', cylinder.id, { status: 'in_use' })
      }
      toast.success(`Filling started. Stock reduced by ${formatCubicMeters(totalFillingDeduction)}`)
      setModalOpen(false)
      setCylinderSearch('')
      setSelectedCylinders([])
      setLessCubic('')
      reset()
    } catch {
      toast.error('Failed to start filling')
    } finally {
      setSaving(false)
    }
  }

  const toggleCylinderSelection = (cylinderId) => {
    setSelectedCylinders((prev) =>
      prev.includes(cylinderId)
        ? prev.filter((id) => id !== cylinderId)
        : [...prev, cylinderId]
    )
  }

  const handleSelectAll = () => {
    if (selectedCylinders.length === filteredCylinders.length) {
      setSelectedCylinders([])
    } else {
      setSelectedCylinders(filteredCylinders.map((c) => c.id))
    }
  }

  const resetStartModal = () => {
    setModalOpen(false)
    setCylinderSearch('')
    setSelectedCylinders([])
    setLessCubic('')
  }

  const openFillingEdit = (filling) => {
    setFillingEditItem(filling)
    setEditLessCubic(String(filling.lessCubic || ''))
  }

  const saveFillingEdit = async () => {
    const newLessCubic = parseStockNumber(editLessCubic)
    if (newLessCubic < 0) {
      toast.error('Less Cubic cannot be negative')
      return
    }

    const baseCubicMeters = parseStockNumber(fillingEditItem?.cubicMetersUsed ?? fillingEditItem?.capacity)
    const previousTotal = getFillingCubicMeters(fillingEditItem)
    const totalCubicMetersUsed = baseCubicMeters + newLessCubic
    const delta = totalCubicMetersUsed - previousTotal

    if (delta > availableStock) {
      toast.error(`Insufficient Liquid Oxygen stock. Available: ${formatCubicMeters(availableStock)}`)
      return
    }

    setEditSaving(true)
    try {
      const after = {
        lessCubic: newLessCubic,
        totalCubicMetersUsed,
      }
      await updateDocument('fillings', fillingEditItem.id, after)
      if (delta !== 0) {
        await writeStockTransaction({
          type: delta > 0 ? 'less_cubic_adjustment' : 'void_reversal',
          sourceCollection: 'fillings',
          sourceId: fillingEditItem.id,
          quantityCubicMeters: Math.abs(delta),
          stockBefore: availableStock,
          stockAfter: availableStock - delta,
          userProfile,
        })
      }
      await writeAuditLog({
        action: 'edit',
        collectionName: 'fillings',
        recordId: fillingEditItem.id,
        recordLabel: fillingEditItem.cylinderCode,
        before: fillingEditItem,
        after,
        quantityCubicMeters: delta,
        userProfile,
      })
      toast.success('Filling updated')
      setFillingEditItem(null)
      setEditLessCubic('')
    } catch (err) {
      toast.error('Failed to update filling: ' + err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const voidPurchase = async () => {
    const cubicMeters = getPurchaseCubicMeters(purchaseVoidItem)
    if (cubicMeters > availableStock) {
      toast.error('Cannot void purchase because stock has already been consumed')
      return
    }

    try {
      await updateDocument('fillingPurchases', purchaseVoidItem.id, getVoidPayload(userProfile))
      await writeStockTransaction({
        type: 'manual_adjustment',
        sourceCollection: 'fillingPurchases',
        sourceId: purchaseVoidItem.id,
        quantityCubicMeters: cubicMeters,
        stockBefore: availableStock,
        stockAfter: availableStock - cubicMeters,
        userProfile,
      })
      await writeAuditLog({
        action: 'void',
        collectionName: 'fillingPurchases',
        recordId: purchaseVoidItem.id,
        recordLabel: purchaseVoidItem.dcNumber,
        before: purchaseVoidItem,
        quantityCubicMeters: cubicMeters,
        userProfile,
      })
      toast.success('Purchase voided')
    } catch (err) {
      toast.error('Failed to void purchase: ' + err.message)
    }
  }

  const voidFilling = async () => {
    const cubicMeters = getFillingCubicMeters(fillingVoidItem)
    try {
      await updateDocument('fillings', fillingVoidItem.id, getVoidPayload(userProfile))
      if (fillingVoidItem.cylinderId) {
        await updateDocument('cylinders', fillingVoidItem.cylinderId, { status: 'empty' })
      }
      await writeStockTransaction({
        type: 'void_reversal',
        sourceCollection: 'fillings',
        sourceId: fillingVoidItem.id,
        quantityCubicMeters: cubicMeters,
        stockBefore: availableStock,
        stockAfter: availableStock + cubicMeters,
        userProfile,
      })
      await writeAuditLog({
        action: 'void',
        collectionName: 'fillings',
        recordId: fillingVoidItem.id,
        recordLabel: fillingVoidItem.cylinderCode,
        before: fillingVoidItem,
        quantityCubicMeters: cubicMeters,
        userProfile,
      })
      toast.success('Filling voided')
    } catch (err) {
      toast.error('Failed to void filling: ' + err.message)
    }
  }

  const handleEnd = async (filling) => {
    try {
      const endedAt = new Date().toISOString()
      const start = new Date(filling.startedAt)
      const end = new Date(endedAt)
      const durationMin = Math.round((end - start) / 60000)
      await updateDocument('fillings', filling.id, {
        endedAt,
        duration: durationMin,
        status: 'completed',
      })
      await updateDocument('cylinders', filling.cylinderId, { status: 'full' })
      toast.success('Filling completed')
    } catch {
      toast.error('Failed to end filling')
    }
  }

  const columns = [
    { key: 'cylinderCode', label: 'Cylinder Code', sortable: true },
    { key: 'oxygenType', label: 'Oxygen Type', render: (row) => row.oxygenType || row.gasTypeName || OXYGEN_TYPE },
    { key: 'cubicMetersUsed', label: 'Cylinder Cubic Meters', render: (row) => formatCubicMeters(row.cubicMetersUsed ?? row.capacity) },
    { key: 'lessCubic', label: 'Less Cubic', render: (row) => formatCubicMeters(row.lessCubic) },
    { key: 'totalCubicMetersUsed', label: 'Total Deduction', render: (row) => formatCubicMeters(getFillingCubicMeters(row)) },
    { key: 'stockAfter', label: 'Stock After', render: (row) => row.stockAfter !== undefined ? formatCubicMeters(row.stockAfter) : '—' },
    { key: 'startedAt', label: 'Started', render: (row) => fmtDateTime(row.startedAt) },
    { key: 'endedAt', label: 'Ended', render: (row) => row.endedAt ? fmtDateTime(row.endedAt) : '—' },
    { key: 'duration', label: 'Duration', render: (row) => row.duration ? `${row.duration} min` : '—' },
    { key: 'status', label: 'Status', render: (row) => (
      <Badge
        status={row.status === 'voided' ? 'rejected' : row.status === 'in_progress' ? 'pending' : 'approved'}
        label={row.status === 'voided' ? 'Voided' : row.status === 'in_progress' ? 'In Progress' : 'Completed'}
      />
    ) },
    { key: 'startedBy', label: 'By' },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        {row.status === 'in_progress' && (
          <button onClick={() => handleEnd(row)} className="flex items-center gap-1 btn-danger text-xs px-2 py-1">
            <Square className="h-3.5 w-3.5" /> End
          </button>
        )}
        <button onClick={() => openFillingEdit(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 disabled:opacity-40 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setFillingVoidItem(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-40 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">LIQUID OXYGEN</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage purchase, filling operations and stock tracking</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPurchaseModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Purchase
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Play className="h-4 w-4" /> Start Filling
          </button>
        </div>
      </div>
      {/* Purchase Grid for Filling */}
      <div className="card">
        <h2 className="section-title mb-4">Purchases for Filling</h2>
        <Table
          columns={purchaseColumns}
          rows={purchaseRows}
          searchPlaceholder="Search purchases..."
          emptyMessage="No purchase records found for filling"
        />
      </div>
      {/* Purchase Modal for Filling */}
      <Modal isOpen={purchaseModal} onClose={resetPurchaseModal} title="Purchase for Filling" size="xl">
        <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Supplier Search */}
          <FormField label="Supplier Name" error={purchaseForm.formState?.errors?.supplierName?.message} required>
            <Input
              {...purchaseForm.register('supplierName', { required: 'Supplier name is required' })}
              type="text"
              placeholder="Enter supplier name"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" error={purchaseForm.formState?.errors?.date?.message} required>
            <Input {...purchaseForm.register('date', { required: 'Date is required' })} type="date" />
            </FormField>
            <FormField label="DC Number" error={purchaseForm.formState?.errors?.dcNumber?.message} required>
              <Input {...purchaseForm.register('dcNumber')} placeholder="DC Number" />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Oxygen Type" error={purchaseForm.formState?.errors?.oxygenType?.message} required>
              <Input
                {...purchaseForm.register('oxygenType')}
                readOnly
                className="bg-gray-100 dark:bg-gray-700"
              />
            </FormField>
            <FormField label="Cubic Meters" error={purchaseForm.formState?.errors?.cubicMeters?.message} required>
              <Input
                {...purchaseForm.register('cubicMeters', {
                  required: 'Cubic meters is required',
                  min: { value: 0.01, message: 'Cubic meters must be positive' },
                })}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5000"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm dark:border-green-700 dark:bg-green-900/20">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Current Stock</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCubicMeters(availableStock)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Purchase Quantity</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCubicMeters(purchaseCubicMeters)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Stock After Purchase</p>
              <p className="font-semibold text-green-700 dark:text-green-300">{formatCubicMeters(purchaseStockAfter)}</p>
            </div>
          </div>
          {/* Payment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Amount (₹)" error={purchaseForm.formState?.errors?.currentAmount?.message} required>
              <Input
                {...purchaseForm.register('currentAmount')}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Paid (₹)" error={purchaseForm.formState?.errors?.paidAmount?.message} required>
              <Input
                {...purchaseForm.register('paidAmount')}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Balance (₹)">
              <input
                value={balance}
                disabled
                type="number"
                className="input-field"
              />
            </FormField>
          </div>
          <FormField label="GST %" error={purchaseForm.formState?.errors?.gst?.message}>
            <Input {...purchaseForm.register('gst')} type="number" min="0" max="100" step="0.01" placeholder="0" />
          </FormField>
          
          {(purchaseForm.watch('currentAmount') || purchaseForm.watch('gst')) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Calculation Preview</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{parseFloat(purchaseForm.watch('currentAmount') || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Tax ({purchaseForm.watch('gst') || 0}%)</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{(((purchaseForm.watch('currentAmount') || 0) * (purchaseForm.watch('gst') || 0)) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Amount</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">₹{(parseFloat(purchaseForm.watch('currentAmount') || 0) + ((purchaseForm.watch('currentAmount') || 0) * (purchaseForm.watch('gst') || 0)) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Paid Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{parseFloat(purchaseForm.watch('paidAmount') || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Balance (Total - Paid)</span>
                  <span className="font-bold text-lg text-red-600 dark:text-red-400">₹{balance}</span>
                </div>
              </div>
            </div>
          )}
          
          <FormField label="Notes">
            <Textarea {...purchaseForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={resetPurchaseModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={purchaseSaving} className="btn-primary">{purchaseSaving ? 'Saving...' : 'Save Purchase'}</button>
          </div>
        </form>
      </Modal>

      {/* Cubic Meter Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">TOTAL CUBIC METER STOCK</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Liquid Oxygen purchased</p>
            </div>
            <Plus className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCubicMeters(totalCubicMeterStock)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{fillingPurchases.length} purchase orders</p>
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">AVAILABLE STOCK</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ready for filling</p>
            </div>
            <Wind className="h-5 w-5 text-green-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCubicMeters(availableStock)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Live stock balance</p>
          </div>
        </div>

        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">FILLED QUANTITY</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cubic meters used for filling</p>
            </div>
            <Play className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCubicMeters(filledQuantity)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{fillings.length} filling sessions</p>
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">REMAINING QUANTITY</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Stock after filled quantity</p>
            </div>
            <Wind className="h-5 w-5 text-purple-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCubicMeters(remainingQuantity)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Calculated dynamically</p>
          </div>
        </div>
      </div>

      <div className="card">
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
            searchPlaceholder="Search fillings..."
            emptyMessage="No filling sessions yet."
          />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={resetStartModal} title="Start Liquid Oxygen Filling" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-700 dark:bg-blue-900/20">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Available Stock</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCubicMeters(availableStock)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Cylinder Usage</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCubicMeters(selectedFillingCubicMeters)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Less Cubic</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCubicMeters(manualLessCubic)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Remaining After Filling</p>
              <p className={`font-semibold ${remainingAfterSelectedFilling < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-300'}`}>
                {formatCubicMeters(remainingAfterSelectedFilling)}
              </p>
            </div>
          </div>

          <FormField label="Search Cylinder by Number">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter cylinder number..."
                value={cylinderSearch}
                onChange={(e) => setCylinderSearch(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </FormField>

          <FormField label="Less Cubic">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={lessCubic}
              onChange={(e) => setLessCubic(e.target.value)}
              placeholder="Manual cubic meter deduction"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional manual adjustment. This amount is deducted from Liquid Oxygen stock with the selected cylinders.
            </p>
          </FormField>

          <FormField label="Select Empty Oxygen Cylinders" required>
            {filteredCylinders.length > 0 && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  {selectedCylinders.length === filteredCylinders.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            )}

            <div className="border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-600 max-h-64 overflow-y-auto">
              {filteredCylinders.length > 0 ? (
                filteredCylinders.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCylinders.includes(c.id)}
                      onChange={() => toggleCylinderSelection(c.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                      {c.cylinderCode} — {c.gasTypeName} ({formatCubicMeters(c.capacity)})
                    </span>
                  </label>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  {cylinderSearch ? 'No matching cylinders found' : 'No empty cylinders available'}
                </div>
              )}
            </div>
          </FormField>

          {selectedCylinders.length > 0 && (
            <div className={`${remainingAfterSelectedFilling < 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'} p-3 rounded-lg`}>
              <p className={`text-sm ${remainingAfterSelectedFilling < 0 ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
                <span className="font-semibold">{selectedCylinders.length}</span> cylinder(s) selected,
                {' '}using <span className="font-semibold">{formatCubicMeters(selectedFillingCubicMeters)}</span>.
                {' '}Less Cubic: <span className="font-semibold">{formatCubicMeters(manualLessCubic)}</span>.
                {' '}Remaining stock: <span className="font-semibold">{formatCubicMeters(remainingAfterSelectedFilling)}</span>.
              </p>
            </div>
          )}

          {availableStock <= 0 && (
            <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              No Liquid Oxygen stock is available. Add a cubic meter purchase before starting filling.
            </p>
          )}

          {emptyCylinders.length === 0 && !cylinderSearch && (
            <p className="text-yellow-600 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              No empty Oxygen cylinders available. Mark Oxygen cylinders as empty first.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={resetStartModal} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={onStart}
              disabled={saving || selectedCylinders.length === 0 || selectedFillingCubicMeters <= 0 || manualLessCubic < 0 || remainingAfterSelectedFilling < 0}
              className="btn-primary"
            >
              {saving ? 'Starting...' : 'Start Filling'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!fillingEditItem} onClose={() => { setFillingEditItem(null); setEditLessCubic('') }} title="Edit Filling Adjustment">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{fillingEditItem?.cylinderCode || 'Filling Session'}</p>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Cylinder usage: {formatCubicMeters(fillingEditItem?.cubicMetersUsed ?? fillingEditItem?.capacity)}
            </p>
          </div>
          <FormField label="Less Cubic">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={editLessCubic}
              onChange={(e) => setEditLessCubic(e.target.value)}
              placeholder="Manual cubic meter deduction"
            />
          </FormField>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-700 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Deduction</span>
              <span className="font-semibold text-blue-700 dark:text-blue-300">
                {formatCubicMeters(parseStockNumber(fillingEditItem?.cubicMetersUsed ?? fillingEditItem?.capacity) + parseStockNumber(editLessCubic))}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => { setFillingEditItem(null); setEditLessCubic('') }} className="btn-secondary">Cancel</button>
            <button type="button" onClick={saveFillingEdit} disabled={editSaving} className="btn-primary">{editSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!purchaseVoidItem}
        onClose={() => setPurchaseVoidItem(null)}
        onConfirm={() => { voidPurchase(); setPurchaseVoidItem(null) }}
        title="Void Filling Purchase"
        message="This will void the purchase and reduce available cubic meter stock if it has not already been consumed."
        confirmText="Void Purchase"
      />

      <ConfirmDialog
        isOpen={!!fillingVoidItem}
        onClose={() => setFillingVoidItem(null)}
        onConfirm={() => { voidFilling(); setFillingVoidItem(null) }}
        title="Void Filling Session"
        message="This will void the filling session, reverse cubic meter stock, and reset the linked cylinder when possible."
        confirmText="Void Filling"
      />
    </div>
  )
}
