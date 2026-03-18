import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { REGIONES } from '../lib/inventario'

const TIPO_CFG = {
  entrada: { icon:'▲', color:'#3B6D11' },
  salida:  { icon:'▼', color:'#A32D2D' },
  ajuste:  { icon:'●', color:'#0C447C' },
}

export default function Kardex() {
  const { perfil } = useAuth()
  const [movs,    setMovs]    = useState([])
  const [talleres,setTalleres]= useState([])
  const [skus,    setSkus]    = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({ taller_id:'', sku_id:'', tipo:'salida', cantidad:'', notas:'' })

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m }, { data: t }, { data: s }] = await Promise.all([
      supabase.from('movimientos')
        .select('*, talleres(nombre, region), skus(codigo), perfiles(nombre)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('talleres').select('*').eq('activo', true).order('nombre'),
      supabase.from('skus').select('*').eq('activo', true).order('codigo'),
    ])
    setMovs(m ?? [])
    setTalleres(t ?? [])
    setSkus(s ?? [])
    setLoading(false)
  }

  async function handleGuardar() {
    if (!form.taller_id || !form.sku_id || !form.cantidad) return alert('Completa todos los campos')
    setSaving(true)
    const { error } = await supabase.from('movimientos').insert({
      taller_id: form.taller_id, sku_id: form.sku_id,
      tipo: form.tipo, cantidad: parseInt(form.cantidad),
      notas: form.notas, usuario_id: perfil?.id,
      fecha: new Date().toISOString().split('T')[0],
    })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setModal(false)
    setForm({ taller_id:'', sku_id:'', tipo:'salida', cantidad:'', notas:'' })
    load()
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:1000 }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Kardex de movimientos</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Entradas, salidas y ajustes de inventario</p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8,
            padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
          + Nuevo movimiento
        </button>
      </div>

      <div style={{ background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Fecha','Tipo','Taller','Ciudad','SKU','Cantidad','Registró'].map(h => (
                  <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontWeight:500,
                    fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8',
                    background:'#f5f5f3', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movs.map(m => {
                const tc = TIPO_CFG[m.tipo] ?? TIPO_CFG.ajuste
                const rc = REGIONES[m.talleres?.region] ?? {}
                return (
                  <tr key={m.id} style={{ borderBottom:'0.5px solid #f0efe8' }}>
                    <td style={{ padding:'7px 12px', color:'#888', fontSize:11 }}>{m.fecha}</td>
                    <td style={{ padding:'7px 12px', fontWeight:500, color:tc.color }}>
                      {tc.icon} {m.tipo}
                    </td>
                    <td style={{ padding:'7px 12px', fontWeight:500 }}>{m.talleres?.nombre}</td>
                    <td style={{ padding:'7px 12px', fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                    <td style={{ padding:'7px 12px', fontFamily:'monospace', fontSize:11 }}>{m.skus?.codigo}</td>
                    <td style={{ padding:'7px 12px', fontWeight:500, color:tc.color, textAlign:'right' }}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                    </td>
                    <td style={{ padding:'7px 12px', color:'#aaa', fontSize:11 }}>{m.perfiles?.nombre}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:420 }}>
            <div className="flex justify-between items-center mb-4">
              <p style={{ fontWeight:500 }}>Nuevo movimiento</p>
              <button onClick={() => setModal(false)}
                style={{ background:'none', border:'0.5px solid #ccc', borderRadius:7,
                  padding:'3px 10px', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Taller *</label>
                <select value={form.taller_id} onChange={e => setForm({...form, taller_id:e.target.value})}
                  style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }}>
                  <option value="">Seleccionar...</option>
                  {talleres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>SKU *</label>
                <select value={form.sku_id} onChange={e => setForm({...form, sku_id:e.target.value})}
                  style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }}>
                  <option value="">Seleccionar...</option>
                  {skus.map(s => <option key={s.id} value={s.id}>{s.codigo}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})}
                  style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }}>
                  <option value="salida">Salida</option>
                  <option value="entrada">Entrada</option>
                  <option value="ajuste">Ajuste (stock exacto)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Cantidad *</label>
                <input type="number" min="1" value={form.cantidad}
                  onChange={e => setForm({...form, cantidad:e.target.value})}
                  style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }} />
              </div>
            </div>
            <div className="mb-3">
              <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>Notas</label>
              <input type="text" value={form.notas} onChange={e => setForm({...form, notas:e.target.value})}
                style={{ width:'100%', padding:'6px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12 }} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModal(false)}
                style={{ padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white' }}>
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving}
                style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:7,
                  padding:'6px 14px', fontSize:12, cursor:'pointer', opacity:saving?0.7:1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
