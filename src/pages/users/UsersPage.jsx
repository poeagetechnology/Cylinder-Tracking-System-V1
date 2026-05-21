import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { UserCheck, UserX, Shield, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { subscribeToUsers, updateUserStatus, updateUserRole, createUserDirectly } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { Table } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { useTable } from '../../hooks/useTable'
import { fmtDate, roleLabel } from '../../utils/helpers'
import * as Yup from 'yup'

const createUserSchema = Yup.object({
  name: Yup.string().min(2, 'Name too short').required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  role: Yup.string().oneOf(['user', 'admin'], 'Invalid role').required('Role is required'),
})

export const UsersPage = () => {
  const { isSuperAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(createUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'user' },
  })

  useEffect(() => {
    const unsub = subscribeToUsers((data) => {
      setUsers(data)
      setLoading(false)
    })
    return unsub
  }, [])

  const filtered = users.filter((u) => filterStatus === 'all' || u.status === filterStatus)

  const { rows, search, setSearch, sortKey, sortDir, handleSort, page, setPage, totalPages, totalRows } = useTable(
    filtered,
    ['name', 'email'],
    10
  )

  const handleStatusUpdate = async (uid, status) => {
    try {
      await updateUserStatus(uid, status)
      toast.success(`User ${status === 'approved' ? 'approved' : 'rejected'} successfully!`)
    } catch (err) {
      toast.error(err.message || `Failed to ${status} user`)
    }
  }

  const handleRoleChange = async (uid, role) => {
    if (!isSuperAdmin) {
      toast.error('Only superadmin can change roles')
      return
    }
    try {
      await updateUserRole(uid, role)
      toast.success('Role updated successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to update role')
    }
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      await createUserDirectly(data)
      toast.success('User created successfully!')
      setModalOpen(false)
      reset({ name: '', email: '', password: '', role: 'user' })
    } catch (err) {
      toast.error(err.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', render: (row) => (
      isSuperAdmin ? (
        <select
          value={row.role}
          onChange={(e) => handleRoleChange(row.uid, e.target.value)}
          className="input-field py-1 text-sm w-32"
          disabled={row.role === 'superadmin'}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          {row.role === 'superadmin' && <option value="superadmin">Super Admin</option>}
        </select>
      ) : (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{roleLabel(row.role)}</span>
      )
    )},
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
    { key: 'createdAt', label: 'Registered', sortable: true, render: (row) => fmtDate(row.createdAt) },
    { key: 'actions', label: 'Actions', render: (row) => {
      if (row.role === 'superadmin') return <span className="badge-gray">Super Admin</span>
      if (!isSuperAdmin) return <span className="badge-gray">View Only</span>
      return (
        <div className="flex items-center gap-2">
          {row.status !== 'approved' && (
            <button
              onClick={() => setConfirm({ uid: row.uid, action: 'approved', name: row.name })}
              className="flex items-center gap-1 text-xs btn-success px-2 py-1"
            >
              <UserCheck className="h-3.5 w-3.5" /> Approve
            </button>
          )}
          {row.status !== 'rejected' && (
            <button
              onClick={() => setConfirm({ uid: row.uid, action: 'rejected', name: row.name })}
              className="flex items-center gap-1 text-xs btn-danger px-2 py-1"
            >
              <UserX className="h-3.5 w-3.5" /> Reject
            </button>
          )}
        </div>
      )
    }},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin ? 'Manage user access, roles, and create new users' : 'View user list (read-only access)'}
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filterStatus === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {s} {s !== 'all' && `(${users.filter((u) => u.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading users...</div>
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
            searchPlaceholder="Search by name or email..."
            emptyMessage="No users found."
          />
        )}
      </div>

      {/* Add User Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New User">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Full Name" error={errors.name?.message} required>
            <Input {...register('name')} error={errors.name} placeholder="Enter user name" />
          </FormField>

          <FormField label="Email Address" error={errors.email?.message} required>
            <Input {...register('email')} error={errors.email} type="email" placeholder="user@example.com" />
          </FormField>

          <FormField label="Password" error={errors.password?.message} required>
            <Input {...register('password')} error={errors.password} type="password" placeholder="Min. 8 characters" />
          </FormField>

          <FormField label="Role" error={errors.role?.message} required>
            <Select {...register('role')} error={errors.role}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && handleStatusUpdate(confirm.uid, confirm.action)}
        title={confirm?.action === 'approved' ? 'Approve User' : 'Reject User'}
        message={`Are you sure you want to ${confirm?.action === 'approved' ? 'approve' : 'reject'} ${confirm?.name}?`}
        confirmText={confirm?.action === 'approved' ? 'Approve' : 'Reject'}
        variant={confirm?.action === 'approved' ? 'primary' : 'danger'}
      />
    </div>
  )
}
