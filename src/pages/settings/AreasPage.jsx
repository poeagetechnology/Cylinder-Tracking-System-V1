import { useState } from 'react'
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { fmtDate } from '../../utils/helpers'

export const AreasPage = () => {
  const { data: areas, loading } = useFirestoreCollection('areas')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ areaName: '', description: '' })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    areas, ['areaName'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    setFormData({ areaName: '', description: '' })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setFormData({ areaName: item.areaName, description: item.description || '' })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    if (!formData.areaName.trim()) {
      toast.error('Area name is required')
      return
    }

    setSaving(true)
    try {
      if (editItem) {
        await updateDocument('areas', editItem.id, formData)
        toast.success('Area updated')
      } else {
        await addDocument('areas', formData)
        toast.success('Area added')
      }
      setModalOpen(false)
      setFormData({ areaName: '', description: '' })
    } catch {
      toast.error('Failed to save area')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('areas', deleteId)
      toast.success('Area deleted')
    } catch {
      toast.error('Failed to delete area')
    }
  }

  const columns = [
    { key: 'areaName', label: 'Area Name', sortable: true },
    { key: 'description', label: 'Description', render: (row) => <span className="truncate max-w-xs block">{row.description || '—'}</span> },
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
          <h1 className="page-title flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Areas & Locations
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage delivery areas and locations</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Area
        </button>
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
            searchPlaceholder="Search areas..."
            emptyMessage="No areas found. Add one to get started."
          />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Area' : 'Add Area'}>
        <div className="space-y-4">
          <FormField label="Area Name" required>
            <input
              type="text"
              value={formData.areaName}
              onChange={(e) => setFormData({ ...formData, areaName: e.target.value })}
              placeholder="e.g. North Zone, Downtown, Industrial Area"
              className="input-field"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description or remarks"
              rows="3"
              className="input-field resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={onSubmit} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Area"
        message="Are you sure you want to delete this area? This action cannot be undone."
        confirmText="Delete"
      />
    </div>
  )
}
