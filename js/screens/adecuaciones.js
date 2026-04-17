// ═══════════════════════════════════════════════
// ADECUACIONES
// ═══════════════════════════════════════════════

function calcularEstadoGatillo() {
    const gatilloPct = (state.gatillo || 10) / 100;
    const apertura = state.obra && state.obra.fechaApertura;

    let periodos = Object.keys(window.iopGlobal || {}).sort();
    if (apertura) periodos = periodos.filter(p => p >= apertura);
    if (!periodos.length) return [];

    const todos = Object.keys(window.iopGlobal || {}).sort();
    const idxPrimero = todos.indexOf(periodos[0]);
    let baseIndex = idxPrimero > 0 ? todos[idxPrimero - 1] : periodos[0];

    const resultados = [];

    for (let i = 0; i < periodos.length; i++) {
        const p = periodos[i];

        // Período 0 (= apertura): vacío como en el Excel, es la base
        if (i === 0) {
            resultados.push({ periodo: p, variacion: null, supera: false, basePeriodo: null });
            continue;
        }

        const periodoAnterior = periodos[i - 1];
        const variacion = getIOP(periodoAnterior, baseIndex);

        if (variacion == null) {
            resultados.push({ periodo: p, variacion: null, supera: false, basePeriodo: baseIndex });
            continue;
        }

        const supera = variacion > gatilloPct;

        resultados.push({ periodo: p, variacion, supera, basePeriodo: baseIndex });

        // Cambio de base: el período donde se detectó el gatillo pasa a ser la nueva base
        if (supera) {
            baseIndex = periodoAnterior;
        }
    }

    return resultados;
}

function renderGatillo() {
    const container = document.getElementById('adec-gatillo-container');
    const empty = document.getElementById('adec-gatillo-empty');
    const apertura = state.obra && state.obra.fechaApertura;

    const resultados = calcularEstadoGatillo();

    if (!resultados.length || !apertura) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    let thead = '<tr><th style="min-width:130px"></th>';
    let trBase = '<tr><td style="font-size:11px;color:var(--text2);font-weight:500">Base activa</td>';
    let trVar = '<tr><td style="font-size:11px;color:var(--text2);font-weight:500">Var. acumulada</td>';
    let trTag = '<tr><td style="font-size:11px;color:var(--text2);font-weight:500">Estado</td>';

    resultados.forEach(r => {
        const yaCalculada = state.adecuaciones.some(a => a.periodo === r.periodo);

        thead += `<th style="min-width:90px;text-align:center">${periodoLabel(r.periodo)}</th>`;

        trBase += `<td style="text-align:center;font-size:11px;color:var(--text2)">${r.basePeriodo ? periodoLabel(r.basePeriodo) : '—'}</td>`;

        const varTxt = r.variacion !== null
            ? `<span style="font-weight:600;color:${r.supera ? 'var(--ok)' : 'var(--text)'}">${r.variacion >= 0 ? '+' : ''}${(r.variacion * 100).toFixed(2)}%</span>`
            : '<span style="color:var(--text2)">—</span>';

        const estadoTag = yaCalculada
            ? `<span class="tag tag-ok" style="font-size:10px">Calculada</span>`
            : r.supera
                ? `<span class="tag tag-ok" style="font-size:10px">✓ Gatillo</span>`
                : r.variacion !== null
                    ? `<span class="tag tag-no" style="font-size:10px">No supera</span>`
                    : '<span style="color:var(--text2);font-size:11px">—</span>';

        trVar += `<td style="text-align:center">${varTxt}</td>`;
        trTag += `<td style="text-align:center">${estadoTag}</td>`;
    });

    thead += '</tr>';
    trBase += '</tr>';
    trVar += '</tr>';
    trTag += '</tr>';

    container.innerHTML = `<div style="overflow-x:auto"><table style="min-width:100%"><thead>${thead}</thead><tbody>${trBase}${trVar}${trTag}</tbody></table></div>`;
}

function renderAdecuaciones() {
    renderGatillo();

    const tbody = document.getElementById('adec-control-tbody');
    const empty = document.getElementById('adec-empty');

    if (!state.adecuaciones.length) {
        tbody.innerHTML = ''; empty.style.display = 'block';
        document.getElementById('adec-detalle-section').style.display = 'none';
        return;
    }
    empty.style.display = 'none';

    const sorted = [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo));
    tbody.innerHTML = sorted.map((a, idx) => {
        const varPct = a.iopBase && a.iopActual ? (a.iopActual / a.iopBase - 1) * 100 : 0;
        return `<tr>
      <td>${periodoLabel(a.periodo)}</td>
      <td class="num">${a.iopBase ? a.iopBase.toLocaleString('es-AR') : '—'}</td>
      <td class="num">${a.iopActual ? a.iopActual.toLocaleString('es-AR') : '—'}</td>
      <td class="num ${varPct >= (state.gatillo || 10) ? 'text-ok fw6' : 'text-warn'}">${varPct >= 0 ? '+' : ''}${varPct.toFixed(2)}%</td>
      <td><span class="tag ${varPct >= (state.gatillo || 10) ? 'tag-ok' : 'tag-no'}">${varPct >= (state.gatillo || 10) ? 'Sí' : 'No'}</span></td>
      <td><span class="tag ${a.empresaPidio === 'si' ? 'tag-ok' : 'tag-no'}">${a.empresaPidio === 'si' ? 'Sí' : 'No'}</span></td>
      <td><span class="tag ${a.procede ? 'tag-ok' : 'tag-no'}">${a.procede ? 'Procede' : 'No procede'}</span></td>
      <td class="num fw6">${a.procede ? fmt$(a.total) : '—'}</td>
      <td>
        <button class="btn btn-sm" onclick="mostrarDetalle(${idx})">Ver</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarAdecuacion(${idx})" style="margin-left:4px">×</button>
      </td>
    </tr>`;
    }).join('');

    if (sorted.length) mostrarDetalle(sorted.length - 1);
}

function mostrarDetalle(idx) {
    const sorted = [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo));
    const a = sorted[idx];
    const num = idx + 1;
    document.getElementById('adec-detalle-section').style.display = 'block';
    document.getElementById('adec-detalle-titulo').textContent = `Adecuación provisoria ${num} — ${periodoLabel(a.periodo)}`;
    document.getElementById('adec-detalle-sub').textContent = a.procede ? `Factor IOP: ${a.iopActual && a.iopBase ? (a.iopActual / a.iopBase).toFixed(4) : '—'}` : 'No procede — sin cálculo';

    const tbody = document.getElementById('adec-detalle-tbody');
    tbody.innerHTML = (a.detalle || []).map(d => {
        const notaMap2 = {
            'economia': ['tag-no', 'Economía'],
            'penalizado': ['tag-warn', 'Penalizado'],
            'real-menor': ['tag-ok', 'Real menor'],
            'teorico-menor': ['tag-ok', 'Teórico menor'],
            'ok': ['tag-neutral', '—']
        };
        const [tc, tn] = notaMap2[d.nota] || ['tag-neutral', '—'];
        return `<tr>
      <td style="font-weight:500">${d.nombre}</td>
      <td class="num">${fmt$(d.precioVigente)}</td>
      <td class="num">${fmtPct(d.remTeorico)}</td>
      <td class="num">${fmtPct(d.remReal)}</td>
      <td class="num fw6">${fmtPct(d.remAplicado)}</td>
      <td class="num">${a.factor ? a.factor.toFixed(4) : '—'}</td>
      <td class="num fw6 ${d.adecuacion > 0 ? 'text-ok' : d.adecuacion < 0 ? 'text-danger' : ''}">${fmt$(d.adecuacion)}</td>
      <td><span class="tag ${tc}" style="font-size:10px">${tn}</span></td>
    </tr>`;
    }).join('');

    document.getElementById('adec-totales').innerHTML = `
    <div style="font-size:12px;color:var(--text2)">Total adecuación ${periodoLabel(a.periodo)}</div>
    <div style="font-size:24px;font-weight:600;font-family:var(--mono);color:${a.total >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmt$(a.total)}</div>`;

    document.getElementById('adec-bases').innerHTML = `
    Factor IOP: ${a.factor ? a.factor.toFixed(4) : '—'}<br>
    Base: IOP ${periodoLabel(calcIopBase(a.periodo))} · Nueva base: IOP ${periodoLabel(a.periodo)}`;
}

function calcularAdecuacion() {
    // Populate periodo select with IOP periods not yet in adecuaciones
    const usados = state.adecuaciones.map(a => a.periodo);
    const disponibles = Object.keys(window.iopGlobal || {}).filter(p => !usados.includes(p)).sort();
    const sel = document.getElementById('adec-periodo-select');
    sel.innerHTML = disponibles.map(p => `<option value="${p}">${periodoLabel(p)}</option>`).join('');
    if (!disponibles.length) return alert('No hay períodos IOP disponibles para calcular');

    // Show IOP info
    updateAdecModalInfo();
    sel.onchange = updateAdecModalInfo;
    openModal('modal-nueva-adec');
}

function updateAdecModalInfo() {
    const periodo = document.getElementById('adec-periodo-select').value;
    const base = calcIopBase(periodo);
    const vBase = base ? getIOP(base) : null;
    const vActual = getIOP(periodo);
    const varAcum = vBase && vActual ? (vActual / vBase - 1) * 100 : null;
    const gatillo = state.gatillo || 10;
    const supera = varAcum !== null && superaGatillo;
    document.getElementById('adec-modal-iop-info').innerHTML = `
    <div class="alert ${supera ? 'alert-ok' : 'alert-warn'}">
      ${varAcum !== null ? `Variación IOP acumulada: <strong>${varAcum >= 0 ? '+' : ''}${varAcum.toFixed(2)}%</strong> — Gatillo ${gatillo}% — ${supera ? '✓ Supera el gatillo' : '✗ No supera el gatillo'}` : 'Sin datos IOP para este período'}
    </div>`;
}

function guardarAdecuacion() {
    const periodo = document.getElementById('adec-periodo-select').value;
    const empresaPidio = document.getElementById('adec-empresa-pidio').value;
    if (!periodo) return;

    // Buscar el resultado del gatillo para este período
    // 🔥 REEMPLAZAR SOLO ESTE BLOQUE dentro de guardarAdecuacion()

    const estadoGatillo = calcularEstadoGatillo();
    const resultadoPeriodo = estadoGatillo.find(r => r.periodo === periodo);

    const varAcum = resultadoPeriodo ? resultadoPeriodo.variacion : null;
    const basePeriodo = resultadoPeriodo ? resultadoPeriodo.basePeriodo : null;

    const gatillo = (state.gatillo || 10) / 100;
    const superaGatillo = varAcum !== null && varAcum > gatillo;

    const procede = superaGatillo && empresaPidio === 'si';

    const iopBaseVal = basePeriodo ? getIOP(basePeriodo) : null;
    const iopActualVal = getIOP(periodo);
    const factor = (iopBaseVal && iopActualVal) ? iopActualVal / iopBaseVal : 1;

    let total = 0;
    const detalle = state.items.map(item => {
        const cv = cantidadVigente(item.id, periodo);
        const precioVigente = cv * item.precio;
        const rem = remanente(item.id, periodo);
        let adecuacion = 0;
        if (procede) {
            // Adecuacion = precio vigente * remAplicado * (factor - 1)
            adecuacion = precioVigente * rem.aplicado * (factor - 1);
        }
        total += adecuacion;
        return {
            itemId: item.id,
            nombre: item.nombre,
            precioVigente,
            remTeorico: rem.teorico,
            remReal: rem.real,
            remAplicado: rem.aplicado,
            nota: rem.nota,
            adecuacion
        };
    });

    state.adecuaciones.push({
        periodo,
        empresaPidio,
        superaGatillo,
        procede,
        iopBase: iopBaseVal,
        iopActual: iopActualVal,
        basePeriodo, // 🔥 guardar base correcta
        factor,
        total,
        detalle
    });
    save();
    closeModal('modal-nueva-adec');
    renderAdecuaciones();
}

function eliminarAdecuacion(idx) {
    const sorted = [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo));
    const a = sorted[idx];
    state.adecuaciones = state.adecuaciones.filter(x => x.periodo !== a.periodo);
    save(); renderAdecuaciones();
}

function exportarAdecuacion() {
    const sorted = [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (!sorted.length) return;
    const last = sorted[sorted.length - 1];
    let txt = `ADECUACIÓN PROVISORIA — ${periodoLabel(last.periodo)}\n`;
    txt += `Obra: ${state.obra.nombre}\n`;
    txt += `Factor IOP: ${last.factor ? last.factor.toFixed(4) : '—'}\n\n`;
    txt += `Ítem\tPrecio vigente\tRem. teórico\tRem. real\tRem. aplicado\tAdecuación\n`;
    (last.detalle || []).forEach(d => {
        txt += `${d.nombre}\t${Math.round(d.precioVigente)}\t${(d.remTeorico * 100).toFixed(2)}%\t${(d.remReal * 100).toFixed(2)}%\t${(d.remAplicado * 100).toFixed(2)}%\t${Math.round(d.adecuacion)}\n`;
    });
    txt += `\nTOTAL\t\t\t\t\t${Math.round(last.total)}\n`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `adecuacion_${last.periodo}.txt`;
    a.click();
}