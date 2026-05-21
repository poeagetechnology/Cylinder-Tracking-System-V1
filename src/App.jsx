import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'

import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute, RoleBasedRoute, GuestRoute } from './routes/Guards'
import { AppLayout } from './components/layout/AppLayout'
import { Loader } from './components/ui/Loader'

import { SetupPage } from './pages/auth/SetupPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { UsersPage } from './pages/users/UsersPage'
import { GasTypesPage } from './pages/gas/GasTypesPage'
import { CylindersPage } from './pages/cylinders/CylindersPage'
import { FillingPage } from './pages/filling/FillingPage'
import { InventoryPage } from './pages/inventory/InventoryPage'
import { VehiclesPage } from './pages/vehicles/VehiclesPage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { SuppliersPage } from './pages/suppliers/SuppliersPage'
import { HRPage } from './pages/hr/HRPage'
import { ExpensesPage } from './pages/expenses/ExpensesPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { AreasPage } from './pages/settings/AreasPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { isSystemInitialized } from './services/authService'

function AppRoutes() {
  const [initialized, setInitialized] = useState(null)

  useEffect(() => {
    isSystemInitialized().then(setInitialized)
  }, [])

  if (initialized === null) return <Loader fullScreen />

  return (
    <Routes>
      <Route path="/setup" element={initialized ? <Navigate to="/login" replace /> : <SetupPage />} />
      <Route path="/" element={<Navigate to={initialized ? '/login' : '/setup'} replace />} />

      <Route element={<GuestRoute />}>
        <Route path="/login" element={initialized ? <LoginPage /> : <Navigate to="/setup" replace />} />
        <Route path="/register" element={initialized ? <RegisterPage /> : <Navigate to="/setup" replace />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/cylinders" element={<CylindersPage />} />
          <Route path="/filling" element={<FillingPage />} />
          <Route path="/inventory" element={<InventoryPage />} />

          <Route element={<RoleBasedRoute allowedRoles={['admin', 'superadmin']} />}>
            <Route path="/gas" element={<GasTypesPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/hr" element={<HRPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>

          <Route element={<RoleBasedRoute allowedRoles={['superadmin']} />}>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/areas" element={<AreasPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { borderRadius: '10px', fontSize: '14px', fontWeight: '500' },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
