import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import * as Yup from 'yup'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../context/AuthContext'
import { addDocument } from '../../services/firestoreService'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { StatCard } from '../../components/ui/StatCard'
import { Table } from '../../components/ui/Table'
import { useTable } from '../../hooks/useTable'
import { fmtDate, fmtCurrency } from '../../utils/helpers'

const movementSchema = Yup.object({
  cylinderId: Yup.string().required('Cylinder is required'),
  gasType: Yup.string().required('Gas type is required'),
  weight: Yup.number().positive('Weight must be positive').required('Weight is required'),
  clientName: Yup.string().required('Client name is required'),
  dccNumber: Yup.string().required('DCC number is required'),
  date: Yup.string().required('Date is required'),
  notes: Yup.string(),
})

export const MovementsPage = () => {
  const { userProfile } = useAuth()
  const { data: cylinders } = useFirestoreCollection('cylinders')
  const { data: customers } = useFirestoreCollection('customers')
  const { data: movements } = useFirestoreCollection('movements')
  const { data: gasTypes } = useFirestoreCollection('gasTypes')

  const [inModal, setInModal] = useState(false)
  const [outModal, setOutModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [movementFilter, setMovementFilter] = useState('all')
  const [gasFilter, setGasFilter] = useState('all')

  const inForm = useForm({
    resolver: yupResolver(movementSchema),
    defaultValues: { cylinderId: '', gasType: '', weight: '', clientName: '', dccNumber: '', date: new Date().toISOString().split('T')[0], notes: '' },
  })

  const outForm = useForm({
    resolver: yupResolver(movementSchema),
    defaultValues: { cylinderId: '', gasType: '', weight: '', clientName: '', dccNumber: '', date: new Date().toISOString().split('T')[0], notes: '' },
  })

  const selectedInCylinderId = inForm.watch('cylinderId')
  const selectedOutCylinderId = outForm.watch('cylinderId')

  const inCylinder = cylinders.find(c => c.id === selectedInCylinderId)
  const outCylinder = cylinders.find(c => c.id === selectedOutCylinderId)

  // Auto-fill gas type and weight when cylinder is selected
  if (inCylinder && inForm.getValues('gasType') !== inCylinder.gasTypeName) {
    inForm.setValue('gasType', inCylinder.gasTypeName)
    inForm.setValue('weight', inCylinder.capacity)
  }

  if (outCylinder && outForm.getValues('gasType') !== outCylinder.gasTypeName) {
    outForm.setValue('gasType', outCylinder.gasTypeName)
    outForm.setValue('weight', outCylinder.capacity)
  }

  // Filter movements
  const filteredMovements = movements.filter(m => {
    const matchesSearch = !searchTerm || 
      m.cylinderCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.dccNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = movementFilter === 'all' || m.type === movementFilter
    const matchesGas = gasFilter === 'all' || m.gasType === gasFilter
    
    return matchesSearch && matchesType && matchesGas
  })

  const { rows, page, setPage, totalPages, totalRows } = useTable(
    filteredMovements, ['cylinderCode', 'clientName'], 10
  )

  // Stats
  const totalMovements = movements.length
  const cylindersIn = movements.filter(m => m.type === 'in').length
  const cylindersOut = movements.filter(m => m.type === 'out').length

  // Get unique gas types
  const gasTypeOptions = [...new Set(gasTypes.map(g => g.gasName))].sort()

  const onInSubmit = async (data) => {
    setSaving(true)
    try {
      const cylinder = cylinders.find(c => c.id === data.cylinderId)
      await addDocument('movements', {
        ...data,
        type: 'in',
        cylinderCode: cylinder?.cylinderCode || '',
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })
      toast.success('Cylinder IN recorded')
      setInModal(false)
      inForm.reset({ cylinderId: '', gasType: '', weight: '', clientName: '', dccNumber: '', date: new Date().toISOString().split('T')[0], notes: '' })
    } catch (err) {
      toast.error('Failed to record: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const onOutSubmit = async (data) => {
    setSaving(true)
    try {
      const cylinder = cylinders.find(c => c.id === data.cylinderId)
      await addDocument('movements', {
        ...data,
        type: 'out',
        cylinderCode: cylinder?.cylinderCode || '',
        recordedBy: userProfile?.name || 'System',
        createdAt: new Date().toISOString(),
      })
      toast.success('Cylinder OUT recorded')
      setOutModal(false)
      outForm.reset({ cylinderId: '', gasType: '', weight: '', clientName: '', dccNumber: '', date: new Date().toISOString().split('T')[0], notes: '' })
    } catch (err) {
      toast.error('Failed to record: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'date', label: 'DATE', render: (row) => fmtDate(row.createdAt, 'yyyy-MM-dd') },
    { key: 'cylinderCode', label: 'CYLINDER NO', sortable: true },
    { key: 'clientName', label: 'CLIENT NAME', sortable: true },
    { key: 'gasType', label: 'GAS TYPE' },
    { key: 'weight', label: 'WEIGHT (kg)', render: (row) => `${row.weight}kg` },
    { key: 'dccNumber', label: 'DCC NUMBER' },
    { key: 'type', label: 'TYPE', render: (row) => (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
        row.type === 'in' 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
      }`}>
        {row.type === 'in' ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
        {row.type.toUpperCase()}
      </span>
    )},
    { key: 'recordedBy', label: 'RECORDED BY' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Cylinder Movements</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Record and track cylinder IN/OUT movements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setInModal(true)} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
            <ArrowDownCircle className="h-4 w-4" /> Record IN
          </button>
          <button onClick={() => setOutModal(true)} className="btn-primary flex items-center gap-2 bg-orange-600 hover:bg-orange-700">
            <ArrowUpCircle className="h-4 w-4" /> Record OUT
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Movements" value={totalMovements} icon={Plus} color="purple" />
        <StatCard title="Cylinders IN" value={cylindersIn} icon={ArrowDownCircle} color="green" />
        <StatCard title="Cylinders OUT" value={cylindersOut} icon={ArrowUpCircle} color="orange" />
      </div>

      {/* Table */}
      <div className="card">
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search cylinder, client, D..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field flex-1 min-w-48"
          />
          <select
            value={movementFilter}
            onChange={(e) => setMovementFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">Movement Type</option>
            <option value="in">IN</option>
            <option value="out">OUT</option>
          </select>
          <select
            value={gasFilter}
            onChange={(e) => setGasFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">Gas Type</option>
            {gasTypeOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button className="btn-secondary">Filter</button>
        </div>

        <Table
          columns={columns}
          rows={rows}
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          onPageChange={setPage}
          searchPlaceholder="Search movements..."
          emptyMessage="No cylinder movements recorded yet"
        />
      </div>

      {/* Record IN Modal */}
      <Modal isOpen={inModal} onClose={() => setInModal(false)} title="Record Cylinder IN">
        <form onSubmit={inForm.handleSubmit(onInSubmit)} className="space-y-4">
          <FormField label="Cylinder Number" error={inForm.formState.errors.cylinderId?.message} required>
            <Select register={inForm.register('cylinderId')} error={inForm.formState.errors.cylinderId}>
              <option value="">Search and select cylinder</option>
              {cylinders.map(c => <option key={c.id} value={c.id}>{c.cylinderCode} - {c.gasTypeName}</option>)}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Gas Type" error={inForm.formState.errors.gasType?.message} required>
              <Input 
                register={inForm.register('gasType')} 
                error={inForm.formState.errors.gasType} 
                placeholder="Auto-filled" 
                readOnly
              />
            </FormField>
            <FormField label="Weight (kg)" error={inForm.formState.errors.weight?.message} required>
              <Input 
                register={inForm.register('weight')} 
                error={inForm.formState.errors.weight} 
                placeholder="Auto-filled" 
                readOnly
              />
            </FormField>
          </div>

          <FormField label="Client Name" error={inForm.formState.errors.clientName?.message} required>
            <Select register={inForm.register('clientName')} error={inForm.formState.errors.clientName}>
              <option value="">Search and select client</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="DCC Number" error={inForm.formState.errors.dccNumber?.message} required>
              <Input register={inForm.register('dccNumber')} error={inForm.formState.errors.dccNumber} placeholder="Enter DCC number" />
            </FormField>
            <FormField label="Date" error={inForm.formState.errors.date?.message} required>
              <Input register={inForm.register('date')} error={inForm.formState.errors.date} type="date" />
            </FormField>
          </div>

          <FormField label="Notes">
            <Input register={inForm.register('notes')} placeholder="Optional notes" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setInModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary bg-green-600 hover:bg-green-700">
              {saving ? 'Recording...' : 'Record IN'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record OUT Modal */}
      <Modal isOpen={outModal} onClose={() => setOutModal(false)} title="Record Cylinder OUT">
        <form onSubmit={outForm.handleSubmit(onOutSubmit)} className="space-y-4">
          <FormField label="Cylinder Number" error={outForm.formState.errors.cylinderId?.message} required>
            <Select register={outForm.register('cylinderId')} error={outForm.formState.errors.cylinderId}>
              <option value="">Search and select cylinder</option>
              {cylinders.map(c => <option key={c.id} value={c.id}>{c.cylinderCode} - {c.gasTypeName}</option>)}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Gas Type" error={outForm.formState.errors.gasType?.message} required>
              <Input 
                register={outForm.register('gasType')} 
                error={outForm.formState.errors.gasType} 
                placeholder="Auto-filled" 
                readOnly
              />
            </FormField>
            <FormField label="Weight (kg)" error={outForm.formState.errors.weight?.message} required>
              <Input 
                register={outForm.register('weight')} 
                error={outForm.formState.errors.weight} 
                placeholder="Auto-filled" 
                readOnly
              />
            </FormField>
          </div>

          <FormField label="Client Name" error={outForm.formState.errors.clientName?.message} required>
            <Select register={outForm.register('clientName')} error={outForm.formState.errors.clientName}>
              <option value="">Search and select client</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="DCC Number" error={outForm.formState.errors.dccNumber?.message} required>
              <Input register={outForm.register('dccNumber')} error={outForm.formState.errors.dccNumber} placeholder="Enter DCC number" />
            </FormField>
            <FormField label="Date" error={outForm.formState.errors.date?.message} required>
              <Input register={outForm.register('date')} error={outForm.formState.errors.date} type="date" />
            </FormField>
          </div>

          <FormField label="Notes">
            <Input register={outForm.register('notes')} placeholder="Optional notes" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOutModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary bg-orange-600 hover:bg-orange-700">
              {saving ? 'Recording...' : 'Record OUT'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
