import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const ROL_CFG = {
  admin:     { bg:'#FCEBEB', color:'#791F1F' },
  staff:     { bg:'#E6F1FB', color:'#0C447C' },
  proveedor: { bg:'#FAEEDA', color:'#633806' },
  visor:     { bg:'#EAF3DE', color:'#27500A' },
}
const ROL_DESC = {
  admin:     'Acceso total, gestiona usuarios, tipos, SKUs y proveedores',
  staff:     'Ve inventario y kardex, valida conteos, genera pedidos',
  proveedor: 'Solo registra conteos y sube evidencia física',
  visor:     'Solo lectura — puede ver todo pero no modificar nada',
}

const inp = { width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }
const lbl = { fontSize:11, color:'#666', display:'block', marginBottom:3 }
const btnPrimary = { background:'#1a4f8a', color:'white', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer' }
const btnSec = { padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }
const ths = { padding:'7px 12px', fontWeight:500, fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3', textAlign:'left' }
const tds = { padding:'7px 12px', borderBottom:'0.5px solid #f0efe8', fontSize:12 }

const TABS = ['Usuarios','Tipos de refacción','SKUs','Proveedores']

export default function Admin() {
  const [tab,      setTab]      = useState('Usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [tipos,    setTipos]    = useState([])
  const [skus,     setSkus]     = useState([])
  const [proveedores,setProveedores] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)
  const [form,     setForm]     = useState({})
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:u },{ data:t },{ data:s },{ data:p }] = await Promise.all([
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('tipos_refaccion').select('*').order('nombre'),
      supabase.from('skus').select('*, tipos_refaccion(nombre)').order('codigo'),
      supabase.from('proveedores').select('*').order('nombre'),
    ])
    setUsuarios(u??[]); setTipos(t??[]); setSkus(s??[]); setProveedores(p??[])
    setLoading(false)
  }

  async function cambiarRol(id, rol) {
    await supabase.from('perfiles').update({ rol }).eq('id', id); load()
  }
  async function guardarTipo() {
    if (!form.nombre?.trim()) return alert('Ingresa el nombre')
    setSaving(true)
    if (form.id) await supabase.from('tipos_refaccion').update({ nombre:form.nombre }).eq('id',form.id)
    else await supabase.from('tipos_refaccion').insert({ nombre:form.nombre })
    setSaving(false); setModal(null); setForm({}); load()
  }
  async function guardarSKU() {
    if (!form.codigo?.trim() || !form.tipo_id) return alert('Completa código y tipo')
    setSaving(true)
    const payload = { codigo:form.codigo.trim(), tipo_id:form.tipo_id,
      tipo:tipos.find(t=>t.id===form.tipo_id)?.nombre??'',
      precio:parseFloat(form.precio)||0, stock_min:parseInt(form.stock_min)||2, activo:true }
    if (form.id) await supabase.from('skus').update(payload).eq('id',form.id)
    else await supabase.from('skus').insert(payload)
    setSaving(false); setModal(null); setForm({}); load()
  }
  async function guardarProveedor() {
    if (!form.nombre?.trim()) return alert('Ingresa el nombre')
    setSaving(true)
    const payload = { nombre:form.nombre.trim(), rfc:form.rfc||null, email:form.email||null }
    if (form.id) await supabase.from('proveedores').update(payload).eq('id',form.id)
    else await supabase.from('proveedores').insert(payload)
    setSaving(false); setModal(null); setForm({}); load()
  }
  async function toggleActivo(tabla, id, activo) {
    await supabase.from(tabla).update({ activo:!activo }).eq('id',id); load()
  }

  if (loading) return <div style={{ padding:20, color:'#aaa' }}>Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:900 }}>
      <h1 style={{ fontSize:17, fontWeight:500, marginBottom:16 }}>Administración</h1>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'0.5px solid #e0dfd8' }}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ padding:'7px 16px', borderRadius:'8px 8px 0 0', fontSize:12, cursor:'pointer', border:'0.5px solid',
              borderColor:tab===t?'#e0dfd8':'transparent', borderBottom:tab===t?'0.5px solid white':'none',
              background:tab===t?'white':'transparent', fontWeight:tab===t?500:400,
              color:tab===t?'#1a1a1a':'#888', marginBottom:tab===t?-1:0 }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── USUARIOS ── */}
      {tab==='Usuarios' && (
        <>
          {/* Cards de roles */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
            {Object.entries(ROL_CFG).map(([rol,cfg])=>(
              <div key={rol} style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:9, padding:10 }}>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, fontWeight:500, display:'inline-block', marginBottom:5 }}>{rol}</span>
                <p style={{ fontSize:10, color:'#888', lineHeight:1.5 }}>{ROL_DESC[rol]}</p>
              </div>
            ))}
          </div>
          <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr><th style={ths}>Nombre</th><th style={ths}>Email</th><th style={ths}>Rol actual</th><th style={ths}>Cambiar rol</th></tr></thead>
              <tbody>
                {usuarios.map(u=>{
                  const cfg=ROL_CFG[u.rol]??ROL_CFG.staff
                  const ini=u.nombre?.split(' ').map(n=>n[0]).slice(0,2).join('')??'?'
                  return (
                    <tr key={u.id}>
                      <td style={tds}><div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:'#E6F1FB', color:'#0C447C', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, flexShrink:0 }}>{ini}</div>
                        <span style={{ fontWeight:500 }}>{u.nombre}</span>
                      </div></td>
                      <td style={{ ...tds, color:'#888' }}>{u.email}</td>
                      <td style={tds}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color, fontWeight:500 }}>{u.rol}</span></td>
                      <td style={tds}>
                        <select value={u.rol} onChange={e=>cambiarRol(u.id,e.target.value)}
                          style={{ padding:'4px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, background:'white', cursor:'pointer' }}>
                          <option value="admin">admin</option>
                          <option value="staff">staff</option>
                          <option value="proveedor">proveedor</option>
                          <option value="visor">visor (solo lectura)</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10, background:'#E6F1FB', borderRadius:8, padding:'9px 12px', fontSize:11, color:'#0C447C' }}>
            Para crear usuarios nuevos: Supabase → Authentication → Users → Add user. El perfil se crea automáticamente con rol "staff".
          </div>
        </>
      )}

      {/* ── TIPOS ── */}
      {tab==='Tipos de refacción' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <button onClick={()=>{setForm({});setModal('tipo')}} style={btnPrimary}>+ Nuevo tipo</button>
          </div>
          <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr><th style={ths}>Nombre</th><th style={ths}>Estado</th><th style={ths}>Acciones</th></tr></thead>
              <tbody>
                {tipos.map(t=>(
                  <tr key={t.id}>
                    <td style={{ ...tds, fontWeight:500 }}>{t.nombre}</td>
                    <td style={tds}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:t.activo?'#EAF3DE':'#F1EFE8', color:t.activo?'#27500A':'#888', fontWeight:500 }}>{t.activo?'Activo':'Inactivo'}</span></td>
                    <td style={tds}><div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>{setForm({...t});setModal('tipo')}} style={{ ...btnSec, fontSize:11, padding:'3px 10px' }}>Editar</button>
                      <button onClick={()=>toggleActivo('tipos_refaccion',t.id,t.activo)} style={{ ...btnSec, fontSize:11, padding:'3px 10px', color:t.activo?'#A32D2D':'#3B6D11' }}>{t.activo?'Desactivar':'Activar'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── SKUs ── */}
      {tab==='SKUs' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <button onClick={()=>{setForm({});setModal('sku')}} style={btnPrimary}>+ Nuevo SKU</button>
          </div>
          <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr><th style={ths}>Código</th><th style={ths}>Tipo</th><th style={ths}>Precio MXN</th><th style={ths}>Stock mín.</th><th style={ths}>Estado</th><th style={ths}>Acciones</th></tr></thead>
              <tbody>
                {skus.map(s=>(
                  <tr key={s.id}>
                    <td style={{ ...tds, fontFamily:'monospace', fontWeight:500 }}>{s.codigo}</td>
                    <td style={tds}>{s.tipos_refaccion?.nombre??s.tipo}</td>
                    <td style={{ ...tds, textAlign:'right' }}>${Number(s.precio).toLocaleString('es-MX')}</td>
                    <td style={{ ...tds, textAlign:'center' }}>{s.stock_min}</td>
                    <td style={tds}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:s.activo?'#EAF3DE':'#F1EFE8', color:s.activo?'#27500A':'#888', fontWeight:500 }}>{s.activo?'Activo':'Inactivo'}</span></td>
                    <td style={tds}><div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>{setForm({...s,tipo_id:s.tipo_id});setModal('sku')}} style={{ ...btnSec, fontSize:11, padding:'3px 10px' }}>Editar</button>
                      <button onClick={()=>toggleActivo('skus',s.id,s.activo)} style={{ ...btnSec, fontSize:11, padding:'3px 10px', color:s.activo?'#A32D2D':'#3B6D11' }}>{s.activo?'Desactivar':'Activar'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PROVEEDORES ── */}
      {tab==='Proveedores' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <button onClick={()=>{setForm({});setModal('proveedor')}} style={btnPrimary}>+ Nuevo proveedor</button>
          </div>
          <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr><th style={ths}>Nombre</th><th style={ths}>RFC</th><th style={ths}>Email</th><th style={ths}>Estado</th><th style={ths}>Acciones</th></tr></thead>
              <tbody>
                {proveedores.map(p=>(
                  <tr key={p.id}>
                    <td style={{ ...tds, fontWeight:500 }}>{p.nombre}</td>
                    <td style={{ ...tds, fontFamily:'monospace', fontSize:11 }}>{p.rfc??'—'}</td>
                    <td style={{ ...tds, color:'#888' }}>{p.email??'—'}</td>
                    <td style={tds}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:p.activo?'#EAF3DE':'#F1EFE8', color:p.activo?'#27500A':'#888', fontWeight:500 }}>{p.activo?'Activo':'Inactivo'}</span></td>
                    <td style={tds}><div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>{setForm({...p});setModal('proveedor')}} style={{ ...btnSec, fontSize:11, padding:'3px 10px' }}>Editar</button>
                      <button onClick={()=>toggleActivo('proveedores',p.id,p.activo)} style={{ ...btnSec, fontSize:11, padding:'3px 10px', color:p.activo?'#A32D2D':'#3B6D11' }}>{p.activo?'Desactivar':'Activar'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Modales ── */}
      {modal==='tipo' && (
        <Modal title={form.id?'Editar tipo':'Nuevo tipo'} onClose={()=>{setModal(null);setForm({})}}>
          <div style={{ marginBottom:14 }}><label style={lbl}>Nombre *</label><input style={inp} value={form.nombre??''} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="ej. casco bateria" /></div>
          <Footer onCancel={()=>{setModal(null);setForm({})}} onSave={guardarTipo} saving={saving} />
        </Modal>
      )}
      {modal==='sku' && (
        <Modal title={form.id?'Editar SKU':'Nuevo SKU'} onClose={()=>{setModal(null);setForm({})}}>
          <div style={{ marginBottom:10 }}><label style={lbl}>Código *</label><input style={inp} value={form.codigo??''} onChange={e=>setForm(f=>({...f,codigo:e.target.value}))} placeholder="ej. 175/65R14" /></div>
          <div style={{ marginBottom:10 }}><label style={lbl}>Tipo *</label>
            <select style={inp} value={form.tipo_id??''} onChange={e=>setForm(f=>({...f,tipo_id:e.target.value}))}>
              <option value="">Seleccionar...</option>
              {tipos.filter(t=>t.activo).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div><label style={lbl}>Precio (MXN)</label><input type="number" style={inp} value={form.precio??''} onChange={e=>setForm(f=>({...f,precio:e.target.value}))} /></div>
            <div><label style={lbl}>Stock mínimo</label><input type="number" style={inp} value={form.stock_min??2} onChange={e=>setForm(f=>({...f,stock_min:e.target.value}))} /></div>
          </div>
          <Footer onCancel={()=>{setModal(null);setForm({})}} onSave={guardarSKU} saving={saving} />
        </Modal>
      )}
      {modal==='proveedor' && (
        <Modal title={form.id?'Editar proveedor':'Nuevo proveedor'} onClose={()=>{setModal(null);setForm({})}}>
          <div style={{ marginBottom:10 }}><label style={lbl}>Nombre *</label><input style={inp} value={form.nombre??''} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} /></div>
          <div style={{ marginBottom:10 }}><label style={lbl}>RFC</label><input style={inp} value={form.rfc??''} onChange={e=>setForm(f=>({...f,rfc:e.target.value}))} placeholder="XXXX000000XXX" /></div>
          <div style={{ marginBottom:14 }}><label style={lbl}>Email</label><input type="email" style={inp} value={form.email??''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
          <Footer onCancel={()=>{setModal(null);setForm({})}} onSave={guardarProveedor} saving={saving} />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
      <div style={{ background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <p style={{ fontWeight:500 }}>{title}</p>
          <button onClick={onClose} style={{ background:'none', border:'0.5px solid #ccc', borderRadius:7, padding:'3px 10px', cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Footer({ onCancel, onSave, saving }) {
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
      <button onClick={onCancel} style={{ padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', opacity:saving?0.7:1 }}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  )
}
