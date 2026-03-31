import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Plus, Edit2, Trash2, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useFirestoreCollection } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../services/firestoreService'
import { Table } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FormField, Input, Select, Textarea } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { expenseSchema } from '../../utils/validations'
import { fmtDate, fmtCurrency } from '../../utils/helpers'

const CATEGORIES = ['Fuel', 'Maintenance', 'Salary', 'Utilities', 'Rent', 'Purchase', 'Transport', 'Miscellaneous']

export const ExpensesPage = () => {
  const { data: expenses, loading } = useFirestoreCollection('expenses')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(expenseSchema),
    defaultValues: { category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] },
  })

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    expenses, ['category', 'description'], 10
  )

  // Chart data - expenses by category
  const chartData = CATEGORIES.map(cat => ({
    category: cat,
    amount: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (e.amount || 0), 0),
  })).filter(d => d.amount > 0)

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const thisMonth = expenses
    .filter(e => e.date?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  const openAdd = () => {
    setEditItem(null)
    reset({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({ category: item.category, amount: item.amount, description: item.description, date: item.date })
    setModalOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { ...data, amount: Number(data.amount) }
      if (editItem) {
        await updateDocument('expenses', editItem.id, payload)
        toast.success('Expense updated')
      } else {
        await addDocument('expenses', payload)
        toast.success('Expense added')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteDocument('expenses', deleteId)
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'category', label: 'Category', sortable: true, render: r => (
      <span className="badge-blue">{r.category}</span>
    )},
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', sortable: true, render: r => <span className="font-semibold text-red-600">{fmtCurrency(r.amount)}</span> },
    {
      key: 'actions', label: 'Actions', render: row => (
        <div className="flex items-center gap-2">
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track and manage all business expenses</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{fmtCurrency(totalExpenses)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{fmtCurrency(thisMonth)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Records</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{expenses.length}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Expenses by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmtCurrency(v)} />
              <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

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
            searchPlaceholder="Search expenses..."
            emptyMessage="No expenses recorded yet."
          />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Category" error={errors.category?.message} required>
            <Select register={register('category')} error={errors.category}>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Amount (₹)" error={errors.amount?.message} required>
              <Input register={register('amount', { valueAsNumber: true })} error={errors.amount} type="number" placeholder="Amount" />
            </FormField>
            <FormField label="Date" error={errors.date?.message} required>
              <Input register={register('date')} error={errors.date} type="date" />
            </FormField>
          </div>
          <FormField label="Description" error={errors.description?.message} required>
            <Textarea register={register('description')} error={errors.description} placeholder="Describe this expense" />
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
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        confirmText="Delete"
      />
    </div>
  )
}
