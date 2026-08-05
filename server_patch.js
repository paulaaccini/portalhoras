// Script para aplicar los 5 cambios al server.js
const fs = require('fs');
let src = fs.readFileSync('/home/claude/portalhoras/server.js', 'utf8');

// ── CAMBIO 1: Filtro proveedor_id en GET /api/documentos ──────────────────
// Agregar filtro proveedor_id que solo muestra docs de máquinas del proveedor
src = src.replace(
`app.get('/api/documentos', (req, res) => {
  const db = readDB();
  let list = db.documentos.map(r => enrich(r, db));
  const { status, cliente_id, maquina_id, desde, hasta } = req.query;
  if (status)     list = list.filter(r => r.status === status);
  if (cliente_id) list = list.filter(r => r.cliente_id === cliente_id);
  if (maquina_id) list = list.filter(r => r.maquina_id === maquina_id);
  if (desde)      list = list.filter(r => r.fecha_trabajo >= desde);
  if (hasta)      list = list.filter(r => r.fecha_trabajo <= hasta);
  list.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
  res.json(list);
});`,
`app.get('/api/documentos', (req, res) => {
  const db = readDB();
  let list = db.documentos.map(r => enrich(r, db));
  const { status, cliente_id, maquina_id, desde, hasta, proveedor_id } = req.query;
  if (status)       list = list.filter(r => r.status === status);
  if (cliente_id)   list = list.filter(r => r.cliente_id === cliente_id);
  if (maquina_id)   list = list.filter(r => r.maquina_id === maquina_id);
  if (desde)        list = list.filter(r => r.fecha_trabajo >= desde);
  if (hasta)        list = list.filter(r => r.fecha_trabajo <= hasta);
  // CAMBIO 1: proveedor solo ve docs de sus máquinas
  if (proveedor_id) {
    const maqsProv = db.maquinas.filter(m => m.propietario === proveedor_id).map(m => m.id);
    list = list.filter(r => maqsProv.includes(r.maquina_id));
  }
  list.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
  res.json(list);
});`
);

// ── CAMBIO 3: admin_b NO puede aprobar/rechazar en nombre del cliente ─────
// aprobar_c y rechazar_c: bloquear si actor es b (salvo supervisor_c y compras_c)
src = src.replace(
`app.patch('/api/documentos/:id/aprobar_c', (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_c') return res.status(400).json({ error: 'Ya procesado' });`,
`app.patch('/api/documentos/:id/aprobar_c', (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_c') return res.status(400).json({ error: 'Ya procesado' });
  // CAMBIO 3: solo usuarios del cliente (actor c) pueden aprobar en nombre del cliente
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  if (usr.actor === 'b' && usr.rol !== 'admin_b') return res.status(403).json({ error: 'Solo el cliente puede aprobar este documento' });
  if (usr.actor === 'b') return res.status(403).json({ error: 'El equipo de Alquimaq no puede aprobar en nombre del cliente' });`
);

src = src.replace(
`app.patch('/api/documentos/:id/rechazar_c', (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_c') return res.status(400).json({ error: 'Ya procesado' });`,
`app.patch('/api/documentos/:id/rechazar_c', (req, res) => {
  const db = readDB();
  const r  = db.documentos.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'No encontrado' });
  if (r.status !== 'pendiente_c') return res.status(400).json({ error: 'Ya procesado' });
  // CAMBIO 3: solo usuarios del cliente pueden rechazar
  const usr = db.usuarios.find(x => x.id === req.body.usuario_id) || {};
  if (usr.actor === 'b') return res.status(403).json({ error: 'El equipo de Alquimaq no puede rechazar en nombre del cliente' });`
);

// ── CAMBIO 4: cerrar planilla con selección de documentos ─────────────────
// Añadir endpoint POST /api/planillas_prov/:id/cerrar_parcial
// Añadir endpoint POST /api/planillas_cliente/:id/cerrar_parcial
// Y filtros de placa/proyecto en GET planillas

// Agregar filtros placa y proyecto en GET planillas_prov
src = src.replace(
`app.get('/api/planillas_prov', (req, res) => {
  const db = readDB();
  let list = db.planillas_prov;
  // CAMBIO 8: filtros
  if (req.query.proveedor_id) list = list.filter(p => p.proveedor_id === req.query.proveedor_id);
  if (req.query.status)       list = list.filter(p => p.status === req.query.status);
  if (req.query.desde)        list = list.filter(p => p.semana_inicio >= req.query.desde);
  if (req.query.hasta)        list = list.filter(p => p.semana_fin   <= req.query.hasta);
  res.json(list.map(p => ({
    ...p,
    proveedor_nombre: (db.proveedores.find(x => x.id === p.proveedor_id) || {}).nombre || '—',
    documentos: db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db))
  })));
});`,
`app.get('/api/planillas_prov', (req, res) => {
  const db = readDB();
  let list = db.planillas_prov;
  if (req.query.proveedor_id) list = list.filter(p => p.proveedor_id === req.query.proveedor_id);
  if (req.query.status)       list = list.filter(p => p.status === req.query.status);
  if (req.query.desde)        list = list.filter(p => p.creada_en >= req.query.desde);
  if (req.query.hasta)        list = list.filter(p => p.creada_en <= req.query.hasta + 'T23:59:59');
  res.json(list.map(p => {
    let docs = db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db));
    // CAMBIO 4 + 8: filtros por placa y proyecto dentro de la planilla
    if (req.query.placa)      docs = docs.filter(r => r.maquina_placa === req.query.placa);
    if (req.query.proyecto_id)docs = docs.filter(r => r.proyecto_id === req.query.proyecto_id);
    if (req.query.finca)      docs = docs.filter(r => r.finca === req.query.finca);
    return { ...p,
      proveedor_nombre: (db.proveedores.find(x => x.id === p.proveedor_id) || {}).nombre || '—',
      documentos: docs
    };
  }));
});`
);

// Filtros en GET planillas_cliente
src = src.replace(
`app.get('/api/planillas_cliente', (req, res) => {
  const db = readDB();
  let list = db.planillas_cliente;
  // CAMBIO 8: filtros
  if (req.query.cliente_id) list = list.filter(p => p.cliente_id === req.query.cliente_id);
  if (req.query.status)     list = list.filter(p => p.status === req.query.status);
  if (req.query.desde)      list = list.filter(p => p.periodo_inicio >= req.query.desde);
  if (req.query.hasta)      list = list.filter(p => !p.periodo_fin || p.periodo_fin <= req.query.hasta);
  res.json(list.map(p => ({
    ...p,
    cliente_nombre: (db.clientes.find(x => x.id === p.cliente_id) || {}).nombre || '—',
    documentos: db.documentos.filter(r => p.documentos_ids.includes(r.id)).map(r => enrich(r, db))
  })));
});`,
`app.get('/api/planillas_cliente', (req, res) => {
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
    if (req.query.finca)       docs = docs.filter(r => r.finca === req.query.finca);
    return { ...p,
      cliente_nombre: (db.clientes.find(x => x.id === p.cliente_id) || {}).nombre || '—',
      documentos: docs
    };
  }));
});`
);

// CAMBIO 4: endpoint cerrar_parcial para planillas_prov
// Insertar antes del endpoint de cerrar planilla prov
src = src.replace(
`// CAMBIO 9: cerrar planilla cuando el usuario lo decida
app.patch('/api/planillas_prov/:id/cerrar', (req, res) => {`,
`// CAMBIO 4: cerrar planilla con selección de documentos específicos
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
app.patch('/api/planillas_prov/:id/cerrar', (req, res) => {`
);

// CAMBIO 5: al aprobar_c, agregar a planilla prov abierta del proveedor (sin separar por semana)
src = src.replace(
`  // Agregar a planilla proveedor si la máquina es de un proveedor
  if (mq.propietario && mq.propietario !== 'alquimaq') {
    const lunes = semanaLunes(r.fecha_trabajo);
    const dom   = new Date(lunes + 'T12:00:00'); dom.setDate(dom.getDate() + 6);
    let pp = db.planillas_prov.find(p => p.proveedor_id === mq.propietario && p.semana_inicio === lunes && p.status === 'abierta');
    if (!pp) {
      pp = { id: uuidv4(), proveedor_id: mq.propietario, semana_inicio: lunes,
        semana_fin: dom.toISOString().slice(0, 10), documentos_ids: [],
        total_horas: 0, total_monto: 0, num_documento: null, status: 'abierta',
        aprobacion_b: null, oc_id: null, recepcion_id: null, factura_id: null,
        cerrada_en: null, creada_en: new Date().toISOString() };
      db.planillas_prov.push(pp);
    }
    if (!pp.documentos_ids.includes(r.id)) {
      pp.documentos_ids.push(r.id);
      pp.total_horas = Math.round((pp.total_horas + r.total_horas_declaradas) * 10) / 10;
      pp.total_monto = Math.round((pp.total_monto + r.total_horas_declaradas * (mq.tarifa_a_b || 0)) * 100) / 100;
    }
  }`,
`  // CAMBIO 5: planilla prov abierta por proveedor (sin separación semanal)
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
  }`
);

// CAMBIO 4: endpoint cerrar_parcial para planillas_cliente
src = src.replace(
`// CAMBIO 9: C cierra planilla cuando quiere
app.patch('/api/planillas_cliente/:id/cerrar', (req, res) => {`,
`// CAMBIO 4: cerrar planilla cliente con docs seleccionados
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

app.patch('/api/planillas_cliente/:id/cerrar', (req, res) => {`
);

// Quitar semana_inicio/semana_fin del PDF de planillas_prov (ahora no tiene semana)
src = src.replace(
`    ['Semana:', \`\${p.semana_inicio} — \${p.semana_fin}\`],`,
`    ['Período:', \`Desde \${(p.creada_en||'').slice(0,10)} hasta \${p.cerrada_en ? p.cerrada_en.slice(0,10) : 'abierta'}\`],`
);

fs.writeFileSync('/home/claude/portalhoras/server.js', src);
console.log('PATCH APLICADO OK');
