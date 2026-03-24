import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'

const th  = { padding:'7px 10px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8' }
const td  = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }
const inp = { padding:'6px 9px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, width:'100%' }
const lbl = { fontSize:11, color:'#666', display:'block', marginBottom:3 }
const btn = (c='#1a4f8a') => ({ background:c, color:'white', border:'none', borderRadius:7, padding:'5px 13px', fontSize:11, cursor:'pointer', fontWeight:500 })

export default function Conteos() {
  const { perfil } = useAuth()
  const canWrite = ['admin','staff'].includes(perfil?.rol)

  const [conteos,  setConteos]  = useState([])
  const [talleres, setTalleres] = useState([])
  const [skus,     setSkus]     = useState([])
  const [inv,      setInv]      = useState([])
  const [loading,  setLoading]  = useState(true)

  const [modal,    setModal]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [expandido,setExpandido]= useState(null)

  const initForm = { taller_id:'', notas:'', foto:null }
  const [form, setForm] = useState(initForm)

  // Detalle de SKUs para el conteo actual
  const [skuCounts, setSkuCounts] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:c }, { data:t }, { data:s }, { data:i }] = await Promise.all([
      supabase.from('conteos')
        .select('*, talleres(nombre,region), perfiles(nombre), conteo_detalle(*, skus(codigo))')
        .order('created_at', { ascending:false }),
      supabase.from('talleres').select('*').eq('activo',true).order('nombre'),
      supabase.from('skus').select('*').eq('activo',true).order('codigo'),
      supabase.from('inventario').select('*'),
    ])
    setConteos(c??[]); setTalleres(t??[]); setSkus(s??[]); setInv(i??[])
    setLoading(false)
  }

  function abrirModal() {
    setForm(initForm)
    setSkuCounts([])
    setModal(true)
  }

  // Cuando cambia el taller, cargar SKUs del inventario de ese taller con sus cantidades
  function onChangeTaller(taller_id) {
    setForm(f => ({ ...f, taller_id }))
    if (!taller_id) { setSkuCounts([]); return }
    const items = skus.map(s => {
      const registro = inv.find(r => r.taller_id === taller_id && r.sku_id === s.id)
      return {
        sku_id:   s.id,
        sku_cod:  s.codigo,
        cantidad_sistema: registro?.cantidad ?? 0,
        cantidad_fisica:  '',  // el usuario llena esto
      }
    })
    setSkuCounts(items)
  }

  function updateCantFisica(idx, val) {
    setSkuCounts(prev => prev.map((it, i) =>
      i === idx ? { ...it, cantidad_fisica: val === '' ? '' : Math.max(0, parseInt(val) || 0) } : it
    ))
  }

  async function handleGuardar() {
    if (!form.taller_id) { alert('Selecciona el taller'); return }
    setSaving(true)

    // 1. Subir foto si hay
    let foto_url = null
    if (form.foto) {
      const ext  = form.foto.name.split('.').pop()
      const path = `conteos/${form.taller_id}/${Date.now()}.${ext}`
      const { error:upErr } = await supabase.storage.from('inventario').upload(path, form.foto)
      if (!upErr) {
        const { data:urlData } = supabase.storage.from('inventario').getPublicUrl(path)
        foto_url = urlData?.publicUrl
      }
    }

    // 2. Crear el conteo
    const { data:conteo, error:conteoErr } = await supabase.from('conteos').insert({
      taller_id:    form.taller_id,
      notas:        form.notas || null,
      foto_url,
      usuario_id:   perfil?.id,
      fecha:        new Date().toISOString().split('T')[0],
    }).select().single()

    if (conteoErr) { alert('Error: ' + conteoErr.message); setSaving(false); return }

    // 3. Guardar detalle por SKU (solo los que tienen cantidad física registrada)
    const detalles = skuCounts
      .filter(it => it.cantidad_fisica !== '' && it.cantidad_fisica !== null)
      .map(it => ({
        conteo_id:        conteo.id,
        sku_id:           it.sku_id,
        cantidad_fisica:  Number(it.cantidad_fisica) || 0,
        cantidad_sistema: it.cantidad_sistema,
        diferencia:       (Number(it.cantidad_fisica) || 0) - it.cantidad_sistema,
      }))

    if (detalles.length > 0) {
      const { error:detErr } = await supabase.from('conteo_detalle').insert(detalles)
      if (detErr) console.error('Error guardando detalle:', detErr.message)
    }

    setModal(false); setForm(initForm); setSkuCounts([]); load()
    setSaving(false)
  }

  const contadosConDif = skuCounts.filter(it => it.cantidad_fisica !== '')
  const diferencias    = contadosConDif.filter(it => Number(it.cantidad_fisica) !== it.cantidad_sistema)

  if (loading) return <div style={{padding:20, color:'#aaa'}}>Cargando conteos...</div>

  return (
    <div style={{padding:20, maxWidth:1100}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
        <div>
          <h1 style={{fontSize:17, fontWeight:500}}>Conteos de inventario</h1>
          <p style={{fontSize:11, color:'#888', marginTop:2}}>{conteos.length} conteos registrados</p>
        </div>
        {canWrite && (
          <button onClick={abrirModal} style={btn()}>+ Registrar conteo</button>
        )}
      </div>

      {/* ── Tabla de conteos ── */}
      <div style={{background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
          <thead><tr>
            <th style={th}>Fecha</th><th style={th}>Taller</th><th style={th}>Registró</th>
            <th style={th}>SKUs contados</th><th style={th}>Diferencias</th>
            <th style={th}>Foto</th><th style={th}>Notas</th>
          </tr></thead>
          <tbody>
            {conteos.length===0 && (
              <tr><td colSpan={7} style={{padding:32, textAlign:'center', color:'#aaa'}}>No hay conteos registrados</td></tr>
            )}
            {conteos.map(c => {
              const detalle   = c.conteo_detalle ?? []
              const conDif    = detalle.filter(d => d.diferencia !== 0)
              const hasDif    = conDif.length > 0

              return (
                <tr key={c.id}>
                  <td style={td}>{c.fecha}</td>
                  <td style={{...td, fontWeight:500}}>{c.talleres?.nombre}</td>
                  <td style={{...td, color:'#888'}}>{c.perfiles?.nombre}</td>
                  <td style={td}>
                    <button onClick={()=>setExpandido(expandido===c.id?null:c.id)}
                      style={{background:'none', border:'none', cursor:'pointer', color:'#1a4f8a', fontSize:11, textDecoration:'underline'}}>
                      {detalle.length} SKUs {expandido===c.id?'▲':'▼'}
                    </button>
                    {expandido===c.id && detalle.length>0 && (
                      <div style={{marginTop:8, background:'#f9f9f7', borderRadius:8, padding:10}}>
                        <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
                          <thead><tr style={{background:'#f0efe8'}}>
                            <th style={{padding:'4px 8px', textAlign:'left'}}>SKU</th>
                            <th style={{padding:'4px 8px', textAlign:'right'}}>Sistema</th>
                            <th style={{padding:'4px 8px', textAlign:'right'}}>Físico</th>
                            <th style={{padding:'4px 8px', textAlign:'right'}}>Diferencia</th>
                          </tr></thead>
                          <tbody>
                            {detalle.map(d => (
                              <tr key={d.id} style={{background: d.diferencia!==0 ? (d.diferencia<0?'#FCEBEB':'#EAF3DE') : 'white'}}>
                                <td style={{padding:'4px 8px', fontFamily:'monospace'}}>{d.skus?.codigo}</td>
                                <td style={{padding:'4px 8px', textAlign:'right'}}>{d.cantidad_sistema}</td>
                                <td style={{padding:'4px 8px', textAlign:'right', fontWeight:500}}>{d.cantidad_fisica}</td>
                                <td style={{padding:'4px 8px', textAlign:'right', fontWeight:500,
                                  color: d.diferencia===0?'#888' : d.diferencia<0?'#A32D2D':'#166534'}}>
                                  {d.diferencia>0?'+':''}{d.diferencia}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {hasDif ? (
                      <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, background:'#FCEBEB', color:'#A32D2D'}}>
                        ⚠ {conDif.length} diferencias
                      </span>
                    ) : (
                      <span style={{color:'#ccc', fontSize:11}}>Sin diferencias</span>
                    )}
                  </td>
                  <td style={td}>
                    {c.foto_url
                      ? <a href={c.foto_url} target="_blank" rel="noreferrer"
                          style={{fontSize:11, color:'#1a4f8a'}}>Ver foto</a>
                      : <span style={{color:'#ccc'}}>—</span>}
                  </td>
                  <td style={{...td, color:'#888', maxWidth:200, fontSize:11}}>{c.notas||<span style={{color:'#ccc'}}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal registrar conteo ── */}
      {modal && canWrite && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20}}>
          <div style={{background:'white', borderRadius:14, padding:20, width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
              <p style={{fontWeight:500}}>Registrar conteo</p>
              <button onClick={()=>{setModal(false);setForm(initForm);setSkuCounts([])}}
                style={{background:'none', border:'0.5px solid #ccc', borderRadius:7, padding:'3px 10px', cursor:'pointer'}}>✕</button>
            </div>

            {/* Taller */}
            <div style={{marginBottom:12}}>
              <label style={lbl}>Taller *</label>
              <select style={inp} value={form.taller_id} onChange={e=>onChangeTaller(e.target.value)}>
                <option value="">Seleccionar...</option>
                {talleres.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>

            {/* Tabla de conteo por SKU */}
            {form.taller_id && skuCounts.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                  <p style={{fontSize:12, fontWeight:500}}>Conteo físico por SKU</p>
                  <p style={{fontSize:11, color:'#888'}}>Deja vacío los SKUs que no contaste</p>
                </div>
                <div style={{background:'#f9f9f7', borderRadius:8, overflow:'hidden', border:'0.5px solid #e0dfd8'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                    <thead><tr style={{background:'#f5f5f3'}}>
                      <th style={th}>SKU</th>
                      <th style={{...th, textAlign:'right'}}>En sistema</th>
                      <th style={{...th, textAlign:'center'}}>Conteo físico</th>
                      <th style={{...th, textAlign:'right'}}>Diferencia</th>
                    </tr></thead>
                    <tbody>
                      {skuCounts.map((it,idx) => {
                        const cantFis = it.cantidad_fisica==='' ? null : Number(it.cantidad_fisica)
                        const dif     = cantFis !== null ? cantFis - it.cantidad_sistema : null
                        const rowBg   = dif===null ? 'white' : dif===0 ? '#f1faf1' : dif<0 ? '#fff0f0' : '#f0fff0'
                        return (
                          <tr key={it.sku_id} style={{background:rowBg}}>
                            <td style={{...td, fontFamily:'monospace', fontSize:11, fontWeight:500}}>{it.sku_cod}</td>
                            <td style={{...td, textAlign:'right', color:'#666'}}>{it.cantidad_sistema}</td>
                            <td style={{...td, textAlign:'center'}}>
                              <input type="number" min="0"
                                value={it.cantidad_fisica}
                                onChange={e=>updateCantFisica(idx, e.target.value)}
                                placeholder="—"
                                style={{...inp, width:70, textAlign:'center', padding:'4px 6px'}}
                              />
                            </td>
                            <td style={{...td, textAlign:'right', fontWeight:500,
                              color: dif===null?'#ccc' : dif===0?'#166534' : dif<0?'#A32D2D':'#0F6E56'}}>
                              {dif===null ? '—' : (dif>0?'+':'')+dif}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de diferencias en tiempo real */}
                {contadosConDif.length > 0 && (
                  <div style={{marginTop:10, background: diferencias.length>0?'#FCEBEB':'#EAF3DE',
                    borderRadius:8, padding:'10px 14px', fontSize:12}}>
                    {diferencias.length > 0 ? (
                      <div>
                        <span style={{color:'#A32D2D', fontWeight:500}}>⚠ {diferencias.length} diferencias encontradas:</span>
                        <div style={{marginTop:6, display:'flex', flexWrap:'wrap', gap:6}}>
                          {diferencias.map(d=>(
                            <span key={d.sku_id} style={{padding:'2px 8px', borderRadius:20, fontSize:11,
                              background: Number(d.cantidad_fisica)<d.cantidad_sistema?'#FCEBEB':'#EAF3DE',
                              color: Number(d.cantidad_fisica)<d.cantidad_sistema?'#791F1F':'#166534', fontWeight:500}}>
                              {d.sku_cod}: {Number(d.cantidad_fisica)<d.cantidad_sistema?'':'+'}{Number(d.cantidad_fisica)-d.cantidad_sistema}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span style={{color:'#166534', fontWeight:500}}>✅ Sin diferencias en los SKUs contados</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Foto y notas */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
              <div>
                <label style={lbl}>Evidencia fotográfica <span style={{color:'#aaa'}}>(opcional)</span></label>
                <input type="file" accept="image/*"
                  onChange={e=>setForm(f=>({...f, foto:e.target.files[0]||null}))}
                  style={{...inp, padding:'4px'}}/>
              </div>
              <div>
                <label style={lbl}>Notas <span style={{color:'#aaa'}}>(opcional)</span></label>
                <input type="text" style={inp} value={form.notas}
                  onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                  placeholder="Ej: Conteo de fin de mes"/>
              </div>
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>{setModal(false);setForm(initForm);setSkuCounts([])}}
                style={{padding:'6px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving||!form.taller_id}
                style={{...btn(), opacity:saving||!form.taller_id?0.6:1}}>
                {saving?'Guardando...':'Guardar conteo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
