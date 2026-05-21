import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { initializeSystem } from '../../services/authService'
import { superAdminSchema } from '../../utils/validations'
import { FormField, Input } from '../../components/ui/FormField'

export const SetupPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(superAdminSchema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await initializeSystem(data)
      toast.success('System initialized! Super Admin created.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-lg mb-4">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Welcome to CTS</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Set up your Super Admin account to get started</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-6 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
            <Shield className="h-5 w-5 text-primary-600" />
            <p className="text-sm text-primary-700 dark:text-primary-400 font-medium">First-time Setup — Creating Super Admin</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <FormField label="Full Name" error={errors.name?.message} required>
              <Input {...register('name')} error={errors.name} placeholder="Enter your full name" />
            </FormField>

            <FormField label="Email Address" error={errors.email?.message} required>
              <Input {...register('email')} error={errors.email} type="email" placeholder="admin@example.com" />
            </FormField>

            <FormField label="Password" error={errors.password?.message} required>
              <Input {...register('password')} error={errors.password} type="password" placeholder="Min. 8 characters" />
            </FormField>

            <FormField label="Confirm Password" error={errors.confirmPassword?.message} required>
              <Input {...register('confirmPassword')} error={errors.confirmPassword} type="password" placeholder="Repeat your password" />
            </FormField>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Setting up...' : 'Initialize System'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
