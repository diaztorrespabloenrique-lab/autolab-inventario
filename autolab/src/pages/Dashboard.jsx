import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES, CLIENTES, COB_CFG, semLabel } from '../lib/inventario'

const th = { padding:'6px 8px', fontWeight:500, fontSize:10, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3', border:'0.5px solid #e0dfd8', position:'sticky', top:0, zIndex:2, whiteSpace:'nowrap' }
const td = { padding:'5px 7px', borderBottom:'0.5px solid #e0dfd8', border:'0.5px solid #e0dfd8', verticalAlign:'middle' }

export default function Dashboard() {
  const [talleres, setTalleres] = useState([])
  const [skus,     setSkus]     = useState([])
  const [inv,      setInv]      = useState([])
  const [loading,  setLoading]  = useState(true)

  // Filtros
  const [fr,           setFr]           = useState('')
  const [fc,           setFc]           = useState('')
  const [ft,           setFt]           = useState('')
  const [fcob,         setFcob]         = useState('')
  const [fgarantia,    setFgarantia]    = useState('')
  const [talleresSelec,setTalleresSelec]= useState([])
  const [showTFiltro,  setShowTFiltro]  = useState(false)

  // Set de "taller_id|sku_id" que tienen al menos 1 entrada de garantía
  const [garantiaPairs, setGarantiaPairs] = useState(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:t }, { data:s }, { data:i }, { data:g }] = await Promise.all([
      supabase.from('talleres').select('*').eq('activo',true).order('region').order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').eq('activo',true).order('codigo'),
      supabase.from('v_inventario').select('*'),
      // Traer SOLO pares taller+sku que tienen entradas de garantía
      supabase.from('movimientos').select('taller_id, sku_id').eq('origen','garantia').eq('tipo','entrada'),
    ])
    setTalleres(t ?? [])
    setSkus(s ?? [])
    setInv(i ?? [])
    // Guardar como "tallerID|skuID" para lookup O(1)
    setGarantiaPairs(new Set((g ?? []).map(r => `${r.taller_id}|${r.sku_id}`)))
    setLoading(false)
  }

  function getCell(taller_id, sku_id) {
    return inv.find(r => r.taller_id === taller_id && r.sku_id === sku_id)
  }

  function isGarantia(taller_id, sku_id) {
    return garantiaPairs.has(`${taller_id}|${sku_id}`)
  }

  // Filtros de taller
  const talleresFiltrados = talleres.filter(t => {
    if (fr && t.region !== fr) return false
    if (fc && t.cliente !== fc) return false
    if (talleresSelec.length > 0 && !talleresSelec.includes(t.id)) return false
    return true
  })

  // Filtro tipo
  const skusFiltrados = skus.filter(s => {
    if (!ft) return true
    return (s.tipos_refaccion?.nombre ?? s.tipo) === ft
  })

  // Filtro garantía: muestra solo celdas que son/no son garantía
  // (no filtra SKUs sino celdas individuales dentro de la matriz)
  const regiones = [...new Set(talleresFiltrados.map(t => t.region))]

  // KPI counts
  const counts = { critico:0, moderado:0, sobrestock:0, sin_rotacion:0 }
  inv.forEach(r => { if (r.cobertura && counts[r.cobertura] !== undefined) counts[r.cobertura]++ })

  // Tipos únicos para el select
  const tipos = [...new Map(skus.map(s => {
    const nombre = s.tipos_refaccion?.nombre ?? s.tipo
    return [nombre, nombre]
  })).entries()]

  function toggleTaller(id) {
    setTalleresSelec(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (loading) return <div style={{ padding:20, color:'#aaa', fontSize:13 }}>Cargando inventario...</div>

  return (
    <div style={{ padding:18, minWidth:700 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Inventario</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>{talleres.length} talleres · CDMX · GDL · Puebla</p>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {Object.entries(COB_CFG).map(([k, cfg]) => (
          <div key={k} onClick={() => setFcob(prev => prev===k ? '' : k)}
            style={{ flex:1, borderRadius:8, padding:'9px 11px', cursor:'pointer',
              background:cfg.bg, border:`2px solid ${fcob===k ? cfg.bc : 'transparent'}`,
              transition:'all 0.15s' }}>
            <div style={{ fontSize:10, color:cfg.tc, marginBottom:2 }}>{cfg.label}</div>
            <div style={{ fontSize:18, fontWeight:500, color:cfg.tc }}>{counts[k] ?? 0}</div>
            <div style={{ fontSize:10, color:cfg.sc, marginTop:1 }}>{cfg.sub}</div>
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10,
        padding:'10px 14px', marginBottom:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>

        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Ciudad</div>
          <select value={fr} onChange={e => { setFr(e.target.value); setTalleresSelec([]) }}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:110 }}>
            <option value="">Todas</option>
            {Object.entries(REGIONES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Cliente</div>
          <select value={fc} onChange={e => { setFc(e.target.value); setTalleresSelec([]) }}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:110 }}>
            <option value="">Todos</option>
            {Object.entries(CLIENTES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Tipo</div>
          <select value={ft} onChange={e => setFt(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:130 }}>
            <option value="">Todos</option>
            {tipos.map(([k]) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Origen</div>
          <select value={fgarantia} onChange={e => setFgarantia(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:130 }}>
            <option value="">Garantía y normal</option>
            <option value="garantia">Solo garantía</option>
            <option value="normal">Solo normal</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Cobertura</div>
          <div style={{ display:'flex', gap:4 }}>
            {[{k:'',l:'Todos'}, ...Object.entries(COB_CFG).map(([k,v])=>({k,l:v.label,bg:v.bg,bc:v.bc,tc:v.tc}))].map(p => (
              <button key={p.k} onClick={() => setFcob(prev => prev===p.k ? '' : p.k)}
                style={{ padding:'4px 9px', borderRadius:20, fontSize:10, cursor:'pointer', fontWeight:500,
                  border:`1.5px solid ${p.bc ?? '#ccc'}`,
                  background: fcob===p.k ? (p.bc ?? '#888') : (p.bg ?? 'white'),
                  color: fcob===p.k ? 'white' : (p.tc ?? '#666'), transition:'all 0.12s' }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de talleres individuales */}
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Talleres</div>
          <button onClick={() => setShowTFiltro(p => !p)}
            style={{ padding:'5px 10px',
              border:`1.5px solid ${talleresSelec.length ? '#185FA5' : '#ccc'}`,
              borderRadius:7, fontSize:11, cursor:'pointer',
              background: talleresSelec.length ? '#E6F1FB' : 'white',
              color: talleresSelec.length ? '#0C447C' : '#666',
              fontWeight: talleresSelec.length ? 500 : 400 }}>
            {talleresSelec.length ? `${talleresSelec.length} seleccionados` : 'Todos los talleres'} ▾
          </button>
          {showTFiltro && (
            <div style={{ position:'absolute', top:'100%', left:0, zIndex:50, background:'white',
              border:'0.5px solid #e0dfd8', borderRadius:9, padding:8, minWidth:230,
              maxHeight:240, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
              <button onClick={() => setTalleresSelec([])}
                style={{ width:'100%', textAlign:'left', padding:'4px 8px', fontSize:11,
                  color:'#185FA5', background:'none', border:'none', cursor:'pointer', marginBottom:4 }}>
                Limpiar selección
              </button>
              {talleres.filter(t => (!fr||t.region===fr) && (!fc||t.cliente===fc)).map(t => (
                <label key={t.id} style={{ display:'flex', alignItems:'center', gap:7,
                  padding:'4px 8px', cursor:'pointer', borderRadius:6, fontSize:11 }}>
                  <input type="checkbox" checked={talleresSelec.includes(t.id)}
                    onChange={() => toggleTaller(t.id)} />
                  <span>{t.nombre}</span>
                  <span style={{ fontSize:9, marginLeft:'auto', color:REGIONES[t.region]?.color }}>
                    {REGIONES[t.region]?.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => { setFr(''); setFc(''); setFt(''); setFcob(''); setFgarantia(''); setTalleresSelec([]) }}
          style={{ padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11,
            background:'white', cursor:'pointer', alignSelf:'flex-end' }}>
          Limpiar todo
        </button>
      </div>

      {/* Leyenda */}
      <div style={{ display:'flex', gap:10, marginBottom:8, fontSize:10, color:'#888', alignItems:'center', flexWrap:'wrap' }}>
        {Object.entries(COB_CFG).map(([k, cfg]) => (
          <span key={k} style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:cfg.bg, display:'inline-block', border:'0.5px solid '+cfg.bc }}/>
            {cfg.label}
          </span>
        ))}
        <span style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ width:10, height:10, borderRadius:2, background:'#f5f5f3', border:'0.5px solid #ccc', display:'inline-block' }}/>
          Sin registro
        </span>
        {fgarantia && (
          <span style={{ background:'#FAEEDA', color:'#633806', padding:'2px 8px', borderRadius:20, fontWeight:500 }}>
            Mostrando: {fgarantia === 'garantia' ? 'solo garantía (por taller)' : 'solo stock normal'}
          </span>
        )}
        {fcob && (
          <span style={{ color:'#185FA5', fontWeight:500 }}>
            Cobertura: {COB_CFG[fcob]?.label}
          </span>
        )}
      </div>

      {/* Matriz */}
      <div style={{ overflowX:'auto' }} onClick={() => setShowTFiltro(false)}>
        <table style={{ borderCollapse:'collapse', fontSize:11, width:'100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, position:'sticky', left:0, zIndex:3, minWidth:155, textAlign:'left' }}>Taller</th>
              {skusFiltrados.map(s => (
                <th key={s.id} style={{ ...th, textAlign:'center', maxWidth:76, fontSize:9, lineHeight:1.3 }}>
                  {s.codigo}
                </th>
              ))}
            </tr>
            {/* Fila de rotación promedio */}
            <tr>
              <th style={{ ...th, position:'sticky', left:0, zIndex:3, textAlign:'left', fontSize:9, color:'#bbb', background:'#fafafa' }}>
                Rotación / sem →
              </th>
              {skusFiltrados.map(s => {
                const rots = inv.filter(r => r.sku_id === s.id && r.rotacion > 0).map(r => r.rotacion)
                const avg = rots.length ? (rots.reduce((a,b)=>a+b,0)/rots.length) : 0
                return (
                  <th key={s.id} style={{ ...th, textAlign:'center', fontSize:9, color:'#aaa', background:'#fafafa' }}>
                    {avg > 0 ? avg.toFixed(1) : '—'}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {regiones.map(r => {
              const rcfg = REGIONES[r]
              const ts = talleresFiltrados.filter(t => t.region === r)
              return [
                <tr key={`reg-${r}`}>
                  <td colSpan={skusFiltrados.length + 1}
                    style={{ background:'#f5f5f3', padding:'5px 10px', fontSize:10, fontWeight:500,
                      color:rcfg.color, borderTop:`2px solid ${rcfg.color}`,
                      borderBottom:'0.5px solid #e0dfd8', position:'sticky', left:0 }}>
                    {rcfg.label} — {ts.length} talleres
                  </td>
                </tr>,
                ...ts.map(t => {
                  const cc = CLIENTES[t.cliente] ?? CLIENTES.ind
                  return (
                    <tr key={t.id}>
                      <td style={{ ...td, position:'sticky', left:0, zIndex:1, background:'white', minWidth:155 }}>
                        <div style={{ fontWeight:500, fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:175 }}>
                          {t.nombre}
                        </div>
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:10, background:cc.bg, color:cc.color, fontWeight:500 }}>
                          {cc.label}
                        </span>
                      </td>
                      {skusFiltrados.map(s => {
                        const cell = getCell(t.id, s.id)
                        const esGarantia = isGarantia(t.id, s.id)

                        // Aplicar filtro garantía — a nivel de celda individual
                        if (fgarantia === 'garantia' && !esGarantia) {
                          return <td key={s.id} style={{ ...td, textAlign:'center', color:'#e0dfd8', fontSize:10, width:76 }}>—</td>
                        }
                        if (fgarantia === 'normal' && esGarantia) {
                          return <td key={s.id} style={{ ...td, textAlign:'center', color:'#e0dfd8', fontSize:10, width:76 }}>—</td>
                        }

                        if (!cell) return (
                          <td key={s.id} style={{ ...td, textAlign:'center', color:'#ccc', fontSize:10, width:76 }}>—</td>
                        )

                        const cob = cell.cobertura ?? 'sin_rotacion'
                        const cfg2 = COB_CFG[cob] ?? COB_CFG.sin_rotacion
                        const dimmed = fcob && fcob !== cob

                        return (
                          <td key={s.id} style={{ ...td, textAlign:'center', width:76,
                            background: dimmed ? 'transparent' : cfg2.bg,
                            opacity: dimmed ? 0.13 : 1, transition:'opacity 0.2s' }}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                              <span style={{ fontWeight:500, fontSize:12, lineHeight:1, color: dimmed ? '#ccc' : cfg2.tc }}>
                                {cell.stock}
                              </span>
                              <span style={{ fontSize:9, color: dimmed ? '#ccc' : cfg2.sc }}>
                                {semLabel(cell.stock, cell.rotacion)}
                              </span>
                              <span style={{ fontSize:8, color:'#bbb' }}>
                                rot {Number(cell.rotacion ?? 0).toFixed(1)}
                              </span>
                              {/* Indicador garantía — solo si esta celda específica tiene garantía */}
                              {esGarantia && (
                                <span style={{ fontSize:7, color:'#854F0B', background:'#FAEEDA',
                                  padding:'1px 4px', borderRadius:4, marginTop:1, fontWeight:500 }}>
                                  gar.
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
