import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const ROL_CFG = {
  admin:     { bg:'#FCEBEB', color:'#791F1F' },
  staff:     { bg:'#E6F1FB', color:'#0C447C' },
  proveedor: { bg:'#FAEEDA', color:'#633806' },
}

export default function Admin() {
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({ nombre:'', email:'', rol:'staff' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setUsuarios(data ?? [])
    setLoading(false)
  }

  async function handleGuardar() {
    if (!form.nombre || !form.email) return alert('Completa nombre y email')
    setSaving(true)
    // Crear usuario en Auth con contraseña temporal
    const { data, error } = await supabase.auth.admin
      ? { error: { message: 'Usa el panel de Supabase para crear usuarios Auth' } }
      : { error: null }

    // Insertar perfil directamente (el usuario debe crearse desde Supabase Auth)
    const { error: perfilError } = await supabase.from('perfiles').upsert({
      email: form.email, nombre: form.nombre, rol: form.rol,
    }, { onConflict: 'email' })

    if (perfilError) {
      alert('Nota: crea primero el usuario en Supabase → Authentication → Users, luego su perfil se actualiza aquí.')
    }

    setModal(false)
    setForm({ nombre:'', email:'', rol:'staff' })
    load()
    setSaving(false)
  }

  async function cambiarRol(id, rol) {
    await supabase.from('perfiles').update({ rol }).eq('id', id)
    load()
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:800 }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Gestión de usuarios</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>
            Para crear usuarios nuevos ve a Supabase → Authentication → Users → Add user
          </p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8,
            padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
          + Nuevo usuario
        </button>
      </div>

      {/* Roles info */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { rol:'admin',     desc:'Acceso total, gestión de usuarios y pedidos' },
          { rol:'staff',     desc:'Ve inventario y kardex, valida conteos' },
          { rol:'proveedor', desc:'Registra conteos y sube evidencia física' },
        ].map(r => {
          const cfg = ROL_CFG[r.rol]
          return (
            <div key={r.rol} style={{ background:'white', border:'0.5px solid #e0dfd8',
              borderRadius:9, padding:12 }}>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20,
                background:cfg.bg, color:cfg.color, fontWeight:500, display:'inline-block', marginBottom:6 }}>
                {r.rol}
              </span>
              <p style={{ fontSize:11, color:'#888' }}>{r.desc}</p>
            </div>
          )
        })}
      </div>

      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              {['Nombre','Email','Rol','Cambiar rol'].map(h => (
                <th key={h} style={{ padding:'7px 14px', textAlign:'left', fontWeight:500,
                  fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8', background:'#f5f5f3' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const cfg = ROL_CFG[u.rol] ?? ROL_CFG.staff
              const initials = u.nombre?.split(' ').map(n => n[0]).slice(0,2).join('') ?? '?'
              return (
                <tr key={u.id} style={{ borderBottom:'0.5px solid #f0efe8' }}>
                  <td style={{ padding:'8px 14px' }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'#E6F1FB',
                        color:'#0C447C', display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:500, flexShrink:0 }}>{initials}</div>
                      <span style={{ fontWeight:500 }}>{u.nombre}</span>
                    </div>
                  </td>
                  <td style={{ padding:'8px 14px', color:'#888' }}>{u.email}</td>
                  <td style={{ padding:'8px 14px' }}>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20,
                      background:cfg.bg, color:cfg.color, fontWeight:500 }}>{u.rol}</span>
                  </td>
                  <td style={{ padding:'8px 14px' }}>
                    <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                      style={{ padding:'4px 8px', border:'0.5px solid #ccc', borderRadius:7,
                        fontSize:11, background:'white', cursor:'pointer' }}>
                      <option value="admin">admin</option>
                      <option value="staff">staff</option>
                      <option value="proveedor">proveedor</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal informativo */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:14, padding:24, width:'100%', maxWidth:420 }}>
            <div className="flex justify-between items-center mb-4">
              <p style={{ fontWeight:500 }}>Crear nuevo usuario</p>
              <button onClick={() => setModal(false)}
                style={{ background:'none', border:'0.5px solid #ccc', borderRadius:7,
                  padding:'3px 10px', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>
            <div style={{ background:'#E6F1FB', borderRadius:8, padding:'10px 12px',
              fontSize:11, color:'#0C447C', marginBottom:16, lineHeight:1.7 }}>
              <strong>Paso 1:</strong> Ve a <strong>supabase.com → tu proyecto → Authentication → Users → Add user</strong>
              <br/>Ingresa el email y una contraseña temporal. Supabase creará el perfil automáticamente.
              <br/><br/>
              <strong>Paso 2:</strong> Vuelve aquí y cambia el rol desde la tabla.
            </div>
            <div className="mb-3">
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>
                Email del nuevo usuario
              </label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})}
                placeholder="correo@empresa.com"
                style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc',
                  borderRadius:7, fontSize:12 }} />
            </div>
            <div className="mb-3">
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Nombre</label>
              <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})}
                placeholder="Nombre completo"
                style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc',
                  borderRadius:7, fontSize:12 }} />
            </div>
            <div className="mb-4">
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Rol</label>
              <select value={form.rol} onChange={e => setForm({...form, rol:e.target.value})}
                style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc',
                  borderRadius:7, fontSize:12 }}>
                <option value="staff">Staff interno</option>
                <option value="proveedor">Proveedor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(false)}
                style={{ padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7,
                  fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={handleGuardar} disabled={saving}
                style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7,
                  padding:'6px 14px', fontSize:12, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
