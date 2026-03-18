import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',        label: 'Dashboard', roles: ['admin','staff','proveedor'],
    icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { to: '/conteos', label: 'Conteos',   roles: ['admin','staff','proveedor'],
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
  { to: '/kardex',  label: 'Kardex',    roles: ['admin','staff'],
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { to: '/pedidos', label: 'Pedidos',   roles: ['admin','staff'],
    icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18' },
  { to: '/admin',   label: 'Usuarios',  roles: ['admin'],
    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 1-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
]

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()

  const visible = NAV.filter(n => !perfil || n.roles.includes(perfil.rol))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const rolBg = { admin: '#E6F1FB', staff: '#E1F5EE', proveedor: '#FAEEDA' }
  const initials = perfil?.nombre?.split(' ').map(n => n[0]).slice(0,2).join('') ?? '?'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside style={{ width: 190, background: '#1a4f8a', flexShrink: 0 }}
        className="flex flex-col overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10">
          <svg viewBox="0 0 24 24" style={{ width:16, height:16, fill:'white', flexShrink:0 }}>
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
          </svg>
          <span style={{ color:'white', fontWeight:500, fontSize:13 }}>Autolab MX</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-1.5">
          {visible.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-0.5 text-xs transition-all cursor-pointer
                 ${isActive
                   ? 'font-medium' : 'hover:bg-white/10'}` }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(255,255,255,0.2)' : undefined,
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
              })}>
              <svg style={{ width:13, height:13, flexShrink:0 }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon}/>
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-2.5 border-t border-white/10">
          <p style={{ color:'white', fontSize:11, fontWeight:500 }}>{perfil?.nombre ?? '...'}</p>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:10 }}>{perfil?.email ?? ''}</p>
          {perfil?.rol && (
            <span style={{ display:'inline-block', marginTop:4, padding:'1px 8px',
              borderRadius:20, fontSize:10, background: rolBg[perfil.rol] ?? '#eee', color:'#444' }}>
              {perfil.rol}
            </span>
          )}
          <button onClick={handleSignOut}
            style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:10, marginTop:6, cursor:'pointer', background:'none', border:'none', padding:0 }}
            className="hover:text-white transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
