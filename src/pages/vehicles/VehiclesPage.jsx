import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2, Truck, Fuel } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { useTable } from '../../hooks/useTable'
import { vehicleSchema } from '../../utils/validations'
import { fmtDate, fmtCurrency } from '../../utils/helpers'

const VEHICLE_TYPES = ['Truck', 'Van', 'Pickup', 'Tempo', 'Auto', 'Other']
const FUEL_LOG_DEFAULT = { vehicleId: '', vehicleNumber: '', fuelLitres: '', fuelCost: '', odometer: '', date: '' }

export const VehiclesPage = () => {
  const { data: vehicles, loading } = useFirestoreCollection('vehicles')
  const { data: fuelLogs } = useFirestoreCollection('fuelLogs')
  const [modalOpen, setModalOpen] = useState(false)
  const [fuelModalOpen, setFuelModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(vehicleSchema),
    defaultValues: { vehicleNumber: '', vehicleType: '', driverName: '', capacity: '' },
  })

  const fuelForm = useForm({ defaultValues: FUEL_LOG_DEFAULT })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    vehicles, ['vehicleNumber', 'driverName', 'vehicleType'], 10
  )

  const openAdd = () => {
    setEditItem(null)
    reset({ vehicleNumber: '', vehicleType: '', driverName: '', capacity: '' })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({ vehicleNumber: item.vehicleNumber, vehicleType: item.vehicleType, driverName: item.driverName, capacity: item.capacity })
    setModalOpen(true)
  }

  const openFuelLog = (vehicle) => {
    setSelectedVehicle(vehicle)
    fuelForm.reset({ vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber, fuelLitres: '', fuelCost: '', odometer: '', date: new Date().toISOString().split('T')[0] })
    setFuelModalOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editItem) {
        await updateDocument('vehicles', editItem.id, data)
        toast.success('Vehicle updated')
      } else {
        await addDocument('vehicles', { ...data, status: 'active' })
        toast.success('Vehicle added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save vehicle')
    } finally {
      setSaving(false)
    }
  }

  const onFuelLog = async (data) => {
    setSaving(true)
    try {
      await addDocument('fuelLogs', { ...data, fuelLitres: Number(data.fuelLitres), fuelCost: Number(data.fuelCost), odometer: Number(data.odometer) })
      toast.success('Fuel log added')
      setFuelModalOpen(false)
    } catch {
      toast.error('Failed to add fuel log')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('vehicles', deleteId)
      toast.success('Vehicle deleted')
    } catch {
      toast.error('Failed to delete vehicle')
    }
  }

  const columns = [
    { key: 'vehicleNumber', label: 'Vehicle No.', sortable: true },
    { key: 'vehicleType', label: 'Type', sortable: true },
    { key: 'driverName', label: 'Driver', sortable: true },
    { key: 'capacity', label: 'Capacity', render: (r) => `${r.capacity} cylinders` },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status || 'active'} /> },
    {
      key: 'actions', label: 'Actions', render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openFuelLog(row)} title="Add Fuel Log" className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600 transition-colors">
            <Fuel className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const fuelColumns = [
    { key: 'vehicleNumber', label: 'Vehicle' },
    { key: 'date', label: 'Date' },
    { key: 'fuelLitres', label: 'Litres', render: (r) => `${r.fuelLitres} L` },
    { key: 'fuelCost', label: 'Cost', render: (r) => fmtCurrency(r.fuelCost) },
    { key: 'odometer', label: 'Odometer', render: (r) => `${r.odometer} km` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage fleet and fuel logs</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Fleet</h2>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <Table columns={columns} rows={rows} search={search} onSearch={setSearch}
            sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
            page={page} totalPages={totalPages} totalRows={totalRows} onPageChange={setPage}
            searchPlaceholder="Search vehicles..." emptyMessage="No vehicles added yet." />
        )}
      </div>

      {/* Recent Fuel Logs */}
      <div className="card">
        <h2 className="section-title mb-4">Recent Fuel Logs</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>{fuelColumns.map(c => <th key={c.key} className="table-header">{c.label}</th>)}</tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {fuelLogs.slice(0, 10).map((log) => (
                <tr key={log.id} className="table-row">
                  {fuelColumns.map(c => (
                    <td key={c.key} className="table-cell">{c.render ? c.render(log) : log[c.key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
              {fuelLogs.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No fuel logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vehicle Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Vehicle Number" error={errors.vehicleNumber?.message} required>
            <Input register={register('vehicleNumber')} error={errors.vehicleNumber} placeholder="e.g. TN-01-AB-1234" />
          </FormField>
          <FormField label="Vehicle Type" error={errors.vehicleType?.message} required>
            <Select register={register('vehicleType')} error={errors.vehicleType}>
              <option value="">Select type</option>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="Driver Name" error={errors.driverName?.message} required>
            <Input register={register('driverName')} error={errors.driverName} placeholder="Driver full name" />
          </FormField>
          <FormField label="Cylinder Capacity" error={errors.capacity?.message} required>
            <Input register={register('capacity', { valueAsNumber: true })} error={errors.capacity} type="number" placeholder="Max cylinders" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Fuel Log Modal */}
      <Modal isOpen={fuelModalOpen} onClose={() => setFuelModalOpen(false)} title={`Fuel Log — ${selectedVehicle?.vehicleNumber}`}>
        <form onSubmit={fuelForm.handleSubmit(onFuelLog)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fuel (Litres)" required>
              <input {...fuelForm.register('fuelLitres', { required: true, valueAsNumber: true })} type="number" step="0.1" className="input-field" placeholder="e.g. 40" />
            </FormField>
            <FormField label="Fuel Cost (₹)" required>
              <input {...fuelForm.register('fuelCost', { required: true, valueAsNumber: true })} type="number" className="input-field" placeholder="e.g. 4000" />
            </FormField>
            <FormField label="Odometer (km)" required>
              <input {...fuelForm.register('odometer', { required: true, valueAsNumber: true })} type="number" className="input-field" placeholder="Current reading" />
            </FormField>
            <FormField label="Date" required>
              <input {...fuelForm.register('date', { required: true })} type="date" className="input-field" />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFuelModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Log'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Vehicle" message="Are you sure you want to delete this vehicle?" confirmText="Delete" />
    </div>
  )
}
