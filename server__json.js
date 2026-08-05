const express = require('express');
const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');
const ExcelJS = require('exceljs');
const PDFDoc  = require('pdfkit');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = 3000;

const DATA_DIR    = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
const DB_PATH = path.join(DATA_DIR, 'alquimaq.json');

// ─────────────────────────────────────────────────────────────────────────────
// BASE DE DATOS SEED
// ─────────────────────────────────────────────────────────────────────────────
function seedDB() {
  return {
    // B = Alquimaq
    alquimaq: { id: 'alquimaq', nombre: 'Alquimaq', ruc: '0990000002001', email: 'info@alquimaq.com' },
    // A = Proveedores (varios)
    proveedores: [
      { id: 'prov1', nombre: 'Maquinaria López', ruc: '0910000001001', contacto: 'Pedro López', email: 'plopez@maqlopez.com', activo: true },
      { id: 'prov2', nombre: 'Equipos García',   ruc: '0910000002001', contacto: 'Luis García',  email: 'lgarcia@eqgarcia.com', activo: true }
    ],
    // C = Clientes (Produmar y otros)
    clientes: [
      { id: 'c1', nombre: 'Produmar',           ruc: '0990123456001', contacto: 'Mauricio Naranjo', email: 'mnaranjo@produmar.com',   activo: true },
      { id: 'c2', nombre: 'Constructora Norte', ruc: '0991234567001', contacto: 'Ana Paredes',      email: 'aparedes@cnorte.com',     activo: true }
    ],
    usuarios: [
      { id: 'u1', nombre: 'Roberto Sánchez', email: 'rsanchez@alquimaq.com',   password: '1234', rol: 'controlador_b', actor: 'b' },
      { id: 'u2', nombre: 'Fernando Díaz',   email: 'fdiaz@alquimaq.com',      password: '1234', rol: 'admin_b',       actor: 'b' },
      { id: 'u3', nombre: 'María Castro',    email: 'mcastro@produmar.com',    password: '1234', rol: 'controlador_c', actor: 'c', cliente_id: 'c1' },
      { id: 'u4', nombre: 'Jorge Medina',    email: 'jmedina@produmar.com',    password: '1234', rol: 'supervisor_c',  actor: 'c', cliente_id: 'c1' },
      { id: 'u5', nombre: 'Laura Vera',      email: 'lvera@produmar.com',      password: '1234', rol: 'coordinador_c', actor: 'c', cliente_id: 'c1' },
      { id: 'u6', nombre: 'Carlos Ruiz',     email: 'cruiz@cnorte.com',        password: '1234', rol: 'controlador_c', actor: 'c', cliente_id: 'c2' },
      { id: 'u8', nombre: 'Luis Mora',      email: 'lmora@produmar.com',      password: '1234', rol: 'supervisor_c', actor: 'c', cliente_id: 'c1' },
      { id: 'u7', nombre: 'Ana Torres',      email: 'atorres@maqlopez.com',    password: '1234', rol: 'admin_prov',    actor: 'a', proveedor_id: 'prov1' }
    ],
    proyectos: [
      { id: 'p1', cliente_id: 'c1', nombre: 'Vía Perimetral km 12',   ubicacion: 'Guayaquil',   activo: true },
      { id: 'p2', cliente_id: 'c1', nombre: 'Samborondón Bypass',     ubicacion: 'Samborondón', activo: true },
      { id: 'p3', cliente_id: 'c2', nombre: 'Edificio Norte Torre A', ubicacion: 'Quito',       activo: true }
    ],
    operarios: [
      { id: 'op1', nombre: 'Carlos Mora Reyes', cedula: '0924567890', telefono: '0991111001', actor: 'c', cliente_id: 'c1',    activo: true },
      { id: 'op2', nombre: 'Miguel Torres',     cedula: '0912345678', telefono: '0991111002', actor: 'b',                      activo: true },
      { id: 'op3', nombre: 'Luis Pinto',        cedula: '0934567891', telefono: '0991111003', actor: 'a', proveedor_id:'prov1',activo: true }
    ],
    maquinas: [
      { id: 'm1', placa: 'EXC-034', tipo: 'Excavadora',    marca: 'Komatsu',    modelo: 'PC200',  propietario: 'alquimaq', tarifa_a_c: 45, tarifa_a_b: null, activa: true },
      { id: 'm2', placa: 'VOL-011', tipo: 'Volqueta',      marca: 'Hino',       modelo: '500',    propietario: 'alquimaq', tarifa_a_c: 38, tarifa_a_b: null, activa: true },
      { id: 'm3', placa: 'MOT-007', tipo: 'Motoniveladora',marca: 'Caterpillar',modelo: '120K',   propietario: 'prov1',    tarifa_a_c: 42, tarifa_a_b: 32,   activa: true },
      { id: 'm4', placa: 'COM-022', tipo: 'Compactadora',  marca: 'Dynapac',    modelo: 'CA250',  propietario: 'alquimaq', tarifa_a_c: 40, tarifa_a_b: null, activa: true },
      { id: 'm5', placa: 'EXC-019', tipo: 'Excavadora',    marca: 'Hitachi',    modelo: 'ZX130',  propietario: 'prov2',    tarifa_a_c: 48, tarifa_a_b: 35,   activa: true }
    ],
    // CAMBIO 2: registros → documentos; folio → num_documento
    documentos: [
      { id: 'doc1', num_documento: 'DOC-20260422-0001',
        operario_id: 'op1', cliente_id: 'c1', proyecto_id: 'p1', maquina_id: 'm1',
        fecha_trabajo: '2026-04-22', fecha_registro: '2026-04-22T08:10:00',
        finca: 'Finca La Esperanza', area: 'Zona Norte',
        combustible: '45 galones',
        obra: 'Vía Perimetral km 12',
        supervisor_alquimaq: 'Roberto Sánchez', supervisor_cliente: 'María Castro', supervisor_cliente_sup: '',
        observaciones: '',
        manana_inicio: '07:00', manana_fin: '12:00', tarde_inicio: '13:00', tarde_fin: '17:00',
        total_horas_declaradas: 9, horometro_inicio: 4201, horometro_fin: 4210,
        foto_url: null, registro_tardio: false,
        status: 'aprobado_c',
        aprobacion_b: { usuario_id: 'u1', nombre: 'Roberto Sánchez', fecha: '2026-04-22T09:00:00', notas: '' },
        aprobacion_c: { usuario_id: 'u3', nombre: 'María Castro',    fecha: '2026-04-22T10:30:00', notas: '' }
      },
      { id: 'doc2', num_documento: 'DOC-20260422-0002',
        operario_id: 'op2', cliente_id: 'c1', proyecto_id: 'p1', maquina_id: 'm3',
        fecha_trabajo: '2026-04-22', fecha_registro: '2026-04-22T08:45:00',
        finca: 'Finca El Progreso', area: 'Zona Sur',
        combustible: '30 galones',
        obra: 'Vía Perimetral km 12',
        supervisor_alquimaq: 'Roberto Sánchez', supervisor_cliente: 'María Castro', supervisor_cliente_sup: '',
        observaciones: '',
        manana_inicio: '07:00', manana_fin: '12:00', tarde_inicio: null, tarde_fin: null,
        total_horas_declaradas: 5, horometro_inicio: 7810, horometro_fin: 7815,
        foto_url: null, registro_tardio: false,
        status: 'aprobado_c',
        aprobacion_b: { usuario_id: 'u1', nombre: 'Roberto Sánchez', fecha: '2026-04-22T09:15:00', notas: '' },
        aprobacion_c: { usuario_id: 'u3', nombre: 'María Castro',    fecha: '2026-04-22T11:00:00', notas: '' }
      },
      { id: 'doc3', num_documento: 'DOC-20260423-0001',
        operario_id: 'op1', cliente_id: 'c1', proyecto_id: 'p2', maquina_id: 'm1',
        fecha_trabajo: '2026-04-23', fecha_registro: '2026-04-23T08:05:00',
        finca: 'Finca San José', area: 'Sector A',
        combustible: '38 galones',
        obra: 'Samborondón Bypass',
        supervisor_alquimaq: 'Roberto Sánchez', supervisor_cliente: 'María Castro', supervisor_cliente_sup: '',
        observaciones: 'Terreno con roca',
        manana_inicio: '07:00', manana_fin: '12:00', tarde_inicio: '13:00', tarde_fin: '16:00',
        total_horas_declaradas: 8, horometro_inicio: 4210, horometro_fin: 4218,
        foto_url: null, registro_tardio: false,
        status: 'pendiente_b', aprobacion_b: null, aprobacion_c: null
      },
      { id: 'doc4', num_documento: 'DOC-20260423-0002',
        operario_id: 'op3', cliente_id: 'c1', proyecto_id: 'p1', maquina_id: 'm3',
        fecha_trabajo: '2026-04-23', fecha_registro: '2026-04-23T09:00:00',
        finca: 'Finca La Esperanza', area: 'Zona Norte',
        combustible: '25 galones',
        obra: 'Vía Perimetral km 12',
        supervisor_alquimaq: 'Roberto Sánchez', supervisor_cliente: 'María Castro', supervisor_cliente_sup: '',
        observaciones: '',
        manana_inicio: '08:00', manana_fin: '12:00', tarde_inicio: '13:00', tarde_fin: '17:00',
        total_horas_declaradas: 8, horometro_inicio: 7815, horometro_fin: 7823,
        foto_url: null, registro_tardio: false,
        status: 'pendiente_c',
        aprobacion_b: { usuario_id: 'u1', nombre: 'Roberto Sánchez', fecha: '2026-04-23T10:00:00', notas: '' },
        aprobacion_c: null
      }
    ],
    // CAMBIO 2: plantillas → planillas
    planillas_prov: [
      { id: 'pp1', proveedor_id: 'prov1', semana_inicio: '2026-04-14', semana_fin: '2026-04-20',
        documentos_ids: [], total_horas: 42, total_monto: 1386,
        num_documento: 'PLA-20260421-0001', status: 'pagada',
        aprobacion_b: { usuario_id: 'u1', fecha: '2026-04-21T09:00:00' },
        oc_id: 'oc1', recepcion_id: 'rec1', factura_id: 'fac1',
        cerrada_en: '2026-04-21T08:00:00', creada_en: '2026-04-14T00:00:00' }
    ],
    planillas_cliente: [
      { id: 'pc1', cliente_id: 'c1', periodo_inicio: '2026-04-01', periodo_fin: null,
        documentos_ids: ['doc1','doc2'], total_horas: 14, total_monto: 633,
        num_documento: null, status: 'abierta',
        aprobacion_c: null, oc_b_id: null, recepcion_c_id: null, factura_b_id: null,
        cerrada_en: null, creada_en: '2026-04-01T00:00:00' }
    ],
    fincas: [
      { id: 'f1', nombre: 'Finca La Esperanza', cliente_id: 'c1', activa: true },
      { id: 'f2', nombre: 'Finca El Progreso',  cliente_id: 'c1', activa: true },
      { id: 'f3', nombre: 'Finca San José',      cliente_id: 'c1', activa: true },
      { id: 'f4', nombre: 'Finca Garzal',        cliente_id: 'c2', activa: true }
    ],
    ordenes_compra: [
      { id: 'oc1', tipo: 'prov_a_alquimaq', emisor_id: 'prov1', receptor: 'alquimaq',
        planilla_id: 'pp1', monto: 1386, num_documento: 'OC-20260421-0001',
        status: 'pagada', fecha: '2026-04-21T10:00:00' }
    ],
    recepciones: [
      { id: 'rec1', tipo: 'alquimaq_recibe_de_prov', planilla_id: 'pp1', monto: 1386,
        num_documento: 'REC-20260421-0001', status: 'emitida', fecha: '2026-04-21T11:00:00' }
    ],
    facturas: [
      { id: 'fac1', tipo: 'prov_factura_alquimaq', emisor_id: 'prov1', receptor: 'alquimaq',
        planilla_id: 'pp1', monto: 1386, numero: 'FAC-001',
        num_documento: 'FAC-20260421-0001', status: 'pagada', fecha: '2026-04-21T12:00:00' }
    ],
    // Contador de documentos
    contadores: { doc: 4, planilla_prov: 1, planilla_cli: 0, oc: 1, rec: 1, fac: 1 }
  };
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) { const d = seedDB(); fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); return d; }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); }

function nextNum(db, tipo) {
  if (!db.contadores) db.contadores = { doc: 0, planilla_prov: 0, planilla_cli: 0, oc: 0, rec: 0, fac: 0 };
  db.contadores[tipo] = (db.contadores[tipo] || 0) + 1;
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const n   = String(db.contadores[tipo]).padStart(4, '0');
  const prefijos = { doc: 'DOC', planilla_prov: 'PLA', planilla_cli: 'PLA', oc: 'OC', rec: 'REC', fac: 'FAC' };
  return `${prefijos[tipo] || 'NUM'}-${hoy}-${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Normaliza cualquier formato de hora a HH:MM (24h)
// Acepta: 10am, 5pm, 10:30am, 17:30, 10.00, 1000, 10h, 10:00
function normalizarHora(txt) {
  if (!txt) return null;
  const s = txt.toString().trim().toLowerCase().replace(/\s+/g,'');

  // Formato con am/pm
  const ampm = s.match(/^(\d{1,2})(?:[.:]?(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2] || '0');
    const period = ampm[3];
    if (period === 'am') { if (h === 12) h = 0; }
    else                 { if (h !== 12) h += 12; }
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Formato HH:MM o HH.MM
  const hhmm = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (hhmm) {
    const h = parseInt(hhmm[1]), m = parseInt(hhmm[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Formato HHMM (4 dígitos)
  const hhmm4 = s.match(/^(\d{2})(\d{2})$/);
  if (hhmm4) {
    const h = parseInt(hhmm4[1]), m = parseInt(hhmm4[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Solo hora (ej: 10h, 10)
  const soloH = s.match(/^(\d{1,2})h?$/);
  if (soloH) {
    const h = parseInt(soloH[1]);
    if (h < 0 || h > 23) return null;
    return `${String(h).padStart(2,'0')}:00`;
  }

  return null;
}

// Buscar controlador por nombre aproximado (para Jelou)
// Normaliza mayúsculas, tildes y espacios
// ─────────────────────────────────────────────────────────────────────────────
function normalizarNombre(str) {
  return (str || '').toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/\s+/g, ' ')                               // espacios múltiples
    .trim();
}

function calcH(ini, fin) {
  if (!ini || !fin) return 0;
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fin.split(':').map(Number);
  return Math.round(((hf * 60 + mf) - (hi * 60 + mi)) / 60 * 10) / 10;
}

function semanaLunes(f) {
  const d = new Date(f + 'T12:00:00'); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

function enrich(r, db) {
  const op = db.operarios.find(x => x.id === r.operario_id) || {};
  const cl = db.clientes.find(x => x.id === r.cliente_id) || {};
  const pr = db.proyectos.find(x => x.id === r.proyecto_id) || {};
  const mq = db.maquinas.find(x => x.id === r.maquina_id) || {};
  const esProv = mq.propietario && mq.propietario !== 'alquimaq';
  const prov   = esProv ? (db.proveedores.find(x => x.id === mq.propietario) || {}) : null;
  const hm = calcH(r.manana_inicio, r.manana_fin);
  const ht = calcH(r.tarde_inicio, r.tarde_fin);
  const hR = Math.round((hm + ht) * 10) / 10;
  const difHoro = r.horometro_inicio != null && r.horometro_fin != null
    ? Math.round((r.horometro_fin - r.horometro_inicio) * 10) / 10 : null;
  return {
    ...r,
    operario_nombre: op.nombre || '—', cedula: op.cedula || '—',
    cliente_nombre: cl.nombre || '—', proyecto_nombre: pr.nombre || '—',
    maquina_placa: mq.placa || '—', maquina_tipo: mq.tipo || '—',
    maquina_desc: `${mq.marca || ''} ${mq.modelo || ''}`.trim(),
    es_proveedor: esProv, proveedor_nombre: prov?.nombre || null,
    tarifa_a_c: mq.tarifa_a_c || 0, tarifa_a_b: mq.tarifa_a_b || 0,
    horas_manana: hm, horas_tarde: ht, horas_rangos: hR,
    area: r.area || '',
    horometro_diferencia: difHoro,
    discrepancia_horas: hR > 0 && Math.abs(hR - (r.total_horas_declaradas || 0)) > 0.1,
    discrepancia_horometro: difHoro !== null && Math.abs(difHoro - (r.total_horas_declaradas || 0)) > 0.2,
    registro_tardio: r.fecha_trabajo < r.fecha_registro.slice(0, 10)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }), limits: { fileSize: 10 * 1024 * 1024 }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const u = readDB().usuarios.find(x => x.email === req.body.email && x.password === req.body.password);
  if (!u) return res.status(401).json({ error: 'Credenciales incorrectas' });
  res.json({ ...u, password: undefined });
});

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGOS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/clientes',    (_, res) => res.json(readDB().clientes));
app.get('/api/proveedores', (_, res) => res.json(readDB().proveedores));
app.get('/api/maquinas',    (_, res) => res.json(readDB().maquinas));

// Validar placa para Jelou
app.get('/api/maquinas/placa/:placa', (req, res) => {
  const db  = readDB();
  const placa = req.params.placa.toUpperCase().trim();
  const maq = db.maquinas.find(m =>
    m.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase() === placa.replace(/[^A-Z0-9]/gi,'').toUpperCase()
  );
  if (!maq) return res.status(404).json({ existe: false });
  res.json({ existe: true, id: maq.id, placa: maq.placa, tipo: maq.tipo, marca: maq.marca, modelo: maq.modelo });
});
app.get('/api/operarios',   (_, res) => res.json(readDB().operarios));
//app.get('/api/usuarios',    (_, res) => res.json(readDB().usuarios.map(u => ({ ...u, password: undefined }))));
app.get('/api/usuarios', (req, res) => {
  const db = readDB();
  let list = db.usuarios;
  if (req.query.cliente_id) list = list.filter(u => u.cliente_id === req.query.cliente_id);
  if (req.query.proveedor_id) list = list.filter(u => u.proveedor_id === req.query.proveedor_id);
  res.json(list.map(u => ({...u, password:undefined})));
});
app.get('/api/proyectos', (req, res) => {
  const db = readDB();
  res.json(req.query.cliente_id ? db.proyectos.filter(p => p.cliente_id === req.query.cliente_id && p.activo) : db.proyectos);
});

app.post('/api/clientes',    (req, res) => { const db=readDB(); const n={id:uuidv4(),...req.body,activo:true}; db.clientes.push(n); writeDB(db); res.status(201).json(n); });
app.post('/api/proveedores', (req, res) => { const db=readDB(); const n={id:uuidv4(),...req.body,activo:true}; db.proveedores.push(n); writeDB(db); res.status(201).json(n); });
app.post('/api/maquinas',    (req, res) => { const db=readDB(); const n={id:uuidv4(),...req.body,tarifa_a_c:parseFloat(req.body.tarifa_a_c)||0,tarifa_a_b:parseFloat(req.body.tarifa_a_b)||null,activa:true}; db.maquinas.push(n); writeDB(db); res.status(201).json(n); });
app.post('/api/operarios',   (req, res) => { const db=readDB(); const n={id:uuidv4(),...req.body,activo:true}; db.operarios.push(n); writeDB(db); res.status(201).json(n); });
app.post('/api/proyectos',   (req, res) => { const db=readDB(); const n={id:uuidv4(),...req.body,activo:true}; db.proyectos.push(n); writeDB(db); res.status(201).json(n); });
app.post('/api/usuarios', (req, res) => {
  const db = readDB();
  if (!req.body.nombre || !req.body.email || !req.body.password)
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  if (db.usuarios.find(u => u.email === req.body.email))
    return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
  const n = { id: uuidv4(), ...req.body };
  db.usuarios.push(n); writeDB(db);
  res.status(201).json({ ...n, password: undefined });
});

app.patch('/api/usuarios/:id', (req, res) => {
  const db = readDB();
  const u  = db.usuarios.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  // Verificar email único si cambia
  if (req.body.email && req.body.email !== u.email) {
    if (db.usuarios.find(x => x.email === req.body.email))
      return res.status(400).json({ error: 'Ese email ya está en uso' });
  }
  // Actualizar solo campos enviados
  const { nombre, email, password, rol, actor, cliente_id, proveedor_id } = req.body;
  if (nombre)       u.nombre       = nombre;
  if (email)        u.email        = email;
  if (password)     u.password     = password;
  if (rol)          u.rol          = rol;
  if (actor)        u.actor        = actor;
  if (cliente_id  !== undefined) u.cliente_id   = cliente_id  || null;
  if (proveedor_id !== undefined) u.proveedor_id = proveedor_id || null;
  writeDB(db);
  res.json({ ...u, password: undefined });
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS (antes registros)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/documentos', (req, res) => {
  const db = readDB();
  let list = db.documentos.map(r => enrich(r, db));
  const { status, cliente_id, maquina_id, desde, hasta, proveedor_id, area, finca_filter } = req.query;
  if (status)       list = list.filter(r => r.status === status);
  if (cliente_id)   list = list.filter(r => r.cliente_id === cliente_id);
  if (maquina_id)   list = list.filter(r => r.maquina_id === maquina_id);
  if (desde)        list = list.filter(r => r.fecha_trabajo >= desde);
  if (hasta)        list = list.filter(r => r.fecha_trabajo <= hasta);
  if (area)         list = list.filter(r => r.area && r.area.toLowerCase().includes(area.toLowerCase()));
  if (finca_filter) list = list.filter(r => r.finca && r.finca.toLowerCase().includes(finca_filter.toLowerCase()));
  // CAMBIO 1: proveedor solo ve docs de sus máquinas
  if (proveedor_id) {
    const maqsProv = db.maquinas.filter(m => m.propietario === proveedor_id).map(m => m.id);
    list = list.filter(r => maqsProv.includes(r.maquina_id));
  }
  list.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
  res.json(list);
});

// CAMBIO 3: validación antes de crear — el servidor verifica que todo cuadre
app.post('/api/documentos', upload.single('foto'), (req, res) => {
  try {
    const db = readDB();
    const {
      operario_id, cliente_id, proyecto_id, maquina_id, fecha_trabajo,
      finca, area, combustible, observaciones,
      supervisor_alquimaq, supervisor_cliente, supervisor_cliente_sup, obra,
      manana_inicio, manana_fin, tarde_inicio, tarde_fin,
      total_horas_declaradas, horometro_inicio, horometro_fin
    } = req.body;

    if (!maquina_id || !fecha_trabajo || !obra || !total_horas_declaradas)
      return res.status(400).json({ error: 'Campos obligatorios incompletos' });

    const hm  = calcH(manana_inicio, manana_fin);
    const ht  = calcH(tarde_inicio, tarde_fin);
    const hR  = Math.round((hm + ht) * 10) / 10;
    const hD  = parseFloat(total_horas_declaradas);
    const hIni = horometro_inicio ? parseFloat(horometro_inicio) : null;
    const hFin = horometro_fin    ? parseFloat(horometro_fin)    : null;
    const difHoro = hIni !== null && hFin !== null ? Math.round((hFin - hIni) * 10) / 10 : null;

    // CAMBIO 3: validación estricta
    const errores = [];
    if (hR > 0 && Math.abs(hR - hD) > 0.1)
      errores.push(`Los rangos de horas (${hR}h) no coinciden con el total declarado (${hD}h).`);
    if (difHoro !== null && Math.abs(difHoro - hD) > 0.2)
      errores.push(`La diferencia del horómetro (${difHoro}h) no coincide con el total declarado (${hD}h).`);
    if (errores.length > 0)
      return res.status(422).json({ error: 'Verificación fallida', detalles: errores });

    const nuevo = {
      id: uuidv4(),
      num_documento: nextNum(db, 'doc'),
      operario_id: operario_id || null, cliente_id: cliente_id || null,
      proyecto_id: proyecto_id || null, maquina_id,
      fecha_trabajo, fecha_registro: new Date().toISOString(),
      finca: finca || '', area: area || '',
      combustible: combustible || '',
      observaciones: observaciones || '',
      supervisor_alquimaq:    (() => {
        const u = db.usuarios.find(x => normalizarNombre(x.nombre) === normalizarNombre(supervisor_alquimaq));
        return u ? u.nombre : (supervisor_alquimaq || '');
      })(),
      supervisor_cliente:     (() => {
        const u = db.usuarios.find(x => normalizarNombre(x.nombre) === normalizarNombre(supervisor_cliente));
        return u ? u.nombre : (supervisor_cliente || '');
      })(),
      supervisor_cliente_sup: supervisor_cliente_sup || '',
      obra,
      manana_inicio: manana_inicio || null, manana_fin: manana_fin || null,
      tarde_inicio: tarde_inicio || null,   tarde_fin: tarde_fin || null,
      total_horas_declaradas: hD,
      horometro_inicio: hIni, horometro_fin: hFin,
      foto_url: req.file ? `/uploads/${req.file.filename}` : null,
      status: 'pendiente_b', aprobacion_b: null, aprobacion_c: null
    };

    db.documentos.push(nuevo);
    writeDB(db);
    res.status(201).json(enrich(nuevo, db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Validar sin guardar (para el frontend en tiempo real)
app.post('/api/documentos/validar', (req, res) => {
  const { manana_inicio, manana_fin, tarde_inicio, tarde_fin,
          total_horas_declaradas, horometro_inicio, horometro_fin } = req.body;
  const hm  = calcH(manana_inicio, manana_fin);
  const ht  = calcH(tarde_inicio, tarde_fin);
  const hR  = Math.round((hm + ht) * 10) / 10;
  const hD  = parseFloat(total_horas_declaradas) || 0;
  const hIni = horometro_inicio ? parseFloat(horometro_inicio) : null;
  const hFin = horometro_fin    ? parseFloat(horometro_fin)    : null;
  const difHoro = hIni !== null && hFin !== null ? Math.round((hFin - hIni) * 10) / 10 : null;
  const errores = [];
  if (hR > 0 && Math.abs(hR - hD) > 0.1)
    errores.push(`Rangos de horas suman ${hR}h pero declaraste ${hD}h.`);
  if (difHoro !== null && Math.abs(difHoro - hD) > 0.2)
    errores.push(`Horómetro indica ${difHoro}h pero declaraste ${hD}h.`);
  res.json({ ok: errores.length === 0, errores, horas_rangos: hR, horometro_diferencia: difHoro });
});

// Aprobaciones — CAMBIO 7: solo actúa si el estado es el correcto
app.patch('/api/documentos/:id/aprobar_b', (req, res) => {
  const db  = readDB();
  const r   = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_b') return res.status(400).json({ error: 'Ya procesado' });
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  // controlador_b solo puede aprobar si es el controlador asignado en el documento
  if (usr.rol === 'controlador_b' && r.supervisor_alquimaq && r.supervisor_alquimaq !== usr.nombre)
    return res.status(403).json({ error: `Este documento está asignado al controlador "${r.supervisor_alquimaq}". Solo él o el admin pueden aprobarlo.` });
  r.status = 'pendiente_c';
  r.aprobacion_b = { usuario_id: req.body.usuario_id, nombre: req.body.nombre, fecha: new Date().toISOString(), notas: req.body.notas || '' };
  writeDB(db); res.json(enrich(r, db));
});

app.patch('/api/documentos/:id/rechazar_b', (req, res) => {
  const db  = readDB();
  const r   = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_b') return res.status(400).json({ error: 'Ya procesado' });
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  if (usr.rol === 'controlador_b' && r.supervisor_alquimaq && r.supervisor_alquimaq !== usr.nombre)
    return res.status(403).json({ error: `Este documento está asignado al controlador "${r.supervisor_alquimaq}". Solo él o el admin pueden rechazarlo.` });
  r.status = 'rechazado_b';
  r.aprobacion_b = { usuario_id: req.body.usuario_id, nombre: req.body.nombre, fecha: new Date().toISOString(), notas: req.body.notas || '' };
  writeDB(db); res.json(enrich(r, db));
});

app.patch('/api/documentos/:id/aprobar_c', (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_c') return res.status(400).json({ error: 'Ya procesado' });
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  // Solo actor 'c' puede aprobar en nombre del cliente
  if (usr.actor === 'b') return res.status(403).json({ error: 'El equipo de Alquimaq no puede aprobar en nombre del cliente' });
  // coordinador_c no aprueba documentos individuales
  if (usr.rol === 'coordinador_c') return res.status(403).json({ error: 'El coordinador no aprueba documentos individuales. Esa función es del controlador o supervisor.' });
  // controlador_c solo aprueba si es el controlador asignado en el documento
  if (usr.rol === 'controlador_c' && r.supervisor_cliente && r.supervisor_cliente !== usr.nombre)
    return res.status(403).json({ error: `Este documento está asignado al controlador "${r.supervisor_cliente}". Solo él o el supervisor pueden aprobarlo.` });
  r.status = 'aprobado_c';
  r.aprobacion_c = { usuario_id: req.body.usuario_id, nombre: req.body.nombre, fecha: new Date().toISOString(), notas: req.body.notas || '' };
  // Agregar a planilla cliente abierta
  const mq = db.maquinas.find(x => x.id === r.maquina_id) || {};
  if (r.cliente_id) {
    let pc = db.planillas_cliente.find(p => p.cliente_id === r.cliente_id && p.status === 'abierta');
    if (!pc) {
      pc = { id: uuidv4(), cliente_id: r.cliente_id, periodo_inicio: r.fecha_trabajo,
        periodo_fin: null, documentos_ids: [], total_horas: 0, total_monto: 0,
        num_documento: null, status: 'abierta', aprobacion_c: null,
        oc_b_id: null, recepcion_c_id: null, factura_b_id: null,
        cerrada_en: null, creada_en: new Date().toISOString() };
      db.planillas_cliente.push(pc);
    }
    if (!pc.documentos_ids.includes(r.id)) {
      pc.documentos_ids.push(r.id);
      pc.total_horas  = Math.round((pc.total_horas + r.total_horas_declaradas) * 10) / 10;
      pc.total_monto  = Math.round((pc.total_monto + r.total_horas_declaradas * (mq.tarifa_a_c || 0)) * 100) / 100;
    }
  }
  // CAMBIO 5: planilla prov abierta por proveedor (sin separación semanal)
  if (mq.propietario && mq.propietario !== 'alquimaq') {
    let pp = db.planillas_prov.find(p => p.proveedor_id === mq.propietario && p.status === 'abierta');
    if (!pp) {
      pp = { id: uuidv4(), proveedor_id: mq.propietario,
        documentos_ids: [], total_horas: 0, total_monto: 0,
        num_documento: null, status: 'abierta',
        aprobacion_b: null, oc_id: null, recepcion_id: null, factura_id: null,
        cerrada_en: null, creada_en: new Date().toISOString() };
      db.planillas_prov.push(pp);
    }
    if (!pp.documentos_ids.includes(r.id)) {
      pp.documentos_ids.push(r.id);
      pp.total_horas = Math.round((pp.total_horas + r.total_horas_declaradas) * 10) / 10;
      pp.total_monto = Math.round((pp.total_monto + r.total_horas_declaradas * (mq.tarifa_a_b || 0)) * 100) / 100;
    }
  }
  writeDB(db); res.json(enrich(r, db));
});

app.patch('/api/documentos/:id/rechazar_c', (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_c') return res.status(400).json({ error: 'Ya procesado' });
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  if (usr.actor === 'b') return res.status(403).json({ error: 'El equipo de Alquimaq no puede rechazar en nombre del cliente' });
  if (usr.rol === 'coordinador_c') return res.status(403).json({ error: 'El coordinador no rechaza documentos individuales.' });
  if (usr.rol === 'controlador_c' && r.supervisor_cliente && r.supervisor_cliente !== usr.nombre)
    return res.status(403).json({ error: `Este documento está asignado al controlador "${r.supervisor_cliente}". Solo él o el supervisor pueden rechazarlo.` });
  r.status = 'rechazado_c';
  r.aprobacion_c = { usuario_id: req.body.usuario_id, nombre: req.body.nombre, fecha: new Date().toISOString(), notas: req.body.notas || '' };
  writeDB(db); res.json(enrich(r, db));
});


// ─────────────────────────────────────────────────────────────────────────────
// EDICIÓN DE DOCUMENTOS (horas)
// ─────────────────────────────────────────────────────────────────────────────
app.patch('/api/documentos/:id', upload.single('foto'), (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  // Solo editable si está pendiente (no aprobado ni en planilla cerrada)
  if (!['pendiente_b','pendiente_c','rechazado_b','rechazado_c'].includes(r.status))
    return res.status(400).json({ error: 'Solo se pueden editar documentos pendientes o rechazados' });
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  // controlador_b solo edita sus documentos
  if (usr.rol === 'controlador_b' && r.supervisor_alquimaq && r.supervisor_alquimaq !== usr.nombre)
    return res.status(403).json({ error: 'Solo el controlador asignado o el admin puede editar este documento' });
  // controlador_c solo edita sus documentos
  if (usr.rol === 'controlador_c' && r.supervisor_cliente && r.supervisor_cliente !== usr.nombre)
    return res.status(403).json({ error: 'Solo el controlador asignado o el supervisor pueden editar este documento' });

  // Campos editables
  const editables = ['fecha_trabajo','obra','area','finca','combustible','observaciones',
    'manana_inicio','manana_fin','tarde_inicio','tarde_fin',
    'total_horas_declaradas','horometro_inicio','horometro_fin',
    'supervisor_alquimaq','supervisor_cliente'];
  editables.forEach(f => { if (req.body[f] !== undefined) r[f] = f.includes('horas') || f.includes('horometro') ? parseFloat(req.body[f]) : req.body[f]; });
  if (req.file) r.foto_url = `/uploads/${req.file.filename}`;

  // Re-validar horas
  function calcH(ini,fin) {
    if (!ini||!fin) return 0;
    const [hi,mi]=ini.split(':').map(Number); const [hf,mf]=fin.split(':').map(Number);
    return Math.round(((hf*60+mf)-(hi*60+mi))/60*10)/10;
  }
  const hm  = calcH(r.manana_inicio, r.manana_fin);
  const ht  = calcH(r.tarde_inicio,  r.tarde_fin);
  const hR  = Math.round((hm+ht)*10)/10;
  const dif = r.horometro_inicio && r.horometro_fin ? Math.round((r.horometro_fin - r.horometro_inicio)*10)/10 : null;
  const errores = [];
  if (hR > 0 && Math.abs(hR - r.total_horas_declaradas) > 0.1)
    errores.push(`Rangos suman ${hR}h pero declaraste ${r.total_horas_declaradas}h.`);
  if (dif !== null && Math.abs(dif - r.total_horas_declaradas) > 0.2)
    errores.push(`Horómetro indica ${dif}h pero declaraste ${r.total_horas_declaradas}h.`);
  if (errores.length) return res.status(400).json({ error: 'Error de validación', detalles: errores });

  // Volver a pendiente_b si estaba rechazado
  if (r.status === 'rechazado_b') { r.status = 'pendiente_b'; r.aprobacion_b = null; r.aprobacion_c = null; }
  if (r.status === 'rechazado_c') { r.status = 'pendiente_c'; r.aprobacion_c = null; }
  r.editado_en = new Date().toISOString();
  r.editado_por = usr.nombre || req.body.usuario_id;

  writeDB(db); res.json(enrich(r, db));
});

// ─────────────────────────────────────────────────────────────────────────────
// EDICIÓN DE MAESTROS (con validación de proceso abierto)
// ─────────────────────────────────────────────────────────────────────────────
function tieneProcesoAbierto(db, tipo, id) {
  if (tipo === 'cliente') {
    return db.planillas_cliente.some(p => p.cliente_id === id && p.status === 'abierta') ||
           db.documentos.some(d => d.cliente_id === id && ['pendiente_b','pendiente_c'].includes(d.status));
  }
  if (tipo === 'proveedor') {
    const maqIds = db.maquinas.filter(m => m.propietario === id).map(m => m.id);
    return db.planillas_prov.some(p => p.proveedor_id === id && p.status === 'abierta') ||
           db.documentos.some(d => maqIds.includes(d.maquina_id) && ['pendiente_b','pendiente_c'].includes(d.status));
  }
  if (tipo === 'maquina') {
    return db.planillas_prov.some(p => p.status === 'abierta' && db.documentos.some(d => p.documentos_ids.includes(d.id) && d.maquina_id === id)) ||
           db.documentos.some(d => d.maquina_id === id && ['pendiente_b','pendiente_c'].includes(d.status));
  }
  return false;
}

app.patch('/api/clientes/:id', (req, res) => {
  const db = readDB();
  const e  = db.clientes.find(x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'No encontrado' });
  const { nombre, ruc, contacto, email, activo } = req.body;
  // Solo bloquear si cambia campos críticos y hay proceso abierto
  const cambiaCritico = nombre !== undefined || activo !== undefined;
  if (cambiaCritico && tieneProcesoAbierto(db, 'cliente', req.params.id))
    return res.status(400).json({ error: 'No se puede modificar: hay documentos pendientes o planillas abiertas de este cliente' });
  if (nombre  !== undefined) e.nombre  = nombre;
  if (ruc     !== undefined) e.ruc     = ruc;
  if (contacto!== undefined) e.contacto= contacto;
  if (email   !== undefined) e.email   = email;
  if (activo  !== undefined) e.activo  = activo;
  writeDB(db); res.json(e);
});

app.patch('/api/proveedores/:id', (req, res) => {
  const db = readDB();
  const e  = db.proveedores.find(x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'No encontrado' });
  const cambiaCritico = req.body.nombre !== undefined || req.body.activo !== undefined;
  if (cambiaCritico && tieneProcesoAbierto(db, 'proveedor', req.params.id))
    return res.status(400).json({ error: 'No se puede modificar: hay documentos pendientes o planillas abiertas de este proveedor' });
  ['nombre','ruc','contacto','email','activo'].forEach(f => { if (req.body[f] !== undefined) e[f] = req.body[f]; });
  writeDB(db); res.json(e);
});

app.patch('/api/maquinas/:id', (req, res) => {
  const db = readDB();
  const m  = db.maquinas.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'No encontrado' });
  const cambiaCritico = req.body.tarifa_a_c !== undefined || req.body.tarifa_a_b !== undefined || req.body.propietario !== undefined || req.body.activa !== undefined;
  if (cambiaCritico && tieneProcesoAbierto(db, 'maquina', req.params.id))
    return res.status(400).json({ error: 'No se puede modificar tarifa/propietario: hay documentos pendientes o planillas abiertas con esta máquina' });
  ['placa','tipo','marca','modelo','propietario','activa'].forEach(f => { if (req.body[f] !== undefined) m[f] = req.body[f]; });
  if (req.body.tarifa_a_c !== undefined) m.tarifa_a_c = parseFloat(req.body.tarifa_a_c);
  if (req.body.tarifa_a_b !== undefined) m.tarifa_a_b = parseFloat(req.body.tarifa_a_b)||null;
  writeDB(db); res.json(m);
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLAS PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/planillas_prov', (req, res) => {
  const db = readDB();
  let list = db.planillas_prov;
  if (req.query.proveedor_id) list = list.filter(p => p.proveedor_id === req.query.proveedor_id);
  if (req.query.status)       list = list.filter(p => p.status === req.query.status);
  if (req.query.desde)        list = list.filter(p => p.creada_en >= req.query.desde);
  if (req.query.hasta)        list = list.filter(p => p.creada_en <= req.query.hasta + 'T23:59:59');
  res.json(list.map(p => {
    let docs = db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db));
    if (req.query.placa)      docs = docs.filter(r => r.maquina_placa === req.query.placa);
    if (req.query.proyecto_id)docs = docs.filter(r => r.proyecto_id === req.query.proyecto_id);
    if (req.query.finca)      docs = docs.filter(r => req.query.finca ? r.finca && r.finca.toLowerCase().includes(req.query.finca.toLowerCase()) : true);
    if (req.query.area)       docs = docs.filter(r => req.query.area  ? r.area  && r.area.toLowerCase().includes(req.query.area.toLowerCase())   : true);
    return { ...p,
      proveedor_nombre: (db.proveedores.find(x => x.id === p.proveedor_id) || {}).nombre || '—',
      documentos: docs
    };
  }));
});

// CAMBIO 4: cerrar planilla con selección de documentos específicos
app.post('/api/planillas_prov/:id/cerrar_parcial', (req, res) => {
  const db = readDB();
  const p  = db.planillas_prov.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  if (p.status !== 'abierta') return res.status(400).json({ error: 'Planilla no está abierta' });
  const docsSeleccionados = req.body.documentos_ids || [];
  if (!docsSeleccionados.length) return res.status(400).json({ error: 'Selecciona al menos un documento' });
  // Validar que todos los docs pertenecen a esta planilla
  const invalidos = docsSeleccionados.filter(id => !p.documentos_ids.includes(id));
  if (invalidos.length) return res.status(400).json({ error: 'Documentos no pertenecen a esta planilla' });
  // Calcular totales de los docs seleccionados
  const docsData = db.documentos.filter(r => docsSeleccionados.includes(r.id));
  const maqMap = {};
  db.maquinas.forEach(m => maqMap[m.id] = m);
  const totalHoras = docsData.reduce((s, r) => s + (r.total_horas_declaradas || 0), 0);
  const totalMonto = docsData.reduce((s, r) => s + (r.total_horas_declaradas || 0) * ((maqMap[r.maquina_id] || {}).tarifa_a_b || 0), 0);
  // Crear nueva planilla cerrada con los docs seleccionados
  const nueva = {
    id: uuidv4(), proveedor_id: p.proveedor_id,
    documentos_ids: docsSeleccionados,
    total_horas: Math.round(totalHoras * 10) / 10,
    total_monto: Math.round(totalMonto * 100) / 100,
    num_documento: nextNum(db, 'planilla_prov'),
    status: 'pendiente_factura',
    aprobacion_b: { usuario_id: req.body.usuario_id, fecha: new Date().toISOString() },
    oc_id: null, recepcion_id: null, factura_id: null,
    cerrada_en: new Date().toISOString(), creada_en: new Date().toISOString()
  };
  // Generar OC y recepción automáticas
  const oc  = { id: uuidv4(), tipo: 'prov_a_alquimaq', emisor_id: p.proveedor_id, receptor: 'alquimaq',
    planilla_id: nueva.id, monto: nueva.total_monto, num_documento: nextNum(db, 'oc'), status: 'emitida', fecha: new Date().toISOString() };
  const rec = { id: uuidv4(), tipo: 'alquimaq_recibe_de_prov', planilla_id: nueva.id, monto: nueva.total_monto,
    num_documento: nextNum(db, 'rec'), status: 'emitida', fecha: new Date().toISOString() };
  db.ordenes_compra.push(oc); nueva.oc_id = oc.id;
  db.recepciones.push(rec);   nueva.recepcion_id = rec.id;
  db.planillas_prov.push(nueva);
  // Quitar docs seleccionados de la planilla abierta y recalcular
  p.documentos_ids = p.documentos_ids.filter(id => !docsSeleccionados.includes(id));
  const docsRest = db.documentos.filter(r => p.documentos_ids.includes(r.id));
  p.total_horas = Math.round(docsRest.reduce((s, r) => s + (r.total_horas_declaradas || 0), 0) * 10) / 10;
  p.total_monto = Math.round(docsRest.reduce((s, r) => s + (r.total_horas_declaradas || 0) * ((maqMap[r.maquina_id] || {}).tarifa_a_b || 0), 0) * 100) / 100;
  writeDB(db); res.json(nueva);
});

// CAMBIO 5: planillas prov ya no se separan por semana — permanecen abiertas hasta que B las cierre
app.patch('/api/planillas_prov/:id/cerrar', (req, res) => {
  const db = readDB();
  const p  = db.planillas_prov.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  if (p.status !== 'abierta') return res.status(400).json({ error: 'Planilla no está abierta' });
  p.num_documento = nextNum(db, 'planilla_prov');
  p.cerrada_en    = new Date().toISOString();
  p.aprobacion_b  = { usuario_id: req.body.usuario_id, fecha: new Date().toISOString() };
  // Generar OC y recepción automáticas
  const oc  = { id: uuidv4(), tipo: 'prov_a_alquimaq', emisor_id: p.proveedor_id, receptor: 'alquimaq',
    planilla_id: p.id, monto: p.total_monto, num_documento: nextNum(db, 'oc'), status: 'emitida', fecha: new Date().toISOString() };
  const rec = { id: uuidv4(), tipo: 'alquimaq_recibe_de_prov', planilla_id: p.id, monto: p.total_monto,
    num_documento: nextNum(db, 'rec'), status: 'emitida', fecha: new Date().toISOString() };
  db.ordenes_compra.push(oc); p.oc_id = oc.id;
  db.recepciones.push(rec);   p.recepcion_id = rec.id;
  p.status = 'pendiente_factura';
  writeDB(db); res.json(p);
});

app.patch('/api/planillas_prov/:id/facturar', (req, res) => {
  const db = readDB();
  const p  = db.planillas_prov.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const fac = { id: uuidv4(), tipo: 'prov_factura_alquimaq', emisor_id: p.proveedor_id,
    receptor: 'alquimaq', planilla_id: p.id, monto: p.total_monto,
    numero: req.body.numero || '', num_documento: nextNum(db, 'fac'),
    status: 'emitida', fecha: new Date().toISOString() };
  db.facturas.push(fac); p.factura_id = fac.id; p.status = 'facturada';
  writeDB(db); res.json(p);
});

app.patch('/api/planillas_prov/:id/pagar', (req, res) => {
  const db = readDB();
  const p  = db.planillas_prov.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  p.status = 'pagada'; p.pagado_en = new Date().toISOString();
  const f = db.facturas.find(x => x.id === p.factura_id); if (f) f.status = 'pagada';
  writeDB(db); res.json(p);
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLAS CLIENTE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/planillas_cliente', (req, res) => {
  const db = readDB();
  let list = db.planillas_cliente;
  if (req.query.cliente_id) list = list.filter(p => p.cliente_id === req.query.cliente_id);
  if (req.query.status)     list = list.filter(p => p.status === req.query.status);
  if (req.query.desde)      list = list.filter(p => p.periodo_inicio >= req.query.desde);
  if (req.query.hasta)      list = list.filter(p => !p.periodo_fin || p.periodo_fin <= req.query.hasta);
  res.json(list.map(p => {
    let docs = db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db));
    // CAMBIO 4 + 8: filtros por placa y proyecto dentro de la planilla
    if (req.query.placa)       docs = docs.filter(r => r.maquina_placa === req.query.placa);
    if (req.query.proyecto_id) docs = docs.filter(r => r.proyecto_id === req.query.proyecto_id);
    if (req.query.finca)       docs = docs.filter(r => req.query.finca ? r.finca && r.finca.toLowerCase().includes(req.query.finca.toLowerCase()) : true);
    if (req.query.area)        docs = docs.filter(r => req.query.area  ? r.area  && r.area.toLowerCase().includes(req.query.area.toLowerCase())   : true);
    return { ...p,
      cliente_nombre: (db.clientes.find(x => x.id === p.cliente_id) || {}).nombre || '—',
      documentos: docs
    };
  }));
});

// CAMBIO 4: cerrar planilla cliente con docs seleccionados
app.post('/api/planillas_cliente/:id/cerrar_parcial', (req, res) => {
  const db = readDB();
  const p  = db.planillas_cliente.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  if (p.status !== 'abierta') return res.status(400).json({ error: 'Planilla no está abierta' });
  const docsSeleccionados = req.body.documentos_ids || [];
  if (!docsSeleccionados.length) return res.status(400).json({ error: 'Selecciona al menos un documento' });
  const invalidos = docsSeleccionados.filter(id => !p.documentos_ids.includes(id));
  if (invalidos.length) return res.status(400).json({ error: 'Documentos no pertenecen a esta planilla' });
  const docsData = db.documentos.filter(r => docsSeleccionados.includes(r.id));
  const maqMap = {};
  db.maquinas.forEach(m => maqMap[m.id] = m);
  const totalHoras = docsData.reduce((s, r) => s + (r.total_horas_declaradas || 0), 0);
  const totalMonto = docsData.reduce((s, r) => s + (r.total_horas_declaradas || 0) * ((maqMap[r.maquina_id] || {}).tarifa_a_c || 0), 0);
  // Crear nueva planilla cerrada con los docs seleccionados
  const nueva = {
    id: uuidv4(), cliente_id: p.cliente_id,
    periodo_inicio: docsData.reduce((m, r) => r.fecha_trabajo < m ? r.fecha_trabajo : m, docsData[0].fecha_trabajo),
    periodo_fin: new Date().toISOString().slice(0, 10),
    documentos_ids: docsSeleccionados,
    total_horas: Math.round(totalHoras * 10) / 10,
    total_monto: Math.round(totalMonto * 100) / 100,
    num_documento: nextNum(db, 'planilla_cli'),
    status: 'pendiente_recepcion',
    aprobacion_c: { usuario_id: req.body.usuario_id, fecha: new Date().toISOString() },
    oc_b_id: null, recepcion_c_id: null, factura_b_id: null,
    cerrada_en: new Date().toISOString(), creada_en: new Date().toISOString()
  };
  // OC automática
  const oc = { id: uuidv4(), tipo: 'alquimaq_a_cliente', emisor: 'alquimaq', receptor_id: p.cliente_id,
    planilla_id: nueva.id, monto: nueva.total_monto, num_documento: nextNum(db, 'oc'),
    status: 'emitida', fecha: new Date().toISOString() };
  db.ordenes_compra.push(oc); nueva.oc_b_id = oc.id;
  db.planillas_cliente.push(nueva);
  // Quitar docs de la planilla abierta y recalcular
  p.documentos_ids = p.documentos_ids.filter(id => !docsSeleccionados.includes(id));
  const docsRest = db.documentos.filter(r => p.documentos_ids.includes(r.id));
  p.total_horas = Math.round(docsRest.reduce((s, r) => s + (r.total_horas_declaradas || 0), 0) * 10) / 10;
  p.total_monto = Math.round(docsRest.reduce((s, r) => s + (r.total_horas_declaradas || 0) * ((maqMap[r.maquina_id] || {}).tarifa_a_c || 0), 0) * 100) / 100;
  writeDB(db); res.json(nueva);
});

app.patch('/api/planillas_cliente/:id/cerrar', (req, res) => {
  const db = readDB();
  const p  = db.planillas_cliente.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  if (p.status !== 'abierta') return res.status(400).json({ error: 'Planilla no está abierta' });
  p.num_documento = nextNum(db, 'planilla_cli');
  p.periodo_fin   = new Date().toISOString().slice(0, 10);
  p.cerrada_en    = new Date().toISOString();
  p.aprobacion_c  = { usuario_id: req.body.usuario_id, fecha: new Date().toISOString() };
  // OC automática de Alquimaq a cliente
  const oc = { id: uuidv4(), tipo: 'alquimaq_a_cliente', emisor: 'alquimaq', receptor_id: p.cliente_id,
    planilla_id: p.id, monto: p.total_monto, num_documento: nextNum(db, 'oc'),
    status: 'emitida', fecha: new Date().toISOString() };
  db.ordenes_compra.push(oc); p.oc_b_id = oc.id;
  p.status = 'pendiente_recepcion';
  writeDB(db); res.json(p);
});

app.patch('/api/planillas_cliente/:id/recepcion', (req, res) => {
  const db = readDB();
  const p  = db.planillas_cliente.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const rec = { id: uuidv4(), tipo: 'cliente_recibe_de_alquimaq', planilla_id: p.id, monto: p.total_monto,
    num_documento: nextNum(db, 'rec'), status: 'emitida', fecha: new Date().toISOString() };
  db.recepciones.push(rec); p.recepcion_c_id = rec.id; p.status = 'pendiente_factura';
  writeDB(db); res.json(p);
});

app.patch('/api/planillas_cliente/:id/facturar', (req, res) => {
  const db = readDB();
  const p  = db.planillas_cliente.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const fac = { id: uuidv4(), tipo: 'alquimaq_factura_cliente', emisor: 'alquimaq',
    receptor_id: p.cliente_id, planilla_id: p.id, monto: p.total_monto,
    numero: req.body.numero || '', num_documento: nextNum(db, 'fac'),
    status: 'emitida', fecha: new Date().toISOString() };
  db.facturas.push(fac); p.factura_b_id = fac.id; p.status = 'facturada';
  // Abrir nueva planilla automáticamente
  db.planillas_cliente.push({ id: uuidv4(), cliente_id: p.cliente_id,
    periodo_inicio: new Date().toISOString().slice(0, 10), periodo_fin: null,
    documentos_ids: [], total_horas: 0, total_monto: 0, num_documento: null,
    status: 'abierta', aprobacion_c: null, oc_b_id: null, recepcion_c_id: null,
    factura_b_id: null, cerrada_en: null, creada_en: new Date().toISOString() });
  writeDB(db); res.json(p);
});

app.patch('/api/planillas_cliente/:id/pagar', (req, res) => {
  const db = readDB();
  const p  = db.planillas_cliente.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  p.status = 'pagada'; p.pagado_en = new Date().toISOString();
  const f = db.facturas.find(x => x.id === p.factura_b_id); if (f) f.status = 'pagada';
  writeDB(db); res.json(p);
});

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIO 9: PDF DE PLANILLA
// ─────────────────────────────────────────────────────────────────────────────
function generarPDFPlanilla(p, docs, tipo, res) {
  const doc = new PDFDoc({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${p.num_documento || 'planilla'}.pdf"`);
  doc.pipe(res);

  // Encabezado
  doc.fontSize(18).fillColor('#1B3A5C').text('Alquimaq', { align: 'center' });
  doc.fontSize(13).fillColor('#333').text(tipo === 'prov' ? 'PLANILLA PROVEEDOR' : 'PLANILLA CLIENTE', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#666').text(`No. Documento: ${p.num_documento || '—'}`, { align: 'center' });
  doc.moveDown(0.5);

  // Info planilla
  doc.fontSize(10).fillColor('#333');
  const lineas = tipo === 'prov' ? [
    ['Proveedor:', p.proveedor_nombre || '—'],
    ['Período:', `Desde ${(p.creada_en||'').slice(0,10)} hasta ${p.cerrada_en ? p.cerrada_en.slice(0,10) : 'abierta'}`],
    ['Estado:', p.status],
    ['Total Horas:', `${p.total_horas} h`],
    ['Total Monto:', `$${(p.total_monto || 0).toFixed(2)}`],
  ] : [
    ['Cliente:', p.cliente_nombre || '—'],
    ['Período:', `${p.periodo_inicio} — ${p.periodo_fin || 'abierta'}`],
    ['Estado:', p.status],
    ['Total Horas:', `${p.total_horas} h`],
    ['Total Monto:', `$${(p.total_monto || 0).toFixed(2)}`],
  ];
  lineas.forEach(([k, v]) => {
    doc.font('Helvetica-Bold').text(k, { continued: true }).font('Helvetica').text(' ' + v);
  });

  doc.moveDown(0.8);
  doc.fontSize(11).fillColor('#1B3A5C').font('Helvetica-Bold').text('Detalle de documentos:', { underline: true });
  doc.moveDown(0.3);

  // Tabla
  const cols = { num: 40, fecha: 90, placa: 70, obra: 130, horas: 50, monto: 70 };
  const startX = 40;
  let y = doc.y;

  // Header tabla
  doc.fontSize(9).fillColor('#fff').rect(startX, y, 515, 16).fill('#1B3A5C');
  doc.fillColor('#fff');
  doc.text('No. Doc', startX + 2, y + 3, { width: cols.num });
  doc.text('Fecha',   startX + cols.num + 2, y + 3, { width: cols.fecha });
  doc.text('Placa',   startX + cols.num + cols.fecha + 2, y + 3, { width: cols.placa });
  doc.text('Obra',    startX + cols.num + cols.fecha + cols.placa + 2, y + 3, { width: cols.obra });
  doc.text('Horas',   startX + cols.num + cols.fecha + cols.placa + cols.obra + 2, y + 3, { width: cols.horas });
  doc.text('Monto',   startX + cols.num + cols.fecha + cols.placa + cols.obra + cols.horas + 2, y + 3, { width: cols.monto });
  y += 18;

  docs.forEach((r, i) => {
    if (y > 720) { doc.addPage(); y = 40; }
    const bg = i % 2 === 0 ? '#EFF6FF' : '#FFFFFF';
    const tarifa = tipo === 'prov' ? (r.tarifa_a_b || 0) : (r.tarifa_a_c || 0);
    const monto  = (r.total_horas_declaradas || 0) * tarifa;
    doc.fontSize(8).fillColor('#333').rect(startX, y, 515, 15).fill(bg);
    doc.fillColor('#333');
    doc.text(r.num_documento || '—', startX + 2, y + 3, { width: cols.num - 2 });
    doc.text(r.fecha_trabajo, startX + cols.num + 2, y + 3, { width: cols.fecha - 2 });
    doc.text(r.maquina_placa || '—', startX + cols.num + cols.fecha + 2, y + 3, { width: cols.placa - 2 });
    doc.text((r.obra || '—').slice(0, 28), startX + cols.num + cols.fecha + cols.placa + 2, y + 3, { width: cols.obra - 2 });
    doc.text(String(r.total_horas_declaradas), startX + cols.num + cols.fecha + cols.placa + cols.obra + 2, y + 3, { width: cols.horas - 2 });
    doc.text('$' + monto.toFixed(2), startX + cols.num + cols.fecha + cols.placa + cols.obra + cols.horas + 2, y + 3, { width: cols.monto - 2 });
    y += 16;
  });

  // Total
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1B3A5C').font('Helvetica-Bold')
    .text(`TOTAL: ${p.total_horas} horas — $${(p.total_monto || 0).toFixed(2)}`, { align: 'right' });

  doc.moveDown(1);
  doc.fontSize(9).fillColor('#999').font('Helvetica')
    .text(`Generado el ${new Date().toLocaleString('es-EC')}`, { align: 'center' });

  doc.end();
}

app.get('/api/planillas_prov/:id/pdf', (req, res) => {
  const db = readDB();
  const p  = db.planillas_prov.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const prov = db.proveedores.find(x => x.id === p.proveedor_id) || {};
  const docs = db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db));
  generarPDFPlanilla({ ...p, proveedor_nombre: prov.nombre }, docs, 'prov', res);
});

app.get('/api/planillas_cliente/:id/pdf', (req, res) => {
  const db = readDB();
  const p  = db.planillas_cliente.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const cli  = db.clientes.find(x => x.id === p.cliente_id) || {};
  const docs = db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db));
  generarPDFPlanilla({ ...p, cliente_nombre: cli.nombre }, docs, 'cliente', res);
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS (CAMBIO 5: ganancias solo para admin_b)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const db  = readDB();
  const rol = req.query.rol || '';
  const mes = new Date().toISOString().slice(0, 7);
  const aprov = db.documentos.filter(r => r.status === 'aprobado_c' && r.fecha_trabajo.startsWith(mes));
  const pendB = db.documentos.filter(r => r.status === 'pendiente_b').length;
  const pendC = db.documentos.filter(r => r.status === 'pendiente_c').length;
  const hMaq  = {};
  aprov.forEach(r => {
    const m = db.maquinas.find(x => x.id === r.maquina_id) || {};
    hMaq[m.placa || r.maquina_id] = (hMaq[m.placa || r.maquina_id] || 0) + (r.total_horas_declaradas || 0);
  });
  const base = {
    pendB, pendC,
    horasAprobadas: aprov.reduce((s, r) => s + (r.total_horas_declaradas || 0), 0),
    clientesActivos: db.clientes.filter(c => c.activo).length,
    planillasAbiertas: db.planillas_cliente.filter(p => p.status === 'abierta').length,
    facturasPendientes: db.facturas.filter(f => f.status === 'emitida').length,
    horasPorMaquina: Object.entries(hMaq).sort((a, b) => b[1] - a[1]).slice(0, 6)
  };
  // CAMBIO 5: datos financieros solo para admin_b
  if (rol === 'admin_b') {
    const cobradoC = aprov.reduce((s, r) => { const m = db.maquinas.find(x => x.id === r.maquina_id) || {}; return s + (r.total_horas_declaradas || 0) * (m.tarifa_a_c || 0); }, 0);
    const pagadoA  = aprov.filter(r => { const m = db.maquinas.find(x => x.id === r.maquina_id) || {}; return m.propietario && m.propietario !== 'alquimaq'; })
      .reduce((s, r) => { const m = db.maquinas.find(x => x.id === r.maquina_id) || {}; return s + (r.total_horas_declaradas || 0) * (m.tarifa_a_b || 0); }, 0);
    base.cobradoC = Math.round(cobradoC * 100) / 100;
    base.pagadoA  = Math.round(pagadoA  * 100) / 100;
    base.margenB  = Math.round((cobradoC - pagadoA) * 100) / 100;
  }
  res.json(base);
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT EXCEL
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/export/documentos', async (req, res) => {
  try {
    const db = readDB();
    let list = db.documentos.map(r => enrich(r, db));
    if (req.query.status)     list = list.filter(r => r.status === req.query.status);
    if (req.query.cliente_id) list = list.filter(r => r.cliente_id === req.query.cliente_id);
    if (req.query.desde)      list = list.filter(r => r.fecha_trabajo >= req.query.desde);
    if (req.query.hasta)      list = list.filter(r => r.fecha_trabajo <= req.query.hasta);
    list.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));

    const wb = new ExcelJS.Workbook(); wb.creator = 'Alquimaq';
    const ws = wb.addWorksheet('Documentos');
    const hF = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1B3A5C'} };
    const hFt = { bold:true, color:{argb:'FFFFFFFF'}, size:11 };
    const bd  = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    ws.mergeCells('A1:T1');
    Object.assign(ws.getCell('A1'), { value:'Alquimaq — Registro de Horas de Maquinaria',
      font:{bold:true,size:13,color:{argb:'FF1B3A5C'}}, alignment:{horizontal:'center'},
      fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFDBEAFE'}} });
    ws.addRow([`Exportado: ${new Date().toLocaleString('es-EC')}`]);
    ws.addRow([]);

    const hdrs = ['No. Documento','Cliente','Proyecto','Operario','Cédula','Máquina','Tipo',
      'Propietario','Fecha Trabajo','Finca','Área','Obra',
      'Combustible','J. Mañana','J. Tarde','Total Horas','Horóm. Ini','Horóm. Fin',
      'Controlador Alquimaq','Controlador Cliente','Observaciones','Estado'];
    const widths = [20,22,22,22,14,12,16,14,14,18,16,22,14,16,16,12,12,12,18,18,22,16];
    const hr = ws.addRow(hdrs);
    hr.eachCell(c => { c.fill=hF; c.font=hFt; c.alignment={horizontal:'center',vertical:'middle'}; c.border=bd; });
    ws.getRow(hr.number).height = 22;
    hdrs.forEach((_, i) => { ws.getColumn(i+1).width = widths[i]; });

    const sC = { pendiente_b:'FFFEF3C7', pendiente_c:'FFDBEAFE', aprobado_c:'FFDCFCE7', rechazado_b:'FFFEE2E2', rechazado_c:'FFFEE2E2' };
    const SL = { pendiente_b:'Pendiente B', pendiente_c:'Pendiente C', aprobado_c:'Aprobado ✓', rechazado_b:'Rechazado B', rechazado_c:'Rechazado C' };

    list.forEach((r, i) => {
      const mn = r.manana_inicio && r.manana_fin ? `${r.manana_inicio}→${r.manana_fin} (${r.horas_manana}h)` : '—';
      const td = r.tarde_inicio  && r.tarde_fin  ? `${r.tarde_inicio}→${r.tarde_fin} (${r.horas_tarde}h)` : '—';
      const row = ws.addRow([
        r.num_documento, r.cliente_nombre, r.proyecto_nombre, r.operario_nombre, r.cedula,
        r.maquina_placa, r.maquina_tipo,
        r.es_proveedor ? `Prov: ${r.proveedor_nombre||''}` : 'Alquimaq',
        r.fecha_trabajo, r.finca||'—', r.area||'—',
        r.obra, r.combustible||'—', mn, td,
        r.total_horas_declaradas, r.horometro_inicio||'—', r.horometro_fin||'—',
        r.supervisor_alquimaq||'—', r.supervisor_cliente||'—',
        r.observaciones||'—', SL[r.status]||r.status
      ]);
      const fill = { type:'pattern', pattern:'solid', fgColor:{argb: sC[r.status]||(i%2===0?'FFEFF6FF':'FFFFFFFF')} };
      row.eachCell(c => { c.fill=fill; c.border=bd; c.alignment={vertical:'middle'}; });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Alquimaq_Documentos_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res); res.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// FINCAS
// ─────────────────────────────────────────────────────────────────────────────

// Listar fincas (filtradas por cliente_id si se pasa)
app.get('/api/fincas', (req, res) => {
  const db = readDB();
  let list = db.fincas || [];
  if (req.query.cliente_id) list = list.filter(f => f.cliente_id === req.query.cliente_id);
  // Enriquecer con nombre del cliente
  res.json(list.map(f => ({
    ...f,
    cliente_nombre: (db.clientes.find(c => c.id === f.cliente_id) || {}).nombre || '—'
  })));
});

// Buscar finca por nombre (para Jelou) — devuelve cliente asociado
app.get('/api/fincas/buscar/:nombre', (req, res) => {
  const db    = readDB();
  const buscar = normalizarNombre(req.params.nombre);
  const finca  = (db.fincas || []).find(f => normalizarNombre(f.nombre) === buscar);
  if (!finca) return res.status(200).json({ existe: false, mensaje: `Finca "${req.params.nombre}" no encontrada` });
  const cliente = db.clientes.find(c => c.id === finca.cliente_id) || {};
  res.json({ existe: true, id: finca.id, nombre: finca.nombre,
    cliente_id: finca.cliente_id, cliente_nombre: cliente.nombre || '—' });
});

// Crear finca
app.post('/api/fincas', (req, res) => {
  const db = readDB();
  if (!db.fincas) db.fincas = [];
  const { nombre, cliente_id } = req.body;
  if (!nombre || !cliente_id) return res.status(400).json({ error: 'nombre y cliente_id son obligatorios' });
  // Verificar que no exista ya una finca con ese nombre
  if (db.fincas.find(f => normalizarNombre(f.nombre) === normalizarNombre(nombre)))
    return res.status(400).json({ error: `Ya existe una finca con el nombre "${nombre}"` });
  const nueva = { id: uuidv4(), nombre: nombre.trim(), cliente_id, activa: true };
  db.fincas.push(nueva); writeDB(db);
  res.status(201).json(nueva);
});

// Editar finca
app.patch('/api/fincas/:id', (req, res) => {
  const db = readDB();
  if (!db.fincas) db.fincas = [];
  const f = db.fincas.find(x => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: 'Finca no encontrada' });
  // Verificar que el cliente_id del solicitante coincide (seguridad)
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  if (usr.rol !== 'admin_b' && usr.cliente_id !== f.cliente_id)
    return res.status(403).json({ error: 'No tienes permiso para editar esta finca' });
  if (req.body.nombre) f.nombre = req.body.nombre.trim();
  if (req.body.activa !== undefined) f.activa = req.body.activa;
  writeDB(db);
  res.json(f);
});

// Eliminar (desactivar) finca
app.delete('/api/fincas/:id', (req, res) => {
  const db = readDB();
  if (!db.fincas) db.fincas = [];
  const f = db.fincas.find(x => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: 'Finca no encontrada' });
  const usr = db.usuarios.find(x => x.id === req.query.usuario_id) || {};
  if (usr.rol !== 'admin_b' && usr.cliente_id !== f.cliente_id)
    return res.status(403).json({ error: 'No tienes permiso para eliminar esta finca' });
  f.activa = false; writeDB(db);
  res.json({ ok: true });
});


// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));



// ─────────────────────────────────────────────────────────────────────────────
//

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS PARA JELOU — Consulta y registro de operarios
// ─────────────────────────────────────────────────────────────────────────────

// Buscar operario por teléfono (Jelou envía el número del usuario como $user.id)
app.get('/api/operarios/telefono/:telefono', (req, res) => {
  const db = readDB();
  const tel = req.params.telefono.replace(/\D/g, '');
  const op  = db.operarios.find(o => o.telefono && o.telefono.replace(/\D/g,'') === tel);
  if (!op) return res.status(404).json({ existe: false });
  res.json({ existe: true, id: op.id, nombre: op.nombre, cedula: op.cedula, cliente_id: op.cliente_id || null });
});

// Buscar operario por cédula
app.get('/api/operarios/cedula/:cedula', (req, res) => {
  const db = readDB();
  const ced = req.params.cedula.replace(/\D/g, '');
  const op  = db.operarios.find(o => o.cedula && o.cedula.replace(/\D/g,'') === ced);
  if (!op) return res.status(404).json({ existe: false });
  res.json({ existe: true, id: op.id, nombre: op.nombre, cedula: op.cedula, cliente_id: op.cliente_id || null });
});

// Registrar operario nuevo (Jelou lo llama tras recoger nombre + cédula)
app.post('/api/operarios/registrar', (req, res) => {
  const { nombre, cedula, telefono } = req.body;
  if (!nombre || !cedula || !telefono)
    return res.status(400).json({ error: 'nombre, cedula y telefono son obligatorios' });
  const db = readDB();
  // Verificar que no exista ya
  const existe = db.operarios.find(o =>
    (o.cedula && o.cedula.replace(/\D/g,'') === cedula.replace(/\D/g,'')) ||
    (o.telefono && o.telefono.replace(/\D/g,'') === telefono.replace(/\D/g,''))
  );
  if (existe) {
    // Actualizar teléfono si cambió
    if (!existe.telefono) { existe.telefono = telefono; writeDB(db); }
    return res.json({ existe: true, id: existe.id, nombre: existe.nombre, cedula: existe.cedula });
  }
  const nuevo = { id: uuidv4(), nombre: nombre.trim(), cedula: cedula.replace(/\D/g,''),
    telefono: telefono.replace(/\D/g,''), actor: 'c', activo: true };
  db.operarios.push(nuevo);
  writeDB(db);
  res.status(201).json({ existe: false, id: nuevo.id, nombre: nuevo.nombre, cedula: nuevo.cedula });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT JELOU — Recibe mensajes del bot y gestiona conversación
// ─────────────────────────────────────────────────────────────────────────────
const sesionesJelou = {}; // { telefono: { paso, datos } }

function calcHStr(ini, fin) {
  if (!ini || !fin) return 0;
  const [hi,mi] = ini.split(':').map(Number);
  const [hf,mf] = fin.split(':').map(Number);
  return Math.round(((hf*60+mf)-(hi*60+mi))/60*10)/10;
}
function parsearHora(txt) {
  const t = txt.trim().replace('.', ':');
  const m = t.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]);
  if (h<0||h>23||min<0||min>59) return null;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

// Jelou envía los mensajes entrantes a este endpoint
app.post('/api/jelou/mensaje', async (req, res) => {
  try {
    // Jelou puede enviar el payload en distintos formatos — normalizamos
    const body    = req.body;
    const telefono = (body.from || body.phone || body.userId || body.sender || '').toString().replace(/\D/g,'');
    const msg      = (body.text || body.message || body.body || body.content || '').toString().trim();

    if (!telefono || !msg) return res.json({ success: true });

    // Responder a Jelou con el mensaje del bot
    // Jelou espera: { text: "..." } o { message: "..." }
    const responder = (texto) => res.json({ text: texto, message: texto });

    const db = readDB();
    let operario = db.operarios.find(o =>
      o.telefono && o.telefono.replace(/\D/g,'') === telefono
    );

    if (!sesionesJelou[telefono]) {
      sesionesJelou[telefono] = { paso: operario ? 'menu' : 'reg_nombre', datos: {} };
    }
    const ses = sesionesJelou[telefono];

    // Cancelar siempre disponible
    if (['CANCELAR','CANCEL','SALIR'].includes(msg.toUpperCase())) {
      sesionesJelou[telefono] = { paso: operario ? 'menu' : 'reg_nombre', datos: {} };
      return responder('❌ Registro cancelado.\n\nEscribe *HORAS* para registrar o *AYUDA* para ver los comandos.');
    }

    // ── REGISTRO PRIMERA VEZ ────────────────────────────────────────────────
    if (!operario) {
      if (ses.paso === 'reg_nombre') {
        ses.paso = 'reg_nombre_resp';
        return responder('👷 ¡Bienvenido al sistema de Alquimaq!\n\nPara registrarte necesito tus datos.\n\n📝 ¿Cuál es tu *nombre completo*?');
      }
      if (ses.paso === 'reg_nombre_resp') {
        if (msg.length < 3) return responder('⚠ Por favor ingresa tu nombre completo.');
        ses.datos.nombre = msg;
        ses.paso = 'reg_cedula';
        return responder(`✅ Nombre: *${msg}*\n\n🪪 Ingresa tu número de *cédula de identidad*:`);
      }
      if (ses.paso === 'reg_cedula') {
        if (!/^\d{8,13}$/.test(msg.replace(/\D/g,''))) return responder('⚠ Ingresa un número de cédula válido (solo números).');
        const nuevoOp = { id: uuidv4(), nombre: ses.datos.nombre, cedula: msg.replace(/\D/g,''), telefono, actor: 'c', activo: true };
        db.operarios.push(nuevoOp); writeDB(db); operario = nuevoOp;
        sesionesJelou[telefono] = { paso: 'menu', datos: {} };
        return responder(`✅ *¡Registro completado!*\n\n👤 ${nuevoOp.nombre}\n🪪 ${nuevoOp.cedula}\n\nEscribe *HORAS* para registrar el trabajo del día.`);
      }
      ses.paso = 'reg_nombre_resp';
      return responder('👷 ¡Bienvenido! Para registrarte, ¿cuál es tu *nombre completo*?');
    }

    // ── MENÚ PRINCIPAL ──────────────────────────────────────────────────────
    if (ses.paso === 'menu' || msg.toUpperCase() === 'HORAS' || msg.toUpperCase() === 'AYUDA') {
      if (msg.toUpperCase() === 'AYUDA') return responder('📋 *Comandos:*\n\n*HORAS* — Registrar horas\n*CANCELAR* — Cancelar registro\n*AYUDA* — Ver esta ayuda');
      sesionesJelou[telefono] = { paso: 'fecha', datos: {} };
      const hoy = new Date().toLocaleDateString('es-EC', {weekday:'long',day:'2-digit',month:'long'});
      return responder(`👷 Hola *${operario.nombre.split(' ')[0]}*!\n\n━━━━━━━━━━━━━━\n📅 *PASO 1 — Fecha de trabajo*\n━━━━━━━━━━━━━━\n\n¿Las horas son de hoy, *${hoy}*?\n\n1️⃣ Sí, son de hoy\n2️⃣ No, otra fecha`);
    }

    const datos = ses.datos;

    // ── FLUJO DE REGISTRO ───────────────────────────────────────────────────
    switch (ses.paso) {

      case 'fecha':
        if (msg === '1') {
          datos.fecha_trabajo = new Date().toISOString().slice(0,10);
          datos.registro_tardio = false;
          ses.paso = 'placa';
          return responder('✅ Fecha: *hoy*\n\n━━━━━━━━━━━━━━\n🚜 *PASO 2 — Placa de la máquina*\n━━━━━━━━━━━━━━\n\nIngresa el número de placa:');
        }
        if (msg === '2') { ses.paso = 'fecha_manual'; return responder('📅 Ingresa la fecha (DD/MM/AAAA):'); }
        return responder('Responde *1* (hoy) o *2* (otra fecha).');

      case 'fecha_manual': {
        const p = msg.trim().split('/');
        if (p.length !== 3) return responder('⚠ Usa el formato DD/MM/AAAA. Ej: 22/04/2026');
        const [d,m2,a] = p.map(Number);
        if (isNaN(new Date(a,m2-1,d).getTime())) return responder('⚠ Fecha inválida. Intenta de nuevo.');
        datos.fecha_trabajo = `${a}-${String(m2).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        datos.registro_tardio = datos.fecha_trabajo < new Date().toISOString().slice(0,10);
        ses.paso = 'placa';
        const av = datos.registro_tardio ? '\n\n⚠ _Registro tardío — el supervisor lo verá resaltado._' : '';
        return responder(`✅ Fecha: *${msg.trim()}*${av}\n\n🚜 Ingresa la placa de la máquina:`);
      }

      case 'placa': {
        const db2 = readDB();
        const placa = msg.toUpperCase().trim();
        const maq = db2.maquinas.find(m => m.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase() === placa.replace(/[^A-Z0-9]/gi,'').toUpperCase());
        if (!maq) return responder(`⚠ No encontré la máquina *${placa}*.\n\nVerifica la placa e intenta de nuevo.`);
        datos.maquina_id = maq.id; datos.maquina_placa = maq.placa;
        ses.paso = 'obra';
        return responder(`✅ Máquina: *${maq.placa}* — ${maq.tipo} ${maq.marca}\n\n━━━━━━━━━━━━━━\n🏗️ *PASO 3 — Obra*\n━━━━━━━━━━━━━━\n\n¿En qué obra estás trabajando?`);
      }

      case 'obra':
        if (msg.length < 2) return responder('⚠ Ingresa el nombre de la obra.');
        datos.obra = msg; ses.paso = 'finca';
        return responder(`✅ Obra: *${msg}*\n\n🌿 *Finca/Sector* (opcional)\nEscribe el nombre o *.* para omitir:`);

      case 'finca':
        datos.finca = msg === '.' ? '' : msg; ses.paso = 'area';
        return responder(`✅ ${datos.finca?`Finca: *${datos.finca}*`:'Finca: _omitida_'}\n\n📍 *Área* (opcional)\nEscribe el área o *.* para omitir:`);

      case 'area':
        datos.area = msg === '.' ? '' : msg; ses.paso = 'combustible';
        return responder(`✅ ${datos.area?`Área: *${datos.area}*`:'Área: _omitida_'}\n\n⛽ *Combustible* (opcional)\nEscribe la cantidad o *.* para omitir:`);

      case 'combustible':
        datos.combustible = msg === '.' ? '' : msg; ses.paso = 'horas_manana';
        return responder(`✅ ${datos.combustible?`Combustible: *${datos.combustible}*`:'Combustible: _omitido_'}\n\n━━━━━━━━━━━━━━\n☀️ *PASO 4 — Jornada mañana*\n━━━━━━━━━━━━━━\n\n¿Trabajaste en la mañana?\n\n1️⃣ Sí\n2️⃣ No`);

      case 'horas_manana':
        if (msg === '1') { ses.paso = 'manana_inicio'; return responder('☀️ Hora de *inicio* mañana (HH:MM):'); }
        if (msg === '2') { datos.manana_inicio = null; datos.manana_fin = null; ses.paso = 'horas_tarde'; return responder('━━━━━━━━━━━━━━\n🌤️ *PASO 5 — Jornada tarde*\n━━━━━━━━━━━━━━\n\n¿Trabajaste en la tarde?\n\n1️⃣ Sí\n2️⃣ No'); }
        return responder('Responde *1* (Sí) o *2* (No).');

      case 'manana_inicio': { const h = parsearHora(msg); if (!h) return responder('⚠ Formato inválido. Usa HH:MM'); datos.manana_inicio = h; ses.paso = 'manana_fin'; return responder(`☀️ Inicio: *${h}*\nHora de *fin* mañana:`); }
      case 'manana_fin': { const h = parsearHora(msg); if (!h) return responder('⚠ Formato inválido. Usa HH:MM'); if (h <= datos.manana_inicio) return responder('⚠ El fin debe ser mayor al inicio.'); datos.manana_fin = h; ses.paso = 'horas_tarde'; const hm = calcHStr(datos.manana_inicio,h); return responder(`✅ Mañana: *${datos.manana_inicio}→${h}* (${hm}h)\n\n━━━━━━━━━━━━━━\n🌤️ *PASO 5 — Jornada tarde*\n━━━━━━━━━━━━━━\n\n¿Trabajaste en la tarde?\n\n1️⃣ Sí\n2️⃣ No`); }

      case 'horas_tarde':
        if (msg === '1') { ses.paso = 'tarde_inicio'; return responder('🌤️ Hora de *inicio* tarde (HH:MM):'); }
        if (msg === '2') { datos.tarde_inicio = null; datos.tarde_fin = null; ses.paso = 'total_horas'; const hm2 = calcHStr(datos.manana_inicio,datos.manana_fin); return responder(`━━━━━━━━━━━━━━\n⏱️ *PASO 6 — Total horas*\n━━━━━━━━━━━━━━\n\nIngresa el *total de horas* trabajadas:${hm2>0?`\n_(Rangos suman: ${hm2}h)_`:''}`); }
        return responder('Responde *1* (Sí) o *2* (No).');

      case 'tarde_inicio': { const h = parsearHora(msg); if (!h) return responder('⚠ Formato inválido. Usa HH:MM'); datos.tarde_inicio = h; ses.paso = 'tarde_fin'; return responder(`🌤️ Inicio tarde: *${h}*\nHora de *fin* tarde:`); }
      case 'tarde_fin': { const h = parsearHora(msg); if (!h) return responder('⚠ Formato inválido. Usa HH:MM'); if (h <= datos.tarde_inicio) return responder('⚠ El fin debe ser mayor al inicio.'); datos.tarde_fin = h; const ht2 = calcHStr(datos.tarde_inicio,h); const hm2 = calcHStr(datos.manana_inicio,datos.manana_fin); const tot = Math.round((hm2+ht2)*10)/10; ses.paso = 'total_horas'; return responder(`✅ Tarde: *${datos.tarde_inicio}→${h}* (${ht2}h)\n\n━━━━━━━━━━━━━━\n⏱️ *PASO 6 — Total horas*\n━━━━━━━━━━━━━━\n\nIngresa el *total de horas* trabajadas:\n_(Rangos suman: ${tot}h)_`); }

      case 'total_horas': {
        const total = parseFloat(msg.replace(',','.'));
        if (isNaN(total)||total<=0||total>24) return responder('⚠ Ingresa un número válido. Ej: 8.5');
        const hm2 = calcHStr(datos.manana_inicio,datos.manana_fin);
        const ht2 = calcHStr(datos.tarde_inicio,datos.tarde_fin);
        const rangos = Math.round((hm2+ht2)*10)/10;
        if (rangos > 0 && Math.abs(rangos-total) > 0.2) return responder(`⚠ Los rangos suman *${rangos}h* pero declaras *${total}h*.\n\nCorrige el total:`);
        datos.total_horas_declaradas = total; ses.paso = 'horometro_ini';
        return responder(`✅ Total: *${total}h*\n\n━━━━━━━━━━━━━━\n📊 *PASO 7 — Horómetro*\n━━━━━━━━━━━━━━\n\nValor del horómetro al *inicio* del trabajo:`);
      }

      case 'horometro_ini': { const v = parseFloat(msg.replace(',','.')); if (isNaN(v)||v<0) return responder('⚠ Ingresa un número válido. Ej: 4210.3'); datos.horometro_inicio = v; ses.paso = 'horometro_fin'; return responder(`📊 Horómetro inicio: *${v}*\n\nValor del horómetro al *fin* del trabajo:`); }

      case 'horometro_fin': {
        const v = parseFloat(msg.replace(',','.'));
        if (isNaN(v)||v<0) return responder('⚠ Ingresa un número válido.');
        if (v <= datos.horometro_inicio) return responder(`⚠ El fin (${v}) debe ser mayor al inicio (${datos.horometro_inicio}).`);
        const dif = Math.round((v-datos.horometro_inicio)*10)/10;
        const difTotal = Math.abs(dif-datos.total_horas_declaradas);
        datos.horometro_fin = v;
        const av2 = difTotal > 0.5 ? `\n\n⚠ _Horómetro indica ${dif}h pero declaraste ${datos.total_horas_declaradas}h. El supervisor verá esta diferencia._` : `\n✅ _Horómetro cuadra con las horas._`;
        ses.paso = 'observaciones';
        return responder(`📊 Horómetro fin: *${v}* (Δ ${dif}h)${av2}\n\n💬 *Observaciones* (opcional)\nEscribe o *.* para omitir:`);
      }

      case 'observaciones': {
        datos.observaciones = msg === '.' ? '' : msg;
        ses.paso = 'resumen';
        const hm3 = calcHStr(datos.manana_inicio,datos.manana_fin);
        const ht3 = calcHStr(datos.tarde_inicio,datos.tarde_fin);
        const jM = datos.manana_inicio ? `${datos.manana_inicio}→${datos.manana_fin} (${hm3}h)` : '_No registrada_';
        const jT = datos.tarde_inicio  ? `${datos.tarde_inicio}→${datos.tarde_fin} (${ht3}h)`   : '_No registrada_';
        return responder(`━━━━━━━━━━━━━━\n📋 *RESUMEN — Revisa antes de enviar*\n━━━━━━━━━━━━━━\n\n📅 *Fecha:* ${datos.fecha_trabajo}\n🚜 *Máquina:* ${datos.maquina_placa}\n🏗️ *Obra:* ${datos.obra}\n${datos.finca?`🌿 *Finca:* ${datos.finca}\n`:''}${datos.area?`📍 *Área:* ${datos.area}\n`:''}${datos.combustible?`⛽ *Combustible:* ${datos.combustible}\n`:''}☀️ *Mañana:* ${jM}\n🌤️ *Tarde:* ${jT}\n⏱️ *Total:* ${datos.total_horas_declaradas}h\n📊 *Horómetro:* ${datos.horometro_inicio}→${datos.horometro_fin}\n${datos.observaciones?`💬 *Obs:* ${datos.observaciones}\n`:''}\n━━━━━━━━━━━━━━\n¿Todo correcto?\n\n1️⃣ ✅ Confirmar y enviar\n2️⃣ ✏️ Corregir un dato`);
      }

      case 'resumen':
        if (msg === '1') {
          // Guardar documento
          const db3 = readDB();
          const nuevo = {
            id: uuidv4(), num_documento: nextNum(db3,'doc'),
            operario_id: operario.id, cliente_id: operario.cliente_id || null,
            proyecto_id: null, maquina_id: datos.maquina_id,
            fecha_trabajo: datos.fecha_trabajo, fecha_registro: new Date().toISOString(),
            obra: datos.obra, finca: datos.finca||'', area: datos.area||'',
            combustible: datos.combustible||'', observaciones: datos.observaciones||'',
            supervisor_alquimaq: '', supervisor_cliente: '',
            manana_inicio: datos.manana_inicio, manana_fin: datos.manana_fin,
            tarde_inicio: datos.tarde_inicio, tarde_fin: datos.tarde_fin,
            total_horas_declaradas: datos.total_horas_declaradas,
            horometro_inicio: datos.horometro_inicio, horometro_fin: datos.horometro_fin,
            foto_url: null, registro_tardio: datos.registro_tardio||false,
            status: 'pendiente_b', aprobacion_b: null, aprobacion_c: null
          };
          db3.documentos.push(nuevo); writeDB(db3);
          sesionesJelou[telefono] = { paso: 'menu', datos: {} };
          return responder(`✅ *¡Registro enviado!* 🎉\n\n━━━━━━━━━━━━━━\n🗂️ *No. Documento:* ${nuevo.num_documento}\n📅 ${datos.fecha_trabajo}\n🚜 ${datos.maquina_placa}\n⏱️ ${datos.total_horas_declaradas}h\n━━━━━━━━━━━━━━\n\nPendiente de aprobación del controlador.\n\nEscribe *HORAS* para registrar otro día.`);
        }
        if (msg === '2') {
          ses.paso = 'corregir';
          return responder('✏️ ¿Qué dato deseas corregir?\n\n1️⃣ Fecha\n2️⃣ Placa\n3️⃣ Obra\n4️⃣ Finca\n5️⃣ Área\n6️⃣ Combustible\n7️⃣ Jornada mañana\n8️⃣ Jornada tarde\n9️⃣ Total horas\n🔟 Horómetro\n1️⃣1️⃣ Observaciones');
        }
        return responder('Responde *1* para confirmar o *2* para corregir.');

      case 'corregir':
        const op = msg.trim();
        if (op==='1')  { ses.paso='fecha';          return responder('📅 ¿Las horas son de hoy?\n\n1️⃣ Sí\n2️⃣ No'); }
        if (op==='2')  { ses.paso='placa';           return responder('🚜 Ingresa la placa de la máquina:'); }
        if (op==='3')  { ses.paso='obra';            return responder('🏗️ Ingresa el nombre de la obra:'); }
        if (op==='4')  { ses.paso='finca';           return responder('🌿 Ingresa la finca (o . para omitir):'); }
        if (op==='5')  { ses.paso='area';            return responder('📍 Ingresa el área (o . para omitir):'); }
        if (op==='6')  { ses.paso='combustible';     return responder('⛽ Ingresa el combustible (o . para omitir):'); }
        if (op==='7')  { ses.paso='manana_inicio';   return responder('☀️ Hora de inicio mañana (HH:MM):'); }
        if (op==='8')  { ses.paso='tarde_inicio';    return responder('🌤️ Hora de inicio tarde (HH:MM):'); }
        if (op==='9')  { ses.paso='total_horas';     return responder('⏱️ Ingresa el total de horas:'); }
        if (op==='10') { ses.paso='horometro_ini';   return responder('📊 Ingresa el horómetro inicial:'); }
        if (op==='11') { ses.paso='observaciones';   return responder('💬 Ingresa las observaciones (o . para omitir):'); }
        return responder('⚠ Selecciona una opción del 1 al 11.');

      default:
        sesionesJelou[telefono] = { paso: 'menu', datos: {} };
        return responder(`Hola ${operario.nombre.split(' ')[0]}! Escribe *HORAS* para registrar el trabajo del día.`);
    }
  } catch(e) {
    console.error('Error Jelou webhook:', e);
    res.status(500).json({ error: e.message });
  }
});

// Health check del bot
app.get('/api/jelou/status', (req, res) => {
  res.json({ status: 'ok', sesiones_activas: Object.keys(sesionesJelou).length });
});

app.listen(PORT, () => console.log(`\n✅  Alquimaq Portal en http://localhost:${PORT}\n`));


// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/usuarios/buscar/:nombre', (req, res) => {
  const db      = readDB();
  const buscar  = normalizarNombre(req.params.nombre);
  const rol     = req.query.rol || '';  // opcional: filtrar por rol

  let lista = db.usuarios;
  if (rol) lista = lista.filter(u => u.rol === rol);

  // Buscar coincidencia exacta normalizada primero
  let match = lista.find(u => normalizarNombre(u.nombre) === buscar);

  // Si no hay exacta, buscar que contenga el texto buscado
  if (!match) match = lista.find(u => normalizarNombre(u.nombre).includes(buscar));

  // Si no hay, buscar que el nombre buscado contenga al usuario
  if (!match) match = lista.find(u => buscar.includes(normalizarNombre(u.nombre)));

  if (!match) return res.status(404).json({ encontrado: false, mensaje: `No se encontró controlador con nombre "${req.params.nombre}"` });

  res.json({
    encontrado:    true,
    nombre_exacto: match.nombre,  // nombre tal como está en la BD
    rol:           match.rol,
    actor:         match.actor,
    cliente_id:    match.cliente_id   || null,
    proveedor_id:  match.proveedor_id || null
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT JELOU — Recibe registro de horas desde el workflow de Jelou
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/documentos/jelou', (req, res) => {
  try {
    const db = readDB();
    const {
      operario_nombre, operario_cedula,
      fecha_trabajo, maquina_placa, obra,
      finca, area, combustible, observaciones,
      supervisor_alquimaq, supervisor_cliente, supervisor_cliente_sup,
      manana_inicio: mi_raw, manana_fin: mf_raw, tarde_inicio: ti_raw, tarde_fin: tf_raw,
      total_horas_declaradas, horometro_inicio, horometro_fin
    } = req.body;
    //console.log('BODY:', JSON.stringify({supervisor_alquimaq, supervisor_cliente, supervisor_cliente_sup}));

    // Normalizar horas a formato HH:MM
    const manana_inicio = normalizarHora(mi_raw);
    const manana_fin    = normalizarHora(mf_raw);
    const tarde_inicio  = normalizarHora(ti_raw);
    const tarde_fin     = normalizarHora(tf_raw);

    // Validar que las horas normalizadas sean coherentes
    const erroresHora = [];
    if (mi_raw && !manana_inicio) erroresHora.push(`Hora mañana inicio inválida: "${mi_raw}"`);
    if (mf_raw && !manana_fin)    erroresHora.push(`Hora mañana fin inválida: "${mf_raw}"`);
    if (ti_raw && !tarde_inicio)  erroresHora.push(`Hora tarde inicio inválida: "${ti_raw}"`);
    if (tf_raw && !tarde_fin)     erroresHora.push(`Hora tarde fin inválida: "${tf_raw}"`);
    if (erroresHora.length) return res.status(400).json({ error: 'Formato de hora no reconocido', detalle: erroresHora });

    if (!maquina_placa || !fecha_trabajo || !obra || !total_horas_declaradas)
      return res.status(400).json({ error: 'Campos obligatorios: maquina_placa, fecha_trabajo, obra, total_horas_declaradas' });

    // Buscar o crear operario
    let operario = null;
    if (operario_cedula) operario = db.operarios.find(o => o.cedula && o.cedula.replace(/\D/g,'') === operario_cedula.toString().replace(/\D/g,''));
    if (!operario && operario_nombre) operario = db.operarios.find(o => o.nombre && o.nombre.toLowerCase() === operario_nombre.toLowerCase());
    if (!operario && (operario_nombre || operario_cedula)) {
      operario = { id: uuidv4(), nombre: operario_nombre || 'Sin nombre', cedula: operario_cedula ? operario_cedula.toString().replace(/\D/g,'') : '', actor: 'c', activo: true };
      db.operarios.push(operario);
    }

    // Buscar máquina
    const placa = (maquina_placa||'').toString().toUpperCase().trim();
    const maq = db.maquinas.find(m => m.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase() === placa.replace(/[^A-Z0-9]/gi,'').toUpperCase());
    if (!maq) return res.status(404).json({ error: `Máquina "${maquina_placa}" no encontrada` });

    // Calcular y validar horas
    const hm = calcH(manana_inicio, manana_fin);
    const ht = calcH(tarde_inicio, tarde_fin);
    const hR = Math.round((hm+ht)*10)/10;
    const hD = parseFloat(total_horas_declaradas)||0;
    const hIni = horometro_inicio ? parseFloat(horometro_inicio) : null;
    const hFin = horometro_fin    ? parseFloat(horometro_fin)    : null;
    const difHoro = hIni!==null&&hFin!==null ? Math.round((hFin-hIni)*10)/10 : null;

    const advertencias = [];
    if (hR>0 && Math.abs(hR-hD)>0.2) advertencias.push(`Rangos suman ${hR}h pero se declararon ${hD}h`);
    if (difHoro!==null && Math.abs(difHoro-hD)>0.5) advertencias.push(`Horómetro indica ${difHoro}h pero se declararon ${hD}h`);

    const hoy = new Date().toISOString().slice(0,10);
    const nuevo = {
      id: uuidv4(), num_documento: nextNum(db,'doc'),
      operario_id: operario ? operario.id : null,
      cliente_id: (() => {
        // Intentar obtener cliente desde la finca
        if (finca) {
          const f = (db.fincas||[]).find(x => normalizarNombre(x.nombre) === normalizarNombre(finca));
          if (f) return f.cliente_id;
        }
        return operario ? (operario.cliente_id||null) : null;
      })(),
      proyecto_id: null, maquina_id: maq.id,
      fecha_trabajo: fecha_trabajo.toString(), fecha_registro: new Date().toISOString(),
      obra: (obra||'').toString(), finca: (finca||'').toString(),
      area: (area||'').toString(), combustible: (combustible||'').toString(),
      observaciones: (observaciones||'').toString(),
      //supervisor_alquimaq: '', supervisor_cliente: '',
      supervisor_alquimaq: (() => {
      const u = db.usuarios.find(x => normalizarNombre(x.nombre) === normalizarNombre(supervisor_alquimaq));
      return u ? u.nombre : (supervisor_alquimaq || '');
      })(),
      supervisor_cliente: (() => {
      const u = db.usuarios.find(x => normalizarNombre(x.nombre) === normalizarNombre(supervisor_cliente));
      return u ? u.nombre : (supervisor_cliente || '');
      })(),
      manana_inicio: manana_inicio||null, manana_fin: manana_fin||null,
      tarde_inicio: tarde_inicio||null,   tarde_fin: tarde_fin||null,
      total_horas_declaradas: hD, horometro_inicio: hIni, horometro_fin: hFin,
      foto_url: null, registro_tardio: fecha_trabajo < hoy,
      status: 'pendiente_b', aprobacion_b: null, aprobacion_c: null, origen: 'whatsapp_jelou'
    };

    db.documentos.push(nuevo); writeDB(db);
    res.status(201).json({
      success: true, num_documento: nuevo.num_documento,
      mensaje: `Registro ${nuevo.num_documento} guardado. Pendiente de aprobación.`,
      advertencias: advertencias.length ? advertencias : undefined
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
