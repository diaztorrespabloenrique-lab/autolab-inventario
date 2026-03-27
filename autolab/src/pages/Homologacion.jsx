import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Homologacion() {
  const [modelos, setModelos] = useState([])
  const [skus,    setSkus]    = useState([])
  const [relacs,  setRelacs]  = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar,  setBuscar]  = useState('')
  const [filtroTipo, setFiltroTipo] = useState('') // 'llanta' | 'bateria' | ''
  const [vistaAct, setVistaAct] = useState('modelos') // 'modelos' | 'skus'

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:m }, { data:s }, { data:r }] = await Promise.all([
      supabase.from('modelos').select('*').eq('activo', true).order('nombre'),
      supabase.from('skus').select('*').eq('activo', true).order('codigo'),
      supabase.from('modelo_sku').select('*'),
    ])
    setModelos(m ?? [])
    setSkus(s ?? [])
    setRelacs(r ?? [])
    setLoading(false)
  }

  function skusDeModelo(modelo_id) {
    return relacs.filter(r => r.modelo_id === modelo_id)
      .map(r => skus.find(s => s.id === r.sku_id)).filter(Boolean)
  }
  function modelosDesku(sku_id) {
    return relacs.filter(r => r.sku_id === sku_id)
      .map(r => modelos.find(m => m.id === r.modelo_id)).filter(Boolean)
  }
  function esBateria(sku) {
    return sku.codigo.toUpperCase().includes('BAT')
  }

  const modelosFilt = modelos.filter(m => {
    if (buscar && !m.nombre.toLowerCase().includes(buscar.toLowerCase())) return false
    if (filtroTipo) {
      const skusMod = skusDeModelo(m.id)
      if (filtroTipo === 'llanta'  && !skusMod.some(s => !esBateria(s))) return false
      if (filtroTipo === 'bateria' && !skusMod.some(s =>  esBateria(s))) return false
    }
    return true
  })

  const skusFilt = skus.filter(s => {
    if (buscar && !s.codigo.toLowerCase().includes(buscar.toLowerCase())) return false
    if (filtroTipo === 'llanta'  && esBateria(s))  return false
    if (filtroTipo === 'bateria' && !esBateria(s)) return false
    return true
  })

  const totalModelos  = modelos.length
  const totalRelacs   = relacs.length
  const totalLlantas  = skus.filter(s => !esBateria(s)).length
  const totalBaterias = skus.filter(s =>  esBateria(s)).length

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando homologación...</div>

  return (
    <div style={{ padding:20, maxWidth:1100 }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:17, fontWeight:500 }}>Homologación Modelo → SKU</h1>
        <p style={{ fontSize:11, color:'#888', marginTop:3 }}>
          Tabla de referencia: qué llanta y batería usa cada modelo de vehículo
        </p>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Modelos',   val:totalModelos,  bg:'#E6F1FB', color:'#0C447C' },
          { label:'Relaciones',val:totalRelacs,   bg:'#F1EFE8', color:'#5F5E5A' },
          { label:'Llantas',   val:totalLlantas,  bg:'#DCFCE7', color:'#166534' },
          { label:'Baterías',  val:totalBaterias, bg:'#FEF9C3', color:'#854D0E' },
        ].map(c => (
          <div key={c.label} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:'12px 16px' }}>
            <p style={{ fontSize:11, color:'#888', marginBottom:4 }}>{c.label}</p>
            <p style={{ fontSize:22, fontWeight:500, color:c.color }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {/* Buscador */}
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#aaa', fontSize:13 }}>🔍</span>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)}
            placeholder={vistaAct==='modelos' ? 'Buscar modelo...' : 'Buscar SKU...'}
            style={{ padding:'6px 10px 6px 28px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, width:190 }}/>
        </div>

        {/* Filtro tipo */}
        <div style={{ display:'flex', gap:4 }}>
          {[{k:'',label:'Todos'},{k:'llanta',label:'🔵 Llantas'},{k:'bateria',label:'🟡 Baterías'}].map(f=>(
            <button key={f.k} onClick={()=>setFiltroTipo(f.k)}
              style={{ padding:'5px 11px', borderRadius:20, fontSize:11, cursor:'pointer',
                border:`1.5px solid ${filtroTipo===f.k?'#1a4f8a':'#e0dfd8'}`,
                background:filtroTipo===f.k?'#E6F1FB':'white',
                color:filtroTipo===f.k?'#0C447C':'#666', fontWeight:filtroTipo===f.k?500:400 }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Vista */}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {[{k:'modelos',l:'Por modelo'},{k:'skus',l:'Por SKU'}].map(v=>(
            <button key={v.k} onClick={()=>setVistaAct(v.k)}
              style={{ padding:'5px 12px', borderRadius:20, fontSize:11, cursor:'pointer',
                border:`1.5px solid ${vistaAct===v.k?'#1a4f8a':'#e0dfd8'}`,
                background:vistaAct===v.k?'#1a4f8a':'white',
                color:vistaAct===v.k?'white':'#666', fontWeight:500 }}>
              {v.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista por modelo ── */}
      {vistaAct === 'modelos' && (
        <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:12, overflow:'hidden' }}>
          <div style={{ background:'#1a4f8a', padding:'10px 16px', display:'flex', gap:0 }}>
            {['Modelo de vehículo','Llanta','Batería'].map((h,i)=>(
              <div key={h} style={{ flex:i===0?1.2:1, color:'white', fontSize:11, fontWeight:500 }}>{h}</div>
            ))}
          </div>
          {modelosFilt.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin resultados</div>
          ) : (
            modelosFilt.map((m, idx) => {
              const todosSKUs  = skusDeModelo(m.id)
              const llantas    = todosSKUs.filter(s => !esBateria(s))
              const baterias   = todosSKUs.filter(s =>  esBateria(s))
              return (
                <div key={m.id} style={{
                  display:'flex', alignItems:'center', padding:'10px 16px',
                  background: idx%2===0 ? 'white' : '#fafaf8',
                  borderBottom:'0.5px solid #f0efe8',
                }}>
                  {/* Modelo */}
                  <div style={{ flex:1.2, display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:'#E6F1FB',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:700, color:'#1a4f8a', flexShrink:0 }}>
                      {m.nombre.charAt(0)}
                    </div>
                    <span style={{ fontWeight:500, fontSize:13 }}>{m.nombre}</span>
                  </div>

                  {/* Llantas */}
                  <div style={{ flex:1 }}>
                    {llantas.length > 0
                      ? llantas.map(s => (
                          <span key={s.id} style={{
                            display:'inline-block', margin:'2px 3px 2px 0',
                            padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                            background:'#DCFCE7', color:'#166534', fontFamily:'monospace',
                            border:'1px solid #BBF7D0'
                          }}>
                            {s.codigo}
                          </span>
                        ))
                      : <span style={{ color:'#ddd', fontSize:11 }}>—</span>}
                  </div>

                  {/* Baterías */}
                  <div style={{ flex:1 }}>
                    {baterias.length > 0
                      ? baterias.map(s => (
                          <span key={s.id} style={{
                            display:'inline-block', margin:'2px 3px 2px 0',
                            padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                            background:'#FEF9C3', color:'#854D0E',
                            border:'1px solid #FDE68A'
                          }}>
                            {s.codigo}
                          </span>
                        ))
                      : <span style={{ color:'#ddd', fontSize:11 }}>—</span>}
                  </div>
                </div>
              )
            })
          )}
          {modelosFilt.length > 0 && (
            <div style={{ padding:'8px 16px', background:'#f5f5f3', borderTop:'0.5px solid #e0dfd8',
              fontSize:11, color:'#888', textAlign:'right' }}>
              {modelosFilt.length} modelo{modelosFilt.length!==1?'s':''} mostrado{modelosFilt.length!==1?'s':''}
            </div>
          )}
        </div>
      )}

      {/* ── Vista por SKU ── */}
      {vistaAct === 'skus' && (
        <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:12, overflow:'hidden' }}>
          <div style={{ background:'#1a4f8a', padding:'10px 16px', display:'flex', gap:0 }}>
            {['SKU','Tipo','Modelos compatibles','Total modelos'].map((h,i)=>(
              <div key={h} style={{ flex:i===2?3:1, color:'white', fontSize:11, fontWeight:500 }}>{h}</div>
            ))}
          </div>
          {skusFilt.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'#aaa' }}>Sin resultados</div>
          ) : (
            skusFilt.map((s, idx) => {
              const modelosDelSku = modelosDesku(s.id)
              const esBat = esBateria(s)
              return (
                <div key={s.id} style={{
                  display:'flex', alignItems:'center', padding:'10px 16px',
                  background: idx%2===0 ? 'white' : '#fafaf8',
                  borderBottom:'0.5px solid #f0efe8',
                }}>
                  {/* SKU */}
                  <div style={{ flex:1 }}>
                    <span style={{
                      padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700,
                      fontFamily:'monospace',
                      background: esBat ? '#FEF9C3' : '#DCFCE7',
                      color:      esBat ? '#854D0E' : '#166534',
                      border: `1.5px solid ${esBat ? '#FDE68A' : '#BBF7D0'}`
                    }}>
                      {s.codigo}
                    </span>
                  </div>

                  {/* Tipo */}
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:11, color:'#888' }}>
                      {esBat ? '🟡 Batería' : '🔵 Llanta'}
                    </span>
                  </div>

                  {/* Modelos */}
                  <div style={{ flex:3, display:'flex', flexWrap:'wrap', gap:4 }}>
                    {modelosDelSku.length > 0
                      ? modelosDelSku.map(m => (
                          <span key={m.id} style={{
                            padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:500,
                            background:'#E6F1FB', color:'#0C447C',
                            border:'1px solid #BFDBFE'
                          }}>
                            {m.nombre}
                          </span>
                        ))
                      : <span style={{ color:'#ddd', fontSize:11 }}>Sin modelos asignados</span>}
                  </div>

                  {/* Conteo */}
                  <div style={{ flex:1, textAlign:'right' }}>
                    <span style={{
                      padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                      background: modelosDelSku.length > 0 ? '#F1EFE8' : '#FEE2E2',
                      color:      modelosDelSku.length > 0 ? '#5F5E5A' : '#991B1B'
                    }}>
                      {modelosDelSku.length} modelo{modelosDelSku.length!==1?'s':''}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          {skusFilt.length > 0 && (
            <div style={{ padding:'8px 16px', background:'#f5f5f3', borderTop:'0.5px solid #e0dfd8',
              fontSize:11, color:'#888', textAlign:'right' }}>
              {skusFilt.length} SKU{skusFilt.length!==1?'s':''} mostrado{skusFilt.length!==1?'s':''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
