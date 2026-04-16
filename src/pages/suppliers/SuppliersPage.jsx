import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { supplierSchema } from '../../utils/validations'
import { fmtDate } from '../../utils/helpers'

export const SuppliersPage = () => {
  const { data: suppliers, loading } = useFirestoreCollection('suppliers')
  const { data: areas } = useFirestoreCollection('areas')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(supplierSchema),
    defaultValues: { name: '', contactPerson: '', gstNumber: '', phone: '', email: '', area: '', address: '' },
  })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    suppliers, ['name', 'contactPerson', 'phone'], 10
  )

  const openAdd = () => { setEditItem(null); reset({ name: '', contactPerson: '', gstNumber: '', phone: '', email: '', area: '', address: '' }); setModalOpen(true) }
  const openEdit = (item) => { setEditItem(item); reset({ name: item.name, contactPerson: item.contactPerson, gstNumber: item.gstNumber || '', phone: item.phone, email: item.email || '', area: item.area || '', address: item.address }); setModalOpen(true) }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editItem) { await updateDocument('suppliers', editItem.id, data); toast.success('Supplier updated') }
      else { await addDocument('suppliers', data); toast.success('Supplier added') }
      setModalOpen(false)
    } catch { toast.error('Failed to save supplier') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try { await deleteDocument('suppliers', deleteId); toast.success('Supplier deleted') }
    catch { toast.error('Failed to delete') }
  }

  const columns = [
    { key: 'name', label: 'Company Name', sortable: true },
    { key: 'contactPerson', label: 'Contact Person', sortable: true },
    { key: 'phone', label: 'Phone' },
    { key: 'area', label: 'Area/Location' },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'address', label: 'Address', render: (r) => <span className="truncate max-w-xs block">{r.address}</span> },
    { key: 'createdAt', label: 'Added', render: (r) => fmtDate(r.createdAt) },
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex items-center gap-2">
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
        <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Suppliers</h1><p className="text-gray-500 dark:text-gray-400 mt-1">Manage your supplier database</p></div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" /> Add Supplier</button>
      </div>
      <div className="card">
        {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
          <Table columns={columns} rows={rows} search={search} onSearch={setSearch} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} page={page} totalPages={totalPages} totalRows={totalRows} onPageChange={setPage} searchPlaceholder="Search suppliers..." emptyMessage="No suppliers yet." />
        )}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Company Name" error={errors.name?.message} required><Input register={register('name')} error={errors.name} placeholder="Company name" /></FormField>
          <FormField label="Contact Person Name" error={errors.contactPerson?.message} required><Input register={register('contactPerson')} error={errors.contactPerson} placeholder="Contact person name" /></FormField>
          <FormField label="GST Number" error={errors.gstNumber?.message}><Input register={register('gstNumber')} error={errors.gstNumber} placeholder="Optional" /></FormField>
          <FormField label="Phone Number" error={errors.phone?.message} required><Input register={register('phone')} error={errors.phone} placeholder="10-digit number" /></FormField>
          <FormField label="E Mail" error={errors.email?.message}><Input register={register('email')} error={errors.email} type="email" placeholder="Optional" /></FormField>
          <FormField label="Area/Location" error={errors.area?.message} required>
            <Select register={register('area')} error={errors.area}>
              <option value="">Select area</option>
              {areas?.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Full Address" error={errors.address?.message} required><Textarea register={register('address')} error={errors.address} placeholder="Full address" /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Supplier" message="Delete this supplier? This cannot be undone." confirmText="Delete" />
    </div>
  )
}
