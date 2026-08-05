/**
 * bot.js — Bot de WhatsApp para Portal Horas (Alquimaq)
 * Integración: Twilio WhatsApp Sandbox
 * Instalar: npm install twilio express-session
 */

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const PORT   = 3001;   // Puerto separado del portal principal
const DB_PATH = path.join(__dirname, 'data', 'alquimaq.json');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DE CONVERSACIONES (en memoria — se pierde si el servidor reinicia)
// Para producción usar Redis
// ─────────────────────────────────────────────────────────────────────────────
const sesiones = {}; // { telefono: { paso, datos, ... } }

// ─────────────────────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(d) {
  fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2));
}
function calcH(ini, fin) {
  if (!ini || !fin) return 0;
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fin.split(':').map(Number);
  return Math.round(((hf * 60 + mf) - (hi * 60 + mi)) / 60 * 10) / 10;
}
function nextNum(db, tipo) {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefijos = { doc: 'DOC', oc: 'OC', rec: 'REC', fac: 'FAC', planilla_prov: 'PLP', planilla_cli: 'PLC' };
  const pref = prefijos[tipo] || 'DOC';
  const todos = [...(db.documentos || []), ...(db.ordenes_compra || []), ...(db.planillas_prov || []), ...(db.planillas_cliente || [])];
  const count = todos.filter(x => (x.num_documento || '').startsWith(`${pref}-${hoy}`)).length + 1;
  return `${pref}-${hoy}-${String(count).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TWILIO RESPONSE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function twiml(res, mensaje) {
  res.setHeader('Content-Type', 'text/xml');
  // Escapar caracteres especiales para XML
  const escaped = mensaje
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${escaped}</Message></Response>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATEAR HORA — asegura formato HH:MM
// ─────────────────────────────────────────────────────────────────────────────
function parsearHora(txt) {
  const t = txt.trim().replace('.', ':');
  const m = t.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK PRINCIPAL — recibe mensajes de Twilio
// ─────────────────────────────────────────────────────────────────────────────
app.post('/webhook', (req, res) => {
  const telefono = (req.body.From || '').replace('whatsapp:', '');
  const msg      = (req.body.Body || '').trim();

  if (!telefono || !msg) return twiml(res, 'Error: mensaje vacío.');

  const db = readDB();

  // ── Buscar operario por teléfono ──────────────────────────────────────────
  let operario = db.operarios.find(o =>
    o.telefono && o.telefono.replace(/\D/g,'') === telefono.replace(/\D/g,'')
  );

  // ── Inicializar sesión si no existe ──────────────────────────────────────
  if (!sesiones[telefono]) {
    sesiones[telefono] = { paso: operario ? 'menu' : 'reg_nombre', datos: {} };
  }
  const ses = sesiones[telefono];

  // ── Comando CANCELAR siempre disponible ──────────────────────────────────
  if (['CANCELAR','CANCEL','SALIR','EXIT'].includes(msg.toUpperCase())) {
    sesiones[telefono] = { paso: operario ? 'menu' : 'reg_nombre', datos: {} };
    return twiml(res, '❌ Registro cancelado.\n\nEscribe *HORAS* para registrar horas o *AYUDA* para ver los comandos.');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FLUJO: PRIMER REGISTRO (operario nuevo)
  // ════════════════════════════════════════════════════════════════════════════
  if (!operario) {
    switch (ses.paso) {

      case 'reg_nombre':
        return twiml(res,
`👷 ¡Bienvenido al sistema de Alquimaq!

Para registrarte necesito algunos datos.

📝 *¿Cuál es tu nombre completo?*`);

      case 'reg_nombre_resp':
        if (msg.length < 3) return twiml(res, '⚠ Por favor ingresa tu nombre completo.');
        ses.datos.nombre = msg;
        ses.paso = 'reg_cedula';
        return twiml(res,
`✅ Nombre: *${ses.datos.nombre}*

🪪 *Ingresa tu número de cédula de identidad:*`);

      case 'reg_cedula':
        if (!/^\d{8,13}$/.test(msg.replace(/\D/g,''))) {
          return twiml(res, '⚠ Ingresa un número de cédula válido (solo números).');
        }
        ses.datos.cedula = msg.replace(/\D/g,'');

        // Guardar operario nuevo
        const nuevoOp = {
          id: uuidv4(), nombre: ses.datos.nombre,
          cedula: ses.datos.cedula, telefono: telefono,
          actor: 'c', activo: true
        };
        db.operarios.push(nuevoOp);
        writeDB(db);
        operario = nuevoOp;
        sesiones[telefono] = { paso: 'menu', datos: {} };

        return twiml(res,
`✅ *¡Registro completado!*

👤 Nombre: ${nuevoOp.nombre}
🪪 Cédula: ${nuevoOp.cedula}

A partir de ahora escribe *HORAS* para registrar el trabajo del día.`);

      default:
        ses.paso = 'reg_nombre_resp';
        return twiml(res,
`👷 ¡Bienvenido al sistema de Alquimaq!

Para registrarte necesito algunos datos.

📝 *¿Cuál es tu nombre completo?*`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FLUJO: OPERARIO YA REGISTRADO
  // ════════════════════════════════════════════════════════════════════════════

  // ── Menú principal ────────────────────────────────────────────────────────
  if (ses.paso === 'menu' || msg.toUpperCase() === 'HORAS' || msg.toUpperCase() === 'AYUDA') {
    if (msg.toUpperCase() === 'AYUDA') {
      return twiml(res,
`📋 *Comandos disponibles:*

*HORAS* — Registrar horas del día
*CANCELAR* — Cancelar el registro en curso
*AYUDA* — Ver esta ayuda

Hola ${operario.nombre.split(' ')[0]}! ¿Qué necesitas?`);
    }
    sesiones[telefono] = { paso: 'fecha', datos: {} };
    const hoy = new Date().toLocaleDateString('es-EC', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
    return twiml(res,
`👷 Hola *${operario.nombre.split(' ')[0]}*! Vamos a registrar las horas.

━━━━━━━━━━━━━━━━━━
📅 *PASO 1 de 8 — Fecha de trabajo*
━━━━━━━━━━━━━━━━━━

¿Las horas son de hoy, *${hoy}*?

1️⃣ Sí, son de hoy
2️⃣ No, son de otra fecha`);
  }

  const datos = ses.datos;

  switch (ses.paso) {

    // ── PASO 1: FECHA ────────────────────────────────────────────────────────
    case 'fecha':
      if (msg === '1') {
        datos.fecha_trabajo = new Date().toISOString().slice(0, 10);
        datos.registro_tardio = false;
        ses.paso = 'placa';
        return twiml(res,
`✅ Fecha: *${new Date().toLocaleDateString('es-EC')}*

━━━━━━━━━━━━━━━━━━
🚜 *PASO 2 de 8 — Placa de la máquina*
━━━━━━━━━━━━━━━━━━

Ingresa el número de placa de la máquina que operaste:`);
      }
      if (msg === '2') {
        ses.paso = 'fecha_manual';
        return twiml(res,
`📅 Ingresa la fecha de trabajo:
_(formato DD/MM/AAAA — ej: 22/04/2026)_`);
      }
      return twiml(res, 'Por favor responde *1* (hoy) o *2* (otra fecha).');

    case 'fecha_manual': {
      const partes = msg.trim().split('/');
      if (partes.length !== 3) return twiml(res, '⚠ Formato incorrecto. Usa DD/MM/AAAA. Ej: 22/04/2026');
      const [d, m, a] = partes.map(Number);
      const fecha = new Date(a, m-1, d);
      if (isNaN(fecha.getTime())) return twiml(res, '⚠ Fecha inválida. Intenta de nuevo.');
      datos.fecha_trabajo = `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      datos.registro_tardio = datos.fecha_trabajo < new Date().toISOString().slice(0,10);
      ses.paso = 'placa';
      const aviso = datos.registro_tardio ? '\n\n⚠ _Esta fecha es anterior a hoy. El registro quedará marcado como tardío._' : '';
      return twiml(res,
`✅ Fecha: *${msg.trim()}*${aviso}

━━━━━━━━━━━━━━━━━━
🚜 *PASO 2 de 8 — Placa de la máquina*
━━━━━━━━━━━━━━━━━━

Ingresa el número de placa de la máquina que operaste:`);
    }

    // ── PASO 2: PLACA ────────────────────────────────────────────────────────
    case 'placa': {
      const db2 = readDB();
      const placa = msg.toUpperCase().trim();
      const maq = db2.maquinas.find(m =>
        m.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase() === placa.replace(/[^A-Z0-9]/gi,'').toUpperCase()
      );
      if (!maq) {
        return twiml(res,
`⚠ No encontré la máquina *${placa}* en el sistema.

Verifica la placa y vuelve a intentarlo.
_(Ej: EXC-034, VOL-011, MOT-007)_`);
      }
      datos.maquina_id = maq.id;
      datos.maquina_placa = maq.placa;
      datos.maquina_desc = `${maq.tipo} ${maq.marca} ${maq.modelo}`;
      ses.paso = 'obra';
      return twiml(res,
`✅ Máquina: *${maq.placa}* — ${maq.tipo} ${maq.marca} ${maq.modelo}

━━━━━━━━━━━━━━━━━━
🏗️ *PASO 3 de 8 — Obra*
━━━━━━━━━━━━━━━━━━

¿En qué obra estás trabajando?
_(Escribe el nombre de la obra)_`);
    }

    // ── PASO 3: OBRA ─────────────────────────────────────────────────────────
    case 'obra':
      if (msg.length < 2) return twiml(res, '⚠ Por favor ingresa el nombre de la obra.');
      datos.obra = msg;
      ses.paso = 'finca';
      return twiml(res,
`✅ Obra: *${datos.obra}*

━━━━━━━━━━━━━━━━━━
🌿 *Finca / Sector (opcional)*
━━━━━━━━━━━━━━━━━━

¿En qué finca o sector estás?
_(Escribe el nombre o envía un punto *.* para omitir)_`);

    // ── FINCA (opcional) ─────────────────────────────────────────────────────
    case 'finca':
      datos.finca = msg === '.' ? '' : msg;
      ses.paso = 'area';
      return twiml(res,
`✅ ${datos.finca ? `Finca: *${datos.finca}*` : 'Finca: _omitida_'}

━━━━━━━━━━━━━━━━━━
📍 *Área (opcional)*
━━━━━━━━━━━━━━━━━━

¿En qué área trabajaste?
_(Ej: Zona Norte, Sector A — o envía *.* para omitir)_`);

    // ── ÁREA (opcional) ──────────────────────────────────────────────────────
    case 'area':
      datos.area = msg === '.' ? '' : msg;
      ses.paso = 'combustible';
      return twiml(res,
`✅ ${datos.area ? `Área: *${datos.area}*` : 'Área: _omitida_'}

━━━━━━━━━━━━━━━━━━
⛽ *Combustible (opcional)*
━━━━━━━━━━━━━━━━━━

¿Cuánto combustible se utilizó?
_(Ej: 45 galones — o envía *.* para omitir)_`);

    // ── COMBUSTIBLE (opcional) ───────────────────────────────────────────────
    case 'combustible':
      datos.combustible = msg === '.' ? '' : msg;
      ses.paso = 'horas_manana';
      return twiml(res,
`✅ ${datos.combustible ? `Combustible: *${datos.combustible}*` : 'Combustible: _omitido_'}

━━━━━━━━━━━━━━━━━━
☀️ *PASO 4 de 8 — Jornada mañana*
━━━━━━━━━━━━━━━━━━

¿Vas a registrar horas de la *mañana*?

1️⃣ Sí
2️⃣ No`);

    // ── PASO 4: HORAS MAÑANA ─────────────────────────────────────────────────
    case 'horas_manana':
      if (msg === '1') {
        ses.paso = 'manana_inicio';
        return twiml(res,
`☀️ Ingresa la hora de *inicio* de la mañana:
_(formato HH:MM — ej: 07:00)_`);
      }
      if (msg === '2') {
        datos.manana_inicio = null; datos.manana_fin = null;
        ses.paso = 'horas_tarde';
        return twiml(res,
`☀️ Mañana: _no registrada_

━━━━━━━━━━━━━━━━━━
🌤️ *PASO 5 de 8 — Jornada tarde*
━━━━━━━━━━━━━━━━━━

¿Vas a registrar horas de la *tarde*?

1️⃣ Sí
2️⃣ No`);
      }
      return twiml(res, 'Responde *1* (Sí) o *2* (No).');

    case 'manana_inicio': {
      const h = parsearHora(msg);
      if (!h) return twiml(res, '⚠ Formato inválido. Usa HH:MM — ej: 07:00');
      datos.manana_inicio = h;
      ses.paso = 'manana_fin';
      return twiml(res, `☀️ Inicio mañana: *${h}*\n\nIngresa la hora de *fin* de la mañana:`);
    }

    case 'manana_fin': {
      const h = parsearHora(msg);
      if (!h) return twiml(res, '⚠ Formato inválido. Usa HH:MM — ej: 12:00');
      if (h <= datos.manana_inicio) return twiml(res, `⚠ La hora de fin (${h}) debe ser mayor a la de inicio (${datos.manana_inicio}).`);
      datos.manana_fin = h;
      const hm = calcH(datos.manana_inicio, datos.manana_fin);
      ses.paso = 'horas_tarde';
      return twiml(res,
`✅ Jornada mañana: *${datos.manana_inicio} → ${datos.manana_fin}* (${hm} h)

━━━━━━━━━━━━━━━━━━
🌤️ *PASO 5 de 8 — Jornada tarde*
━━━━━━━━━━━━━━━━━━

¿Vas a registrar horas de la *tarde*?

1️⃣ Sí
2️⃣ No`);
    }

    // ── PASO 5: HORAS TARDE ──────────────────────────────────────────────────
    case 'horas_tarde':
      if (msg === '1') {
        ses.paso = 'tarde_inicio';
        return twiml(res,
`🌤️ Ingresa la hora de *inicio* de la tarde:
_(formato HH:MM — ej: 13:00)_`);
      }
      if (msg === '2') {
        datos.tarde_inicio = null; datos.tarde_fin = null;
        ses.paso = 'total_horas';
        const hm = calcH(datos.manana_inicio, datos.manana_fin);
        const sugerido = hm > 0 ? hm : '';
        return twiml(res,
`🌤️ Tarde: _no registrada_

━━━━━━━━━━━━━━━━━━
⏱️ *PASO 6 de 8 — Total de horas*
━━━━━━━━━━━━━━━━━━

Ingresa el *total de horas* trabajadas hoy:
${sugerido ? `_(Según los rangos ingresados: ${sugerido} h)_` : '_(Número con decimales — ej: 8.5)_'}`);
      }
      return twiml(res, 'Responde *1* (Sí) o *2* (No).');

    case 'tarde_inicio': {
      const h = parsearHora(msg);
      if (!h) return twiml(res, '⚠ Formato inválido. Usa HH:MM — ej: 13:00');
      datos.tarde_inicio = h;
      ses.paso = 'tarde_fin';
      return twiml(res, `🌤️ Inicio tarde: *${h}*\n\nIngresa la hora de *fin* de la tarde:`);
    }

    case 'tarde_fin': {
      const h = parsearHora(msg);
      if (!h) return twiml(res, '⚠ Formato inválido. Usa HH:MM — ej: 17:30');
      if (h <= datos.tarde_inicio) return twiml(res, `⚠ La hora de fin (${h}) debe ser mayor a la de inicio (${datos.tarde_inicio}).`);
      datos.tarde_fin = h;
      const hm = calcH(datos.manana_inicio, datos.manana_fin);
      const ht = calcH(datos.tarde_inicio, datos.tarde_fin);
      const total_rangos = Math.round((hm + ht) * 10) / 10;
      ses.paso = 'total_horas';
      return twiml(res,
`✅ Jornada tarde: *${datos.tarde_inicio} → ${datos.tarde_fin}* (${ht} h)

━━━━━━━━━━━━━━━━━━
⏱️ *PASO 6 de 8 — Total de horas*
━━━━━━━━━━━━━━━━━━

Ingresa el *total de horas* trabajadas hoy:
_(Según los rangos ingresados: *${total_rangos} h*)_`);
    }

    // ── PASO 6: TOTAL HORAS ──────────────────────────────────────────────────
    case 'total_horas': {
      const total = parseFloat(msg.replace(',', '.'));
      if (isNaN(total) || total <= 0 || total > 24) {
        return twiml(res, '⚠ Ingresa un número válido de horas (ej: 8.5)');
      }
      // Validar contra rangos
      const hm = calcH(datos.manana_inicio, datos.manana_fin);
      const ht = calcH(datos.tarde_inicio, datos.tarde_fin);
      const rangos = Math.round((hm + ht) * 10) / 10;
      if (rangos > 0 && Math.abs(rangos - total) > 0.2) {
        return twiml(res,
`⚠ *Discrepancia detectada*

Los rangos ingresados suman *${rangos} h*
pero declaras *${total} h*.

Por favor corrige el total o vuelve a ingresar las jornadas.
Ingresa el total correcto de horas:`);
      }
      datos.total_horas_declaradas = total;
      ses.paso = 'horometro_ini';
      return twiml(res,
`✅ Total horas: *${total} h*

━━━━━━━━━━━━━━━━━━
📊 *PASO 7 de 8 — Horómetro*
━━━━━━━━━━━━━━━━━━

Ingresa el valor del horómetro al *inicio* del trabajo:
_(Número con decimales — ej: 4210.3)_`);
    }

    // ── PASO 7: HORÓMETRO ────────────────────────────────────────────────────
    case 'horometro_ini': {
      const v = parseFloat(msg.replace(',', '.'));
      if (isNaN(v) || v < 0) return twiml(res, '⚠ Ingresa un valor numérico válido. Ej: 4210.3');
      datos.horometro_inicio = v;
      ses.paso = 'horometro_fin';
      return twiml(res,
`📊 Horómetro inicio: *${v}*

Ingresa el valor del horómetro al *fin* del trabajo:`);
    }

    case 'horometro_fin': {
      const v = parseFloat(msg.replace(',', '.'));
      if (isNaN(v) || v < 0) return twiml(res, '⚠ Ingresa un valor numérico válido. Ej: 4219.8');
      if (v <= datos.horometro_inicio) {
        return twiml(res, `⚠ El horómetro final (${v}) debe ser mayor al inicial (${datos.horometro_inicio}).`);
      }
      const difHoro = Math.round((v - datos.horometro_inicio) * 10) / 10;
      const difTotal = Math.abs(difHoro - datos.total_horas_declaradas);
      datos.horometro_fin = v;

      // Advertencia si el horómetro no cuadra (tolerancia 0.5 h)
      const advertencia = difTotal > 0.5
        ? `\n\n⚠ _El horómetro indica ${difHoro} h pero declaraste ${datos.total_horas_declaradas} h. El supervisor verá esta diferencia._`
        : `\n✅ _Horómetro cuadra con las horas declaradas._`;

      ses.paso = 'observaciones';
      return twiml(res,
`📊 Horómetro fin: *${v}* (Δ ${difHoro} h)${advertencia}

━━━━━━━━━━━━━━━━━━
💬 *Observaciones (opcional)*
━━━━━━━━━━━━━━━━━━

¿Alguna observación sobre el trabajo de hoy?
_(Escribe la observación o envía *.* para omitir)_`);
    }

    // ── OBSERVACIONES (opcional) ─────────────────────────────────────────────
    case 'observaciones':
      datos.observaciones = msg === '.' ? '' : msg;
      ses.paso = 'resumen';

      // Construir resumen
      const hm2  = calcH(datos.manana_inicio, datos.manana_fin);
      const ht2  = calcH(datos.tarde_inicio, datos.tarde_fin);
      const jManana = datos.manana_inicio ? `${datos.manana_inicio}→${datos.manana_fin} (${hm2}h)` : '_No registrada_';
      const jTarde  = datos.tarde_inicio  ? `${datos.tarde_inicio}→${datos.tarde_fin} (${ht2}h)`   : '_No registrada_';

      return twiml(res,
`━━━━━━━━━━━━━━━━━━
📋 *PASO 8 de 8 — RESUMEN*
━━━━━━━━━━━━━━━━━━

Revisa la información antes de enviar:

📅 *Fecha de trabajo:* ${datos.fecha_trabajo}
🚜 *Máquina:* ${datos.maquina_placa} — ${datos.maquina_desc}
🏗️ *Obra:* ${datos.obra}
${datos.finca ? `🌿 *Finca:* ${datos.finca}\n` : ''}${datos.area ? `📍 *Área:* ${datos.area}\n` : ''}${datos.combustible ? `⛽ *Combustible:* ${datos.combustible}\n` : ''}☀️ *Jornada mañana:* ${jManana}
🌤️ *Jornada tarde:* ${jTarde}
⏱️ *Total horas:* ${datos.total_horas_declaradas} h
📊 *Horómetro:* ${datos.horometro_inicio} → ${datos.horometro_fin}${datos.observaciones ? `\n💬 *Observaciones:* ${datos.observaciones}` : ''}
📅 *Fecha registro:* ${new Date().toLocaleString('es-EC')}

━━━━━━━━━━━━━━━━━━
¿Deseas corregir algo?

1️⃣ ✅ *Confirmar y enviar*
2️⃣ ✏️ *Corregir un dato*`);

    // ── PASO 8: CONFIRMAR O CORREGIR ────────────────────────────────────────
    case 'resumen':
      if (msg === '1') {
        // Guardar en base de datos
        const db3 = readDB();
        const nuevo = {
          id: uuidv4(),
          num_documento: nextNum(db3, 'doc'),
          operario_id: operario.id,
          cliente_id: operario.cliente_id || null,
          proyecto_id: null,
          maquina_id: datos.maquina_id,
          fecha_trabajo: datos.fecha_trabajo,
          fecha_registro: new Date().toISOString(),
          obra: datos.obra,
          finca: datos.finca || '',
          area: datos.area || '',
          combustible: datos.combustible || '',
          observaciones: datos.observaciones || '',
          supervisor_alquimaq: '',
          supervisor_cliente: '',
          manana_inicio: datos.manana_inicio,
          manana_fin: datos.manana_fin,
          tarde_inicio: datos.tarde_inicio,
          tarde_fin: datos.tarde_fin,
          total_horas_declaradas: datos.total_horas_declaradas,
          horometro_inicio: datos.horometro_inicio,
          horometro_fin: datos.horometro_fin,
          foto_url: null,
          registro_tardio: datos.registro_tardio || false,
          status: 'pendiente_b',
          aprobacion_b: null,
          aprobacion_c: null
        };
        db3.documentos.push(nuevo);
        writeDB(db3);

        // Resetear sesión
        sesiones[telefono] = { paso: 'menu', datos: {} };

        return twiml(res,
`✅ *¡Registro enviado exitosamente!* 🎉

━━━━━━━━━━━━━━━━━━
🗂️ *No. Documento:* ${nuevo.num_documento}
📅 Fecha de trabajo: ${datos.fecha_trabajo}
🚜 Máquina: ${datos.maquina_placa}
⏱️ Horas: ${datos.total_horas_declaradas} h
━━━━━━━━━━━━━━━━━━

El registro está *pendiente de aprobación* por el controlador de Alquimaq.

_Escribe *HORAS* para registrar otro día._`);
      }

      if (msg === '2') {
        ses.paso = 'corregir';
        return twiml(res,
`✏️ ¿Qué dato deseas corregir?

1️⃣ Fecha de trabajo
2️⃣ Placa de la máquina
3️⃣ Obra
4️⃣ Finca
5️⃣ Área
6️⃣ Combustible
7️⃣ Jornada mañana
8️⃣ Jornada tarde
9️⃣ Total de horas
🔟 Horómetro
1️⃣1️⃣ Observaciones`);
      }
      return twiml(res, 'Responde *1* para confirmar o *2* para corregir.');

    // ── CORRECCIÓN ───────────────────────────────────────────────────────────
    case 'corregir':
      const opcion = msg.trim();
      if (opcion === '1')  { ses.paso = 'fecha';          return twiml(res, '📅 ¿Las horas son de hoy?\n\n1️⃣ Sí\n2️⃣ No, otra fecha'); }
      if (opcion === '2')  { ses.paso = 'placa';          return twiml(res, '🚜 Ingresa la placa de la máquina:'); }
      if (opcion === '3')  { ses.paso = 'obra';           return twiml(res, '🏗️ Ingresa el nombre de la obra:'); }
      if (opcion === '4')  { ses.paso = 'finca';          return twiml(res, '🌿 Ingresa la finca (o *.* para omitir):'); }
      if (opcion === '5')  { ses.paso = 'area';           return twiml(res, '📍 Ingresa el área (o *.* para omitir):'); }
      if (opcion === '6')  { ses.paso = 'combustible';    return twiml(res, '⛽ Ingresa el combustible (o *.* para omitir):'); }
      if (opcion === '7')  { ses.paso = 'manana_inicio';  return twiml(res, '☀️ Ingresa la hora de INICIO de la mañana (HH:MM):'); }
      if (opcion === '8')  { ses.paso = 'tarde_inicio';   return twiml(res, '🌤️ Ingresa la hora de INICIO de la tarde (HH:MM):'); }
      if (opcion === '9')  { ses.paso = 'total_horas';    return twiml(res, '⏱️ Ingresa el total de horas:'); }
      if (opcion === '10') { ses.paso = 'horometro_ini';  return twiml(res, '📊 Ingresa el horómetro INICIAL:'); }
      if (opcion === '11') { ses.paso = 'observaciones';  return twiml(res, '💬 Ingresa las observaciones (o *.* para omitir):'); }
      return twiml(res, '⚠ Selecciona una opción del 1 al 11.');

    default:
      sesiones[telefono] = { paso: 'menu', datos: {} };
      return twiml(res, `Hola ${operario.nombre.split(' ')[0]}! Escribe *HORAS* para registrar el trabajo del día.`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sesiones_activas: Object.keys(sesiones).length });
});

app.listen(PORT, () => {
  console.log(`\n✅  Bot WhatsApp corriendo en http://localhost:${PORT}`);
  console.log(`📱  Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`\n⚠️  Recuerda exponer este puerto con ngrok:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`   Luego configura en Twilio: https://TU-URL.ngrok.io/webhook\n`);
});
