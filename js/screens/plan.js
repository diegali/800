// ═══════════════════════════════════════════════
// PLAN Y AVANCE
// ═══════════════════════════════════════════════

function renderPlanScreen() {
  populateItemSelects();
  renderPlanTable();
  renderRemCards();
}

function renderPlanTable() {
  if (!state.items.length) {
    document.getElementById('plan-thead').innerHTML = '';
    document.getElementById('plan-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text2);padding:24px">Sin ítems cargados</td></tr>';
    return;
  }

  // Períodos: unión de plan y real, ordenados
  const periodos = [...new Set(state.plan.map(p => p.periodo))].sort();

  // Actualizar selects de remanente
  const itemSel = document.getElementById('plan-item-select');
  itemSel.innerHTML = state.items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');

  const perSel = document.getElementById('plan-periodo-select');
  perSel.innerHTML = periodos.map(p => `<option value="${p}">${periodoLabel(p)}</option>`).join('');

  // Sin períodos todavía
  const thead = document.getElementById('plan-thead');
  if (!periodos.length) {
    thead.innerHTML = '<tr><th>Ítem</th><th>Unidad</th><th>Cantidad</th><th style="color:var(--text2);font-weight:400;font-style:italic">Sin períodos cargados</th></tr>';
    document.getElementById('plan-tbody').innerHTML = '';
    return;
  }

  // Header
  thead.innerHTML = `<tr>
        <th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:140px;font-size:12px;padding:4px 6px">Ítem</th>
        <th style="min-width:45px;font-size:12px;padding:4px 6px">Un.</th>
        <th style="min-width:60px;font-size:12px;padding:4px 6px">Cant.</th>
        ${periodos.map(p => `<th style="min-width:64px;text-align:center;font-size:11px;padding:4px 3px;white-space:nowrap">${periodoLabel(p)}</th>`).join('')}
        <th style="min-width:52px;text-align:center;font-size:12px;padding:4px 3px">%</th>
    </tr>`;

  // Filas por ítem
  const tbody = document.getElementById('plan-tbody');
  tbody.innerHTML = state.items.map(item => {
    const ultimoPeriodo = periodos[periodos.length - 1];
    const cv = cantidadVigente(item.id, ultimoPeriodo);
    let totalPlan = 0;

    const celdas = periodos.map(p => {
      const planRow = state.plan.find(x => x.itemId === item.id && x.periodo === p);
      const cantPlan = planRow ? planRow.cantidad : null;
      if (cantPlan !== null) totalPlan += cantPlan;
      const contenido = cantPlan !== null ? `<div style="font-size:12px;font-weight:500">${cantPlan}</div>` : '';

      return `<td style="text-align:center;vertical-align:middle;padding:4px 3px">${contenido}</td>`;
    }).join('');

    const pct = cv > 0 ? totalPlan / cv : 0;
    const pctColor = pct > 1.001 ? 'var(--danger)' : pct >= 0.999 ? 'var(--ok)' : 'var(--warn)';

    return `<tr>
              <td style="position:sticky;left:0;background:var(--surface);z-index:1;font-size:12px;padding:4px 6px">${item.nombre}</td>
              <td style="text-align:center;font-size:11px;color:var(--text2);padding:4px 3px">${item.unidad}</td>
              <td style="text-align:center;font-size:11px;padding:4px 3px">${cv}</td>
              ${celdas}
             <td style="text-align:center;font-size:11px;font-weight:600;color:${pctColor};padding:4px 3px">${fmtPct(pct)}</td>
        </tr>`;
  }).join('');
}

function renderRemCards() {
  const itemId = parseInt(document.getElementById('plan-item-select').value);
  const periodo = document.getElementById('plan-periodo-select').value;
  const item = state.items.find(i => i.id === itemId);
  const remCards = document.getElementById('plan-remanente-cards');

  if (!item || !periodo) {
    remCards.innerHTML = '<div class="empty" style="padding:16px"><div class="empty-sub">Seleccioná ítem y período</div></div>';
    return;
  }

  const rem = remanente(itemId, periodo);
  const cv = cantidadVigente(itemId, periodo);
  const notaMap = {
    'economia': ['tag-no', 'Economía — cantidad vigente 0'],
    'penalizado': ['tag-warn', 'Penalizado — avance real supera al plan'],
    'real-menor': ['tag-ok', 'Se aplica real (menor al teórico)'],
    'teorico-menor': ['tag-ok', 'Se aplica teórico (menor al real)'],
    'ok': ['tag-ok', 'Normal']
  };
  const [tagClass, notaTxt] = notaMap[rem.nota] || ['tag-neutral', ''];

  remCards.innerHTML = `
        <div class="metric" style="flex:1;min-width:140px">
            <div class="metric-label">Cantidad vigente</div>
            <div class="metric-val" style="font-size:18px">${cv} ${item.unidad}</div>
        </div>
        <div class="metric" style="flex:1;min-width:140px">
            <div class="metric-label">Remanente teórico</div>
            <div class="metric-val" style="font-size:18px">${fmtPct(rem.teorico)}</div>
        </div>
        <div class="metric" style="flex:1;min-width:140px">
            <div class="metric-label">Remanente real</div>
            <div class="metric-val" style="font-size:18px;color:${rem.real < rem.teorico ? 'var(--ok)' : 'var(--warn)'}">${fmtPct(rem.real)}</div>
        </div>
        <div class="metric" style="flex:1;min-width:140px;background:${rem.aplicado === 0 && rem.nota !== 'ok' ? 'var(--warn-bg)' : 'var(--surface2)'}">
            <div class="metric-label">Remanente aplicado (MIN)</div>
            <div class="metric-val" style="font-size:18px;font-weight:600">${fmtPct(rem.aplicado)}</div>
            <div class="metric-sub"><span class="tag ${tagClass}" style="font-size:10px">${notaTxt}</span></div>
        </div>`;
}

function guardarPlan() {
  const itemId = parseInt(document.getElementById('plan-item-modal').value);
  const cantidad = parseFloat(document.getElementById('plan-cantidad-modal').value);
  if (!itemId || isNaN(cantidad)) return alert('Completá todos los campos');

  let periodo = document.getElementById('plan-periodo-modal').value.trim();

  if (!periodo) return alert('Completá todos los campos');

  // Si ingresaron "MES-N" y hay fechaReplanteo, convertir a YYYY-MM
  const matchMes = periodo.match(/^MES-(\d+)$/i);
  if (matchMes && state.obra.fechaReplanteo) {
    const idx = parseInt(matchMes[1]) - 1;
    const [anioBase, mesBase] = state.obra.fechaReplanteo.split("-").map(Number);
    const fecha = new Date(anioBase, mesBase - 1 + idx, 1);
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    periodo = `${yyyy}-${mm}`;
  }

  state.plan = state.plan.filter(p => !(p.itemId === itemId && p.periodo === periodo));
  state.plan.push({ itemId, periodo, cantidad });
  save();
  closeModal('modal-cargar-plan');
  renderPlanTable();
}

function remapearPeriodosPlan() {
  if (!window.state.obra.fechaReplanteo || !window.state.obra.duracionDias) return;

  const meses = Math.ceil(window.state.obra.duracionDias / 30);
  const base = window.state.obra.fechaReplanteo; // YYYY-MM

  // Construir mapa "MES-N" -> "YYYY-MM"
  const mapaFechas = {};
  for (let i = 0; i < meses; i++) {
    const label = "MES-" + (i + 1);
    const [anio, mes] = base.split("-").map(Number);
    const fecha = new Date(anio, mes - 1 + i, 1);
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    mapaFechas[label] = `${yyyy}-${mm}`;
  }

  // Remapear plan
  window.state.plan = window.state.plan.map(function (p) {
    if (mapaFechas[p.periodo]) {
      return Object.assign({}, p, { periodo: mapaFechas[p.periodo] });
    }
    return p;
  });

  // Remapear real
  window.state.real = window.state.real.map(function (r) {
    if (mapaFechas[r.periodo]) {
      return Object.assign({}, r, { periodo: mapaFechas[r.periodo] });
    }
    return r;
  });
}

function guardarReal() {
  const itemId = parseInt(document.getElementById('real-item-modal').value);
  const periodo = document.getElementById('real-periodo-modal').value;
  const cantidad = parseFloat(document.getElementById('real-cantidad-modal').value);
  if (!itemId || !periodo || isNaN(cantidad)) return alert('Completá todos los campos');
  state.real = state.real.filter(r => !(r.itemId === itemId && r.periodo === periodo));
  state.real.push({ itemId, periodo, cantidad });
  save();
  closeModal('modal-cargar-avance');
  renderPlanTable();
}

function descargarPlantilla() {
  const duracionDias = state.obra.duracionDias || 0;
  const totalMeses = Math.ceil(duracionDias / 30);

  if (!totalMeses || totalMeses < 1) {
    alert('La obra no tiene duración cargada. Editá la obra y completá la duración en días.');
    return;
  }
  if (!state.items.length) {
    alert('No hay ítems cargados en la obra.');
    return;
  }

  const fechaReplanteo = state.obra.fechaReplanteo || null;
  const columnasMeses = [];

  for (let i = 0; i < totalMeses; i++) {
    if (fechaReplanteo) {
      const [anio, mes] = fechaReplanteo.split('-').map(Number);
      const fecha = new Date(anio, mes - 1 + i, 1);
      const yyyy = fecha.getFullYear();
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      columnasMeses.push(`${yyyy}-${mm}`);
    } else {
      columnasMeses.push(`Mes ${i + 1}`);
    }
  }

  function colLetra(idx) {
    let s = '';
    let n = idx + 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  const colCantidad = 2;
  const colPrimerMes = 3;
  const colTotal = colPrimerMes + totalMeses;
  const colPct = colTotal + 1;
  const letraCantidad = colLetra(colCantidad);
  const letraTotal = colLetra(colTotal);

  const header = ['Ítem', 'Unidad', 'Cantidad', ...columnasMeses, 'Total plan', '% completado'];

  const filas = state.items.map((item, idx) => {
    const filaExcel = idx + 2;
    const primerCelda = `${colLetra(colPrimerMes)}${filaExcel}`;
    const ultimaCelda = `${colLetra(colTotal - 1)}${filaExcel}`;
    const celdaCantidad = `${letraCantidad}${filaExcel}`;
    const celdaTotal = `${letraTotal}${filaExcel}`;

    return [
      item.nombre,
      item.unidad,
      item.cantidad,
      ...columnasMeses.map(() => null),
      { f: `SUM(${primerCelda}:${ultimaCelda})` },
      { f: `IF(${celdaCantidad}>0,${celdaTotal}/${celdaCantidad},0)` }
    ];
  });

  const aoa = [header, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let r = 1; r <= state.items.length; r++) {
    const celda = `${colLetra(colPct)}${r + 1}`;
    if (ws[celda]) ws[celda].z = '0.0%';
  }

  ws['!cols'] = [
    { wch: 35 },
    { wch: 10 },
    { wch: 12 },
    ...columnasMeses.map(() => ({ wch: 13 })),
    { wch: 13 },
    { wch: 14 },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plan de Avance');
  XLSX.writeFile(wb, `plan_avance_${state.obra.nombre || 'obra'}.xlsx`);
}

function cargarPlanExcel(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    procesarPlanExcel(json);
  };
  reader.readAsArrayBuffer(file);
}
function procesarPlanExcel(data) {
  const headers = data[0];
  const filas = data.slice(1).filter(f => f[0]);

  const idxTotal = headers.indexOf('Total plan');
  const colFin = idxTotal > 0 ? idxTotal : headers.length;
  const columnasMeses = headers.slice(3, colFin);

  const fechaReplanteo = state.obra.fechaReplanteo || null;
  let nuevasPlan = [];
  let errores = [];

  filas.forEach(fila => {
    const nombreFila = String(fila[0] || '').trim();
    const item = state.items.find(i => i.nombre.trim() === nombreFila);
    if (!item) {
      errores.push(nombreFila);
      return;
    }

    columnasMeses.forEach((col, idx) => {
      const cantidad = parseFloat(fila[3 + idx]);
      if (isNaN(cantidad) || cantidad === 0) return;

      let periodo;
      if (/^\d{4}-\d{2}$/.test(String(col))) {
        periodo = String(col);
      } else if (fechaReplanteo) {
        const [anioBase, mesBase] = fechaReplanteo.split("-").map(Number);
        const fecha = new Date(anioBase, mesBase - 1 + idx, 1);
        const yyyy = fecha.getFullYear();
        const mm = String(fecha.getMonth() + 1).padStart(2, "0");
        periodo = `${yyyy}-${mm}`;
      } else {
        periodo = `MES-${idx + 1}`;
      }

      nuevasPlan.push({ itemId: item.id, periodo, cantidad });
    });
  });

  if (errores.length) {
    alert(`Atención: estos ítems no coinciden y fueron ignorados:\n${errores.join('\n')}`);
  }

  const itemsEnExcel = filas.map(f => state.items.find(i => i.nombre.trim() === String(f[0] || '').trim())).filter(Boolean);
  itemsEnExcel.forEach(item => { state.plan = state.plan.filter(p => p.itemId !== item.id); });

  nuevasPlan.forEach(np => {
    state.plan = state.plan.filter(p => !(p.itemId === np.itemId && p.periodo === np.periodo));
    state.plan.push(np);
  });

  document.getElementById('plan-file').value = '';

  save();
  renderPlanTable();
  alert(`Plan cargado: ${nuevasPlan.length} registros importados.`);
}

function cargarRealExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const workbook = XLSX.read(e.target.result, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    procesarRealExcel(data);
  };
  reader.readAsArrayBuffer(file);
}

function procesarRealExcel(data) {
  const headers = data[0];
  const filas = data.slice(1).filter(f => f[0]);

  const idxTotal = headers.indexOf('Total real');
  const colFin = idxTotal > 0 ? idxTotal : headers.length;
  const columnasMeses = headers.slice(3, colFin);

  const fechaReplanteo = state.obra.fechaReplanteo || null;
  let nuevasReal = [];
  let errores = [];

  filas.forEach(fila => {
    const nombreFila = String(fila[0] || '').trim();
    const item = state.items.find(i => i.nombre.trim() === nombreFila);
    if (!item) {
      errores.push(nombreFila);
      return;
    }

    columnasMeses.forEach((col, idx) => {
      const cantidad = parseFloat(fila[3 + idx]);
      if (isNaN(cantidad) || cantidad === 0) return;

      let periodo;
      if (/^\d{4}-\d{2}$/.test(String(col))) {
        periodo = String(col);
      } else if (fechaReplanteo) {
        const [anioBase, mesBase] = fechaReplanteo.split("-").map(Number);
        const fecha = new Date(anioBase, mesBase - 1 + idx, 1);
        const yyyy = fecha.getFullYear();
        const mm = String(fecha.getMonth() + 1).padStart(2, "0");
        periodo = `${yyyy}-${mm}`;
      } else {
        periodo = `MES-${idx + 1}`;
      }

      nuevasReal.push({ itemId: item.id, periodo, cantidad });
    });
  });

  if (errores.length) {
    alert(`Atención: estos ítems no coinciden y fueron ignorados:\n${errores.join('\n')}`);
  }

  const itemsEnExcel = filas.map(f => state.items.find(i => i.nombre.trim() === String(f[0] || '').trim())).filter(Boolean);
  itemsEnExcel.forEach(item => { state.real = state.real.filter(r => r.itemId !== item.id); });

  nuevasReal.forEach(nr => {
    state.real = state.real.filter(r => !(r.itemId === nr.itemId && r.periodo === nr.periodo));
    state.real.push(nr);
  });

  document.getElementById('real-file').value = '';

  save();
  renderPlanTable();
  alert(`Avance real cargado: ${nuevasReal.length} registros importados.`);
}

function descargarPlantillaReal() {
  const duracionDias = state.obra.duracionDias || 0;
  const totalMeses = Math.ceil(duracionDias / 30);

  if (!totalMeses || totalMeses < 1) {
    alert('La obra no tiene duración cargada. Editá la obra y completá la duración en días.');
    return;
  }
  if (!state.items.length) {
    alert('No hay ítems cargados en la obra.');
    return;
  }

  const fechaReplanteo = state.obra.fechaReplanteo || null;
  const columnasMeses = [];

  for (let i = 0; i < totalMeses; i++) {
    if (fechaReplanteo) {
      const [anio, mes] = fechaReplanteo.split('-').map(Number);
      const fecha = new Date(anio, mes - 1 + i, 1);
      const yyyy = fecha.getFullYear();
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      columnasMeses.push(`${yyyy}-${mm}`);
    } else {
      columnasMeses.push(`Mes ${i + 1}`);
    }
  }

  function colLetra(idx) {
    let s = '';
    let n = idx + 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  const colCantidad = 2;
  const colPrimerMes = 3;
  const colTotal = colPrimerMes + totalMeses;
  const colPct = colTotal + 1;
  const letraCantidad = colLetra(colCantidad);
  const letraTotal = colLetra(colTotal);

  const header = ['Ítem', 'Unidad', 'Cantidad', ...columnasMeses, 'Total real', '% ejecutado'];

  const filas = state.items.map((item, idx) => {
    const filaExcel = idx + 2;
    const primerCelda = `${colLetra(colPrimerMes)}${filaExcel}`;
    const ultimaCelda = `${colLetra(colTotal - 1)}${filaExcel}`;
    const celdaCantidad = `${letraCantidad}${filaExcel}`;
    const celdaTotal = `${letraTotal}${filaExcel}`;

    return [
      item.nombre,
      item.unidad,
      item.cantidad,
      ...columnasMeses.map(() => null),
      { f: `SUM(${primerCelda}:${ultimaCelda})` },
      { f: `IF(${celdaCantidad}>0,${celdaTotal}/${celdaCantidad},0)` }
    ];
  });

  const aoa = [header, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let r = 1; r <= state.items.length; r++) {
    const celda = `${colLetra(colPct)}${r + 1}`;
    if (ws[celda]) ws[celda].z = '0.0%';
  }

  ws['!cols'] = [
    { wch: 35 },
    { wch: 10 },
    { wch: 12 },
    ...columnasMeses.map(() => ({ wch: 13 })),
    { wch: 13 },
    { wch: 14 },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Avance Real');
  XLSX.writeFile(wb, `avance_real_${state.obra.nombre || 'obra'}.xlsx`);
}

function renderRealScreen() {
  renderRealTable();
}

function renderRealTable() {
  if (!state.items.length) {
    document.getElementById('real-thead').innerHTML = '';
    document.getElementById('real-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text2);padding:24px">Sin ítems cargados</td></tr>';
    return;
  }

  // Construir períodos desde la obra (igual que la plantilla)
  const duracionDias = state.obra.duracionDias || 0;
  const totalMeses = Math.ceil(duracionDias / 30);
  const fechaReplanteo = state.obra.fechaReplanteo || null;
  let periodosObra = [];

  if (totalMeses > 0 && fechaReplanteo) {
    for (let i = 0; i < totalMeses; i++) {
      const [anio, mes] = fechaReplanteo.split('-').map(Number);
      const fecha = new Date(anio, mes - 1 + i, 1);
      const yyyy = fecha.getFullYear();
      const mm = String(fecha.getMonth() + 1).padStart(2, '0');
      periodosObra.push(`${yyyy}-${mm}`);
    }
  } else if (totalMeses > 0) {
    for (let i = 0; i < totalMeses; i++) periodosObra.push(`MES-${i + 1}`);
  }

  // Unión con los que ya tienen datos (por si hay algo fuera del rango)
  const periodosReal = state.real.map(r => r.periodo);
  const periodos = [...new Set([...periodosObra, ...periodosReal])].sort();

  const thead = document.getElementById('real-thead');
  if (!periodos.length) {
    thead.innerHTML = '<tr><th>Ítem</th><th>Unidad</th><th>Cantidad</th><th style="color:var(--text2);font-weight:400;font-style:italic">Sin períodos cargados</th></tr>';
    document.getElementById('real-tbody').innerHTML = '';
    return;
  }

  thead.innerHTML = `<tr>
    <th style="position:sticky;left:0;background:var(--surface);z-index:2;min-width:140px;font-size:12px;padding:4px 6px">Ítem</th>
    <th style="min-width:45px;font-size:12px;padding:4px 6px">Un.</th>
    <th style="min-width:60px;font-size:12px;padding:4px 6px">Cant.</th>
    ${periodos.map(p => `<th style="min-width:64px;text-align:center;font-size:11px;padding:4px 3px;white-space:nowrap">${periodoLabel(p)}</th>`).join('')}
    <th style="min-width:52px;text-align:center;font-size:12px;padding:4px 3px">%</th>
  </tr>`;

  const tbody = document.getElementById('real-tbody');
  tbody.innerHTML = state.items.map(item => {
    const ultimoPeriodo = periodos[periodos.length - 1];
    const cv = cantidadVigente(item.id, ultimoPeriodo);
    let totalReal = 0;

    const celdas = periodos.map(p => {
      const realRow = state.real.find(x => x.itemId === item.id && x.periodo === p);
      const cant = realRow ? realRow.cantidad : null;
      if (cant !== null) totalReal += cant;
      const val = cant !== null ? parseFloat(cant.toFixed(4)) : '';
      return `<td style="text-align:center;vertical-align:middle;padding:2px 3px">
        <input type="number" step="any"
          value="${val}"
          data-item="${item.id}" data-periodo="${p}"
          onchange="guardarRealInline(this)"
          style="width:72px;text-align:center;font-size:11px;padding:2px 4px;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--ok)"
          onfocus="this.style.borderColor='var(--primary)';this.style.background='var(--surface2)'"
          onblur="this.style.borderColor='transparent';this.style.background='transparent'"
        />
      </td>`;
    }).join('');

    const pct = cv > 0 ? totalReal / cv : 0;
    const pctColor = pct > 1.001 ? 'var(--danger)' : pct >= 0.999 ? 'var(--ok)' : 'var(--warn)';

    return `<tr>
      <td style="position:sticky;left:0;background:var(--surface);z-index:1;font-size:12px;padding:4px 6px">${item.nombre}</td>
      <td style="text-align:center;font-size:11px;color:var(--text2);padding:4px 3px">${item.unidad}</td>
      <td style="text-align:center;font-size:11px;padding:4px 3px">${cv}</td>
      ${celdas}
      <td style="text-align:center;font-size:11px;font-weight:600;color:${pctColor};padding:4px 3px">${fmtPct(pct)}</td>
    </tr>`;
  }).join('');
}

function guardarRealInline(input) {
  const itemId = parseInt(input.dataset.item);
  const periodo = input.dataset.periodo;
  const cantidad = parseFloat(input.value);
  state.real = state.real.filter(r => !(r.itemId === itemId && r.periodo === periodo));
  if (!isNaN(cantidad) && input.value !== '') {
    state.real.push({ itemId, periodo, cantidad });
  }
  save();
  renderRealTable();
}