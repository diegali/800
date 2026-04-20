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
            const nItems = mod.items.length;
            const demasias = mod.items.filter(i => !i.esNuevo && i.cantidad > 0).length;
            const economias = mod.items.filter(i => !i.esNuevo && i.cantidad < 0).length;
            const nuevos = mod.items.filter(i => i.esNuevo).length;
            return `<div class="card" style="margin:8px 0;cursor:pointer" onclick="abrirDetalleMod(${mod.id})">
                <div class="card-header">
                    <div>
                        <div class="card-title" style="font-size:14px">${mod.nombre}</div>
                        <div class="card-sub">Período: ${periodoLabel(mod.periodo)} · ${nItems} cambio${nItems !== 1 ? 's' : ''}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        ${demasias ? `<span class="tag tag-ok">${demasias} demasía${demasias !== 1 ? 's' : ''}</span>` : ''}
                        ${economias ? `<span class="tag tag-no">${economias} economía${economias !== 1 ? 's' : ''}</span>` : ''}
                        ${nuevos ? `<span class="tag tag-info">${nuevos} nuevo${nuevos !== 1 ? 's' : ''}</span>` : ''}
                    </div>
                </div>
            <div style="padding:8px 12px;display:flex;gap:8px;border-top:1px solid var(--border)">
                <button class="btn btn-sm" onclick="event.stopPropagation();descargarPlantillaPlanMod(${mod.id})">📥 Plantilla plan</button>
                <label class="btn btn-sm" style="cursor:pointer" onclick="event.stopPropagation()">
                    📤 Importar plan
                    <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handlePlanModExcel(event,${mod.id})">
                </label>
            </div>
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