import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatMXN, IVA } from '../lib/inventario'

const btn = (color='#1a4f8a') => ({
  background:color, color:'white', border:'none', borderRadius:7,
  padding:'5px 13px', fontSize:11, cursor:'pointer', fontWeight:500
})
const inp = { padding:'6px 9px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, width:'100%' }
const th  = { padding:'7px 10px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8', whiteSpace:'nowrap' }
const td  = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }

const ESTADO_CFG = {
  borrador:  { label:'Borrador',               bg:'#F1EFE8', color:'#5F5E5A' },
  pendiente: { label:'Pendiente aprobación',   bg:'#FEF9C3', color:'#854D0E' },
  aprobado:  { label:'Aprobado',               bg:'#DCFCE7', color:'#166534' },
  enviado:   { label:'Enviado al proveedor',   bg:'#DBEAFE', color:'#1E40AF' },
  cancelado: { label:'Cancelado',              bg:'#FEE2E2', color:'#991B1B' },
}

export default function Pedidos() {
  const { perfil } = useAuth()
  const isAdmin  = perfil?.rol === 'admin'
  const canWrite = ['admin','staff'].includes(perfil?.rol)

  const [pedidos,    setPedidos]    = useState([])
  const [talleres,   setTalleres]   = useState([])
  const [skus,       setSkus]       = useState([])
  const [inv,        setInv]        = useState([])
  const [loading,    setLoading]    = useState(true)

  const [fTallerProp, setFTallerProp] = useState('')
  const [fSkuProp,    setFSkuProp]    = useState('')

  const [modalPedido, setModalPedido] = useState(false)
  const [itemsPedido, setItemsPedido] = useState([])
  const [saving,      setSaving]      = useState(false)

  // Estado para agregar ítem manual en el modal
  const [nuevoTaller, setNuevoTaller] = useState('')
  const [nuevoSku,    setNuevoSku]    = useState('')
  const [nuevaCant,   setNuevaCant]   = useState('1')

  const [modalAprobar, setModalAprobar] = useState(null)
  const [notasAprob,   setNotasAprob]   = useState('')
  const [expandido,    setExpandido]    = useState(null)
  const [modalFactura, setModalFactura] = useState(null)
  const [uuidFact,     setUuidFact]     = useState('')
  const [confirmDel,   setConfirmDel]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:p }, { data:t }, { data:s }, { data:i }] = await Promise.all([
      supabase.from('pedidos')
        .select('*, talleres(nombre,region), proveedores(nombre), aprobador:aprobado_por(nombre)')
        .order('created_at', { ascending:false }),
      supabase.from('talleres').select('*').eq('activo',true).order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').eq('activo',true).order('codigo'),
      supabase.from('v_inventario').select('*'),
    ])
    setPedidos(p??[]); setTalleres(t??[]); setSkus(s??[]); setInv(i??[])
    setLoading(false)
  }

  function generarPropuesta() {
    const items = []
    inv.forEach(r => {
      if (r.rotacion <= 0) return
      const sem = r.stock / r.rotacion
      if (sem >= 2) return
      if (fTallerProp && r.taller_id !== fTallerProp) return
      if (fSkuProp    && r.sku_id    !== fSkuProp)    return
      const sku = skus.find(s => s.id === r.sku_id)
      if (!sku) return
      const cantPedir = Math.max(1, Math.round(r.rotacion * 4) - r.stock)
      items.push({
        taller_id:r.taller_id, taller_nom:r.taller,
        sku_id:r.sku_id, sku_cod:r.sku,
        cantidad:cantPedir, precio:sku.precio||0,
        stock_actual:r.stock, rotacion:r.rotacion,
        semanas:sem.toFixed(1), esManual:false,
      })
    })
    return items
  }

  function abrirModalPedido() {
    const items = generarPropuesta()
    setItemsPedido(items)
    setNuevoTaller(''); setNuevoSku(''); setNuevaCant('1')
    setModalPedido(true)
  }

  function updateItem(idx, val) {
    setItemsPedido(prev => prev.map((it,i) =>
      i===idx ? {...it, cantidad:Math.max(0, parseInt(val)||0)} : it
    ))
  }
  function removeItem(idx) {
    setItemsPedido(prev => prev.filter((_,i) => i!==idx))
  }

  // Agregar ítem manual al pedido
  function agregarItemManual() {
    if (!nuevoTaller || !nuevoSku) return
    const taller = talleres.find(t => t.id === nuevoTaller)
    const sku    = skus.find(s => s.id === nuevoSku)
    if (!taller || !sku) return

    // Si ya existe ese par taller+sku, solo sumar la cantidad
    const yaExiste = itemsPedido.findIndex(it => it.taller_id === nuevoTaller && it.sku_id === nuevoSku)
    if (yaExiste >= 0) {
      setItemsPedido(prev => prev.map((it, i) =>
        i === yaExiste ? { ...it, cantidad: it.cantidad + (parseInt(nuevaCant)||1) } : it
      ))
    } else {
      const registroInv = inv.find(r => r.taller_id === nuevoTaller && r.sku_id === nuevoSku)
      setItemsPedido(prev => [...prev, {
        taller_id:  nuevoTaller,
        taller_nom: taller.nombre,
        sku_id:     nuevoSku,
        sku_cod:    sku.codigo,
        cantidad:   parseInt(nuevaCant)||1,
        precio:     sku.precio||0,
        stock_actual: registroInv?.stock ?? 0,
        rotacion:   registroInv?.rotacion ?? 0,
        semanas:    registroInv?.rotacion > 0
          ? ((registroInv.stock / registroInv.rotacion).toFixed(1))
          : '—',
        esManual: true,
      }])
    }
    setNuevoTaller(''); setNuevoSku(''); setNuevaCant('1')
  }

  async function confirmarPedido() {
    const validos = itemsPedido.filter(it => it.cantidad > 0)
    if (!validos.length) { alert('No hay ítems con cantidad > 0'); return }
    setSaving(true)
    const { data:ultimos } = await supabase.from('pedidos').select('numero_oc').order('created_at',{ascending:false}).limit(1)
    const nextOC = ultimos?.[0]?.numero_oc ? ultimos[0].numero_oc + 1 : 1001
    const total  = validos.reduce((s,it) => s + it.cantidad * it.precio, 0)
    const { error } = await supabase.from('pedidos').insert({
      numero_oc: nextOC,
      taller_id: validos[0].taller_id,
      items:     validos.map(it => ({ taller_id:it.taller_id, sku_id:it.sku_id, cantidad:it.cantidad, precio:it.precio })),
      total, estado:'pendiente', created_by:perfil?.id,
    })
    if (error) alert('Error: ' + error.message)
    else { setModalPedido(false); setItemsPedido([]); load() }
    setSaving(false)
  }

  async function aprobarPedido() {
    const { error } = await supabase.from('pedidos').update({
      estado:'aprobado', aprobado_por:perfil?.id,
      fecha_aprobacion:new Date().toISOString(),
      notas_aprobacion:notasAprob||null,
    }).eq('id', modalAprobar.id)
    if (error) alert('Error: ' + error.message)
    else { setModalAprobar(null); setNotasAprob(''); load() }
  }

  async function rechazarPedido() {
    await supabase.from('pedidos').update({ estado:'cancelado' }).eq('id', modalAprobar.id)
    setModalAprobar(null); load()
  }

  async function marcarEnviado(id) {
    await supabase.from('pedidos').update({ estado:'enviado' }).eq('id', id); load()
  }

  async function eliminarPedido(id) {
    const { error } = await supabase.from('pedidos').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    setConfirmDel(null); load()
  }

  async function guardarFactura() {
    await supabase.from('pedidos').update({ uuid_factura:uuidFact||null }).eq('id', modalFactura.id)
    setModalFactura(null); setUuidFact(''); load()
  }

  const propuesta  = generarPropuesta()
  const totalProp  = propuesta.reduce((s,it) => s + it.cantidad * it.precio, 0)
  const totalModal = itemsPedido.reduce((s,it) => s + it.cantidad * it.precio, 0)
  const manualesCount = itemsPedido.filter(it => it.esManual).length

  if (loading) return <div style={{padding:20,color:'#aaa'}}>Cargando pedidos...</div>

  return (
    <div style={{padding:20, maxWidth:1300}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
        <div>
          <h1 style={{fontSize:17, fontWeight:500}}>Pedidos</h1>
          <p style={{fontSize:11, color:'#888', marginTop:2}}>{pedidos.length} pedidos · flujo de aprobación activo</p>
        </div>
      </div>

      {/* ── Propuesta ── */}
      {canWrite && (
        <div style={{background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:16, marginBottom:20}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <div>
              <p style={{fontWeight:500, fontSize:13}}>Propuesta de pedido</p>
              <p style={{fontSize:11, color:'#888', marginTop:2}}>SKUs con cobertura &lt; 2 semanas · puedes agregar cualquier SKU adicional en el paso siguiente</p>
            </div>
            <button onClick={abrirModalPedido} style={btn()}>
              Revisar y solicitar ({propuesta.length} ítems recomendados)
            </button>
          </div>

          {/* Filtros */}
          <div style={{display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'flex-end'}}>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:3}}>Taller</div>
              <select value={fTallerProp} onChange={e=>setFTallerProp(e.target.value)}
                style={{padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:160}}>
                <option value="">Todos los talleres</option>
                {talleres.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10, color:'#888', marginBottom:3}}>SKU</div>
              <select value={fSkuProp} onChange={e=>setFSkuProp(e.target.value)}
                style={{padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:140}}>
                <option value="">Todos los SKUs</option>
                {skus.map(s=><option key={s.id} value={s.id}>{s.codigo}</option>)}
              </select>
            </div>
            {(fTallerProp||fSkuProp) && (
              <button onClick={()=>{setFTallerProp('');setFSkuProp('')}}
                style={{padding:'5px 10px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, background:'white', cursor:'pointer'}}>
                Limpiar
              </button>
            )}
          </div>

          {propuesta.length > 0 ? (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead><tr>
                  {['Taller','SKU','Stock','Rot/sem','Cobertura','Sugerido','Precio unit.','Subtotal'].map(h=>(
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {propuesta.map((it,idx)=>(
                    <tr key={idx} style={{background:idx%2===0?'white':'#fafafa'}}>
                      <td style={td}>{it.taller_nom}</td>
                      <td style={{...td, fontFamily:'monospace', fontSize:11}}>{it.sku_cod}</td>
                      <td style={td}>{it.stock_actual}</td>
                      <td style={td}>{it.rotacion.toFixed(1)}</td>
                      <td style={{...td, color:'#A32D2D', fontWeight:500}}>{it.semanas} sem</td>
                      <td style={{...td, fontWeight:500}}>{it.cantidad}</td>
                      <td style={{...td, fontSize:11}}>{formatMXN(it.precio/IVA)} s/IVA</td>
                      <td style={{...td, fontWeight:500}}>{formatMXN(it.cantidad*it.precio)}</td>
                    </tr>
                  ))}
                  <tr style={{background:'#f5f5f3'}}>
                    <td colSpan={7} style={{...td, fontWeight:500, textAlign:'right'}}>Total estimado c/IVA:</td>
                    <td style={{...td, fontWeight:500, color:'#1a4f8a'}}>{formatMXN(totalProp)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{color:'#aaa', fontSize:12, padding:'10px 0'}}>
              {fTallerProp||fSkuProp ? 'Sin ítems críticos con los filtros aplicados.' : '🎉 Sin SKUs en nivel crítico actualmente.'}
            </p>
          )}
        </div>
      )}

      {/* ── Lista pedidos ── */}
      <div style={{background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
          <thead><tr>
            {['OC #','Fecha','Estado','Ítems','Total','UUID Factura','Aprobado por','Acciones'].map(h=>(
              <th key={h} style={th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {pedidos.length===0 && (
              <tr><td colSpan={8} style={{padding:32, textAlign:'center', color:'#aaa'}}>No hay pedidos registrados</td></tr>
            )}
            {pedidos.map(p=>{
              const ecfg = ESTADO_CFG[p.estado] ?? ESTADO_CFG.borrador
              const items = Array.isArray(p.items) ? p.items : []
              return (
                <tr key={p.id}>
                  <td style={{...td, fontWeight:500}}>OC-{p.numero_oc}</td>
                  <td style={td}>{p.created_at?.slice(0,10)}</td>
                  <td style={td}>
                    <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, background:ecfg.bg, color:ecfg.color}}>
                      {ecfg.label}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={()=>setExpandido(expandido===p.id?null:p.id)}
                      style={{background:'none', border:'none', cursor:'pointer', color:'#1a4f8a', fontSize:11, textDecoration:'underline'}}>
                      {items.length} ítems {expandido===p.id?'▲':'▼'}
                    </button>
                    {expandido===p.id && (
                      <div style={{marginTop:8, background:'#f9f9f7', borderRadius:6, padding:8}}>
                        {items.map((it,i)=>{
                          const s=skus.find(x=>x.id===it.sku_id)
                          const t=talleres.find(x=>x.id===it.taller_id)
                          return (
                            <div key={i} style={{fontSize:11, padding:'2px 0', display:'flex', gap:8, color:'#555'}}>
                              <span style={{color:'#888'}}>{t?.nombre}</span>
                              <span style={{fontFamily:'monospace'}}>{s?.codigo}</span>
                              <span>× {it.cantidad}</span>
                              <span style={{color:'#1a4f8a'}}>{formatMXN(it.precio)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{...td, fontWeight:500}}>{formatMXN(p.total)}</td>
                  <td style={td}>
                    {p.uuid_factura
                      ? <span style={{fontFamily:'monospace', fontSize:10}}>{p.uuid_factura.slice(0,12)}...</span>
                      : <span style={{color:'#ccc'}}>—</span>}
                    {isAdmin && (
                      <button onClick={()=>{setModalFactura(p);setUuidFact(p.uuid_factura||'')}}
                        style={{marginLeft:6, fontSize:10, padding:'1px 7px', border:'0.5px solid #ccc', borderRadius:5, cursor:'pointer', background:'white'}}>
                        {p.uuid_factura?'Editar':'Agregar'}
                      </button>
                    )}
                  </td>
                  <td style={{...td, fontSize:11, color:'#888'}}>
                    {p.aprobador?.nombre ?? <span style={{color:'#ccc'}}>—</span>}
                  </td>
                  <td style={td}>
                    <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
                      {isAdmin && p.estado==='pendiente' && (
                        <button onClick={()=>setModalAprobar(p)} style={btn('#166534')}>Aprobar</button>
                      )}
                      {canWrite && p.estado==='aprobado' && (
                        <button onClick={()=>marcarEnviado(p.id)} style={btn('#1a4f8a')}>Enviado</button>
                      )}
                      {isAdmin && p.estado!=='enviado' && (
                        <button onClick={()=>setConfirmDel(p)} style={btn('#E24B4A')}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal edición pedido ── */}
      {modalPedido && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:800, maxHeight:'92vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <div>
                <p style={{fontWeight:500, fontSize:14}}>Revisar y armar pedido</p>
                <p style={{fontSize:11, color:'#888', marginTop:2}}>
                  Modifica cantidades, quita ítems o agrega SKUs adicionales.
                  {manualesCount > 0 && <span style={{marginLeft:6, color:'#0C447C', fontWeight:500}}>{manualesCount} ítem{manualesCount>1?'s':''} agregado{manualesCount>1?'s':''} manualmente</span>}
                </p>
              </div>
              <button onClick={()=>setModalPedido(false)} style={{background:'none', border:'0.5px solid #ccc', borderRadius:7, padding:'3px 10px', cursor:'pointer'}}>✕</button>
            </div>

            {/* Tabla de ítems */}
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:6}}>
              <thead><tr style={{background:'#f5f5f3'}}>
                <th style={th}>Taller</th><th style={th}>SKU</th>
                <th style={th}>Stock actual</th><th style={th}>Rotación</th>
                <th style={th}>Cantidad</th><th style={th}>Precio unit.</th>
                <th style={th}>Total</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {itemsPedido.length === 0 && (
                  <tr><td colSpan={8} style={{...td, textAlign:'center', color:'#aaa', padding:20}}>
                    No hay ítems. Agrega SKUs usando el formulario de abajo.
                  </td></tr>
                )}
                {itemsPedido.map((it,idx)=>(
                  <tr key={idx} style={{background: it.esManual ? '#EEF4FF' : idx%2===0?'white':'#fafafa'}}>
                    <td style={td}>
                      {it.taller_nom}
                      {it.esManual && (
                        <span style={{marginLeft:5, fontSize:9, padding:'1px 5px', borderRadius:20, background:'#DBEAFE', color:'#1E40AF', fontWeight:500}}>
                          manual
                        </span>
                      )}
                    </td>
                    <td style={{...td, fontFamily:'monospace', fontSize:11}}>{it.sku_cod}</td>
                    <td style={{...td, color:'#888'}}>{it.stock_actual ?? '—'}</td>
                    <td style={{...td, color:'#888'}}>{typeof it.rotacion === 'number' ? it.rotacion.toFixed(1) : '—'}</td>
                    <td style={td}>
                      <input type="number" min="0" value={it.cantidad}
                        onChange={e=>updateItem(idx, e.target.value)}
                        style={{...inp, width:70}} />
                    </td>
                    <td style={{...td, fontSize:11}}>{formatMXN(it.precio/IVA)} s/IVA</td>
                    <td style={{...td, fontWeight:500}}>{formatMXN(it.cantidad*it.precio)}</td>
                    <td style={td}>
                      <button onClick={()=>removeItem(idx)}
                        style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'2px 8px', fontSize:11, cursor:'pointer'}}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Sección agregar SKU manual ── */}
            <div style={{background:'#F0F7FF', border:'1px solid #BFDBFE', borderRadius:9, padding:12, marginBottom:14}}>
              <p style={{fontSize:12, fontWeight:500, color:'#1E40AF', marginBottom:10}}>
                + Agregar SKU al pedido
              </p>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 100px auto', gap:8, alignItems:'flex-end'}}>
                <div>
                  <div style={{fontSize:10, color:'#555', marginBottom:3}}>Taller *</div>
                  <select value={nuevoTaller} onChange={e=>setNuevoTaller(e.target.value)}
                    style={{...inp, fontSize:11}}>
                    <option value="">Seleccionar...</option>
                    {talleres.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10, color:'#555', marginBottom:3}}>SKU *</div>
                  <select value={nuevoSku} onChange={e=>setNuevoSku(e.target.value)}
                    style={{...inp, fontSize:11}}>
                    <option value="">Seleccionar...</option>
                    {skus.map(s=><option key={s.id} value={s.id}>{s.codigo}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10, color:'#555', marginBottom:3}}>Cantidad *</div>
                  <input type="number" min="1" value={nuevaCant} onChange={e=>setNuevaCant(e.target.value)}
                    style={inp} />
                </div>
                <button
                  onClick={agregarItemManual}
                  disabled={!nuevoTaller || !nuevoSku}
                  style={{
                    ...btn('#1E40AF'),
                    opacity: !nuevoTaller || !nuevoSku ? 0.4 : 1,
                    whiteSpace:'nowrap', alignSelf:'flex-end', padding:'7px 14px'
                  }}>
                  Agregar
                </button>
              </div>
              {/* Vista previa del precio al seleccionar SKU */}
              {nuevoSku && (()=>{
                const s = skus.find(x=>x.id===nuevoSku)
                const t = nuevoTaller ? talleres.find(x=>x.id===nuevoTaller) : null
                const regInv = nuevoTaller && nuevoSku ? inv.find(r=>r.taller_id===nuevoTaller&&r.sku_id===nuevoSku) : null
                return s ? (
                  <div style={{marginTop:8, fontSize:11, color:'#1E40AF', display:'flex', gap:16}}>
                    <span>Precio: <strong>{formatMXN(s.precio)}</strong> c/IVA</span>
                    {regInv !== undefined && <span>Stock actual en {t?.nombre ?? '...'}: <strong>{regInv?.stock ?? 0}</strong></span>}
                    <span>Subtotal: <strong>{formatMXN((s.precio||0)*(parseInt(nuevaCant)||1))}</strong></span>
                  </div>
                ) : null
              })()}
            </div>

            {/* Total y aviso */}
            <div style={{background:'#EAF3DE', borderRadius:8, padding:'10px 14px', marginBottom:12, display:'flex', justifyContent:'space-between'}}>
              <span style={{fontSize:12, color:'#3B6D11'}}>
                {itemsPedido.filter(it=>it.cantidad>0).length} ítems
                {manualesCount > 0 && ` (${manualesCount} manuales)`}
                {' · '}Total c/IVA
              </span>
              <span style={{fontWeight:500, fontSize:13, color:'#1a4f8a'}}>{formatMXN(totalModal)}</span>
            </div>
            <div style={{background:'#FEF9C3', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:11, color:'#854D0E'}}>
              ⏳ El pedido quedará en <strong>pendiente de aprobación</strong>. Un administrador debe aprobarlo antes de enviarse al proveedor.
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>setModalPedido(false)}
                style={{padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>
                Cancelar
              </button>
              <button onClick={confirmarPedido} disabled={saving||!itemsPedido.filter(it=>it.cantidad>0).length}
                style={{...btn(), opacity:saving||!itemsPedido.filter(it=>it.cantidad>0).length?0.5:1}}>
                {saving?'Enviando...':'Solicitar pedido →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal aprobación ── */}
      {modalAprobar && isAdmin && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:24, width:'100%', maxWidth:460}}>
            <p style={{fontWeight:500, marginBottom:8}}>Aprobar pedido OC-{modalAprobar.numero_oc}</p>
            <p style={{fontSize:12, color:'#888', marginBottom:14}}>
              {Array.isArray(modalAprobar.items)?modalAprobar.items.length:0} ítems · {formatMXN(modalAprobar.total)}
            </p>
            <div style={{background:'#EAF3DE', borderRadius:7, padding:'8px 12px', fontSize:11, color:'#166534', marginBottom:14}}>
              ✅ Al aprobar, el pedido podrá marcarse como enviado al proveedor.
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11, color:'#666', display:'block', marginBottom:4}}>Notas (opcional)</label>
              <input type="text" value={notasAprob} onChange={e=>setNotasAprob(e.target.value)}
                style={inp} placeholder="Ej: Autorizado por dirección" />
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={rechazarPedido}
                style={{padding:'5px 13px', background:'#FEE2E2', color:'#991B1B', border:'none', borderRadius:7, fontSize:12, cursor:'pointer'}}>
                Rechazar
              </button>
              <button onClick={()=>{setModalAprobar(null);setNotasAprob('')}}
                style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>
                Cancelar
              </button>
              <button onClick={aprobarPedido} style={btn('#166534')}>✅ Aprobar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal factura ── */}
      {modalFactura && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:20, width:'100%', maxWidth:400}}>
            <p style={{fontWeight:500, marginBottom:12}}>UUID Factura — OC-{modalFactura.numero_oc}</p>
            <input type="text" value={uuidFact} onChange={e=>setUuidFact(e.target.value)}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              style={{...inp, fontFamily:'monospace', fontSize:11, marginBottom:12}}/>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>setModalFactura(null)} style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>Cancelar</button>
              <button onClick={guardarFactura} style={btn()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar ── */}
      {confirmDel && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:24, width:'100%', maxWidth:360}}>
            <p style={{fontWeight:500, marginBottom:8}}>¿Eliminar pedido OC-{confirmDel.numero_oc}?</p>
            <p style={{fontSize:12, color:'#888', marginBottom:16}}>Esta acción no puede deshacerse.</p>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDel(null)} style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>Cancelar</button>
              <button onClick={()=>eliminarPedido(confirmDel.id)} style={btn('#E24B4A')}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
