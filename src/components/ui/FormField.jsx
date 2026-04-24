import { forwardRef } from 'react'

export const FormField = ({ label, error, children, required }) => (
  <div className="mb-4">
    {label && (
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {error && <p className="error-text">{error}</p>}
  </div>
)


export const Input = forwardRef(({ error, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
    {...props}
  />
))

Input.displayName = 'Input'


export const Select = forwardRef(({ error, children, className = '', ...props }, ref) => (
  <select
    ref={ref}
    className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
    {...props}
  >
    {children}
  </select>
))

Select.displayName = 'Select'


export const Textarea = forwardRef(({ error, rows = 3, className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={`input-field resize-none ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
    {...props}
  />
))

Textarea.displayName = 'Textarea'
