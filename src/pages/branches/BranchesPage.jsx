import { useState } from 'react'
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { useTable } from '../../hooks/useTable'
import { fmtDate } from '../../utils/helpers'
import { hasDuplicateValue, normalizeText } from '../../utils/records'

const initialForm = {
  branchName: '',
  branchCode: '',
  address: '',
  contactNumber: '',
  status: 'active',
}

export const BranchesPage = () => {
  const { data: branches, loading } = useFirestoreCollection('branches')
  const { data: customers } = useFirestoreCollection('customers')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(initialForm)

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    branches,
    ['branchName', 'branchCode', 'contactNumber', 'status'],
    10
  )

  const openAdd = () => {
    setEditItem(null)
    setFormData(initialForm)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setFormData({
      branchName: item.branchName || '',
      branchCode: item.branchCode || '',
      address: item.address || '',
      contactNumber: item.contactNumber || '',
      status: item.status || 'active',
    })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const payload = {
      branchName: normalizeText(formData.branchName),
      branchCode: normalizeText(formData.branchCode).toUpperCase(),
      address: normalizeText(formData.address),
      contactNumber: normalizeText(formData.contactNumber),
      status: formData.status || 'active',
    }

    if (!payload.branchName) return toast.error('Branch name is required')
    if (!payload.branchCode) return toast.error('Branch code is required')
    if (!payload.address) return toast.error('Address is required')
    if (!payload.contactNumber) return toast.error('Contact number is required')
    if (!/^[0-9+\-\s()]{7,15}$/.test(payload.contactNumber)) return toast.error('Enter a valid contact number')
    if (hasDuplicateValue(branches, 'branchCode', payload.branchCode, editItem?.id)) return toast.error('Branch code already exists')
    if (hasDuplicateValue(branches, 'branchName', payload.branchName, editItem?.id)) return toast.error('Branch name already exists')

    setSaving(true)
    try {
      if (editItem) {
        await updateDocument('branches', editItem.id, payload)
        toast.success('Branch updated')
      } else {
        await addDocument('branches', payload)
        toast.success('Branch added')
      }
      setModalOpen(false)
      setFormData(initialForm)
    } catch (err) {
      toast.error('Failed to save branch: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const linkedCustomers = customers.filter((customer) => customer.branchId === deleteId)
    if (linkedCustomers.length > 0) {
      toast.error('Cannot delete branch. Reassign linked customers first.')
      return
    }

    try {
      await deleteDocument('branches', deleteId)
      toast.success('Branch deleted')
    } catch (err) {
      toast.error('Failed to delete branch: ' + err.message)
    }
  }

  const columns = [
    { key: 'branchName', label: 'Branch Name', sortable: true },
    { key: 'branchCode', label: 'Branch Code', sortable: true },
    { key: 'address', label: 'Address', render: (row) => <span className="truncate max-w-xs block">{row.address}</span> },
    { key: 'contactNumber', label: 'Contact Number' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'active' ? 'approved' : 'inactive'} label={row.status || 'active'} /> },
    { key: 'updatedAt', label: 'Updated', render: (row) => fmtDate(row.updatedAt || row.createdAt) },
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Branch Master
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage branches and customer branch mapping</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Branch
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
            searchPlaceholder="Search branches..."
            emptyMessage="No branches found. Add one to get started."
          />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Branch' : 'Add Branch'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Branch Name" required>
              <Input value={formData.branchName} onChange={(e) => setFormData({ ...formData, branchName: e.target.value })} placeholder="Main Branch" />
            </FormField>
            <FormField label="Branch Code" required>
              <Input value={formData.branchCode} onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })} placeholder="BR-001" />
            </FormField>
            <FormField label="Contact Number" required>
              <Input value={formData.contactNumber} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} placeholder="Contact number" />
            </FormField>
            <FormField label="Status" required>
              <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Address" required>
            <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows="3" placeholder="Branch address" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Branch'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Branch"
        message="Are you sure you want to delete this branch? Branches linked with customers cannot be deleted."
        confirmText="Delete"
      />
    </div>
  )
}
