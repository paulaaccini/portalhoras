const fs = require('fs');
let src = fs.readFileSync('/home/claude/portalhoras/public/index.html', 'utf8');

// ── CAMBIO 1: historial proveedor filtra por sus máquinas ──────────────────
src = src.replace(
`async function renderHistorial(c) {`,
`async function renderHistorial(c) {
  // CAMBIO 1: proveedor solo ve docs de sus máquinas`
);

// En renderPendB y renderPendC, agregar filtro proveedor_id si aplica
src = src.replace(
`async function renderPendB(c) {
  let url = '/api/documentos?status=pendiente_b';`,
`async function renderPendB(c) {
  let url = '/api/documentos?status=pendiente_b';
  // CAMBIO 1: proveedor (admin_prov) no aprueba en B — esto es solo para Alquimaq`
);

// ── CAMBIO 2: supervisor_b ve catálogos (maquinas, clientes, proveedores) ──
src = src.replace(
`  if (U.rol==='supervisor_b') return [
    {label:'Trabajo',items:[{view:'pend-b',label:'Pendientes (mi aprobación)',icon:'⏳',badge:'pend-b'},{view:'historial',label:'Historial',icon:'📋'},{view:'plan-prov',label:'Planillas Proveedores',icon:'📆'}]}
  ];`,
`  if (U.rol==='supervisor_b') return [
    {label:'Trabajo',items:[{view:'pend-b',label:'Pendientes (mi aprobación)',icon:'⏳',badge:'pend-b'},{view:'pend-c',label:'Pendientes Cliente',icon:'🔄',badge:'pend-c'},{view:'historial',label:'Historial',icon:'📋'}]},
    {label:'Planillas',items:[{view:'plan-prov',label:'Planillas Proveedores',icon:'📆'},{view:'plan-cli',label:'Planillas Clientes',icon:'📊'}]},
    {label:'Catálogos',items:[{view:'maquinas',label:'Maquinaria',icon:'🚜'},{view:'clientes',label:'Clientes',icon:'🏢'},{view:'proveedores',label:'Proveedores',icon:'🔩'},{view:'nuevo-doc',label:'Nuevo Documento',icon:'➕'}]}
  ];`
);

// ── CAMBIO 3: admin_b puede ver pendientes C pero NO aprobar/rechazar ──────
src = src.replace(
`  const puedeAccionC = r.status==='pendiente_c'&&(U.rol==='supervisor_c'||U.rol==='jefe_c'||U.rol==='admin_b');`,
`  // CAMBIO 3: admin_b solo puede VER pendientes C, no actuar en ellos
  const puedeAccionC = r.status==='pendiente_c'&&(U.rol==='supervisor_c'||U.rol==='compras_c');`
);
src = src.replace(
`  const puedeC = r.status==='pendiente_c'&&(U.rol==='supervisor_c'||U.rol==='jefe_c'||U.rol==='admin_b');`,
`  const puedeC = r.status==='pendiente_c'&&(U.rol==='supervisor_c'||U.rol==='compras_c');`
);

// ── CAMBIO 4 + 5: Planillas proveedor — sin semana, con selección parcial ─

// Actualizar título de la card de planilla prov (quitar "Semana X - X")
src = src.replace(
`        <div class=\"plt-title\">Semana ${fD(p.semana_inicio)} — ${fD(p.semana_fin)}</div>`,
`        <div class=\"plt-title\">Planilla · ${p.proveedor_nombre}</div>`
);

// Reemplazar función planProvCard completa con versión con selección parcial
src = src.replace(
`function planProvCard(p) {
  const canCerrar = (U.rol==='supervisor_b'||U.rol==='admin_b') && p.status==='abierta';
  const canFact   = U.rol==='admin_prov' && p.status==='pendiente_factura';
  const canPagar  = (U.rol==='supervisor_b'||U.rol==='admin_b') && p.status==='facturada';
  return \`<div class="plt-card">
    <div class="plt-hdr">
      <div>
        <div class="plt-title">Semana \${fD(p.semana_inicio)} — \${fD(p.semana_fin)}</div>
        \${p.num_documento?\`<div class="plt-ndoc">📄 \${p.num_documento}</div>\`:''}
        <div class="plt-sub">Proveedor: <strong>\${p.proveedor_nombre}</strong></div>
      </div>
      \${badgePlt(p.status)}
    </div>
    <div class="plt-stats">
      <div class="plt-stat"><div class="lbl">Total horas</div><div class="val">\${p.total_horas} h</div></div>
      <div class="plt-stat"><div class="lbl">Monto</div><div class="val">$\${(p.total_monto||0).toFixed(2)}</div></div>
      <div class="plt-stat"><div class="lbl">Documentos</div><div class="val">\${p.documentos_ids.length}</div></div>
    </div>
    <div class="plt-regs">\${(p.documentos||[]).map(r=>\`
      <div class="plt-reg-row">
        <span>\${r.num_documento} · \${r.maquina_placa} · \${r.fecha_trabajo}</span>
        <span><strong>\${r.total_horas_declaradas}h</strong> × $\${r.tarifa_a_b||0} = $\${((r.total_horas_declaradas||0)*(r.tarifa_a_b||0)).toFixed(2)}</span>
      </div>\`).join('') || '<div style="color:var(--muted);font-size:12px;padding:4px 0">Sin documentos aún</div>'}</div>
    <div class="plt-actions">
      \${canCerrar?\`<button class="btn btn-primary btn-sm" onclick="accionPlanProv('\${p.id}','cerrar')">🔒 Cerrar planilla y generar documentos</button>\`:''}
      \${canFact  ?\`<button class="btn btn-success btn-sm" onclick="accionPlanProv('\${p.id}','facturar')">📄 Registrar factura</button>\`:''}
      \${canPagar ?\`<button class="btn btn-amber btn-sm"   onclick="accionPlanProv('\${p.id}','pagar')">💰 Confirmar pago</button>\`:''}
      \${p.num_documento?\`<a href="/api/planillas_prov/\${p.id}/pdf" target="_blank" class="btn btn-sm">⬇ PDF</a>\`:''}
    </div>
  </div>\`;
}`,
`function planProvCard(p) {
  const canCerrar   = (U.rol==='supervisor_b'||U.rol==='admin_b') && p.status==='abierta';
  const canFact     = U.rol==='admin_prov' && p.status==='pendiente_factura';
  const canPagar    = (U.rol==='supervisor_b'||U.rol==='admin_b') && p.status==='facturada';
  const docsHTML = (p.documentos||[]).map(r=>\`
    <div class="plt-reg-row" style="align-items:center">
      \${canCerrar?\`<input type="checkbox" class="pp-chk-\${p.id}" value="\${r.id}" style="margin-right:6px">\`:''}
      <span style="flex:1">\${r.num_documento} · \${r.maquina_placa} · \${r.fecha_trabajo} · \${r.finca||r.obra||'—'}</span>
      <span><strong>\${r.total_horas_declaradas}h</strong> × $\${r.tarifa_a_b||0} = $\${((r.total_horas_declaradas||0)*(r.tarifa_a_b||0)).toFixed(2)}</span>
    </div>\`).join('') || '<div style="color:var(--muted);font-size:12px;padding:4px 0">Sin documentos aún</div>';
  return \`<div class="plt-card">
    <div class="plt-hdr">
      <div>
        <div class="plt-title">Planilla · \${p.proveedor_nombre}</div>
        \${p.num_documento?\`<div class="plt-ndoc">📄 \${p.num_documento}</div>\`:''}
        <div class="plt-sub">Desde \${fD(p.creada_en)}\${p.cerrada_en?' — '+fD(p.cerrada_en):' — <em>abierta</em>'}</div>
      </div>
      \${badgePlt(p.status)}
    </div>
    <div class="plt-stats">
      <div class="plt-stat"><div class="lbl">Total horas</div><div class="val">\${p.total_horas} h</div></div>
      <div class="plt-stat"><div class="lbl">Monto</div><div class="val">$\${(p.total_monto||0).toFixed(2)}</div></div>
      <div class="plt-stat"><div class="lbl">Documentos</div><div class="val">\${p.documentos_ids.length}</div></div>
    </div>
    \${canCerrar?\`<div style="font-size:11px;color:var(--muted);margin:6px 0 2px">Selecciona los documentos a cerrar (o todos):</div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button class="btn btn-xs" onclick="selAll('.pp-chk-\${p.id}',true)">✓ Todos</button>
      <button class="btn btn-xs" onclick="selAll('.pp-chk-\${p.id}',false)">✗ Ninguno</button>
    </div>\`:''}
    <div class="plt-regs">\${docsHTML}</div>
    <div class="plt-actions">
      \${canCerrar?\`<button class="btn btn-primary btn-sm" onclick="cerrarParcialProv('\${p.id}')">🔒 Cerrar seleccionados</button>\`:''}
      \${canFact  ?\`<button class="btn btn-success btn-sm" onclick="accionPlanProv('\${p.id}','facturar')">📄 Registrar factura</button>\`:''}
      \${canPagar ?\`<button class="btn btn-amber btn-sm"   onclick="accionPlanProv('\${p.id}','pagar')">💰 Confirmar pago</button>\`:''}
      \${p.num_documento?\`<a href="/api/planillas_prov/\${p.id}/pdf" target="_blank" class="btn btn-sm">⬇ PDF</a>\`:''}
    </div>
  </div>\`;
}`
);

// Agregar función cerrarParcialProv después de accionPlanProv
src = src.replace(
`async function accionPlanProv(id, action) {
  const body = {usuario_id:U.id};
  if (action==='facturar') { const n=prompt('Número de factura del proveedor:'); if(!n) return; body.numero=n; }
  const res = await api(\`/api/planillas_prov/\${id}/\${action}\`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (res.error) { toast(res.error,'err'); return; }
  toast('Acción realizada correctamente'); loadPlanProv(); updateBadges();
}`,
`async function accionPlanProv(id, action) {
  const body = {usuario_id:U.id};
  if (action==='facturar') { const n=prompt('Número de factura del proveedor:'); if(!n) return; body.numero=n; }
  const res = await api(\`/api/planillas_prov/\${id}/\${action}\`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (res.error) { toast(res.error,'err'); return; }
  toast('Acción realizada correctamente'); loadPlanProv(); updateBadges();
}

// CAMBIO 4: cerrar documentos seleccionados de planilla proveedor
async function cerrarParcialProv(id) {
  const chks = [...document.querySelectorAll(\`.pp-chk-\${id}:checked\`)].map(c=>c.value);
  if (!chks.length) { toast('Selecciona al menos un documento','err'); return; }
  const res = await api(\`/api/planillas_prov/\${id}/cerrar_parcial\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario_id:U.id,documentos_ids:chks})});
  if (res.error) { toast(res.error,'err'); return; }
  toast(\`Planilla \${res.num_documento} generada con \${chks.length} documentos\`); loadPlanProv(); updateBadges();
}

function selAll(cls, val) { document.querySelectorAll(cls).forEach(c=>c.checked=val); }`
);

// Reemplazar planCliCard con versión con selección parcial
src = src.replace(
`function planCliCard(p) {
  const canCerrar = (U.rol==='compras_c'||U.rol==='jefe_c'||U.rol==='admin_b') && p.status==='abierta';
  const canRecep  = (U.rol==='compras_c'||U.rol==='admin_b') && p.status==='pendiente_recepcion';
  const canFact   = (U.rol==='supervisor_b'||U.rol==='admin_b') && p.status==='pendiente_factura';
  const canPagar  = (U.rol==='compras_c') && p.status==='facturada';
  return \`<div class="plt-card">
    <div class="plt-hdr">
      <div>
        <div class="plt-title">Planilla · \${p.cliente_nombre}</div>
        \${p.num_documento?\`<div class="plt-ndoc">📄 \${p.num_documento}</div>\`:''}
        <div class="plt-sub">Desde \${fD(p.periodo_inicio)}\${p.periodo_fin?' hasta '+fD(p.periodo_fin):' — <em>abierta, acumulando horas</em>'}</div>
      </div>
      \${badgePlt(p.status)}
    </div>
    <div class="plt-stats">
      <div class="plt-stat"><div class="lbl">Horas aprobadas</div><div class="val">\${p.total_horas} h</div></div>
      <div class="plt-stat"><div class="lbl">Monto total</div><div class="val">$\${(p.total_monto||0).toFixed(2)}</div></div>
      <div class="plt-stat"><div class="lbl">Documentos</div><div class="val">\${p.documentos_ids.length}</div></div>
    </div>
    <div class="plt-regs">\${(p.documentos||[]).map(r=>\`
      <div class="plt-reg-row">
        <span>\${r.num_documento} · \${r.maquina_placa} · \${r.fecha_trabajo} · \${r.finca||r.obra||'—'}</span>
        <span><strong>\${r.total_horas_declaradas}h</strong> × $\${r.tarifa_a_c||0} = $\${((r.total_horas_declaradas||0)*(r.tarifa_a_c||0)).toFixed(2)}</span>
      </div>\`).join('') || '<div style="color:var(--muted);font-size:12px;padding:4px 0">Sin documentos aún</div>'}</div>
    <div class="plt-actions">
      \${canCerrar?\`<button class="btn btn-primary btn-sm" onclick="accionPlanCli('\${p.id}','cerrar')">🔒 Cerrar planilla</button>\`:''}
      \${canRecep ?\`<button class="btn btn-success btn-sm" onclick="accionPlanCli('\${p.id}','recepcion')">📥 Emitir recepción del servicio</button>\`:''}
      \${canFact  ?\`<button class="btn btn-primary btn-sm" onclick="accionPlanCli('\${p.id}','facturar')">📄 Registrar factura</button>\`:''}
      \${canPagar ?\`<button class="btn btn-amber btn-sm"   onclick="accionPlanCli('\${p.id}','pagar')">💰 Confirmar pago</button>\`:''}
      \${p.num_documento?\`<a href="/api/planillas_cliente/\${p.id}/pdf" target="_blank" class="btn btn-sm">⬇ PDF</a>\`:''}
    </div>
  </div>\`;
}`,
`function planCliCard(p) {
  const canCerrar = (U.rol==='compras_c'||U.rol==='jefe_c'||U.rol==='admin_b') && p.status==='abierta';
  const canRecep  = (U.rol==='compras_c'||U.rol==='admin_b') && p.status==='pendiente_recepcion';
  const canFact   = (U.rol==='supervisor_b'||U.rol==='admin_b') && p.status==='pendiente_factura';
  const canPagar  = (U.rol==='compras_c') && p.status==='facturada';
  const docsHTML = (p.documentos||[]).map(r=>\`
    <div class="plt-reg-row" style="align-items:center">
      \${canCerrar?\`<input type="checkbox" class="pc-chk-\${p.id}" value="\${r.id}" style="margin-right:6px">\`:''}
      <span style="flex:1">\${r.num_documento} · \${r.maquina_placa} · \${r.fecha_trabajo} · \${r.finca||r.obra||'—'}</span>
      <span><strong>\${r.total_horas_declaradas}h</strong> × $\${r.tarifa_a_c||0} = $\${((r.total_horas_declaradas||0)*(r.tarifa_a_c||0)).toFixed(2)}</span>
    </div>\`).join('') || '<div style="color:var(--muted);font-size:12px;padding:4px 0">Sin documentos aún</div>';
  return \`<div class="plt-card">
    <div class="plt-hdr">
      <div>
        <div class="plt-title">Planilla · \${p.cliente_nombre}</div>
        \${p.num_documento?\`<div class="plt-ndoc">📄 \${p.num_documento}</div>\`:''}
        <div class="plt-sub">Desde \${fD(p.periodo_inicio)}\${p.periodo_fin?' hasta '+fD(p.periodo_fin):' — <em>abierta, acumulando horas</em>'}</div>
      </div>
      \${badgePlt(p.status)}
    </div>
    <div class="plt-stats">
      <div class="plt-stat"><div class="lbl">Horas aprobadas</div><div class="val">\${p.total_horas} h</div></div>
      <div class="plt-stat"><div class="lbl">Monto total</div><div class="val">$\${(p.total_monto||0).toFixed(2)}</div></div>
      <div class="plt-stat"><div class="lbl">Documentos</div><div class="val">\${p.documentos_ids.length}</div></div>
    </div>
    \${canCerrar?\`<div style="font-size:11px;color:var(--muted);margin:6px 0 2px">Selecciona los documentos a incluir en esta planilla:</div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button class="btn btn-xs" onclick="selAll('.pc-chk-\${p.id}',true)">✓ Todos</button>
      <button class="btn btn-xs" onclick="selAll('.pc-chk-\${p.id}',false)">✗ Ninguno</button>
    </div>\`:''}
    <div class="plt-regs">\${docsHTML}</div>
    <div class="plt-actions">
      \${canCerrar?\`<button class="btn btn-primary btn-sm" onclick="cerrarParcialCli('\${p.id}')">🔒 Cerrar seleccionados</button>\`:''}
      \${canRecep ?\`<button class="btn btn-success btn-sm" onclick="accionPlanCli('\${p.id}','recepcion')">📥 Emitir recepción del servicio</button>\`:''}
      \${canFact  ?\`<button class="btn btn-primary btn-sm" onclick="accionPlanCli('\${p.id}','facturar')">📄 Registrar factura</button>\`:''}
      \${canPagar ?\`<button class="btn btn-amber btn-sm"   onclick="accionPlanCli('\${p.id}','pagar')">💰 Confirmar pago</button>\`:''}
      \${p.num_documento?\`<a href="/api/planillas_cliente/\${p.id}/pdf" target="_blank" class="btn btn-sm">⬇ PDF</a>\`:''}
    </div>
  </div>\`;
}`
);

// Agregar función cerrarParcialCli después de accionPlanCli
src = src.replace(
`async function accionPlanCli(id, action) {
  const body = {usuario_id:U.id};
  if (action==='facturar') { const n=prompt('Número de factura Alquimaq → Cliente:'); if(!n) return; body.numero=n; }
  const res = await api(\`/api/planillas_cliente/\${id}/\${action}\`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (res.error) { toast(res.error,'err'); return; }
  toast('Acción realizada'); loadPlanCli(); updateBadges();
}`,
`async function accionPlanCli(id, action) {
  const body = {usuario_id:U.id};
  if (action==='facturar') { const n=prompt('Número de factura Alquimaq → Cliente:'); if(!n) return; body.numero=n; }
  const res = await api(\`/api/planillas_cliente/\${id}/\${action}\`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (res.error) { toast(res.error,'err'); return; }
  toast('Acción realizada'); loadPlanCli(); updateBadges();
}

// CAMBIO 4: cerrar documentos seleccionados de planilla cliente
async function cerrarParcialCli(id) {
  const chks = [...document.querySelectorAll(\`.pc-chk-\${id}:checked\`)].map(c=>c.value);
  if (!chks.length) { toast('Selecciona al menos un documento','err'); return; }
  const res = await api(\`/api/planillas_cliente/\${id}/cerrar_parcial\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario_id:U.id,documentos_ids:chks})});
  if (res.error) { toast(res.error,'err'); return; }
  toast(\`Planilla \${res.num_documento} generada con \${chks.length} documentos\`); loadPlanCli(); updateBadges();
}`
);

// También actualizar renderHistorial para que el proveedor filtre por sus máquinas
src = src.replace(
`async function renderHistorial(c) {
  // CAMBIO 1: proveedor solo ve docs de sus máquinas`,
`async function renderHistorial(c) {`
);
// Encontrar la función renderHistorial y agregar filtro proveedor_id en la URL
src = src.replace(
`async function renderHistorial(c) {
  let url='/api/documentos?';
  if (U.cliente_id) url+=\`cliente_id=\${U.cliente_id}&\`;`,
`async function renderHistorial(c) {
  let url='/api/documentos?';
  if (U.cliente_id)   url+=\`cliente_id=\${U.cliente_id}&\`;
  // CAMBIO 1: admin_prov solo ve documentos de sus máquinas
  if (U.proveedor_id) url+=\`proveedor_id=\${U.proveedor_id}&\`;`
);

// También en renderPendC agregar filtro cliente_id
src = src.replace(
`async function renderPendC(c) {
  let url = '/api/documentos?status=pendiente_c';
  if (U.cliente_id) url += \`&cliente_id=\${U.cliente_id}\`;`,
`async function renderPendC(c) {
  let url = '/api/documentos?status=pendiente_c';
  if (U.cliente_id)   url += \`&cliente_id=\${U.cliente_id}\`;
  // CAMBIO 3: admin_b puede ver pendientes C de todos los clientes`
);

fs.writeFileSync('/home/claude/portalhoras/public/index.html', src);
console.log('FRONTEND PATCH OK');
