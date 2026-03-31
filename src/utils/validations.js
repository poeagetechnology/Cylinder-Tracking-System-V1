import * as Yup from 'yup'

export const superAdminSchema = Yup.object({
  name: Yup.string().min(2, 'Name too short').required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
})

export const loginSchema = Yup.object({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
})

export const registerSchema = Yup.object({
  name: Yup.string().min(2, 'Name too short').required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
})

export const gasTypeSchema = Yup.object({
  gasName: Yup.string().min(2).required('Gas name is required'),
  capacities: Yup.array().of(
    Yup.object({
      value: Yup.number().typeError('Must be a number').positive('Must be positive').required('Value is required'),
      unit: Yup.string().oneOf(['kg', 'cubic'], 'Unit must be kg or cubic').required('Unit is required'),
    })
  ).min(1, 'Add at least one capacity'),
})

export const cylinderSchema = Yup.object({
  cylinderCode: Yup.string().required('Cylinder code is required'),
  gasTypeId: Yup.string().required('Gas type is required'),
  capacity: Yup.number().positive().required('Capacity is required'),
  status: Yup.string().required('Status is required'),
  location: Yup.string().required('Location is required'),
})

export const customerSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  phone: Yup.string().matches(/^\d{10}$/, 'Invalid phone number').required('Phone is required'),
  email: Yup.string().email('Invalid email').nullable(),
  address: Yup.string().required('Address is required'),
})

export const supplierSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  contactPerson: Yup.string().required('Contact person is required'),
  phone: Yup.string().matches(/^\d{10}$/, 'Invalid phone number').required('Phone is required'),
  email: Yup.string().email('Invalid email').nullable(),
  address: Yup.string().required('Address is required'),
})

export const vehicleSchema = Yup.object({
  vehicleNumber: Yup.string().required('Vehicle number is required'),
  vehicleType: Yup.string().required('Vehicle type is required'),
  driverName: Yup.string().required('Driver name is required'),
  capacity: Yup.number().positive().required('Capacity is required'),
})

export const expenseSchema = Yup.object({
  category: Yup.string().required('Category is required'),
  amount: Yup.number().positive().required('Amount is required'),
  description: Yup.string().required('Description is required'),
  date: Yup.string().required('Date is required'),
})
