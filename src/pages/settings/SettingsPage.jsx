import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Settings, Moon, Sun, Shield, Bell, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { updateDocument } from '../../services/firestoreService'
import { FormField, Input } from '../../components/ui/FormField'

export const SettingsPage = () => {
  const { dark, toggleTheme } = useTheme()
  const { userProfile, refreshProfile } = useAuth()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: userProfile?.name || '',
      email: userProfile?.email || '',
    }
  })

  const onProfileSave = async (data) => {
    setSaving(true)
    try {
      await updateDocument('users', userProfile.uid, { name: data.name })
      await refreshProfile()
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    {
      icon: Shield,
      title: 'Profile',
      description: 'Update your personal information',
      content: (
        <form onSubmit={handleSubmit(onProfileSave)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" error={errors.name?.message}>
              <Input {...register('name', { required: 'Name is required' })} placeholder="Your name" />
            </FormField>
            <FormField label="Email Address">
              <Input {...register('email')} type="email" disabled className="opacity-60 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )
    },
    {
      icon: dark ? Sun : Moon,
      title: 'Appearance',
      description: 'Customize the look and feel',
      content: (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Toggle between light and dark theme</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${dark ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${dark ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      )
    },
    {
      icon: Database,
      title: 'System Information',
      description: 'Current system details',
      content: (
        <div className="space-y-3">
          {[
            { label: 'Application', value: 'Cylinder Tracking System v1.0' },
            { label: 'Role', value: userProfile?.role === 'superadmin' ? 'Super Admin' : userProfile?.role === 'admin' ? 'Admin' : 'User' },
            { label: 'User ID', value: userProfile?.uid?.slice(0, 12) + '...' },
            { label: 'Status', value: 'Active' },
            { label: 'Database', value: 'Firebase Firestore' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</span>
            </div>
          ))}
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account and system preferences</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {sections.map((section) => (
          <div key={section.title} className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <section.icon className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="section-title leading-none">{section.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{section.description}</p>
              </div>
            </div>
            {section.content}
          </div>
        ))}
      </div>
    </div>
  )
}
