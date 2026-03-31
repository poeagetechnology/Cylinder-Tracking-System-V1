import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, CheckSquare, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Badge } from '../../components/ui/Badge'
import { useTable } from '../../hooks/useTable'
import { fmtDate, fmtCurrency } from '../../utils/helpers'

const DESIGNATIONS = ['Manager', 'Supervisor', 'Driver', 'Helper', 'Technician', 'Accountant', 'Other']
const ATTENDANCE_STATUS = ['present', 'absent', 'half_day', 'leave']

export const HRPage = () => {
  const { data: employees, loading } = useFirestoreCollection('employees')
  const { data: attendance } = useFirestoreCollection('attendance')
  const { data: salaries } = useFirestoreCollection('salaries')

  const [tab, setTab] = useState('employees')
  const [empModal, setEmpModal] = useState(false)
  const [attendModal, setAttendModal] = useState(false)
  const [salaryModal, setSalaryModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const empForm = useForm({ defaultValues: { name: '', designation: '', phone: '', salary: '', joinDate: '' } })
  const attendForm = useForm({ defaultValues: { employeeId: '', employeeName: '', date: new Date().toISOString().split('T')[0], status: 'present', notes: '' } })
  const salaryForm = useForm({ defaultValues: { employeeId: '', employeeName: '', month: '', amount: '', paid: false, paidOn: '' } })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    tab === 'employees' ? employees : tab === 'attendance' ? attendance : salaries,
    ['name', 'employeeName', 'designation'],
    10
  )

  const openEmpEdit = (item) => {
    setEditItem(item)
    empForm.reset({ name: item.name, designation: item.designation, phone: item.phone, salary: item.salary, joinDate: item.joinDate })
    setEmpModal(true)
  }

  const onEmpSubmit = async (data) => {
    setSaving(true)
    try {
      if (editItem) {
        await updateDocument('employees', editItem.id, { ...data, salary: Number(data.salary) })
        toast.success('Employee updated')
      } else {
        await addDocument('employees', { ...data, salary: Number(data.salary), status: 'active' })
        toast.success('Employee added')
      }
      setEmpModal(false)
      setEditItem(null)
    } catch { toast.error('Failed to save employee') }
    finally { setSaving(false) }
  }

  const onAttendSubmit = async (data) => {
    setSaving(true)
    try {
      const emp = employees.find(e => e.id === data.employeeId)
      await addDocument('attendance', { ...data, employeeName: emp?.name || '' })
      toast.success('Attendance recorded')
      setAttendModal(false)
    } catch { toast.error('Failed to record attendance') }
    finally { setSaving(false) }
  }

  const onSalarySubmit = async (data) => {
    setSaving(true)
    try {
      const emp = employees.find(e => e.id === data.employeeId)
      await addDocument('salaries', { ...data, employeeName: emp?.name || '', amount: Number(data.amount), paid: false })
      toast.success('Salary record added')
      setSalaryModal(false)
    } catch { toast.error('Failed to add salary record') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('employees', deleteId)
      toast.success('Employee deleted')
    } catch { toast.error('Failed to delete employee') }
  }

  const empColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'designation', label: 'Designation', sortable: true },
    { key: 'phone', label: 'Phone' },
    { key: 'salary', label: 'Salary', render: r => fmtCurrency(r.salary) },
    { key: 'joinDate', label: 'Join Date' },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status || 'active'} /> },
    {
      key: 'actions', label: 'Actions', render: row => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEmpEdit(row)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"><Edit2 className="h-4 w-4" /></button>
          <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      )
    },
  ]

  const attendColumns = [
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'status', label: 'Status', render: r => <Badge status={r.status === 'present' ? 'approved' : r.status === 'absent' ? 'rejected' : 'pending'} label={r.status?.replace('_', ' ')} /> },
    { key: 'notes', label: 'Notes', render: r => r.notes || '—' },
  ]

  const salaryColumns = [
    { key: 'employeeName', label: 'Employee', sortable: true },
    { key: 'month', label: 'Month', sortable: true },
    { key: 'amount', label: 'Amount', render: r => fmtCurrency(r.amount) },
    { key: 'paid', label: 'Status', render: r => <Badge status={r.paid ? 'approved' : 'pending'} label={r.paid ? 'Paid' : 'Pending'} /> },
    { key: 'paidOn', label: 'Paid On', render: r => r.paidOn || '—' },
  ]

  const tabs = [
    { key: 'employees', label: 'Employees', count: employees.length },
    { key: 'attendance', label: 'Attendance', count: attendance.length },
    { key: 'salaries', label: 'Salaries', count: salaries.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Human Resources</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage employees, attendance & salaries</p>
        </div>
        <div className="flex gap-2">
          {tab === 'employees' && (
            <button onClick={() => { setEditItem(null); empForm.reset(); setEmpModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Employee
            </button>
          )}
          {tab === 'attendance' && (
            <button onClick={() => setAttendModal(true)} className="btn-primary flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Mark Attendance
            </button>
          )}
          {tab === 'salaries' && (
            <button onClick={() => setSalaryModal(true)} className="btn-primary flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Add Salary
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label} <span className="ml-1 text-xs text-gray-400">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <Table
            columns={tab === 'employees' ? empColumns : tab === 'attendance' ? attendColumns : salaryColumns}
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
            searchPlaceholder={`Search ${tab}...`}
            emptyMessage={`No ${tab} records found.`}
          />
        )}
      </div>

      {/* Employee Modal */}
      <Modal isOpen={empModal} onClose={() => setEmpModal(false)} title={editItem ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={empForm.handleSubmit(onEmpSubmit)} className="space-y-4">
          <FormField label="Full Name" required>
            <input {...empForm.register('name', { required: true })} className="input-field" placeholder="Employee name" />
          </FormField>
          <FormField label="Designation" required>
            <select {...empForm.register('designation', { required: true })} className="input-field">
              <option value="">Select designation</option>
              {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone" required>
              <input {...empForm.register('phone', { required: true })} className="input-field" placeholder="Phone number" />
            </FormField>
            <FormField label="Monthly Salary (₹)" required>
              <input {...empForm.register('salary', { required: true })} type="number" className="input-field" placeholder="Amount" />
            </FormField>
          </div>
          <FormField label="Join Date" required>
            <input {...empForm.register('joinDate', { required: true })} type="date" className="input-field" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEmpModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Attendance Modal */}
      <Modal isOpen={attendModal} onClose={() => setAttendModal(false)} title="Mark Attendance">
        <form onSubmit={attendForm.handleSubmit(onAttendSubmit)} className="space-y-4">
          <FormField label="Employee" required>
            <select {...attendForm.register('employeeId', { required: true })} className="input-field">
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date" required>
              <input {...attendForm.register('date', { required: true })} type="date" className="input-field" />
            </FormField>
            <FormField label="Status" required>
              <select {...attendForm.register('status', { required: true })} className="input-field">
                {ATTENDANCE_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <input {...attendForm.register('notes')} className="input-field" placeholder="Optional notes" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAttendModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Submit'}</button>
          </div>
        </form>
      </Modal>

      {/* Salary Modal */}
      <Modal isOpen={salaryModal} onClose={() => setSalaryModal(false)} title="Add Salary Record">
        <form onSubmit={salaryForm.handleSubmit(onSalarySubmit)} className="space-y-4">
          <FormField label="Employee" required>
            <select {...salaryForm.register('employeeId', { required: true })} className="input-field">
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {fmtCurrency(e.salary)}/mo</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Month (YYYY-MM)" required>
              <input {...salaryForm.register('month', { required: true })} type="month" className="input-field" />
            </FormField>
            <FormField label="Amount (₹)" required>
              <input {...salaryForm.register('amount', { required: true })} type="number" className="input-field" placeholder="Salary amount" />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSalaryModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Employee" message="Are you sure you want to delete this employee?" confirmText="Delete" />
    </div>
  )
}
