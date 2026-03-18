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
  critico:    { label: 'Crítico',     sub: '< 2 sem',    bg: '#FCEBEB', tc: '#791F1F', sc: '#A32D2D', bc: '#E24B4A' },
  moderado:   { label: 'Moderado',    sub: '2 – 4 sem',  bg: '#FAEEDA', tc: '#633806', sc: '#854F0B', bc: '#BA7517' },
  sobrestock: { label: 'Sobre stock', sub: '> 4 sem',    bg: '#EEEDFE', tc: '#3C3489', sc: '#533AB7', bc: '#534AB7' },
}

export function calcSemanas(cantidad, rotacion) {
  if (cantidad === 0) return 0
  if (!rotacion || rotacion === 0) return 999
  return cantidad / rotacion
}

export function calcCobertura(cantidad, rotacion) {
  if (cantidad === 0) return 'critico'
  const sem = calcSemanas(cantidad, rotacion)
  if (sem < 2)  return 'critico'
  if (sem <= 4) return 'moderado'
  return 'sobrestock'
}

export function semLabel(cantidad, rotacion) {
  if (cantidad === 0) return 'sin stock'
  const sem = calcSemanas(cantidad, rotacion)
  if (sem === 999) return '∞ sem'
  return sem.toFixed(1) + ' sem'
}
