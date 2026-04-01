import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'

const th = { padding:'8px 12px', fontSize:11, fontWeight:500, color:'#666', background:'#f5f5f3', borderBottom:'0.5px solid #e0dfd8', whiteSpace:'nowrap' }
const td = { padding:'8px 12px', fontSize:12, borderBottom:'0.5px solid #f0efe8', verticalAlign:'middle' }
const fmt = n => n == null ? '—' : `$${Number(n).toLocaleString('es-MX',{minimumFractionDigits:2})}`

function getISOWeek(d) {
  const date = new Date(d)
  date.setHours(0,0,0,0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const week1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

const CAUSAL_CFG = {
  conteo:      { label:'Conteo físico',        bg:'#FEF9C3', color:'#854D0E', icon:'📋' },
  salida_shop: { label:'Refacción de taller',  bg:'#FEE2E2', color:'#991B1B', icon:'🔧' },
}

export default function AjustesTalleres() {
  const { perfil } = useAuth()
  const canEdit   = ['admin','shops'].includes(perfil?.rol)
  const canView   = ['admin','shops','staff','visor'].includes(perfil?.rol)

  const [ajustes,  setAjustes]  = useState([])
  const [talleres, setTalleres] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(null)
  const [confirmElim, setConfirmElim] = useState(null)

  const [fTaller,  setFTaller]  = useState('')
  const [fCausal,  setFCausal]  = useState('')
  const [fConfirm, setFConfirm] = useState('')
  const [fSemana,  setFSemana]  = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data:a }, { data:t }] = await Promise.all([
      supabase.from('ajustes_taller')
        .select(`
          *, talleres(nombre, region),
          conteos(numero_conteo),
          movimientos(appointment_id, placa, fecha),
          confirmador:confirmado_por(nombre)
        `)
        .order('fecha_generado', { ascending:false })
        .order('created_at',     { ascending:false }),
      supabase.from('talleres').select('id,nombre').eq('activo',true).order('nombre'),
    ])
    setAjustes(a ?? [])
    setTalleres(t ?? [])
    setLoading(false)
  }

  async function eliminarAjuste(id) {
    const { error } = await supabase.from('ajustes_taller').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    setConfirmElim(null); load()
  }

  async function confirmar(ajuste) {
    setSaving(ajuste.id)
    const { error } = await supabase.from('ajustes_taller').update({
      confirmado:         true,
      fecha_confirmacion: new Date().toISOString().split('T')[0],
      confirmado_por:     perfil?.id,
    }).eq('id', ajuste.id)
    if (error) alert('Error: ' + error.message)
    setSaving(null); load()
  }

  async function desconfirmar(ajuste) {
    setSaving(ajuste.id)
    await supabase.from('ajustes_taller').update({
      confirmado:         false,
      fecha_confirmacion: null,
      confirmado_por:     null,
    }).eq('id', ajuste.id)
    setSaving(null); load()
  }

  // Filtrar
  const ajustesFilt = ajustes.filter(a => {
    if (fTaller  && a.taller_id !== fTaller)  return false
    if (fCausal  && a.causal    !== fCausal)  return false
    if (fConfirm === 'si' && !a.confirmado)   return false
    if (fConfirm === 'no' &&  a.confirmado)   return false
    if (fSemana) {
      const sem = getISOWeek(new Date(a.fecha_generado + 'T12:00:00'))
      if (String(sem) !== fSemana) return false
    }
    return true
  })

  const totalPendiente  = ajustesFilt.filter(a=>!a.confirmado).reduce((s,a)=>s+Number(a.monto_sin_iva||0),0)
  const totalConfirmado = ajustesFilt.filter(a=> a.confirmado).reduce((s,a)=>s+Number(a.monto_sin_iva||0),0)

  // Semanas disponibles
  const semanas = [...new Set(ajustes.map(a =>
    String(getISOWeek(new Date(a.fecha_generado + 'T12:00:00')))
  ))].sort((a,b) => Number(b)-Number(a))

  if (!canView) return (
    <div style={{padding:20,color:'#aaa'}}>Sin acceso a este módulo.</div>
  )
  if (loading) return <div style={{padding:20,color:'#aaa'}}>Cargando ajustes...</div>

  return (
    <div style={{padding:20, maxWidth:1300}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
        <div>
          <h1 style={{fontSize:17, fontWeight:500}}>Ajustes a talleres</h1>
          <p style={{fontSize:11, color:'#888', marginTop:3}}>
            Generados automáticamente por diferencias en conteos y salidas suministradas por taller
          </p>
        </div>
        <button onClick={load}
          style={{padding:'5px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, cursor:'pointer', background:'white'}}>
          ↻ Actualizar
        </button>
      </div>

      {/* Resumen */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20}}>
        {[
          { label:'Total ajustes',         val:ajustesFilt.length,                             color:'#5F5E5A', bg:'#F1EFE8' },
          { label:'Pendientes confirmar',  val:ajustesFilt.filter(a=>!a.confirmado).length,   color:'#854D0E', bg:'#FEF9C3' },
          { label:'Monto pendiente s/IVA', val:fmt(totalPendiente),                            color:'#991B1B', bg:'#FEE2E2' },
          { label:'Monto confirmado s/IVA',val:fmt(totalConfirmado),                           color:'#166534', bg:'#DCFCE7' },
        ].map(c=>(
          <div key={c.label} style={{background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, padding:'12px 16px'}}>
            <p style={{fontSize:11, color:'#888', marginBottom:4}}>{c.label}</p>
            <p style={{fontSize:typeof c.val==='number'?20:15, fontWeight:500, color:c.color}}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{background:'white', border:'0.5px solid #e0dfd8', borderRadius:10,
        padding:'10px 14px', marginBottom:14, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end'}}>
        <div>
          <div style={{fontSize:10, color:'#888', marginBottom:3}}>Taller</div>
          <select value={fTaller} onChange={e=>setFTaller(e.target.value)}
            style={{padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:160}}>
            <option value="">Todos</option>
            {talleres.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10, color:'#888', marginBottom:3}}>Causal</div>
          <select value={fCausal} onChange={e=>setFCausal(e.target.value)}
            style={{padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:150}}>
            <option value="">Todos</option>
            <option value="conteo">📋 Conteo físico</option>
            <option value="salida_shop">🔧 Refacción de taller</option>
          </select>
        </div>
        <div>
          <div style={{fontSize:10, color:'#888', marginBottom:3}}>Semana</div>
          <select value={fSemana} onChange={e=>setFSemana(e.target.value)}
            style={{padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:100}}>
            <option value="">Todas</option>
            {semanas.map(s=><option key={s} value={s}>Semana {s}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10, color:'#888', marginBottom:3}}>Estado</div>
          <select value={fConfirm} onChange={e=>setFConfirm(e.target.value)}
            style={{padding:'5px 8px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, minWidth:150}}>
            <option value="">Todos</option>
            <option value="no">⏳ Pendiente confirmar</option>
            <option value="si">✅ Confirmados</option>
          </select>
        </div>
        {(fTaller||fCausal||fSemana||fConfirm) && (
          <button onClick={()=>{setFTaller('');setFCausal('');setFSemana('');setFConfirm('')}}
            style={{padding:'5px 10px', border:'0.5px solid #ccc', borderRadius:7, fontSize:11, background:'white', cursor:'pointer', alignSelf:'flex-end'}}>
            Limpiar
          </button>
        )}
        <span style={{fontSize:11, color:'#888', alignSelf:'flex-end', marginLeft:'auto'}}>
          {ajustesFilt.length} registros
        </span>
      </div>

      {/* Tabla */}
      <div style={{background:'white', border:'0.5px solid #e0dfd8', borderRadius:10, overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Fecha</th>
                <th style={th}>Semana</th>
                <th style={th}>Taller</th>
                <th style={th}>Causal</th>
                <th style={th}>Concepto</th>
                <th style={{...th, textAlign:'right'}}>Monto s/IVA</th>
                <th style={th}>Referencia</th>
                <th style={th}>Cargado en sistema</th>
                <th style={th}>Fecha carga</th>
                <th style={th}>Confirmado por</th>
                {canEdit && <th style={th}></th>}
              </tr>
            </thead>
            <tbody>
              {ajustesFilt.length === 0 && (
                <tr>
                  <td colSpan={11} style={{padding:40, textAlign:'center', color:'#aaa'}}>
                    No hay ajustes registrados
                  </td>
                </tr>
              )}
              {ajustesFilt.map((a, idx) => {
                const ccfg = CAUSAL_CFG[a.causal] ?? CAUSAL_CFG.conteo
                const sem  = getISOWeek(new Date(a.fecha_generado + 'T12:00:00'))
                const esConteo = a.causal === 'conteo'

                return (
                  <tr key={a.id} style={{
                    background: a.confirmado ? 'white' : idx%2===0 ? '#FFFEF5' : '#FFFEF0'
                  }}>
                    {/* Número */}
                    <td style={{...td, fontWeight:500, color:'#1a4f8a', fontSize:11}}>
                      #{a.numero}
                    </td>

                    {/* Fecha */}
                    <td style={td}>{a.fecha_generado}</td>

                    {/* Semana */}
                    <td style={td}>
                      <span style={{padding:'1px 8px', borderRadius:20, fontSize:10, fontWeight:500,
                        background:'#E6F1FB', color:'#0C447C'}}>
                        Sem. {sem}
                      </span>
                    </td>

                    {/* Taller */}
                    <td style={{...td, fontWeight:500}}>{a.talleres?.nombre ?? '—'}</td>

                    {/* Causal */}
                    <td style={td}>
                      <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500,
                        background:ccfg.bg, color:ccfg.color}}>
                        {ccfg.icon} {ccfg.label}
                      </span>
                    </td>

                    {/* Concepto */}
                    <td style={{...td, maxWidth:300, fontSize:11, color:'#444'}}>
                      {a.concepto}
                    </td>

                    {/* Monto */}
                    <td style={{...td, textAlign:'right', fontWeight:500, color:'#991B1B'}}>
                      {fmt(a.monto_sin_iva)}
                    </td>

                    {/* Referencia al origen */}
                    <td style={td}>
                      {esConteo && a.conteos?.numero_conteo ? (
                        <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500,
                          background:'#FEF9C3', color:'#854D0E'}}>
                          Conteo #{a.conteos.numero_conteo}
                        </span>
                      ) : a.movimientos?.appointment_id ? (
                        <span style={{fontFamily:'monospace', fontSize:10, background:'#F1EFE8',
                          padding:'2px 6px', borderRadius:5}}>
                          {a.movimientos.appointment_id}
                        </span>
                      ) : <span style={{color:'#ccc'}}>—</span>}
                    </td>

                    {/* Confirmado en sistema */}
                    <td style={td}>
                      {!canEdit ? (
                        a.confirmado
                          ? <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500, background:'#DCFCE7', color:'#166534'}}>✅ Cargado</span>
                          : <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, background:'#F1EFE8', color:'#888'}}>⏳ Pendiente</span>
                      ) : a.confirmado ? (
                        <div style={{display:'flex', flexDirection:'column', gap:4}}>
                          <span style={{padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:500,
                            background:'#DCFCE7', color:'#166534'}}>
                            ✅ Cargado
                          </span>
                          <button onClick={()=>desconfirmar(a)} disabled={saving===a.id}
                            style={{fontSize:9, padding:'1px 6px', border:'0.5px solid #ccc',
                              borderRadius:5, cursor:'pointer', background:'white', color:'#888'}}>
                            Deshacer
                          </button>
                        </div>
                      ) : (
                        <button onClick={()=>confirmar(a)} disabled={saving===a.id}
                          style={{padding:'4px 10px', background:'#1a4f8a', color:'white',
                            border:'none', borderRadius:7, fontSize:11, cursor:'pointer',
                            fontWeight:500, opacity:saving===a.id?0.6:1, whiteSpace:'nowrap'}}>
                          {saving===a.id ? '...' : 'Confirmar carga'}
                        </button>
                      )}
                    </td>

                    {/* Fecha de carga */}
                    <td style={{...td, fontSize:11, color:'#888'}}>
                      {a.fecha_confirmacion ?? <span style={{color:'#ccc'}}>—</span>}
                    </td>

                    {/* Confirmado por */}
                    <td style={{...td, fontSize:11, color:'#888'}}>
                      {a.confirmador?.nombre ?? <span style={{color:'#ccc'}}>—</span>}
                    </td>
                    {canEdit && (
                      <td style={td}>
                        {!a.confirmado && (
                          <button onClick={()=>setConfirmElim(a)}
                            style={{background:'#FCEBEB', color:'#A32D2D', border:'none', borderRadius:6, padding:'3px 9px', fontSize:11, cursor:'pointer'}}>
                            Eliminar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            {ajustesFilt.length > 0 && (
              <tfoot>
                <tr style={{background:'#f5f5f3', borderTop:'2px solid #e0dfd8'}}>
                  <td colSpan={6} style={{...td, fontWeight:500, textAlign:'right', color:'#555'}}>
                    Total filtrado s/IVA
                  </td>
                  <td style={{...td, textAlign:'right', fontWeight:500, color:'#991B1B', fontSize:13}}>
                    {fmt(ajustesFilt.reduce((s,a)=>s+Number(a.monto_sin_iva||0),0))}
                  </td>
                  <td colSpan={4} style={td}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {/* Modal confirmar eliminación */}
      {confirmElim && canEdit && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20}}>
          <div style={{background:'white', borderRadius:12, padding:24, width:'100%', maxWidth:400}}>
            <p style={{fontWeight:500, marginBottom:8}}>¿Eliminar ajuste #{confirmElim.numero}?</p>
            <p style={{fontSize:12, color:'#888', marginBottom:14}}>
              {confirmElim.talleres?.nombre} · {confirmElim.fecha_generado}
            </p>
            <div style={{background:'#FEF9C3', borderRadius:7, padding:'8px 12px', marginBottom:16, fontSize:11, color:'#854D0E'}}>
              ⚠ Solo se pueden eliminar ajustes que no han sido confirmados en el sistema.
            </div>
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmElim(null)}
                style={{padding:'5px 13px', border:'0.5px solid #ccc', borderRadius:7, fontSize:12, cursor:'pointer', background:'white'}}>
                Cancelar
              </button>
              <button onClick={()=>eliminarAjuste(confirmElim.id)}
                style={{background:'#DC2626', color:'white', border:'none', borderRadius:7, padding:'5px 14px', fontSize:12, cursor:'pointer', fontWeight:500}}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
