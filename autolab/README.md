# Autolab Inventario MX

App de inventario de llantas y baterías para talleres aliados.

## Stack
- React + Vite + Tailwind CSS
- Supabase (base de datos + auth + storage)
- Vercel (hosting)

---

## Requisitos previos
- Node.js 18 o superior instalado en tu computadora
- Cuenta en Supabase (supabase.com)
- Cuenta en GitHub (github.com)
- Cuenta en Vercel (vercel.com)

---

## Paso 1 — Configurar Supabase

1. Entra a supabase.com → tu proyecto
2. Ve a **SQL Editor → New query**
3. Pega el contenido de `autolab_schema_v2.sql` y da clic en **Run**
4. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**

---

## Paso 2 — Configurar el proyecto localmente

1. Descarga este proyecto y descomprímelo en una carpeta
2. Copia el archivo `.env.example` y renómbralo a `.env`
3. Abre `.env` y pega tus credenciales de Supabase:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
npm run dev
```

5. Abre http://localhost:5173 en tu navegador para probar

---

## Paso 3 — Subir a GitHub

1. Descarga GitHub Desktop: https://desktop.github.com
2. File → Add Local Repository → selecciona esta carpeta
3. Escribe un mensaje: "versión inicial"
4. Clic en **Commit to main**
5. Clic en **Publish repository** → selecciona **Private**

---

## Paso 4 — Publicar en Vercel

1. Entra a vercel.com → **Add New → Project**
2. Importa tu repositorio de GitHub
3. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL` → tu Project URL
   - `VITE_SUPABASE_ANON_KEY` → tu anon key
4. Clic en **Deploy**
5. En ~2 minutos tendrás tu URL pública

---

## Paso 5 — Crear usuarios

1. Supabase → **Authentication → Users → Add user**
2. Ingresa email y contraseña temporal
3. El perfil se crea automáticamente
4. Para cambiar el rol, entra a la app como admin → **Usuarios**

### Roles
| Rol       | Acceso |
|-----------|--------|
| admin     | Todo: inventario, kardex, pedidos, usuarios |
| staff     | Inventario, kardex, conteos, pedidos |
| proveedor | Solo conteos (registrar + subir fotos) |

---

## Estructura del proyecto

```
src/
├── contexts/
│   └── AuthContext.jsx    # Sesión y roles
├── components/
│   └── Layout.jsx         # Sidebar + navegación
├── lib/
│   └── inventario.js      # Helpers de cobertura
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx      # Matriz de inventario con filtros
│   ├── Conteos.jsx        # Tomas físicas + evidencia
│   ├── Kardex.jsx         # Movimientos
│   ├── Pedidos.jsx        # Propuesta automática de compra
│   └── Admin.jsx          # Gestión de usuarios
├── App.jsx                # Rutas protegidas por rol
├── main.jsx
├── supabase.js            # Cliente de Supabase
└── index.css
```
