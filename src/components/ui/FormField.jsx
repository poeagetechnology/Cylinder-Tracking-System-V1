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

export const Input = ({ register, error, ...props }) => (
  <input {...register} {...props} className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`} />
)

export const Select = ({ register, error, children, ...props }) => (
  <select {...register} {...props} className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`}>
    {children}
  </select>
)

export const Textarea = ({ register, error, rows = 3, ...props }) => (
  <textarea {...register} rows={rows} {...props} className={`input-field resize-none ${error ? 'border-red-500 focus:ring-red-500' : ''}`} />
)
