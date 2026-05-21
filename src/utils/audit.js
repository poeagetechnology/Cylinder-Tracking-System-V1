import { addDocument } from '../services/firestoreService'
import { getUserName } from './records'

export const writeAuditLog = async ({
  action,
  collectionName,
  recordId,
  recordLabel = '',
  before = null,
  after = null,
  quantityCubicMeters = null,
  stockBefore = null,
  stockAfter = null,
  userProfile,
}) => {
  await addDocument('auditLogs', {
    action,
    collectionName,
    recordId,
    recordLabel,
    before,
    after,
    quantityCubicMeters,
    stockBefore,
    stockAfter,
    performedBy: getUserName(userProfile),
    createdAt: new Date().toISOString(),
  })
}

export const writeStockTransaction = async ({
  type,
  sourceCollection,
  sourceId,
  branchId = '',
  branchName = '',
  oxygenType = 'Liquid Oxygen',
  quantityCubicMeters,
  stockBefore,
  stockAfter,
  status = 'active',
  userProfile,
}) => {
  return addDocument('stockTransactions', {
    type,
    sourceCollection,
    sourceId,
    branchId,
    branchName,
    oxygenType,
    quantityCubicMeters,
    stockBefore,
    stockAfter,
    status,
    recordedBy: getUserName(userProfile),
    createdAt: new Date().toISOString(),
  })
}
