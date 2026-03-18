import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES, CLIENTES, COB_CFG, calcCobertura, calcSemanas, semLabel } from '../lib/inventario'

export default function Dashboard() {
  const [talleres,  setTalleres]  = useState([])
  const [skus,      setSkus]      = useState([])
  const [inv,       setInv]       = useState([])   // rows de v_inventario
  const [loading,   setLoading]   = useState(true)

  const [fr,   setFr]   = useState('')
  const [fc,   setFc]   = useState('')
  const [ft,   setFt]   = useState('')
  const [fcob, setFcob] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: t }, { data: s }, { data: i }] = await Promise.all([
      supabase.from('talleres').select('*').eq('activo', true).order('nombre'),
      supabase.from('skus').select('*').eq('activo', true).order('tipo').order('codigo'),
      supabase.from('v_inventario').select('*'),
    ])
    setTalleres(t ?? [])
    setSkus(s ?? [])
    setInv(i ?? [])
    setLoading(false)
  }

  function getCell(taller_id, sku_id) {
    return inv.find(r => r.taller_id === taller_id && r.sku_id === sku_id)
  }

  const talleresFiltrados = talleres.filter(t =>
    (!fr || t.region === fr) && (!fc || t.cliente === fc)
  )
  const skusFiltrados = skus.filter(s => !ft || s.tipo === ft)
  const regiones = [...new Set(talleresFiltrados.map(t => t.region))]

  // KPI counts
  const counts = { critico: 0, moderado: 0, sobrestock: 0 }
  inv.forEach(r => { if (r.cobertura) counts[r.cobertura] = (counts[r.cobertura] ?? 0) + 1 })

  function toggleCob(k) { setFcob(prev => prev === k ? '' : k) }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando inventario...</div>

  return (
    <div style={{ padding: 20, minWidth: 700 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 500 }}>Inventario</h1>
          <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {talleres.length} talleres · Ciudad de México · Guadalajara · Puebla
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex gap-2 mb-3">
        {Object.entries(COB_CFG).map(([k, cfg]) => (
          <div key={k} onClick={() => toggleCob(k)}
            style={{
              flex: 1, borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
              background: cfg.bg, border: `2px solid ${fcob === k ? cfg.bc : 'transparent'}`,
              transition: 'all 0.15s'
            }}>
            <div style={{ fontSize: 10, color: cfg.tc, marginBottom: 3 }}>{cfg.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: cfg.tc }}>{counts[k] ?? 0}</div>
            <div style={{ fontSize: 10, color: cfg.sc, marginTop: 2 }}>{cfg.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background: 'white', border: '0.5px solid #e0dfd8', borderRadius: 10,
        padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { label: 'Ciudad', val: fr, set: setFr, opts: Object.entries(REGIONES).map(([k,v]) => ({ k, l: v.label })) },
          { label: 'Cliente', val: fc, set: setFc, opts: Object.entries(CLIENTES).map(([k,v]) => ({ k, l: v.label })) },
          { label: 'Tipo', val: ft, set: setFt, opts: [{ k:'llanta', l:'Llantas' }, { k:'bateria', l:'Baterías' }] },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, color: '#888', fontWeight: 500, marginBottom: 3 }}>{f.label}</div>
            <select value={f.val} onChange={e => f.set(e.target.value)}
              style={{ padding: '5px 8px', border: '0.5px solid #ccc', borderRadius: 7,
                fontSize: 11, background: 'white', minWidth: 110 }}>
              <option value="">Todos</option>
              {f.opts.map(o => <option key={o.k} value={o.k}>{o.l}</option>)}
            </select>
          </div>
        ))}
        <div>
          <div style={{ fontSize: 10, color: '#888', fontWeight: 500, marginBottom: 3 }}>Cobertura</div>
          <div className="flex gap-1.5">
            {[{ k:'', l:'Todos' }, ...Object.entries(COB_CFG).map(([k,v]) => ({ k, l:v.label, bg:v.bg, bc:v.bc, tc:v.tc }))].map(p => (
              <button key={p.k} onClick={() => setFcob(prev => prev === p.k ? '' : p.k)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                  fontWeight: 500, border: `1.5px solid ${p.bc ?? '#ccc'}`,
                  background: fcob === p.k ? (p.bc ?? '#888') : (p.bg ?? 'white'),
                  color: fcob === p.k ? 'white' : (p.tc ?? '#666'),
                  transition: 'all 0.12s'
                }}>
                {p.l}{p.k ? ` (${counts[p.k] ?? 0})` : ''}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { setFr(''); setFc(''); setFt(''); setFcob('') }}
          style={{ padding: '5px 12px', border: '0.5px solid #ccc', borderRadius: 7,
            fontSize: 11, background: 'white', cursor: 'pointer', alignSelf: 'flex-end' }}>
          Limpiar
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex gap-3 mb-2" style={{ fontSize: 10, color: '#888', alignItems: 'center' }}>
        {Object.entries(COB_CFG).map(([k, cfg]) => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ width:10, height:10, borderRadius:2, background:cfg.bg, display:'inline-block', border:'0.5px solid '+cfg.bc }}/>
            {cfg.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span style={{ width:10, height:10, borderRadius:2, background:'#f5f5f3', border:'0.5px solid #ccc', display:'inline-block' }}/>
          Sin registro
        </span>
        {fcob && <span style={{ marginLeft:'auto', color:'#185FA5', fontWeight:500 }}>
          Filtrando: {COB_CFG[fcob]?.label} — resto atenuado
        </span>}
      </div>

      {/* Matriz */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, position:'sticky', left:0, zIndex:3, minWidth:150, textAlign:'left' }}>
                Taller
              </th>
              {skusFiltrados.map(s => (
                <th key={s.id} style={{ ...thStyle, textAlign:'center', maxWidth:72, fontSize:9, lineHeight:1.3 }}>
                  {s.codigo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regiones.map(r => {
              const cfg = REGIONES[r]
              const ts = talleresFiltrados.filter(t => t.region === r)
              return [
                <tr key={`region-${r}`}>
                  <td colSpan={skusFiltrados.length + 1}
                    style={{ background: '#f5f5f3', padding: '5px 10px', fontSize: 10,
                      fontWeight: 500, color: cfg.color, borderTop: `2px solid ${cfg.color}`,
                      borderBottom: '0.5px solid #e0dfd8', position:'sticky', left:0 }}>
                    {cfg.label} — {ts.length} talleres
                  </td>
                </tr>,
                ...ts.map(t => {
                  const cc = CLIENTES[t.cliente] ?? CLIENTES.ind
                  return (
                    <tr key={t.id}>
                      <td style={{ ...tdStyle, position:'sticky', left:0, zIndex:1,
                        background:'white', minWidth:150, maxWidth:190 }}>
                        <div style={{ fontWeight:500, fontSize:11, whiteSpace:'nowrap',
                          overflow:'hidden', textOverflow:'ellipsis', maxWidth:175 }}>{t.nombre}</div>
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:10,
                          background:cc.bg, color:cc.color, fontWeight:500 }}>{cc.label}</span>
                      </td>
                      {skusFiltrados.map(s => {
                        const cell = getCell(t.id, s.id)
                        if (!cell) return (
                          <td key={s.id} style={{ ...tdStyle, textAlign:'center',
                            color:'#bbb', fontSize:10, width:72, maxWidth:72 }}>—</td>
                        )
                        const cob = cell.cobertura
                        const cfg2 = COB_CFG[cob]
                        const dimmed = fcob && fcob !== cob
                        return (
                          <td key={s.id} style={{ ...tdStyle, textAlign:'center', width:72, maxWidth:72,
                            background: dimmed ? 'transparent' : cfg2.bg,
                            opacity: dimmed ? 0.15 : 1, transition:'opacity 0.2s' }}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                              <span style={{ fontWeight:500, fontSize:12, lineHeight:1,
                                color: dimmed ? '#ccc' : cfg2.tc }}>{cell.stock}</span>
                              <span style={{ fontSize:9, lineHeight:1, marginTop:1,
                                color: dimmed ? '#ccc' : cfg2.sc }}>{semLabel(cell.stock, cell.rotacion)}</span>
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

const thStyle = {
  padding: '7px 10px', fontWeight: 500, fontSize: 10, color: '#666',
  borderBottom: '0.5px solid #e0dfd8', background: '#f5f5f3',
  border: '0.5px solid #e0dfd8', position: 'sticky', top: 0, zIndex: 2,
  whiteSpace: 'nowrap'
}
const tdStyle = {
  padding: '6px 8px', borderBottom: '0.5px solid #e0dfd8',
  border: '0.5px solid #e0dfd8', verticalAlign: 'middle'
}
