import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES, CLIENTES, formatMXN, IVA } from '../lib/inventario'

export default function ValorInventario() {
  const [data,     setData]     = useState([])
  const [talleres, setTalleres] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [fr, setFr] = useState('')
  const [fc, setFc] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:d },{ data:t }] = await Promise.all([
      supabase.from('v_costo_promedio').select('*'),
      supabase.from('talleres').select('*').eq('activo',true).order('region').order('nombre'),
    ])
    setData(d??[]); setTalleres(t??[])
    setLoading(false)
  }

  // Quitar IVA: dividir entre 1.16
  function sinIVA(val) { return (val ?? 0) / IVA }

  const talleresFiltrados = talleres.filter(t => (!fr||t.region===fr) && (!fc||t.cliente===fc))
  const regiones = [...new Set(talleresFiltrados.map(t=>t.region))]
  const skusUnicos = [...new Map(data.map(d=>[d.sku_id,{id:d.sku_id,codigo:d.sku,tipo:d.tipo}])).values()]

  function getValor(taller_id, sku_id) {
    const r = data.find(d=>d.taller_id===taller_id&&d.sku_id===sku_id)
    if (!r || !r.stock) return null
    const costoSinIVA = sinIVA(r.costo_promedio ?? 0)
    return { stock:r.stock, costo:costoSinIVA, total:r.stock*costoSinIVA }
  }

  // Totales sin IVA
  const totalGeneral = data.reduce((s,d)=>s+(d.stock*sinIVA(d.costo_promedio??0)),0)
  const totalPorTaller = {}
  talleresFiltrados.forEach(t=>{
    totalPorTaller[t.id]=data.filter(d=>d.taller_id===t.id).reduce((s,d)=>s+(d.stock*sinIVA(d.costo_promedio??0)),0)
  })
  const totalPorRegion = {}
  regiones.forEach(r=>{
    const ts=talleresFiltrados.filter(t=>t.region===r)
    totalPorRegion[r]=ts.reduce((s,t)=>s+(totalPorTaller[t.id]??0),0)
  })

  const th = { padding:'6px 8px', fontWeight:500, fontSize:10, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3', border:'0.5px solid #e0dfd8', position:'sticky', top:0, zIndex:2, whiteSpace:'nowrap' }
  const td = { padding:'5px 7px', border:'0.5px solid #e0dfd8', verticalAlign:'middle', fontSize:11 }

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando...</div>

  return (
    <div style={{ padding:18, minWidth:700 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Valor de inventario</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Costo promedio ponderado · <strong>valores sin IVA</strong> (÷1.16)</p>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        <div style={{ background:'#1a4f8a', borderRadius:10, padding:'13px 15px', color:'white', gridColumn:'span 1' }}>
          <div style={{ fontSize:10, opacity:0.7, marginBottom:3 }}>Valor total (sin IVA)</div>
          <div style={{ fontSize:20, fontWeight:500 }}>{formatMXN(totalGeneral)}</div>
          <div style={{ fontSize:10, opacity:0.6, marginTop:2 }}>todos los talleres</div>
        </div>
        {Object.entries(REGIONES).map(([k,v]) => {
          const val = talleres.filter(t=>t.region===k).reduce((s,t)=>{
            return s+data.filter(d=>d.taller_id===t.id).reduce((ss,d)=>ss+(d.stock*sinIVA(d.costo_promedio??0)),0)
          },0)
          return (
            <div key={k} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:'13px 15px' }}>
              <div style={{ fontSize:10, color:'#888', marginBottom:3 }}>{v.label}</div>
              <div style={{ fontSize:18, fontWeight:500, color:v.color }}>{formatMXN(val)}</div>
              <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{talleres.filter(t=>t.region===k).length} talleres · sin IVA</div>
            </div>
          )
        })}
      </div>

      {/* Nota IVA */}
      <div style={{ background:'#E6F1FB', border:'0.5px solid #B5D4F4', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:11, color:'#0C447C' }}>
        ℹ Los precios registrados en el Kardex incluyen IVA. Este dashboard los muestra divididos entre 1.16 para obtener el valor base sin impuesto.
      </div>

      {/* Filtros */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', gap:10, alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Ciudad</div>
          <select value={fr} onChange={e=>setFr(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:110 }}>
            <option value="">Todas</option>
            {Object.entries(REGIONES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Cliente</div>
          <select value={fc} onChange={e=>setFc(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:110 }}>
            <option value="">Todos</option>
            {Object.entries(CLIENTES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={()=>{setFr('');setFc('')}}
          style={{ padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, cursor:'pointer', background:'white', alignSelf:'flex-end' }}>
          Limpiar
        </button>
      </div>

      {/* Matriz de valor */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', fontSize:11, width:'100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, position:'sticky', left:0, zIndex:3, minWidth:155, textAlign:'left' }}>Taller</th>
              {skusUnicos.map(s=>(
                <th key={s.id} style={{ ...th, textAlign:'center', maxWidth:90, fontSize:9, lineHeight:1.3 }}>{s.codigo}</th>
              ))}
              <th style={{ ...th, textAlign:'right', background:'#1a4f8a', color:'white', minWidth:110 }}>Total taller (s/IVA)</th>
            </tr>
          </thead>
          <tbody>
            {regiones.map(r => {
              const rcfg = REGIONES[r]
              const ts = talleresFiltrados.filter(t=>t.region===r)
              return [
                <tr key={`r-${r}`}>
                  <td colSpan={skusUnicos.length+2}
                    style={{ background:'#f5f5f3', padding:'5px 10px', fontSize:10, fontWeight:500,
                      color:rcfg.color, borderTop:`2px solid ${rcfg.color}`, border:'0.5px solid #e0dfd8',
                      position:'sticky', left:0 }}>
                    {rcfg.label} — {formatMXN(totalPorRegion[r])} <span style={{ fontWeight:400, opacity:0.7 }}>sin IVA</span>
                  </td>
                </tr>,
                ...ts.map(t => {
                  const cc = CLIENTES[t.cliente]??CLIENTES.ind
                  const totalT = totalPorTaller[t.id]??0
                  return (
                    <tr key={t.id}>
                      <td style={{ ...td, position:'sticky', left:0, zIndex:1, background:'white', minWidth:155 }}>
                        <div style={{ fontWeight:500, fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:175 }}>{t.nombre}</div>
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:10, background:cc.bg, color:cc.color, fontWeight:500 }}>{cc.label}</span>
                      </td>
                      {skusUnicos.map(s => {
                        const v = getValor(t.id, s.id)
                        if (!v) return <td key={s.id} style={{ ...td, textAlign:'center', color:'#ccc' }}>—</td>
                        return (
                          <td key={s.id} style={{ ...td, textAlign:'center', background:'#fafeff' }}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                              <span style={{ fontWeight:500, color:'#1a4f8a', fontSize:12 }}>{formatMXN(v.total)}</span>
                              <span style={{ fontSize:9, color:'#888' }}>{v.stock}u · {formatMXN(v.costo)}/u</span>
                            </div>
                          </td>
                        )
                      })}
                      <td style={{ ...td, textAlign:'right', fontWeight:500, background:'#E6F1FB', color:'#0C447C' }}>
                        {formatMXN(totalT)}
                      </td>
                    </tr>
                  )
                })
              ]
            })}
            <tr style={{ borderTop:'2px solid #1a4f8a' }}>
              <td style={{ ...td, fontWeight:500, position:'sticky', left:0, background:'#f5f5f3' }}>TOTAL GENERAL (sin IVA)</td>
              {skusUnicos.map(s=>{
                const tot=data.filter(d=>d.sku_id===s.id).reduce((ss,d)=>ss+(d.stock*sinIVA(d.costo_promedio??0)),0)
                return <td key={s.id} style={{ ...td, textAlign:'center', fontWeight:500 }}>{tot>0?formatMXN(tot):'—'}</td>
              })}
              <td style={{ ...td, textAlign:'right', fontWeight:500, background:'#1a4f8a', color:'white', fontSize:13 }}>{formatMXN(totalGeneral)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.length===0 && (
        <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:13 }}>
          No hay datos de costo. Registra compras en el Kardex con precio unitario para ver el valor de inventario.
        </div>
      )}
    </div>
  )
}
