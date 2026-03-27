import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES } from '../lib/inventario'

const th = { padding:'7px 10px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8', whiteSpace:'nowrap' }
const td = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }

const fmt = (n) => n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 })}`

export default function ValorInventario() {
  const [inv,      setInv]      = useState([])
  const [talleres, setTalleres] = useState([])
  const [skus,     setSkus]     = useState([])
  const [loading,  setLoading]  = useState(true)

  // Filtros
  const [fRegion, setFRegion] = useState('')
  const [fTipo,   setFTipo]   = useState('') // 'llanta' | 'bateria'
  const [fTaller, setFTaller] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:i }, { data:t }, { data:s }] = await Promise.all([
      supabase.from('inventario').select('taller_id, sku_id, cantidad, costo_promedio'),
      supabase.from('talleres').select('*').eq('activo', true).order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').eq('activo', true).order('codigo'),
    ])
    setInv(i ?? [])
    setTalleres(t ?? [])
    setSkus(s ?? [])
    setLoading(false)
  }

  // Construir filas enriquecidas
  const filas = inv.map(r => {
    const taller = talleres.find(t => t.id === r.taller_id)
    const sku    = skus.find(s => s.id === r.sku_id)
    if (!taller || !sku) return null
    const costo  = Number(r.costo_promedio) || 0
    const valor  = r.cantidad * costo
    const tipo   = (sku.tipos_refaccion?.nombre ?? '').toLowerCase().includes('bat') ? 'bateria' : 'llanta'
    return { ...r, taller, sku, costo, valor, tipo }
  }).filter(Boolean)

  // Aplicar filtros
  const filasFilt = filas.filter(r => {
    if (fRegion && r.taller.region !== fRegion) return false
    if (fTipo   && r.tipo !== fTipo)            return false
    if (fTaller && r.taller_id !== fTaller)     return false
    return true
  })

  // Totales globales
  const totalGlobal    = filasFilt.reduce((s, r) => s + r.valor, 0)
  const totalLlantas   = filasFilt.filter(r => r.tipo==='llanta').reduce((s,r) => s+r.valor, 0)
  const totalBaterias  = filasFilt.filter(r => r.tipo==='bateria').reduce((s,r) => s+r.valor, 0)
  const totalUnidades  = filasFilt.reduce((s, r) => s + r.cantidad, 0)

  // Totales por ciudad
  const porCiudad = {}
  filasFilt.forEach(r => {
    const reg = r.taller.region
    if (!porCiudad[reg]) porCiudad[reg] = { valor:0, unidades:0 }
    porCiudad[reg].valor    += r.valor
    porCiudad[reg].unidades += r.cantidad
  })

  // Totales por SKU
  const porSku = {}
  filasFilt.forEach(r => {
    const cod = r.sku.codigo
    if (!porSku[cod]) porSku[cod] = { valor:0, unidades:0, tipo:r.tipo, costo:r.costo }
    porSku[cod].valor    += r.valor
    porSku[cod].unidades += r.cantidad
  })

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando inventario valorizado...</div>

  return (
    <div style={{ padding:20, maxWidth:1300 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Valor de Inventario</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>
            Valuado a costo promedio ponderado s/IVA · actualización automática con cada movimiento
          </p>
        </div>
        <button onClick={load}
          style={{ padding:'5px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, cursor:'pointer', background:'white' }}>
          ↻ Actualizar
        </button>
      </div>

      {/* ── Tarjetas de resumen ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Valor total inventario', value:fmt(totalGlobal),   color:'#1a4f8a', bg:'#E6F1FB' },
          { label:'Llantas',                value:fmt(totalLlantas),  color:'#166534', bg:'#DCFCE7' },
          { label:'Baterías',               value:fmt(totalBaterias), color:'#854D0E', bg:'#FEF9C3' },
          { label:'Unidades totales',       value:totalUnidades.toLocaleString('es-MX'), color:'#5F5E5A', bg:'#F1EFE8' },
        ].map(c => (
          <div key={c.label} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:'14px 16px' }}>
            <p style={{ fontSize:11, color:'#888', marginBottom:6 }}>{c.label}</p>
            <p style={{ fontSize:18, fontWeight:500, color:c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Valor por ciudad ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20 }}>
        {Object.entries(REGIONES).map(([reg, cfg]) => {
          const d = porCiudad[reg]
          if (!d && !fRegion) return (
            <div key={reg} style={{ background:'white', border:`1.5px solid ${cfg.color}20`, borderRadius:10, padding:'14px 16px' }}>
              <p style={{ fontSize:12, fontWeight:500, color:cfg.color, marginBottom:4 }}>{cfg.label}</p>
              <p style={{ fontSize:16, fontWeight:500, color:'#ccc' }}>$0.00</p>
              <p style={{ fontSize:11, color:'#ccc' }}>Sin inventario</p>
            </div>
          )
          if (!d) return null
          return (
            <div key={reg} style={{ background:'white', border:`1.5px solid ${cfg.color}40`, borderRadius:10, padding:'14px 16px',
              cursor:'pointer', outline: fRegion===reg ? `2px solid ${cfg.color}` : 'none' }}
              onClick={() => setFRegion(fRegion===reg ? '' : reg)}>
              <p style={{ fontSize:12, fontWeight:500, color:cfg.color, marginBottom:4 }}>
                {cfg.label} {fRegion===reg && '✓'}
              </p>
              <p style={{ fontSize:18, fontWeight:500, color:'#333' }}>{fmt(d.valor)}</p>
              <p style={{ fontSize:11, color:'#888', marginTop:3 }}>{d.unidades} unidades</p>
            </div>
          )
        })}
      </div>

      {/* ── Filtros ── */}
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
            <option value="llanta">Llantas</option>
            <option value="bateria">Baterías</option>
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
        {(fRegion||fTipo||fTaller) && (
          <button onClick={() => { setFRegion(''); setFTipo(''); setFTaller('') }}
            style={{ padding:'5px 10px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, background:'white', cursor:'pointer', alignSelf:'flex-end' }}>
            Limpiar
          </button>
        )}
        <span style={{ fontSize:11, color:'#888', alignSelf:'flex-end', marginLeft:'auto' }}>
          {filasFilt.length} registros · {fmt(totalGlobal)} total
        </span>
      </div>

      {/* ── Resumen por SKU ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        {['llanta','bateria'].map(tipo => {
          const skusDelTipo = Object.entries(porSku)
            .filter(([, d]) => d.tipo === tipo)
            .sort((a,b) => b[1].valor - a[1].valor)
          if (!skusDelTipo.length) return null
          const totalTipo = skusDelTipo.reduce((s,[,d]) => s+d.valor, 0)
          return (
            <div key={tipo} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background: tipo==='llanta'?'#DCFCE7':'#FEF9C3',
                borderBottom:'0.5px solid #e0dfd8', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:500, fontSize:12, color: tipo==='llanta'?'#166534':'#854D0E' }}>
                  {tipo==='llanta' ? '🔵 Llantas' : '🟡 Baterías'}
                </span>
                <span style={{ fontWeight:500, fontSize:12, color: tipo==='llanta'?'#166534':'#854D0E' }}>
                  {fmt(totalTipo)}
                </span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign:'right' }}>Costo prom.</th>
                  <th style={{ ...th, textAlign:'right' }}>Unidades</th>
                  <th style={{ ...th, textAlign:'right' }}>Valor total</th>
                  <th style={{ ...th, textAlign:'right' }}>% del total</th>
                </tr></thead>
                <tbody>
                  {skusDelTipo.map(([cod, d], idx) => (
                    <tr key={cod} style={{ background: idx%2===0?'white':'#fafafa' }}>
                      <td style={{ ...td, fontFamily:'monospace', fontWeight:500 }}>{cod}</td>
                      <td style={{ ...td, textAlign:'right', color:'#888' }}>{fmt(d.costo)}</td>
                      <td style={{ ...td, textAlign:'right' }}>{d.unidades}</td>
                      <td style={{ ...td, textAlign:'right', fontWeight:500 }}>{fmt(d.valor)}</td>
                      <td style={{ ...td, textAlign:'right', color:'#888' }}>
                        {totalGlobal > 0 ? (d.valor/totalGlobal*100).toFixed(1)+'%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* ── Detalle por taller ── */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', borderBottom:'0.5px solid #e0dfd8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontWeight:500, fontSize:13 }}>Detalle por taller</p>
          <p style={{ fontSize:11, color:'#888' }}>{filasFilt.filter(r=>r.valor>0).length} posiciones con valor</p>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr>
              <th style={th}>Taller</th>
              <th style={th}>Ciudad</th>
              <th style={th}>SKU</th>
              <th style={th}>Tipo</th>
              <th style={{ ...th, textAlign:'right' }}>Stock</th>
              <th style={{ ...th, textAlign:'right' }}>Costo prom. s/IVA</th>
              <th style={{ ...th, textAlign:'right' }}>Valor total</th>
              <th style={{ ...th, textAlign:'right' }}>% cartera</th>
            </tr></thead>
            <tbody>
              {filasFilt.filter(r => r.cantidad > 0).length === 0 && (
                <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'#aaa' }}>
                  No hay inventario con valor para los filtros aplicados
                </td></tr>
              )}
              {filasFilt
                .filter(r => r.cantidad > 0)
                .sort((a,b) => b.valor - a.valor)
                .map((r, idx) => {
                  const rc = REGIONES[r.taller.region] ?? {}
                  return (
                    <tr key={`${r.taller_id}_${r.sku_id}`} style={{ background: idx%2===0?'white':'#fafafa' }}>
                      <td style={{ ...td, fontWeight:500 }}>{r.taller.nombre}</td>
                      <td style={{ ...td, fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                      <td style={{ ...td, fontFamily:'monospace', fontSize:11 }}>{r.sku.codigo}</td>
                      <td style={td}>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:20, fontWeight:500,
                          background: r.tipo==='llanta'?'#DCFCE7':'#FEF9C3',
                          color: r.tipo==='llanta'?'#166534':'#854D0E' }}>
                          {r.tipo==='llanta' ? 'Llanta' : 'Batería'}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign:'right' }}>{r.cantidad}</td>
                      <td style={{ ...td, textAlign:'right', color:'#888' }}>
                        {r.costo > 0 ? fmt(r.costo) : <span style={{ color:'#ccc' }}>Sin costo</span>}
                      </td>
                      <td style={{ ...td, textAlign:'right', fontWeight:500, color: r.valor>0?'#1a4f8a':'#ccc' }}>
                        {r.valor > 0 ? fmt(r.valor) : '—'}
                      </td>
                      <td style={{ ...td, textAlign:'right', color:'#888' }}>
                        {totalGlobal > 0 && r.valor > 0 ? (r.valor/totalGlobal*100).toFixed(1)+'%' : '—'}
                      </td>
                    </tr>
                  )
                })}
              {/* Totales */}
              {filasFilt.filter(r=>r.cantidad>0).length > 0 && (
                <tr style={{ background:'#f5f5f3', borderTop:'2px solid #e0dfd8' }}>
                  <td colSpan={4} style={{ ...td, fontWeight:500, textAlign:'right', color:'#555' }}>Total</td>
                  <td style={{ ...td, textAlign:'right', fontWeight:500 }}>{totalUnidades}</td>
                  <td style={td}></td>
                  <td style={{ ...td, textAlign:'right', fontWeight:500, fontSize:13, color:'#1a4f8a' }}>{fmt(totalGlobal)}</td>
                  <td style={{ ...td, textAlign:'right', color:'#888' }}>100%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
