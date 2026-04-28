// ═══════════════════════════════════════════════
// PLAN Y AVANCE
// ═══════════════════════════════════════════════

function renderPlanScreen() {
  populateItemSelects();
  renderPlanTable();
  renderPlanesHistoricos();
}

function renderPlanTable() {
  if (!state.items.length) {
    document.getElementById('plan-thead').innerHTML = '';
    document.getElementById('plan-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text2);padding:24px">Sin ítems cargados</td></tr>';
    return;
  }

  // Períodos: unión de plan base + planMod
  const periodos = [...new Set([
    ...state.plan.map(p => p.periodo),
    ...(state.planMod || []).map(p => p.periodo)
  ])].sort();

  const thead = document.getElementById('plan-thead');
  if (!periodos.length) {
    thead.innerHTML = '<tr><th>Ítem</th><th>Un.</th><th>Cant.</th><th style="color:var(--text2);font-weight:400;font-style:italic">Sin períodos cargados</th></tr>';
    document.getElementById('plan-tbody').innerHTML = '';
    return;
  }

  thead.innerHTML = `<tr>
        <th>Ítem</th>
        <th>Un.</th>
        <th>Cant.</th>
        ${periodos.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
        <th>%</th>
    </tr>`;

  // Armar filas: ítem base + sus demasías inmediatamente después
  const filas = [];

  state.items.forEach(item => {
    // Fila ítem base
    let totalPlan = 0;
    const celdas = periodos.map(p => {
      const planRow = state.plan.find(x => x.itemId === item.id && x.periodo === p);
      const cantPlan = planRow ? planRow.cantidad : null;
      if (cantPlan !== null) totalPlan += cantPlan;
      const contenido = cantPlan !== null ? `<span style="color:var(--ok);font-size:11px">${parseFloat(cantPlan.toFixed(4))}</span>` : '';
      return `<td>${contenido}</td>`;
    }).join('');
    const pct = item.cantidad > 0 ? totalPlan / item.cantidad : 0;
    const pctColor = pct > 1.001 ? 'var(--danger)' : pct >= 0.999 ? 'var(--ok)' : 'var(--warn)';
    filas.push(`<tr>
            <td><span style="color:var(--text2);font-size:11px;margin-right:6px">${item.nro || ''}</span>${item.nombre}</td>
            <td>${item.unidad}</td>
            <td>${item.cantidad}</td>
            ${celdas}
            <td style="color:${pctColor}">${fmtPct(pct)}</td>
        </tr>`);

    // Filas demasías/nuevos de este ítem base
    (state.modificaciones || []).forEach(mod => {
      (mod.items || [])
        .filter(i => i.cantidad > 0 && i.itemIdBase === item.id)
        .forEach(itemMod => {
          let totalPlanMod = 0;
          const celdasMod = periodos.map(p => {
            const planRow = (state.planMod || []).find(x => x.modId === mod.id && x.itemId === itemMod.id && x.periodo === p);
            const cantPlan = planRow ? planRow.cantidad : null;
            if (cantPlan !== null) totalPlanMod += cantPlan;
            const contenido = cantPlan !== null ? `<span style="color:var(--ok);font-size:11px">${parseFloat(cantPlan.toFixed(4))}</span>` : '';
            return `<td>${contenido}</td>`;
          }).join('');
          const pctMod = itemMod.cantidad > 0 ? totalPlanMod / itemMod.cantidad : 0;
          const pctColorMod = pctMod > 1.001 ? 'var(--danger)' : pctMod >= 0.999 ? 'var(--ok)' : 'var(--warn)';
          filas.push(`<tr style="background:var(--surface2)">
                        <td><span style="color:var(--text2);font-size:11px;margin-right:6px">${itemMod.nro || ''}</span>${itemMod.nombre}</td>
                        <td>${itemMod.unidad}</td>
                        <td>${itemMod.cantidad}</td>
                        ${celdasMod}
                        <td style="color:${pctColorMod}">${fmtPct(pctMod)}</td>
                    </tr>`);
        });
    });
  });

  // Ítems nuevos (sin base) al final
  (state.modificaciones || []).forEach(mod => {
    (mod.items || [])
      .filter(i => i.cantidad > 0 && i.itemIdBase === null)
      .forEach(itemMod => {
        let totalPlanMod = 0;
        const celdasMod = periodos.map(p => {
          const planRow = (state.planMod || []).find(x => x.modId === mod.id && x.itemId === itemMod.id && x.periodo === p);
          const cantPlan = planRow ? planRow.cantidad : null;
          if (cantPlan !== null) totalPlanMod += cantPlan;
          const contenido = cantPlan !== null ? `<span style="color:var(--ok);font-size:11px">${parseFloat(cantPlan.toFixed(4))}</span>` : '';
          return `<td>${contenido}</td>`;
        }).join('');
        const pctMod = itemMod.cantidad > 0 ? totalPlanMod / itemMod.cantidad : 0;
        const pctColorMod = pctMod > 1.001 ? 'var(--danger)' : pctMod >= 0.999 ? 'var(--ok)' : 'var(--warn)';
        filas.push(`<tr style="background:var(--surface2)">
                    <td><span style="color:var(--text2);font-size:11px;margin-right:6px">${itemMod.nro || ''}</span>${itemMod.nombre}</td>
                    <td>${itemMod.unidad}</td>
                    <td>${itemMod.cantidad}</td>
                    ${celdasMod}
                    <td style="color:${pctColorMod}">${fmtPct(pctMod)}</td>
                </tr>`);
      });
  });

  document.getElementById('plan-tbody').innerHTML = filas.join('');
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
      columnasMeses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
    } else {
      columnasMeses.push(`Mes ${i + 1}`);
    }
  }

  function colLetra(idx) {
    let s = '', n = idx + 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  const colCantidad = 2, colPrimerMes = 3;
  const colTotal = colPrimerMes + totalMeses;
  const colPct = colTotal + 1;
  const letraCantidad = colLetra(colCantidad);
  const letraTotal = colLetra(colTotal);

  // Armar lista de ítems: base + demasías/nuevos de modificaciones
  // Aplanar todos los ítems de modificaciones con referencia a mod
  const itemsModConRef = (state.modificaciones || []).flatMap(mod =>
    (mod.items || [])
      .filter(i => i.cantidad > 0)
      .map(i => ({ ...i, _modId: mod.id }))
  );

  const todosItems = [];
  state.items.forEach(item => {
    todosItems.push({
      nro: item.nro, nombre: item.nombre,
      unidad: item.unidad, cantidad: item.cantidad, esMod: false
    });
    // Demasías de este ítem base
    itemsModConRef
      .filter(i => i.itemIdBase === item.id)
      .forEach(i => todosItems.push({
        nro: i.nro, nombre: i.nombre,
        unidad: i.unidad, cantidad: i.cantidad, esMod: true
      }));
  });
  // Ítems nuevos al final
  itemsModConRef
    .filter(i => i.itemIdBase === null)
    .forEach(i => todosItems.push({
      nro: i.nro, nombre: i.nombre,
      unidad: i.unidad, cantidad: i.cantidad, esMod: true
    }));
  const header = ['Nº', 'Ítem', 'Unidad', 'Cantidad', ...columnasMeses, 'Total plan', '% completado'];

  const filas = todosItems.map((item, idx) => {
    const filaExcel = idx + 2;
    const colPrimerMesAjustado = 4; // ahora hay columna Nº extra
    const colTotalAjustado = colPrimerMesAjustado + totalMeses;
    const colPctAjustado = colTotalAjustado + 1;
    const primerCelda = `${colLetra(colPrimerMesAjustado)}${filaExcel}`;
    const ultimaCelda = `${colLetra(colTotalAjustado - 1)}${filaExcel}`;
    const celdaCantidad = `${colLetra(3)}${filaExcel}`;
    const celdaTotal = `${colLetra(colTotalAjustado)}${filaExcel}`;
    return [
      item.nro ?? '',
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

  for (let r = 1; r <= todosItems.length; r++) {
    const celda = `${colLetra(colPct + 1)}${r + 1}`;
    if (ws[celda]) ws[celda].z = '0.0%';
  }

  ws['!cols'] = [
    { wch: 8 },
    { wch: 35 },
    { wch: 10 },
    { wch: 12 },
    ...columnasMeses.map(() => ({ wch: 13 })),
    { wch: 13 },
    { wch: 14 }
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

let _planExcelPendiente = null;

function procesarPlanExcel(data) {
  const headers = data[0];
  const filas = data.slice(1).filter(f => f[0] !== null && f[0] !== undefined && f[0] !== '');

  // Detectar si tiene columna Nº (nueva plantilla) o no (plantilla vieja)
  const tieneNro = headers[0] === 'Nº';
  const colNro = tieneNro ? 0 : -1;
  const colNombre = tieneNro ? 1 : 0;
  const colUnidad = tieneNro ? 2 : 1;
  const colCantidad = tieneNro ? 3 : 2;
  const colPrimerMes = tieneNro ? 4 : 3;

  const idxTotal = headers.indexOf('Total plan');
  const colFin = idxTotal > 0 ? idxTotal : headers.length;
  const columnasMeses = headers.slice(colPrimerMes, colFin);
  const fechaReplanteo = state.obra.fechaReplanteo || null;

  let nuevasPlan = [];     // { itemId, periodo, cantidad } — ítems base
  let nuevasPlanMod = [];  // { modId, itemId, periodo, cantidad } — ítems mod
  let errores = [];

  // Construir mapa nro → ítem base
  const mapaBase = {};
  state.items.forEach(item => {
    if (item.nro !== undefined && item.nro !== null) {
      mapaBase[String(item.nro)] = item;
    }
    mapaBase[item.nombre.trim()] = item; // fallback por nombre
  });

  // Construir mapa nro → itemMod (demasías y nuevos)
  const mapaMod = {};
  (state.modificaciones || []).forEach(mod => {
    (mod.items || []).filter(i => i.cantidad > 0).forEach(itemMod => {
      if (itemMod.nro !== undefined && itemMod.nro !== null) {
        mapaMod[String(itemMod.nro)] = { mod, itemMod };
      }
      mapaMod[itemMod.nombre.trim()] = { mod, itemMod }; // fallback por nombre
    });
  });

  filas.forEach(fila => {
    const nroFila = tieneNro ? String(fila[colNro] ?? '').trim() : null;
    const nombreFila = String(fila[colNombre] || '').trim();

    // Resolver a qué ítem corresponde
    let itemBase = null;
    let itemModData = null;

    if (nroFila) {
      // Con nro: buscar primero en mod, luego en base
      if (mapaMod[nroFila]) {
        itemModData = mapaMod[nroFila];
      } else if (mapaBase[nroFila]) {
        itemBase = mapaBase[nroFila];
      } else {
        errores.push(`${nroFila} - ${nombreFila}`);
        return;
      }
    } else {
      // Sin nro (plantilla vieja): buscar solo en base por nombre
      if (mapaBase[nombreFila]) {
        itemBase = mapaBase[nombreFila];
      } else {
        errores.push(nombreFila);
        return;
      }
    }

    columnasMeses.forEach((col, idx) => {
      const cantidad = parseFloat(fila[colPrimerMes + idx]);
      if (isNaN(cantidad) || cantidad === 0) return;
      let periodo;
      if (/^\d{4}-\d{2}$/.test(String(col))) {
        periodo = String(col);
      } else if (fechaReplanteo) {
        const [anioBase, mesBase] = fechaReplanteo.split("-").map(Number);
        const fecha = new Date(anioBase, mesBase - 1 + idx, 1);
        periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      } else {
        periodo = `MES-${idx + 1}`;
      }

      if (itemBase) {
        nuevasPlan.push({ itemId: itemBase.id, periodo, cantidad });
      } else if (itemModData) {
        nuevasPlanMod.push({
          modId: itemModData.mod.id,
          itemId: itemModData.itemMod.id,
          periodo,
          cantidad
        });
      }
    });
  });

  if (errores.length) {
    alert(`Atención: estos ítems no coinciden y fueron ignorados:\n${errores.join('\n')}`);
  }
  if (!nuevasPlan.length && !nuevasPlanMod.length) {
    document.getElementById('plan-file').value = '';
    return;
  }

  _planExcelPendiente = { nuevasPlan, nuevasPlanMod };

  // Detectar última adecuación
  const adecsProceden = state.adecuaciones
    .filter(a => a.procede)
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
  const ultimaAdec = adecsProceden[0];

  const avisoEl = document.getElementById('plan-aviso-adec');
  const avisoPeriodoEl = document.getElementById('plan-aviso-periodo');
  if (ultimaAdec) {
    avisoEl.style.display = 'block';
    avisoPeriodoEl.textContent = periodoLabel(ultimaAdec.periodoCalculo || ultimaAdec.periodo);
  } else {
    avisoEl.style.display = 'none';
  }

  const nroPlanes = (state.planesHistoricos || []).length;
  document.getElementById('plan-nombre-input').value = nroPlanes === 0
    ? 'Plan original'
    : `Plan N°${nroPlanes + 1}`;

  document.getElementById('plan-file').value = '';
  openModal('modal-nombre-plan');
}

function confirmarNuevoPlan() {
  const nombre = document.getElementById('plan-nombre-input').value.trim();
  if (!nombre) return alert('El nombre del plan es obligatorio.');
  if (!_planExcelPendiente) return;

  const { nuevasPlan, nuevasPlanMod } = _planExcelPendiente;
  _planExcelPendiente = null;

  // Guardar plan actual como histórico
  if (!state.planesHistoricos) state.planesHistoricos = [];
  state.planesHistoricos.push({
    id: Date.now(),
    nombre,
    fecha: new Date().toISOString().slice(0, 10),
    plan: JSON.parse(JSON.stringify(state.plan)),
    planMod: JSON.parse(JSON.stringify(state.planMod || []))
  });

  // Período de corte
  const adecsProceden = state.adecuaciones
    .filter(a => a.procede)
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
  const ultimaAdec = adecsProceden[0];
  const periodoCorte = ultimaAdec ? (ultimaAdec.periodoCalculo || ultimaAdec.periodo) : null;

  // ── Plan base ──
  let nuevoPlan = nuevasPlan;
  if (periodoCorte) {
    // Hasta corte: del real
    const periodosHastaCorte = [...new Set(
      state.real.filter(r => r.periodo <= periodoCorte).map(r => r.periodo)
    )];
    state.items.forEach(item => {
      periodosHastaCorte.forEach(p => {
        const cantReal = state.real
          .filter(r => r.itemId === item.id && r.periodo === p)
          .reduce((s, r) => s + r.cantidad, 0);
        if (cantReal > 0) nuevoPlan.push({ itemId: item.id, periodo: p, cantidad: cantReal });
      });
    });
    // Después del corte: del Excel
    nuevasPlan.filter(p => p.periodo > periodoCorte).forEach(p => nuevoPlan.push(p));
  } else {
    nuevoPlan = nuevasPlan;
  }

  // ── Plan mod ──
  let nuevoPlanMod = nuevasPlanMod;

  state.plan = nuevoPlan;
  state.planMod = nuevoPlanMod;

  closeModal('modal-nombre-plan');
  save();
  renderPlanTable();
  alert(`✓ Plan "${nombre}" cargado — ${nuevoPlan.length} registros base, ${nuevoPlanMod.length} registros modificación.`);
}

function borrarPlan() {
  if (!confirm('¿Seguro que querés borrar todo el plan de avance? Esta acción no se puede deshacer.')) return;
  state.plan = [];
  save();
  renderPlanTable();
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
  renderRealTable();
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
  renderGraficoAvance();
}

function renderGraficoAvance() {
  const canvas = document.getElementById('grafico-avance');
  if (!canvas) return;
  if (!state.items.length || !state.real.length) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  // Períodos con avance real
  const periodosConReal = [...new Set(state.real.map(r => r.periodo))].sort();
  if (!periodosConReal.length) { canvas.style.display = 'none'; return; }

  // Períodos completos de la obra para el plan
  const duracionDias = state.obra.duracionDias || 0;
  const totalMeses = Math.ceil(duracionDias / 30);
  const fechaReplanteo = state.obra.fechaReplanteo || null;
  let periodosObra = [];
  if (totalMeses > 0 && fechaReplanteo) {
    for (let i = 0; i < totalMeses; i++) {
      const [anio, mes] = fechaReplanteo.split('-').map(Number);
      const fecha = new Date(anio, mes - 1 + i, 1);
      periodosObra.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
    }
  } else {
    for (let i = 0; i < totalMeses; i++) periodosObra.push(`MES-${i + 1}`);
  }

  // Labels: unión de períodos con real + todos los de la obra
  const todosLosPeriodos = [...new Set([...periodosConReal, ...periodosObra])].sort();

  const totalContrato = state.items.reduce((s, i) => s + i.cantidad * i.precio, 0);

  // Por cada período: suma ponderada acumulada de plan y real
  let acumPlanVal = 0, acumRealVal = 0;
  const dataPlanMap = {};
  const dataRealMap = {};

  todosLosPeriodos.forEach(p => {
    let planPeriodo = 0;
    state.items.forEach(item => {
      const cv = item.cantidad;
      if (cv === 0) return;
      const planEntry = state.plan.find(x => x.itemId === item.id && x.periodo === p);
      const cantPlan = planEntry ? planEntry.cantidad : 0;
      planPeriodo += (cantPlan / cv) * (item.cantidad * item.precio / totalContrato);
    });
    acumPlanVal += planPeriodo;
    dataPlanMap[p] = Math.round(acumPlanVal * 10000) / 100;
  });

  periodosConReal.forEach(p => {
    let realPeriodo = 0;
    state.items.forEach(item => {
      const cv = item.cantidad;
      if (cv === 0) return;
      const realEntry = state.real.find(x => x.itemId === item.id && x.periodo === p);
      const cantReal = realEntry ? realEntry.cantidad : 0;
      realPeriodo += (cantReal / cv) * (item.cantidad * item.precio / totalContrato);
    });
    acumRealVal += realPeriodo;
    dataRealMap[p] = Math.round(acumRealVal * 10000) / 100;
  });

  const dataPlan = todosLosPeriodos.map(p => dataPlanMap[p] ?? null);
  const dataReal = todosLosPeriodos.map(p => dataRealMap[p] ?? null);
  const labels = todosLosPeriodos.map(p => periodoLabel(p));

  // Destruir gráfico anterior si existe
  if (window._graficoAvance) window._graficoAvance.destroy();

  window._graficoAvance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Plan acumulado %',
          data: dataPlan,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,0.12)',
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: 0.3
        },
        {
          label: 'Real acumulado %',
          data: dataReal,
          borderColor: '#2d7a4f',
          backgroundColor: 'rgba(45,122,79,0.10)',
          borderWidth: 2,
          pointRadius: 4,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { callback: v => v + '%' },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' }
        }
      }
    }
  });
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
    <th>Ítem</th>
    <th>Un.</th>
    <th>Cant.</th>
    ${periodos.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
    <th>%</th>
  </tr>`;

  const tbody = document.getElementById('real-tbody');
  tbody.innerHTML = state.items.map(item => {
    const ultimoPeriodo = periodos[periodos.length - 1];
    const cv = item.cantidad;
    let totalReal = 0;

    const celdas = periodos.map(p => {
      const realRow = state.real.find(x => x.itemId === item.id && x.periodo === p);
      const cant = realRow ? realRow.cantidad : null;
      if (cant !== null) totalReal += cant;
      const val = cant !== null ? parseFloat(cant.toFixed(4)) : '';
      return `<td>
        <input type="number" step="any"
          value="${val}"
          data-item="${item.id}" data-periodo="${p}"
          onchange="guardarRealInline(this)"
          onwheel="this.blur()"
        />
      </td>`;
    }).join('');

    const pct = cv > 0 ? totalReal / cv : 0;
    const pctColor = pct > 1.001 ? 'var(--danger)' : pct >= 0.999 ? 'var(--ok)' : 'var(--warn)';

    return `<tr>
      <td><span style="color:var(--text2);font-size:11px;margin-right:6px">${item.nro || ''}</span>${item.nombre}</td>
      <td>${item.nombre}</td>
      <td>${item.unidad}</td>
      <td>${cv}</td>
      ${celdas}
      <td style="color:${pctColor}">${fmtPct(pct)}</td>
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

function renderPlanesHistoricos() {
  const lista = document.getElementById('planes-historicos-list');
  const empty = document.getElementById('planes-historicos-empty');
  const historicos = state.planesHistoricos || [];
  if (!historicos.length) {
    lista.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  lista.innerHTML = historicos
    .slice().reverse()
    .map(h => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border)">
                <div>
                    <div style="font-size:13px;font-weight:600">${h.nombre}</div>
                    <div style="font-size:11px;color:var(--text2)">${h.fecha} · ${h.plan.length} registros</div>
                </div>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-sm" onclick="restaurarPlanHistorico(${h.id})">Restaurar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarPlanHistorico(${h.id})">✕</button>
                </div>
            </div>
        `).join('');
}

function restaurarPlanHistorico(id) {
  const h = (state.planesHistoricos || []).find(x => x.id === id);
  if (!h) return;
  if (!confirm(`¿Restaurar el plan "${h.nombre}"? El plan actual se perderá.`)) return;
  state.plan = JSON.parse(JSON.stringify(h.plan));
  save();
  renderPlanTable();
  renderPlanesHistoricos();
  alert(`✓ Plan "${h.nombre}" restaurado.`);
}

function eliminarPlanHistorico(id) {
  const h = (state.planesHistoricos || []).find(x => x.id === id);
  if (!h) return;
  if (!confirm(`¿Eliminar el plan "${h.nombre}" del historial?`)) return;
  state.planesHistoricos = state.planesHistoricos.filter(x => x.id !== id);
  save();
  renderPlanesHistoricos();
}