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

export const Input = forwardRef(({ register, error, ...props }, ref) => (
  <input {...register} {...props} ref={ref} className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`} />
))

Input.displayName = 'Input'

export const Select = forwardRef(({ register, error, children, ...props }, ref) => (
  <select {...register} {...props} ref={ref} className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`}>
    {children}
  </select>
))

Select.displayName = 'Select'

export const Textarea = forwardRef(({ register, error, rows = 3, ...props }, ref) => (
  <textarea {...register} rows={rows} {...props} ref={ref} className={`input-field resize-none ${error ? 'border-red-500 focus:ring-red-500' : ''}`} />
))

Textarea.displayName = 'Textarea'
