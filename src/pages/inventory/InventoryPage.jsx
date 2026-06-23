import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../context/AuthContext'
import { addDocument, updateDocument } from '../../services/firestoreService'
import { AlertTriangle, Package, CheckCircle, XCircle, Clock, Plus, TrendingUp, TrendingDown, Trash2, Search, Wind, Edit2, ShoppingCart } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import * as Yup from 'yup'
import toast from 'react-hot-toast'
import { fmtDate, fmtCurrency } from '../../utils/helpers'
import { formatCubicMeters, getLiquidOxygenStockSummary } from '../../utils/liquidOxygenStock'
import { writeAuditLog } from '../../utils/audit'
import { getVoidPayload, hasDuplicateCylinderIds, hasDuplicateValue, normalizeText } from '../../utils/records'

const ALERT_THRESHOLD = 5

// Statuses that mean a cylinder is already active in inventory and cannot be re-purchased.
// A cylinder with status 'empty' has completed its cycle and is available to purchase again.
const PURCHASE_BLOCKED_STATUSES = ['full', 'in_use', 'maintenance']
const PURCHASE_BLOCKED_LABELS = {
  full: 'In Stock (Full)',
  in_use: 'With Customer',
  maintenance: 'Under Maintenance',
}

const getPurchaseCylinderError = (cylinder) => {
  if (!cylinder) return null
  if (PURCHASE_BLOCKED_STATUSES.includes(cylinder.status)) {
    return `Cylinder ${cylinder.cylinderCode} is already active in inventory (${PURCHASE_BLOCKED_LABELS[cylinder.status]})`
  }
  return null
}

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
  const { data: fillingPurchases } = useFirestoreCollection('fillingPurchases')
  const { data: fillings } = useFirestoreCollection('fillings')
  const { data: stockTransactions } = useFirestoreCollection('stockTransactions')
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
  const [purchaseBalance, setPurchaseBalance] = useState('0.00')
  const [saleBalance, setSaleBalance] = useState('0.00')
  const [purchaseGstPreview, setPurchaseGstPreview] = useState(0)
  const [saleGstPreview, setSaleGstPreview] = useState(0)
  const [selectedSaleCustomer, setSelectedSaleCustomer] = useState(null)
  const [saleCustomerRateDisplay, setSaleCustomerRateDisplay] = useState(null)
  const [saleCustomerAllRates, setSaleCustomerAllRates] = useState(null)
  const [purchaseEditItem, setPurchaseEditItem] = useState(null)
  const [saleEditItem, setSaleEditItem] = useState(null)
  const [emptyReturnEditItem, setEmptyReturnEditItem] = useState(null)
  const [loadReturnEditItem, setLoadReturnEditItem] = useState(null)
  const [voidTarget, setVoidTarget] = useState(null)

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

  const getCustomerRateForCylinder = (customer, cylinder) => {
    if (!customer || !customer.gasTypeWiseRate || !cylinder) return null
    return customer.gasTypeWiseRate.find((rate) =>
      rate.gasTypeId === cylinder.gasTypeId && String(rate.capacity) === String(cylinder.capacity)
    )
  }

  const populateSaleAmountFromCustomer = (customer) => {
    if (!customer) {
      setSaleCustomerRateDisplay(null)
      setSaleCustomerAllRates(null)
      return
    }

    // Store all customer rates for reference
    if (customer.gasTypeWiseRate && customer.gasTypeWiseRate.length > 0) {
      setSaleCustomerAllRates(customer.gasTypeWiseRate)
    }

    const selectedCylinders = saleForm.watch('cylinders') || []
    const selectedCylinderIds = selectedCylinders.filter(c => c.cylinderId).map(c => c.cylinderId)

    if (selectedCylinderIds.length === 0) {
      // Show first available customer rate when no cylinders selected
      if (customer.gasTypeWiseRate && customer.gasTypeWiseRate.length > 0) {
        const firstRate = customer.gasTypeWiseRate[0]
        const rawAmount = parseFloat(firstRate.rate) || 0
        const gstPercent = parseFloat(firstRate.gst) || 0
        const gstAmount = (rawAmount * gstPercent) / 100
        const totalAmount = rawAmount + gstAmount

        saleForm.setValue('currentAmount', rawAmount.toFixed(2))
        saleForm.setValue('gst', gstPercent)

        setSaleCustomerRateDisplay({
          rawAmount: rawAmount.toFixed(2),
          gstPercent: gstPercent,
          gstAmount: gstAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          cylinderCount: 0,
          isDefault: true
        })
      }
      return
    }

    // Calculate rates from selected cylinders
    const rates = selectedCylinders
      .map((item) => cylinders.find((c) => c.id === item.cylinderId))
      .filter(Boolean)
      .map((cylinder) => getCustomerRateForCylinder(customer, cylinder))
      .filter(Boolean)

    if (rates.length === 0) {
      setSaleCustomerRateDisplay(null)
      return
    }

    const rawAmount = rates.reduce((sum, rate) => {
      return sum + (parseFloat(rate.rate) || 0)
    }, 0)
    const gstPercent = rates[0].gst || 0
    const gstAmount = (rawAmount * gstPercent) / 100
    const totalAmount = rawAmount + gstAmount

    saleForm.setValue('currentAmount', rawAmount.toFixed(2))
    saleForm.setValue('gst', gstPercent)

    setSaleCustomerRateDisplay({
      rawAmount: rawAmount.toFixed(2),
      gstPercent: gstPercent,
      gstAmount: gstAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      cylinderCount: rates.length,
      isDefault: false
    })
  }

  useEffect(() => {
    if (selectedSaleCustomer) {
      populateSaleAmountFromCustomer(selectedSaleCustomer)
    } else {
      setSaleCustomerRateDisplay(null)
    }
  }, [selectedSaleCustomer, saleForm.watch('cylinders')])

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

  // Watch form values for purchase
  const purchaseCurrentAmount = purchaseForm.watch('currentAmount')
  const purchasePaidAmount = purchaseForm.watch('paidAmount')
  const purchaseGst = purchaseForm.watch('gst')

  // Calculate purchase balance
  useEffect(() => {
    const amount = parseFloat(purchaseCurrentAmount) || 0
    const paid = parseFloat(purchasePaidAmount) || 0
    const gstPercent = parseFloat(purchaseGst) || 0
    const gstAmount = (amount * gstPercent) / 100
    const totalAmount = amount + gstAmount
    setPurchaseBalance((totalAmount - paid).toFixed(2))
  }, [purchaseCurrentAmount, purchasePaidAmount, purchaseGst])

  // Watch form values for sale
  const saleCurrentAmount = saleForm.watch('currentAmount')
  const salePaidAmount = saleForm.watch('paidAmount')
  const saleGst = saleForm.watch('gst')
  const saleCylinders = saleForm.watch('cylinders')

  // Calculate sale balance
  useEffect(() => {
    const amount = parseFloat(saleCurrentAmount) || 0
    const paid = parseFloat(salePaidAmount) || 0
    const gstPercent = parseFloat(saleGst) || 0
    const gstAmount = (amount * gstPercent) / 100
    const totalAmount = amount + gstAmount
    setSaleBalance((totalAmount - paid).toFixed(2))
  }, [saleCurrentAmount, salePaidAmount, saleGst])

  useEffect(() => {
    if (selectedSaleCustomer) {
      populateSaleAmountFromCustomer(selectedSaleCustomer)
    }
  }, [selectedSaleCustomer, saleCylinders])

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
          sourceId: record.id,
          cylinderCode: cyl.cylinderCode || '',
          gasType: cyl.gasType || '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          notes: record.notes,
          status: record.status,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }))
      : [{
          id: record.id,
          sourceId: record.id,
          cylinderCode: '',
          gasType: '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          notes: record.notes,
          status: record.status,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }]
  )

  // Flatten loadReturns data - expand each return into multiple rows (one per cylinder)
  const flattenedLoadReturns = loadReturns.flatMap(record =>
    record.cylinders && record.cylinders.length > 0
      ? record.cylinders.map(cyl => ({
          id: `${record.id}-${cyl.cylinderId}`,
          sourceId: record.id,
          cylinderCode: cyl.cylinderCode || '',
          gasType: cyl.gasType || '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          faultDescription: record.faultDescription,
          notes: record.notes,
          status: record.status,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }))
      : [{
          id: record.id,
          sourceId: record.id,
          cylinderCode: '',
          gasType: '',
          customerName: record.customerName,
          dcNumber: record.dcNumber,
          faultDescription: record.faultDescription,
          notes: record.notes,
          status: record.status,
          recordedBy: record.recordedBy,
          createdAt: record.createdAt,
        }]
  )

  const { rows: emptyReturnRows } = useTable(flattenedEmptyReturns, ['cylinderCode'], 10)
  const { rows: loadReturnRows } = useTable(flattenedLoadReturns, ['cylinderCode'], 10)

  const lowStockItems = inventoryByGas.filter((i) => i.alert && i.total > 0)
  const liquidOxygenStock = getLiquidOxygenStockSummary(fillingPurchases, fillings, stockTransactions)

  // Total cylinder units ever purchased (excluding voided records) — historical aggregate
  const totalCylindersPurchased = purchases
    .filter(p => p.status !== 'voided')
    .reduce((sum, p) => sum + (p.cylinders?.length || 0), 0)

  const openPurchaseEdit = (record) => {
    setPurchaseEditItem(record)
    setSupplierSearch('')
    purchaseForm.reset({
      supplierName: record.supplierName || '',
      date: record.date || new Date().toISOString().split('T')[0],
      dcNumber: record.dcNumber || '',
      cylinders: record.cylinders?.length ? record.cylinders.map((c) => ({ cylinderId: c.cylinderId })) : [{ cylinderId: '' }],
      currentAmount: record.currentAmount || '',
      paidAmount: record.paidAmount || '',
      gst: record.gst || 0,
      notes: record.notes || '',
    })
    setPurchaseModal(true)
  }

  const openSaleEdit = (record) => {
    setSaleEditItem(record)
    setCustomerSearch('')
    saleForm.reset({
      customerName: record.customerName || '',
      date: record.date || new Date().toISOString().split('T')[0],
      dcNumber: record.dcNumber || '',
      cylinders: record.cylinders?.length ? record.cylinders.map((c) => ({ cylinderId: c.cylinderId })) : [{ cylinderId: '' }],
      currentAmount: record.currentAmount || '',
      paidAmount: record.paidAmount || '',
      gst: record.gst || 0,
      notes: record.notes || '',
    })
    setSaleModal(true)
  }

  const openEmptyReturnEdit = (row) => {
    const record = emptyReturns.find((item) => item.id === row.sourceId)
    if (!record) return
    setEmptyReturnEditItem(record)
    emptyReturnForm.reset({
      customerName: record.customerName || '',
      date: record.date || new Date().toISOString().split('T')[0],
      dcNumber: record.dcNumber || '',
      cylinders: record.cylinders?.length ? record.cylinders.map((c) => ({ cylinderId: c.cylinderId })) : [{ cylinderId: '' }],
      notes: record.notes || '',
    })
    setEmptyReturnModal(true)
  }

  const openLoadReturnEdit = (row) => {
    const record = loadReturns.find((item) => item.id === row.sourceId)
    if (!record) return
    setLoadReturnEditItem(record)
    loadReturnForm.reset({
      customerName: record.customerName || '',
      date: record.date || new Date().toISOString().split('T')[0],
      dcNumber: record.dcNumber || '',
      cylinders: record.cylinders?.length ? record.cylinders.map((c) => ({ cylinderId: c.cylinderId })) : [{ cylinderId: '' }],
      faultDescription: record.faultDescription || '',
      notes: record.notes || '',
    })
    setLoadReturnModal(true)
  }

  const voidRecord = async () => {
    if (!voidTarget) return

    try {
      await updateDocument(voidTarget.collectionName, voidTarget.id, getVoidPayload(userProfile))
      await writeAuditLog({
        action: 'void',
        collectionName: voidTarget.collectionName,
        recordId: voidTarget.id,
        recordLabel: voidTarget.label,
        before: voidTarget.record,
        userProfile,
      })
      toast.success(`${voidTarget.label || 'Record'} voided`)
    } catch (err) {
      toast.error('Failed to void record: ' + err.message)
    }
  }

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
      if (hasDuplicateCylinderIds(validCylinders)) {
        toast.error('Duplicate cylinder selection is not allowed')
        setSaving(false)
        return
      }
      if (hasDuplicateValue(purchases, 'dcNumber', data.dcNumber, purchaseEditItem?.id)) {
        toast.error('Purchase DC Number already exists')
        setSaving(false)
        return
      }

      // Backend-level guard: block cylinders that are already active in inventory
      const blockedCylinders = validCylinders
        .map(c => cylinders.find(cy => cy.id === c.cylinderId))
        .filter(c => c && PURCHASE_BLOCKED_STATUSES.includes(c.status))
      if (blockedCylinders.length > 0) {
        const codes = blockedCylinders.map(c => `${c.cylinderCode} (${PURCHASE_BLOCKED_LABELS[c.status]})`).join(', ')
        toast.error(`Cannot purchase: ${codes} — already active in inventory`)
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

      const currentAmount = parseFloat(data.currentAmount) || 0
      const paidAmount = parseFloat(data.paidAmount) || 0
      const gst = data.gst || 0
      const gstAmount = (currentAmount * gst) / 100
      const totalAmount = currentAmount + gstAmount
      const balanceAmount = totalAmount - paidAmount

      const payload = {
        supplierName: normalizeText(data.supplierName),
        date: data.date,
        dcNumber: normalizeText(data.dcNumber),
        cylinders: cylindersList,
        currentAmount: currentAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        gst: data.gst || 0,
        gstAmount: gstAmount,
        totalAmount: currentAmount + gstAmount,
        notes: normalizeText(data.notes),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      }

      if (purchaseEditItem) {
        await updateDocument('purchases', purchaseEditItem.id, payload)
        await writeAuditLog({
          action: 'edit',
          collectionName: 'purchases',
          recordId: purchaseEditItem.id,
          recordLabel: payload.dcNumber,
          before: purchaseEditItem,
          after: payload,
          userProfile,
        })
        toast.success('Purchase updated')
        resetPurchaseModal()
        return
      }

      const purchaseId = await addDocument('purchases', payload)
      await writeAuditLog({
        action: 'create',
        collectionName: 'purchases',
        recordId: purchaseId,
        recordLabel: payload.dcNumber,
        after: payload,
        userProfile,
      })

      // Record OUT movement for cylinders
      cylindersList.forEach(async (c) => {
        await addDocument('movements', {
          cylinderId: c.cylinderId,
          cylinderCode: c.cylinderCode,
          type: 'OUT',
          reason: `Purchase - ${payload.supplierName}`,
          reference: payload.dcNumber,
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
      if (hasDuplicateCylinderIds(validCylinders)) {
        toast.error('Duplicate cylinder selection is not allowed')
        setSaving(false)
        return
      }
      if (hasDuplicateValue(sales, 'dcNumber', data.dcNumber, saleEditItem?.id)) {
        toast.error('Sale DC Number already exists')
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

      const currentAmount = parseFloat(data.currentAmount) || 0
      const paidAmount = parseFloat(data.paidAmount) || 0
      const gst = data.gst || 0
      const gstAmount = (currentAmount * gst) / 100
      const totalAmount = currentAmount + gstAmount
      const balanceAmount = totalAmount - paidAmount

      const payload = {
        customerName: normalizeText(data.customerName),
        date: data.date,
        dcNumber: normalizeText(data.dcNumber),
        cylinders: cylindersList,
        currentAmount: currentAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        gst: data.gst || 0,
        gstAmount: gstAmount,
        totalAmount: currentAmount + gstAmount,
        notes: normalizeText(data.notes),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      }

      if (saleEditItem) {
        await updateDocument('sales', saleEditItem.id, payload)
        await writeAuditLog({
          action: 'edit',
          collectionName: 'sales',
          recordId: saleEditItem.id,
          recordLabel: payload.dcNumber,
          before: saleEditItem,
          after: payload,
          userProfile,
        })
        toast.success('Sale updated')
        resetSaleModal()
        return
      }

      const saleId = await addDocument('sales', payload)
      await writeAuditLog({
        action: 'create',
        collectionName: 'sales',
        recordId: saleId,
        recordLabel: payload.dcNumber,
        after: payload,
        userProfile,
      })

      // Record OUT movement for cylinders
      cylindersList.forEach(async (c) => {
        await addDocument('movements', {
          cylinderId: c.cylinderId,
          cylinderCode: c.cylinderCode,
          type: 'OUT',
          reason: `Sales - ${payload.customerName}`,
          reference: payload.dcNumber,
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
      if (hasDuplicateCylinderIds(validCylinders)) {
        toast.error('Duplicate cylinder selection is not allowed')
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

      const payload = {
        customerName: normalizeText(data.customerName),
        date: data.date,
        dcNumber: normalizeText(data.dcNumber),
        cylinders: cylindersList,
        notes: normalizeText(data.notes),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      }

      if (emptyReturnEditItem) {
        await updateDocument('emptyReturns', emptyReturnEditItem.id, payload)
        await writeAuditLog({
          action: 'edit',
          collectionName: 'emptyReturns',
          recordId: emptyReturnEditItem.id,
          recordLabel: payload.dcNumber,
          before: emptyReturnEditItem,
          after: payload,
          userProfile,
        })
        toast.success('Empty return updated')
        resetEmptyReturnModal()
        return
      }

      const returnId = await addDocument('emptyReturns', payload)
      await writeAuditLog({
        action: 'create',
        collectionName: 'emptyReturns',
        recordId: returnId,
        recordLabel: payload.dcNumber,
        after: payload,
        userProfile,
      })

      // Record IN movement for each cylinder
      cylindersList.forEach(async (c) => {
        await addDocument('movements', {
          cylinderId: c.cylinderId,
          cylinderCode: c.cylinderCode,
          type: 'IN',
          reason: `Empty Return - ${payload.customerName}`,
          reference: payload.dcNumber,
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
      if (hasDuplicateCylinderIds(validCylinders)) {
        toast.error('Duplicate cylinder selection is not allowed')
        setSaving(false)
        return
      }
      if (hasDuplicateValue(loadReturns, 'dcNumber', data.dcNumber, loadReturnEditItem?.id)) {
        toast.error('Load return DC Number already exists')
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

      const payload = {
        customerName: normalizeText(data.customerName),
        date: data.date,
        dcNumber: normalizeText(data.dcNumber),
        cylinders: cylindersList,
        faultDescription: normalizeText(data.faultDescription),
        notes: normalizeText(data.notes),
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      }

      if (loadReturnEditItem) {
        await updateDocument('loadReturns', loadReturnEditItem.id, payload)
        await writeAuditLog({
          action: 'edit',
          collectionName: 'loadReturns',
          recordId: loadReturnEditItem.id,
          recordLabel: payload.dcNumber,
          before: loadReturnEditItem,
          after: payload,
          userProfile,
        })
        toast.success('Load return updated')
        resetLoadReturnModal()
        return
      }

      const returnId = await addDocument('loadReturns', payload)
      await writeAuditLog({
        action: 'create',
        collectionName: 'loadReturns',
        recordId: returnId,
        recordLabel: payload.dcNumber,
        after: payload,
        userProfile,
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
    setPurchaseEditItem(null)
    setPurchaseBalance('0.00')
    setPurchaseGstPreview(0)
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
    setSaleEditItem(null)
    setSaleBalance('0.00')
    setSaleGstPreview(0)
    setCylinderSearch('')
    setCustomerSearch('')
    setSelectedSaleCustomer(null)
    setSaleCustomerRateDisplay(null)
    setSaleCustomerAllRates(null)
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
    setEmptyReturnEditItem(null)
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
    setLoadReturnEditItem(null)
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
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'voided' ? 'rejected' : 'approved'} label={row.status === 'voided' ? 'Voided' : 'Active'} /> },
    { key: 'currentAmount', label: 'Amount (₹)', render: (row) => fmtCurrency(row.currentAmount) },
    { key: 'gst', label: 'GST %' },
    { key: 'gstAmount', label: 'Tax (₹)', render: (row) => fmtCurrency(row.gstAmount || 0) },
    { key: 'totalAmount', label: 'Total Amount (₹)', render: (row) => fmtCurrency(row.totalAmount || 0) },
    { key: 'paidAmount', label: 'Paid (₹)', render: (row) => fmtCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Balance (₹)', render: (row) => fmtCurrency(row.balanceAmount || 0) },
    { key: 'recordedBy', label: 'By' },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openPurchaseEdit(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 disabled:opacity-40 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setVoidTarget({ collectionName: 'purchases', id: row.id, label: row.dcNumber, record: row })} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-40 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) },
  ]

  const saleColumns = [
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'date', label: 'Date', render: (row) => fmtDate(row.date) },
    { key: 'dcNumber', label: 'DC Number' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'voided' ? 'rejected' : 'approved'} label={row.status === 'voided' ? 'Voided' : 'Active'} /> },
    { key: 'currentAmount', label: 'Amount (₹)', render: (row) => fmtCurrency(row.currentAmount) },
    { key: 'gst', label: 'GST %' },
    { key: 'gstAmount', label: 'Tax (₹)', render: (row) => fmtCurrency(row.gstAmount || 0) },
    { key: 'totalAmount', label: 'Total Amount (₹)', render: (row) => fmtCurrency(row.totalAmount || 0) },
    { key: 'paidAmount', label: 'Paid (₹)', render: (row) => fmtCurrency(row.paidAmount) },
    { key: 'balanceAmount', label: 'Balance (₹)', render: (row) => fmtCurrency(row.balanceAmount || 0) },
    { key: 'recordedBy', label: 'By' },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openSaleEdit(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 disabled:opacity-40 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setVoidTarget({ collectionName: 'sales', id: row.id, label: row.dcNumber, record: row })} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-40 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) },
  ]

  const emptyReturnColumns = [
    { key: 'cylinderCode', label: 'Cylinder Code' },
    { key: 'gasType', label: 'Gas Type' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'voided' ? 'rejected' : 'approved'} label={row.status === 'voided' ? 'Voided' : 'Active'} /> },
    { key: 'notes', label: 'Notes' },
    { key: 'recordedBy', label: 'By' },
    { key: 'createdAt', label: 'Date', render: (row) => fmtDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openEmptyReturnEdit(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 disabled:opacity-40 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setVoidTarget({ collectionName: 'emptyReturns', id: row.sourceId, label: row.dcNumber, record: row })} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-40 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) },
  ]

  const loadReturnColumns = [
    { key: 'cylinderCode', label: 'Cylinder Code' },
    { key: 'gasType', label: 'Gas Type' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'voided' ? 'rejected' : 'approved'} label={row.status === 'voided' ? 'Voided' : 'Active'} /> },
    { key: 'faultDescription', label: 'Fault Description' },
    { key: 'notes', label: 'Notes' },
    { key: 'recordedBy', label: 'By' },
    { key: 'createdAt', label: 'Date', render: (row) => fmtDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openLoadReturnEdit(row)} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 disabled:opacity-40 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setVoidTarget({ collectionName: 'loadReturns', id: row.sourceId, label: row.dcNumber, record: row })} disabled={row.status === 'voided'} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-40 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ) },
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

          {/* Headline KPI — Total Cylinders Purchased */}
          <div className="flex items-center gap-5 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-5 dark:border-indigo-800 dark:from-indigo-900/30 dark:to-blue-900/20">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/50">
              <ShoppingCart className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Total Cylinders Purchased</p>
              <p className="text-4xl font-extrabold tracking-tight text-indigo-900 dark:text-indigo-100">
                {totalCylindersPurchased.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-indigo-500 dark:text-indigo-400">
                Cylinder units across all active purchase records (excluding voided)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Total Cubic Meter Stock" value={formatCubicMeters(liquidOxygenStock.totalCubicMeterStock)} icon={Package} color="blue" />
            <StatCard title="Available Stock" value={formatCubicMeters(liquidOxygenStock.availableStock)} icon={CheckCircle} color="green" />
            <StatCard title="Filled Quantity" value={formatCubicMeters(liquidOxygenStock.filledQuantity)} icon={Wind} color="yellow" />
            <StatCard title="Remaining Quantity" value={formatCubicMeters(liquidOxygenStock.remainingQuantity)} icon={Clock} color="purple" />
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
              <Input {...purchaseForm.register('date')} error={purchaseForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={purchaseForm.formState.errors.dcNumber?.message} required>
              <input
                type="text"
                placeholder="DC Number"
                className="input-field"
                {...purchaseForm.register('dcNumber')}
              />
            </FormField>
          </div>

          {/* Cylinders - Multiple */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders (Multiple)</h3>
            {purchaseForm.watch('cylinders').map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              const alreadySelectedIds = purchaseForm.watch('cylinders').map(c => c.cylinderId).filter(Boolean)
              const inlineError = selectedCylinder ? getPurchaseCylinderError(selectedCylinder) : null
              return (
                <div key={idx} className="mb-3">
                  <div className="flex gap-2">
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
                          className={`input-field pl-10 w-full ${inlineError ? 'border-red-400 focus:ring-red-400' : ''}`}
                        />
                        {!selectedCylinder && cylinderSearch && filteredCylindersForSearch.filter(c => !alreadySelectedIds.includes(c.id)).length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                            {filteredCylindersForSearch.filter(c => !alreadySelectedIds.includes(c.id)).map(c => {
                              const isBlocked = PURCHASE_BLOCKED_STATUSES.includes(c.status)
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    purchaseForm.setValue(`cylinders.${idx}.cylinderId`, c.id)
                                    setCylinderSearch('')
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                                    isBlocked
                                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  <span>{c.cylinderCode} — {c.gasTypeName}</span>
                                  {isBlocked && (
                                    <span className="flex-shrink-0 text-xs font-semibold text-red-600 dark:text-red-400">
                                      {PURCHASE_BLOCKED_LABELS[c.status]}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
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
                  {inlineError && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {inlineError}
                    </p>
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
              className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-1"
            >
              + Add Cylinder
            </button>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Amount (₹)" error={purchaseForm.formState.errors.currentAmount?.message} required>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="input-field"
                {...purchaseForm.register('currentAmount')}
                onChange={(e) => {
                  purchaseForm.setValue('currentAmount', e.target.value)
                }}
              />
            </FormField>
            <FormField label="Paid (₹)" error={purchaseForm.formState.errors.paidAmount?.message} required>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="input-field"
                {...purchaseForm.register('paidAmount')}
                onChange={(e) => {
                  purchaseForm.setValue('paidAmount', e.target.value)
                }}
              />
            </FormField>
            <FormField label="Balance (₹)">
              <input
                type="number"
                value={purchaseBalance}
                disabled
                className="input-field bg-gray-100 dark:bg-gray-700"
              />
            </FormField>
          </div>

          <FormField label="GST %" error={purchaseForm.formState.errors.gst?.message}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              className="input-field"
              {...purchaseForm.register('gst')}
              onChange={(e) => {
                purchaseForm.setValue('gst', e.target.value)
              }}
            />
          </FormField>

          {(purchaseCurrentAmount || purchaseGst) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Calculation Preview</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{parseFloat(purchaseCurrentAmount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Tax ({purchaseGst || 0}%)</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{(((purchaseCurrentAmount || 0) * (purchaseGst || 0)) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Amount</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">₹{(parseFloat(purchaseCurrentAmount || 0) + ((purchaseCurrentAmount || 0) * (purchaseGst || 0)) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Paid Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{parseFloat(purchasePaidAmount || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Balance (Total - Paid)</span>
                  <span className="font-bold text-lg text-red-600 dark:text-red-400">₹{purchaseBalance}</span>
                </div>
              </div>
            </div>
          )}

          <FormField label="Notes">
            <Textarea {...purchaseForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>

          {(() => {
            const hasBlockedCylinder = purchaseForm.watch('cylinders').some(c => {
              const cyl = cylinders.find(cy => cy.id === c.cylinderId)
              return cyl && PURCHASE_BLOCKED_STATUSES.includes(cyl.status)
            })
            return (
              <div className="flex justify-end gap-3 pt-2 border-t">
                <button type="button" onClick={resetPurchaseModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving || hasBlockedCylinder} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Purchase'}
                </button>
              </div>
            )
          })()}
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
                  if (!e.target.value) {
                    saleForm.setValue('customerName', '')
                    saleForm.setValue('currentAmount', '')
                    saleForm.setValue('gst', 0)
                    saleForm.setValue('paidAmount', '')
                    setSelectedSaleCustomer(null)
                    setSaleCustomerRateDisplay(null)
                    setSaleCustomerAllRates(null)
                  } else {
                    setSelectedSaleCustomer(null)
                  }
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
                        saleForm.setValue('paidAmount', '')
                        setCustomerSearch('')
                        setSelectedSaleCustomer(c)
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

          {/* Customer Rate Breakdown */}
          {saleCustomerRateDisplay && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                {saleCustomerRateDisplay.isDefault 
                  ? '✓ Customer Default Rate' 
                  : `✓ Customer Rates Matched (${saleCustomerRateDisplay.cylinderCount} cylinder${saleCustomerRateDisplay.cylinderCount !== 1 ? 's' : ''})`
                }
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Rate Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{saleCustomerRateDisplay.rawAmount}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">GST ({saleCustomerRateDisplay.gstPercent}%)</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{saleCustomerRateDisplay.gstAmount}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-green-300 dark:border-green-600">
                  <p className="text-gray-600 dark:text-gray-400">Total Rate (Amount + GST)</p>
                  <p className="font-bold text-lg text-green-700 dark:text-green-300">₹{saleCustomerRateDisplay.totalAmount}</p>
                </div>
              </div>
              {saleCustomerRateDisplay.isDefault && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Select cylinders to refine rates. Fields auto-filled above.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" error={saleForm.formState.errors.date?.message} required>
              <Input {...saleForm.register('date')} error={saleForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={saleForm.formState.errors.dcNumber?.message} required>
              <input
                type="text"
                placeholder="DC Number"
                className="input-field"
                {...saleForm.register('dcNumber')}
              />
            </FormField>
          </div>

          {/* Cylinders - Full only */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders - Full (Load) Only (Multiple)</h3>
            {saleForm.watch('cylinders').map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              const alreadySelectedIds = saleForm.watch('cylinders').map(c => c.cylinderId).filter(Boolean)
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
                      {!selectedCylinder && (cylinderSearch || saleForm.watch(`cylinders.${idx}.cylinderId`)) && filteredCylindersForSearch.filter(c => c.status === 'full' && !alreadySelectedIds.includes(c.id)).length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {filteredCylindersForSearch.filter(c => c.status === 'full' && !alreadySelectedIds.includes(c.id)).map(c => (
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
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="input-field"
                {...saleForm.register('currentAmount')}
                onChange={(e) => {
                  saleForm.setValue('currentAmount', e.target.value)
                }}
              />
            </FormField>
            <FormField label="Paid (₹)" error={saleForm.formState.errors.paidAmount?.message} required>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="input-field"
                {...saleForm.register('paidAmount')}
                onChange={(e) => {
                  saleForm.setValue('paidAmount', e.target.value)
                }}
              />
            </FormField>
            <FormField label="Balance (₹)">
              <input
                type="number"
                value={saleBalance}
                disabled
                className="input-field bg-gray-100 dark:bg-gray-700"
              />
            </FormField>
          </div>

          <FormField label="GST %" error={saleForm.formState.errors.gst?.message}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              className="input-field"
              {...saleForm.register('gst')}
              onChange={(e) => {
                saleForm.setValue('gst', e.target.value)
              }}
            />
          </FormField>

          {(saleCurrentAmount || saleGst) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Calculation Preview</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{parseFloat(saleCurrentAmount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Tax ({saleGst || 0}%)</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{(((saleCurrentAmount || 0) * (saleGst || 0)) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Amount</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">₹{(parseFloat(saleCurrentAmount || 0) + ((saleCurrentAmount || 0) * (saleGst || 0)) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Paid Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">₹{parseFloat(salePaidAmount || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Balance (Total - Paid)</span>
                  <span className="font-bold text-lg text-red-600 dark:text-red-400">₹{saleBalance}</span>
                </div>
              </div>
            </div>
          )}

          <FormField label="Notes">
            <Textarea {...saleForm.register('notes')} placeholder="Optional notes" rows="2" />
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
              <Input {...emptyReturnForm.register('date')} error={emptyReturnForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={emptyReturnForm.formState.errors.dcNumber?.message} required>
              <input
                type="text"
                placeholder="DC Number"
                className="input-field"
                {...emptyReturnForm.register('dcNumber')}
              />
            </FormField>
          </div>

          {/* Cylinders - Customer wise only */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders (Customer wise sales cylinders only) (Multiple)</h3>
            {emptyReturnForm.watch('cylinders')?.map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              const customerCylinders = getCustomerCylinders(emptyReturnForm.watch('customerName'))
              const alreadySelectedIds = emptyReturnForm.watch('cylinders').map(c => c.cylinderId).filter(Boolean)
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
                      {!selectedCylinder && cylinderSearch && emptyReturnForm.watch('customerName') && customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()) && !alreadySelectedIds.includes(c.id)).length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()) && !alreadySelectedIds.includes(c.id)).map(c => (
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
            <Textarea {...emptyReturnForm.register('notes')} placeholder="Optional notes" rows="2" />
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
              <Input {...loadReturnForm.register('date')} error={loadReturnForm.formState.errors.date} type="date" />
            </FormField>
            <FormField label="DC Number" error={loadReturnForm.formState.errors.dcNumber?.message} required>
              <input
                type="text"
                placeholder="DC Number"
                className="input-field"
                {...loadReturnForm.register('dcNumber')}
              />
            </FormField>
          </div>

          {/* Cylinders - Customer wise only */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Cylinders (Customer wise sales cylinders only) (Multiple)</h3>
            {loadReturnForm.watch('cylinders')?.map((cylinder, idx) => {
              const selectedCylinder = cylinders.find(c => c.id === cylinder.cylinderId)
              const customerCylinders = getCustomerCylinders(loadReturnForm.watch('customerName'))
              const alreadySelectedIds = loadReturnForm.watch('cylinders').map(c => c.cylinderId).filter(Boolean)
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
                      {!selectedCylinder && cylinderSearch && loadReturnForm.watch('customerName') && customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()) && !alreadySelectedIds.includes(c.id)).length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {customerCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()) && !alreadySelectedIds.includes(c.id)).map(c => (
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
            <Textarea {...loadReturnForm.register('faultDescription')} placeholder="Describe the fault..." rows="3" />
          </FormField>

          <FormField label="Notes">
            <Textarea {...loadReturnForm.register('notes')} placeholder="Optional notes" rows="2" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={resetLoadReturnModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Record Return'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => { voidRecord(); setVoidTarget(null) }}
        title="Void Record"
        message="This will mark the selected record as voided and keep it available for audit history."
        confirmText="Void"
      />
    </div>
  )
}
