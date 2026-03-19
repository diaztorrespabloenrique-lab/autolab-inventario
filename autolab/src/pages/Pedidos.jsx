import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES, CLIENTES, formatMXN } from '../lib/inventario'

export default function Pedidos() {
  const [inv,       setInv]       = useState([])
  const [pedidos,   setPedidos]   = useState([])
  const [talleres,  setTalleres]  = useState([])
  const [skus,      setSkus]      = useState([])
  const [proveedores,setProveedores]=useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [modalFactura, setModalFactura] = useState(null) // pedido seleccionado
  const [formFactura, setFormFactura] = useState({ url:'', valor:'', file:null })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:i },{ data:p },{ data:t },{ data:s },{ data:pv }] = await Promise.all([
      supabase.from('v_inventario').select('*'),
      supabase.from('pedidos').select('*, pedido_items(*, talleres(nombre,region,cliente), skus(codigo,precio)), proveedores(nombre)').order('created_at', { ascending:false }),
      supabase.from('talleres').select('*').eq('activo',true).order('nombre'),
      supabase.from('skus').select('*').eq('activo',true).order('codigo'),
      supabase.from('proveedores').select('*').eq('activo',true).order('nombre'),
    ])
    setInv(i ?? [])
    setPedidos(p ?? [])
    setTalleres(t ?? [])
    setSkus(s ?? [])
    setProveedores(pv ?? [])
    setLoading(false)
  }

  // Propuesta: solo SKUs con rotación > 0 y semanas < 2
  const propuesta = inv
    .filter(r => r.rotacion > 0 && r.semanas < 2)
    .map(r => ({
      ...r,
      pedir: Math.ceil(r.rotacion * 2 - r.stock),
      total: Math.ceil(r.rotacion * 2 - r.stock) * (r.precio ?? 0),
    }))
    .filter(r => r.pedir > 0)
    .sort((a,b) => a.semanas - b.semanas)

  const totalPropuesta = propuesta.reduce((s,r) => s+r.total, 0)

  async function confirmar() {
    if (!propuesta.length) return
    setSaving(true)
    // Generar número de orden consecutivo
    const { count } = await supabase.from('pedidos').select('*', { count:'exact', head:true })
    const numOrden = 'OC-' + String((count ?? 0) + 1).padStart(4,'0')

    const semana = `Semana ${getWeek()} - ${new Date().toLocaleDateString('es-MX',{month:'long',year:'numeric'})}`
    const { data:pedido, error } = await supabase.from('pedidos')
      .insert({ semana, estado:'enviado', total_mxn:totalPropuesta, numero_orden:numOrden })
      .select().single()
    if (error) { alert('Error: '+error.message); setSaving(false); return }

    const items = propuesta.map(r => ({
      pedido_id:  pedido.id,
      taller_id:  r.taller_id,
      sku_id:     r.sku_id,
      cantidad:   r.pedir,
      precio_unit:r.precio ?? 0,
    }))
    await supabase.from('pedido_items').insert(items)
    load(); setSaving(false)
  }

  async function guardarFactura() {
    if (!modalFactura) return
    let url = formFactura.url
    // Si hay archivo, subirlo a Storage
    if (formFactura.file) {
      const path = `facturas/${modalFactura.id}/${formFactura.file.name}`
      const { data:up } = await supabase.storage.from('evidencias').upload(path, formFactura.file, { upsert:true })
      if (up) {
        const { data:{ publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(path)
        url = publicUrl
      }
    }
    await supabase.from('pedidos').update({
      factura_url:   url || null,
      factura_valor: parseFloat(formFactura.valor) || null,
      estado:        'recibido',
    }).eq('id', modalFactura.id)
    setModalFactura(null)
    setFormFactura({ url:'', valor:'', file:null })
    load()
  }

  function getWeek() {
    const d=new Date(); const s=new Date(d.getFullYear(),0,1)
    return Math.ceil(((d-s)/86400000+s.getDay()+1)/7)
  }

  const estCfg = {
    borrador:{ l:'Borrador', bg:'#F1EFE8', color:'#5F5E5A' },
    enviado: { l:'Enviado',  bg:'#EAF3DE', color:'#27500A' },
    recibido:{ l:'Recibido', bg:'#E6F1FB', color:'#0C447C' },
  }

  const ths = { padding:'6px 10px', fontWeight:500, fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3', whiteSpace:'nowrap' }
  const tds = { padding:'6px 10px', borderBottom:'0.5px solid #f0efe8', fontSize:12 }

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:1000 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Pedidos de compra</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Solo se recomiendan referencias con rotación {'>'} 0 y {'<'} 2 semanas de stock</p>
        </div>
        <button onClick={confirmar} disabled={saving||!propuesta.length}
          style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500, opacity:(saving||!propuesta.length)?0.5:1 }}>
          {saving ? 'Guardando...' : '⚡ Confirmar pedido'}
        </button>
      </div>

      {/* Propuesta */}
      <div style={{ background:'white', border:'0.5px solid #B5D4F4', borderTop:'3px solid #185FA5', borderRadius:10, padding:14, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <p style={{ fontWeight:500 }}>Propuesta semana actual</p>
            <p style={{ fontSize:11, color:'#888', marginTop:2 }}>
              {propuesta.length} referencias · {formatMXN(totalPropuesta)} MXN
              {propuesta.length === 0 && ' — no hay referencias críticas con rotación activa'}
            </p>
          </div>
        </div>
        {propuesta.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['Taller','Ciudad','Cliente','SKU','Stock','Semanas','Pedir','Precio unit.','Total MXN'].map(h=>(
                    <th key={h} style={ths}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propuesta.map((r,i) => {
                  const rc=REGIONES[r.region]??{}; const cc=CLIENTES[r.cliente]??CLIENTES.ind
                  return (
                    <tr key={i}>
                      <td style={{ ...tds, fontWeight:500 }}>{r.taller}</td>
                      <td style={{ ...tds, fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                      <td style={tds}><span style={{ fontSize:9, padding:'1px 6px', borderRadius:20, background:cc.bg, color:cc.color, fontWeight:500 }}>{cc.label}</span></td>
                      <td style={{ ...tds, fontFamily:'monospace', fontSize:11 }}>{r.sku}</td>
                      <td style={{ ...tds, textAlign:'right', color:r.stock===0?'#A32D2D':'inherit', fontWeight:500 }}>{r.stock}</td>
                      <td style={{ ...tds, textAlign:'right' }}>{r.stock===0?'—':Number(r.semanas).toFixed(1)}</td>
                      <td style={{ ...tds, textAlign:'right', fontWeight:500, color:'#0C447C' }}>{r.pedir}</td>
                      <td style={{ ...tds, textAlign:'right' }}>{formatMXN(r.precio)}</td>
                      <td style={{ ...tds, textAlign:'right', fontWeight:500 }}>{formatMXN(r.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}/>
                  <td colSpan={2} style={{ ...tds, textAlign:'right', fontWeight:500 }}>
                    Total: {formatMXN(totalPropuesta)} MXN
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Historial */}
      <p style={{ fontSize:12, fontWeight:500, color:'#888', marginBottom:8 }}>Historial de pedidos</p>
      {pedidos.map(p => {
        const est = estCfg[p.estado] ?? estCfg.borrador
        const totalItems = p.pedido_items?.reduce((s,i)=>s+(i.precio_unit*i.cantidad),0) ?? 0
        const diff = p.factura_valor ? p.factura_valor - totalItems : null
        const isOpen = expandido === p.id
        return (
          <div key={p.id} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, marginBottom:8, overflow:'hidden' }}>
            {/* Fila principal */}
            <div style={{ display:'flex', alignItems:'center', padding:'12px 14px', cursor:'pointer', gap:10 }}
              onClick={() => setExpandido(isOpen ? null : p.id)}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:500, background:'#f5f5f3', padding:'1px 7px', borderRadius:6 }}>{p.numero_orden ?? '—'}</span>
                  <span style={{ fontWeight:500 }}>{p.semana}</span>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:est.bg, color:est.color, fontWeight:500 }}>{est.l}</span>
                  {p.factura_valor && (
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20,
                      background: Math.abs(diff)<1 ? '#EAF3DE' : '#FCEBEB',
                      color: Math.abs(diff)<1 ? '#27500A' : '#791F1F', fontWeight:500 }}>
                      {Math.abs(diff)<1 ? '✓ Factura ok' : `Diferencia ${formatMXN(diff)}`}
                    </span>
                  )}
                  {!p.factura_url && <span style={{ fontSize:10, color:'#854F0B', background:'#FAEEDA', padding:'2px 7px', borderRadius:20 }}>⚠ Sin factura</span>}
                </div>
                <p style={{ fontSize:11, color:'#888' }}>
                  {p.fecha} · {p.pedido_items?.length ?? 0} refs · {formatMXN(totalItems)} MXN
                  {p.factura_valor && ` · Factura: ${formatMXN(p.factura_valor)}`}
                </p>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={e => { e.stopPropagation(); setModalFactura(p); setFormFactura({ url:p.factura_url??'', valor:p.factura_valor??'', file:null }) }}
                  style={{ padding:'4px 10px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, cursor:'pointer', background:'white' }}>
                  {p.factura_url ? 'Ver factura' : '+ Factura'}
                </button>
                <span style={{ color:'#888', fontSize:12 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Detalle expandible */}
            {isOpen && (
              <div style={{ borderTop:'0.5px solid #e0dfd8', padding:'0 14px 14px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, marginTop:10 }}>
                  <thead>
                    <tr>
                      {['Taller','Ciudad','SKU','Cantidad','Precio unit.','Subtotal'].map(h=>(
                        <th key={h} style={{ ...ths, fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(p.pedido_items ?? []).map(item => {
                      const rc = REGIONES[item.talleres?.region] ?? {}
                      return (
                        <tr key={item.id}>
                          <td style={{ ...tds, fontWeight:500 }}>{item.talleres?.nombre}</td>
                          <td style={{ ...tds, fontSize:10, color:rc.color, fontWeight:500 }}>{rc.label}</td>
                          <td style={{ ...tds, fontFamily:'monospace' }}>{item.skus?.codigo}</td>
                          <td style={{ ...tds, textAlign:'right' }}>{item.cantidad}</td>
                          <td style={{ ...tds, textAlign:'right' }}>{formatMXN(item.precio_unit)}</td>
                          <td style={{ ...tds, textAlign:'right', fontWeight:500 }}>{formatMXN(item.precio_unit*item.cantidad)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}/>
                      <td style={{ ...tds, fontWeight:500, textAlign:'right' }}>Total pedido:</td>
                      <td style={{ ...tds, fontWeight:500, textAlign:'right' }}>{formatMXN(totalItems)}</td>
                    </tr>
                    {p.factura_valor && (
                      <tr>
                        <td colSpan={4}/>
                        <td style={{ ...tds, fontWeight:500, textAlign:'right' }}>Total factura:</td>
                        <td style={{ ...tds, fontWeight:500, textAlign:'right', color: Math.abs(diff)<1?'#3B6D11':'#A32D2D' }}>{formatMXN(p.factura_valor)}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
                {p.factura_url && (
                  <div style={{ marginTop:10 }}>
                    <a href={p.factura_url} target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:'#185FA5', textDecoration:'none' }}>📄 Ver PDF de factura →</a>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Modal factura */}
      {modalFactura && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <p style={{ fontWeight:500 }}>Factura — {modalFactura.numero_orden}</p>
              <button onClick={()=>setModalFactura(null)} style={{ background:'none', border:'0.5px solid #ccc', borderRadius:7, padding:'3px 10px', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Valor de la factura (MXN con IVA)</label>
              <input type="number" value={formFactura.valor} onChange={e=>setFormFactura(f=>({...f,valor:e.target.value}))}
                style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }} />
              {formFactura.valor && (
                <p style={{ fontSize:11, marginTop:4, color: Math.abs(parseFloat(formFactura.valor)-(modalFactura.pedido_items?.reduce((s,i)=>s+i.precio_unit*i.cantidad,0)??0))<1 ? '#3B6D11':'#A32D2D' }}>
                  {Math.abs(parseFloat(formFactura.valor)-(modalFactura.pedido_items?.reduce((s,i)=>s+i.precio_unit*i.cantidad,0)??0))<1
                    ? '✓ Coincide con el valor del pedido'
                    : `Diferencia: ${formatMXN(parseFloat(formFactura.valor)-(modalFactura.pedido_items?.reduce((s,i)=>s+i.precio_unit*i.cantidad,0)??0))}`}
                </p>
              )}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>PDF de la factura</label>
              <label style={{ border:'1.5px dashed #ccc', borderRadius:9, padding:'14px', textAlign:'center', display:'block', cursor:'pointer', fontSize:11, color:'#888' }}>
                <div style={{ fontSize:18, marginBottom:4 }}>📄</div>
                {formFactura.file ? formFactura.file.name : 'Seleccionar PDF'}
                <input type="file" accept="application/pdf" style={{ display:'none' }}
                  onChange={e=>setFormFactura(f=>({...f,file:e.target.files[0]}))} />
              </label>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>setModalFactura(null)} style={{ padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={guardarFactura} style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>Guardar factura</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
