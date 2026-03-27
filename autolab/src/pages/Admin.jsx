import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { REGIONES, CLIENTES } from '../lib/inventario'

const inp  = { padding:'6px 9px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, width:'100%' }
const lbl  = { fontSize:11, color:'#666', display:'block', marginBottom:3 }
const btn  = (c='#1a4f8a') => ({ background:c, color:'white', border:'none', borderRadius:7, padding:'5px 13px', fontSize:11, cursor:'pointer', fontWeight:500 })
const th   = { padding:'7px 10px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8' }
const td   = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }

const TABS = ['Usuarios','Talleres','Tipos de refacción','SKUs','Proveedores','Modelos']

export default function Admin() {
  const { perfil } = useAuth()
  if (perfil?.rol !== 'admin') return <div style={{padding:20, color:'#aaa'}}>Acceso solo para administradores.</div>

  const [tab, setTab] = useState('Usuarios')
  return (
    <div style={{padding:20, maxWidth:1100}}>
      <h1 style={{fontSize:17, fontWeight:500, marginBottom:14}}>Administración</h1>
      <div style={{display:'flex', gap:4, marginBottom:20, flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'6px 14px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:tab===t?500:400,
              border:`1.5px solid ${tab===t?'#1a4f8a':'#e0dfd8'}`,
              background:tab===t?'#E6F1FB':'white', color:tab===t?'#0C447C':'#666'}}>
            {t}
          </button>
        ))}
      </div>
      {tab==='Usuarios'           && <TabUsuarios />}
      {tab==='Talleres'           && <TabTalleres />}
      {tab==='Tipos de refacción' && <TabTipos />}
      {tab==='SKUs'               && <TabSkus />}
      {tab==='Proveedores'        && <TabProveedores />}
      {tab==='Modelos'             && <TabModelos />}
    </div>
  )
}

// ── TAB: PROVEEDORES ──────────────────────────────────────
function TabProveedores() {
  const [proveedores, setProveedores] = useState([])
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState(null)
  const initForm = { nombre:'', rfc:'', contacto:'', email:'', telefono:'', activo:true }
  const [form, setForm] = useState(initForm)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    setProveedores(data ?? [])
  }

  function abrir(p = null) {
    setForm(p
      ? { nombre:p.nombre??'', rfc:p.rfc??'', contacto:p.contacto??'', email:p.email??'', telefono:p.telefono??'', activo:p.activo??true }
      : initForm
    )
    setEditing(p?.id ?? null)
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es requerido'); return }
    setSaving(true)

    const payload = {
      nombre:   form.nombre.trim(),
      rfc:      form.rfc.trim()      || null,
      contacto: form.contacto.trim() || null,
      email:    form.email.trim()    || null,
      telefono: form.telefono.trim() || null,
      activo:   form.activo,
    }

    let error
    if (editing) {
      const res = await supabase.from('proveedores').update(payload).eq('id', editing)
      error = res.error
    } else {
      const res = await supabase.from('proveedores').insert(payload)
      error = res.error
    }

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setModal(false)
      setEditing(null)
      setForm(initForm)
      load()
    }
    setSaving(false)
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <p style={{fontSize:13, color:'#888'}}>{proveedores.filter(p=>p.activo).length} proveedores activos · {proveedores.length} total</p>
        <button onClick={()=>abrir()} style={btn()}>+ Nuevo proveedor</button>
      </div>

      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead><tr>
          <th style={th}>Nombre</th>
          <th style={th}>RFC</th>
          <th style={th}>Contacto</th>
          <th style={th}>Email</th>
          <th style={th}>Teléfono</th>
          <th style={th}>Estado</th>
          <th style={th}>Acciones</th>
        </tr></thead>
        <tbody>
          {proveedores.length === 0 && (
            <tr><td colSpan={7} style={{padding:24, textAlign:'center', color:'#aaa'}}>No hay proveedores registrados</td></tr>
          )}
          {proveedores.map(p => (
            <tr key={p.id} style={{opacity:p.activo?1:0.5}}>
              <td style={{...td, fontWeight:500}}>{p.nombre}</td>
              <td style={{...td, fontFamily:'monospace', fontSize:11}}>{p.rfc ?? <span style={{color:'#ccc'}}>—</span>}</td>
              <td style={td}>{p.contacto ?? <span style={{color:'#ccc'}}>—</span>}</td>
              <td style={{...td, fontSize:11}}>{p.email ?? <span style={{color:'#ccc'}}>—</span>}</td>
              <td style={td}>{p.telefono ?? <span style={{color:'#ccc'}}>—</span>}</td>
              <td style={td}>
                <span style={{padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:500,
                  background:p.activo?'#EAF3DE':'#F1EFE8', color:p.activo?'#166534':'#888'}}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td style={td}>
                <button onClick={()=>abrir(p)} style={{...btn(), padding:'3px 10px', fontSize:10}}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:22, width:'100%', maxWidth:460}}>
            <p style={{fontWeight:500, marginBottom:16}}>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</p>

            <div style={{marginBottom:10}}>
              <label style={lbl}>Nombre *</label>
              <input style={inp} value={form.nombre}
                onChange={e=>setForm(f=>({...f, nombre:e.target.value}))}
                placeholder="Ej: Distribuidora Llantera SA" />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
              <div>
                <label style={lbl}>RFC</label>
                <input style={{...inp, textTransform:'uppercase'}} value={form.rfc}
                  onChange={e=>setForm(f=>({...f, rfc:e.target.value.toUpperCase()}))}
                  placeholder="Ej: DLL900101XX1" />
              </div>
              <div>
                <label style={lbl}>Teléfono</label>
                <input style={inp} value={form.telefono}
                  onChange={e=>setForm(f=>({...f, telefono:e.target.value}))}
                  placeholder="Ej: 55 1234 5678" />
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
              <div>
                <label style={lbl}>Nombre de contacto</label>
                <input style={inp} value={form.contacto}
                  onChange={e=>setForm(f=>({...f, contacto:e.target.value}))}
                  placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label style={lbl}>Email <span style={{color:'#aaa', fontSize:10}}>(para envío de OC)</span></label>
                <input type="email" style={inp} value={form.email}
                  onChange={e=>setForm(f=>({...f, email:e.target.value}))}
                  placeholder="proveedor@empresa.com" />
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={{...lbl, display:'flex', alignItems:'center', gap:7, cursor:'pointer'}}>
                <input type="checkbox" checked={form.activo}
                  onChange={e=>setForm(f=>({...f, activo:e.target.checked}))} />
                Proveedor activo
              </label>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>{ setModal(false); setEditing(null); setForm(initForm) }}
                style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving}
                style={{...btn(), opacity:saving?0.7:1}}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB: TALLERES ──────────────────────────────────────────
function TabTalleres() {
  const [talleres, setTalleres] = useState([])
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editing,  setEditing]  = useState(null)
  const initForm = { nombre:'', region:'cdmx', cliente:'minave', activo:true }
  const [form, setForm] = useState(initForm)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('talleres').select('*').order('region').order('nombre')
    setTalleres(data ?? [])
  }

  function abrir(t = null) {
    setForm(t
      ? { nombre:t.nombre, region:t.region, cliente:t.cliente, activo:t.activo }
      : initForm
    )
    setEditing(t?.id ?? null)
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es requerido'); return }
    setSaving(true)
    let error
    if (editing) {
      const res = await supabase.from('talleres').update({ nombre:form.nombre.trim(), region:form.region, cliente:form.cliente, activo:form.activo }).eq('id', editing)
      error = res.error
    } else {
      const res = await supabase.from('talleres').insert({ nombre:form.nombre.trim(), region:form.region, cliente:form.cliente, activo:form.activo })
      error = res.error
    }
    if (error) alert('Error: ' + error.message)
    else { setModal(false); setEditing(null); setForm(initForm); load() }
    setSaving(false)
  }

  async function toggleActivo(t) {
    await supabase.from('talleres').update({ activo:!t.activo }).eq('id', t.id)
    load()
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <p style={{fontSize:13, color:'#888'}}>{talleres.filter(t=>t.activo).length} activos · {talleres.length} total</p>
        <button onClick={()=>abrir()} style={btn()}>+ Nuevo taller</button>
      </div>

      {Object.entries(REGIONES).map(([regKey, regCfg]) => {
        const grupo = talleres.filter(t => t.region === regKey)
        if (!grupo.length) return null
        return (
          <div key={regKey} style={{marginBottom:20}}>
            <p style={{fontSize:12, fontWeight:500, color:regCfg.color, marginBottom:6, borderBottom:`2px solid ${regCfg.color}`, paddingBottom:4}}>
              {regCfg.label} — {grupo.length} talleres
            </p>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead><tr>
                <th style={th}>Nombre</th><th style={th}>Cliente</th>
                <th style={th}>Ciudad</th><th style={th}>Estado</th><th style={th}>Acciones</th>
              </tr></thead>
              <tbody>
                {grupo.map(t => {
                  const cc = CLIENTES[t.cliente] ?? CLIENTES.ind
                  return (
                    <tr key={t.id} style={{opacity:t.activo?1:0.5}}>
                      <td style={{...td, fontWeight:500}}>{t.nombre}</td>
                      <td style={td}>
                        <span style={{padding:'1px 7px', borderRadius:20, fontSize:10, background:cc.bg, color:cc.color, fontWeight:500}}>
                          {cc.label}
                        </span>
                      </td>
                      <td style={{...td, color:regCfg.color, fontWeight:500}}>{regCfg.label}</td>
                      <td style={td}>
                        <span style={{padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:500,
                          background:t.activo?'#EAF3DE':'#F1EFE8', color:t.activo?'#166534':'#888'}}>
                          {t.activo?'Activo':'Inactivo'}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{display:'flex', gap:5}}>
                          <button onClick={()=>abrir(t)} style={{...btn(), padding:'3px 10px', fontSize:10}}>Editar</button>
                          <button onClick={()=>toggleActivo(t)}
                            style={{padding:'3px 10px', fontSize:10, border:'0.5px solid #ccc', borderRadius:7, cursor:'pointer', background:'white'}}>
                            {t.activo?'Desactivar':'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:22, width:'100%', maxWidth:420}}>
            <p style={{fontWeight:500, marginBottom:14}}>{editing?'Editar taller':'Nuevo taller'}</p>
            <div style={{marginBottom:10}}>
              <label style={lbl}>Nombre *</label>
              <input style={inp} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: AARMI SANTA FE"/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
              <div>
                <label style={lbl}>Ciudad *</label>
                <select style={inp} value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value}))}>
                  {Object.entries(REGIONES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cliente *</label>
                <select style={inp} value={form.cliente} onChange={e=>setForm(f=>({...f,cliente:e.target.value}))}>
                  {Object.entries(CLIENTES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{...lbl, display:'flex', alignItems:'center', gap:7, cursor:'pointer'}}>
                <input type="checkbox" checked={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.checked}))}/>
                Taller activo
              </label>
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>{setModal(false);setEditing(null);setForm(initForm)}}
                style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{...btn(), opacity:saving?0.7:1}}>
                {saving?'Guardando...':'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB: USUARIOS ─────────────────────────────────────────
function TabUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState({ nombre:'', rol:'staff' })

  useEffect(()=>{ load() },[])

  async function load() {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setUsuarios(data??[]); setLoading(false)
  }

  function abrirEditar(u) { setForm({ nombre:u.nombre, rol:u.rol }); setEditing(u.id); setModal(true) }

  async function guardar() {
    if (editing) {
      const { error } = await supabase.from('perfiles').update({ rol:form.rol }).eq('id', editing)
      if (error) { alert('Error: ' + error.message); return }
    }
    setModal(false); load()
  }

  if (loading) return <div style={{color:'#aaa', fontSize:13}}>Cargando...</div>

  const ROLES = { admin:'Administrador', staff:'Staff', proveedor:'Proveedor', visor:'Visor' }
  const ROL_COLORS = { admin:'#FCEBEB', staff:'#E6F1FB', proveedor:'#FAEEDA', visor:'#F1EFE8' }
  const ROL_TC     = { admin:'#A32D2D', staff:'#0C447C', proveedor:'#633806', visor:'#5F5E5A' }

  return (
    <div>
      <p style={{fontSize:13, color:'#888', marginBottom:14}}>{usuarios.length} usuarios registrados</p>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead><tr>
          <th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Rol</th><th style={th}>Acciones</th>
        </tr></thead>
        <tbody>
          {usuarios.map(u=>(
            <tr key={u.id}>
              <td style={{...td, fontWeight:500}}>{u.nombre}</td>
              <td style={{...td, color:'#888'}}>{u.email}</td>
              <td style={td}>
                <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500,
                  background:ROL_COLORS[u.rol]??'#F1EFE8', color:ROL_TC[u.rol]??'#555'}}>
                  {ROLES[u.rol]??u.rol}
                </span>
              </td>
              <td style={td}>
                <button onClick={()=>abrirEditar(u)} style={{...btn(), padding:'3px 10px', fontSize:10}}>Editar rol</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:22, width:'100%', maxWidth:340}}>
            <p style={{fontWeight:500, marginBottom:14}}>Cambiar rol — {form.nombre}</p>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Rol</label>
              <select style={inp} value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value}))}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(false)} style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>Cancelar</button>
              <button onClick={guardar} style={btn()}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB: TIPOS ────────────────────────────────────────────
function TabTipos() {
  const [tipos,   setTipos]   = useState([])
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState({ nombre:'' })

  useEffect(()=>{ load() },[])
  async function load() {
    const { data } = await supabase.from('tipos_refaccion').select('*').order('nombre')
    setTipos(data??[])
  }
  function abrir(t=null) { setForm({ nombre:t?.nombre??'' }); setEditing(t?.id??null); setModal(true) }
  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es requerido'); return }
    setSaving(true)
    let error
    if (editing) {
      const res = await supabase.from('tipos_refaccion').update({ nombre:form.nombre.trim() }).eq('id', editing)
      error = res.error
    } else {
      const res = await supabase.from('tipos_refaccion').insert({ nombre:form.nombre.trim() })
      error = res.error
    }
    if (error) alert('Error: ' + error.message)
    else { setModal(false); setEditing(null); setForm({nombre:''}); load() }
    setSaving(false)
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:14}}>
        <p style={{fontSize:13, color:'#888'}}>{tipos.length} tipos registrados</p>
        <button onClick={()=>abrir()} style={btn()}>+ Nuevo tipo</button>
      </div>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead><tr><th style={th}>Nombre</th><th style={th}>Acciones</th></tr></thead>
        <tbody>
          {tipos.map(t=>(
            <tr key={t.id}>
              <td style={{...td, fontWeight:500}}>{t.nombre}</td>
              <td style={td}><button onClick={()=>abrir(t)} style={{...btn(), padding:'3px 10px', fontSize:10}}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:22, width:'100%', maxWidth:340}}>
            <p style={{fontWeight:500, marginBottom:12}}>{editing?'Editar tipo':'Nuevo tipo'}</p>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Nombre *</label>
              <input style={inp} value={form.nombre} onChange={e=>setForm({nombre:e.target.value})} placeholder="Ej: casco bateria"/>
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>{setModal(false);setEditing(null)}} style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{...btn(), opacity:saving?0.7:1}}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB: SKUs ─────────────────────────────────────────────
function TabSkus() {
  const [skus,    setSkus]    = useState([])
  const [tipos,   setTipos]   = useState([])
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState(null)
  const initForm = { codigo:'', tipo_id:'', precio:'', activo:true }
  const [form, setForm] = useState(initForm)

  useEffect(()=>{ load() },[])
  async function load() {
    const [{ data:s }, { data:t }] = await Promise.all([
      supabase.from('skus').select('*, tipos_refaccion(nombre)').order('codigo'),
      supabase.from('tipos_refaccion').select('*').order('nombre')
    ])
    setSkus(s??[]); setTipos(t??[])
  }
  function abrir(s=null) {
    setForm(s
      ? { codigo:s.codigo??'', tipo_id:s.tipo_id??'', precio:s.precio??'', activo:s.activo??true }
      : initForm
    )
    setEditing(s?.id??null); setModal(true)
  }
  async function guardar() {
    if (!form.codigo.trim()) { alert('El código es requerido'); return }
    setSaving(true)
    const payload = { codigo:form.codigo.trim(), tipo_id:form.tipo_id||null, precio:parseFloat(form.precio)||null, activo:form.activo!==false }
    let error
    if (editing) {
      const res = await supabase.from('skus').update(payload).eq('id', editing)
      error = res.error
    } else {
      const res = await supabase.from('skus').insert(payload)
      error = res.error
    }
    if (error) alert('Error: ' + error.message)
    else { setModal(false); setEditing(null); setForm(initForm); load() }
    setSaving(false)
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:14}}>
        <p style={{fontSize:13, color:'#888'}}>{skus.filter(s=>s.activo).length} SKUs activos · {skus.length} total</p>
        <button onClick={()=>abrir()} style={btn()}>+ Nuevo SKU</button>
      </div>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead><tr>
          <th style={th}>Código</th><th style={th}>Tipo</th><th style={th}>Precio c/IVA</th><th style={th}>Estado</th><th style={th}>Acciones</th>
        </tr></thead>
        <tbody>
          {skus.map(s=>(
            <tr key={s.id} style={{opacity:s.activo?1:0.5}}>
              <td style={{...td, fontFamily:'monospace', fontWeight:500}}>{s.codigo}</td>
              <td style={td}>{s.tipos_refaccion?.nombre??<span style={{color:'#ccc'}}>—</span>}</td>
              <td style={td}>{s.precio?`$${Number(s.precio).toLocaleString('es-MX')}`:<span style={{color:'#ccc'}}>—</span>}</td>
              <td style={td}>
                <span style={{padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:500,
                  background:s.activo?'#EAF3DE':'#F1EFE8', color:s.activo?'#166534':'#888'}}>
                  {s.activo?'Activo':'Inactivo'}
                </span>
              </td>
              <td style={td}><button onClick={()=>abrir(s)} style={{...btn(), padding:'3px 10px', fontSize:10}}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:22, width:'100%', maxWidth:400}}>
            <p style={{fontWeight:500, marginBottom:14}}>{editing?'Editar SKU':'Nuevo SKU'}</p>
            <div style={{marginBottom:10}}>
              <label style={lbl}>Código *</label>
              <input style={inp} value={form.codigo} onChange={e=>setForm(f=>({...f,codigo:e.target.value}))} placeholder="Ej: 185/65R15"/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
              <div>
                <label style={lbl}>Tipo de refacción</label>
                <select style={inp} value={form.tipo_id} onChange={e=>setForm(f=>({...f,tipo_id:e.target.value}))}>
                  <option value="">Sin tipo</option>
                  {tipos.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Precio c/IVA (MXN)</label>
                <input type="number" style={inp} value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{...lbl, display:'flex', alignItems:'center', gap:7, cursor:'pointer'}}>
                <input type="checkbox" checked={form.activo!==false} onChange={e=>setForm(f=>({...f,activo:e.target.checked}))}/>
                SKU activo
              </label>
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>{setModal(false);setEditing(null);setForm(initForm)}} style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{...btn(), opacity:saving?0.7:1}}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB: MODELOS ──────────────────────────────────────────
export function TabModelos() {
  const [modelos,  setModelos]  = useState([])
  const [skus,     setSkus]     = useState([])
  const [relacs,   setRelacs]   = useState([]) // [{modelo_id, sku_id}]
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState({ nombre:'', skus_sel:[] })
  const [buscar,   setBuscar]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:m }, { data:s }, { data:r }] = await Promise.all([
      supabase.from('modelos').select('*').order('nombre'),
      supabase.from('skus').select('*').eq('activo',true).order('codigo'),
      supabase.from('modelo_sku').select('*'),
    ])
    setModelos(m??[]); setSkus(s??[]); setRelacs(r??[])
  }

  function skusDeModelo(modelo_id) {
    return relacs.filter(r => r.modelo_id === modelo_id).map(r => r.sku_id)
  }

  function abrir(m = null) {
    setForm(m
      ? { nombre:m.nombre, skus_sel: skusDeModelo(m.id) }
      : { nombre:'', skus_sel:[] }
    )
    setEditing(m?.id ?? null)
    setModal(true)
  }

  function toggleSku(sku_id) {
    setForm(f => ({
      ...f,
      skus_sel: f.skus_sel.includes(sku_id)
        ? f.skus_sel.filter(id => id !== sku_id)
        : [...f.skus_sel, sku_id]
    }))
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es requerido'); return }
    setSaving(true)
    let modelo_id = editing

    if (editing) {
      await supabase.from('modelos').update({ nombre:form.nombre.trim() }).eq('id', editing)
    } else {
      const { data:nm } = await supabase.from('modelos').insert({ nombre:form.nombre.trim() }).select().single()
      modelo_id = nm?.id
    }

    if (modelo_id) {
      // Borrar todas las relaciones del modelo y recriarlas
      await supabase.from('modelo_sku').delete().eq('modelo_id', modelo_id)
      if (form.skus_sel.length > 0) {
        await supabase.from('modelo_sku').insert(
          form.skus_sel.map(sku_id => ({ modelo_id, sku_id }))
        )
      }
    }

    setModal(false); setEditing(null); load()
    setSaving(false)
  }

  const th = { padding:'7px 10px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8' }
  const td = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }
  const inp = { padding:'6px 9px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, width:'100%' }
  const btnS = (c='#1a4f8a') => ({ background:c, color:'white', border:'none', borderRadius:7, padding:'5px 13px', fontSize:11, cursor:'pointer', fontWeight:500 })

  const modelosFilt = modelos.filter(m =>
    !buscar || m.nombre.toLowerCase().includes(buscar.toLowerCase())
  )

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <p style={{fontSize:13, color:'#888'}}>{modelos.filter(m=>m.activo).length} modelos · {relacs.length} relaciones SKU</p>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)}
            placeholder="Buscar modelo..." 
            style={{padding:'5px 9px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, width:160}}/>
        </div>
        <button onClick={()=>abrir()} style={btnS()}>+ Nuevo modelo</button>
      </div>

      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead><tr>
          <th style={th}>Modelo</th>
          <th style={th}>Llantas</th>
          <th style={th}>Baterías</th>
          <th style={th}>Acciones</th>
        </tr></thead>
        <tbody>
          {modelosFilt.length === 0 && (
            <tr><td colSpan={4} style={{padding:24, textAlign:'center', color:'#aaa'}}>
              {buscar ? 'Sin resultados' : 'No hay modelos registrados'}
            </td></tr>
          )}
          {modelosFilt.map(m => {
            const skuIds = skusDeModelo(m.id)
            const skuObjs = skuIds.map(id => skus.find(s => s.id === id)).filter(Boolean)
            const llantas  = skuObjs.filter(s => !s.codigo.toUpperCase().includes('BAT'))
            const baterias = skuObjs.filter(s => s.codigo.toUpperCase().includes('BAT'))
            return (
              <tr key={m.id}>
                <td style={{...td, fontWeight:500, fontSize:13}}>{m.nombre}</td>
                <td style={td}>
                  {llantas.length > 0
                    ? <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {llantas.map(s => (
                          <span key={s.id} style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, background:'#DCFCE7', color:'#166534', fontFamily:'monospace'}}>
                            {s.codigo}
                          </span>
                        ))}
                      </div>
                    : <span style={{color:'#ccc', fontSize:11}}>—</span>}
                </td>
                <td style={td}>
                  {baterias.length > 0
                    ? <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {baterias.map(s => (
                          <span key={s.id} style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, background:'#FEF9C3', color:'#854D0E'}}>
                            {s.codigo}
                          </span>
                        ))}
                      </div>
                    : <span style={{color:'#ccc', fontSize:11}}>—</span>}
                </td>
                <td style={td}>
                  <button onClick={()=>abrir(m)} style={{...btnS(), padding:'3px 10px', fontSize:10}}>Editar</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {modal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:14, padding:22, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto'}}>
            <p style={{fontWeight:500, marginBottom:14}}>{editing?'Editar modelo':'Nuevo modelo'}</p>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11, color:'#666', display:'block', marginBottom:3}}>Nombre *</label>
              <input style={inp} value={form.nombre}
                onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
                placeholder="Ej: VERSA ADVANCE"/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:11, color:'#666', display:'block', marginBottom:8}}>
                SKUs asociados <span style={{color:'#aaa', fontSize:10}}>({form.skus_sel.length} seleccionados)</span>
              </label>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:4}}>
                {['Llantas','Baterías'].map(tipo => {
                  const esBat = tipo === 'Baterías'
                  const lista = skus.filter(s => s.codigo.toUpperCase().includes('BAT') === esBat)
                  return (
                    <div key={tipo}>
                      <p style={{fontSize:10, fontWeight:500, color:'#888', marginBottom:6, textTransform:'uppercase'}}>{tipo}</p>
                      {lista.map(s => {
                        const sel = form.skus_sel.includes(s.id)
                        return (
                          <label key={s.id} onClick={()=>toggleSku(s.id)}
                            style={{display:'flex', alignItems:'center', gap:7, padding:'5px 8px', borderRadius:7, marginBottom:3, cursor:'pointer',
                              background:sel?(esBat?'#FEF9C3':'#DCFCE7'):'#f9f9f7',
                              border:`1px solid ${sel?(esBat?'#FCD34D':'#86EFAC'):'#e0dfd8'}`}}>
                            <input type="checkbox" checked={sel} onChange={()=>{}} style={{pointerEvents:'none'}}/>
                            <span style={{fontSize:11, fontFamily:'monospace', fontWeight:sel?500:400, color:sel?(esBat?'#854D0E':'#166534'):'#444'}}>
                              {s.codigo}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>{setModal(false);setEditing(null)}}
                style={{padding:'5px 12px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving} style={{...btnS(), opacity:saving?0.7:1}}>
                {saving?'Guardando...':'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
