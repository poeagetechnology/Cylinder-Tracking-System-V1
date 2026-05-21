import { capitalize, statusClass } from '../../utils/helpers'

export const Badge = ({ status, label }) => {
  const cls = statusClass(status)
  return <span className={cls}>{label || capitalize(status)}</span>
}
