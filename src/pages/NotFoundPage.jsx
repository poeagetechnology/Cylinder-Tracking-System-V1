import { Link } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'

export const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <div className="text-center max-w-md">
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
          <AlertCircle className="h-12 w-12 text-red-600" />
        </div>
      </div>
      <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</h1>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Page Not Found</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        The page you're looking for doesn't exist or you don't have permission to view it.
      </p>
      <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
        <Home className="h-4 w-4" /> Back to Dashboard
      </Link>
    </div>
  </div>
)
