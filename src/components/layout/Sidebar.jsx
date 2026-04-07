import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Wind, Cylinder, Package, Truck,
  UserCheck, Building2, TrendingDown, BarChart3, Settings,
  ChevronLeft, ChevronRight, LogOut, Flame, X, Menu, MapPin, ArrowRightLeft,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['superadmin', 'admin', 'user'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['superadmin', 'admin'] },
  { to: '/gas', icon: Flame, label: 'Gas Types', roles: ['superadmin', 'admin'] },
  { to: '/cylinders', icon: Package, label: 'Cylinders', roles: ['superadmin', 'admin', 'user'] },
  { to: '/filling', icon: Wind, label: 'Filling', roles: ['superadmin', 'admin', 'user'] },
  { to: '/inventory', icon: Package, label: 'Inventory', roles: ['superadmin', 'admin', 'user'] },
  { to: '/movements', icon: ArrowRightLeft, label: 'Movements', roles: ['superadmin', 'admin', 'user'] },
  { to: '/vehicles', icon: Truck, label: 'Vehicles', roles: ['superadmin', 'admin'] },
  { to: '/customers', icon: UserCheck, label: 'Customers', roles: ['superadmin', 'admin'] },
  { to: '/suppliers', icon: Building2, label: 'Suppliers', roles: ['superadmin', 'admin'] },
  { to: '/hr', icon: Users, label: 'HR', roles: ['superadmin', 'admin'] },
  { to: '/expenses', icon: TrendingDown, label: 'Expenses', roles: ['superadmin', 'admin'] },
  { to: '/reports', icon: BarChart3, label: 'Stock Report', roles: ['superadmin', 'admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['superadmin'] },
  { to: '/areas', icon: MapPin, label: 'Areas', roles: ['superadmin'] },
]

export const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const filtered = navItems.filter((item) => item.roles.includes(userProfile?.role))

  const NavItem = ({ item }) => (
    <NavLink
      to={item.to}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative ${
          isActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {(!collapsed || mobileOpen) && (
        <span className="text-sm font-medium truncate">{item.label}</span>
      )}
      {collapsed && !mobileOpen && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {item.label}
        </div>
      )}
    </NavLink>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-700 ${collapsed && !mobileOpen ? 'justify-center' : ''}`}>
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center font-bold text-white text-xs">
            AT
          </div>
          {(!collapsed || mobileOpen) && (
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-none">Air Tech</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cylinder System</p>
            </div>
          )}
        </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filtered.map((item) => <NavItem key={item.to} item={item} />)}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {(!collapsed || mobileOpen) && (
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700/40">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{userProfile?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userProfile?.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {(!collapsed || mobileOpen) && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-sm hover:shadow-md transition-shadow"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-gray-500" /> : <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-gray-800 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
