const EQUIVALENCIAS_FACTORES = {
    'equipo - amortizacion de equipos': 'Equipo - Amort. Equipo',
    'equipo - amort. equipo': 'Equipo - Amort. Equipo',
    'sustancias plasticas y elastomeros': 'Sust. plásticas y elastómeros',
    'sust. plasticas y elastomeros': 'Sust. plásticas y elastómeros',
    'instlaciones electricas': 'Instalaciones eléctricas',
    'instalaciones electricas': 'Instalaciones eléctricas',
    'albanileria': 'Albañilería',
    'aridos': 'Áridos',
    'aridos triturados': 'Áridos Triturados',
    'aisladores, morseteria y herrajes': 'Aisl. mors. herrajes',
    'aisladores morseteria y herrajes': 'Aisl. mors. herrajes',
    'gastos generales': 'Gastos generales',
    'gastos varios': 'Gastos varios',
    'mano de obra': 'Mano de obra',
    'carpinteria': 'Carpintería',
    'instalaciones de gas': 'Instalaciones de gas',
    'instalaciones sanitarias': 'Instalaciones sanitarias',
    'carpinteria de aluminio': 'Carpintería de Aluminio',
    'carpinteria de madera': 'Carpintería de Madera',
    'productos de plastico': 'Productos de plástico',
    'productos quimicos': 'Productos químicos',
    'pintura termoplastica reflectante': 'Pintura termoplástica reflectante',
};

function normalizar(s) {
    return String(s).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function switchTabEstructura(tabId, btn) {
    document.querySelectorAll('#screen-estructura .tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#screen-estructura .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function descargarPlantillaOficial() {
    const wb = XLSX.utils.book_new();
    const aoa = [
        ['N°', 'Designación', 'Unidad', 'Cantidad', 'Precio unitario ($)', 'Subtotal ($)']
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Agregar 200 filas con fórmulas
    for (let i = 2; i <= 201; i++) {
        ws[`A${i}`] = { f: `IF(B${i}<>"",ROW()-1,"")` };
        ws[`F${i}`] = { f: `IF(D${i}<>"",D${i}*E${i},"")` };
    }
    ws['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
    XLSX.writeFile(wb, 'plantilla_presupuesto_oficial.xlsx');
}

function descargarPlantillaOferta() {
    if (!state.items.length) return alert('Primero importá el presupuesto oficial.');
    const wb = XLSX.utils.book_new();
    const aoa = [
        ['N°', 'Designación', 'Unidad', 'Cantidad', 'Precio unitario ($)', 'Subtotal ($)'],
        ...state.items.map((item, idx) => [
            item.nro || idx + 1,
            item.nombre,
            item.unidad,
            item.cantidad,
            '',
            { f: `IF(E${idx + 2}<>"",D${idx + 2}*E${idx + 2},"")` }
        ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
    XLSX.writeFile(wb, 'plantilla_oferta.xlsx');
}

function descargarPlantillaEstructura() {
    const a = document.createElement('a');
    a.href = 'plantilla_items.xlsx';
    a.download = 'plantilla_estructura.xlsx';
    a.click();
}

function importarOficialExcel(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets['Presupuesto'] || wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
            let headerIdx = -1, colDesig = -1, colUnidad = -1, colCantidad = -1, colPrecio = -1;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                for (let j = 0; j < row.length; j++) {
                    const val = row[j] ? String(row[j]).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
                    if (val === 'designacion') { headerIdx = i; colDesig = j; }
                    if (val === 'unidad') colUnidad = j;
                    if (val === 'cantidad') colCantidad = j;
                    const variantesPrecio = ['precio unitario', 'precio unit.', 'precio', 'p.u.', 'p.unitario', 'monto unitario', 'unitario'];
                    if (variantesPrecio.some(v => val.includes(v))) colPrecio = j;
                }
                if (headerIdx === i) break;
            }
            if (headerIdx === -1) return alert('No se encontró la columna "Designación". Verificá la plantilla.');
            const nuevos = [];
            let nro = 1;
            for (let i = headerIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                const nombre = row[colDesig] ? String(row[colDesig]).trim() : '';
                if (!nombre) continue;
                const unidad = colUnidad >= 0 && row[colUnidad] ? String(row[colUnidad]).trim() : 'gl';
                const cantidad = colCantidad >= 0 ? parseFloat(row[colCantidad]) || 0 : 0;
                const precioOficial = colPrecio >= 0 ? limpiarNumeroExcel(row[colPrecio]) : 0;
                nuevos.push({
                    id: state.nextId++,
                    nro: nro++,
                    nombre,
                    unidad,
                    cantidad: Math.round(cantidad * 10000) / 10000,
                    precio: 0,
                    precioOficial,
                    factores: []
                });
            }
            if (!nuevos.length) return alert('No se encontraron ítems válidos.');
            if (state.items.length > 0) {
                if (!confirm(`Se reemplazarán los ${state.items.length} ítems actuales. ¿Continuás?`)) return;
            }
            const idsViejos = state.items.map(i => i.id);
            state.versiones = state.versiones.filter(v => !idsViejos.includes(v.itemId));
            state.plan = state.plan.filter(p => !idsViejos.includes(p.itemId));
            state.real = state.real.filter(r => !idsViejos.includes(r.itemId));
            state.adecuaciones = [];
            state.items = nuevos;
            save();
            renderOficial();
            renderItems();
            renderOficial();
            actualizarCardEstructura();
            alert(`✓ ${nuevos.length} ítems importados del presupuesto oficial.`);
        } catch (err) {
            alert('Error al leer el archivo: ' + err.message);
        }
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function renderOficial() {
    const tbody = document.getElementById('oficial-tbody');
    const empty = document.getElementById('oficial-empty');
    if (!state.items.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    const totalOficial = state.items.reduce((s, i) => s + i.cantidad * (i.precioOficial || 0), 0);
    const totalOficialEl = document.getElementById('total-oficial-items');
    if (totalOficialEl) totalOficialEl.textContent = fmt$(totalOficial);
    tbody.innerHTML = state.items.map(item => {
        const total = item.cantidad * (item.precioOficial || 0);
        return `<tr>
            <td style="text-align:center;color:var(--text2)">${item.nro || ''}</td>
            <td style="font-weight:500">${item.nombre}</td>
            <td style="text-align:center;color:var(--text2)">${item.unidad}</td>
            <td style="text-align:center">${item.cantidad}</td>
            <td class="num">${fmt$(item.precioOficial || 0)}</td>
            <td class="num fw6">${fmt$(total)}</td>
        </tr>`;
    }).join('');
}

function importarPolinomica(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        if (!rows.length) return alert('Archivo vacío.');

        const header = rows[0];
        // col 0=Nº, col 1=Factor, col 2+ = items
        const itemNames = header.slice(2).map(v => v ? String(v).trim() : null);
        const factorRows = rows.slice(1).filter(r => r[1] != null);

        let actualizados = 0;
        let noEncontrados = [];

        state.items.forEach(item => {
            const colIdx = itemNames.findIndex(n => n && normalizar(n) === normalizar(item.nombre));
            if (colIdx === -1) { noEncontrados.push(item.nombre); return; }
            const colReal = colIdx + 2; // offset por Nº y Factor

            const factores = [];
            factorRows.forEach(row => {
                const nombreFactor = row[1] ? String(row[1]).trim() : null;
                const val = row[colReal];
                if (!nombreFactor || val == null || val === 0) return;
                // Buscar en LISTA_FACTORES por nombre normalizado
                const factorNorm = normalizar(nombreFactor);
                const nombreEnLista = window.LISTA_FACTORES.find(f => normalizar(f) === factorNorm)
                    || EQUIVALENCIAS_FACTORES[factorNorm]
                    || null;
                if (!nombreEnLista) return;
                const peso = typeof val === 'number' ? (val <= 1 ? val * 100 : val) : parseFloat(val);
                if (!isNaN(peso) && peso > 0) {
                    factores.push({ nombre: nombreEnLista, peso: Math.round(peso * 10000) / 10000 });
                }
            });

            if (factores.length) {
                item.factores = factores;
                actualizados++;
            }
        });

        input.value = '';
        save();
        renderItems();
        renderOficial();

        let msg = `Polinómica importada: ${actualizados} ítems actualizados.`;
        if (noEncontrados.length) msg += `\n\nNo encontrados:\n${noEncontrados.join('\n')}`;
        alert(msg);
    };
    reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════
// ITEMS
// ═══════════════════════════════════════════════
let factoresTemp = [];

function renderItems() {
    const tbody = document.getElementById('items-tbody');
    const empty = document.getElementById('items-empty');

    // Si no hay ítems
    if (!state.items.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        // Ponemos el total en 0
        const totalOfertaEl = document.getElementById('total-oferta-items');
        if (totalOfertaEl) totalOfertaEl.textContent = fmt$(0);
        return;
    }

    empty.style.display = 'none';

    let acumuladoTotal = 0; // Variable para sumar todo
    const totalOferta = state.items.reduce((acc, item) => {
        return acc + (item.cantidad * item.precio);
    }, 0);
    const totalOficial = state.items.reduce((acc, item) => acc + (item.cantidad * (item.precioOficial || 0)), 0);

    tbody.innerHTML = state.items.map(item => {
        const total = (item.cantidad || 0) * (item.precio || 0);
        acumuladoTotal += total; // Sumamos al acumulador
        const montoOficial = item.cantidad * (item.precioOficial || 0);
        const incidencia = totalOficial > 0 ? (montoOficial / totalOficial) * 100 : 0;
        const tieneFactores = item.factores && item.factores.length > 0;
        const factCount = item.factores ? item.factores.length : 0;
        const factSum = Math.round(item.factores.reduce((s, f) => s + f.peso, 0) * 100) / 100;
        const factOk = factSum === 100;

        return `<tr>
            <td style="text-align:center;color:var(--text2)">${item.nro || ''}</td>
            <td style="font-weight:500">${item.nombre}</td>
            <td style="text-align:center;color:var(--text2)">${item.unidad}</td>
            <td style="text-align:center">${item.cantidad}</td>
            <td class="num">${fmt$(item.precio)}</td>
            <td class="num fw6">${fmt$(total)}</td>
            <td class="num">${incidencia.toFixed(2)}%</td>
        </tr>`;
    }).join('');

    // ACTUALIZACIÓN DEL TOTAL EN PANTALLA
    const totalOfertaEl = document.getElementById('total-oferta-items');
    if (totalOfertaEl) {
        totalOfertaEl.textContent = fmt$(acumuladoTotal);
    }

    actualizarCardEstructura();
}

function agregarFactor() {
    factoresTemp.push({ nombre: '', peso: 0 });
    renderFactoresForm();
}

function renderFactores() {
    const item = state.items.find(i => i.id === itemIdEdicionActual);
    const tbody = document.getElementById('ver-estructura-tbody');
    const guardados = item.factores || [];

    // Inyectamos todas las filas de golpe
    tbody.innerHTML = window.LISTA_FACTORES.map((nombre, index) => {
        const existente = guardados.find(f => f.nombre === nombre);
        const valor = existente ? existente.peso : '';
        const tieneValor = valor && parseFloat(valor) > 0;

        return `
            <tr style="background-color: ${tieneValor ? '#e8f5e9' : 'transparent'};">
                <td style="font-size: 12px; padding: 4px;">
                    ${(index + 1).toString().padStart(2, '0')} - ${nombre}
                </td>
                <td style="text-align: center;">
                    <input type="number" class="input-peso" 
                        data-nombre="${nombre}" 
                        value="${valor}" 
                        placeholder="0" 
                        style="width: 60px; text-align: center;"
                        oninput="onInputFactor(this)">
                </td>
            </tr>
        `;
    }).join('');

    setTimeout(() => {
        validarSumaTotal();
    }, 0);
}

function renderFactoresForm() {
    const el = document.getElementById('factores-lista');
    el.innerHTML = factoresTemp.map((f, i) => `
    <div class="form-row" style="margin-bottom:6px">
      <div class="form-group" style="flex:2">
        <input type="text" placeholder="Ej: Mano de obra" value="${f.nombre}"
          oninput="factoresTemp[${i}].nombre=this.value">
      </div>
      <div class="form-group" style="flex:1">
        <input type="number" placeholder="%" min="0" max="100" value="${f.peso || ''}"
          oninput="factoresTemp[${i}].peso=parseFloat(this.value)||0;actualizarTotalFactores()">
      </div>
      <button class="btn btn-sm btn-danger" style="align-self:flex-end;margin-bottom:0" onclick="factoresTemp.splice(${i},1);renderFactoresForm()">×</button>
    </div>
  `).join('');
    actualizarTotalFactores();
}
function actualizarTotalFactores() {
    const total = factoresTemp.reduce((s, f) => s + f.peso, 0);
    const el = document.getElementById('factores-total');
    el.textContent = total.toFixed(2) + '%';
    el.className = 'num fw6';
    if (total === 100) el.style.color = 'var(--ok)';
    else if (total > 100) el.style.color = 'var(--danger)';
    else el.style.color = 'var(--warn)';
}
function guardarItem() {
    const nombre = document.getElementById('item-nombre').value.trim();
    const unidad = document.getElementById('item-unidad').value.trim();
    const cantidad = parseFloat(document.getElementById('item-cantidad').value);
    const precio = parseFloat(document.getElementById('item-precio').value);
    if (!nombre || isNaN(cantidad) || isNaN(precio)) return alert('Completá todos los campos');
    const suma = factoresTemp.reduce((s, f) => s + f.peso, 0);
    if (factoresTemp.length && Math.abs(suma - 100) > 0.01) return alert('Los factores deben sumar 100%');
    state.items.push({ id: state.nextId++, nombre, unidad, cantidad, precio, factores: [...factoresTemp] });
    save();
    closeModal('modal-nuevo-item');
    document.getElementById('item-nombre').value = '';
    document.getElementById('item-unidad').value = '';
    document.getElementById('item-cantidad').value = '';
    document.getElementById('item-precio').value = '';
    factoresTemp = [];
    document.getElementById('factores-lista').innerHTML = '';
    renderItems();
    renderOficial();
    populateItemSelects();
}
function eliminarItem(id) {
    if (!confirm('¿Eliminás este ítem y todos sus datos asociados?')) return;
    state.items = state.items.filter(i => i.id !== id);
    state.versiones = state.versiones.filter(v => v.itemId !== id);
    state.plan = state.plan.filter(p => p.itemId !== id);
    state.real = state.real.filter(r => r.itemId !== id);
    save();
    renderItems();
    renderOficial();
    populateItemSelects();
}

async function agregarFactorAlItem() {
    const nombreSelect = document.getElementById('nuevo-factor-nombre');
    const pesoInput = document.getElementById('nuevo-factor-peso');

    const nombre = nombreSelect.value; // Ya no es .value.trim() porque viene de un combo
    const peso = parseFloat(pesoInput.value);

    // DEBUG: Si esto no sale en consola, el onclick no está llegando
    console.log("Intentando guardar:", { nombre, peso });

    if (!nombre || isNaN(peso)) {
        alert("Seleccione un factor y complete el %");
        return;
    }

    const item = state.items.find(i => i.id === itemIdEdicionActual);
    if (!item) {
        console.error("No se encontró el ítem con ID:", itemIdEdicionActual);
        return;
    }

    if (!item.factores) item.factores = [];

    item.factores.push({ nombre, peso });

    // Limpieza
    nombreSelect.value = '';
    pesoInput.value = '';

    // ¡IMPORTANTE! Asegúrate de tener estas dos funciones definidas
    renderFactores();
    await save();

    console.log("Factor guardado exitosamente");
}

function importarItemsExcel(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });

            // Detectar formato: buscar hoja con estructura conocida
            const ws800 = wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws800, { header: 1, defval: null });

            const FACTORES_MAP = {
                'ACERO': 1, 'AIREADORES': 2, 'AISL.MORS.HERRAJES': 3,
                'ALAMBRES,ALUMINIO Y CERAMICA': 4, 'ALBAÑILERIA': 5, 'ARIDOS': 6,
                'ARIDOS TRITURADOS': 7, 'ASFALTOS': 8, 'CABLE': 9,
                'CAÑOS DE PRFV': 10, 'CAÑOS PVC': 11, 'CARPINTERIA': 12,
                'CEMENTO': 13, 'COMBUSTIBLE': 14, 'ELECTROBOMBAS': 15,
                'EQUIPOS PARA PREENSAMBLADOS': 16, 'EQUIPOS': 17,
                'GASTOS GENERALES': 18, 'GASTOS VARIOS': 19, 'GAVIONES': 20,
                'HORMIGON': 21, 'INSTALACION DE GAS': 22, 'INSTALACION ELECTRICA': 23,
                'INSTALACION SANITARIA': 24, 'LAMINA REFLECTANTE': 25, 'MANO DE OBRA': 26,
                'MAQUINARIA Y MOTORES': 27, 'MEDIDORES DE CAUDAL': 28,
                'MEMBRANA GEOTEXTIL': 29, 'PINTURA': 30,
                'PINTURA TERMOPLASTICA REFLECTANTE': 31, 'PRODUCTOS DE PLASTICO': 32,
                'PRODUCTOS QUIMICOS': 33, 'SUST. PLASTICAS Y ELASTOMEROS': 34,
                'TARIFA ELECTRICA': 35, 'TRABAJOS PREPARATORIOS': 36, 'TRANSPORTE': 37,
                'TUBOS DE ACERO': 38, 'VALVULAS': 39, 'VIDRIOS': 40,
                'CARP. DE ALUMINIO': 41, 'CARP. DE MADERA': 42, 'AISLADORES': 43,
                'CONDUCTORES AEREOS': 44, 'CONDUCTORES SUBTERRANEOS': 45,
                'EMPALMES Y TERMINALES': 46
            };

            // Detectar si es formato 800 (col A tiene números de ítem, col F tiene nombres de factores)
            const esFormato800 = rows.some(r =>
                r[0] === 'ITEM' && r[1] === 'DESIGNACION'
            );

            let nuevos = [];

            if (esFormato800) {
                // ── Formato Excel 800 existente ──────────────────────
                // Ítems: filas donde col A tiene número y col B tiene nombre
                // Factores: filas donde col A es null, col F=nombre, col G=nro, col H=peso
                let itemActual = null;
                let correlativo = 1;

                rows.forEach(r => {
                    const colA = r[0];
                    const colB = r[1];
                    const colC = r[2]; // null en ítems
                    const colD = r[3]; // unidad
                    const colE = r[4]; // cantidad
                    const colF = r[5]; // nombre factor
                    const colG = r[6]; // nro factor
                    const colH = r[7]; // peso como decimal (0.6)
                    const colI = r[8]; // peso como monto calculado (a ignorar)
                    const colJ = r[9]; // precio unitario

                    // Fila de ítem: col A es número, col B es string, col D es unidad
                    if (colA !== null && !isNaN(parseFloat(colA)) && typeof colB === 'string' && colB.trim() !== '') {
                        itemActual = {
                            id: state.nextId++,
                            nombre: colB.trim(),
                            unidad: colD ? String(colD).trim() : 'gl',
                            cantidad: parseFloat(colE) || 1,
                            precio: typeof colJ === 'number' ? colJ : 0,
                            factores: []
                        };
                        nuevos.push(itemActual);
                        correlativo++;
                    }
                    // Fila de factor: col A null, col F tiene nombre, col G tiene número, col H tiene peso
                    else if (itemActual && colA === null && colF && typeof colF === 'string' && colF.trim() !== '' && colH !== null && !isNaN(parseFloat(colH))) {
                        const nroDirecto = parseFloat(colG);
                        const nro = (!isNaN(nroDirecto) && nroDirecto >= 1 && nroDirecto <= 46)
                            ? nroDirecto
                            : (FACTORES_MAP[colF.trim().toUpperCase()] || null);
                        const peso = parseFloat(colH);
                        // Solo aceptar pesos decimales válidos (entre 0 y 1 exclusive)
                        if (peso > 0 && peso <= 1 && nro && nro >= 1 && nro <= 46) {
                            itemActual.factores.push({
                                nro,
                                nombre: colF.trim(),
                                peso: Math.round(peso * 100 * 100) / 100
                            });
                        }
                    }
                });


            } else {
                // ── Formato plantilla propia (hojas Items + Factores) ──
                const wsItems = wb.Sheets['Items'];
                const wsFactores = wb.Sheets['Factores'];
                if (!wsItems) return alert('No se encontró la hoja "Items". Verificá el formato del archivo.');

                const itemRows = XLSX.utils.sheet_to_json(wsItems, { defval: '' });
                const factoresRows = wsFactores ? XLSX.utils.sheet_to_json(wsFactores, { defval: '' }) : [];

                const factoresPorItem = {};
                factoresRows.forEach(r => {
                    const nombre = String(r['Ítem (de la hoja Items)'] || '').trim();
                    const nroFactor = parseFloat(r['Nro. factor']) || null;
                    const nombreFactor = String(r['Nombre del factor'] || '').trim();
                    const peso = parseFloat(r['Peso (%)']) || 0;
                    if (!nombre || !nombreFactor || !peso || !nroFactor) return;
                    if (!factoresPorItem[nombre]) factoresPorItem[nombre] = [];
                    factoresPorItem[nombre].push({ nro: nroFactor, nombre: nombreFactor, peso });
                });

                itemRows.forEach(r => {
                    const nombre = String(r['Ítem'] || '').trim();
                    const unidad = String(r['Unidad'] || '').trim();
                    const cantidad = parseFloat(r['Cantidad']) || 0;
                    const precio = parseFloat(r['Precio unitario ($)']) || 0;
                    if (!nombre) return;
                    nuevos.push({
                        id: state.nextId++,
                        nombre,
                        unidad,
                        cantidad,
                        precio,
                        factores: factoresPorItem[nombre] || []
                    });
                });
            }

            if (!nuevos.length) return alert('No se encontraron ítems válidos en el archivo.');

            // Confirmar reemplazo si ya hay ítems
            if (state.items.length > 0) {
                if (!confirm(`Se reemplazarán los ${state.items.length} ítems actuales por los ${nuevos.length} del Excel. ¿Continuás?`)) return;
            }

            // Limpiar datos dependientes de ítems anteriores
            const idsViejos = state.items.map(i => i.id);
            state.versiones = state.versiones.filter(v => !idsViejos.includes(v.itemId));
            state.plan = state.plan.filter(p => !idsViejos.includes(p.itemId));
            state.real = state.real.filter(r => !idsViejos.includes(r.itemId));

            state.items = nuevos;
            save();
            populateItemSelects();
            renderItems();
            renderOficial();

            const conFactores = nuevos.filter(i => i.factores.length > 0).length;
            alert(`✓ ${nuevos.length} ítem${nuevos.length !== 1 ? 's' : ''} importado${nuevos.length !== 1 ? 's' : ''} correctamente.\n${conFactores} con estructura de costos definida.`);

        } catch (err) {
            alert('Error al leer el archivo: ' + err.message);
        }
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function descargarPlantillaPolinomica() {
    if (!state.items.length) return alert('No hay ítems cargados.');

    const header = ['Nº', 'Factor', ...state.items.map(i => i.nombre)];
    const filas = window.LISTA_FACTORES.map((nombre, idx) => {
        return [idx + 1, nombre, ...state.items.map(() => null)];
    });

    const aoa = [header, ...filas];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
        { wch: 5 },
        { wch: 35 },
        ...state.items.map(() => ({ wch: 18 }))
    ];
    ws['!freeze'] = { xSplit: 2, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Polinómica');
    XLSX.writeFile(wb, `polinomica_${state.obra.nombre || 'obra'}.xlsx`);
}

// ═══════════════════════════════════════════════
// IMPORTAR PRESUPUESTO (plantilla oferta)
// ═══════════════════════════════════════════════
function limpiarNumeroExcel(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;

    // Convertimos a string y quitamos símbolos de moneda y puntos de miles
    let limpio = valor.toString()
        .replace(/\$/g, '')       // Quita el signo $
        .replace(/\s/g, '')       // Quita espacios
        .replace(/\./g, '')       // Quita el punto de miles (ej: 1.000 -> 1000)
        .replace(',', '.');       // Cambia la coma decimal por punto (ej: 10,50 -> 10.50)

    return parseFloat(limpio) || 0;
}

function importarPresupuesto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const wsName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'presupuesto') || wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

            let headerIdx = -1, colDesig = -1, colPrecio = -1;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                for (let j = 0; j < row.length; j++) {
                    const val = row[j] ? String(row[j]).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
                    if (val === 'designacion') { headerIdx = i; colDesig = j; }
                    const variantesPrecio = ['precio unitario', 'precio unit.', 'precio', 'p.u.', 'p.unitario', 'monto unitario', 'unitario'];
                    if (variantesPrecio.some(v => val.includes(v))) colPrecio = j;
                }
                if (headerIdx === i) break;
            }

            if (headerIdx === -1) return alert('No se encontró la columna "Designación". Verificá la plantilla.');
            if (colPrecio === -1) return alert('No se encontró la columna de precio. Verificá la plantilla.');

            function norm(s) {
                return String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }

            let actualizados = 0;
            let noEncontrados = [];

            for (let i = headerIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                const nombre = row[colDesig] ? String(row[colDesig]).trim() : '';
                if (!nombre) continue;
                const precio = colPrecio >= 0 ? limpiarNumeroExcel(row[colPrecio]) : 0;
                const item = state.items.find(it => norm(it.nombre) === norm(nombre));
                if (item) {
                    item.precio = precio;
                    actualizados++;
                } else {
                    noEncontrados.push(nombre);
                }
            }

            save();
            populateItemSelects();
            renderItems();
            renderOficial();
            actualizarCardEstructura();

            let msg = `✓ ${actualizados} ítems actualizados con precio de oferta.`;
            if (noEncontrados.length) msg += `\n\nNo encontrados (${noEncontrados.length}):\n${noEncontrados.slice(0, 10).join('\n')}${noEncontrados.length > 10 ? '\n...' : ''}`;
            alert(msg);
        } catch (err) {
            alert('Error al leer el archivo: ' + err.message);
        }
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════
// MOSTRAR / OCULTAR CARD DE ESTRUCTURA
// ═══════════════════════════════════════════════
function actualizarCardEstructura() {
    const el = document.getElementById('estructura-resumen');
    if (!el) return;
    if (!state.items.length) { el.innerHTML = ''; return; }

    const conFactores = state.items.filter(i => i.factores && i.factores.length > 0).length;
    const total = state.items.length;

    el.innerHTML = `
        <div style="font-size:13px;color:var(--text2);margin-bottom:10px">
            ${conFactores} de ${total} ítems con estructura cargada
        </div>
        <div class="tbl-wrap" style="max-height:55vh;overflow-y:auto">
            <table>
                <thead>
                    <tr>
                        <th style="text-align:center;width:40px">N°</th>
                        <th>Ítem</th>
                        <th style="text-align:center;width:120px">Estado</th>
                        <th style="text-align:center;width:80px">Factores</th>
                        <th style="text-align:center;width:80px">Suma</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.items.map(item => {
        const tiene = item.factores && item.factores.length > 0;
        const suma = tiene ? Math.round(item.factores.reduce((s, f) => s + f.peso, 0) * 100) / 100 : 0;
        const ok = Math.abs(suma - 100) < 0.01;
        return `<tr>
                            <td style="text-align:center;color:var(--text2)">${item.nro || ''}</td>
                            <td style="font-weight:500;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.nombre}</td>
                            <td style="text-align:center">
                                ${tiene
                ? ok
                    ? '<span class="tag tag-ok" style="font-size:10px">✓ Completa</span>'
                    : '<span class="tag tag-warn" style="font-size:10px">Incompleta</span>'
                : '<span class="tag tag-no" style="font-size:10px">Sin estructura</span>'
            }
                            </td>
                            <td style="text-align:center;font-size:12px">${tiene ? item.factores.length : '—'}</td>
                            <td style="text-align:center;font-size:12px;color:${ok ? 'var(--ok)' : 'var(--danger)'}">${tiene ? suma + '%' : '—'}</td>
                        </tr>`;
    }).join('')}
                </tbody>
            </table>
        </div>`;
}