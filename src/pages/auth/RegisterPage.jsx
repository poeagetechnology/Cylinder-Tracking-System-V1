import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { registerUser } from '../../services/authService'
import { logoutUser } from '../../services/authService'
import { registerSchema } from '../../utils/validations'
import { FormField, Input } from '../../components/ui/FormField'

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(registerSchema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await registerUser(data)
      await logoutUser()
      setSuccess(true)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="card">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Registration Submitted</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Your account is pending admin approval. You'll be able to log in once approved.
            </p>
            <Link to="/login" className="btn-primary inline-block">Back to Login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-lg mb-4">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Create Account</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Pending approval after registration</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <FormField label="Full Name" error={errors.name?.message} required>
              <Input {...register('name')} error={errors.name} placeholder="Your full name" />
            </FormField>

            <FormField label="Email Address" error={errors.email?.message} required>
              <Input {...register('email')} error={errors.email} type="email" placeholder="your@email.com" />
            </FormField>

            <FormField label="Password" error={errors.password?.message} required>
              <Input {...register('password')} error={errors.password} type="password" placeholder="Min. 8 characters" />
            </FormField>

            <FormField label="Confirm Password" error={errors.confirmPassword?.message} required>
              <Input {...register('confirmPassword')} error={errors.confirmPassword} type="password" placeholder="Repeat password" />
            </FormField>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
