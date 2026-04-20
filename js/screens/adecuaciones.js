// ═══════════════════════════════════════════════
// ADECUACIONES
// ═══════════════════════════════════════════════

function calcularEstadoGatillo() {
    const gatilloPct = (state.gatillo || 10) / 100;
    const apertura = state.obra && state.obra.fechaApertura;

    let periodos = Object.keys(window.iopGlobal || {}).sort();
    if (apertura) periodos = periodos.filter(p => p >= apertura);
    const todos = Object.keys(window.iopGlobal || {}).sort();
    // Agregar un período extra al final (su VRI usa el último mes de IOP como periodoCalculo)
    if (periodos.length) {
        const ultimo = periodos[periodos.length - 1];
        const [anio, mes] = ultimo.split('-').map(Number);
        const siguienteMes = mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
        periodos.push(siguienteMes);
        if (!todos.includes(siguienteMes)) todos.push(siguienteMes);
    }
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

        // Cambio de base si el período anterior tiene adecuación que procede
        const adecProcede = state.adecuaciones.find(a => a.procede && a.periodo === periodoAnterior);
        if (adecProcede) {
            // La nueva base es el período anterior al gatillo (dos posiciones atrás)
            const idxAnterior = todos.indexOf(periodoAnterior);
            baseIndex = idxAnterior > 0 ? todos[idxAnterior - 1] : periodoAnterior;
        }

        // Si baseIndex === periodoAnterior (recién cambió la base), calcular el actual contra la nueva base
        // Si no, calcular el anterior contra la base (comportamiento normal)
        const periodoACalcular = baseIndex === periodoAnterior ? p : periodoAnterior;
        const variacion = getIOP(periodoACalcular, baseIndex);

        if (variacion == null) {
            resultados.push({ periodo: p, variacion: null, supera: false, basePeriodo: baseIndex });
            continue;
        }

        const supera = variacion > gatilloPct;

        resultados.push({ periodo: p, variacion, supera, basePeriodo: baseIndex, periodoCalculo: periodoAnterior });


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

    const tdSticky = `position:sticky;left:0;background:var(--surface);z-index:2;white-space:nowrap;`;
    const thSticky = `position:sticky;left:0;background:var(--surface);z-index:3;`;

    let thead = `<tr><th style="${thSticky}min-width:110px"></th>`;
    let trBase = `<tr><td style="${tdSticky}font-size:11px;color:var(--text2);font-weight:500">Base activa</td>`;
    let trVar = `<tr><td style="${tdSticky}font-size:11px;color:var(--text2);font-weight:500">Var. acumulada</td>`;
    let trTag = `<tr><td style="${tdSticky}font-size:11px;color:var(--text2);font-weight:500">Estado</td>`;
    let trAcc = `<tr><td style="${tdSticky}font-size:11px;color:var(--text2);font-weight:500">Acción</td>`;

    resultados.forEach(r => {
        const adec = state.adecuaciones.find(a => a.periodo === r.periodo);
        const yaCalculada = !!adec;

        thead += `<th style="min-width:80px;text-align:center;white-space:nowrap;font-size:11px">${periodoLabel(r.periodo)}</th>`;
        trBase += `<td style="text-align:center;font-size:11px;color:var(--text2);padding:6px 8px">${r.basePeriodo ? periodoLabel(r.basePeriodo) : '—'}</td>`;

        const varTxt = r.variacion !== null
            ? `<span style="font-weight:600;color:${r.supera ? 'var(--ok)' : 'var(--text)'}">${r.variacion >= 0 ? '+' : ''}${(r.variacion * 100).toFixed(2)}%</span>`
            : '<span style="color:var(--text2)">—</span>';

        let estadoTag;
        if (yaCalculada) {
            estadoTag = adec.procede
                ? `<span class="tag tag-ok" style="font-size:10px">✓ Procede</span>`
                : `<span class="tag tag-no" style="font-size:10px">No procede</span>`;
        } else if (r.supera) {
            estadoTag = `<span class="tag tag-ok" style="font-size:10px">✓ Gatillo</span>`;
        } else if (r.variacion !== null) {
            estadoTag = `<span class="tag tag-no" style="font-size:10px">No supera</span>`;
        } else {
            estadoTag = '<span style="color:var(--text2);font-size:11px">—</span>';
        }

        let accion;
        if (yaCalculada) {
            accion = `<button class="btn btn-sm btn-danger" onclick="eliminarAdecuacion('${r.periodo}')" style="font-size:10px">× Borrar</button>`;
        } else if (r.supera) {
            accion = `
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                    <select id="empresa-pidio-${r.periodo}" style="font-size:10px;padding:2px 4px;width:80px">
                        <option value="no">No pidió</option>
                        <option value="si">Sí pidió</option>
                    </select>
                    <label style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--text2);cursor:pointer">
                        <input type="checkbox" id="decreto1082-${r.periodo}"> Dec. 1082
                    </label>
                    <button class="btn btn-sm btn-primary" onclick="registrarAdecuacionDirecta('${r.periodo}')" style="font-size:10px">Calcular</button>
                </div>`;
        } else {
            accion = '<span style="color:var(--text2);font-size:11px">—</span>';
        }

        trVar += `<td style="text-align:center;padding:6px 8px">${varTxt}</td>`;
        trTag += `<td style="text-align:center;padding:6px 8px">${estadoTag}</td>`;
        trAcc += `<td style="text-align:center;padding:4px 6px">${accion}</td>`;
    });

    thead += '</tr>';
    trBase += '</tr>';
    trVar += '</tr>';
    trTag += '</tr>';
    trAcc += '</tr>';

    container.innerHTML = `
        <div style="overflow-x:auto">
            <table style="min-width:100%;border-collapse:collapse">
                <thead>${thead}</thead>
                <tbody>${trVar}${trBase}${trTag}${trAcc}</tbody>
            </table>
        </div>`;
}

function registrarAdecuacionDirecta(periodo) {
    const empresaPidio = document.getElementById(`empresa-pidio-${periodo}`).value;
    const decreto1082 = document.getElementById(`decreto1082-${periodo}`)?.checked || false;

    const estadoGatillo = calcularEstadoGatillo();
    const resultado = estadoGatillo.find(r => r.periodo === periodo);
    const varAcum = resultado ? resultado.variacion : null;
    const basePeriodo = resultado ? resultado.basePeriodo : null;

    const gatillo = (state.gatillo || 10) / 100;
    const superaGatillo = varAcum !== null && varAcum > gatillo;
    const procede = superaGatillo && empresaPidio === 'si';

    const periodoCalculo = resultado ? resultado.periodoCalculo : null;
    const iopBaseVal = getIOP(periodoCalculo, basePeriodo);
    const iopActualVal = iopBaseVal;
    const factorGlobal = iopBaseVal !== null ? 1 + iopBaseVal : 1;

    let total = 0;
    const detalle = state.items.map(item => {
        const cv = cantidadVigente(item.id, periodo);
        // Buscar si hay una adecuación previa que procede para tomar su precio redeterminado
        const adecsPrevias = state.adecuaciones
            .filter(a => a.procede && a.periodo < periodo)
            .sort((a, b) => b.periodo.localeCompare(a.periodo));

        const adecAnterior = adecsPrevias[0];
        const detalleAnterior = adecAnterior?.detalle?.find(d => d.itemId === item.id);
        const precioBase = detalleAnterior?.precioRedeterminado ?? item.precio;
        const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
        const precioVigente = cv * precioBase;
        const rem = remanente(item.id, periodoCalculo || periodo);
        if (decreto1082) {
            if (rem.nota === 'penalizado' || rem.nota === 'teorico-menor') {
                rem.aplicado = rem.real;
                rem.nota = 'decreto1082';
            }
        }
        const factorItem = (periodoCalculo && basePeriodo) ? getFactorItem(item, periodoCalculo, basePeriodo) : null;
        const factor = factorItem !== null ? factorItem : factorGlobal;

        const FAP = 0.95;
        let adecuacion = 0;
        let saldoReintegro = 0;
        let ajusteOC = 0;
        let precioRedeterminado = precioBase;
        let precioProvisorio = precioBase;

        if (item.nombre.includes('SANITARIA')) {
            console.log('cv:', cv, 'ap:', acumPlan(item.id, periodoCalculo || periodo), 'ar:', acumReal(item.id, periodoCalculo || periodo));
        }

        if (procede) {
            const anticipo = (state.obra.anticipoPct || 0) / 100;
            const aplicarAnticipo = anticipo > 0 && state.obra.anticipoPeriodo && periodo > state.obra.anticipoPeriodo;

            const factorRedondeado = Math.round(factor * 10000) / 10000;
            const variacion = Math.round((factorRedondeado - 1) * 10000) / 10000;
            // Si el 4to decimal es 0, usar factor sin redondear para fp
            const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
            const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;
            const factorProvisorio = detalleAnterior
                ? Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000
                : 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;
            const varProvisoria = factorProvisorio - 1;

            adecuacion = Math.round(precioVigente * rem.aplicado * variacion * 10000) / 10000;

            if (aplicarAnticipo) {
                precioRedeterminado = Math.round((precioBase * anticipo + precioBase * factorRedondeado * (1 - anticipo)) * 10000) / 10000;
                precioProvisorio = Math.round((precioBase * anticipo + precioBase * factorProvisorio * (1 - anticipo)) * 10000) / 10000;
                adecuacion = Math.round(adecuacion * (1 - anticipo) * 10000) / 10000;
            } else {
                precioRedeterminado = Math.round(Math.round(precioBase * 10000) * Math.round(factorRedondeado * 10000) / 10000) / 10000;
                precioProvisorio = Math.round(Math.round(precioBase * 10000) * Math.round(factorProvisorio * 10000) / 10000) / 10000;
            }
            const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
            ajusteOC = Math.round((cv * rem.aplicado * (precioProvisorio - precioProvAnterior) + (cv - cv) * precioProvAnterior) * 10000) / 10000;
            saldoReintegro = Math.round((adecuacion - ajusteOC) * 10000) / 10000;
        }

        total += adecuacion;
        return {
            itemId: item.id,
            nombre: item.nombre,
            precioVigente,
            precioRedeterminado,
            precioProvisorio,
            remTeorico: rem.teorico,
            remReal: rem.real,
            remAplicado: rem.aplicado,
            nota: rem.nota,
            factor,
            adecuacion,
            ajusteOC,
            saldoReintegro
        };
    });

    state.adecuaciones = state.adecuaciones.filter(a => a.periodo !== periodo);
    state.adecuaciones.push({
        periodo,
        empresaPidio,
        decreto1082,
        superaGatillo,
        procede,
        iopBase: iopBaseVal,
        iopActual: iopActualVal,
        basePeriodo,
        periodoCalculo,
        factor: factorGlobal,
        total,
        detalle
    });

    save();
    renderAdecuaciones();
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
        const varPct = a.iopActual !== null && a.iopActual !== undefined ? a.iopActual * 100 : 0;
        const gatillo = state.gatillo || 10;
        return `<tr>
     <td style="text-align:center">${periodoLabel(a.periodo)}</td>
      <td style="text-align:center">${a.basePeriodo ? periodoLabel(a.basePeriodo) : '—'}</td>
      <td style="text-align:center">${periodoLabel(a.periodo)}</td>
      <td style="text-align:center" class="${varPct >= gatillo ? 'text-ok fw6' : 'text-warn'}">${varPct >= 0 ? '+' : ''}${varPct.toFixed(2)}%</td>
      <td style="text-align:center"><span class="tag ${varPct >= gatillo ? 'tag-ok' : 'tag-no'}">${varPct >= gatillo ? 'Sí' : 'No'}</span></td>
      <td style="text-align:center"><span class="tag ${a.empresaPidio === 'si' ? 'tag-ok' : 'tag-no'}">${a.empresaPidio === 'si' ? 'Sí' : 'No'}</span></td>
      <td style="text-align:center"><span class="tag ${a.procede ? 'tag-ok' : 'tag-no'}">${a.procede ? 'Procede' : 'No procede'}</span></td>
      <td class="num fw6">${a.procede ? fmt$(a.total - (a.detalle || []).reduce((s, d) => s + (d.saldoReintegro ?? 0), 0)) : '—'}</td>
      <td>
        <button class="btn btn-sm" onclick="mostrarDetalle(${idx})">Ver</button>
      </td>
    </tr>`;
    }).join('');

    if (sorted.length) mostrarDetalle(sorted.length - 1);
}

function mostrarDetalle(idx) {
    const sorted = [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo));
    const a = sorted[idx];
    const num = idx + 1;
    const notaMap2 = {
        'economia': ['tag-no', 'Economía'],
        'penalizado': ['tag-warn', 'Penalizado'],
        'decreto1082': ['tag-info', 'Dec. 1082'],
        'real-menor': ['tag-ok', 'Real menor'],
        'teorico-menor': ['tag-ok', 'Teórico menor'],
        'ok': ['tag-neutral', '—']
    };
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
            <td class="num">${d.factor ? d.factor.toFixed(4) : '—'}</td>
            <td class="num fw6">${fmt$(d.adecuacion)}</td>
            <td class="num fw6">${fmt$(d.ajusteOC ?? 0)}</td>
            <td class="num fw6 ${(d.saldoReintegro ?? 0) > 0 ? 'text-ok' : (d.saldoReintegro ?? 0) < 0 ? 'text-danger' : ''}">${fmt$(d.saldoReintegro ?? 0)}</td>
            <td><span class="tag ${tc}" style="font-size:10px">${tn}</span></td>
            </tr>`;
    }).join('');

    const totalAjusteOC = (a.detalle || []).reduce((s, d) => s + (d.ajusteOC ?? 0), 0);
    const totalSaldoReintegro = (a.detalle || []).reduce((s, d) => s + (d.saldoReintegro ?? 0), 0);

    const contratoOriginal = state.items.reduce((s, i) => s + i.cantidad * i.precio, 0);
    const adecsPrevias = sorted.filter((x, i) => i < idx && x.procede);
    const ajusteOCPrevios = adecsPrevias.reduce((s, x) =>
        s + (x.detalle || []).reduce((s2, d) => s2 + (d.ajusteOC ?? 0), 0), 0);
    const contratoReferencia = contratoOriginal + ajusteOCPrevios;
    const nuevoMonto = contratoReferencia + totalAjusteOC;
    const saldoAcumulado = sorted.filter((x, i) => i <= idx && x.procede).reduce((s, x) =>
        s + (x.detalle || []).reduce((s2, d) => s2 + (d.saldoReintegro ?? 0), 0), 0);

    document.getElementById('adec-totales').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
        <div>
            <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Adecuación seleccionada</div>
            <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Ajuste orden de compra</div>
                    <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:${totalAjusteOC >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmt$(totalAjusteOC)}</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Saldo a integrar — esta adecuación</div>
                    <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:${totalSaldoReintegro >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmt$(totalSaldoReintegro)}</div>
                </div>
            </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:14px">
            <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Resumen general</div>
            <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Contrato de referencia</div>
                    <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:var(--text)">${fmt$(contratoReferencia)}</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Nuevo monto de contrato</div>
                    <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:var(--accent-mid)">${fmt$(nuevoMonto)}</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Saldos acumulados a integrar</div>
                    <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:${saldoAcumulado >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmt$(saldoAcumulado)}</div>
                </div>
            </div>
        </div>
    </div>`;

    document.getElementById('adec-bases').innerHTML = `
    Factor IOP: ${a.factor ? a.factor.toFixed(4) : '—'}<br>
    Base: IOP ${periodoLabel(calcIopBase(a.periodo))} · Nueva base: IOP ${periodoLabel(a.periodo)}`;
}

function calcularAdecuacion() {
    const usados = state.adecuaciones.map(a => a.periodo);
    const apertura = state.obra && state.obra.fechaApertura;
    let periodos = Object.keys(window.iopGlobal || {}).sort();
    if (apertura) periodos = periodos.filter(p => p >= apertura);
    // Excluir período 0 (apertura) y los ya registrados
    const disponibles = periodos.filter((p, i) => i > 0 && !usados.includes(p));

    const sel = document.getElementById('adec-periodo-select');
    sel.innerHTML = disponibles.map(p => `<option value="${p}">${periodoLabel(p)}</option>`).join('');
    if (!disponibles.length) return alert('No hay períodos disponibles para registrar.');

    document.getElementById('adec-empresa-pidio').value = 'no';
    updateAdecModalInfo();
    sel.onchange = updateAdecModalInfo;
    openModal('modal-nueva-adec');
}

function updateAdecModalInfo() {
    const periodo = document.getElementById('adec-periodo-select').value;
    const empresaPidio = document.getElementById('adec-empresa-pidio').value;
    if (!periodo) return;

    const estadoGatillo = calcularEstadoGatillo();
    const resultado = estadoGatillo.find(r => r.periodo === periodo);
    const varAcum = resultado ? resultado.variacion : null;
    const gatillo = state.gatillo || 10;
    const supera = varAcum !== null && varAcum * 100 > gatillo;
    const procede = supera && empresaPidio === 'si';

    // Info del VRI
    const infoEl = document.getElementById('adec-modal-iop-info');
    if (varAcum === null) {
        infoEl.innerHTML = `<div class="alert alert-warn">Sin datos IOP para este período.</div>`;
    } else {
        infoEl.innerHTML = `<div class="alert ${supera ? 'alert-ok' : 'alert-warn'}">
            VRI acumulado: <strong>${varAcum >= 0 ? '+' : ''}${(varAcum * 100).toFixed(2)}%</strong>
            — Gatillo ${gatillo}% —
            ${supera ? '✓ Supera el gatillo' : '✗ No supera el gatillo'}
        </div>`;
    }

    // Resultado según empresa
    const resEl = document.getElementById('adec-modal-resultado');
    if (varAcum === null) {
        resEl.innerHTML = '';
    } else if (!supera) {
        resEl.innerHTML = `<div class="alert alert-warn">El VRI no supera el gatillo. Se registrará el período pero <strong>no procede adecuación</strong>. La base no cambia.</div>`;
    } else if (empresaPidio === 'no') {
        resEl.innerHTML = `<div class="alert alert-warn">El VRI supera el gatillo pero la empresa no lo pidió. Se registrará el período pero <strong>no procede adecuación</strong>. La base no cambia.</div>`;
    } else {
        resEl.innerHTML = `<div class="alert alert-ok">✓ <strong>Procede adecuación.</strong> Se calculará el monto y la base pasará al período anterior.</div>`;
    }
}

function guardarAdecuacion() {
    const periodo = document.getElementById('adec-periodo-select').value;
    const empresaPidio = document.getElementById('adec-empresa-pidio').value;
    const decreto1082 = document.getElementById('decreto1082-modal')?.checked || false;
    if (!periodo) return;

    const estadoGatillo = calcularEstadoGatillo();
    const resultado = estadoGatillo.find(r => r.periodo === periodo);
    const varAcum = resultado ? resultado.variacion : null;
    const basePeriodo = resultado ? resultado.basePeriodo : null;

    const gatillo = (state.gatillo || 10) / 100;
    const superaGatillo = varAcum !== null && varAcum > gatillo;
    const procede = superaGatillo && empresaPidio === 'si';

    const periodoCalculo = resultado ? resultado.periodoCalculo : null;
    const iopBaseVal = getIOP(periodoCalculo, basePeriodo);
    const iopActualVal = iopBaseVal;
    const factorGlobal = iopBaseVal !== null ? 1 + iopBaseVal : 1;

    let total = 0;
    const detalle = state.items.map(item => {
        const cv = cantidadVigente(item.id, periodo);
        // Buscar si hay una adecuación previa que procede para tomar su precio redeterminado
        const adecsPrevias = state.adecuaciones
            .filter(a => a.procede && a.periodo < periodo)
            .sort((a, b) => b.periodo.localeCompare(a.periodo));

        const adecAnterior = adecsPrevias[0];
        const detalleAnterior = adecAnterior?.detalle?.find(d => d.itemId === item.id);
        const precioBase = detalleAnterior?.precioRedeterminado ?? item.precio;
        const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
        const precioVigente = cv * precioBase;
        const rem = remanente(item.id, periodoCalculo || periodo);
        if (decreto1082) {
            if (rem.nota === 'penalizado' || rem.nota === 'teorico-menor') {
                rem.aplicado = rem.real;
                rem.nota = 'decreto1082';
            }
        }
        const factorItem = (periodoCalculo && basePeriodo) ? getFactorItem(item, periodoCalculo, basePeriodo) : null;
        const factor = factorItem !== null ? factorItem : factorGlobal;

        const FAP = 0.95;
        let adecuacion = 0;
        let saldoReintegro = 0;
        let ajusteOC = 0;
        let precioRedeterminado = precioBase;
        let precioProvisorio = precioBase;
        if (procede) {
            const anticipo = (state.obra.anticipoPct || 0) / 100;
            const aplicarAnticipo = anticipo > 0 && state.obra.anticipoPeriodo && periodo > state.obra.anticipoPeriodo;

            const factorRedondeado = Math.round(factor * 10000) / 10000;
            const variacion = Math.round((factorRedondeado - 1) * 10000) / 10000;
            // Si el 4to decimal es 0, usar factor sin redondear para fp
            const tieneDecimal4Cero = Math.round(factor * 10000) % 10 === 0;
            const factorParaFP = (detalleAnterior && tieneDecimal4Cero) ? factor : factorRedondeado;
            const factorProvisorio = detalleAnterior
                ? Math.round((1 + (factorParaFP - 1) * FAP) * 10000) / 10000
                : 1 + Math.round(Math.round((factor - 1) * 10000) / 10000 * FAP * 10000) / 10000;
            const varProvisoria = factorProvisorio - 1;

            adecuacion = Math.round(precioVigente * rem.aplicado * variacion * 10000) / 10000;

            if (aplicarAnticipo) {
                precioRedeterminado = Math.round((precioBase * anticipo + precioBase * factorRedondeado * (1 - anticipo)) * 10000) / 10000;
                precioProvisorio = Math.round((precioBase * anticipo + precioBase * factorProvisorio * (1 - anticipo)) * 10000) / 10000;
                adecuacion = Math.round(adecuacion * (1 - anticipo) * 10000) / 10000;
            } else {
                precioRedeterminado = Math.round(Math.round(precioBase * 10000) * Math.round(factorRedondeado * 10000) / 10000) / 10000;
                precioProvisorio = Math.round(Math.round(precioBase * 10000) * Math.round(factorProvisorio * 10000) / 10000) / 10000;
            }

            const precioProvAnterior = detalleAnterior?.precioProvisorio ?? item.precio;
            ajusteOC = Math.round((cv * rem.aplicado * (precioProvisorio - precioProvAnterior) + (cv - cv) * precioProvAnterior) * 10000) / 10000;
            saldoReintegro = Math.round((adecuacion - ajusteOC) * 10000) / 10000;
        }
        total += adecuacion;
        return {
            itemId: item.id,
            nombre: item.nombre,
            precioVigente,
            precioRedeterminado,
            precioProvisorio,
            remTeorico: rem.teorico,
            remReal: rem.real,
            remAplicado: rem.aplicado,
            nota: rem.nota,
            factor,
            adecuacion,
            ajusteOC,
            saldoReintegro
        };
    });

    state.adecuaciones.push({
        periodo,
        empresaPidio,
        decreto1082,
        superaGatillo,
        procede,
        iopBase: iopBaseVal,
        iopActual: iopActualVal,
        basePeriodo,
        periodoCalculo,
        factor: factorGlobal,
        total,
        detalle
    });

    save();
    closeModal('modal-nueva-adec');
    renderAdecuaciones();
}

function eliminarAdecuacion(ref) {
    const periodo = typeof ref === 'string' ? ref : [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo))[ref]?.periodo;
    if (!periodo) return;
    state.adecuaciones = state.adecuaciones.filter(x => x.periodo !== periodo);
    save();
    renderAdecuaciones();
}

function exportarAdecuacion() {
    const sorted = [...state.adecuaciones].sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (!sorted.length) return alert('Sin adecuaciones calculadas.');
    const a = sorted[sorted.length - 1];

    const wb = XLSX.utils.book_new();

    // ── HOJA 1: ENCABEZADO + DETALLE ──
    const totalAjusteOC = (a.detalle || []).reduce((s, d) => s + (d.ajusteOC ?? 0), 0);
    const totalSaldo = (a.detalle || []).reduce((s, d) => s + (d.saldoReintegro ?? 0), 0);

    const aoa = [
        [`ADECUACIÓN PROVISORIA — ${periodoLabel(a.periodo)}`],
        [],
        ['Obra:', state.obra.nombre || '—'],
        ['Expediente:', state.obra.expediente || '—'],
        ['Contratista:', state.obra.contratista || '—'],
        ['Período base:', a.basePeriodo ? periodoLabel(a.basePeriodo) : '—'],
        ['Factor global:', a.factor != null ? +a.factor.toFixed(4) : '—'],
        [],
        ['Ítem', 'Precio vigente', 'Rem. teórico', 'Rem. real', 'Rem. aplicado',
            'Factor IOP', 'Monto redeterminado', 'Ajuste OC', 'Saldo reintegro'],
        ...(a.detalle || []).map(d => [
            d.nombre,
            d.precioVigente,
            d.remTeorico,
            d.remReal,
            d.remAplicado,
            d.factor != null ? +d.factor.toFixed(4) : '',
            d.adecuacion ?? 0,
            d.ajusteOC ?? 0,
            d.saldoReintegro ?? 0
        ]),
        [],
        ['TOTAL', '', '', '', '', '',
            a.total ?? 0,
            totalAjusteOC,
            totalSaldo
        ]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const dataStartRow = 9; // fila 1-indexed donde empieza el header de columnas
    const dataEndRow = dataStartRow + (a.detalle || []).length;

    // Formatos numéricos
    const fmtPeso = '"$"#,##0.00';
    const fmtPct = '0.00%';
    const fmtFact = '0.0000';

    for (let r = dataStartRow; r <= dataEndRow + 1; r++) {
        // B = precio vigente, G = monto redet, H = ajuste OC, I = saldo
        ['B', 'G', 'H', 'I'].forEach(col => {
            const cell = ws[`${col}${r}`];
            if (cell) cell.z = fmtPeso;
        });
        // C D E = remanentes
        ['C', 'D', 'E'].forEach(col => {
            const cell = ws[`${col}${r}`];
            if (cell) cell.z = fmtPct;
        });
        // F = factor
        const cellF = ws[`F${r}`];
        if (cellF) cellF.z = fmtFact;
    }

    ws['!cols'] = [
        { wch: 52 }, // Ítem
        { wch: 16 }, // Precio vigente
        { wch: 13 }, // Rem teórico
        { wch: 13 }, // Rem real
        { wch: 14 }, // Rem aplicado
        { wch: 11 }, // Factor
        { wch: 19 }, // Monto redet
        { wch: 14 }, // Ajuste OC
        { wch: 16 }, // Saldo reintegro
    ];

    // Freeze encabezado de tabla
    ws['!freeze'] = { xSplit: 0, ySplit: dataStartRow };

    XLSX.utils.book_append_sheet(wb, ws, `Adec. ${periodoLabel(a.periodo)}`);

    // ── HOJA 2: RESUMEN ACUMULADO ──
    const aoas = [
        ['RESUMEN ACUMULADO DE ADECUACIONES'],
        [],
        ['Obra:', state.obra.nombre || '—'],
        [],
        ['N°', 'Período', 'Base activa', 'Factor global', 'Ajuste OC', 'Saldo reintegro', 'Procede']
    ];
    sorted.forEach((adec, idx) => {
        const ajusteTotal = (adec.detalle || []).reduce((s, d) => s + (d.ajusteOC ?? 0), 0);
        const saldoTotal = (adec.detalle || []).reduce((s, d) => s + (d.saldoReintegro ?? 0), 0);
        aoas.push([
            idx + 1,
            periodoLabel(adec.periodo),
            adec.basePeriodo ? periodoLabel(adec.basePeriodo) : '—',
            adec.factor != null ? +adec.factor.toFixed(4) : '—',
            adec.procede ? ajusteTotal : 0,
            adec.procede ? saldoTotal : 0,
            adec.procede ? 'Sí' : 'No'
        ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(aoas);
    ws2['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 13 },
        { wch: 16 }, { wch: 16 }, { wch: 8 }
    ];

    // Formato moneda columnas E y F desde fila 6
    for (let r = 6; r <= 5 + sorted.length; r++) {
        ['E', 'F'].forEach(col => {
            const cell = ws2[`${col}${r}`];
            if (cell) cell.z = '"$"#,##0.00';
        });
    }

    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    XLSX.writeFile(wb, `adecuacion_${a.periodo}_${(state.obra.nombre || 'obra').replace(/\s+/g, '_')}.xlsx`);
}