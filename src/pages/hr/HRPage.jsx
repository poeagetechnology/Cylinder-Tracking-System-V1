import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, CheckSquare, DollarSign, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
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

// Helper to get week start (Monday)
const getWeekStart = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

// Get array of dates for a week
const getWeekDates = (weekStart) => {
  const dates = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

const getWeekLabel = (weekStart) => {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 5)
  return `${fmtDate(weekStart, 'd MMM')} - ${fmtDate(weekEnd, 'd MMM yyyy')}`
}

export const HRPage = () => {
  const { data: employees, loading } = useFirestoreCollection('employees')
  const { data: attendance } = useFirestoreCollection('attendance')
  const { data: salaries } = useFirestoreCollection('salaries')
  const { data: weeklyWages } = useFirestoreCollection('weeklyWages')

  const [tab, setTab] = useState('employees')
  const [empModal, setEmpModal] = useState(false)
  const [attendModal, setAttendModal] = useState(false)
  const [salaryModal, setSalaryModal] = useState(false)
  const [wagesModal, setWagesModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(() => getWeekStart(new Date()))

  const empForm = useForm({ defaultValues: { name: '', designation: '', phone: '', salary: '', joinDate: '' } })
  const attendForm = useForm({ defaultValues: { employeeId: '', employeeName: '', date: new Date().toISOString().split('T')[0], status: 'present', notes: '' } })
  const salaryForm = useForm({ defaultValues: { employeeId: '', employeeName: '', month: '', amount: '', paid: false, paidOn: '' } })
  const wagesForm = useForm({ defaultValues: { employeeId: '', workDays: '0', overtimeHours: '0', advance: '0', dailyRate: '', otherDeductions: '0', notes: '' } })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    tab === 'employees' ? employees : tab === 'attendance' ? attendance : tab === 'salaries' ? salaries : weeklyWages,
    ['name', 'employeeName', 'designation'],
    10
  )

  // Weekly wages data for current week
  const weeklyWagesForWeek = useMemo(() => {
    const weekStart = selectedWeek.toISOString().split('T')[0]
    return weeklyWages.filter(w => w.weekStart === weekStart)
  }, [weeklyWages, selectedWeek])

  // Create combined view of employees with their weekly data
  const employeesWithWeeklyData = useMemo(() => {
    return employees.map(emp => {
      const weekData = weeklyWagesForWeek.find(w => w.employeeId === emp.id)
      const workDays = parseInt(weekData?.workDays || 0)
      const dailyRate = parseFloat(weekData?.dailyRate || emp.salary / 30)
      const overtimeRate = dailyRate / 8 * 1.5
      const amount = (workDays * dailyRate) + ((weekData?.overtimeHours || 0) * overtimeRate) - (weekData?.otherDeductions || 0) - (weekData?.advance || 0)
      
      return {
        ...emp,
        ...weekData,
        workDays: workDays || 0,
        overtimeHours: parseFloat(weekData?.overtimeHours || 0),
        advance: parseFloat(weekData?.advance || 0),
        dailyRate,
        otherDeductions: parseFloat(weekData?.otherDeductions || 0),
        amount: Math.max(0, amount),
        totalWages: (workDays * dailyRate) + ((weekData?.overtimeHours || 0) * overtimeRate),
      }
    })
  }, [employees, weeklyWagesForWeek])

  const handleWeekChange = (direction) => {
    const newWeek = new Date(selectedWeek)
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7))
    setSelectedWeek(getWeekStart(newWeek))
  }

  const openWagesEdit = (emp) => {
    const weekStart = selectedWeek.toISOString().split('T')[0]
    const existing = weeklyWagesForWeek.find(w => w.employeeId === emp.id)
    
    setEditItem(existing || { employeeId: emp.id, weekStart })
    wagesForm.reset({
      employeeId: emp.id,
      workDays: existing?.workDays || '0',
      overtimeHours: existing?.overtimeHours || '0',
      advance: existing?.advance || '0',
      dailyRate: existing?.dailyRate || (emp.salary / 30).toFixed(2),
      otherDeductions: existing?.otherDeductions || '0',
      notes: existing?.notes || '',
    })
    setWagesModal(true)
  }

  const onWagesSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = {
        employeeId: data.employeeId,
        weekStart: selectedWeek.toISOString().split('T')[0],
        workDays: parseInt(data.workDays),
        overtimeHours: parseFloat(data.overtimeHours),
        advance: parseFloat(data.advance),
        dailyRate: parseFloat(data.dailyRate),
        otherDeductions: parseFloat(data.otherDeductions),
        notes: data.notes,
      }

      if (editItem?.id) {
        await updateDocument('weeklyWages', editItem.id, payload)
        toast.success('Weekly wages updated')
      } else {
        await addDocument('weeklyWages', payload)
        toast.success('Weekly wages created')
      }
      setWagesModal(false)
      setEditItem(null)
    } catch (err) {
      toast.error('Failed to save weekly wages: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

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
    { key: 'wages', label: 'Attendance & Wages', count: weeklyWagesForWeek.length },
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
          {tab === 'wages' && (
            <button onClick={() => { setEditItem(null); wagesForm.reset(); setWagesModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Wages Entry
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
        {tab === 'wages' ? (
          <div className="space-y-4">
            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => handleWeekChange('prev')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-lg font-semibold">{getWeekLabel(selectedWeek)}</span>
              </div>
              <button
                onClick={() => handleWeekChange('next')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Payroll Entry Table */}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Employee Name</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Day 1</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Day 2</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Day 3</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Day 4</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Day 5</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Day 6</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">WORK DAYS</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Daily Rate</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Amount</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">OT/HRS</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">OT Rate</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">OT Amount</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">ADVANCE</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Deductions</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">Amount Total</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">TOTAL WAGES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {employeesWithWeeklyData.length === 0 ? (
                    <tr>
                      <td colSpan="17" className="px-4 py-12 text-center text-gray-400">No employees found</td>
                    </tr>
                  ) : (
                    <>
                      {employeesWithWeeklyData.map(emp => {
                        const dailyRate = parseFloat(emp.dailyRate)
                        const overtimeRate = 50 // Fixed at 50 rupees per hour as per screenshot
                        const workDays = emp.workDays || 0
                        const otHrs = emp.overtimeHours || 0
                        const advance = emp.advance || 0
                        const deductions = emp.otherDeductions || 0
                        
                        const amount = workDays * dailyRate
                        const otAmount = otHrs * overtimeRate
                        const totalWages = amount + otAmount - advance - deductions
                        const amountTotal = totalWages
                        
                        return (
                          <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">{emp.name}</td>
                            <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" max="1" defaultValue={emp.workDays > 0 && emp.workDays <= 6 ? 1 : 0} className="w-full text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" max="1" defaultValue={0} className="w-full text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" max="1" defaultValue={0} className="w-full text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" max="1" defaultValue={0} className="w-full text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" max="1" defaultValue={0} className="w-full text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" max="1" defaultValue={0} className="w-full text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">{workDays}</td>
                            <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{dailyRate.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">{amount.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" defaultValue={otHrs} className="w-12 text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">{overtimeRate.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">{otAmount.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" defaultValue={advance} className="w-16 text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-3 py-2 text-center border-r border-gray-200 dark:border-gray-700">
                              <input type="number" min="0" defaultValue={deductions} className="w-16 text-center bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 py-1 text-gray-900 dark:text-gray-100" />
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">{amountTotal.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center font-bold text-lg text-gray-900 dark:text-gray-100">{totalWages.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                      {/* Total Row */}
                      <tr className="bg-gray-100 dark:bg-gray-800 font-bold text-gray-900 dark:text-gray-100">
                        <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">TOTAL</td>
                        <td colSpan="6" className="px-3 py-3 border-r border-gray-200 dark:border-gray-700"></td>
                        <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">{employeesWithWeeklyData.reduce((sum, e) => sum + (e.workDays || 0), 0)}</td>
                        <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700"></td>
                        <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">{employeesWithWeeklyData.reduce((sum, e) => sum + ((e.workDays || 0) * (e.dailyRate || 0)), 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">{employeesWithWeeklyData.reduce((sum, e) => sum + ((e.overtimeHours || 0) * 50), 0).toFixed(2)}</td>
                        <td className="px-3 py-3 border-r border-gray-200 dark:border-gray-700"></td>
                        <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">{employeesWithWeeklyData.reduce((sum, e) => sum + (e.advance || 0), 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700">{employeesWithWeeklyData.reduce((sum, e) => sum + (e.otherDeductions || 0), 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-center border-r border-gray-200 dark:border-gray-700"></td>
                        <td className="px-3 py-3 text-center text-xl">{employeesWithWeeklyData.reduce((sum, e) => {
                          const wd = e.workDays || 0
                          const dr = e.dailyRate || 0
                          const ot = e.overtimeHours || 0
                          const adv = e.advance || 0
                          const ded = e.otherDeductions || 0
                          return sum + (wd * dr) + (ot * 50) - adv - ded
                        }, 0).toFixed(2)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Save Button */}
            {employees.length > 0 && (
              <div className="flex justify-end gap-3 pt-4">
                <button className="btn-secondary">Reset</button>
                <button className="btn-primary">Save Week Payroll</button>
              </div>
            )}
          </div>
        ) : (
          loading ? (
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
          )
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

      {/* Weekly Wages Modal */}
      <Modal isOpen={wagesModal} onClose={() => setWagesModal(false)} title={editItem?.id ? 'Edit Weekly Wages' : 'Add Weekly Wages'}>
        <form onSubmit={wagesForm.handleSubmit(onWagesSubmit)} className="space-y-4">
          <FormField label="Employee" required>
            <select {...wagesForm.register('employeeId', { required: true })} disabled={!!editItem?.id} className="input-field">
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </FormField>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Work Days" required>
              <input {...wagesForm.register('workDays', { required: true })} type="number" min="0" max="6" step="1" className="input-field" placeholder="0" />
            </FormField>
            <FormField label="Overtime Hours" required>
              <input {...wagesForm.register('overtimeHours', { required: true })} type="number" min="0" step="0.5" className="input-field" placeholder="0" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Daily Rate (₹)" required>
              <input {...wagesForm.register('dailyRate', { required: true })} type="number" min="0" step="0.01" className="input-field" placeholder="0.00" />
            </FormField>
            <FormField label="Advance (₹)" required>
              <input {...wagesForm.register('advance', { required: true })} type="number" min="0" step="0.01" className="input-field" placeholder="0" />
            </FormField>
          </div>

          <FormField label="Other Deductions (₹)" required>
            <input {...wagesForm.register('otherDeductions', { required: true })} type="number" min="0" step="0.01" className="input-field" placeholder="0" />
          </FormField>

          <FormField label="Notes">
            <input {...wagesForm.register('notes')} className="input-field" placeholder="Optional notes" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setWagesModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Employee" message="Are you sure you want to delete this employee?" confirmText="Delete" />
    </div>
  )
}
