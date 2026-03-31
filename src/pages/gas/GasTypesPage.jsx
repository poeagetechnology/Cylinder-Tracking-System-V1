import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Trash2, Edit2, Flame } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { gasTypeSchema } from '../../utils/validations'

const defaultValues = { gasName: '', capacities: [{ value: 47, unit: 'kg' }] }

export const GasTypesPage = () => {
  const { data: gasTypes, loading } = useFirestoreCollection('gasTypes')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: yupResolver(gasTypeSchema),
    defaultValues,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'capacities' })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    gasTypes, ['gasName'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    reset(defaultValues)
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    const capacities = (item.capacities || [{ value: 47, unit: 'kg' }]).map(c => 
      typeof c === 'number' ? { value: c, unit: 'kg' } : c
    )
    reset({ gasName: item.gasName, capacities })
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editItem) {
        await updateDocument('gasTypes', editItem.id, data)
        toast.success('Gas type updated')
      } else {
        await addDocument('gasTypes', data)
        toast.success('Gas type added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save gas type')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('gasTypes', deleteId)
      toast.success('Gas type deleted')
    } catch {
      toast.error('Failed to delete gas type')
    }
  }

  const columns = [
    { key: 'gasName', label: 'Gas Name', sortable: true },
    { key: 'capacities', label: 'Capacities', render: (row) => (
      <div className="flex flex-wrap gap-1">
        {(row.capacities || []).map((c, i) => {
          const capacity = typeof c === 'number' ? { value: c, unit: 'kg' } : c
          return <span key={i} className="badge-blue">{capacity.value} {capacity.unit}</span>
        })}
      </div>
    )},
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
          <h1 className="page-title">Gas Types</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage gas types and their cylinder capacities</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Gas Type
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
            searchPlaceholder="Search gas types..."
            emptyMessage="No gas types yet. Add one to get started."
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Gas Type' : 'Add Gas Type'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Gas Name" error={errors.gasName?.message} required>
            <Input register={register('gasName')} error={errors.gasName} placeholder="e.g. Oxygen, Nitrogen" />
          </FormField>

          <div>
            <label className="label">Capacities</label>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    {...register(`capacities.${index}.value`, { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    placeholder="e.g. 0.75"
                    className="input-field flex-1"
                  />
                  <select
                    {...register(`capacities.${index}.unit`)}
                    className="input-field w-24"
                  >
                    <option value="kg">kg</option>
                    <option value="cubic">cubic</option>
                  </select>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {errors.capacities && <p className="error-text">{errors.capacities.message || errors.capacities[0]?.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => append({ value: 47, unit: 'kg' })}
              className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus className="h-4 w-4" /> Add Capacity
            </button>
          </div>

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
        title="Delete Gas Type"
        message="Are you sure you want to delete this gas type? This cannot be undone."
        confirmText="Delete"
      />
    </div>
  )
}
