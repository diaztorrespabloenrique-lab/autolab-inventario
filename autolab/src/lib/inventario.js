export const REGIONES = {
  cdmx:   { label: 'Ciudad de México', color: '#185FA5' },
  gdl:    { label: 'Guadalajara',      color: '#0F6E56' },
  puebla: { label: 'Puebla',           color: '#854F0B' },
}
export const CLIENTES = {
  minave: { label: 'MI NAVE',       bg: '#E6F1FB', color: '#0C447C' },
  kovi:   { label: 'KOVI',          bg: '#EEEDFE', color: '#3C3489' },
  ind:    { label: 'Independiente', bg: '#F1EFE8', color: '#5F5E5A' },
}
export const COB_CFG = {
  critico:      { label: 'Crítico',      sub: '< 2 sem',        bg: '#FCEBEB', tc: '#791F1F', sc: '#A32D2D', bc: '#E24B4A' },
  moderado:     { label: 'Moderado',     sub: '2 – 4 sem',      bg: '#FAEEDA', tc: '#633806', sc: '#854F0B', bc: '#BA7517' },
  sobrestock:   { label: 'Sobre stock',  sub: '> 4 sem',        bg: '#EEEDFE', tc: '#3C3489', sc: '#533AB7', bc: '#534AB7' },
  sin_rotacion: { label: 'Sin rotación', sub: 'stock 0, rot 0', bg: '#F1EFE8', tc: '#5F5E5A', sc: '#888780', bc: '#B4B2A9' },
}
export const ORIGEN_CFG = {
  compra:     { label: 'Compra',     bg: '#E6F1FB', color: '#0C447C' },
  movimiento: { label: 'Movimiento', bg: '#E1F5EE', color: '#085041' },
  garantia:   { label: 'Garantía',   bg: '#FAEEDA', color: '#633806' },
  cascos:     { label: 'Cascos',     bg: '#F1EFE8', color: '#5F5E5A' },
}
export const ROLES_ESCRITURA = ['admin', 'staff']
export function semLabel(cantidad, rotacion) {
  if (cantidad === 0 && (!rotacion || rotacion === 0)) return 'sin rot.'
  if (cantidad === 0) return 'sin stock'
  const sem = rotacion > 0 ? cantidad / rotacion : 999
  return sem === 999 ? '∞ sem' : sem.toFixed(1) + ' sem'
}
export function formatMXN(val) {
  return '$' + Math.round(val ?? 0).toLocaleString('es-MX')
}
export const IVA = 1.16
