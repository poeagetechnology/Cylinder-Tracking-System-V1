import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
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
const LOCATION_OPTIONS = ['Warehouse', 'Customer Site', 'Filling Station', 'Vehicle', 'Maintenance']

export const CylindersPage = () => {
  const { data: cylinders, loading } = useFirestoreCollection('cylinders')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: yupResolver(cylinderSchema),
    defaultValues: { cylinderCode: '', gasTypeId: '', capacity: '', status: 'full', location: 'Warehouse' },
  })

  const selectedGasId = watch('gasTypeId')
  const selectedGas = gasTypes.find((g) => g.id === selectedGasId)

  const filtered = statusFilter === 'all' ? cylinders : cylinders.filter((c) => c.status === statusFilter)

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    filtered, ['cylinderCode', 'location'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    reset({ cylinderCode: '', gasTypeId: '', capacity: '', status: 'full', location: 'Warehouse' })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({ cylinderCode: item.cylinderCode, gasTypeId: item.gasTypeId, capacity: item.capacity, status: item.status, location: item.location })
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const gasType = gasTypes.find((g) => g.id === data.gasTypeId)
      const payload = { ...data, gasTypeName: gasType?.gasName || '' }
      if (editItem) {
        await updateDocument('cylinders', editItem.id, payload)
        toast.success('Cylinder updated')
      } else {
        await addDocument('cylinders', payload)
        toast.success('Cylinder added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save cylinder')
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
    { key: 'capacity', label: 'Capacity', render: (row) => `${row.capacity} kg` },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} label={row.status?.replace('_', ' ')} /> },
    { key: 'location', label: 'Location', sortable: true },
    { key: 'createdAt', label: 'Added', render: (row) => fmtDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and track all cylinders</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Cylinder
        </button>
      </div>

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

          <FormField label="Capacity (kg)" error={errors.capacity?.message} required>
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
              {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
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
