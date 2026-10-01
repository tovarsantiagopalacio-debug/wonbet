// Todas las peticiones pasan por el API Gateway, nunca directo a un microservicio.
// window.__GATEWAY_URL__ lo inyecta server.js cuando GATEWAY_URL viene seteada
// (ej. desplegado en Railway); en local no existe y se usa el default de abajo.
const GATEWAY_URL = window.__GATEWAY_URL__ || 'http://localhost:3000';

const elSesionInfo = document.getElementById('sesion-info');
const elUsuarioActual = document.getElementById('usuario-actual');
const elSeccionAuth = document.getElementById('seccion-auth');
const elSeccionApp = document.getElementById('seccion-app');

const elAvisoServidor = document.getElementById('aviso-servidor');

const tabLogin = document.getElementById('tab-login');
const tabRegistro = document.getElementById('tab-registro');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');

function guardarSesion(token, correo, rol) {
  localStorage.setItem('wonbet_token', token);
  localStorage.setItem('wonbet_correo', correo);
  localStorage.setItem('wonbet_rol', rol);
}

function obtenerToken() {
  return localStorage.getItem('wonbet_token');
}

function cerrarSesion() {
  localStorage.removeItem('wonbet_token');
  localStorage.removeItem('wonbet_correo');
  localStorage.removeItem('wonbet_rol');
  mostrarVista();
}

async function llamarApi(ruta, opciones = {}) {
  const token = obtenerToken();
  const headers = { 'Content-Type': 'application/json', ...(opciones.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${GATEWAY_URL}${ruta}`, { ...opciones, headers });
  } catch (error) {
    // El fetch ni siquiera llegó a responder: el gateway está caído.
    // (Si el gateway está arriba pero el microservicio destino no, el gateway
    // mismo responde con un 502 y un mensaje claro, que sí llega hasta acá.)
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo "npm run start:all"?');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ---------- Cambiar entre tabs Login / Registro ----------
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('activo');
  tabRegistro.classList.remove('activo');
  formLogin.classList.remove('oculto');
  formRegistro.classList.add('oculto');
});

tabRegistro.addEventListener('click', () => {
  tabRegistro.classList.add('activo');
  tabLogin.classList.remove('activo');
  formRegistro.classList.remove('oculto');
  formLogin.classList.add('oculto');
});

// ---------- Registro ----------
formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const elError = document.getElementById('registro-error');
  const elOk = document.getElementById('registro-ok');
  elError.textContent = '';
  elOk.textContent = '';

  try {
    await llamarApi('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: document.getElementById('reg-nombre').value,
        correo: document.getElementById('reg-correo').value,
        contraseña: document.getElementById('reg-contraseña').value,
      }),
    });
    elOk.textContent = 'Cuenta creada. Ahora inicia sesión.';
    formRegistro.reset();
    tabLogin.click();
  } catch (err) {
    elError.textContent = err.message;
  }
});

// ---------- Login ----------
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const elError = document.getElementById('login-error');
  elError.textContent = '';

  try {
    const data = await llamarApi('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({
        correo: document.getElementById('login-correo').value,
        contraseña: document.getElementById('login-contraseña').value,
      }),
    });
    guardarSesion(data.token, data.correo, data.rol);
    formLogin.reset();
    mostrarVista();
  } catch (err) {
    elError.textContent = err.message;
  }
});

document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

// ---------- Eventos ----------
async function cargarEventos() {
  const tbody = document.getElementById('tabla-eventos');
  tbody.innerHTML = '';
  const eventos = await llamarApi('/api/eventos');

  for (const ev of eventos) {
    const abierto = ev.estado === 'abierto';
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${ev.nombre}</td>
      <td>${ev.cuota.toFixed(2)}</td>
      <td><span class="badge ${ev.estado}">${ev.estado}</span></td>
      <td><input type="number" min="1" step="0.01" class="monto-input" placeholder="$" ${abierto ? '' : 'disabled'} /></td>
      <td><button class="apostar-btn" ${abierto ? '' : 'disabled'}>Apostar</button></td>
    `;
    const input = fila.querySelector('.monto-input');
    fila.querySelector('.apostar-btn').addEventListener('click', () => apostar(ev.id, input.value));
    tbody.appendChild(fila);
  }
}

async function apostar(eventoId, monto) {
  const elError = document.getElementById('apuesta-error');
  const elOk = document.getElementById('apuesta-ok');
  elError.textContent = '';
  elOk.textContent = '';

  if (!monto || Number(monto) <= 0) {
    elError.textContent = 'Ingresa un monto válido';
    return;
  }

  try {
    const data = await llamarApi('/api/apuestas', {
      method: 'POST',
      body: JSON.stringify({ evento_id: eventoId, monto: Number(monto) }),
    });
    elOk.textContent = `¡Apuesta registrada! Ganancia potencial: $${data.apuesta.ganancia_potencial.toFixed(2)}`;
    cargarApuestas();
  } catch (err) {
    elError.textContent = err.message;
  }
}

// ---------- Mis apuestas ----------
async function cargarApuestas() {
  const tbody = document.getElementById('tabla-apuestas');
  tbody.innerHTML = '';
  const apuestas = await llamarApi('/api/apuestas');

  for (const ap of apuestas) {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${ap.evento_nombre}</td>
      <td>$${ap.monto.toFixed(2)}</td>
      <td>${ap.cuota.toFixed(2)}</td>
      <td>$${ap.ganancia_potencial.toFixed(2)}</td>
      <td>${ap.fecha}</td>
    `;
    tbody.appendChild(fila);
  }
}

// ---------- Mostrar login o app según si hay sesión ----------
function mostrarVista() {
  const token = obtenerToken();
  if (token) {
    elSeccionAuth.classList.add('oculto');
    elSeccionApp.classList.remove('oculto');
    elSesionInfo.classList.remove('oculto');
    elUsuarioActual.textContent = `${localStorage.getItem('wonbet_correo')} (${localStorage.getItem('wonbet_rol')})`;
    elAvisoServidor.classList.add('oculto');
    Promise.all([cargarEventos(), cargarApuestas()]).catch((err) => {
      elAvisoServidor.textContent = `⚠️ ${err.message}`;
      elAvisoServidor.classList.remove('oculto');
    });
  } else {
    elSeccionAuth.classList.remove('oculto');
    elSeccionApp.classList.add('oculto');
    elSesionInfo.classList.add('oculto');
  }
}

mostrarVista();
