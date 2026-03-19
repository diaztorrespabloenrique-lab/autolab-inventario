import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to:'/',        label:'Dashboard',   roles:['admin','staff','proveedor','visor'], icon:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { to:'/conteos', label:'Conteos',     roles:['admin','staff','proveedor','visor'], icon:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
  { to:'/kardex',  label:'Kardex',      roles:['admin','staff','visor'],             icon:'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { to:'/pedidos', label:'Pedidos',     roles:['admin','staff','visor'],             icon:'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18' },
  { to:'/valor',   label:'Valor inv.',  roles:['admin','staff','visor'],             icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' },
  { to:'/admin',   label:'Admin',       roles:['admin'],                             icon:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 1-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
]

const ROL_BG = { admin:'#E6F1FB', staff:'#E1F5EE', proveedor:'#FAEEDA', visor:'#EAF3DE' }

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const visible = NAV.filter(n => !perfil || n.roles.includes(perfil.rol))
  async function handleSignOut() { await signOut(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside style={{ width:196, background:'#1a4f8a', flexShrink:0 }} className="flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10">
          <svg viewBox="0 0 24 24" style={{ width:15, height:15, fill:'white', flexShrink:0 }}>
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
          </svg>
          <span style={{ color:'white', fontWeight:500, fontSize:12 }}>Autolab MX</span>
        </div>

        {/* Badge de solo lectura para visor */}
        {perfil?.rol === 'visor' && (
          <div style={{ background:'rgba(255,255,255,0.1)', margin:'8px 8px 0', borderRadius:7, padding:'5px 9px', fontSize:10, color:'rgba(255,255,255,0.7)', textAlign:'center' }}>
            👁 Modo solo lectura
          </div>
        )}

        <nav className="flex-1 p-1.5">
          {visible.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to==='/'}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                borderRadius:7, marginBottom:2, fontSize:12, textDecoration:'none',
                background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                fontWeight: isActive ? 500 : 400,
              })}>
              <svg style={{ width:13, height:13, flexShrink:0 }} viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon}/>
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-2.5 border-t border-white/10">
          <p style={{ color:'white', fontSize:11, fontWeight:500 }}>{perfil?.nombre ?? '...'}</p>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>{perfil?.email ?? ''}</p>
          {perfil?.rol && (
            <span style={{ display:'inline-block', marginTop:4, padding:'1px 8px', borderRadius:20, fontSize:10, background:ROL_BG[perfil.rol]??'#eee', color:'#444' }}>
              {perfil.rol}
            </span>
          )}
          <button onClick={handleSignOut}
            style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:10, marginTop:6, cursor:'pointer', background:'none', border:'none', padding:0 }}
            className="hover:text-white">Cerrar sesión</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  )
}
