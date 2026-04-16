import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2, Package, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../context/AuthContext'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { useTable } from '../../hooks/useTable'
import { cylinderSchema } from '../../utils/validations'
import { fmtDate } from '../../utils/helpers'

const STATUS_OPTIONS = ['full', 'empty', 'in_use', 'maintenance']

export const CylindersPage = () => {
  const { userProfile } = useAuth()
  const { data: cylinders, loading } = useFirestoreCollection('cylinders')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')
  const { data: customers } = useFirestoreCollection('customers')
  const { data: areas } = useFirestoreCollection('areas')
  const [tab, setTab] = useState('cylinders')
  const [modalOpen, setModalOpen] = useState(false)
  const [historyModal, setHistoryModal] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: yupResolver(cylinderSchema),
    defaultValues: { cylinderCode: '', gasTypeId: '', capacity: '', status: 'full', location: 'Warehouse', client: '' },
  })

  const selectedGasId = watch('gasTypeId')
  const selectedGas = gasTypes.find((g) => g.id === selectedGasId)

  const filtered = statusFilter === 'all' ? cylinders : cylinders.filter((c) => c.status === statusFilter)

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    filtered, ['cylinderCode', 'location'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    reset({ cylinderCode: '', gasTypeId: '', capacity: '', status: 'full', location: 'Warehouse', client: '' })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({ cylinderCode: item.cylinderCode, gasTypeId: item.gasTypeId, capacity: item.capacity, status: item.status, location: item.location, client: item.client })
    setModalOpen(true)
  }

  const getCapacityUnit = (gasName) => {
    const cubicGases = ['Oxygen', 'Argon', 'Nitrogen']
    return cubicGases.some(g => gasName?.toLowerCase().includes(g.toLowerCase())) ? 'cubic' : 'kg'
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const gasType = gasTypes.find((g) => g.id === data.gasTypeId)
      
      // Check for duplicate cylinder code (excluding current edit item)
      const isDuplicate = cylinders.some(c => 
        c.cylinderCode.toLowerCase() === data.cylinderCode.toLowerCase() && 
        c.id !== editItem?.id
      )
      
      if (isDuplicate) {
        toast.error('Cylinder code already exists. Please use a different code.')
        setSaving(false)
        return
      }

      const capacityUnit = getCapacityUnit(gasType?.gasName)
      const payload = { ...data, gasTypeName: gasType?.gasName || '', capacityUnit }
      
      if (editItem) {
        await updateDocument('cylinders', editItem.id, payload)
        
        // Track history
        if (editItem.history === undefined) editItem.history = []
        const historyEntry = {
          user: userProfile?.name || 'System',
          action: `Updated to ${data.status.replace('_', ' ')} at ${data.location}`,
          timestamp: new Date().toISOString(),
        }
        await updateDocument('cylinders', editItem.id, {
          history: [...(editItem.history || []), historyEntry]
        })
        
        toast.success('Cylinder updated')
      } else {
        const newPayload = {
          ...payload,
          history: [{
            user: userProfile?.name || 'System',
            action: 'Cylinder created',
            timestamp: new Date().toISOString(),
          }]
        }
        await addDocument('cylinders', newPayload)
        toast.success('Cylinder added')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error('Failed to save cylinder: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('cylinders', deleteId)
      toast.success('Cylinder deleted')
    } catch {
      toast.error('Failed to delete cylinder')
    }
  }

  const columns = [
    { key: 'cylinderCode', label: 'Code', sortable: true },
    { key: 'gasTypeName', label: 'Gas Type', sortable: true },
    { key: 'capacity', label: 'Capacity', render: (row) => `${row.capacity} ${row.capacityUnit || getCapacityUnit(row.gasTypeName)}` },
    { key: 'client', label: 'Client', sortable: true },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} label={row.status?.replace('_', ' ')} /> },
    { key: 'location', label: 'Location', sortable: true },
    { key: 'createdAt', label: 'Added', render: (row) => fmtDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        {row.history && row.history.length > 0 && (
          <button
            onClick={() => { setSelectedHistory(row); setHistoryModal(true); }}
            className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 transition-colors"
            title="View history"
          >
            <History className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Cylinders</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track all cylinders with client & history</p>
        </div>
        {tab === 'cylinders' && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Cylinder
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'cylinders', label: 'Cylinders' },
          { key: 'history', label: 'History Report' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cylinders' && (
        <>
          {/* Summary badges */}
          <div className="flex gap-2 flex-wrap">
            {['all', ...STATUS_OPTIONS].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {s.replace('_', ' ')}
                {s !== 'all' && ` (${cylinders.filter((c) => c.status === s).length})`}
              </button>
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
                searchPlaceholder="Search by code or location..."
                emptyMessage="No cylinders found."
              />
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="card">
          <h2 className="section-title mb-4">Cylinder Movement History</h2>
          <div className="space-y-4">
            {cylinders.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No cylinders to show history</p>
            ) : (
              cylinders.map(cyl => (
                <div key={cyl.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{cyl.cylinderCode} - {cyl.gasTypeName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Client: {cyl.client || '—'} | Current: {cyl.location} ({cyl.status?.replace('_', ' ')})</p>
                    </div>
                  </div>
                  
                  {cyl.history && cyl.history.length > 0 ? (
                    <div className="ml-4 space-y-2 border-l-2 border-primary-200 dark:border-primary-800 pl-4">
                      {[...cyl.history].reverse().map((entry, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0"></div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{entry.user}</p>
                              <p className="text-gray-600 dark:text-gray-400">{entry.action}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-500">{fmtDate(entry.timestamp, 'dd MMM yyyy HH:mm')}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No history recorded</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Cylinder' : 'Add Cylinder'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Cylinder Code" error={errors.cylinderCode?.message} required>
            <Input register={register('cylinderCode')} error={errors.cylinderCode} placeholder="e.g. CYL-001" />
          </FormField>

          <FormField label="Gas Type" error={errors.gasTypeId?.message} required>
            <Select register={register('gasTypeId')} error={errors.gasTypeId}>
              <option value="">Select gas type</option>
              {gasTypes.map((g) => <option key={g.id} value={g.id}>{g.gasName}</option>)}
            </Select>
          </FormField>

          <FormField label={`Capacity (${selectedGas ? getCapacityUnit(selectedGas.gasName) : 'unit'})`} error={errors.capacity?.message} required>
            <Select register={register('capacity', { valueAsNumber: true })} error={errors.capacity}>
              <option value="">Select capacity</option>
              {(selectedGas?.capacities || []).map((c, i) => {
                const capacity = typeof c === 'number' ? { value: c, unit: 'kg' } : c
                return (
                  <option key={i} value={capacity.value}>{capacity.value} {capacity.unit}</option>
                )
              })}
            </Select>
          </FormField>

          <FormField label="Status" error={errors.status?.message} required>
            <Select register={register('status')} error={errors.status}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
          </FormField>

          <FormField label="Location" error={errors.location?.message} required>
            <Select register={register('location')} error={errors.location}>
              <option value="">Select location/area</option>
              {areas.map((area) => <option key={area.id} value={area.areaName}>{area.areaName}</option>)}
            </Select>
          </FormField>

          <FormField label="Client" error={errors.client?.message} required>
            <Select register={register('client')} error={errors.client}>
              <option value="">Select client</option>
              {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={historyModal} onClose={() => setHistoryModal(false)} title={`Cylinder History - ${selectedHistory?.cylinderCode}`}>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedHistory?.history && selectedHistory.history.length > 0 ? (
            <div className="space-y-3">
              {[...selectedHistory.history].reverse().map((entry, i) => (
                <div key={i} className="flex gap-3 pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{entry.user}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{entry.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{fmtDate(entry.timestamp, 'dd MMM yyyy HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No history available</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Cylinder"
        message="Are you sure you want to delete this cylinder? This cannot be undone."
        confirmText="Delete"
      />
    </div>
  )
}
