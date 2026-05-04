import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2, UserCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { customerSchema } from '../../utils/validations'
import { fmtDate } from '../../utils/helpers'

export const CustomersPage = () => {
  const { data: customers, loading } = useFirestoreCollection('customers')
  const { data: areas } = useFirestoreCollection('areas')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors }, control } = useForm({
    resolver: yupResolver(customerSchema),
    defaultValues: { 
      name: '', 
      gstNumber: '',
      phone: '', 
      email: '', 
      address: '', 
      area: '',
      gasTypeWiseRate: []
    },
  })

  const { fields: rateFields, append: appendRate, remove: removeRate } = useFieldArray({
    control,
    name: 'gasTypeWiseRate'
  })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    customers, ['name', 'phone', 'email', 'area'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    reset({ 
      name: '', 
      gstNumber: '',
      phone: '', 
      email: '', 
      address: '', 
      area: '',
      gasTypeWiseRate: []
    })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({ 
      name: item.name, 
      gstNumber: item.gstNumber || '',
      phone: item.phone, 
      email: item.email || '', 
      address: item.address, 
      area: item.area || '',
      gasTypeWiseRate: item.gasTypeWiseRate || []
    })
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = {
        name: data.name,
        gstNumber: data.gstNumber || '',
        phone: data.phone,
        email: data.email || '',
        address: data.address,
        area: data.area,
        gasTypeWiseRate: data.gasTypeWiseRate?.length > 0 ? data.gasTypeWiseRate : [],
      }

      if (editItem) {
        await updateDocument('customers', editItem.id, payload)
        toast.success('Customer updated')
      } else {
        await addDocument('customers', { ...payload, createdAt: new Date().toISOString() })
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
    { key: 'area', label: 'Area/Location', render: (row) => row.area || '—' },
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-96 overflow-y-auto">

          <FormField label="Full Name" error={errors.name?.message} required>
            <Input {...register('name')} error={errors.name} placeholder="Customer full name" />
          </FormField>

          <FormField label="GST Number" error={errors.gstNumber?.message}>
            <Input {...register('gstNumber')} error={errors.gstNumber} placeholder="Optional GST number" />
          </FormField>

          <FormField label="Phone Number" error={errors.phone?.message} required>
            <Input {...register('phone')} error={errors.phone} placeholder="10-digit mobile number" />
          </FormField>

          <FormField label="E Mail" error={errors.email?.message}>
            <Input {...register('email')} error={errors.email} type="email" placeholder="Optional email" />
          </FormField>

          <FormField label="Area/Location" error={errors.area?.message} required>
            <Select {...register('area')} error={errors.area}>
              <option value="">Select area</option>
              {areas.map(a => <option key={a.id} value={a.areaName}>{a.areaName}</option>)}
            </Select>
          </FormField>

          {/* Gas Type Wise Rate */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-3">Gas Type & Capacity Wise Rate</h3>
            {rateFields.length > 0 && (
              <div className="overflow-x-auto mb-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">GAS</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">CAPACITY</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">RATE</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">GST %</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">TOTAL RATE</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rateFields.map((field, idx) => {
                      const selectedGasId = watch(`gasTypeWiseRate.${idx}.gasTypeId`)
                      const selectedGas = gasTypes.find(g => g.id === selectedGasId)
                      const rate = watch(`gasTypeWiseRate.${idx}.rate`) || 0
                      const gst = watch(`gasTypeWiseRate.${idx}.gst`) || 0
                      const totalRate = rate + (rate * gst / 100)
                      
                      return (
                        <tr key={field.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-2">
                            <Select {...register(`gasTypeWiseRate.${idx}.gasTypeId`)}>
                              <option value="">Select gas</option>
                              {gasTypes.map(g => (
                                <option key={g.id} value={g.id}>{g.gasName}</option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              {...register(`gasTypeWiseRate.${idx}.capacity`)}
                              className="input-field w-full"
                            >
                              <option value="">Select</option>
                              {selectedGas?.capacities?.map((c, i) => {
                                const cap = typeof c === 'number' ? { value: c, unit: 'kg' } : c
                                return <option key={i} value={cap.value}>{cap.value}</option>
                              })}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              {...register(`gasTypeWiseRate.${idx}.rate`, { valueAsNumber: true })}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="₹0.00"
                              className="w-full"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              {...register(`gasTypeWiseRate.${idx}.gst`, { valueAsNumber: true })}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              placeholder="0%"
                              className="w-full"
                            />
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-blue-600 dark:text-blue-400">
                            ₹{totalRate.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRate(idx)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <button
              type="button"
              onClick={() => appendRate({ gasTypeId: '', capacity: '', rate: '', gst: 0 })}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Add Gas Type Rate
            </button>
          </div>

          <FormField label="Full Address" error={errors.address?.message} required>
            <Textarea {...register('address')} error={errors.address} placeholder="Complete address" rows="2" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t">
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
