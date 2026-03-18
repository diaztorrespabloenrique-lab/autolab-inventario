import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { REGIONES, CLIENTES } from '../lib/inventario'

export default function Conteos() {
  const { perfil } = useAuth()
  const [conteos,   setConteos]   = useState([])
  const [talleres,  setTalleres]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [saving,    setSaving]    = useState(false)

  const [form, setForm] = useState({ taller_id:'', fecha: new Date().toISOString().split('T')[0], notas:'' })
  const [files, setFiles] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from('conteos')
        .select('*, talleres(nombre, region, cliente), perfiles(nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('talleres').select('*').eq('activo', true).order('nombre'),
    ])
    setConteos(c ?? [])
    setTalleres(t ?? [])
    setLoading(false)
  }

  async function handleGuardar() {
    if (!form.taller_id || !form.fecha) return alert('Selecciona taller y fecha')
    setSaving(true)

    const { data: conteo, error } = await supabase
      .from('conteos')
      .insert({ taller_id: form.taller_id, fecha: form.fecha, notas: form.notas,
        usuario_id: perfil?.id, estado: 'completado' })
      .select().single()

    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }

    // subir archivos a Storage
    for (const file of files) {
      const path = `${conteo.id}/${file.name}`
      const { data: upload } = await supabase.storage.from('evidencias').upload(path, file)
      if (upload) {
        const { data: { publicUrl } } = supabase.storage.from('evidencias').getPublicUrl(path)
        await supabase.from('conteo_evidencias').insert({
          conteo_id: conteo.id, nombre: file.name, url: publicUrl
        })
      }
    }

    setModal(false)
    setForm({ taller_id:'', fecha: new Date().toISOString().split('T')[0], notas:'' })
    setFiles([])
    load()
    setSaving(false)
  }

  async function validar(id) {
    await supabase.from('conteos').update({ estado: 'validado' }).eq('id', id)
    load()
  }

  const estMap = {
    abierto:    { l:'Abierto',    bg:'#FAEEDA', color:'#633806' },
    completado: { l:'Completado', bg:'#E6F1FB', color:'#0C447C' },
    validado:   { l:'Validado',   bg:'#EAF3DE', color:'#27500A' },
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:900 }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Conteos de inventario</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Tomas físicas con evidencia fotográfica</p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8,
            padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
          + Nuevo conteo
        </button>
      </div>

      {conteos.map(c => {
        const t = c.talleres ?? {}
        const rc = REGIONES[t.region] ?? {}
        const cc = CLIENTES[t.cliente] ?? CLIENTES.ind
        const est = estMap[c.estado] ?? estMap.abierto
        return (
          <div key={c.id} style={{ background:'white', border:'0.5px solid #e0dfd8',
            borderRadius:10, padding:14, marginBottom:10 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontWeight:500 }}>{t.nombre}</span>
                  <span style={{ fontSize:9, padding:'1px 7px', borderRadius:20,
                    background: rc.color+'22', color: rc.color, fontWeight:500 }}>{rc.label}</span>
                  <span style={{ fontSize:9, padding:'1px 7px', borderRadius:20,
                    background:cc.bg, color:cc.color, fontWeight:500 }}>{cc.label}</span>
                  <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20,
                    background:est.bg, color:est.color, fontWeight:500 }}>{est.l}</span>
                </div>
                <p style={{ fontSize:11, color:'#888' }}>
                  {c.fecha} · {c.perfiles?.nombre ?? perfil?.nombre}
                </p>
                {c.notas && <p style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{c.notas}</p>}
              </div>
              {c.estado === 'completado' && ['admin','staff'].includes(perfil?.rol) && (
                <button onClick={() => validar(c.id)}
                  style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7,
                    padding:'4px 12px', fontSize:11, cursor:'pointer' }}>
                  Validar
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:14, padding:20,
            width:'100%', maxWidth:420, border:'0.5px solid #e0dfd8' }}>
            <div className="flex justify-between items-center mb-4">
              <p style={{ fontWeight:500 }}>Nuevo conteo</p>
              <button onClick={() => setModal(false)}
                style={{ background:'none', border:'0.5px solid #ccc', borderRadius:7,
                  padding:'3px 10px', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Taller *</label>
                <select value={form.taller_id} onChange={e => setForm({...form, taller_id:e.target.value})}
                  style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc',
                    borderRadius:7, fontSize:12 }}>
                  <option value="">Seleccionar...</option>
                  {talleres.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre} ({REGIONES[t.region]?.label})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Fecha *</label>
                <input type="date" value={form.fecha}
                  onChange={e => setForm({...form, fecha:e.target.value})}
                  style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc',
                    borderRadius:7, fontSize:12 }} />
              </div>
            </div>

            <div className="mb-3">
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm({...form, notas:e.target.value})}
                rows={2} style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc',
                  borderRadius:7, fontSize:12, resize:'vertical' }} />
            </div>

            <div>
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>
                Evidencia (fotos / videos)
              </label>
              <label style={{ border:'1.5px dashed #ccc', borderRadius:9, padding:'18px',
                textAlign:'center', display:'block', cursor:'pointer', fontSize:11, color:'#888' }}>
                <div style={{ fontSize:20, marginBottom:5 }}>📷</div>
                <p>Toca para adjuntar</p>
                <input type="file" multiple accept="image/*,video/*"
                  style={{ display:'none' }}
                  onChange={e => setFiles(Array.from(e.target.files))} />
              </label>
              {files.length > 0 && (
                <div style={{ marginTop:6 }}>
                  {files.map(f => (
                    <span key={f.name} style={{ display:'inline-flex', gap:4, background:'#f5f5f3',
                      border:'0.5px solid #e0dfd8', borderRadius:20, padding:'2px 9px',
                      fontSize:10, margin:2 }}>📷 {f.name}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setModal(false)}
                style={{ padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7,
                  fontSize:12, cursor:'pointer', background:'white' }}>Cancelar</button>
              <button onClick={handleGuardar} disabled={saving}
                style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7,
                  padding:'6px 14px', fontSize:12, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
