import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { REGIONES, ORIGEN_CFG } from '../lib/inventario'

const TIPO_CFG = {
  entrada: { icon:'▲', color:'#3B6D11' },
  salida:  { icon:'▼', color:'#A32D2D' },
  ajuste:  { icon:'●', color:'#0C447C' },
}
const ESTADO_APR_CFG = {
  pendiente: { label:'⏳ Pendiente', bg:'#FEF9C3', color:'#854D0E' },
  aprobado:  { label:'✅ Aprobado',  bg:'#DCFCE7', color:'#166534' },
  rechazado: { label:'❌ Rechazado', bg:'#FEE2E2', color:'#991B1B' },
}
const ths = { padding:'7px 10px', fontWeight:500, fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3', whiteSpace:'nowrap' }
const tds = { padding:'7px 10px', borderBottom:'0.5px solid #f0efe8', fontSize:12, verticalAlign:'middle' }
const inp = { width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }
const lbl = { fontSize:11, color:'#666', display:'block', marginBottom:3 }

const ORIGENES_ENTRADA = [
  { k:'compra',     l:'Compra',                   desc:'Entrada vinculada a una OC' },
  { k:'movimiento', l:'Movimiento entre talleres', desc:'Transferencia desde otro taller' },
  { k:'garantia',   l:'Garantía',                 desc:'Refacción de garantía del proveedor' },
  { k:'cascos',     l:'Cascos (recuperación)',     desc:'Casco recuperado al cambiar batería' },
]

export default function Kardex() {
  const { perfil } = useAuth()
  const isAdmin  = perfil?.rol === 'admin'
  const isVisor  = perfil?.rol === 'visor'
  const canWrite = ['admin','staff'].includes(perfil?.rol)

  const [movs,        setMovs]        = useState([])
  const [talleres,    setTalleres]    = useState([])
  const [skus,        setSkus]        = useState([])
  const [proveedores, setProveedores] = useState([])
  const [pedidosOC,   setPedidosOC]   = useState([]) // OCs aprobadas/enviadas disponibles
  const [ocCompletas,  setOcCompletas]  = useState(new Set()) // IDs de OCs con recepción completa
  const [costoMap,      setCostoMap]      = useState({})
  const [preciosCiudad, setPreciosCiudad] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [editUUID,    setEditUUID]    = useState(null) // solo para entradas antiguas
  const [confirmDel,  setConfirmDel]  = useState(null)
  const [confirmApr,  setConfirmApr]  = useState(null)

  // Filtros
  const [fTaller,    setFTaller]    = useState('')
  const [fProveedor, setFProveedor] = useState('')
  const [fTipo,      setFTipo]      = useState('')
  const [fOrigen,    setFOrigen]    = useState('')
  const [fPendiente, setFPendiente] = useState(false)

  const initForm = {
    taller_id:'', sku_id:'', tipo:'salida', cantidad:'',
    origen:'compra', notas:'', proveedor_id:'', precio_unitario:'',
    taller_origen_id:'', marca:'', placa:'', es_garantia:false,
    appointment_id:'', pedido_id:'',
  }
  const [form, setForm] = useState(initForm)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:m, error:mErr }, { data:t }, { data:s }, { data:p }, { data:ocs }, { data:recOC }, { data:preciosCd }] = await Promise.all([
      supabase.from('movimientos')
        .select(`
          id, taller_id, sku_id, tipo, cantidad, notas, fecha, origen,
          marca, placa, es_garantia, precio_unitario, precio_total,
          uuid_factura, usuario_id, proveedor_id, taller_origen_id,
          appointment_id, fuente, estado_aprobacion, aprobado_por,
          pedido_id, created_at,
          talleres!movimientos_taller_id_fkey(nombre, region),
          skus(codigo),
          proveedores(nombre),
          taller_origen:talleres!movimientos_taller_origen_id_fkey(nombre),
          pedidos(numero_oc)
        `)
        .order('created_at', { ascending:false })
        .limit(300),
      supabase.from('talleres').select('*').eq('activo',true).order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').eq('activo',true).order('codigo'),
      supabase.from('proveedores').select('*').eq('activo',true).order('nombre'),
      // OCs aprobadas/enviadas — excluiremos las completas al filtrar
      supabase.from('pedidos')
        .select('id, numero_oc, items, proveedor_id, proveedores(nombre)')
        .in('estado', ['aprobado','enviado'])
        .order('numero_oc', { ascending:false }),
      // Recepción de OCs para excluir las completas
      supabase.from('v_oc_recepcion').select('pedido_id, estado_recepcion'),
      // Precios por ciudad para pre-llenar precio en entradas
      supabase.from('precios_ciudad').select('sku_id, region, precio_iva'),
    ])

    if (mErr) console.error('Error movimientos:', mErr)

    let movsConNombre = m ?? []
    if (movsConNombre.length > 0) {
      const userIds = [...new Set(movsConNombre.map(x => x.usuario_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data:perfs } = await supabase.from('perfiles').select('id,nombre').in('id', userIds)
        const perfilMap = {}
        ;(perfs ?? []).forEach(p => { perfilMap[p.id] = p.nombre })
        movsConNombre = movsConNombre.map(mv => ({
          ...mv,
          nombre_usuario: mv.fuente === 'sistema' ? 'Sistema' : (perfilMap[mv.usuario_id] ?? '—')
        }))
      }
    }

    // Cargar costos promedio
    const { data:costos } = await supabase.from('inventario').select('taller_id, sku_id, costo_promedio')
    const costoMap = {}
    ;(costos ?? []).forEach(r => { costoMap[`${r.taller_id}_${r.sku_id}`] = r.costo_promedio })
    setCostoMap(costoMap)

    setMovs(movsConNombre)
    setTalleres(t ?? [])
    setSkus(s ?? [])
    setProveedores(p ?? [])
    setPedidosOC(ocs ?? [])

    // Cargar qué OCs están completamente recibidas para excluirlas del selector
    const { data:recep } = await supabase
      .from('v_oc_recepcion')
      .select('pedido_id, estado_recepcion')
      .eq('estado_recepcion', 'completo')
    setOcCompletas(new Set((recep ?? []).map(r => r.pedido_id)))

    setLoading(false)
  }

  // Precio de lista para un SKU en la región del taller seleccionado
  function getPrecioLista(sku_id) {
    if (!form.taller_id) return ''
    const taller = talleres.find(t => t.id === form.taller_id)
    if (!taller) return ''
    const pc = preciosCiudad.find(p => p.sku_id === sku_id && p.region === taller.region)
    return pc ? pc.precio_iva : ''
  }

  function skusParaOrigen(origen) {
    if (origen === 'cascos') return skus.filter(s => (s.tipos_refaccion?.nombre ?? s.tipo) === 'casco bateria')
    return skus
  }

  function totalCalc() {
    return (parseFloat(form.precio_unitario)||0) * (parseInt(form.cantidad)||0)
  }

  // Al seleccionar una OC, auto-llenar proveedor_id
  function onSelectOC(pedido_id) {
    setForm(f => {
      const oc = pedidosOC.find(p => p.id === pedido_id)
      return { ...f, pedido_id, proveedor_id: oc?.proveedor_id ?? f.proveedor_id }
    })
  }

  // Filtrar OCs que contienen el taller+SKU seleccionado
  function ocsFiltradas() {
    // Excluir siempre las OCs con recepción completa
    const disponibles = pedidosOC.filter(oc => !ocCompletas.has(oc.id))
    if (!form.taller_id || !form.sku_id) return disponibles
    return disponibles.filter(oc => {
      const items = Array.isArray(oc.items) ? oc.items : []
      return items.some(it => it.taller_id === form.taller_id && it.sku_id === form.sku_id)
    })
  }

  const movsFiltrados = movs.filter(m => {
    if (fTaller    && m.taller_id    !== fTaller)    return false
    if (fProveedor && m.proveedor_id !== fProveedor) return false
    if (fTipo      && m.tipo         !== fTipo)      return false
    if (fOrigen    && m.origen       !== fOrigen)    return false
    if (fPendiente && m.estado_aprobacion !== 'pendiente') return false
    return true
  })

  const pendientesCount = movs.filter(m => m.estado_aprobacion === 'pendiente').length

  async function handleGuardar() {
    if (!form.taller_id || !form.sku_id || !form.cantidad) return alert('Completa taller, SKU y cantidad')
    if (form.tipo === 'entrada' && form.origen === 'compra' && !form.proveedor_id) return alert('Selecciona el proveedor')
    if (form.tipo === 'entrada' && form.origen === 'compra' && !form.precio_unitario) return alert('Ingresa el precio unitario con IVA')
    if (form.tipo === 'salida' && !form.es_garantia && form.origen !== 'movimiento' && !form.placa.trim()) return alert('La placa es obligatoria para salidas normales')

    setSaving(true)
    const payload = {
      taller_id:   form.taller_id,
      sku_id:      form.sku_id,
      tipo:        form.tipo,
      cantidad:    parseInt(form.cantidad),
      notas:       form.notas || null,
      usuario_id:  perfil?.id,
      fecha:       new Date().toISOString().split('T')[0],
      origen:      form.tipo === 'entrada' ? form.origen : null,
      marca:       form.tipo === 'entrada' && form.marca.trim() ? form.marca.trim() : null,
      placa:       form.tipo === 'salida' && !form.es_garantia ? form.placa.trim().toUpperCase() : null,
      es_garantia: form.tipo === 'salida' ? form.es_garantia : false,
      fuente:      'manual',
      estado_aprobacion: 'aprobado',
      appointment_id: (form.tipo==='salida' && !form.es_garantia && form.appointment_id.trim())
        ? form.appointment_id.trim() : null,
      // Entrada de compra: vincular OC y proveedor, sin UUID
      ...(form.tipo === 'entrada' && form.origen === 'compra' && {
        proveedor_id:    form.proveedor_id || null,
        precio_unitario: parseFloat(form.precio_unitario) || null,
        precio_total:    totalCalc() || null,
        pedido_id:       form.pedido_id || null,
      }),
      ...(form.tipo === 'entrada' && form.origen === 'movimiento' && {
        taller_origen_id: form.taller_origen_id || null,
      }),
    }

    const { error } = await supabase.from('movimientos').insert(payload)
    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
    setModal(false); setForm(initForm); await load(); setSaving(false)
  }

  async function handleAprobacion(mov, accion) {
    const { error } = await supabase.from('movimientos').update({
      estado_aprobacion: accion,
      aprobado_por:      perfil?.id,
      fecha_aprobacion:  new Date().toISOString(),
    }).eq('id', mov.id)
    if (error) alert('Error: ' + error.message)
    setConfirmApr(null); load()
  }

  async function handleDelete(id) {
    await supabase.from('movimientos').delete().eq('id', id)
    setConfirmDel(null); load()
  }

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:1400 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Kardex de movimientos</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>
            {movs.length} registros
            {pendientesCount > 0 && (
              <span style={{ marginLeft:8, background:'#FEF9C3', color:'#854D0E', padding:'1px 8px', borderRadius:20, fontSize:10, fontWeight:500 }}>
                ⏳ {pendientesCount} pendiente{pendientesCount>1?'s':''} de aprobación
              </span>
            )}
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setModal(true)}
            style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
            + Nuevo movimiento
          </button>
        )}
        {isVisor && <span style={{ fontSize:11, color:'#3B6D11', background:'#EAF3DE', padding:'5px 12px', borderRadius:8 }}>👁 Solo lectura</span>}
      </div>

      {/* ── Filtros ── */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10,
        padding:'10px 14px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Taller</div>
          <select value={fTaller} onChange={e=>setFTaller(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:160 }}>
            <option value="">Todos los talleres</option>
            {talleres.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Proveedor</div>
          <select value={fProveedor} onChange={e=>setFProveedor(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:140 }}>
            <option value="">Todos</option>
            {proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Tipo</div>
          <select value={fTipo} onChange={e=>setFTipo(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:110 }}>
            <option value="">Todos</option>
            <option value="entrada">▲ Entrada</option>
            <option value="salida">▼ Salida</option>
            <option value="ajuste">● Ajuste</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:'#888', fontWeight:500, marginBottom:3 }}>Origen</div>
          <select value={fOrigen} onChange={e=>setFOrigen(e.target.value)}
            style={{ padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:130 }}>
            <option value="">Todos</option>
            <option value="compra">Compra</option>
            <option value="movimiento">Movimiento</option>
            <option value="garantia">Garantía</option>
            <option value="cascos">Cascos</option>
          </select>
        </div>
        {isAdmin && pendientesCount > 0 && (
          <button onClick={() => setFPendiente(p=>!p)}
            style={{ padding:'5px 12px', borderRadius:7, fontSize:11, cursor:'pointer', fontWeight:500,
              border:`1.5px solid ${fPendiente?'#854D0E':'#ccc'}`,
              background:fPendiente?'#FEF9C3':'white', color:fPendiente?'#854D0E':'#666' }}>
            ⏳ {fPendiente?'Mostrando':'Ver'} pendientes ({pendientesCount})
          </button>
        )}
        <button onClick={() => { setFTaller(''); setFProveedor(''); setFTipo(''); setFOrigen(''); setFPendiente(false) }}
          style={{ padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, background:'white', cursor:'pointer', alignSelf:'flex-end' }}>
          Limpiar
        </button>
        {(fTaller||fProveedor||fTipo||fOrigen||fPendiente) && (
          <span style={{ fontSize:11, color:'#185FA5', alignSelf:'flex-end', marginLeft:'auto' }}>
            {movsFiltrados.length} de {movs.length}
          </span>
        )}
      </div>

      {/* ── Tabla ── */}
      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Fecha','Tipo','Fuente','Origen','Taller','Ciudad','SKU','Qty',
                  'OC vinculada','Appt. ID','Marca','Placa / Info','Proveedor',
                  'P. Unit.','Total','Estado','Registró',
                  ...(isAdmin?['Acc.']:[])
                ].map(h=>(
                  <th key={h} style={ths}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movsFiltrados.length === 0 && (
                <tr><td colSpan={18} style={{ padding:32, textAlign:'center', color:'#aaa', fontSize:13 }}>
                  {movs.length === 0 ? 'No hay movimientos registrados' : 'Sin resultados con los filtros aplicados'}
                </td></tr>
              )}
              {movsFiltrados.map(m => {
                const tc   = TIPO_CFG[m.tipo] ?? TIPO_CFG.ajuste
                const rc   = REGIONES[m.talleres?.region] ?? {}
                const oc   = ORIGEN_CFG[m.origen] ?? null
                const esSistema = m.fuente === 'sistema'
                const eapcfg = esSistema ? (ESTADO_APR_CFG[m.estado_aprobacion] ?? ESTADO_APR_CFG.pendiente) : null

                return (
                  <tr key={m.id} style={{ background: esSistema && m.estado_aprobacion==='pendiente' ? '#FFFEF0' : 'white' }}>
                    <td style={tds}>{m.fecha}</td>
                    <td style={tds}><span style={{ color:tc.color, fontWeight:500 }}>{tc.icon} {m.tipo}</span></td>
                    <td style={tds}>
                      {esSistema
                        ? <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:'#E8EAFF', color:'#3730A3', fontWeight:500 }}>Sistema</span>
                        : <span style={{ color:'#ccc', fontSize:10 }}>—</span>}
                    </td>
                    <td style={tds}>
                      {oc
                        ? <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:oc.bg, color:oc.color, fontWeight:500 }}>{oc.label}</span>
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

                    {/* OC vinculada */}
                    <td style={tds}>
                      {m.pedidos?.numero_oc
                        ? <span style={{ fontSize:11, fontWeight:500, color:'#1a4f8a', background:'#E6F1FB', padding:'2px 8px', borderRadius:20 }}>
                            OC-{m.pedidos.numero_oc}
                          </span>
                        : <span style={{ color:'#ccc' }}>—</span>}
                    </td>

                    {/* Appointment ID */}
                    <td style={tds}>
                      {m.appointment_id
                        ? <span style={{ fontFamily:'monospace', fontSize:10, background:'#F1EFE8', padding:'2px 6px', borderRadius:5 }}>
                            {m.appointment_id}
                          </span>
                        : <span style={{ color:'#ccc' }}>—</span>}
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
                      {m.tipo === 'salida' ? (
                        costoMap[`${m.taller_id}_${m.sku_id}`]
                          ? <div>
                              <div style={{fontWeight:500}}>${Number(costoMap[`${m.taller_id}_${m.sku_id}`]).toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
                              <div style={{fontSize:9, color:'#888'}}>costo prom.</div>
                            </div>
                          : <span style={{ color:'#ccc' }}>—</span>
                      ) : m.precio_unitario
                        ? `$${Number(m.precio_unitario).toLocaleString('es-MX')}`
                        : <span style={{ color:'#ccc' }}>—</span>}
                    </td>
                    <td style={{ ...tds, textAlign:'right' }}>
                      {m.tipo === 'salida' ? (
                        costoMap[`${m.taller_id}_${m.sku_id}`]
                          ? <span style={{color:'#A32D2D', fontWeight:500}}>
                              -${(Number(costoMap[`${m.taller_id}_${m.sku_id}`]) * m.cantidad).toLocaleString('es-MX',{minimumFractionDigits:2})}
                            </span>
                          : <span style={{ color:'#ccc' }}>—</span>
                      ) : m.precio_total
                        ? `$${Number(m.precio_total).toLocaleString('es-MX')}`
                        : <span style={{ color:'#ccc' }}>—</span>}
                    </td>

                    {/* Estado aprobación — solo sistema */}
                    <td style={tds}>
                      {eapcfg ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:500, background:eapcfg.bg, color:eapcfg.color, whiteSpace:'nowrap' }}>
                            {eapcfg.label}
                          </span>
                          {canWrite && m.estado_aprobacion === 'pendiente' && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button onClick={() => setConfirmApr({ mov:m, accion:'aprobado' })}
                                style={{ fontSize:10, padding:'2px 7px', border:'none', borderRadius:5, cursor:'pointer', background:'#DCFCE7', color:'#166534', fontWeight:500 }}>
                                Aprobar
                              </button>
                              <button onClick={() => setConfirmApr({ mov:m, accion:'rechazado' })}
                                style={{ fontSize:10, padding:'2px 7px', border:'none', borderRadius:5, cursor:'pointer', background:'#FEE2E2', color:'#991B1B', fontWeight:500 }}>
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color:'#ccc', fontSize:10 }}>—</span>
                      )}
                    </td>

                    <td style={{ ...tds, color:'#aaa', fontSize:11 }}>{m.nombre_usuario ?? '—'}</td>
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
          <div style={{ background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:520, maxHeight:'92vh', overflowY:'auto' }}>
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

            {/* Origen entrada */}
            {form.tipo === 'entrada' && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#666', marginBottom:6, fontWeight:500 }}>Origen de la entrada *</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {ORIGENES_ENTRADA.map(({ k, l, desc }) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, origen:k, sku_id:'', pedido_id:'' }))}
                      style={{ padding:'8px 10px', borderRadius:8, fontSize:11, cursor:'pointer', textAlign:'left',
                        border:`1.5px solid ${form.origen===k?'#1a4f8a':'#e0dfd8'}`,
                        background:form.origen===k?'#E6F1FB':'white', color:form.origen===k?'#0C447C':'#444' }}>
                      <div style={{ fontWeight:500 }}>{l}</div>
                      <div style={{ fontSize:10, color:form.origen===k?'#185FA5':'#888', marginTop:2 }}>{desc}</div>
                    </button>
                  ))}
                </div>
                {form.origen === 'cascos' && (
                  <div style={{ marginTop:8, background:'#F1EFE8', borderRadius:7, padding:'7px 10px', fontSize:11, color:'#5F5E5A' }}>
                    Solo SKUs de tipo <strong>casco bateria</strong>. No requiere OC ni precio.
                  </div>
                )}
              </div>
            )}

            {/* Salida: garantía / placa / appointment */}
            {form.tipo === 'salida' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:10,
                  padding:'8px 12px', background:form.es_garantia?'#FAEEDA':'#f9f9f7',
                  borderRadius:8, border:`1px solid ${form.es_garantia?'#FAC775':'#e0dfd8'}` }}>
                  <input type="checkbox" checked={form.es_garantia}
                    onChange={e => setForm(f => ({ ...f, es_garantia:e.target.checked, placa:'', appointment_id:'' }))} />
                  <div>
                    <span style={{ fontWeight:500, fontSize:12, color:form.es_garantia?'#633806':'#444' }}>Salida de garantía</span>
                    <div style={{ fontSize:10, color:'#888', marginTop:1 }}>
                      {form.es_garantia ? 'Proveedor recoge la pieza — sin placa' : 'Marca si el proveedor recoge una garantía'}
                    </div>
                  </div>
                </label>
                {!form.es_garantia && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={lbl}>Placa *</label>
                      <input style={{ ...inp, textTransform:'uppercase' }} value={form.placa}
                        onChange={e => setForm(f => ({ ...f, placa:e.target.value.toUpperCase() }))}
                        placeholder="ej. ABC-123-D" />
                    </div>
                    <div>
                      <label style={lbl}>Appointment ID <span style={{ color:'#aaa', fontSize:10 }}>(opcional)</span></label>
                      <input style={inp} value={form.appointment_id}
                        onChange={e => setForm(f => ({ ...f, appointment_id:e.target.value }))}
                        placeholder="ej. APT-2026-03-25-78432" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Taller + SKU */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={lbl}>Taller *</label>
                <select style={inp} value={form.taller_id} onChange={e => {
                  const newTallerId = e.target.value
                  setForm(f => {
                    if (f.tipo === 'entrada' && f.origen === 'compra' && f.sku_id) {
                      const taller = talleres.find(t => t.id === newTallerId)
                      const pc = taller ? preciosCiudad.find(p => p.sku_id === f.sku_id && p.region === taller.region) : null
                      return { ...f, taller_id: newTallerId, precio_unitario: pc ? pc.precio_iva : f.precio_unitario }
                    }
                    return { ...f, taller_id: newTallerId }
                  })
                }}>
                  <option value="">Seleccionar...</option>
                  {talleres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>SKU *
                  {form.tipo==='entrada' && form.origen==='cascos' && (
                    <span style={{ color:'#854F0B', fontSize:10, marginLeft:4 }}>(solo cascos)</span>
                  )}
                </label>
                <select style={inp} value={form.sku_id} onChange={e => {
                  const newSkuId = e.target.value
                  const precioLista = getPrecioLista(newSkuId)
                  setForm(f => ({ ...f, sku_id:newSkuId, precio_unitario: f.tipo==='entrada' && f.origen==='compra' ? (precioLista || f.precio_unitario) : f.precio_unitario }))
                }}>
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

            {form.tipo === 'entrada' && form.origen !== 'cascos' && (
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Marca <span style={{ color:'#aaa', fontSize:10 }}>(opcional)</span></label>
                <input style={inp} value={form.marca}
                  onChange={e => setForm(f => ({ ...f, marca:e.target.value }))}
                  placeholder="ej. Bridgestone, Optima, Yuasa..." />
              </div>
            )}

            {form.tipo==='entrada' && form.origen==='movimiento' && (
              <div style={{ marginBottom:10 }}>
                <label style={lbl}>Taller de origen <span style={{ color:'#888', fontSize:10 }}>(salida automática)</span></label>
                <select style={inp} value={form.taller_origen_id}
                  onChange={e => setForm(f => ({ ...f, taller_origen_id:e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {talleres.filter(t => t.id !== form.taller_id).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            )}

            {/* ── ENTRADA COMPRA: OC + proveedor + precio — SIN UUID ── */}
            {form.tipo==='entrada' && form.origen==='compra' && (
              <div style={{ background:'#f9f9f7', border:'0.5px solid #e0dfd8', borderRadius:9, padding:12, marginBottom:10 }}>
                <p style={{ fontSize:11, fontWeight:500, marginBottom:10 }}>Datos de la entrada</p>

                {/* Selector de OC */}
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>
                    Orden de Compra <span style={{ color:'#aaa', fontSize:10 }}>(opcional — vincula esta entrada a una OC)</span>
                  </label>
                  <select style={{ ...inp, border: form.pedido_id?'1.5px solid #86EFAC':'0.5px solid #ccc' }}
                    value={form.pedido_id} onChange={e => onSelectOC(e.target.value)}>
                    <option value="">— Sin vincular a OC —</option>
                    {(form.taller_id && form.sku_id ? ocsFiltradas() : pedidosOC).map(oc => (
                      <option key={oc.id} value={oc.id}>
                        OC-{oc.numero_oc} · {oc.proveedores?.nombre ?? ''}
                      </option>
                    ))}
                  </select>
                  {form.taller_id && form.sku_id && ocsFiltradas().length === 0 && (
                    <p style={{ fontSize:10, color:'#888', marginTop:3 }}>
                      No hay OCs aprobadas/enviadas que incluyan este taller y SKU.
                    </p>
                  )}
                  {form.pedido_id && (
                    <p style={{ fontSize:10, color:'#166534', marginTop:3 }}>
                      ✅ Esta entrada quedará vinculada a la OC seleccionada para rastrear la recepción
                    </p>
                  )}
                </div>

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
                  <div style={{ background:'#EAF3DE', borderRadius:7, padding:'7px 10px', fontSize:12 }}>
                    <span style={{ color:'#3B6D11', fontWeight:500 }}>
                      Total: ${totalCalc().toLocaleString('es-MX')} MXN
                    </span>
                    <span style={{ color:'#888', fontSize:10, marginLeft:8 }}>
                      ({form.cantidad} × ${parseFloat(form.precio_unitario||0).toLocaleString('es-MX')})
                    </span>
                  </div>
                )}
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

      {/* ── Modal aprobar/rechazar sistema ── */}
      {confirmApr && canWrite && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:12, padding:24, width:'100%', maxWidth:400 }}>
            <p style={{ fontWeight:500, marginBottom:8 }}>
              {confirmApr.accion==='aprobado'?'✅ Aprobar':'❌ Rechazar'} movimiento del sistema
            </p>
            <p style={{ fontSize:12, color:'#888', marginBottom:14 }}>
              {confirmApr.mov.skus?.codigo} · {confirmApr.mov.talleres?.nombre} · {confirmApr.mov.fecha}
              {confirmApr.mov.appointment_id && (
                <span style={{ display:'block', fontFamily:'monospace', fontSize:11, marginTop:4 }}>
                  Appt: {confirmApr.mov.appointment_id}
                </span>
              )}
            </p>
            {confirmApr.accion==='aprobado' ? (
              <div style={{ background:'#EAF3DE', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#166534', marginBottom:16 }}>
                ✅ Se descontarán <strong>{confirmApr.mov.cantidad} unidad{confirmApr.mov.cantidad>1?'es':''}</strong> del inventario.
              </div>
            ) : (
              <div style={{ background:'#FEE2E2', borderRadius:7, padding:'8px 10px', fontSize:11, color:'#991B1B', marginBottom:16 }}>
                ❌ El inventario no cambiará.
              </div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmApr(null)}
                style={{ padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={() => handleAprobacion(confirmApr.mov, confirmApr.accion)}
                style={{ background:confirmApr.accion==='aprobado'?'#166534':'#991B1B', color:'white', border:'none', borderRadius:7, padding:'5px 13px', fontSize:12, cursor:'pointer' }}>
                {confirmApr.accion==='aprobado'?'Sí, aprobar':'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminación ── */}
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
