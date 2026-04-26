// ═══════════════════════════════════════════════
// PLAN Y AVANCE
// ═══════════════════════════════════════════════

function renderPlanScreen() {
  populateItemSelects();
  renderPlanTable();
}

function renderPlanTable() {
  if (!state.items.length) {
    document.getElementById('plan-thead').innerHTML = '';
    document.getElementById('plan-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text2);padding:24px">Sin ítems cargados</td></tr>';
    return;
  }

  // Períodos: unión de plan y real, ordenados
  const periodos = [...new Set(state.plan.map(p => p.periodo))].sort();

  // Sin períodos todavía
  const thead = document.getElementById('plan-thead');
  if (!periodos.length) {
    thead.innerHTML = '<tr><th>Ítem</th><th>Unidad</th><th>Cantidad</th><th style="color:var(--text2);font-weight:400;font-style:italic">Sin períodos cargados</th></tr>';
    document.getElementById('plan-tbody').innerHTML = '';
    return;
  }

  // Header
  thead.innerHTML = `<tr>
    <th>Ítem</th>
    <th>Un.</th>
    <th>Cant.</th>
    ${periodos.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
    <th>%</th>
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
      const contenido = cantPlan !== null ? `<span style="color:var(--ok);font-size:11px">${parseFloat(cantPlan.toFixed(4))}</span>` : '';
      return `<td>${contenido}</td>`;

    }).join('');

    const pct = cv > 0 ? totalPlan / cv : 0;
    const pctColor = pct > 1.001 ? 'var(--danger)' : pct >= 0.999 ? 'var(--ok)' : 'var(--warn)';

    return `<tr>
      <td>${item.nombre}</td>
      <td>${item.unidad}</td>
      <td>${cv}</td>
      ${celdas}
      <td style="color:${pctColor}">${fmtPct(pct)}</td>
    </tr>`;
  }).join('');
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

  // Verificar si el nuevo plan afecta adecuaciones calculadas
  const adecsProceden = state.adecuaciones.filter(a => a.procede).sort((a, b) => a.periodo.localeCompare(b.periodo));
  if (adecsProceden.length) {
    // Simular el nuevo plan temporalmente
    let planSimulado = [...state.plan];
    const itemsEnExcelTemp = filas.map(f => state.items.find(i => i.nombre.trim() === String(f[0] || '').trim())).filter(Boolean);
    itemsEnExcelTemp.forEach(item => { planSimulado = planSimulado.filter(p => p.itemId !== item.id); });
    nuevasPlan.forEach(np => {
      planSimulado = planSimulado.filter(p => !(p.itemId === np.itemId && p.periodo === np.periodo));
      planSimulado.push(np);
    });
    // Comparar remanentes con el plan nuevo vs el actual para cada adecuación
    const itemsAfectados = new Set();
    adecsProceden.forEach(adec => {
      const periodoCalculo = adec.periodoCalculo || adec.periodo;
      state.items.forEach(item => {
        const remActual = remanente(item.id, periodoCalculo);
        // Calcular remanente con plan simulado
        const planOriginal = state.plan;
        state.plan = planSimulado;
        const remNuevo = remanente(item.id, periodoCalculo);
        state.plan = planOriginal;
        const planActualItem = state.plan.filter(p => p.itemId === item.id);
        if (planActualItem.length > 0 && Math.abs(remActual.aplicado - remNuevo.aplicado) > 0.0001) {
          itemsAfectados.add(`${item.nombre} (${periodoLabel(adec.periodo)})`);
        }
      });
    });
    if (itemsAfectados.size > 0) {
      alert(`⚠️ Atención: el plan importado modifica el resultado de adecuaciones ya calculadas en los siguientes ítems:\n\n${[...itemsAfectados].join('\n')}\n\nEl plan NO fue importado. Verificá que el plan sea correcto.`);
      document.getElementById('plan-file').value = '';
      return;
    }
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