import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background:'#f5f5f3' }}>
      <div style={{ background:'white', border:'0.5px solid #d3d1c7', borderRadius:16,
        padding:32, width:320 }}>

        <div className="text-center mb-6">
          <div style={{ width:44, height:44, background:'#1a4f8a', borderRadius:11,
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <svg viewBox="0 0 24 24" style={{ width:22, height:22, fill:'white' }}>
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
            </svg>
          </div>
          <h1 style={{ fontSize:16, fontWeight:500 }}>Autolab Inventario MX</h1>
          <p style={{ fontSize:12, color:'#888', marginTop:4 }}>Ingresa con tu correo y contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>
              Correo electrónico
            </label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #ccc',
                borderRadius:8, fontSize:13, outline:'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#666', display:'block', marginBottom:3 }}>
              Contraseña
            </label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width:'100%', padding:'7px 10px', border:'0.5px solid #ccc',
                borderRadius:8, fontSize:13, outline:'none' }}
            />
          </div>

          {error && (
            <p style={{ fontSize:12, color:'#A32D2D', background:'#FCEBEB',
              padding:'7px 10px', borderRadius:7 }}>{error}</p>
          )}

          <button type="submit" disabled={loading}
            style={{ background:'#1a4f8a', color:'white', border:'none', borderRadius:8,
              padding:'9px', fontSize:13, cursor:'pointer', fontWeight:500,
              opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
