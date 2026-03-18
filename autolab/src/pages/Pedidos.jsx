import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { REGIONES, CLIENTES } from '../lib/inventario'

export default function Pedidos() {
  const [inv,     setInv]     = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: i }, { data: p }] = await Promise.all([
      supabase.from('v_inventario').select('*'),
      supabase.from('pedidos')
        .select('*, pedido_items(*, talleres(nombre), skus(codigo))')
        .order('created_at', { ascending: false }),
    ])
    setInv(i ?? [])
    setPedidos(p ?? [])
    setLoading(false)
  }

  // Propuesta: filas con semanas < 2 (rotacion > 0)
  const propuesta = inv
    .filter(r => r.rotacion > 0 && r.semanas < 2)
    .map(r => ({
      ...r,
      pedir: Math.ceil(r.rotacion * 2 - r.stock),
      total: Math.ceil(r.rotacion * 2 - r.stock) * (r.precio ?? 0),
    }))
    .filter(r => r.pedir > 0)
    .sort((a, b) => a.semanas - b.semanas)

  const totalPropuesta = propuesta.reduce((s, r) => s + r.total, 0)

  async function confirmar() {
    if (propuesta.length === 0) return
    setSaving(true)
    const semana = `Semana ${getWeekNumber()} - ${new Date().toLocaleDateString('es-MX', { month:'long', year:'numeric' })}`
    const { data: pedido, error } = await supabase.from('pedidos')
      .insert({ semana, estado:'enviado', total_mxn: totalPropuesta })
      .select().single()

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    const items = propuesta.map(r => ({
      pedido_id: pedido.id, taller_id: r.taller_id, sku_id: r.sku_id,
      cantidad: r.pedir, precio_unit: r.precio ?? 0,
    }))
    await supabase.from('pedido_items').insert(items)
    load()
    setSaving(false)
  }

  function getWeekNumber() {
    const d = new Date()
    const start = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
  }

  const estCfg = {
    borrador: { l:'Borrador', bg:'#F1EFE8', color:'#444' },
    enviado:  { l:'Enviado',  bg:'#EAF3DE', color:'#27500A' },
    recibido: { l:'Recibido', bg:'#E6F1FB', color:'#0C447C' },
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div style={{ padding:20, maxWidth:1000 }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontSize:17, fontWeight:500 }}>Pedidos de compra</h1>
          <p style={{ fontSize:11, color:'#888', marginTop:2 }}>Objetivo: 2 semanas de cobertura</p>
        </div>
        <button onClick={confirmar} disabled={saving || propuesta.length === 0}
          style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8,
            padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:500,
            opacity: (saving || propuesta.length === 0) ? 0.5 : 1 }}>
          {saving ? 'Guardando...' : 'Confirmar y enviar'}
        </button>
      </div>

      {/* Propuesta actual */}
      <div style={{ background:'white', border:'0.5px solid #B5D4F4', borderTop:'3px solid #185FA5',
        borderRadius:10, padding:14, marginBottom:20 }}>
        <p style={{ fontWeight:500, marginBottom:3 }}>Propuesta semana actual</p>
        <p style={{ fontSize:11, color:'#888', marginBottom:12 }}>
          {propuesta.length} referencias · ${Math.round(totalPropuesta).toLocaleString('es-MX')} MXN
        </p>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Taller','Ciudad','Cliente','SKU','Stock','Semanas','Pedir','Total MXN'].map(h => (
                  <th key={h} style={{ padding:'6px 10px', textAlign: h==='Stock'||h==='Semanas'||h==='Pedir'||h==='Total MXN' ? 'right':'left',
                    fontWeight:500, fontSize:11, color:'#666', borderBottom:'0.5px solid #e0dfd8',
                    background:'#f5f5f3', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {propuesta.length === 0 && (
                <tr><td colSpan={8} style={{ padding:'30px', textAlign:'center', color:'#aaa' }}>
                  No hay referencias con menos de 2 semanas de cobertura
                </td></tr>
              )}
              {propuesta.map((r, i) => {
                const rc = REGIONES[r.region] ?? {}
                const cc = CLIENTES[r.cliente] ?? CLIENTES.ind
                return (
                  <tr key={i} style={{ borderBottom:'0.5px solid #f0efe8' }}>
                    <td style={{ padding:'6px 10px', fontWeight:500 }}>{r.taller}</td>
                    <td style={{ padding:'6px 10px', fontSize:10, fontWeight:500, color:rc.color }}>{rc.label}</td>
                    <td style={{ padding:'6px 10px' }}>
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:20,
                        background:cc.bg, color:cc.color, fontWeight:500 }}>{cc.label}</span>
                    </td>
                    <td style={{ padding:'6px 10px', fontFamily:'monospace', fontSize:11 }}>{r.sku}</td>
                    <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:500,
                      color: r.stock === 0 ? '#A32D2D' : 'inherit' }}>{r.stock}</td>
                    <td style={{ padding:'6px 10px', textAlign:'right' }}>
                      {r.stock === 0 ? '—' : Number(r.semanas).toFixed(1)}
                    </td>
                    <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:500, color:'#0C447C' }}>{r.pedir}</td>
                    <td style={{ padding:'6px 10px', textAlign:'right' }}>${Math.round(r.total).toLocaleString('es-MX')}</td>
                  </tr>
                )
              })}
            </tbody>
            {propuesta.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6}/>
                  <td colSpan={2} style={{ padding:'8px 10px', textAlign:'right', fontWeight:500 }}>
                    Total: ${Math.round(totalPropuesta).toLocaleString('es-MX')} MXN
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Historial */}
      <p style={{ fontSize:12, fontWeight:500, color:'#888', marginBottom:8 }}>Historial</p>
      {pedidos.map(p => {
        const est = estCfg[p.estado] ?? estCfg.borrador
        return (
          <div key={p.id} style={{ background:'white', border:'0.5px solid #e0dfd8',
            borderRadius:9, padding:'11px 14px', marginBottom:7 }}>
            <div className="flex justify-between items-center">
              <div>
                <p style={{ fontWeight:500 }}>{p.semana}</p>
                <p style={{ fontSize:11, color:'#888' }}>
                  {p.fecha} · {p.pedido_items?.length ?? 0} refs · ${Math.round(p.total_mxn ?? 0).toLocaleString('es-MX')} MXN
                </p>
              </div>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20,
                background:est.bg, color:est.color, fontWeight:500 }}>{est.l}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
