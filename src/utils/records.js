export const normalizeText = (value) => String(value ?? '').trim()

export const normalizeKey = (value) => normalizeText(value).toLowerCase()

export const isVoided = (record) =>
  ['voided', 'cancelled', 'deleted'].includes(normalizeKey(record?.status))

export const activeRecords = (records = []) => records.filter((record) => !isVoided(record))

export const hasDuplicateValue = (records = [], field, value, excludeId) => {
  const normalized = normalizeKey(value)
  if (!normalized) return false

  return activeRecords(records).some((record) =>
    record.id !== excludeId && normalizeKey(record[field]) === normalized
  )
}

export const hasDuplicateCylinderIds = (items = []) => {
  const ids = items.map((item) => item.cylinderId).filter(Boolean)
  return new Set(ids).size !== ids.length
}

export const getUserName = (userProfile) => userProfile?.name || userProfile?.email || 'System'

export const getVoidPayload = (userProfile) => ({
  status: 'voided',
  voidedAt: new Date().toISOString(),
  voidedBy: getUserName(userProfile),
})
