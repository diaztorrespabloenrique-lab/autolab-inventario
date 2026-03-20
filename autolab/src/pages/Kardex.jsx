import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { REGIONES, ORIGEN_CFG } from '../lib/inventario'

const TIPO_CFG = {
  entrada: { icon:'▲', color:'#3B6D11' },
  salida:  { icon:'▼', color:'#A32D2D' },
  ajuste:  { icon:'●', color:'#0C447C' },
}
const ths = { padding:'7px 10px', fontWeight:500, fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3', whiteSpace:'nowrap' }
const tds = { padding:'7px 10px', borderBottom:'0.5px solid #f0efe8', fontSize:12, verticalAlign:'middle' }
const inp = { width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }
const lbl = { fontSize:11, color:'#666', display:'block', marginBottom:3 }

// Orígenes para entradas con sus configuraciones
const ORIGENES_ENTRADA = [
  { k:'compra',     l:'Compra',                    desc:'Compra a proveedor con factura' },
  { k:'movimiento', l:'Movimiento entre talleres',  desc:'Transferencia desde otro taller' },
  { k:'garantia',   l:'Garantía',                  desc:'Llega refacción de garantía del proveedor' },
  { k:'cascos',     l:'Cascos (recuperación)',      desc:'Casco de batería recuperado al hacer el cambio' },
]

export default function Kardex() {
  const { perfil } = useAuth()
  const isAdmin  = perfil?.rol === 'admin'
  const isVisor  = perfil?.rol === 'visor'
  const canWrite = ['admin','staff'].includes(perfil?.rol)

  const [movs,        setMovs]       = useState([])
  const [talleres,    setTalleres]   = useState([])
  const [skus,        setSkus]       = useState([])
  const [proveedores, setProveedores]= useState([])
  const [loading,     setLoading]    = useState(true)
  const [modal,       setModal]      = useState(false)
  const [saving,      setSaving]     = useState(false)
  const [editUUID,    setEditUUID]   = useState(null)
  const [confirmDel,  setConfirmDel] = useState(null)

  const initForm = {
    taller_id:'', sku_id:'', tipo:'salida', cantidad:'',
    origen:'compra', notas:'', proveedor_id:'', precio_unitario:'',
    uuid_factura:'', taller_origen_id:'', marca:'', placa:'', es_garantia:false,
  }
  const [form, setForm] = useState(initForm)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:m },{ data:t },{ data:s },{ data:p }] = await Promise.all([
      supabase.from('movimientos')
        .select('*, talleres(nombre,region), skus(codigo), perfiles(nombre), proveedores(nombre), taller_origen:taller_origen_id(nombre)')
        .order('created_at', { ascending:false }).limit(300),
      supabase.from('talleres').select('*').eq('activo',true).order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').eq('activo',true).order('codigo'),
      supabase.from('proveedores').select('*').eq('activo',true).order('nombre'),
    ])
    setMovs(m??[]); setTalleres(t??[]); setSkus(s??[]); setProveedores(p??[])
    setLoading(false)
  }

  // Cuando el origen es 'cascos', solo mostrar SKUs de tipo 'casco bateria'
  function skusParaOrigen(origen) {
    if (origen === 'cascos') {
      return skus.filter(s => (s.tipos_refaccion?.nombre ?? s.tipo) === 'casco bateria')
    }
    return skus
  }

  function totalCalc() {
    return (parseFloat(form.precio_unitario)||0) * (parseInt(form.cantidad)||0)
  }

  // ¿Este origen requiere UUID? Solo 'compra'
  function requiereUUID(origen) { return origen === 'compra' }

  async function handleGuardar() {
    if (!form.taller_id || !form.sku_id || !form.cantidad) return alert('Completa taller, SKU y cantidad')
    if (form.tipo === 'entrada' && form.origen === 'compra' && !form.proveedor_id) return alert('Selecciona el proveedor')
    if (form.tipo === 'entrada' && form.origen === 'compra' && !form.precio_unitario) return alert('Ingresa el precio unitario con IVA')
    if (form.tipo === 'salida' && !form.es_garantia && !form.placa.trim()) return alert('La placa es obligatoria para salidas normales')

    setSaving(true)
    const payload = {
      taller_id:  form.taller_id,
      sku_id:     form.sku_id,
      tipo:       form.tipo,
      cantidad:   parseInt(form.cantidad),
      notas:      form.notas || null,
      usuario_id: perfil?.id,
      fecha:      new Date().toISOString().split('T')[0],
      origen:     form.tipo === 'entrada' ? form.origen : null,
      marca:      form.tipo === 'entrada' && form.marca.trim() ? form.marca.trim() : null,
      placa:      form.tipo === 'salida' && !form.es_garantia ? form.placa.trim().toUpperCase() : null,
      es_garantia:form.tipo === 'salida' ? form.es_garantia : false,
      ...(form.tipo === 'entrada' && form.origen === 'compra' && {
        proveedor_id:    form.proveedor_id || null,
        precio_unitario: parseFloat(form.precio_unitario) || null,
        precio_total:    totalCalc() || null,
        uuid_factura:    form.uuid_factura.trim() || null,
      }),
      ...(form.tipo === 'entrada' && form.origen === 'movimiento' && {
        taller_origen_id: form.taller_origen_id || null,
      }),
      // Cascos: no tiene precio ni UUID, es recuperación
    }

    const { error } = await supabase.from('movimientos').insert(payload)
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setModal(false); setForm(initForm); load(); setSaving(false)
  }

  async function handleDelete(id) {
    await supabase.from('movimientos').delete().eq('id', id)
    setConfirmDel(null); load()
  }

  async function handleSaveUUID() {
    if (!editUUID) return
    await supabase.from('movimientos').update({ uuid_factura: editUUID.uuid }).eq('id', editUUID.id)
    setEditUUID(null); load()
  }

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:1300 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Kardex de movimientos</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Entradas, salidas y ajustes de inventario</p>
        </div>
        {canWrite && (
          <button onClick={() => setModal(true)}
            style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
            + Nuevo movimiento
          </button>
        )}
        {isVisor && <span style={{ fontSize:11, color:'#3B6D11', background:'#EAF3DE', padding:'5px 12px', borderRadius:8 }}>👁 Solo lectura</span>}
      </div>

      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Fecha','Tipo','Origen','Taller','Ciudad','SKU','Qty','Marca','Placa / Info','Proveedor','P. Unit.','Total','UUID Factura','Registró', ...(isAdmin?['Acc.']:[])].map(h=>(
                  <th key={h} style={ths}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movs.map(m => {
                const tc  = TIPO_CFG[m.tipo] ?? TIPO_CFG.ajuste
                const rc  = REGIONES[m.talleres?.region] ?? {}
                const oc  = ORIGEN_CFG[m.origen] ?? null
                // Solo mostrar "Falta UUID" en entradas de compra
                const sinUUID = m.tipo==='entrada' && m.origen==='compra' && !m.uuid_factura
                return (
                  <tr key={m.id}>
                    <td style={tds}>{m.fecha}</td>
                    <td style={tds}><span style={{ color:tc.color, fontWeight:500 }}>{tc.icon} {m.tipo}</span></td>
                    <td style={tds}>
                      {oc ? <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:oc.bg, color:oc.color, fontWeight:500 }}>{oc.label}</span>
                          : <span style={{ color:'#ccc' }}>—</span>}
                    </td>
                    <td style={{ ...tds, fontWeight:500 }}>
                      {m.talleres?.nombre}
                      {m.origen==='movimiento' && m.taller_origen?.nombre && (
                        <div style={{ fontSize:10, color:'#888' }}>desde: {m.taller_origen.nombre}</div>
                      )}
                    </td>
                    <td style={{ ...tds, fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                    <td style={{ ...tds, fontFamily:'monospace', fontSize:11 }}>{m.skus?.codigo}</td>
                    <td style={{ ...tds, fontWeight:500, color:tc.color, textAlign:'right' }}>
                      {m.tipo==='entrada'?'+':m.tipo==='salida'?'-':''}{m.cantidad}
                    </td>
                    <td style={{ ...tds, fontSize:11 }}>{m.marca || <span style={{ color:'#ccc' }}>—</span>}</td>
                    <td style={tds}>
                      {m.tipo==='salida'
                        ? m.es_garantia
                          ? <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'#FAEEDA', color:'#633806', fontWeight:500 }}>⚠ Garantía</span>
                          : m.placa
                            ? <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:500, background:'#f5f5f3', padding:'2px 6px', borderRadius:5 }}>{m.placa}</span>
                            : <span style={{ color:'#ccc' }}>—</span>
                        : m.origen==='cascos'
                          ? <span style={{ fontSize:10, color:'#5F5E5A' }}>recuperación</span>
                          : <span style={{ color:'#ccc' }}>—</span>}
                    </td>
                    <td style={tds}>{m.proveedores?.nombre ?? <span style={{ color:'#ccc' }}>—</span>}</td>
                    <td style={{ ...tds, textAlign:'right' }}>
                      {m.precio_unitario ? `$${Number(m.precio_unitario).toLocaleString('es-MX')}` : <span style={{ color:'#ccc' }}>—</span>}
                    </td>
                    <td style={{ ...tds, textAlign:'right' }}>
                      {m.precio_total ? `$${Number(m.precio_total).toLocaleString('es-MX')}` : <span style={{ color:'#ccc' }}>—</span>}
                    </td>
                    <td style={tds}>
                      {sinUUID ? (
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ background:'#FCEBEB', color:'#791F1F', fontSize:10, padding:'2px 7px', borderRadius:20, fontWeight:500 }}>⚠ Falta UUID</span>
                          {isAdmin && (
                            <button onClick={() => setEditUUID({ id:m.id, uuid:'' })}
                              style={{ fontSize:10, padding:'2px 8px', border:'0.5px solid #ccc', borderRadius:6, cursor:'pointer', background:'white' }}>
                              Agregar
                            </button>
                          )}
                        </div>
                      ) : m.uuid_factura ? (
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ fontFamily:'monospace', fontSize:10 }}>{m.uuid_factura.slice(0,12)}...</span>
                          {isAdmin && (
                            <button onClick={() => setEditUUID({ id:m.id, uuid:m.uuid_factura })}
                              style={{ fontSize:10, padding:'2px 7px', border:'0.5px solid #ccc', borderRadius:6, cursor:'pointer', background:'white' }}>
                              Editar
                            </button>
                          )}
                        </div>
                      ) : (
                        // No requiere UUID (cascos, movimiento, garantia) → no muestra alerta
                        <span style={{ color:'#ccc' }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tds, color:'#aaa', fontSize:11 }}>{m.perfiles?.nombre}</td>
                    {isAdmin && (
                      <td style={tds}>
                        <button onClick={() => setConfirmDel(m)}
                          style={{ background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'3px 9px', fontSize:11, cursor:'pointer' }}>
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal nuevo movimiento ── */}
      {modal && canWrite && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:510, maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <p style={{ fontWeight:500 }}>Nuevo movimiento</p>
              <button onClick={() => { setModal(false); setForm(initForm) }}
                style={{ background:'none', border:'0.5px solid #ccc', borderRadius:7, padding:'3px 10px', cursor:'pointer' }}>✕</button>
            </div>

            {/* Tipo */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
              {['entrada','salida','ajuste'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tipo:t, es_garantia:false }))}
                  style={{ padding:'8px', borderRadius:8, border:`1.5px solid ${form.tipo===t?'#1a4f8a':'#e0dfd8'}`,
                    background:form.tipo===t?'#E6F1FB':'white', color:form.tipo===t?'#0C447C':'#666',
                    fontWeight:form.tipo===t?500:400, cursor:'pointer', fontSize:12 }}>
                  {t==='entrada'?'▲ Entrada':t==='salida'?'▼ Salida':'● Ajuste'}
                </button>
              ))}
            </div>

            {/* ── ENTRADA: selector de origen ── */}
            {form.tipo === 'entrada' && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#666', marginBottom:6, fontWeight:500 }}>Origen de la entrada *</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {ORIGENES_ENTRADA.map(({ k, l, desc }) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, origen:k, sku_id:'' }))}
                      style={{ padding:'8px 10px', borderRadius:8, fontSize:11, cursor:'pointer', textAlign:'left',
                        border:`1.5px solid ${form.origen===k?'#1a4f8a':'#e0dfd8'}`,
                        background:form.origen===k?'#E6F1FB':'white',
                        color:form.origen===k?'#0C447C':'#444' }}>
                      <div style={{ fontWeight:500 }}>{l}</div>
                      <div style={{ fontSize:10, color:form.origen===k?'#185FA5':'#888', marginTop:2 }}>{desc}</div>
                    </button>
                  ))}
                </div>

                {/* Aviso especial para cascos */}
                {form.origen === 'cascos' && (
                  <div style={{ marginTop:8, background:'#F1EFE8', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#5F5E5A' }}>
                    Solo se muestran SKUs de tipo <strong>casco bateria</strong>. No se solicitará factura ni UUID.
                  </div>
                )}
              </div>
            )}

            {/* ── SALIDA: toggle garantía / placa ── */}
            {form.tipo === 'salida' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:10,
                  padding:'8px 12px', background:form.es_garantia?'#FAEEDA':'#f9f9f7',
                  borderRadius:8, border:`1px solid ${form.es_garantia?'#FAC775':'#e0dfd8'}` }}>
                  <input type="checkbox" checked={form.es_garantia}
                    onChange={e => setForm(f => ({ ...f, es_garantia:e.target.checked, placa:'' }))} />
                  <div>
                    <span style={{ fontWeight:500, fontSize:12, color:form.es_garantia?'#633806':'#444' }}>Salida de garantía</span>
                    <div style={{ fontSize:10, color:'#888', marginTop:1 }}>
                      {form.es_garantia ? 'Proveedor recoge la pieza — no requiere placa' : 'Marca si el proveedor está recogiendo una garantía'}
                    </div>
                  </div>
                </label>
                {!form.es_garantia && (
                  <div>
                    <label style={lbl}>Placa del vehículo *</label>
                    <input style={{ ...inp, textTransform:'uppercase' }} value={form.placa}
                      onChange={e => setForm(f => ({ ...f, placa:e.target.value.toUpperCase() }))}
                      placeholder="ej. ABC-123-D" />
                    <p style={{ fontSize:10, color:'#888', marginTop:3 }}>Obligatorio para salidas normales</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Taller + SKU ── */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>Taller destino *</label>
                <select style={inp} value={form.taller_id} onChange={e => setForm(f => ({ ...f, taller_id:e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {talleres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>
                  SKU *
                  {form.tipo==='entrada' && form.origen==='cascos' && (
                    <span style={{ color:'#854F0B', fontSize:10, marginLeft:4 }}>(solo cascos batería)</span>
                  )}
                </label>
                <select style={inp} value={form.sku_id} onChange={e => setForm(f => ({ ...f, sku_id:e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {skusParaOrigen(form.tipo==='entrada' ? form.origen : '').map(s => (
                    <option key={s.id} value={s.id}>{s.codigo}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom:10 }}>
              <label style={lbl}>Cantidad *</label>
              <input type="number" min="1" style={inp} value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad:e.target.value }))} />
            </div>

            {/* Marca (solo entradas que no sean cascos) */}
            {form.tipo === 'entrada' && form.origen !== 'cascos' && (
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Marca <span style={{ color:'#aaa', fontSize:10 }}>(opcional — informativo)</span></label>
                <input style={inp} value={form.marca}
                  onChange={e => setForm(f => ({ ...f, marca:e.target.value }))}
                  placeholder="ej. Bridgestone, Optima, Yuasa..." />
              </div>
            )}

            {/* Taller origen (movimiento) */}
            {form.tipo==='entrada' && form.origen==='movimiento' && (
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Taller de origen <span style={{ color:'#888', fontSize:10 }}>(la salida se registra automáticamente)</span></label>
                <select style={inp} value={form.taller_origen_id}
                  onChange={e => setForm(f => ({ ...f, taller_origen_id:e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {talleres.filter(t => t.id !== form.taller_id).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Datos de compra */}
            {form.tipo==='entrada' && form.origen==='compra' && (
              <div style={{ background:'#f9f9f7', border:'0.5px solid #e0dfd8', borderRadius:9, padding:12, marginBottom:10 }}>
                <p style={{ fontSize:11, fontWeight:500, marginBottom:10 }}>Datos de compra</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Proveedor *</label>
                    <select style={inp} value={form.proveedor_id}
                      onChange={e => setForm(f => ({ ...f, proveedor_id:e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Precio unitario c/IVA (MXN) *</label>
                    <input type="number" min="0" step="0.01" style={inp} value={form.precio_unitario}
                      onChange={e => setForm(f => ({ ...f, precio_unitario:e.target.value }))} />
                  </div>
                </div>
                {form.precio_unitario && form.cantidad && (
                  <div style={{ background:'#EAF3DE', borderRadius:7, padding:'7px 10px', marginBottom:10, fontSize:12 }}>
                    <span style={{ color:'#3B6D11', fontWeight:500 }}>
                      Total: ${totalCalc().toLocaleString('es-MX')} MXN
                    </span>
                    <span style={{ color:'#888', fontSize:10, marginLeft:8 }}>
                      ({form.cantidad} × ${parseFloat(form.precio_unitario||0).toLocaleString('es-MX')})
                    </span>
                  </div>
                )}
                <div>
                  <label style={lbl}>UUID de factura <span style={{ color:'#aaa' }}>(opcional — se puede agregar después)</span></label>
                  <input type="text" style={{ ...inp, fontFamily:'monospace', fontSize:11 }}
                    value={form.uuid_factura} onChange={e => setForm(f => ({ ...f, uuid_factura:e.target.value }))}
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" />
                  {!form.uuid_factura && (
                    <p style={{ fontSize:10, color:'#E24B4A', marginTop:3 }}>⚠ Se marcará como pendiente hasta registrarlo</p>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Notas</label>
              <input type="text" style={inp} value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas:e.target.value }))} />
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setModal(false); setForm(initForm) }}
                style={{ padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={handleGuardar} disabled={saving}
                style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar UUID */}
      {editUUID && isAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:12, padding:20, width:'100%', maxWidth:400 }}>
            <p style={{ fontWeight:500, marginBottom:12 }}>Registrar UUID de factura</p>
            <input type="text" value={editUUID.uuid} onChange={e => setEditUUID(x => ({ ...x, uuid:e.target.value }))}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              style={{ ...inp, fontFamily:'monospace', fontSize:11, marginBottom:12 }} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setEditUUID(null)} style={{ padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={handleSaveUUID} style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7, padding:'5px 13px', fontSize:12, cursor:'pointer' }}>Guardar UUID</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {confirmDel && isAdmin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:12, padding:24, width:'100%', maxWidth:360 }}>
            <p style={{ fontWeight:500, marginBottom:8 }}>¿Eliminar este movimiento?</p>
            <p style={{ fontSize:12, color:'#888', marginBottom:16 }}>
              {confirmDel.tipo} · {confirmDel.skus?.codigo} · {confirmDel.talleres?.nombre} · {confirmDel.fecha}
            </p>
            <div style={{ background:'#FAEEDA', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#633806', marginBottom:16 }}>
              ⚠ Esta acción revertirá el stock automáticamente.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDel.id)} style={{ background:'#E24B4A', color:'white', border:'none', borderRadius:7, padding:'5px 13px', fontSize:12, cursor:'pointer' }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
