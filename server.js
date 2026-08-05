const express = require('express');
const path    = require('path');
const multer  = require('multer');
const ExcelJS = require('exceljs');
const PDFDoc  = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const fs = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// POSTGRESQL CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

const db = {
  query: (text, params) => pool.query(text, params)
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT DB — crear tablas y seed si no existen
// ─────────────────────────────────────────────────────────────────────────────
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id TEXT PRIMARY KEY, nombre TEXT, ruc TEXT, contacto TEXT, email TEXT, activo BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY, nombre TEXT, ruc TEXT, contacto TEXT, email TEXT, activo BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY, nombre TEXT, email TEXT, password TEXT, rol TEXT, actor TEXT,
      cliente_id TEXT, proveedor_id TEXT
    );
    CREATE TABLE IF NOT EXISTS proyectos (
      id TEXT PRIMARY KEY, cliente_id TEXT, nombre TEXT, ubicacion TEXT, activo BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS operarios (
      id TEXT PRIMARY KEY, nombre TEXT, cedula TEXT, telefono TEXT, actor TEXT,
      cliente_id TEXT, proveedor_id TEXT, activo BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS maquinas (
      id TEXT PRIMARY KEY, placa TEXT UNIQUE, tipo TEXT, marca TEXT, modelo TEXT,
      propietario TEXT, tarifa_a_c NUMERIC, tarifa_a_b NUMERIC, activa BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS fincas (
      id TEXT PRIMARY KEY, nombre TEXT, cliente_id TEXT, activa BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS documentos (
      id TEXT PRIMARY KEY, num_documento TEXT UNIQUE,
      operario_id TEXT, cliente_id TEXT, proyecto_id TEXT, maquina_id TEXT,
      fecha_trabajo DATE, fecha_registro TIMESTAMPTZ,
      obra TEXT, finca TEXT, area TEXT, combustible TEXT, observaciones TEXT,
      supervisor_alquimaq TEXT, supervisor_cliente TEXT, supervisor_cliente_sup TEXT,
      manana_inicio TEXT, manana_fin TEXT, tarde_inicio TEXT, tarde_fin TEXT,
      total_horas_declaradas NUMERIC, horometro_inicio NUMERIC, horometro_fin NUMERIC,
      foto_url TEXT, registro_tardio BOOLEAN DEFAULT false, origen TEXT DEFAULT 'portal',
      status TEXT DEFAULT 'pendiente_b',
      aprobacion_b JSONB, aprobacion_c JSONB,
      editado_por TEXT, editado_en TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS planillas_prov (
      id TEXT PRIMARY KEY, num_documento TEXT, proveedor_id TEXT,
      documentos_ids TEXT[], total_horas NUMERIC, total_monto NUMERIC,
      status TEXT DEFAULT 'abierta',
      aprobacion_b JSONB, oc_id TEXT, recepcion_id TEXT, factura_id TEXT,
      cerrada_en TIMESTAMPTZ, creada_en TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS planillas_cliente (
      id TEXT PRIMARY KEY, num_documento TEXT, cliente_id TEXT,
      periodo_inicio DATE, periodo_fin DATE,
      documentos_ids TEXT[], total_horas NUMERIC, total_monto NUMERIC,
      status TEXT DEFAULT 'abierta',
      aprobacion_c JSONB, oc_b_id TEXT, recepcion_c_id TEXT, factura_b_id TEXT,
      cerrada_en TIMESTAMPTZ, creada_en TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ordenes_compra (
      id TEXT PRIMARY KEY, num_documento TEXT, tipo TEXT, emisor_id TEXT,
      receptor TEXT, planilla_id TEXT, monto NUMERIC, status TEXT, fecha TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS recepciones (
      id TEXT PRIMARY KEY, num_documento TEXT, tipo TEXT, planilla_id TEXT,
      monto NUMERIC, status TEXT, fecha TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS facturas (
      id TEXT PRIMARY KEY, num_documento TEXT, tipo TEXT, numero TEXT,
      emisor_id TEXT, receptor TEXT, planilla_id TEXT, monto NUMERIC, status TEXT, fecha TIMESTAMPTZ
    );
  `);

  // Seed si no hay usuarios
  const { rows } = await db.query('SELECT COUNT(*) FROM usuarios');
  if (parseInt(rows[0].count) === 0) {
    console.log('Seeding database...');
    await seedData();
    console.log('Seed completado');
  }
}

async function seedData() {
  // Proveedores
  await db.query(`INSERT INTO proveedores VALUES
    ('prov1','Maquinaria López','0910000001001','Pedro López','plopez@maqlopez.com',true),
    ('prov2','Equipos García','0910000002001','Luis García','lgarcia@eqgarcia.com',true)
    ON CONFLICT DO NOTHING`);

  // Clientes
  await db.query(`INSERT INTO clientes VALUES
    ('c1','Produmar','0990123456001','Mauricio Naranjo','mnaranjo@produmar.com',true),
    ('c2','Constructora Norte','0991234567001','Ana Paredes','aparedes@cnorte.com',true)
    ON CONFLICT DO NOTHING`);

  // Usuarios
  await db.query(`INSERT INTO usuarios VALUES
    ('u1','Roberto Sánchez','rsanchez@alquimaq.com','1234','controlador_b','b',NULL,NULL),
    ('u2','Fernando Díaz','fdiaz@alquimaq.com','1234','admin_b','b',NULL,NULL),
    ('u3','María Castro','mcastro@produmar.com','1234','controlador_c','c','c1',NULL),
    ('u4','Jorge Medina','jmedina@produmar.com','1234','coordinador_c','c','c1',NULL),
    ('u5','Laura Vera','lvera@produmar.com','1234','coordinador_c','c','c1',NULL),
    ('u6','Carlos Ruiz','cruiz@cnorte.com','1234','controlador_c','c','c2',NULL),
    ('u7','Ana Torres','atorres@maqlopez.com','1234','admin_prov','a',NULL,'prov1'),
    ('u8','Luis Mora','lmora@produmar.com','1234','supervisor_c','c','c1',NULL)
    ON CONFLICT DO NOTHING`);

  // Proyectos
  await db.query(`INSERT INTO proyectos VALUES
    ('p1','c1','Vía Perimetral km 12','Guayaquil',true),
    ('p2','c1','Samborondón Bypass','Samborondón',true),
    ('p3','c2','Edificio Norte Torre A','Quito',true)
    ON CONFLICT DO NOTHING`);

  // Operarios
  await db.query(`INSERT INTO operarios VALUES
    ('op1','Carlos Mora Reyes','0924567890','0991111001','c','c1',NULL,true),
    ('op2','Miguel Torres','0912345678','0991111002','b',NULL,NULL,true),
    ('op3','Luis Pinto','0934567891','0991111003','a',NULL,'prov1',true)
    ON CONFLICT DO NOTHING`);

  // Máquinas
  await db.query(`INSERT INTO maquinas VALUES
    ('m1','EXC-034','Excavadora','Komatsu','PC200','b',45,NULL,true),
    ('m2','VOL-011','Volqueta','Hino','500','b',38,NULL,true),
    ('m3','MOT-007','Motoniveladora','Caterpillar','120K','prov1',42,32,true),
    ('m4','COM-022','Compactadora','Dynapac','CA250','b',40,NULL,true),
    ('m5','EXC-019','Excavadora','Hitachi','ZX130','prov1',48,35,true)
    ON CONFLICT DO NOTHING`);

  // Fincas
  await db.query(`INSERT INTO fincas VALUES
    ('f1','Santay','c1',true),
    ('f2','Finca El Progreso','c1',true),
    ('f3','Finca San José','c1',true),
    ('f4','Finca Garzal','c2',true)
    ON CONFLICT DO NOTHING`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function normalizarNombre(str) {
  return (str || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function normalizarHora(txt) {
  if (!txt) return null;
  const s = txt.toString().trim().toLowerCase().replace(/\s+/g,'');
  const ampm = s.match(/^(\d{1,2})(?:[.:]?(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1]), m = parseInt(ampm[2]||'0');
    if (ampm[3]==='am') { if(h===12)h=0; } else { if(h!==12)h+=12; }
    if (h<0||h>23||m<0||m>59) return null;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const hhmm = s.match(/^(\d{1,2})[:.](\\d{2})$/);
  if (hhmm) { const h=parseInt(hhmm[1]),m=parseInt(hhmm[2]); if(h<0||h>23||m<0||m>59)return null; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  const hhmm2 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm2) { const h=parseInt(hhmm2[1]),m=parseInt(hhmm2[2]); if(h<0||h>23||m<0||m>59)return null; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  const hhmm4 = s.match(/^(\d{2})(\d{2})$/);
  if (hhmm4) { const h=parseInt(hhmm4[1]),m=parseInt(hhmm4[2]); if(h<0||h>23||m<0||m>59)return null; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  const soloH = s.match(/^(\d{1,2})h?$/);
  if (soloH) { const h=parseInt(soloH[1]); if(h<0||h>23)return null; return `${String(h).padStart(2,'0')}:00`; }
  return null;
}

function calcH(ini, fin) {
  if (!ini||!fin) return 0;
  const [hi,mi]=ini.split(':').map(Number), [hf,mf]=fin.split(':').map(Number);
  return Math.round(((hf*60+mf)-(hi*60+mi))/60*10)/10;
}

async function nextNum(tipo) {
  const hoy = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const prefijos = {doc:'DOC',oc:'OC',rec:'REC',fac:'FAC',planilla_prov:'PLP',planilla_cli:'PLC'};
  const pref = prefijos[tipo]||'DOC';
  const prefix = `${pref}-${hoy}-`;
  // Contar documentos del mismo tipo y día en la tabla correspondiente
  let count = 0;
  try {
    if (tipo==='doc') {
      const r = await db.query(`SELECT COUNT(*) FROM documentos WHERE num_documento LIKE $1`, [prefix+'%']);
      count = parseInt(r.rows[0].count);
    } else if (tipo==='planilla_prov') {
      const r = await db.query(`SELECT COUNT(*) FROM planillas_prov WHERE num_documento LIKE $1`, [prefix+'%']);
      count = parseInt(r.rows[0].count);
    } else if (tipo==='planilla_cli') {
      const r = await db.query(`SELECT COUNT(*) FROM planillas_cliente WHERE num_documento LIKE $1`, [prefix+'%']);
      count = parseInt(r.rows[0].count);
    }
  } catch(e) { count = 0; }
  return `${prefix}${String(count+1).padStart(4,'0')}`;
}

async function enrichDoc(r) {
  const [op, cl, pr, mq] = await Promise.all([
    r.operario_id ? db.query('SELECT * FROM operarios WHERE id=$1',[r.operario_id]).then(x=>x.rows[0]) : null,
    r.cliente_id  ? db.query('SELECT * FROM clientes  WHERE id=$1',[r.cliente_id ]).then(x=>x.rows[0]) : null,
    r.proyecto_id ? db.query('SELECT * FROM proyectos WHERE id=$1',[r.proyecto_id]).then(x=>x.rows[0]) : null,
    r.maquina_id  ? db.query('SELECT * FROM maquinas  WHERE id=$1',[r.maquina_id ]).then(x=>x.rows[0]) : null,
  ]);
  const esProveedor = mq && mq.propietario !== 'b';
  let provNombre = null;
  if (esProveedor && mq) {
    const pv = await db.query('SELECT nombre FROM proveedores WHERE id=$1',[mq.propietario]);
    provNombre = pv.rows[0]?.nombre || null;
  }
  const hm = calcH(r.manana_inicio, r.manana_fin);
  const ht = calcH(r.tarde_inicio,  r.tarde_fin);
  const hR = Math.round((hm+ht)*10)/10;
  const hD = parseFloat(r.total_horas_declaradas)||0;
  const hIni = r.horometro_inicio ? parseFloat(r.horometro_inicio) : null;
  const hFin = r.horometro_fin    ? parseFloat(r.horometro_fin)    : null;
  const difHoro = hIni!==null&&hFin!==null ? Math.round((hFin-hIni)*10)/10 : null;
  return {
    ...r,
    fecha_trabajo: r.fecha_trabajo?.toISOString?.()?.slice(0,10) || r.fecha_trabajo,
    operario_nombre: op?.nombre||'—', cedula: op?.cedula||'—',
    cliente_nombre:  cl?.nombre||'—', proyecto_nombre: pr?.nombre||'—',
    maquina_placa:   mq?.placa||'—',  maquina_tipo: mq?.tipo||'—',
    maquina_desc: mq ? `${mq.marca||''} ${mq.modelo||''}`.trim() : '—',
    es_proveedor: esProveedor, proveedor_nombre: provNombre,
    tarifa_a_c: parseFloat(mq?.tarifa_a_c)||0, tarifa_a_b: parseFloat(mq?.tarifa_a_b)||0,
    horas_manana: hm, horas_tarde: ht, horas_rangos: hR,
    horometro_diferencia: difHoro,
    discrepancia_horas: hR>0 && Math.abs(hR-hD)>0.2,
    discrepancia_horometro: difHoro!==null && Math.abs(difHoro-hD)>0.5,
    registro_tardio: r.registro_tardio || false
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
    destination: (req,file,cb)=>cb(null,UPLOADS_DIR),
    filename:    (req,file,cb)=>cb(null,`${Date.now()}-${file.originalname}`)
  }), limits:{fileSize:10*1024*1024}
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email=$1 AND password=$2',[email,password]);
    if (!rows.length) return res.status(401).json({error:'Credenciales incorrectas'});
    const u = rows[0]; delete u.password;
    res.json(u);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGOS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/clientes', async (_,res) => {
  const {rows} = await db.query('SELECT * FROM clientes ORDER BY nombre');
  res.json(rows);
});
app.get('/api/proveedores', async (_,res) => {
  const {rows} = await db.query('SELECT * FROM proveedores ORDER BY nombre');
  res.json(rows);
});
app.get('/api/maquinas', async (_,res) => {
  const {rows} = await db.query('SELECT * FROM maquinas ORDER BY placa');
  res.json(rows);
});
app.get('/api/maquinas/placa/:placa', async (req,res) => {
  const placa = req.params.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase();
  const {rows} = await db.query('SELECT * FROM maquinas WHERE activa=true');
  const maq = rows.find(m=>m.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase()===placa);
  if (!maq) return res.status(200).json({existe:false});
  res.json({existe:true, ...maq});
});
app.get('/api/operarios', async (_,res) => {
  const {rows} = await db.query('SELECT * FROM operarios ORDER BY nombre');
  res.json(rows);
});
app.get('/api/usuarios', async (req,res) => {
  let q = 'SELECT * FROM usuarios WHERE 1=1';
  const params = [];
  if (req.query.cliente_id)   { params.push(req.query.cliente_id);   q+=` AND cliente_id=$${params.length}`; }
  if (req.query.proveedor_id) { params.push(req.query.proveedor_id); q+=` AND proveedor_id=$${params.length}`; }
  const {rows} = await db.query(q+' ORDER BY nombre', params);
  res.json(rows.map(u=>{delete u.password; return u;}));
});
app.get('/api/proyectos', async (req,res) => {
  let q = 'SELECT * FROM proyectos WHERE activo=true';
  const params = [];
  if (req.query.cliente_id) { params.push(req.query.cliente_id); q+=` AND cliente_id=$${params.length}`; }
  const {rows} = await db.query(q+' ORDER BY nombre', params);
  res.json(rows);
});

// CRUD catálogos
app.post('/api/clientes', async (req,res) => {
  try {
    const {nombre,ruc,contacto,email} = req.body;
    const id = uuidv4();
    await db.query('INSERT INTO clientes VALUES($1,$2,$3,$4,$5,true)',[id,nombre,ruc,contacto,email]);
    res.status(201).json({id,nombre,ruc,contacto,email,activo:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.patch('/api/clientes/:id', async (req,res) => {
  try {
    const {nombre,ruc,contacto,email,activo} = req.body;
    await db.query('UPDATE clientes SET nombre=COALESCE($1,nombre),ruc=COALESCE($2,ruc),contacto=COALESCE($3,contacto),email=COALESCE($4,email),activo=COALESCE($5,activo) WHERE id=$6',
      [nombre,ruc,contacto,email,activo,req.params.id]);
    const {rows} = await db.query('SELECT * FROM clientes WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/proveedores', async (req,res) => {
  try {
    const {nombre,ruc,contacto,email} = req.body;
    const id = uuidv4();
    await db.query('INSERT INTO proveedores VALUES($1,$2,$3,$4,$5,true)',[id,nombre,ruc,contacto,email]);
    res.status(201).json({id,nombre,ruc,contacto,email,activo:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.patch('/api/proveedores/:id', async (req,res) => {
  try {
    const {nombre,ruc,contacto,email,activo} = req.body;
    await db.query('UPDATE proveedores SET nombre=COALESCE($1,nombre),ruc=COALESCE($2,ruc),contacto=COALESCE($3,contacto),email=COALESCE($4,email),activo=COALESCE($5,activo) WHERE id=$6',
      [nombre,ruc,contacto,email,activo,req.params.id]);
    const {rows} = await db.query('SELECT * FROM proveedores WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/maquinas', async (req,res) => {
  try {
    const {placa,tipo,marca,modelo,propietario,tarifa_a_c,tarifa_a_b} = req.body;
    const id = uuidv4();
    await db.query('INSERT INTO maquinas VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)',
      [id,placa,tipo,marca,modelo,propietario,tarifa_a_c||0,tarifa_a_b||null]);
    res.status(201).json({id,placa,tipo,marca,modelo,propietario,tarifa_a_c,tarifa_a_b,activa:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.patch('/api/maquinas/:id', async (req,res) => {
  try {
    const {placa,tipo,marca,modelo,propietario,tarifa_a_c,tarifa_a_b,activa} = req.body;
    await db.query('UPDATE maquinas SET placa=COALESCE($1,placa),tipo=COALESCE($2,tipo),marca=COALESCE($3,marca),modelo=COALESCE($4,modelo),propietario=COALESCE($5,propietario),tarifa_a_c=COALESCE($6,tarifa_a_c),tarifa_a_b=COALESCE($7,tarifa_a_b),activa=COALESCE($8,activa) WHERE id=$9',
      [placa,tipo,marca,modelo,propietario,tarifa_a_c,tarifa_a_b,activa,req.params.id]);
    const {rows} = await db.query('SELECT * FROM maquinas WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/operarios', async (req,res) => {
  try {
    const {nombre,cedula,telefono,actor,cliente_id,proveedor_id} = req.body;
    const id = uuidv4();
    await db.query('INSERT INTO operarios VALUES($1,$2,$3,$4,$5,$6,$7,true)',
      [id,nombre,cedula,telefono,actor||'c',cliente_id||null,proveedor_id||null]);
    res.status(201).json({id,nombre,cedula,telefono,activo:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/proyectos', async (req,res) => {
  try {
    const {nombre,cliente_id,ubicacion} = req.body;
    const id = uuidv4();
    await db.query('INSERT INTO proyectos VALUES($1,$2,$3,$4,true)',[id,cliente_id,nombre,ubicacion]);
    res.status(201).json({id,nombre,cliente_id,ubicacion,activo:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/usuarios', async (req,res) => {
  try {
    const {nombre,email,password,rol,actor,cliente_id,proveedor_id} = req.body;
    if (!nombre||!email||!password) return res.status(400).json({error:'Nombre, email y contraseña son obligatorios'});
    const existe = await db.query('SELECT id FROM usuarios WHERE email=$1',[email]);
    if (existe.rows.length) return res.status(400).json({error:'Ya existe un usuario con ese email'});
    const id = uuidv4();
    await db.query('INSERT INTO usuarios VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id,nombre,email,password,rol,actor,cliente_id||null,proveedor_id||null]);
    res.status(201).json({id,nombre,email,rol,actor,cliente_id,proveedor_id});
  } catch(e){res.status(500).json({error:e.message});}
});
app.patch('/api/usuarios/:id', async (req,res) => {
  try {
    const {nombre,email,password,rol,actor,cliente_id,proveedor_id} = req.body;
    if (email) {
      const existe = await db.query('SELECT id FROM usuarios WHERE email=$1 AND id!=$2',[email,req.params.id]);
      if (existe.rows.length) return res.status(400).json({error:'Ese email ya está en uso'});
    }
    await db.query(`UPDATE usuarios SET
      nombre=COALESCE($1,nombre), email=COALESCE($2,email),
      password=COALESCE($3,password), rol=COALESCE($4,rol), actor=COALESCE($5,actor),
      cliente_id=COALESCE($6,cliente_id), proveedor_id=COALESCE($7,proveedor_id)
      WHERE id=$8`, [nombre,email,password,rol,actor,cliente_id,proveedor_id,req.params.id]);
    const {rows} = await db.query('SELECT * FROM usuarios WHERE id=$1',[req.params.id]);
    const u = rows[0]; delete u.password;
    res.json(u);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// FINCAS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/fincas', async (req,res) => {
  try {
    let q = `SELECT f.*, c.nombre as cliente_nombre FROM fincas f
             LEFT JOIN clientes c ON c.id=f.cliente_id WHERE 1=1`;
    const params = [];
    if (req.query.cliente_id) { params.push(req.query.cliente_id); q+=` AND f.cliente_id=$${params.length}`; }
    const {rows} = await db.query(q+' ORDER BY f.nombre', params);
    res.json(rows);
  } catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/fincas/buscar/:nombre', async (req,res) => {
  try {
    const buscar = normalizarNombre(req.params.nombre);
    const {rows} = await db.query(`SELECT f.*, c.nombre as cliente_nombre FROM fincas f LEFT JOIN clientes c ON c.id=f.cliente_id WHERE f.activa=true`);
    const finca = rows.find(f => normalizarNombre(f.nombre) === buscar);
    if (!finca) return res.status(200).json({existe:false, nombre:'', cliente_id:''});
    res.json({existe:true, id:finca.id, nombre:finca.nombre, cliente_id:finca.cliente_id, cliente_nombre:finca.cliente_nombre});
  } catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/fincas', async (req,res) => {
  try {
    const {nombre,cliente_id} = req.body;
    if (!nombre||!cliente_id) return res.status(400).json({error:'nombre y cliente_id son obligatorios'});
    const {rows} = await db.query('SELECT * FROM fincas WHERE activa=true');
    if (rows.find(f=>normalizarNombre(f.nombre)===normalizarNombre(nombre)))
      return res.status(400).json({error:`Ya existe una finca con el nombre "${nombre}"`});
    const id = uuidv4();
    await db.query('INSERT INTO fincas VALUES($1,$2,$3,true)',[id,nombre.trim(),cliente_id]);
    res.status(201).json({id,nombre:nombre.trim(),cliente_id,activa:true});
  } catch(e){res.status(500).json({error:e.message});}
});
app.patch('/api/fincas/:id', async (req,res) => {
  try {
    const {nombre,activa,usuario_id} = req.body;
    const {rows:fu} = await db.query('SELECT * FROM fincas WHERE id=$1',[req.params.id]);
    if (!fu.length) return res.status(404).json({error:'Finca no encontrada'});
    const f = fu[0];
    if (usuario_id) {
      const {rows:usr} = await db.query('SELECT * FROM usuarios WHERE id=$1',[usuario_id]);
      const u = usr[0]||{};
      if (u.rol!=='admin_b' && u.cliente_id!==f.cliente_id)
        return res.status(403).json({error:'No tienes permiso para editar esta finca'});
    }
    await db.query('UPDATE fincas SET nombre=COALESCE($1,nombre),activa=COALESCE($2,activa) WHERE id=$3',
      [nombre,activa,req.params.id]);
    const {rows} = await db.query('SELECT * FROM fincas WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/fincas/:id', async (req,res) => {
  try {
    await db.query('UPDATE fincas SET activa=false WHERE id=$1',[req.params.id]);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// OPERARIOS — endpoints para Jelou
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/operarios/telefono/:telefono', async (req,res) => {
  const tel = req.params.telefono.replace(/\D/g,'');
  const {rows} = await db.query('SELECT * FROM operarios WHERE REGEXP_REPLACE(telefono,\'[^0-9]\',\'\',\'g\')=$1',[tel]);
  if (!rows.length) return res.status(404).json({existe:false});
  const op = rows[0];
  res.json({existe:true, id:op.id, nombre:op.nombre, cedula:op.cedula, cliente_id:op.cliente_id||null});
});
app.get('/api/operarios/cedula/:cedula', async (req,res) => {
  const ced = req.params.cedula.replace(/\D/g,'');
  const {rows} = await db.query('SELECT * FROM operarios WHERE REGEXP_REPLACE(cedula,\'[^0-9]\',\'\',\'g\')=$1',[ced]);
  if (!rows.length) return res.status(404).json({existe:false});
  res.json({existe:true, ...rows[0]});
});
app.post('/api/operarios/registrar', async (req,res) => {
  try {
    const {nombre,cedula,telefono} = req.body;
    if (!nombre||!cedula||!telefono) return res.status(400).json({error:'nombre, cedula y telefono son obligatorios'});
    const ced = cedula.replace(/\D/g,''), tel = telefono.replace(/\D/g,'');
    const existe = await db.query('SELECT * FROM operarios WHERE REGEXP_REPLACE(cedula,\'[^0-9]\',\'\',\'g\')=$1 OR REGEXP_REPLACE(telefono,\'[^0-9]\',\'\',\'g\')=$2',[ced,tel]);
    if (existe.rows.length) return res.json({existe:true, ...existe.rows[0]});
    const id = uuidv4();
    await db.query('INSERT INTO operarios VALUES($1,$2,$3,$4,\'c\',NULL,NULL,true)',[id,nombre.trim(),ced,tel]);
    res.status(201).json({existe:false, id, nombre:nombre.trim(), cedula:ced});
  } catch(e){res.status(500).json({error:e.message});}
});

// Buscar usuario por nombre
app.get('/api/usuarios/buscar/:nombre', async (req,res) => {
  try {
    const buscar = normalizarNombre(req.params.nombre);
    const rol = req.query.rol||'';
    let q = 'SELECT * FROM usuarios WHERE 1=1';
    const params = [];
    if (rol) { params.push(rol); q+=` AND rol=$${params.length}`; }
    const {rows} = await db.query(q, params);
    let match = rows.find(u=>normalizarNombre(u.nombre)===buscar);
    if (!match) match = rows.find(u=>normalizarNombre(u.nombre).includes(buscar));
    if (!match) match = rows.find(u=>buscar.includes(normalizarNombre(u.nombre)));
    if (!match) return res.status(404).json({encontrado:false});
    res.json({encontrado:true, nombre_exacto:match.nombre, rol:match.rol, actor:match.actor,
      cliente_id:match.cliente_id||null, proveedor_id:match.proveedor_id||null});
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/documentos', async (req,res) => {
  try {
    let q = 'SELECT * FROM documentos WHERE 1=1';
    const params = [];
    if (req.query.status)      { params.push(req.query.status);      q+=` AND status=$${params.length}`; }
    if (req.query.cliente_id)  { params.push(req.query.cliente_id);  q+=` AND cliente_id=$${params.length}`; }
    if (req.query.maquina_id)  { params.push(req.query.maquina_id);  q+=` AND maquina_id=$${params.length}`; }
    if (req.query.desde)       { params.push(req.query.desde);       q+=` AND fecha_trabajo>=$${params.length}`; }
    if (req.query.hasta)       { params.push(req.query.hasta);       q+=` AND fecha_trabajo<=$${params.length}`; }
    if (req.query.proveedor_id) {
      // Filtrar por máquinas del proveedor
      const {rows:mqs} = await db.query('SELECT id FROM maquinas WHERE propietario=$1',[req.query.proveedor_id]);
      const ids = mqs.map(m=>m.id);
      if (!ids.length) return res.json([]);
      params.push(ids); q+=` AND maquina_id=ANY($${params.length})`;
    }
    q += ' ORDER BY fecha_registro DESC';
    const {rows} = await db.query(q, params);
    const enriched = await Promise.all(rows.map(enrichDoc));
    res.json(enriched);
  } catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/documentos', upload.single('foto'), async (req,res) => {
  try {
    const {
      operario_id, cliente_id, proyecto_id, maquina_id, fecha_trabajo, obra,
      finca, area, combustible, observaciones,
      supervisor_alquimaq, supervisor_cliente, supervisor_cliente_sup,
      manana_inicio:mi_raw, manana_fin:mf_raw, tarde_inicio:ti_raw, tarde_fin:tf_raw,
      total_horas_declaradas, horometro_inicio, horometro_fin
    } = req.body;
    if (!maquina_id||!fecha_trabajo||!obra||!total_horas_declaradas)
      return res.status(400).json({error:'Campos obligatorios incompletos'});
    const manana_inicio=normalizarHora(mi_raw), manana_fin=normalizarHora(mf_raw);
    const tarde_inicio=normalizarHora(ti_raw),  tarde_fin=normalizarHora(tf_raw);
    const hD=parseFloat(total_horas_declaradas)||0;
    const hIni=horometro_inicio?parseFloat(horometro_inicio):null;
    const hFin=horometro_fin?parseFloat(horometro_fin):null;
    const hoy=new Date().toISOString().slice(0,10);
    const id=uuidv4(), num=await nextNum('doc');
    // Normalizar supervisores
    let supAlq=supervisor_alquimaq||'', supCli=supervisor_cliente||'';
    const {rows:usrs} = await db.query('SELECT * FROM usuarios');
    const uAlq = usrs.find(u=>normalizarNombre(u.nombre)===normalizarNombre(supAlq));
    const uCli = usrs.find(u=>normalizarNombre(u.nombre)===normalizarNombre(supCli));
    if (uAlq) supAlq=uAlq.nombre;
    if (uCli) supCli=uCli.nombre;
    await db.query(`INSERT INTO documentos VALUES($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,false,'portal','pendiente_b',NULL,NULL,NULL,NULL)`,
      [id,num,operario_id||null,cliente_id||null,proyecto_id||null,maquina_id,
       fecha_trabajo,obra,finca||'',area||'',combustible||'',observaciones||'',
       supAlq,supCli,supervisor_cliente_sup||'',
       manana_inicio,manana_fin,tarde_inicio,tarde_fin,
       hD,hIni,hFin,req.file?`/uploads/${req.file.filename}`:null,
       fecha_trabajo<hoy]);
    const {rows} = await db.query('SELECT * FROM documentos WHERE id=$1',[id]);
    res.status(201).json(await enrichDoc(rows[0]));
  } catch(e){res.status(500).json({error:e.message});}
});

// Aprobar/rechazar B
app.patch('/api/documentos/:id/aprobar_b', async (req,res) => {
  try {
    const {rows} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'No encontrado'});
    const r = rows[0];
    if (r.status!=='pendiente_b') return res.status(400).json({error:'Estado inválido'});
    const {rows:usrs} = await db.query('SELECT * FROM usuarios WHERE id=$1',[req.body.usuario_id]);
    const usr = usrs[0]||{};
    if (usr.rol==='controlador_b' && r.supervisor_alquimaq && r.supervisor_alquimaq!==usr.nombre)
      return res.status(403).json({error:`Este documento está asignado al controlador "${r.supervisor_alquimaq}"`});
    const aprobacion = {usuario_id:req.body.usuario_id,nombre:req.body.nombre,fecha:new Date().toISOString(),notas:req.body.notas||''};
    await db.query('UPDATE documentos SET status=$1,aprobacion_b=$2 WHERE id=$3',
      ['pendiente_c',JSON.stringify(aprobacion),req.params.id]);
    const {rows:updated} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    res.json(await enrichDoc(updated[0]));
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/documentos/:id/rechazar_b', async (req,res) => {
  try {
    const {rows} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'No encontrado'});
    const r = rows[0];
    if (r.status!=='pendiente_b') return res.status(400).json({error:'Estado inválido'});
    const {rows:usrs} = await db.query('SELECT * FROM usuarios WHERE id=$1',[req.body.usuario_id]);
    const usr = usrs[0]||{};
    if (usr.rol==='controlador_b' && r.supervisor_alquimaq && r.supervisor_alquimaq!==usr.nombre)
      return res.status(403).json({error:`Este documento está asignado al controlador "${r.supervisor_alquimaq}"`});
    const aprobacion = {usuario_id:req.body.usuario_id,nombre:req.body.nombre,fecha:new Date().toISOString(),notas:req.body.notas||''};
    await db.query('UPDATE documentos SET status=$1,aprobacion_b=$2 WHERE id=$3',
      ['rechazado_b',JSON.stringify(aprobacion),req.params.id]);
    const {rows:updated} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    res.json(await enrichDoc(updated[0]));
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/documentos/:id/aprobar_c', async (req,res) => {
  try {
    const {rows} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'No encontrado'});
    const r = rows[0];
    if (r.status!=='pendiente_c') return res.status(400).json({error:'Estado inválido'});
    const {rows:usrs} = await db.query('SELECT * FROM usuarios WHERE id=$1',[req.body.usuario_id]);
    const usr = usrs[0]||{};
    if (usr.actor==='b') return res.status(403).json({error:'El equipo de Alquimaq no puede aprobar en nombre del cliente'});
    if (usr.rol==='coordinador_c') return res.status(403).json({error:'El coordinador no aprueba documentos individuales'});
    if (usr.rol==='controlador_c' && r.supervisor_cliente && r.supervisor_cliente!==usr.nombre)
      return res.status(403).json({error:`Este documento está asignado al controlador "${r.supervisor_cliente}"`});
    const aprobacion = {usuario_id:req.body.usuario_id,nombre:req.body.nombre,fecha:new Date().toISOString(),notas:req.body.notas||''};
    await db.query('UPDATE documentos SET status=$1,aprobacion_c=$2 WHERE id=$3',
      ['aprobado_c',JSON.stringify(aprobacion),req.params.id]);
    // Agregar a planillas
    await agregarAPlanillas(r);
    const {rows:updated} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    res.json(await enrichDoc(updated[0]));
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/documentos/:id/rechazar_c', async (req,res) => {
  try {
    const {rows} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'No encontrado'});
    const r = rows[0];
    if (r.status!=='pendiente_c') return res.status(400).json({error:'Estado inválido'});
    const {rows:usrs} = await db.query('SELECT * FROM usuarios WHERE id=$1',[req.body.usuario_id]);
    const usr = usrs[0]||{};
    if (usr.actor==='b') return res.status(403).json({error:'El equipo de Alquimaq no puede rechazar en nombre del cliente'});
    if (usr.rol==='coordinador_c') return res.status(403).json({error:'El coordinador no rechaza documentos individuales'});
    if (usr.rol==='controlador_c' && r.supervisor_cliente && r.supervisor_cliente!==usr.nombre)
      return res.status(403).json({error:`Este documento está asignado al controlador "${r.supervisor_cliente}"`});
    const aprobacion = {usuario_id:req.body.usuario_id,nombre:req.body.nombre,fecha:new Date().toISOString(),notas:req.body.notas||''};
    await db.query('UPDATE documentos SET status=$1,aprobacion_c=$2 WHERE id=$3',
      ['rechazado_c',JSON.stringify(aprobacion),req.params.id]);
    const {rows:updated} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    res.json(await enrichDoc(updated[0]));
  } catch(e){res.status(500).json({error:e.message});}
});

// Editar documento
app.patch('/api/documentos/:id', upload.single('foto'), async (req,res) => {
  try {
    const {rows} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'No encontrado'});
    const r = rows[0];
    const editables = ['pendiente_b','pendiente_c','rechazado_b','rechazado_c'];
    if (!editables.includes(r.status)) return res.status(400).json({error:'No se puede editar un documento ya aprobado o en planilla'});
    const body = req.body;
    const mi=normalizarHora(body.manana_inicio||r.manana_inicio);
    const mf=normalizarHora(body.manana_fin||r.manana_fin);
    const ti=normalizarHora(body.tarde_inicio||r.tarde_inicio);
    const tf=normalizarHora(body.tarde_fin||r.tarde_fin);
    const hD=parseFloat(body.total_horas_declaradas||r.total_horas_declaradas)||0;
    const hm=calcH(mi,mf), ht=calcH(ti,tf), hR=Math.round((hm+ht)*10)/10;
    if (hR>0 && Math.abs(hR-hD)>0.2) return res.status(400).json({error:`Rangos suman ${hR}h pero declaras ${hD}h`});
    const nuevoStatus = r.status==='rechazado_b'?'pendiente_b':r.status==='rechazado_c'?'pendiente_c':r.status;
    const foto = req.file?`/uploads/${req.file.filename}`:(body.foto_url||r.foto_url);
    await db.query(`UPDATE documentos SET
      fecha_trabajo=COALESCE($1,fecha_trabajo), obra=COALESCE($2,obra),
      finca=COALESCE($3,finca), area=COALESCE($4,area), combustible=COALESCE($5,combustible),
      observaciones=COALESCE($6,observaciones), supervisor_alquimaq=COALESCE($7,supervisor_alquimaq),
      supervisor_cliente=COALESCE($8,supervisor_cliente), supervisor_cliente_sup=COALESCE($9,supervisor_cliente_sup),
      manana_inicio=$10, manana_fin=$11, tarde_inicio=$12, tarde_fin=$13,
      total_horas_declaradas=$14, horometro_inicio=$15, horometro_fin=$16,
      foto_url=$17, status=$18, editado_por=$19, editado_en=NOW() WHERE id=$20`,
      [body.fecha_trabajo,body.obra,body.finca,body.area,body.combustible,body.observaciones,
       body.supervisor_alquimaq,body.supervisor_cliente,body.supervisor_cliente_sup,
       mi,mf,ti,tf,hD,
       body.horometro_inicio?parseFloat(body.horometro_inicio):r.horometro_inicio,
       body.horometro_fin?parseFloat(body.horometro_fin):r.horometro_fin,
       foto,nuevoStatus,body.editado_por||null,req.params.id]);
    const {rows:updated} = await db.query('SELECT * FROM documentos WHERE id=$1',[req.params.id]);
    res.json(await enrichDoc(updated[0]));
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLAS — helper agregar a planillas tras aprobar_c
// ─────────────────────────────────────────────────────────────────────────────
async function agregarAPlanillas(r) {
  const hD = parseFloat(r.total_horas_declaradas)||0;
  const {rows:mqs} = await db.query('SELECT * FROM maquinas WHERE id=$1',[r.maquina_id]);
  const mq = mqs[0];

  // Planilla cliente
  if (r.cliente_id) {
    const tarifa = parseFloat(mq?.tarifa_a_c)||0;
    const {rows:pbc} = await db.query('SELECT * FROM planillas_cliente WHERE cliente_id=$1 AND status=$2',
      [r.cliente_id,'abierta']);
    if (pbc.length) {
      const p = pbc[0];
      const ids = [...(p.documentos_ids||[]), r.id];
      await db.query('UPDATE planillas_cliente SET documentos_ids=$1,total_horas=$2,total_monto=$3 WHERE id=$4',
        [ids, parseFloat(p.total_horas)+hD, parseFloat(p.total_monto)+(hD*tarifa), p.id]);
    } else {
      const id=uuidv4();
      await db.query('INSERT INTO planillas_cliente(id,cliente_id,periodo_inicio,documentos_ids,total_horas,total_monto,status,creada_en) VALUES($1,$2,$3,$4,$5,$6,$7,NOW())',
        [id,r.cliente_id,r.fecha_trabajo,[r.id],hD,hD*tarifa,'abierta']);
    }
  }

  // Planilla proveedor
  if (mq && mq.propietario!=='b') {
    const tarifa = parseFloat(mq.tarifa_a_b)||0;
    const {rows:pp} = await db.query('SELECT * FROM planillas_prov WHERE proveedor_id=$1 AND status=$2',
      [mq.propietario,'abierta']);
    if (pp.length) {
      const p = pp[0];
      const ids = [...(p.documentos_ids||[]), r.id];
      await db.query('UPDATE planillas_prov SET documentos_ids=$1,total_horas=$2,total_monto=$3 WHERE id=$4',
        [ids, parseFloat(p.total_horas)+hD, parseFloat(p.total_monto)+(hD*tarifa), p.id]);
    } else {
      const id=uuidv4();
      await db.query('INSERT INTO planillas_prov(id,proveedor_id,documentos_ids,total_horas,total_monto,status,creada_en) VALUES($1,$2,$3,$4,$5,$6,NOW())',
        [id,mq.propietario,[r.id],hD,hD*tarifa,'abierta']);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLAS CLIENTE
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/planillas_cliente', async (req,res) => {
  try {
    let q = 'SELECT p.*,c.nombre as cliente_nombre FROM planillas_cliente p LEFT JOIN clientes c ON c.id=p.cliente_id WHERE 1=1';
    const params=[];
    if (req.query.cliente_id) { params.push(req.query.cliente_id); q+=` AND p.cliente_id=$${params.length}`; }
    if (req.query.status)     { params.push(req.query.status);     q+=` AND p.status=$${params.length}`; }
    const {rows:planillas} = await db.query(q+' ORDER BY p.creada_en DESC', params);
    const result = await Promise.all(planillas.map(async p=>{
      let docs = [];
      if (p.documentos_ids?.length) {
        const {rows:docRows} = await db.query('SELECT * FROM documentos WHERE id=ANY($1)',[p.documentos_ids]);
        let filtered = docRows;
        if (req.query.placa) filtered=filtered.filter(r=>r.maquina_id===req.query.placa);
        if (req.query.finca) filtered=filtered.filter(r=>r.finca&&normalizarNombre(r.finca).includes(normalizarNombre(req.query.finca)));
        if (req.query.area)  filtered=filtered.filter(r=>r.area &&normalizarNombre(r.area).includes(normalizarNombre(req.query.area)));
        docs = await Promise.all(filtered.map(enrichDoc));
      }
      return {...p, documentos:docs};
    }));
    res.json(result);
  } catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/planillas_cliente/:id/cerrar_parcial', async (req,res) => {
  try {
    const {rows:pr} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[req.params.id]);
    if (!pr.length) return res.status(404).json({error:'No encontrado'});
    const p = pr[0];
    if (p.status!=='abierta') return res.status(400).json({error:'Planilla no está abierta'});
    const selIds = req.body.documentos_ids||[];
    if (!selIds.length) return res.status(400).json({error:'Selecciona al menos un documento'});
    const {rows:docsSel} = await db.query('SELECT * FROM documentos WHERE id=ANY($1)',[selIds]);
    const {rows:mqs} = await db.query('SELECT * FROM maquinas');
    const maqMap = Object.fromEntries(mqs.map(m=>[m.id,m]));
    const totalHoras = docsSel.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0),0);
    const totalMonto = docsSel.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0)*(parseFloat(maqMap[r.maquina_id]?.tarifa_a_c)||0),0);
    const num = await nextNum('planilla_cli');
    const id = uuidv4();
    const periodoIni = docsSel.reduce((m,r)=>r.fecha_trabajo<m?r.fecha_trabajo:m, docsSel[0].fecha_trabajo);
    await db.query(`INSERT INTO planillas_cliente(id,num_documento,cliente_id,periodo_inicio,periodo_fin,documentos_ids,total_horas,total_monto,status,aprobacion_c,cerrada_en,creada_en)
      VALUES($1,$2,$3,$4,NOW(),$5,$6,$7,'pendiente_recepcion',$8,NOW(),NOW())`,
      [id,num,p.cliente_id,periodoIni,selIds,Math.round(totalHoras*10)/10,Math.round(totalMonto*100)/100,
       JSON.stringify({usuario_id:req.body.usuario_id,fecha:new Date().toISOString()})]);
    // Generar OC
    const ocId=uuidv4(), ocNum=await nextNum('oc');
    await db.query('INSERT INTO ordenes_compra VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())',
      [ocId,ocNum,'alquimaq_a_cliente','alquimaq',p.cliente_id,id,Math.round(totalMonto*100)/100,'emitida']);
    await db.query('UPDATE planillas_cliente SET oc_b_id=$1 WHERE id=$2',[ocId,id]);
    // Quitar docs de la planilla abierta
    const restIds = (p.documentos_ids||[]).filter(x=>!selIds.includes(x));
    const {rows:docsRest} = restIds.length ? await db.query('SELECT * FROM documentos WHERE id=ANY($1)',[restIds]) : {rows:[]};
    const restHoras = docsRest.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0),0);
    const restMonto = docsRest.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0)*(parseFloat(maqMap[r.maquina_id]?.tarifa_a_c)||0),0);
    await db.query('UPDATE planillas_cliente SET documentos_ids=$1,total_horas=$2,total_monto=$3 WHERE id=$4',
      [restIds,Math.round(restHoras*10)/10,Math.round(restMonto*100)/100,p.id]);
    const {rows:nueva} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[id]);
    res.json(nueva[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/planillas_cliente/:id/cerrar', async (req,res) => {
  try {
    const {rows:pr} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[req.params.id]);
    if (!pr.length) return res.status(404).json({error:'No encontrado'});
    const p = pr[0];
    const num = await nextNum('planilla_cli');
    await db.query('UPDATE planillas_cliente SET status=$1,num_documento=$2,periodo_fin=NOW(),aprobacion_c=$3,cerrada_en=NOW() WHERE id=$4',
      ['pendiente_recepcion',num,JSON.stringify({usuario_id:req.body.usuario_id,fecha:new Date().toISOString()}),req.params.id]);
    const ocId=uuidv4(), ocNum=await nextNum('oc');
    await db.query('INSERT INTO ordenes_compra VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())',
      [ocId,ocNum,'alquimaq_a_cliente','alquimaq',p.cliente_id,req.params.id,p.total_monto,'emitida']);
    await db.query('UPDATE planillas_cliente SET oc_b_id=$1 WHERE id=$2',[ocId,req.params.id]);
    const {rows:updated} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[req.params.id]);
    res.json(updated[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/planillas_cliente/:id/recepcion', async (req,res) => {
  try {
    const recId=uuidv4(), recNum=await nextNum('rec');
    const {rows:pr} = await db.query('SELECT total_monto,cliente_id FROM planillas_cliente WHERE id=$1',[req.params.id]);
    await db.query('INSERT INTO recepciones VALUES($1,$2,$3,$4,$5,$6,NOW())',
      [recId,recNum,'c_recibe_de_b',req.params.id,pr[0].total_monto,'emitida']);
    await db.query('UPDATE planillas_cliente SET status=$1,recepcion_c_id=$2 WHERE id=$3',
      ['pendiente_factura',recId,req.params.id]);
    const {rows} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/planillas_cliente/:id/facturar', async (req,res) => {
  try {
    const facId=uuidv4(), facNum=await nextNum('fac');
    const {rows:pr} = await db.query('SELECT total_monto,cliente_id FROM planillas_cliente WHERE id=$1',[req.params.id]);
    await db.query('INSERT INTO facturas VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())',
      [facId,facNum,'b_factura_c',req.body.numero||'','alquimaq',pr[0].cliente_id,req.params.id,pr[0].total_monto,'emitida']);
    await db.query('UPDATE planillas_cliente SET status=$1,factura_b_id=$2 WHERE id=$3',
      ['facturada',facId,req.params.id]);
    const {rows} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/planillas_cliente/:id/pagar', async (req,res) => {
  try {
    await db.query("UPDATE planillas_cliente SET status='pagada' WHERE id=$1",[req.params.id]);
    const {rows} = await db.query('SELECT * FROM planillas_cliente WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLAS PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/planillas_prov', async (req,res) => {
  try {
    let q = 'SELECT p.*,pr.nombre as proveedor_nombre FROM planillas_prov p LEFT JOIN proveedores pr ON pr.id=p.proveedor_id WHERE 1=1';
    const params=[];
    if (req.query.proveedor_id) { params.push(req.query.proveedor_id); q+=` AND p.proveedor_id=$${params.length}`; }
    if (req.query.status)       { params.push(req.query.status);       q+=` AND p.status=$${params.length}`; }
    const {rows:planillas} = await db.query(q+' ORDER BY p.creada_en DESC', params);
    const result = await Promise.all(planillas.map(async p=>{
      let docs=[];
      if (p.documentos_ids?.length) {
        const {rows:docRows} = await db.query('SELECT * FROM documentos WHERE id=ANY($1)',[p.documentos_ids]);
        docs = await Promise.all(docRows.map(enrichDoc));
      }
      return {...p, documentos:docs};
    }));
    res.json(result);
  } catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/planillas_prov/:id/cerrar_parcial', async (req,res) => {
  try {
    const {rows:pr} = await db.query('SELECT * FROM planillas_prov WHERE id=$1',[req.params.id]);
    if (!pr.length) return res.status(404).json({error:'No encontrado'});
    const p = pr[0];
    if (p.status!=='abierta') return res.status(400).json({error:'Planilla no está abierta'});
    const selIds = req.body.documentos_ids||[];
    if (!selIds.length) return res.status(400).json({error:'Selecciona al menos un documento'});
    const {rows:docsSel} = await db.query('SELECT * FROM documentos WHERE id=ANY($1)',[selIds]);
    const {rows:mqs} = await db.query('SELECT * FROM maquinas');
    const maqMap = Object.fromEntries(mqs.map(m=>[m.id,m]));
    const totalHoras = docsSel.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0),0);
    const totalMonto = docsSel.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0)*(parseFloat(maqMap[r.maquina_id]?.tarifa_a_b)||0),0);
    const num = await nextNum('planilla_prov');
    const id = uuidv4();
    await db.query(`INSERT INTO planillas_prov(id,num_documento,proveedor_id,documentos_ids,total_horas,total_monto,status,aprobacion_b,cerrada_en,creada_en)
      VALUES($1,$2,$3,$4,$5,$6,'pendiente_factura',$7,NOW(),NOW())`,
      [id,num,p.proveedor_id,selIds,Math.round(totalHoras*10)/10,Math.round(totalMonto*100)/100,
       JSON.stringify({usuario_id:req.body.usuario_id,fecha:new Date().toISOString()})]);
    // Generar OC y recepción
    const ocId=uuidv4(), ocNum=await nextNum('oc');
    const recId=uuidv4(), recNum=await nextNum('rec');
    await db.query('INSERT INTO ordenes_compra VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())',
      [ocId,ocNum,'prov_a_alquimaq',p.proveedor_id,'alquimaq',id,Math.round(totalMonto*100)/100,'emitida']);
    await db.query('INSERT INTO recepciones VALUES($1,$2,$3,$4,$5,$6,NOW())',
      [recId,recNum,'b_recibe_de_prov',id,Math.round(totalMonto*100)/100,'emitida']);
    await db.query('UPDATE planillas_prov SET oc_id=$1,recepcion_id=$2 WHERE id=$3',[ocId,recId,id]);
    // Quitar docs de la planilla abierta
    const restIds = (p.documentos_ids||[]).filter(x=>!selIds.includes(x));
    const {rows:docsRest} = restIds.length ? await db.query('SELECT * FROM documentos WHERE id=ANY($1)',[restIds]) : {rows:[]};
    const restHoras = docsRest.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0),0);
    const restMonto = docsRest.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0)*(parseFloat(maqMap[r.maquina_id]?.tarifa_a_b)||0),0);
    await db.query('UPDATE planillas_prov SET documentos_ids=$1,total_horas=$2,total_monto=$3 WHERE id=$4',
      [restIds,Math.round(restHoras*10)/10,Math.round(restMonto*100)/100,p.id]);
    const {rows:nueva} = await db.query('SELECT * FROM planillas_prov WHERE id=$1',[id]);
    res.json(nueva[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/planillas_prov/:id/facturar', async (req,res) => {
  try {
    const facId=uuidv4(), facNum=await nextNum('fac');
    const {rows:pr} = await db.query('SELECT total_monto,proveedor_id FROM planillas_prov WHERE id=$1',[req.params.id]);
    await db.query('INSERT INTO facturas VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())',
      [facId,facNum,'prov_factura_b',req.body.numero||'',pr[0].proveedor_id,'alquimaq',req.params.id,pr[0].total_monto,'emitida']);
    await db.query("UPDATE planillas_prov SET status='facturada',factura_id=$1 WHERE id=$2",[facId,req.params.id]);
    const {rows} = await db.query('SELECT * FROM planillas_prov WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

app.patch('/api/planillas_prov/:id/pagar', async (req,res) => {
  try {
    await db.query("UPDATE planillas_prov SET status='pagada' WHERE id=$1",[req.params.id]);
    const {rows} = await db.query('SELECT * FROM planillas_prov WHERE id=$1',[req.params.id]);
    res.json(rows[0]);
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT JELOU
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/documentos/jelou', async (req,res) => {
  try {
    const {
      operario_nombre, operario_cedula,
      fecha_trabajo, maquina_placa, obra,
      finca, area, combustible, observaciones,
      supervisor_alquimaq:supAlqRaw, supervisor_cliente:supCliRaw, supervisor_cliente_sup,
      manana_inicio:mi_raw, manana_fin:mf_raw, tarde_inicio:ti_raw, tarde_fin:tf_raw,
      total_horas_declaradas, horometro_inicio, horometro_fin
    } = req.body;
    if (!maquina_placa||!fecha_trabajo||!obra||!total_horas_declaradas)
      return res.status(400).json({error:'Campos obligatorios: maquina_placa, fecha_trabajo, obra, total_horas_declaradas'});
    // Buscar máquina
    const placa = (maquina_placa||'').toString().replace(/[^A-Z0-9]/gi,'').toUpperCase();
    const {rows:mqs} = await db.query('SELECT * FROM maquinas WHERE activa=true');
    const maq = mqs.find(m=>m.placa.replace(/[^A-Z0-9]/gi,'').toUpperCase()===placa);
    if (!maq) return res.status(404).json({error:`Máquina "${maquina_placa}" no encontrada`});
    // Buscar o crear operario
    let operario = null;
    if (operario_cedula) {
      const {rows:op} = await db.query('SELECT * FROM operarios WHERE REGEXP_REPLACE(cedula,\'[^0-9]\',\'\',\'g\')=$1',[operario_cedula.toString().replace(/\D/g,'')]);
      if (op.length) operario=op[0];
    }
    if (!operario && operario_nombre) {
      const {rows:op} = await db.query('SELECT * FROM operarios WHERE LOWER(nombre)=LOWER($1)',[operario_nombre]);
      if (op.length) operario=op[0];
    }
    if (!operario && (operario_nombre||operario_cedula)) {
      const id=uuidv4();
      await db.query('INSERT INTO operarios VALUES($1,$2,$3,$4,\'c\',NULL,NULL,true)',
        [id,operario_nombre||'Sin nombre',(operario_cedula||'').toString().replace(/\D/g,''),'']);
      const {rows:op} = await db.query('SELECT * FROM operarios WHERE id=$1',[id]);
      operario=op[0];
    }
    // Normalizar horas
    const manana_inicio=normalizarHora(mi_raw), manana_fin=normalizarHora(mf_raw);
    const tarde_inicio=normalizarHora(ti_raw),   tarde_fin=normalizarHora(tf_raw);
    const hD=parseFloat(total_horas_declaradas)||0;
    const hIni=horometro_inicio?parseFloat(horometro_inicio):null;
    const hFin=horometro_fin?parseFloat(horometro_fin):null;
    // Normalizar supervisores
    const {rows:usrs} = await db.query('SELECT * FROM usuarios');
    let supAlq=supAlqRaw||'', supCli=supCliRaw||'';
    const uAlq=usrs.find(u=>normalizarNombre(u.nombre)===normalizarNombre(supAlq));
    const uCli=usrs.find(u=>normalizarNombre(u.nombre)===normalizarNombre(supCli));
    if (uAlq) supAlq=uAlq.nombre;
    if (uCli) supCli=uCli.nombre;
    // Obtener cliente_id desde finca si no hay operario con cliente
    let clienteId = operario?.cliente_id||null;
    if (!clienteId && finca) {
      const {rows:fs} = await db.query('SELECT * FROM fincas WHERE activa=true');
      const fi = fs.find(f=>normalizarNombre(f.nombre)===normalizarNombre(finca));
      if (fi) clienteId=fi.cliente_id;
    }
    const hoy=new Date().toISOString().slice(0,10);
    const id=uuidv4(), num=await nextNum('doc');
    await db.query(`INSERT INTO documentos VALUES($1,$2,$3,$4,NULL,$5,$6,NOW(),$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'whatsapp_jelou','pendiente_b',NULL,NULL,NULL,NULL)`,
      [id,num,operario?.id||null,clienteId,maq.id,
       fecha_trabajo,obra,finca||'',area||'',combustible||'',observaciones||'',
       supAlq,supCli,supervisor_cliente_sup||'',
       manana_inicio,manana_fin,tarde_inicio,tarde_fin,
       hD,hIni,hFin,null,fecha_trabajo<hoy]);
    res.status(201).json({
      success:true, num_documento:num,
      mensaje:`Registro ${num} guardado. Pendiente de aprobación.`
    });
  } catch(e){console.error(e); res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (req,res) => {
  try {
    const mes = new Date().toISOString().slice(0,7);
    const [pendB, pendC, aprov, pltAbiertas, facPend] = await Promise.all([
      db.query("SELECT COUNT(*) FROM documentos WHERE status='pendiente_b'"),
      db.query("SELECT COUNT(*) FROM documentos WHERE status='pendiente_c'"),
      db.query(`SELECT d.*,m.tarifa_a_c,m.tarifa_a_b,m.propietario FROM documentos d LEFT JOIN maquinas m ON m.id=d.maquina_id WHERE d.status='aprobado_c' AND TO_CHAR(d.fecha_trabajo,'YYYY-MM')=$1`,[mes]),
      db.query("SELECT COUNT(*) FROM planillas_cliente WHERE status='abierta'"),
      db.query("SELECT COUNT(*) FROM facturas WHERE status='emitida'"),
    ]);
    const docs = aprov.rows;
    const cobradoC = docs.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0)*(parseFloat(r.tarifa_a_c)||0),0);
    const pagadoA  = docs.filter(r=>r.propietario!=='b').reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0)*(parseFloat(r.tarifa_a_b)||0),0);
    const horasAprobadas = docs.reduce((s,r)=>s+(parseFloat(r.total_horas_declaradas)||0),0);
    res.json({
      pendB: parseInt(pendB.rows[0].count),
      pendC: parseInt(pendC.rows[0].count),
      horasAprobadas, cobradoC, pagadoA,
      margenB: cobradoC-pagadoA,
      plantillasAbiertas: parseInt(pltAbiertas.rows[0].count),
      facturasPendientes: parseInt(facPend.rows[0].count),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT EXCEL
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/export/documentos', async (req,res) => {
  try {
    let q='SELECT * FROM documentos WHERE 1=1';
    const params=[];
    if (req.query.status) { params.push(req.query.status); q+=` AND status=$${params.length}`; }
    if (req.query.desde)  { params.push(req.query.desde);  q+=` AND fecha_trabajo>=$${params.length}`; }
    if (req.query.hasta)  { params.push(req.query.hasta);  q+=` AND fecha_trabajo<=$${params.length}`; }
    q+=' ORDER BY fecha_registro DESC';
    const {rows} = await db.query(q,params);
    const enriched = await Promise.all(rows.map(enrichDoc));
    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet('Documentos');
    const hdrs=['No. Documento','Cliente','Máquina','Fecha Trabajo','Obra','Finca','Área','Controlador Alquimaq','Controlador Cliente','Jornada Mañana','Jornada Tarde','Total Horas','Horómetro Ini','Horómetro Fin','Estado'];
    const hRow=ws.addRow(hdrs);
    hRow.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1B3A5C'}};c.font={bold:true,color:{argb:'FFFFFFFF'}};});
    enriched.forEach(r=>{
      const mn=r.manana_inicio&&r.manana_fin?`${r.manana_inicio}→${r.manana_fin}`:'—';
      const td=r.tarde_inicio&&r.tarde_fin?`${r.tarde_inicio}→${r.tarde_fin}`:'—';
      ws.addRow([r.num_documento,r.cliente_nombre,r.maquina_placa,
        r.fecha_trabajo?.slice?.(0,10)||r.fecha_trabajo,
        r.obra,r.finca,r.area,r.supervisor_alquimaq,r.supervisor_cliente,
        mn,td,r.total_horas_declaradas,r.horometro_inicio,r.horometro_fin,r.status]);
    });
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="PortalHoras_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res); res.end();
  } catch(e){res.status(500).json({error:e.message});}
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname,'public')));
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
initDB().then(()=>{
  app.listen(PORT,()=>console.log(`\n✅  Alquimaq Portal (PostgreSQL) en http://localhost:${PORT}\n`));
}).catch(e=>{
  console.error('Error iniciando DB:', e);
  process.exit(1);
});
