import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES } from '../lib/inventario'

const th = { padding:'7px 10px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8', whiteSpace:'nowrap' }
const td = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }
const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 })}`

export default function ValorInventario() {
  const [inv,      setInv]      = useState([])
  const [movs,     setMovs]     = useState([])
  const [talleres, setTalleres] = useState([])
  const [skus,     setSkus]     = useState([])
  const [loading,  setLoading]  = useState(true)

  const [fRegion,   setFRegion]   = useState('')
  const [fTipo,     setFTipo]     = useState('')
  const [fTaller,   setFTaller]   = useState('')
  const [fFechaIni, setFFechaIni] = useState('')
  const [fFechaFin, setFFechaFin] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:i }, { data:t }, { data:s }, { data:m }] = await Promise.all([
      supabase.from('inventario').select('taller_id, sku_id, cantidad, costo_promedio'),
      supabase.from('talleres').select('*').eq('activo', true).order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').eq('activo', true).order('codigo'),
      supabase.from('movimientos')
        .select('taller_id, sku_id, tipo, cantidad, precio_unitario, precio_total, ajuste_tipo, fecha, estado_aprobacion, origen, es_garantia')
        .eq('estado_aprobacion', 'aprobado')
        .order('fecha', { ascending: true }),
    ])
    setInv(i ?? []); setTalleres(t ?? []); setSkus(s ?? []); setMovs(m ?? [])
    setLoading(false)
  }

  function tipoSku(sku) {
    const cod = sku.codigo.toUpperCase()
    if (cod.includes('CASCO')) return 'casco'
    if (cod.includes('BAT'))   return 'bateria'
    return 'llanta'
  }
  function esBateria(sku) { return tipoSku(sku) === 'bateria' }

  const filas = inv.map(r => {
    const taller = talleres.find(t => t.id === r.taller_id)
    const sku    = skus.find(s => s.id === r.sku_id)
    if (!taller || !sku) return null
    const costo = Number(r.costo_promedio) || 0
    const valor = r.cantidad * costo
    const tipo  = tipoSku(sku)
    return { ...r, taller, sku, costo, valor, tipo }
  }).filter(Boolean)

  const filasFilt = filas.filter(r => {
    if (fRegion && r.taller.region !== fRegion) return false
    if (fTipo   && r.tipo !== fTipo)            return false
    if (fTaller && r.taller_id !== fTaller)     return false
    return true
  })

  const totalGlobal   = filasFilt.reduce((s, r) => s + r.valor, 0)
  const totalLlantas  = filasFilt.filter(r => r.tipo==='llanta').reduce((s,r) => s+r.valor, 0)
  const totalBaterias = filasFilt.filter(r => r.tipo==='bateria').reduce((s,r) => s+r.valor, 0)
  const totalCascos   = filasFilt.filter(r => r.tipo==='casco').reduce((s,r) => s+r.valor, 0)
  const totalUnidades = filasFilt.reduce((s, r) => s + r.cantidad, 0)

  // Valor por ciudad
  const porCiudad = {}
  filasFilt.forEach(r => {
    const reg = r.taller.region
    if (!porCiudad[reg]) porCiudad[reg] = { valor:0, unidades:0 }
    porCiudad[reg].valor    += r.valor
    porCiudad[reg].unidades += r.cantidad
  })

  // Valor por SKU
  const porSku = {}
  filasFilt.forEach(r => {
    const cod = r.sku.codigo
    if (!porSku[cod]) porSku[cod] = { valor:0, unidades:0, tipo:r.tipo, costo:r.costo }
    porSku[cod].valor    += r.valor
    porSku[cod].unidades += r.cantidad
  })

  // Valor por taller (inventario actual)
  const valorPorTaller = {}
  filasFilt.forEach(r => {
    const key = r.taller_id
    if (!valorPorTaller[key]) valorPorTaller[key] = { nombre:r.taller.nombre, region:r.taller.region, valor:0, unidades:0 }
    valorPorTaller[key].valor    += r.valor
    valorPorTaller[key].unidades += r.cantidad
  })

  // Movimientos en el período de fechas para tabla de entradas/salidas por taller
  const costoActualMap = {}
  inv.forEach(r => { costoActualMap[`${r.taller_id}_${r.sku_id}`] = Number(r.costo_promedio)||0 })

  const movsEnRango = movs.filter(m => {
    if (fFechaIni && m.fecha < fFechaIni) return false
    if (fFechaFin && m.fecha > fFechaFin) return false
    if (m.origen === 'movimiento') return false   // excluir traslados entre talleres
    if (m.es_garantia) return false               // excluir garantías
    return true
  })

  const valorPeriodo = {}
  movsEnRango.forEach(m => {
    const taller = talleres.find(t => t.id === m.taller_id)
    const sku    = skus.find(s => s.id === m.sku_id)
    if (!taller || !sku) return
    if (fRegion && taller.region !== fRegion) return
    if (fTaller && m.taller_id !== fTaller)  return
    if (fTipo) {
      const esBat = esBateria(sku)
      if (fTipo === 'bateria' && !esBat) return
      if (fTipo === 'llanta'  &&  esBat) return
    }
    const key = m.taller_id
    if (!valorPeriodo[key]) valorPeriodo[key] = { nombre:taller.nombre, region:taller.region, entradas:0, salidas:0 }
    const costo = m.precio_unitario
      ? Number(m.precio_unitario)
      : costoActualMap[`${m.taller_id}_${m.sku_id}`] || 0
    const monto = costo * m.cantidad
    if (m.tipo === 'entrada') valorPeriodo[key].entradas += monto
    else if (m.tipo === 'salida') valorPeriodo[key].salidas += monto
    else if (m.tipo === 'ajuste') {
      if (m.ajuste_tipo === 'incremento') valorPeriodo[key].entradas += monto
      else valorPeriodo[key].salidas += monto
    }
  })

  const hayFiltroFecha = fFechaIni || fFechaFin

  // ── Inventario inicial y final del período ──────────────────
  // Usamos los movimientos YA cargados (todos) para calcular sin queries adicionales.
  //
  // inv_final  = inv_actual - neto(movimientos POSTERIORES a fecha_fin)
  // inv_inicial = inv_final - neto(movimientos DEL PERÍODO)
  //
  // neto = valor_entradas - valor_salidas (en pesos s/IVA)

  const invInicialPeriodo = {}
  const invFinalPeriodo   = {}

  if (hayFiltroFecha) {
    // Helper: calcular valor de un movimiento
    const valorMov = (m) => {
      const costo = m.precio_unitario
        ? Number(m.precio_unitario)
        : costoActualMap[`${m.taller_id}_${m.sku_id}`] || 0
      return costo * m.cantidad
    }
    // Helper: contribución neta de un movimiento al inventario (+entrada, -salida)
    const netoMov = (m) => {
      if (m.tipo === 'entrada') return valorMov(m)
      if (m.tipo === 'salida')  return -valorMov(m)
      if (m.tipo === 'ajuste')
        return m.ajuste_tipo === 'incremento' ? valorMov(m) : -valorMov(m)
      return 0
    }
    // Aplicar filtros de taller/region/tipo
    const matchFiltros = (m) => {
      const taller = talleres.find(t => t.id === m.taller_id)
      const sku    = skus.find(s => s.id === m.sku_id)
      if (!taller || !sku) return false
      if (m.origen === 'movimiento') return false
      if (m.es_garantia) return false
      if (fRegion && taller.region !== fRegion) return false
      if (fTaller && m.taller_id !== fTaller)   return false
      if (fTipo) {
        const tipo = tipoSku(sku)
        if (tipo !== fTipo) return false
      }
      return true
    }

    // Movimientos posteriores a fecha_fin (para revertir al inventario final del período)
    const movsPosteriores = fFechaFin
      ? movs.filter(m => m.fecha > fFechaFin && matchFiltros(m))
      : []

    // Construir inventario final y inicial por taller
    // Primero reunir todos los taller_id relevantes (del período + posteriores)
    const talleresRelevantes = new Set([
      ...Object.keys(valorPeriodo),
      ...movsPosteriores.map(m => m.taller_id)
    ])

    talleresRelevantes.forEach(tallerId => {
      const taller = talleres.find(t => t.id === tallerId)
      if (!taller) return

      // Valor actual del inventario de este taller (con filtros)
      const invActualTaller = filasFilt
        .filter(r => r.taller_id === tallerId)
        .reduce((s, r) => s + r.valor, 0)

      // Revertir movimientos posteriores a fecha_fin
      const netoPost = movsPosteriores
        .filter(m => m.taller_id === tallerId)
        .reduce((s, m) => s + netoMov(m), 0)

      // Inventario al final del período = actual - lo que entró/salió después del período
      const valFinal = Math.max(0, invActualTaller - netoPost)

      // Neto del período para este taller
      const dp = valorPeriodo[tallerId]
      const netoPeriodo = dp ? (dp.entradas - dp.salidas) : 0

      // Inventario al inicio del período = final - neto del período
      const valInicial = Math.max(0, valFinal - netoPeriodo)

      invFinalPeriodo[tallerId]   = { nombre:taller.nombre, region:taller.region, valor:valFinal }
      invInicialPeriodo[tallerId] = { nombre:taller.nombre, region:taller.region, valor:valInicial }
    })
  }

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando inventario valorizado...</div>

  return (
    <div style={{ padding:20, maxWidth:1300 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Valor de Inventario</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Valuado a costo promedio ponderado s/IVA</p>
        </div>
        <button onClick={load} style={{ padding:'5px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, cursor:'pointer', background:'white' }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Valor total',    value:fmt(totalGlobal),   color:'#1a4f8a' },
          { label:'Llantas',        value:fmt(totalLlantas),  color:'#166534' },
          { label:'Baterías',       value:fmt(totalBaterias), color:'#854D0E' },
          { label:'Cascos',         value:fmt(totalCascos),   color:'#0C447C' },
        ].map(c => (
          <div key={c.label} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:'14px 16px' }}>
            <p style={{ fontSize:11, color:'#888', marginBottom:6 }}>{c.label}</p>
            <p style={{ fontSize:18, fontWeight:500, color:c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10,
        padding:'10px 14px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>Ciudad</div>
          <select value={fRegion} onChange={e=>setFRegion(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:120 }}>
            <option value="">Todas</option>
            {Object.entries(REGIONES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>Tipo</div>
          <select value={fTipo} onChange={e=>setFTipo(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:110 }}>
            <option value="">Todos</option>
            <option value="llanta">🔵 Llantas</option>
            <option value="bateria">🟡 Baterías</option>
            <option value="casco">🔘 Cascos</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>Taller</div>
          <select value={fTaller} onChange={e=>setFTaller(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:160 }}>
            <option value="">Todos</option>
            {talleres.filter(t => !fRegion || t.region===fRegion).map(t =>
              <option key={t.id} value={t.id}>{t.nombre}</option>
            )}
          </select>
        </div>
        <div style={{ borderLeft:'1px solid #e0dfd8', paddingLeft:10, display:'flex', gap:8 }}>
          <div>
            <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>Fecha inicio movimientos</div>
            <input type="date" value={fFechaIni} onChange={e=>setFFechaIni(e.target.value)}
              style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11 }}/>
          </div>
          <div>
            <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>Fecha fin</div>
            <input type="date" value={fFechaFin} onChange={e=>setFFechaFin(e.target.value)}
              style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11 }}/>
          </div>
        </div>
        {(fRegion||fTipo||fTaller||fFechaIni||fFechaFin) && (
          <button onClick={() => { setFRegion(''); setFTipo(''); setFTaller(''); setFFechaIni(''); setFFechaFin('') }}
            style={{ padding:'5px 10px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, background:'white', cursor:'pointer', alignSelf:'flex-end' }}>
            Limpiar
          </button>
        )}
        {hayFiltroFecha && (
          <span style={{ fontSize:11, color:'#854D0E', background:'#FEF9C3', padding:'4px 10px', borderRadius:7, alignSelf:'flex-end' }}>
            📅 Mostrando movimientos del período
          </span>
        )}
      </div>

      {/* Ciudad cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20 }}>
        {Object.entries(REGIONES).map(([reg, cfg]) => {
          const d = porCiudad[reg]
          return (
            <div key={reg} style={{ background:'white', border:`1.5px solid ${fRegion===reg?cfg.color:cfg.color+'40'}`, borderRadius:10, padding:'14px 16px',
              cursor:'pointer', outline: fRegion===reg ? `2px solid ${cfg.color}` : 'none' }}
              onClick={() => setFRegion(fRegion===reg ? '' : reg)}>
              <p style={{ fontSize:12, fontWeight:500, color:cfg.color, marginBottom:4 }}>{cfg.label} {fRegion===reg && '✓'}</p>
              <p style={{ fontSize:18, fontWeight:500, color:'#333' }}>{d ? fmt(d.valor) : '$0.00'}</p>
              <p style={{ fontSize:11, color:'#888', marginTop:3 }}>{d ? d.unidades : 0} unidades</p>
            </div>
          )
        })}
      </div>

      {/* ── Tabla: Valor por taller ── */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'10px 16px', borderBottom:'0.5px solid #e0dfd8', background:'#f9f9f7' }}>
          <p style={{ fontWeight:500, fontSize:13 }}>Valor por taller — inventario actual</p>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Stock actual × costo promedio ponderado</p>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr>
            <th style={th}>Taller</th>
            <th style={th}>Ciudad</th>
            <th style={{ ...th, textAlign:'right' }}>Unidades</th>
            <th style={{ ...th, textAlign:'right' }}>Valor total s/IVA</th>
            <th style={{ ...th, textAlign:'right' }}>% del total</th>
          </tr></thead>
          <tbody>
            {Object.entries(valorPorTaller).sort((a,b)=>b[1].valor-a[1].valor).map(([id,d],idx)=>{
              const rc = REGIONES[d.region] ?? {}
              return (
                <tr key={id} style={{ background:idx%2===0?'white':'#fafafa' }}>
                  <td style={{ ...td, fontWeight:500 }}>{d.nombre}</td>
                  <td style={{ ...td, fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                  <td style={{ ...td, textAlign:'right' }}>{d.unidades}</td>
                  <td style={{ ...td, textAlign:'right', fontWeight:500, color:'#1a4f8a' }}>{fmt(d.valor)}</td>
                  <td style={{ ...td, textAlign:'right', color:'#888' }}>
                    {totalGlobal>0 ? (d.valor/totalGlobal*100).toFixed(1)+'%' : '—'}
                  </td>
                </tr>
              )
            })}
            <tr style={{ background:'#f5f5f3', borderTop:'2px solid #e0dfd8' }}>
              <td colSpan={3} style={{ ...td, fontWeight:500, textAlign:'right' }}>Total</td>
              <td style={{ ...td, textAlign:'right', fontWeight:500, fontSize:13, color:'#1a4f8a' }}>{fmt(totalGlobal)}</td>
              <td style={{ ...td, textAlign:'right', color:'#888' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Tabla: Movimientos en período ── */}
      {hayFiltroFecha && (
        <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'10px 16px', borderBottom:'0.5px solid #e0dfd8', background:'#f9f9f7' }}>
            <p style={{ fontWeight:500, fontSize:13 }}>
              Movimientos del período {fFechaIni && `desde ${fFechaIni}`} {fFechaFin && `hasta ${fFechaFin}`}
            </p>
            <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Excluye traslados entre talleres y garantías</p>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr>
              <th style={th}>Taller</th>
              <th style={th}>Ciudad</th>
              <th style={{ ...th, textAlign:'right', color:'#5F5E5A' }}>Inv. inicial</th>
              <th style={{ ...th, textAlign:'right', color:'#166534' }}>Entradas (+)</th>
              <th style={{ ...th, textAlign:'right', color:'#A32D2D' }}>Salidas (−)</th>
              <th style={{ ...th, textAlign:'right' }}>Neto período</th>
              <th style={{ ...th, textAlign:'right', color:'#1a4f8a' }}>Inv. final</th>
            </tr></thead>
            <tbody>
              {Object.keys(valorPeriodo).length === 0 && (
                <tr><td colSpan={7} style={{ padding:20, textAlign:'center', color:'#aaa' }}>Sin movimientos en el período seleccionado</td></tr>
              )}
              {Object.entries(valorPeriodo).sort((a,b)=>(b[1].entradas+b[1].salidas)-(a[1].entradas+a[1].salidas)).map(([id,d],idx)=>{
                const rc      = REGIONES[d.region] ?? {}
                const neto    = d.entradas - d.salidas
                const invIni  = invInicialPeriodo[id]?.valor ?? 0
                const invFin  = invFinalPeriodo[id]?.valor ?? 0
                return (
                  <tr key={id} style={{ background:idx%2===0?'white':'#fafafa' }}>
                    <td style={{ ...td, fontWeight:500 }}>{d.nombre}</td>
                    <td style={{ ...td, fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                    <td style={{ ...td, textAlign:'right', color:'#5F5E5A' }}>{fmt(invIni)}</td>
                    <td style={{ ...td, textAlign:'right', color:'#166534', fontWeight:500 }}>+{fmt(d.entradas)}</td>
                    <td style={{ ...td, textAlign:'right', color:'#A32D2D', fontWeight:500 }}>−{fmt(d.salidas)}</td>
                    <td style={{ ...td, textAlign:'right', fontWeight:500, color:neto>=0?'#166534':'#A32D2D' }}>
                      {neto>=0?'+':''}{fmt(neto)}
                    </td>
                    <td style={{ ...td, textAlign:'right', fontWeight:500, color:'#1a4f8a' }}>{fmt(invFin)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen por SKU */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        {['llanta','bateria','casco'].map(tipo => {
          const skusDelTipo = Object.entries(porSku).filter(([,d])=>d.tipo===tipo).sort((a,b)=>b[1].valor-a[1].valor)
          if (!skusDelTipo.length) return null
          const totalTipo = skusDelTipo.reduce((s,[,d])=>s+d.valor,0)
          return (
            <div key={tipo} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:tipo==='llanta'?'#DCFCE7':'#FEF9C3',
                borderBottom:'0.5px solid #e0dfd8', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:500, fontSize:12, color:tipo==='llanta'?'#166534':tipo==='bateria'?'#854D0E':'#0C447C' }}>
                  {tipo==='llanta'?'🔵 Llantas':tipo==='bateria'?'🟡 Baterías':'🔘 Cascos'}
                </span>
                <span style={{ fontWeight:500, fontSize:12, color:tipo==='llanta'?'#166534':tipo==='bateria'?'#854D0E':'#0C447C' }}>{fmt(totalTipo)}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign:'right' }}>Costo prom.</th>
                  <th style={{ ...th, textAlign:'right' }}>Unidades</th>
                  <th style={{ ...th, textAlign:'right' }}>Valor total</th>
                  <th style={{ ...th, textAlign:'right' }}>% total</th>
                </tr></thead>
                <tbody>
                  {skusDelTipo.map(([cod,d],idx)=>(
                    <tr key={cod} style={{ background:idx%2===0?'white':'#fafafa' }}>
                      <td style={{ ...td, fontFamily:'monospace', fontWeight:500 }}>{cod}</td>
                      <td style={{ ...td, textAlign:'right', color:'#888' }}>{fmt(d.costo)}</td>
                      <td style={{ ...td, textAlign:'right' }}>{d.unidades}</td>
                      <td style={{ ...td, textAlign:'right', fontWeight:500 }}>{fmt(d.valor)}</td>
                      <td style={{ ...td, textAlign:'right', color:'#888' }}>
                        {totalGlobal>0?(d.valor/totalGlobal*100).toFixed(1)+'%':'—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* Detalle por taller y SKU */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', borderBottom:'0.5px solid #e0dfd8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontWeight:500, fontSize:13 }}>Detalle por taller y SKU</p>
          <p style={{ fontSize:11, color:'#888' }}>{filasFilt.filter(r=>r.valor>0).length} posiciones</p>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr>
              <th style={th}>Taller</th><th style={th}>Ciudad</th><th style={th}>SKU</th><th style={th}>Tipo</th>
              <th style={{ ...th, textAlign:'right' }}>Stock</th>
              <th style={{ ...th, textAlign:'right' }}>Costo prom. s/IVA</th>
              <th style={{ ...th, textAlign:'right' }}>Valor total</th>
              <th style={{ ...th, textAlign:'right' }}>% cartera</th>
            </tr></thead>
            <tbody>
              {filasFilt.filter(r=>r.cantidad>0).length===0 && (
                <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin datos</td></tr>
              )}
              {filasFilt.filter(r=>r.cantidad>0).sort((a,b)=>b.valor-a.valor).map((r,idx)=>{
                const rc = REGIONES[r.taller.region] ?? {}
                return (
                  <tr key={`${r.taller_id}_${r.sku_id}`} style={{ background:idx%2===0?'white':'#fafafa' }}>
                    <td style={{ ...td, fontWeight:500 }}>{r.taller.nombre}</td>
                    <td style={{ ...td, fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:11 }}>{r.sku.codigo}</td>
                    <td style={td}>
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, fontWeight:500,
                        background:r.tipo==='llanta'?'#DCFCE7':'#FEF9C3',
                        color:r.tipo==='llanta'?'#166534':'#854D0E' }}>
                        {r.tipo==='llanta'?'Llanta':'Batería'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign:'right' }}>{r.cantidad}</td>
                    <td style={{ ...td, textAlign:'right', color:'#888' }}>{r.costo>0?fmt(r.costo):<span style={{color:'#ccc'}}>Sin costo</span>}</td>
                    <td style={{ ...td, textAlign:'right', fontWeight:500, color:r.valor>0?'#1a4f8a':'#ccc' }}>{r.valor>0?fmt(r.valor):'—'}</td>
                    <td style={{ ...td, textAlign:'right', color:'#888' }}>{totalGlobal>0&&r.valor>0?(r.valor/totalGlobal*100).toFixed(1)+'%':'—'}</td>
                  </tr>
                )
              })}
              <tr style={{ background:'#f5f5f3', borderTop:'2px solid #e0dfd8' }}>
                <td colSpan={4} style={{ ...td, fontWeight:500, textAlign:'right', color:'#555' }}>Total</td>
                <td style={{ ...td, textAlign:'right', fontWeight:500 }}>{totalUnidades}</td>
                <td style={td}/>
                <td style={{ ...td, textAlign:'right', fontWeight:500, fontSize:13, color:'#1a4f8a' }}>{fmt(totalGlobal)}</td>
                <td style={{ ...td, textAlign:'right', color:'#888' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
