# 🎲 WonBet — Microservicios (versión simple)

Arquitectura de microservicios para apuestas deportivas, con la misma estructura del ejemplo
de clase: cada servicio verifica el JWT por su cuenta, el gateway solo enruta, y la
comunicación entre servicios es directa (sin pasar por el gateway).

## 📐 Arquitectura

```
                          ┌─────────────────────────┐
                          │    🚪 API Gateway        │
                          │    Puerto: 3000          │
                          │    (Solo enruta)         │
                          └─────┬───────┬───────┬───┘
                                │       │       │
                    ┌───────────┘       │       └───────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌─────────────────┐ ┌──────────────────┐
        │  👤 ms-usuarios   │ │ 🏟️ ms-eventos   │ │  🎲 ms-apuestas  │
        │  (Node.js)        │ │ (Node.js)       │ │  (Node.js)       │
        │  Puerto: 3001     │ │ Puerto: 3002    │ │  Puerto: 3003    │
        │                   │ │                 │ │                  │
        │  ✅ Genera JWT    │ │ ✅ Verifica JWT │ │  ✅ Verifica JWT │
        │  ✅ Verifica JWT  │ │ 📂 SQLite       │ │  📂 SQLite       │
        │  📂 SQLite        │ │                 │ │                  │
        └───────────────────┘ └─────────────────┘ └──────┬───────────┘
                                       ▲                  │
                                       │    Consulta      │
                                       └──────────────────┘
                                       (comunicación interna, sin token)
```

Un frontend simple (HTML/CSS/JS, sin build) consume todo esto a través del gateway.

## 🚀 Inicio rápido

Instala dependencias una vez por servicio:

```bash
npm install --prefix ms-usuarios
npm install --prefix ms-eventos
npm install --prefix ms-apuestas
npm install --prefix gateway
npm install
```

Levanta todo con un solo comando:

```bash
npm run start:all
```

Esto corre en paralelo: `ms-usuarios` (:3001), `ms-eventos` (:3002), `ms-apuestas` (:3003),
`gateway` (:3000) y el frontend (:5500). Abre **http://localhost:5500** en el navegador.

O uno por uno, en terminales separadas:

```bash
npm run start:usuarios
npm run start:eventos
npm run start:apuestas
npm run start:gateway
npm run start:frontend
```

> Todos los `curl` van al gateway (puerto 3000), que redirige al servicio correcto.

## 📝 Pruebas con curl

### Paso 1: Crear un usuario (Usuarios — público)
```bash
curl -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana",
    "correo": "ana@wonbet.co",
    "contraseña": "123456"
  }'
```

### Paso 2: Login → Obtener token (ms-usuarios genera el JWT)
```bash
curl -X POST http://localhost:3000/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{
    "correo": "ana@wonbet.co",
    "contraseña": "123456"
  }'
```
**Respuesta:** `{ "token": "eyJ...", "correo": "ana@wonbet.co", "rol": "usuario" }`

> 📋 Copia el valor de `token` para los siguientes pasos.

### Paso 3: Ver perfil CON token (ms-usuarios verifica ✅)
```bash
curl http://localhost:3000/api/usuarios/perfil \
  -H "Authorization: Bearer PEGA_TU_TOKEN_AQUI"
```

### Paso 4: Ver perfil SIN token (rechaza ❌)
```bash
curl http://localhost:3000/api/usuarios/perfil
```
**Respuesta:** `401 - Token JWT ausente`

### Paso 5: Listar eventos CON token (ms-eventos verifica ✅)
```bash
curl http://localhost:3000/api/eventos \
  -H "Authorization: Bearer PEGA_TU_TOKEN_AQUI"
```
**Respuesta:** 3 eventos de ejemplo (uno ya está `cerrado`, para probar el rechazo del paso 7).

### Paso 6: Listar eventos SIN token (rechaza ❌)
```bash
curl http://localhost:3000/api/eventos
```

### Paso 7: Apostar (ms-apuestas verifica JWT + consulta a ms-eventos)
```bash
curl -X POST http://localhost:3000/api/apuestas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PEGA_TU_TOKEN_AQUI" \
  -d '{
    "evento_id": 1,
    "monto": 20
  }'
```
**Aquí pasan 3 cosas:**
1. `ms-apuestas` verifica el token del usuario ✅
2. `ms-apuestas` consulta a `ms-eventos` (endpoint interno, sin token) para saber la cuota y si el evento sigue abierto
3. `ms-apuestas` calcula la ganancia potencial y registra la apuesta en su propia base

### Paso 8: Ver mis apuestas
```bash
curl http://localhost:3000/api/apuestas \
  -H "Authorization: Bearer PEGA_TU_TOKEN_AQUI"
```

## 🔑 Conceptos clave

### ¿Cómo funciona el JWT en esta arquitectura?

| Paso | Qué sucede | Dónde |
|------|-----------|-------|
| 1 | El usuario envía correo + contraseña | Cliente → ms-usuarios |
| 2 | ms-usuarios valida credenciales y genera un JWT firmado con una clave secreta compartida | ms-usuarios |
| 3 | El cliente guarda el token y lo envía en cada petición | Cliente |
| 4 | Cada servicio verifica el token usando la misma clave secreta | ms-usuarios / ms-eventos / ms-apuestas |

### ¿Por qué cada servicio verifica el token por su cuenta?

Porque los tres comparten la misma clave secreta (hardcodeada en cada `middleware/auth.js`).
Eso permite que cada microservicio valide el JWT **de forma independiente**, sin llamar a
ms-usuarios para confirmarlo.

### ¿Qué hace el Gateway?

**Solo enruta.** No toca los tokens ni los headers. Reenvía la petición completa al
microservicio correcto según la URL.

### ¿Cómo se comunican los servicios entre sí?

Cuando `ms-apuestas` necesita datos de un evento, llama **directamente** a `ms-eventos`
(sin pasar por el Gateway) usando un endpoint interno (`/internal/eventos/:id`) que no
requiere autenticación.

## ☁️ Despliegue (Railway)

WonBet está desplegado en producción — 5 servicios en un mismo proyecto de Railway
(`wonbet`), cada uno igual a su versión local:

| Servicio | URL pública |
|---|---|
| Frontend | https://frontend-production-88c0.up.railway.app |
| API Gateway | https://gateway-production-0e4e.up.railway.app |

`ms-usuarios`, `ms-eventos` y `ms-apuestas` **no tienen URL pública** — solo son alcanzables
por red privada de Railway (`http://<servicio>.railway.internal:<puerto>`), igual que en local
solo hablan entre sí por `localhost`. El gateway y `ms-apuestas` reciben esas URLs internas por
variable de entorno (`USUARIOS_URL`, `EVENTOS_URL`, `APUESTAS_URL`); el frontend recibe la URL
pública del gateway como `GATEWAY_URL`, y `server.js` la inyecta en `index.html` en tiempo de
request (sin build step). En local, todas esas variables están sin definir y el código cae en
sus defaults de `localhost` — cero configuración para desarrollo.

### Redesplegar un servicio

Cada carpeta se sube independiente con el CLI de Railway, sin pasar por GitHub:

```bash
cd ms-usuarios   # o ms-eventos / ms-apuestas / gateway / frontend
railway up -p 85d055c2-e6cf-4fcb-805e-1e317880378d \
           -e 227ef570-cf15-468a-bedf-d246facce173 \
           -s <serviceId de ese servicio>
```

> Las bases SQLite de producción son efímeras (no hay volumen adjunto): cada redeploy de un
> servicio parte de datos limpios para ese servicio. Está bien para una demo/sustentación; si
> se necesita persistencia real habría que agregar un volumen de Railway por servicio.

## 📁 Estructura del proyecto

```
ms-usuarios/       # 👤 Usuarios (Node.js :3001) — registro, login, genera JWT
├── index.js
├── database.js      # SQLite + tabla usuarios
├── middleware/auth.js
└── package.json

ms-eventos/        # 🏟️ Eventos deportivos (Node.js :3002)
├── index.js         # CRUD + endpoint interno
├── database.js      # SQLite + 3 eventos de ejemplo
├── middleware/auth.js
└── package.json

ms-apuestas/       # 🎲 Apuestas (Node.js :3003)
├── index.js         # Crea apuestas + consulta a ms-eventos
├── database.js      # SQLite
├── middleware/auth.js
└── package.json

gateway/           # 🚪 API Gateway (Node.js :3000)
├── index.js         # Proxy/enrutamiento
└── package.json

frontend/          # 🖥️ Frontend simple (HTML/CSS/JS, sin build) :5500
├── index.html
├── style.css
├── app.js
└── server.js        # Servidor estático sin dependencias

_legacy-avanzado/  # Versión anterior (Prisma + PostgreSQL + Docker), archivada
```

> La carpeta `_legacy-avanzado/` guarda la versión anterior del proyecto, más avanzada
> (Postgres, Prisma, Docker). No se usa para correr la app — se dejó ahí por si quieres
> retomar algo de esa versión más adelante.
