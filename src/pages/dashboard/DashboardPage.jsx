import { useEffect, useState } from 'react'
import { Package, Users, TrendingDown, Truck, Wind, UserCheck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import { StatCard } from '../../components/ui/StatCard'
import { getCollection } from '../../services/firestoreService'
import { Loader } from '../../components/ui/Loader'
import { fmtCurrency } from '../../utils/helpers'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

const monthlyData = [
  { month: 'Aug', filled: 120, dispatched: 95 },
  { month: 'Sep', filled: 145, dispatched: 110 },
  { month: 'Oct', filled: 132, dispatched: 125 },
  { month: 'Nov', filled: 168, dispatched: 140 },
  { month: 'Dec', filled: 155, dispatched: 148 },
  { month: 'Jan', filled: 190, dispatched: 162 },
]

export const DashboardPage = () => {
  const [stats, setStats] = useState({ cylinders: 0, customers: 0, suppliers: 0, vehicles: 0, expenses: 0, filling: 0 })
  const [cylinderStatus, setCylinderStatus] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [cylinders, customers, suppliers, vehicles, expenses, fillings] = await Promise.all([
          getCollection('cylinders'),
          getCollection('customers'),
          getCollection('suppliers'),
          getCollection('vehicles'),
          getCollection('expenses'),
          getCollection('fillings'),
        ])

        setStats({
          cylinders: cylinders.length,
          customers: customers.length,
          suppliers: suppliers.length,
          vehicles: vehicles.length,
          expenses: expenses.reduce((s, e) => s + (e.amount || 0), 0),
          filling: fillings.length,
        })

        const statusMap = {}
        cylinders.forEach((c) => {
          statusMap[c.status] = (statusMap[c.status] || 0) + 1
        })
        setCylinderStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader size="lg" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Cylinder Tracking System Overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard title="Total Cylinders" value={stats.cylinders} icon={Package} color="blue" />
        <StatCard title="Total Customers" value={stats.customers} icon={UserCheck} color="green" />
        <StatCard title="Total Suppliers" value={stats.suppliers} icon={Users} color="purple" />
        <StatCard title="Vehicles" value={stats.vehicles} icon={Truck} color="yellow" />
        <StatCard title="Filling Sessions" value={stats.filling} icon={Wind} color="indigo" />
        <StatCard title="Total Expenses" value={fmtCurrency(stats.expenses)} icon={TrendingDown} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Filling Chart */}
        <div className="card">
          <h2 className="section-title mb-4">Monthly Filling vs Dispatch</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tw-bg-opacity)',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Bar dataKey="filled" fill="#3b82f6" name="Filled" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dispatched" fill="#22c55e" name="Dispatched" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cylinder Status Pie */}
        <div className="card">
          <h2 className="section-title mb-4">Cylinder Status Distribution</h2>
          {cylinderStatus.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500">
              No cylinder data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={cylinderStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {cylinderStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trend Line */}
        <div className="card lg:col-span-2">
          <h2 className="section-title mb-4">Filling Trend (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="filled" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Filled" />
              <Line type="monotone" dataKey="dispatched" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Dispatched" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
