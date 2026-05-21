export const LIQUID_OXYGEN_TYPE = 'Liquid Oxygen'

export const parseStockNumber = (value) => Number.parseFloat(value) || 0

export const formatCubicMeters = (value) =>
  `${parseStockNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} cubic meters`

export const getPurchaseCubicMeters = (purchase) => {
  if (purchase.cubicMeters !== undefined) return parseStockNumber(purchase.cubicMeters)

  return (purchase.cylinders || []).reduce((sum, cylinder) => sum + parseStockNumber(cylinder.capacity), 0)
}

export const getFillingCubicMeters = (filling) => {
  if (filling.totalCubicMetersUsed !== undefined) return parseStockNumber(filling.totalCubicMetersUsed)

  return parseStockNumber(filling.cubicMetersUsed ?? filling.capacity) + parseStockNumber(filling.lessCubic)
}

export const getLiquidOxygenStockSummary = (purchases = [], fillings = []) => {
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
