import { format, formatDistance } from 'date-fns'
import { Timestamp } from 'firebase/firestore'

// Convert Firestore Timestamp or date to JS Date
export const toDate = (val) => {
  if (!val) return null
  if (val instanceof Timestamp) return val.toDate()
  if (val?.seconds) return new Date(val.seconds * 1000)
  if (val instanceof Date) return val
  return new Date(val)
}

// Format date
export const fmtDate = (val, fmt = 'dd MMM yyyy') => {
  const d = toDate(val)
  if (!d) return '—'
  try {
    return format(d, fmt)
  } catch {
    return '—'
  }
}

// Format date time
export const fmtDateTime = (val) => fmtDate(val, 'dd MMM yyyy HH:mm')

// Time ago
export const timeAgo = (val) => {
  const d = toDate(val)
  if (!d) return '—'
  return formatDistance(d, new Date(), { addSuffix: true })
}

// Format currency (INR)
export const fmtCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount ?? 0)

// Capitalize
export const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '')

// Role label
export const roleLabel = (role) => {
  const map = { superadmin: 'Super Admin', admin: 'Admin', user: 'User' }
  return map[role] || capitalize(role)
}

// Status badge class
export const statusClass = (status) => {
  const map = {
    approved: 'badge-green',
    pending: 'badge-yellow',
    rejected: 'badge-red',
    active: 'badge-green',
    inactive: 'badge-gray',
    full: 'badge-blue',
    empty: 'badge-red',
    in_use: 'badge-yellow',
  }
  return map[status] || 'badge-gray'
}

// CSV export
export const exportToCSV = (data, filename = 'export') => {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? ''
        const str = String(val).replace(/"/g, '""')
        return str.includes(',') || str.includes('"') ? `"${str}"` : str
      }).join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Excel export
export const exportToExcel = async (data, filename = 'export', sheetName = 'Sheet1') => {
  try {
    const XLSX = await import('xlsx')
    if (!data.length) return

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Set column widths
    const colWidths = Object.keys(data[0]).map((key) => ({
      wch: Math.max(key.length, 12),
    }))
    worksheet['!cols'] = colWidths

    // Style header row
    const range = XLSX.utils.decode_range(worksheet['!ref'])
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1'
      if (!worksheet[address]) continue
      worksheet[address].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F46E5' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }

    XLSX.writeFile(workbook, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    alert('Failed to export to Excel. Please install xlsx package: npm install xlsx')
  }
}

// Generate ID
export const genId = () => Math.random().toString(36).substr(2, 9)
