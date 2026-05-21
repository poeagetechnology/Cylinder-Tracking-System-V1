export const LIQUID_OXYGEN_TYPE = 'Liquid Oxygen'

export const parseStockNumber = (value) => Number.parseFloat(value) || 0

export const formatCubicMeters = (value) =>
  `${parseStockNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} cubic meters`

export const getPurchaseCubicMeters = (purchase) => {
  if (['voided', 'cancelled', 'deleted'].includes(String(purchase?.status || '').toLowerCase())) return 0
  if (purchase.cubicMeters !== undefined) return parseStockNumber(purchase.cubicMeters)

  return (purchase.cylinders || []).reduce((sum, cylinder) => sum + parseStockNumber(cylinder.capacity), 0)
}

export const getFillingCubicMeters = (filling) => {
  if (['voided', 'cancelled', 'deleted'].includes(String(filling?.status || '').toLowerCase())) return 0
  if (filling.totalCubicMetersUsed !== undefined) return parseStockNumber(filling.totalCubicMetersUsed)

  return parseStockNumber(filling.cubicMetersUsed ?? filling.capacity) + parseStockNumber(filling.lessCubic)
}

export const getLiquidOxygenStockSummary = (purchases = [], fillings = [], stockTransactions = []) => {
  const activeTransactions = stockTransactions.filter((tx) => !['voided', 'cancelled', 'deleted'].includes(String(tx.status || '').toLowerCase()))

  if (activeTransactions.length > 0) {
    const stockInTypes = ['purchase_in', 'void_reversal', 'manual_in']
    const stockOutTypes = ['filling_out', 'less_cubic_adjustment', 'manual_adjustment']
    const totalCubicMeterStock = activeTransactions.reduce((sum, tx) =>
      stockInTypes.includes(tx.type) ? sum + parseStockNumber(tx.quantityCubicMeters) : sum, 0)
    const filledQuantity = activeTransactions.reduce((sum, tx) =>
      stockOutTypes.includes(tx.type) ? sum + parseStockNumber(tx.quantityCubicMeters) : sum, 0)
    const remainingQuantity = Math.max(totalCubicMeterStock - filledQuantity, 0)

    return {
      totalCubicMeterStock,
      availableStock: remainingQuantity,
      filledQuantity,
      remainingQuantity,
    }
  }

  const totalCubicMeterStock = purchases.reduce((sum, purchase) => sum + getPurchaseCubicMeters(purchase), 0)
  const filledQuantity = fillings.reduce((sum, filling) => sum + getFillingCubicMeters(filling), 0)
  const remainingQuantity = Math.max(totalCubicMeterStock - filledQuantity, 0)

  return {
    totalCubicMeterStock,
    availableStock: remainingQuantity,
    filledQuantity,
    remainingQuantity,
  }
}
