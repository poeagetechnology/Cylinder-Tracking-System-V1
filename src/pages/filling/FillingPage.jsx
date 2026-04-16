import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Play, Square, Wind, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { FormField, Select, Input } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { fmtDateTime, fmtDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'

export const FillingPage = () => {
  const { userProfile } = useAuth()
  const { data: fillings, loading } = useFirestoreCollection('fillings')
  const { data: cylinders } = useFirestoreCollection('cylinders')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cylinderSearch, setCylinderSearch] = useState('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    fillings, ['cylinderCode', 'gasTypeName', 'status'], 10
  )

  const emptyCylinders = cylinders.filter((c) => c.status === 'empty')
  const filteredCylinders = cylinderSearch 
    ? emptyCylinders.filter(c => c.cylinderCode.toLowerCase().includes(cylinderSearch.toLowerCase()))
    : emptyCylinders

  const getCapacityUnit = (gasName) => {
    const cubicGases = ['Oxygen', 'Argon', 'Nitrogen']
    return cubicGases.some(g => gasName?.toLowerCase().includes(g.toLowerCase())) ? 'cubic' : 'kg'
  }

  const onStart = async (data) => {
    setSaving(true)
    try {
      const cylinder = cylinders.find((c) => c.id === data.cylinderId)
      const capacityUnit = getCapacityUnit(cylinder?.gasTypeName)
      await addDocument('fillings', {
        cylinderId: data.cylinderId,
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
      await updateDocument('cylinders', data.cylinderId, { status: 'in_use' })
      toast.success('Filling started')
      setModalOpen(false)
      setCylinderSearch('')
      reset()
    } catch {
      toast.error('Failed to start filling')
    } finally {
      setSaving(false)
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
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Play className="h-4 w-4" /> Start Filling
        </button>
      </div>

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
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">0</p>
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

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setCylinderSearch(''); }} title="Start Filling Session">
        <form onSubmit={handleSubmit(onStart)} className="space-y-4">
          <FormField label="Search Cylinder by Number" required>
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

          <FormField label="Select Cylinder (Empty)" error={errors.cylinderId?.message} required>
            <select {...register('cylinderId', { required: 'Please select a cylinder' })} className="input-field">
              <option value="">Select an empty cylinder</option>
              {filteredCylinders.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cylinderCode} — {c.gasTypeName} ({c.capacity} {getCapacityUnit(c.gasTypeName)})
                </option>
              ))}
            </select>
            {errors.cylinderId && <p className="error-text">{errors.cylinderId.message}</p>}
          </FormField>

          {filteredCylinders.length === 0 && cylinderSearch && (
            <p className="text-blue-600 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              No matching cylinders found. Try a different search term.
            </p>
          )}

          {emptyCylinders.length === 0 && !cylinderSearch && (
            <p className="text-yellow-600 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              No empty cylinders available. Mark cylinders as empty first.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setCylinderSearch(''); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || emptyCylinders.length === 0} className="btn-primary">
              {saving ? 'Starting...' : 'Start Filling'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
