import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Play, Square, Wind, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { FormField, Input, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { fmtDateTime, fmtDate, fmtCurrency } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'

export const FillingPage = () => {
  const { userProfile } = useAuth()
  const { data: fillings, loading } = useFirestoreCollection('fillings')
  const { data: cylinders } = useFirestoreCollection('cylinders')
  const { data: purchases } = useFirestoreCollection('purchases')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cylinderSearch, setCylinderSearch] = useState('')
  const [selectedCylinders, setSelectedCylinders] = useState([])

  // Purchase modal state
  const [purchaseModal, setPurchaseModal] = useState(false)
  const [purchaseSaving, setPurchaseSaving] = useState(false)

  // Purchase form
  const purchaseForm = useForm({
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
  const [balance, setBalance] = useState('0.00')
  const currentAmount = purchaseForm.watch('currentAmount')
  const paidAmount = purchaseForm.watch('paidAmount')
  
  useEffect(() => {
    const amount = parseFloat(currentAmount) || 0
    const paid = parseFloat(paidAmount) || 0
    setBalance((amount - paid).toFixed(2))
  }, [currentAmount, paidAmount])
  // Filter purchases for filling only
  const fillingPurchases = purchases.filter(p => p.forFilling)
  const { rows: purchaseRows } = useTable(fillingPurchases, ['supplierName', 'dcNumber'], 10)

  // Purchase columns
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
  // Purchase modal handlers
  const resetPurchaseModal = () => {
    setPurchaseModal(false)
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

  const onPurchaseSubmit = async (data) => {
    setPurchaseSaving(true)
    try {
      const validCylinders = data.cylinders.filter(c => c.cylinderId && c.cylinderId.trim() !== '')
      if (validCylinders.length === 0) {
        toast.error('Please select at least one cylinder')
        setPurchaseSaving(false)
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
      const balanceAmount = currentAmount - paidAmount
      const gst = data.gst || 0
      const gstAmount = (currentAmount * gst) / 100
      const purchaseData = {
        supplierName: data.supplierName,
        date: data.date || new Date().toISOString().split('T')[0],
        dcNumber: data.dcNumber,
        cylinders: cylindersList,
        currentAmount,
        paidAmount,
        balanceAmount,
        gst,
        gstAmount,
        totalAmount: currentAmount + gstAmount,
        notes: data.notes,
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
        forFilling: true,
      }
      await addDocument('purchases', purchaseData)
      toast.success('Purchase recorded for Filling')
      resetPurchaseModal()
    } catch (err) {
      toast.error('Failed to record purchase: ' + err.message)
    } finally {
      setPurchaseSaving(false)
    }
  }

  const { handleSubmit, reset, formState: { errors } } = useForm()

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    fillings, ['cylinderCode', 'gasTypeName', 'status'], 10
  )

  // Filter to only Oxygen gas type
  const oxygenCylinders = cylinders.filter((c) => c.gasTypeName?.toLowerCase().includes('oxygen'))
  const emptyCylinders = oxygenCylinders.filter((c) => c.status === 'empty')
  const filteredCylinders = cylinderSearch 
    ? emptyCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()))
    : emptyCylinders

  const getCapacityUnit = (gasName) => {
    const cubicGases = ['Oxygen', 'Argon', 'Nitrogen']
    return cubicGases.some(g => gasName?.toLowerCase().includes(g.toLowerCase())) ? 'cubic' : 'kg'
  }

  const onStart = async () => {
    if (selectedCylinders.length === 0) {
      toast.error('Please select at least one cylinder')
      return
    }

    setSaving(true)
    try {
      for (const cylinderId of selectedCylinders) {
        const cylinder = cylinders.find((c) => c.id === cylinderId)
        const capacityUnit = getCapacityUnit(cylinder?.gasTypeName)
        await addDocument('fillings', {
          cylinderId: cylinderId,
          cylinderCode: cylinder?.cylinderCode,
          gasTypeName: cylinder?.gasTypeName,
          capacity: cylinder?.capacity,
          capacityUnit,
          startedAt: new Date().toISOString(),
          endedAt: null,
          duration: null,
          status: 'in_progress',
          startedBy: userProfile?.name,
        })
        await updateDocument('cylinders', cylinderId, { status: 'in_use' })
      }
      toast.success(`Filling started for ${selectedCylinders.length} cylinder(s)`)
      setModalOpen(false)
      setCylinderSearch('')
      setSelectedCylinders([])
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
    { key: 'gasTypeName', label: 'Gas Type', sortable: true },
    { key: 'capacity', label: 'Capacity', render: (row) => `${row.capacity} ${row.capacityUnit || getCapacityUnit(row.gasTypeName)}` },
    { key: 'startedAt', label: 'Started', render: (row) => fmtDateTime(row.startedAt) },
    { key: 'endedAt', label: 'Ended', render: (row) => row.endedAt ? fmtDateTime(row.endedAt) : '—' },
    { key: 'duration', label: 'Duration', render: (row) => row.duration ? `${row.duration} min` : '—' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'in_progress' ? 'pending' : 'approved'} label={row.status === 'in_progress' ? 'In Progress' : 'Completed'} /> },
    { key: 'startedBy', label: 'By' },
    { key: 'actions', label: 'Actions', render: (row) => (
      row.status === 'in_progress' ? (
        <button onClick={() => handleEnd(row)} className="flex items-center gap-1 btn-danger text-xs px-2 py-1">
          <Square className="h-3.5 w-3.5" /> End Filling
        </button>
      ) : <span className="text-gray-400 text-xs">—</span>
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
      <Modal isOpen={purchaseModal} onClose={resetPurchaseModal} title="Purchase for Filling">
        <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4 max-h-96 overflow-y-auto">
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
                      {!selectedCylinder && (cylinderSearch || purchaseForm.watch(`cylinders.${idx}.cylinderId`)) && cylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase())).length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 max-h-40 overflow-y-auto z-10">
                          {cylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase())).map(c => (
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
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="grid grid-cols-3 gap-2 text-sm">
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

      {/* Three Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PURCHASE Section */}
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">PURCHASE</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">For Liquid oxygen in cubic meter</p>
            </div>
            <Plus className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fillingPurchases.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Purchase orders</p>
          </div>
        </div>

        {/* FILLING Section */}
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">FILLING</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select cylinder in number – calculate capacity automatically</p>
            </div>
            <Play className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fillings.filter(f => f.status === 'in_progress').length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">In progress</p>
          </div>
        </div>

        {/* STOCK Section */}
        <div className="card border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">STOCK</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(Old stock + Purchase) - Filling</p>
            </div>
            <Wind className="h-5 w-5 text-green-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{emptyCylinders.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Available cylinders</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: fillings.length, color: 'text-blue-600' },
          { label: 'In Progress', value: fillings.filter((f) => f.status === 'in_progress').length, color: 'text-yellow-600' },
          { label: 'Completed', value: fillings.filter((f) => f.status === 'completed').length, color: 'text-green-600' },
          { label: 'Available Cylinders', value: emptyCylinders.length, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
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

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setCylinderSearch(''); setSelectedCylinders([]); }} title="Start Filling Session">
        <div className="space-y-4">
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

          <FormField label="Select Cylinders (Empty)" required>
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
                      {c.cylinderCode} — {c.gasTypeName} ({c.capacity} {getCapacityUnit(c.gasTypeName)})
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
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <span className="font-semibold">{selectedCylinders.length}</span> cylinder(s) selected for filling
              </p>
            </div>
          )}

          {emptyCylinders.length === 0 && !cylinderSearch && (
            <p className="text-yellow-600 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              No empty Oxygen cylinders available. Mark Oxygen cylinders as empty first.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setCylinderSearch(''); setSelectedCylinders([]); }} className="btn-secondary">Cancel</button>
            <button type="button" onClick={onStart} disabled={saving || selectedCylinders.length === 0} className="btn-primary">
              {saving ? 'Starting...' : `Start Filling (${selectedCylinders.length})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
