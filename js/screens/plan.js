// ═══════════════════════════════════════════════
// PLAN Y AVANCE
// ═══════════════════════════════════════════════

let planObra = [];

function renderPlanScreen() {
  const sel = document.getElementById('plan-item-select');
  sel.innerHTML = state.items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');

  const perSelect = document.getElementById('plan-periodo-select');
  const periodos = [...new Set([...state.plan.map(p => p.periodo), ...state.real.map(r => r.periodo)])].sort();
  perSelect.innerHTML = periodos.map(p => `<option value="${p}">${periodoLabel(p)}</option>`).join('');

  populateItemSelects();
  renderPlanTable();
}

function renderPlanTable() {
  const itemId = parseInt(document.getElementById('plan-item-select').value);
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const planRows = state.plan.filter(p => p.itemId === itemId).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const tbody = document.getElementById('plan-tbody');

  let acum = 0;
  tbody.innerHTML = planRows.map(row => {
    const cv = cantidadVigente(itemId, row.periodo);
    const pctEfectivo = cv > 0 ? row.cantidad / cv : 0;
    acum += pctEfectivo;
    const realRow = state.real.find(r => r.itemId === itemId && r.periodo === row.periodo);
    return `<tr>
      <td>${periodoLabel(row.periodo)}</td>
      <td class="num">${row.cantidad}</td>
      <td class="num">${cv}</td>
      <td class="num">${fmtPct(pctEfectivo)}</td>
      <td class="num ${acum > 1.001 ? 'text-danger' : ''}">${fmtPct(Math.min(acum, 1))}</td>
    </tr>`;
  }).join('');

  // Remanente cards
  const lastPer = planRows.length ? planRows[planRows.length - 1].periodo : null;
  const perSelect = document.getElementById('plan-periodo-select');
  const selPer = perSelect.value || lastPer;
  document.getElementById('plan-rem-periodo').textContent = selPer ? periodoLabel(selPer) : '—';

  const remCards = document.getElementById('plan-remanente-cards');
  if (!selPer) { remCards.innerHTML = '<div class="empty"><div class="empty-sub">Seleccioná un período</div></div>'; return; }
  const rem = remanente(itemId, selPer);
  const cv = cantidadVigente(itemId, selPer);
  const notaMap = {
    'economia': ['tag-no', 'Ítem con economía — cantidad vigente 0'],
    'penalizado': ['tag-warn', 'Penalizado — avance real supera al plan'],
    'real-menor': ['tag-ok', 'Se aplica real (menor al teórico)'],
    'teorico-menor': ['tag-ok', 'Se aplica teórico (menor al real)'],
    'ok': ['tag-ok', 'Normal']
  };
  const [tagClass, notaTxt] = notaMap[rem.nota] || ['tag-neutral', ''];
  remCards.innerHTML = `
    <div class="metric" style="margin-bottom:10px">
      <div class="metric-label">Cantidad vigente</div>
      <div class="metric-val" style="font-size:18px">${cv} ${item.unidad}</div>
    </div>
    <div class="metric" style="margin-bottom:10px">
      <div class="metric-label">Remanente teórico (plan)</div>
      <div class="metric-val" style="font-size:18px">${fmtPct(rem.teorico)}</div>
    </div>
    <div class="metric" style="margin-bottom:10px">
      <div class="metric-label">Remanente real</div>
      <div class="metric-val" style="font-size:18px;color:${rem.real < rem.teorico ? 'var(--ok)' : 'var(--warn)'}">${fmtPct(rem.real)}</div>
    </div>
    <div class="metric" style="background:${rem.aplicado === 0 && rem.nota !== 'ok' ? 'var(--warn-bg)' : 'var(--surface2)'}">
      <div class="metric-label">Remanente aplicado (MIN)</div>
      <div class="metric-val" style="font-size:18px;font-weight:600">${fmtPct(rem.aplicado)}</div>
      <div class="metric-sub"><span class="tag ${tagClass}" style="font-size:10px">${notaTxt}</span></div>
    </div>`;
}

function guardarPlan() {
  const itemId = parseInt(document.getElementById('plan-item-modal').value);
  const periodo = document.getElementById('plan-periodo-modal').value;
  const cantidad = parseFloat(document.getElementById('plan-cantidad-modal').value);
  if (!itemId || !periodo || isNaN(cantidad)) return alert('Completá todos los campos');
  state.plan = state.plan.filter(p => !(p.itemId === itemId && p.periodo === periodo));
  state.plan.push({ itemId, periodo, cantidad });
  save(); closeModal('modal-cargar-plan'); renderPlanTable();
}

function guardarReal() {
  const itemId = parseInt(document.getElementById('real-item-modal').value);
  const periodo = document.getElementById('real-periodo-modal').value;
  const cantidad = parseFloat(document.getElementById('real-cantidad-modal').value);
  if (!itemId || !periodo || isNaN(cantidad)) return alert('Completá todos los campos');
  state.real = state.real.filter(r => !(r.itemId === itemId && r.periodo === periodo));
  state.real.push({ itemId, periodo, cantidad });
  save(); closeModal('modal-cargar-avance'); renderPlanTable();
}

function descargarPlantilla() {
  const dias = Number(document.getElementById("obra-duracion-dias").value);
  const meses = Math.ceil(dias / 30);

  const headers = ["Item", "Unidad"];

  for (let i = 1; i <= meses; i++) {
    headers.push(`Mes ${i}`);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Plan de Avance");

  XLSX.writeFile(wb, "plan_avance.xlsx");
}

function cargarPlanExcel(event) {
  const file = event.target.files[0];

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    procesarPlanExcel(json);
  };

  reader.readAsArrayBuffer(file);
}

function procesarPlanExcel(data) {
  const headers = data[0];
  const filas = data.slice(1);

  const meses = headers.slice(2);

  planObra = filas.map(f => {
    return {
      item: f[0],
      unidad: f[1],
      avanceMensual: f.slice(2).map(v => Number(v) || 0)
    };
  });

  renderPlanTable();
}

function renderPlanTable() {
  const tbody = document.getElementById("plan-tbody");
  tbody.innerHTML = "";

  planObra.forEach(p => {
    const total = p.avanceMensual.reduce((a, b) => a + b, 0);

    const tr = document.createElement("tr");

    tr.innerHTML = `
            <td>${p.item}</td>
            <td>${p.unidad}</td>
            <td>${total}</td>
            <td>100%</td>
            <td>${total}</td>
        `;

    tbody.appendChild(tr);
  });
}