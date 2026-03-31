import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { customerSchema } from '../../utils/validations'
import { fmtDate } from '../../utils/helpers'

export const CustomersPage = () => {
  const { data: customers, loading } = useFirestoreCollection('customers')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(customerSchema),
    defaultValues: { name: '', phone: '', email: '', address: '' },
  })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    customers, ['name', 'phone', 'email'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    reset({ name: '', phone: '', email: '', address: '' })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({ name: item.name, phone: item.phone, email: item.email || '', address: item.address })
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editItem) {
        await updateDocument('customers', editItem.id, data)
        toast.success('Customer updated')
      } else {
        await addDocument('customers', data)
        toast.success('Customer added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('customers', deleteId)
      toast.success('Customer deleted')
    } catch {
      toast.error('Failed to delete customer')
    }
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (row) => row.email || '—' },
    { key: 'address', label: 'Address', render: (row) => <span className="truncate max-w-xs block">{row.address}</span> },
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
          <h1 className="page-title">Customers</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your customer database</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Customer
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
            searchPlaceholder="Search customers..."
            emptyMessage="No customers yet. Add one to get started."
          />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Full Name" error={errors.name?.message} required>
            <Input register={register('name')} error={errors.name} placeholder="Customer name" />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message} required>
            <Input register={register('phone')} error={errors.phone} placeholder="10-digit mobile number" />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <Input register={register('email')} error={errors.email} type="email" placeholder="Optional email" />
          </FormField>
          <FormField label="Address" error={errors.address?.message} required>
            <Textarea register={register('address')} error={errors.address} placeholder="Full address" />
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
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This cannot be undone."
        confirmText="Delete"
      />
    </div>
  )
}
