// ═══════════════════════════════════════════════
// MODIFICACIONES DE OBRA
// ═══════════════════════════════════════════════

let _modActivaId = null;

function nuevaModificacion() {
    document.getElementById('mod-nombre').value = '';
    document.getElementById('mod-periodo').value = '';
    openModal('modal-nueva-mod');
}

function crearModificacion() {
    const nombre = document.getElementById('mod-nombre').value.trim();
    const periodo = document.getElementById('mod-periodo').value;
    if (!nombre) return alert('El nombre es obligatorio.');
    if (!periodo) return alert('El período de aplicación es obligatorio.');

    const nueva = {
        id: Date.now(),
        nombre,
        periodo,
        items: []
    };
    state.modificaciones.push(nueva);
    save();
    closeModal('modal-nueva-mod');
    renderVersiones();
    abrirDetalleMod(nueva.id);
}

function abrirDetalleMod(id) {
    _modActivaId = id;
    const mod = state.modificaciones.find(m => m.id === id);
    if (!mod) return;
    document.getElementById('modal-detalle-mod-title').textContent =
        `${mod.nombre} — ${periodoLabel(mod.periodo)}`;
    // Poblar select de ítems base
    const sel = document.getElementById('mod-item-base-select');
    sel.innerHTML = state.items.map(i =>
        `<option value="${i.id}">${i.nombre}</option>`
    ).join('');
    // Reset tipo
    document.getElementById('mod-item-tipo').value = 'existente';
    toggleModItemTipo();
    renderDetalleModTabla(mod);
    openModal('modal-detalle-mod');
}

function toggleModItemTipo() {
    const tipo = document.getElementById('mod-item-tipo').value;
    document.getElementById('mod-item-existente-fields').style.display = tipo === 'existente' ? '' : 'none';
    document.getElementById('mod-item-nuevo-fields').style.display = tipo === 'nuevo' ? '' : 'none';
}

function agregarItemMod() {
    const mod = state.modificaciones.find(m => m.id === _modActivaId);
    if (!mod) return;
    const tipo = document.getElementById('mod-item-tipo').value;

    if (tipo === 'existente') {
        const itemIdBase = Number(document.getElementById('mod-item-base-select').value);
        const delta = parseFloat(document.getElementById('mod-item-delta').value);
        if (isNaN(delta) || delta === 0) return alert('Ingresá una cantidad distinta de 0.');
        const item = state.items.find(i => i.id === itemIdBase);
        if (!item) return;

        // Validar economía no supere lo ejecutado
        if (delta < 0) {
            const [anio, mes] = mod.periodo.split('-').map(Number);
            const mesAnterior = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`;
            const ejecutado = typeof acumReal === 'function' ? acumReal(itemIdBase, mesAnterior) : 0;
            const cantResultante = item.cantidad + delta;
            if (cantResultante < ejecutado) return alert(`No podés reducir más de lo ejecutado (${ejecutado} ${item.unidad}).`);
        }

        // Verificar si ya existe un cambio para este ítem en esta modificación
        const yaExiste = mod.items.find(i => i.itemIdBase === itemIdBase);
        if (yaExiste) return alert('Ya existe un cambio para este ítem en esta modificación. Eliminalo primero.');

        mod.items.push({
            id: Date.now(),
            itemIdBase,
            nombre: item.nombre,
            unidad: item.unidad,
            cantidad: Math.round(delta * 10000) / 10000,
            precio: item.precio,
            precioOficial: item.precioOficial || 0,
            factores: item.factores || [],
            esNuevo: false
        });
    } else {
        const nombre = document.getElementById('mod-item-nuevo-nombre').value.trim();
        const unidad = document.getElementById('mod-item-nuevo-unidad').value.trim();
        const cantidad = parseFloat(document.getElementById('mod-item-nuevo-cantidad').value);
        const precio = parseFloat(document.getElementById('mod-item-nuevo-precio').value);
        if (!nombre) return alert('El nombre es obligatorio.');
        if (isNaN(cantidad) || cantidad <= 0) return alert('La cantidad debe ser mayor a 0.');
        if (isNaN(precio) || precio <= 0) return alert('El precio es obligatorio.');

        mod.items.push({
            id: Date.now(),
            itemIdBase: null,
            nombre,
            unidad: unidad || 'gl',
            cantidad: Math.round(cantidad * 10000) / 10000,
            precio: Math.round(precio * 10000) / 10000,
            precioOficial: 0,
            factores: [],
            esNuevo: true
        });
    }

    save();
    renderDetalleModTabla(mod);
    // Limpiar campos
    document.getElementById('mod-item-delta').value = '';
    document.getElementById('mod-item-nuevo-nombre').value = '';
    document.getElementById('mod-item-nuevo-unidad').value = '';
    document.getElementById('mod-item-nuevo-cantidad').value = '';
    document.getElementById('mod-item-nuevo-precio').value = '';
}

function eliminarItemMod(itemId) {
    const mod = state.modificaciones.find(m => m.id === _modActivaId);
    if (!mod) return;
    mod.items = mod.items.filter(i => i.id !== itemId);
    save();
    renderDetalleModTabla(mod);
}

function eliminarModificacion() {
    if (!confirm('¿Eliminás esta modificación? Se perderán todos sus ítems.')) return;
    state.modificaciones = state.modificaciones.filter(m => m.id !== _modActivaId);
    _modActivaId = null;
    save();
    closeModal('modal-detalle-mod');
    renderVersiones();
}

function renderDetalleModTabla(mod) {
    const tbody = document.getElementById('mod-detalle-tbody');
    const empty = document.getElementById('mod-detalle-empty');
    if (!mod.items.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = mod.items.map(i => {
        const itemBase = i.itemIdBase ? state.items.find(b => b.id === i.itemIdBase) : null;
        const cantOriginal = itemBase ? itemBase.cantidad : '—';
        const cantResultante = itemBase ? Math.round((itemBase.cantidad + i.cantidad) * 10000) / 10000 : i.cantidad;
        const tipo = i.esNuevo ? 'nuevo' : (i.cantidad >= 0 ? 'demasia' : 'economia');
        const tipoLabel = i.esNuevo ? 'Nuevo' : (i.cantidad >= 0 ? 'Demasía' : 'Economía');
        const tipoClass = i.esNuevo ? 'tag-info' : (i.cantidad >= 0 ? 'tag-ok' : 'tag-no');
        return `<tr>
            <td style="font-weight:500">${i.nombre}</td>
            <td style="text-align:center">${i.unidad}</td>
            <td class="num">${i.esNuevo ? '—' : cantOriginal}</td>
            <td class="num ${i.cantidad < 0 ? 'text-danger' : 'text-ok'}">${i.cantidad > 0 ? '+' : ''}${i.cantidad}</td>
            <td class="num">${i.esNuevo ? i.cantidad : cantResultante}</td>
            <td class="num">${fmt$(i.precio)}</td>
            <td><span class="tag ${tipoClass}">${tipoLabel}</span></td>
            <td><button class="btn btn-sm btn-danger" onclick="eliminarItemMod(${i.id})">✕</button></td>
        </tr>`;
    }).join('');
}

function renderVersiones() {
    const container = document.getElementById('mods-list');
    const empty = document.getElementById('mods-empty');
    if (!state.modificaciones.length) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    container.innerHTML = state.modificaciones
        .sort((a, b) => a.periodo.localeCompare(b.periodo))
        .map(mod => {
            const demasias = mod.items.filter(i => !i.esNuevo && i.cantidad > 0).length;
            const economias = mod.items.filter(i => !i.esNuevo && i.cantidad < 0).length;
            const nuevos = mod.items.filter(i => i.esNuevo).length;
            const itemsMod = mod.items.filter(i => i.esNuevo || i.cantidad > 0);

            // Tabla plan
            const planMod = (state.planMod || []).filter(p => p.modId === mod.id);
            const periodosP = [...new Set(planMod.map(p => p.periodo))].sort();
            const tablaPlan = itemsMod.length && planMod.length ? `
                <div style="overflow-x:auto;margin-top:8px">
                    <table style="font-size:12px">
                        <thead><tr>
                            <th style="position:sticky;left:0;background:var(--surface2)">Ítem</th>
                            <th>Cant.</th>
                            ${periodosP.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
                            <th>Total</th><th>%</th>
                        </tr></thead>
                        <tbody>
                        ${itemsMod.map(item => {
                const cells = periodosP.map(p => {
                    const r = planMod.find(r => r.itemId === item.id && r.periodo === p);
                    return `<td class="num">${r ? r.cantidad : '—'}</td>`;
                }).join('');
                const total = planMod.filter(r => r.itemId === item.id).reduce((s, r) => s + r.cantidad, 0);
                const pct = item.cantidad > 0 ? (total / item.cantidad * 100).toFixed(1) + '%' : '—';
                return `<tr>
                                <td style="position:sticky;left:0;background:var(--surface2);font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.nombre}</td>
                                <td class="num">${item.cantidad}</td>
                                ${cells}
                                <td class="num fw6">${total}</td>
                                <td class="num">${pct}</td>
                            </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>` : `<div style="font-size:12px;color:var(--text3);padding:6px 0">Sin plan cargado</div>`;

            // Tabla real
            const realMod = (state.realMod || []).filter(r => r.modId === mod.id);
            const periodosR = [...new Set(realMod.map(r => r.periodo))].sort();
            const tablaReal = itemsMod.length && realMod.length ? `
                <div style="overflow-x:auto;margin-top:8px">
                    <table style="font-size:12px">
                        <thead><tr>
                            <th style="position:sticky;left:0;background:var(--surface2)">Ítem</th>
                            <th>Cant.</th>
                            ${periodosR.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
                            <th>Total</th><th>%</th>
                        </tr></thead>
                        <tbody>
                        ${itemsMod.map(item => {
                const cells = periodosR.map(p => {
                    const r = realMod.find(r => r.itemId === item.id && r.periodo === p);
                    return `<td class="num">${r ? r.cantidad : '—'}</td>`;
                }).join('');
                const total = realMod.filter(r => r.itemId === item.id).reduce((s, r) => s + r.cantidad, 0);
                const pct = item.cantidad > 0 ? (total / item.cantidad * 100).toFixed(1) + '%' : '—';
                return `<tr>
                                <td style="position:sticky;left:0;background:var(--surface2);font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.nombre}</td>
                                <td class="num">${item.cantidad}</td>
                                ${cells}
                                <td class="num fw6">${total}</td>
                                <td class="num">${pct}</td>
                            </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>` : `<div style="font-size:12px;color:var(--text3);padding:6px 0">Sin avance real cargado</div>`;

            return `<div class="card" style="margin:8px 0">
                <div class="card-header" style="cursor:pointer" onclick="abrirDetalleMod(${mod.id})">
                    <div>
                        <div class="card-title" style="font-size:14px">${mod.nombre}</div>
                        <div class="card-sub">Período: ${periodoLabel(mod.periodo)}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        ${demasias ? `<span class="tag tag-ok">${demasias} demasía${demasias !== 1 ? 's' : ''}</span>` : ''}
                        ${economias ? `<span class="tag tag-no">${economias} economía${economias !== 1 ? 's' : ''}</span>` : ''}
                        ${nuevos ? `<span class="tag tag-info">${nuevos} nuevo${nuevos !== 1 ? 's' : ''}</span>` : ''}
                        <span style="font-size:18px;color:var(--text3)">✎</span>
                    </div>
                </div>
                ${itemsMod.length ? `
                <div style="padding:10px 12px;border-top:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Plan de avance</div>
                        <div style="display:flex;gap:6px">
                            <button class="btn btn-sm" onclick="event.stopPropagation();descargarPlantillaPlanMod(${mod.id})">📥 Plantilla</button>
                            <label class="btn btn-sm btn-primary" style="cursor:pointer" onclick="event.stopPropagation()">
                                📤 Importar
                                <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handlePlanModExcel(event,${mod.id})">
                            </label>
                        </div>
                    </div>
                    ${tablaPlan}
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;margin-bottom:4px">
                        <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Avance real</div>
                        <div style="display:flex;gap:6px">
                            <button class="btn btn-sm" onclick="event.stopPropagation();descargarPlantillaRealMod(${mod.id})">📥 Plantilla</button>
                            <label class="btn btn-sm btn-primary" style="cursor:pointer" onclick="event.stopPropagation()">
                                📤 Importar
                                <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleRealModExcel(event,${mod.id})">
                            </label>
                        </div>
                    </div>
                    ${tablaReal}
                </div>` : ''}
            </div>`;
        }).join('');
}

function procesarPlanModExcel(data, modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    if (!mod) return;

    // Solo ítems con demasía (cantidad > 0, no economías)
    const itemsMod = mod.items.filter(i => !i.esNuevo && i.cantidad > 0);
    const itemsNuevos = mod.items.filter(i => i.esNuevo);
    const todosItems = [...itemsMod, ...itemsNuevos];

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
        // Buscar en ítems de la modificación
        const itemMod = todosItems.find(i => i.nombre.trim() === nombreFila);
        if (!itemMod) { errores.push(nombreFila); return; }

        columnasMeses.forEach((col, idx) => {
            const cantidad = parseFloat(fila[3 + idx]);
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
            nuevasPlan.push({ modId, itemId: itemMod.id, periodo, cantidad });
        });
    });

    if (errores.length) {
        alert(`Atención: estos ítems no coinciden y fueron ignorados:\n${errores.join('\n')}`);
    }
    if (!nuevasPlan.length) return alert('No se encontraron datos de plan.');

    // Reemplazar plan de los ítems importados
    const itemsImportados = new Set(nuevasPlan.map(p => p.itemId));
    state.planMod = state.planMod.filter(p => !(p.modId === modId && itemsImportados.has(p.itemId)));
    nuevasPlan.forEach(np => state.planMod.push(np));

    save();
    alert(`Plan de modificación cargado: ${nuevasPlan.length} registros.`);
    renderDetalleModTabla(mod);
}

function handlePlanModExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['Plan'] || wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        procesarPlanModExcel(rows, _modActivaId);
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function descargarPlantillaPlanMod(modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    if (!mod) return;
    const itemsMod = mod.items.filter(i => i.esNuevo || i.cantidad > 0);
    if (!itemsMod.length) return alert('Esta modificación no tiene demasías ni ítems nuevos.');

    const duracionDias = state.obra.duracionDias || 0;
    const totalMeses = Math.ceil(duracionDias / 30);
    if (!totalMeses || totalMeses < 1) return alert('La obra no tiene duración cargada.');

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

    const header = ['Ítem', 'Unidad', 'Cantidad', ...columnasMeses, 'Total plan', '% completado'];
    const filas = itemsMod.map((item, idx) => {
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
    for (let r = 1; r <= itemsMod.length; r++) {
        const celda = `${colLetra(colPct)}${r + 1}`;
        if (ws[celda]) ws[celda].z = '0.0%';
    }
    ws['!cols'] = [
        { wch: 35 }, { wch: 10 }, { wch: 12 },
        ...columnasMeses.map(() => ({ wch: 13 })),
        { wch: 13 }, { wch: 14 }
    ];
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Avance');
    XLSX.writeFile(wb, `plan_mod_${mod.nombre.replace(/\s+/g, '_')}.xlsx`);
}

function handlePlanModExcel(event, modId) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['Plan de Avance'] || wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        procesarPlanModExcel(rows, modId);
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function switchTabMod(tabId, btn) {
    document.querySelectorAll('#modal-detalle-mod .tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#modal-detalle-mod .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
    if (tabId === 'mod-tab-plan') renderPlanModTabla(_modActivaId);
    if (tabId === 'mod-tab-real') renderRealModTabla(_modActivaId);
}

function renderPlanModTabla(modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    const thead = document.getElementById('mod-plan-thead');
    const tbody = document.getElementById('mod-plan-tbody');
    const empty = document.getElementById('mod-plan-empty');

    const itemsMod = (mod?.items || []).filter(i => i.esNuevo || i.cantidad > 0);
    if (!itemsMod.length) {
        thead.innerHTML = ''; tbody.innerHTML = '';
        empty.style.display = 'block'; return;
    }

    const planMod = (state.planMod || []).filter(p => p.modId === modId);
    if (!planMod.length) {
        thead.innerHTML = ''; tbody.innerHTML = '';
        empty.style.display = 'block'; return;
    }

    empty.style.display = 'none';
    const periodos = [...new Set(planMod.map(p => p.periodo))].sort();

    thead.innerHTML = `<tr>
        <th style="position:sticky;left:0;background:var(--surface)">Ítem</th>
        <th>Cantidad</th>
        ${periodos.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
        <th>Total</th>
        <th>%</th>
    </tr>`;

    tbody.innerHTML = itemsMod.map(item => {
        const cells = periodos.map(p => {
            const reg = planMod.find(r => r.itemId === item.id && r.periodo === p);
            return `<td class="num">${reg ? reg.cantidad : '—'}</td>`;
        }).join('');
        const total = planMod.filter(r => r.itemId === item.id).reduce((s, r) => s + r.cantidad, 0);
        const pct = item.cantidad > 0 ? (total / item.cantidad * 100).toFixed(1) + '%' : '—';
        return `<tr>
            <td style="position:sticky;left:0;background:var(--surface);font-weight:500">${item.nombre}</td>
            <td class="num">${item.cantidad}</td>
            ${cells}
            <td class="num fw6">${total}</td>
            <td class="num">${pct}</td>
        </tr>`;
    }).join('');
}

function renderRealModTabla(modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    const thead = document.getElementById('mod-real-thead');
    const tbody = document.getElementById('mod-real-tbody');
    const empty = document.getElementById('mod-real-empty');

    const itemsMod = (mod?.items || []).filter(i => i.esNuevo || i.cantidad > 0);
    if (!itemsMod.length) {
        thead.innerHTML = ''; tbody.innerHTML = '';
        empty.style.display = 'block'; return;
    }

    const realMod = (state.realMod || []).filter(r => r.modId === modId);
    if (!realMod.length) {
        thead.innerHTML = ''; tbody.innerHTML = '';
        empty.style.display = 'block'; return;
    }

    empty.style.display = 'none';
    const periodos = [...new Set(realMod.map(r => r.periodo))].sort();

    thead.innerHTML = `<tr>
        <th style="position:sticky;left:0;background:var(--surface)">Ítem</th>
        <th>Cantidad</th>
        ${periodos.map(p => `<th>${periodoLabel(p)}</th>`).join('')}
        <th>Total</th>
        <th>%</th>
    </tr>`;

    tbody.innerHTML = itemsMod.map(item => {
        const cells = periodos.map(p => {
            const reg = realMod.find(r => r.itemId === item.id && r.periodo === p);
            return `<td class="num">${reg ? reg.cantidad : '—'}</td>`;
        }).join('');
        const total = realMod.filter(r => r.itemId === item.id).reduce((s, r) => s + r.cantidad, 0);
        const pct = item.cantidad > 0 ? (total / item.cantidad * 100).toFixed(1) + '%' : '—';
        return `<tr>
            <td style="position:sticky;left:0;background:var(--surface);font-weight:500">${item.nombre}</td>
            <td class="num">${item.cantidad}</td>
            ${cells}
            <td class="num fw6">${total}</td>
            <td class="num">${pct}</td>
        </tr>`;
    }).join('');
}

function descargarPlantillaRealMod(modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    if (!mod) return;
    const itemsMod = mod.items.filter(i => i.esNuevo || i.cantidad > 0);
    if (!itemsMod.length) return alert('Esta modificación no tiene demasías ni ítems nuevos.');

    const duracionDias = state.obra.duracionDias || 0;
    const totalMeses = Math.ceil(duracionDias / 30);
    if (!totalMeses) return alert('La obra no tiene duración cargada.');

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

    const header = ['Ítem', 'Unidad', 'Cantidad', ...columnasMeses, 'Total real'];
    const filas = itemsMod.map((item, idx) => {
        const filaExcel = idx + 2;
        function colLetra(n) {
            let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s;
        }
        const colPrimerMes = 3, colTotal = colPrimerMes + totalMeses;
        const primerCelda = `${colLetra(colPrimerMes + 1)}${filaExcel}`;
        const ultimaCelda = `${colLetra(colTotal)}${filaExcel}`;
        return [item.nombre, item.unidad, item.cantidad, ...columnasMeses.map(() => null), { f: `SUM(${primerCelda}:${ultimaCelda})` }];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);
    ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 12 }, ...columnasMeses.map(() => ({ wch: 13 })), { wch: 13 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Real');
    XLSX.writeFile(wb, `real_mod_${mod.nombre.replace(/\s+/g, '_')}.xlsx`);
}

function handleRealModExcel(event, modId) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['Real'] || wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        procesarRealModExcel(rows, modId);
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function procesarRealModExcel(data, modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    if (!mod) return;
    const itemsMod = mod.items.filter(i => i.esNuevo || i.cantidad > 0);
    const headers = data[0];
    const filas = data.slice(1).filter(f => f[0]);
    const idxTotal = headers.findIndex(h => h && String(h).toLowerCase().includes('total'));
    const colFin = idxTotal > 0 ? idxTotal : headers.length;
    const columnasMeses = headers.slice(3, colFin);
    const fechaReplanteo = state.obra.fechaReplanteo || null;
    let nuevosReal = [];
    let errores = [];

    filas.forEach(fila => {
        const nombreFila = String(fila[0] || '').trim();
        const itemMod = itemsMod.find(i => i.nombre.trim() === nombreFila);
        if (!itemMod) { errores.push(nombreFila); return; }
        columnasMeses.forEach((col, idx) => {
            const cantidad = parseFloat(fila[3 + idx]);
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
            nuevosReal.push({ modId, itemId: itemMod.id, periodo, cantidad });
        });
    });

    if (errores.length) alert(`Ítems no encontrados (ignorados):\n${errores.join('\n')}`);
    if (!nuevosReal.length) return alert('No se encontraron datos de avance real.');

    const itemsImportados = new Set(nuevosReal.map(r => r.itemId));
    if (!state.realMod) state.realMod = [];
    state.realMod = state.realMod.filter(r => !(r.modId === modId && itemsImportados.has(r.itemId)));
    nuevosReal.forEach(nr => state.realMod.push(nr));
    save();
    alert(`Avance real cargado: ${nuevosReal.length} registros.`);
    renderRealModTabla(mod.id);
}

function descargarPlantillaRealMod(modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    if (!mod) return;
    const itemsMod = mod.items.filter(i => i.esNuevo || i.cantidad > 0);
    if (!itemsMod.length) return alert('Esta modificación no tiene demasías ni ítems nuevos.');
    const duracionDias = state.obra.duracionDias || 0;
    const totalMeses = Math.ceil(duracionDias / 30);
    if (!totalMeses) return alert('La obra no tiene duración cargada.');
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
    function colLetra(n) {
        let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s;
    }
    const colPrimerMes = 3, colTotal = colPrimerMes + totalMeses;
    const header = ['Ítem', 'Unidad', 'Cantidad', ...columnasMeses, 'Total real'];
    const filas = itemsMod.map((item, idx) => {
        const filaExcel = idx + 2;
        const primerCelda = `${colLetra(colPrimerMes + 1)}${filaExcel}`;
        const ultimaCelda = `${colLetra(colTotal)}${filaExcel}`;
        return [item.nombre, item.unidad, item.cantidad, ...columnasMeses.map(() => null), { f: `SUM(${primerCelda}:${ultimaCelda})` }];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);
    ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 12 }, ...columnasMeses.map(() => ({ wch: 13 })), { wch: 13 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Real');
    XLSX.writeFile(wb, `real_mod_${mod.nombre.replace(/\s+/g, '_')}.xlsx`);
}

function handleRealModExcel(event, modId) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['Real'] || wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        procesarRealModExcel(rows, modId);
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function procesarRealModExcel(data, modId) {
    const mod = state.modificaciones.find(m => m.id === modId);
    if (!mod) return;
    const itemsMod = mod.items.filter(i => i.esNuevo || i.cantidad > 0);
    const headers = data[0];
    const filas = data.slice(1).filter(f => f[0]);
    const idxTotal = headers.findIndex(h => h && String(h).toLowerCase().includes('total'));
    const colFin = idxTotal > 0 ? idxTotal : headers.length;
    const columnasMeses = headers.slice(3, colFin);
    const fechaReplanteo = state.obra.fechaReplanteo || null;
    let nuevosReal = [], errores = [];
    filas.forEach(fila => {
        const nombreFila = String(fila[0] || '').trim();
        const itemMod = itemsMod.find(i => i.nombre.trim() === nombreFila);
        if (!itemMod) { errores.push(nombreFila); return; }
        columnasMeses.forEach((col, idx) => {
            const cantidad = parseFloat(fila[3 + idx]);
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
            nuevosReal.push({ modId, itemId: itemMod.id, periodo, cantidad });
        });
    });
    if (errores.length) alert(`Ítems no encontrados (ignorados):\n${errores.join('\n')}`);
    if (!nuevosReal.length) return alert('No se encontraron datos de avance real.');
    const itemsImportados = new Set(nuevosReal.map(r => r.itemId));
    if (!state.realMod) state.realMod = [];
    state.realMod = state.realMod.filter(r => !(r.modId === modId && itemsImportados.has(r.itemId)));
    nuevosReal.forEach(nr => state.realMod.push(nr));
    save();
    alert(`Avance real cargado: ${nuevosReal.length} registros.`);
    renderVersiones();
}