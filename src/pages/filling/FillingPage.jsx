import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Play, Square, Wind } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { FormField, Select } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { fmtDateTime, fmtDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'

export const FillingPage = () => {
  const { userProfile } = useAuth()
  const { data: fillings, loading } = useFirestoreCollection('fillings')
  const { data: cylinders } = useFirestoreCollection('cylinders')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    fillings, ['cylinderCode', 'gasTypeName', 'status'], 10
  )

  const emptyCylinders = cylinders.filter((c) => c.status === 'empty')

  const onStart = async (data) => {
    setSaving(true)
    try {
      const cylinder = cylinders.find((c) => c.id === data.cylinderId)
      await addDocument('fillings', {
        cylinderId: data.cylinderId,
        cylinderCode: cylinder?.cylinderCode,
        gasTypeName: cylinder?.gasTypeName,
        capacity: cylinder?.capacity,
        startedAt: new Date().toISOString(),
        endedAt: null,
        duration: null,
        status: 'in_progress',
        startedBy: userProfile?.name,
      })
      await updateDocument('cylinders', data.cylinderId, { status: 'in_use' })
      toast.success('Filling started')
      setModalOpen(false)
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
    { key: 'capacity', label: 'Capacity', render: (row) => `${row.capacity} kg` },
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
          <h1 className="page-title">Filling Sessions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track cylinder filling operations</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Play className="h-4 w-4" /> Start Filling
        </button>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Start Filling Session">
        <form onSubmit={handleSubmit(onStart)} className="space-y-4">
          <FormField label="Select Cylinder (Empty)" error={errors.cylinderId?.message} required>
            <select {...register('cylinderId', { required: 'Please select a cylinder' })} className="input-field">
              <option value="">Select an empty cylinder</option>
              {emptyCylinders.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cylinderCode} — {c.gasTypeName} ({c.capacity} kg)
                </option>
              ))}
            </select>
            {errors.cylinderId && <p className="error-text">{errors.cylinderId.message}</p>}
          </FormField>
          {emptyCylinders.length === 0 && (
            <p className="text-yellow-600 text-sm bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              No empty cylinders available. Mark cylinders as empty first.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || emptyCylinders.length === 0} className="btn-primary">
              {saving ? 'Starting...' : 'Start Filling'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
