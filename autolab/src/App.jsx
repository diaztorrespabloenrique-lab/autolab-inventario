import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Conteos from './pages/Conteos'
import Kardex from './pages/Kardex'
import Pedidos from './pages/Pedidos'
import Admin from './pages/Admin'
import ValorInventario from './pages/ValorInventario'
import Homologacion from './pages/Homologacion'
import AjustesTalleres from './pages/AjustesTalleres'

function RequireAuth({ children, roles }) {
  const { user, perfil, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:13,color:'#aaa'}}>Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && perfil && !roles.includes(perfil.rol)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="conteos"       element={<Conteos />} />
	<Route path="kardex"        element={<RequireAuth roles={['admin','staff','visor','shops']}><Kardex /></RequireAuth>} />
	<Route path="pedidos"       element={<RequireAuth roles={['admin','staff','visor','shops']}><Pedidos /></RequireAuth>} />
	<Route path="valor"         element={<RequireAuth roles={['admin','staff','visor','shops']}><ValorInventario /></RequireAuth>} />
	<Route path="homologacion"  element={<RequireAuth roles={['admin','staff','visor','shops']}><Homologacion /></RequireAuth>} />
	<Route path="ajustes-taller" element={<RequireAuth roles={['admin','shops','staff','visor']}><AjustesTalleres /></RequireAuth>} />
	<Route path="admin"         element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
      </Route>
    </Routes>
  )
}
