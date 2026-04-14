const PLANTILLA_NOMBRE = 'plantilla_items.xlsx';

function descargarPlantilla() {
    // Genera la URL del archivo que vas a servir desde la carpeta raíz del proyecto
    const a = document.createElement('a');
    a.href = 'plantilla_items.xlsx';
    a.download = PLANTILLA_NOMBRE;
    a.click();
}

// ═══════════════════════════════════════════════
// ITEMS
// ═══════════════════════════════════════════════
let factoresTemp = [];

function renderItems() {
    const tbody = document.getElementById('items-tbody');
    const empty = document.getElementById('items-empty');
    if (!state.items.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = state.items.map(item => {
        const total = item.cantidad * item.precio;
        const factCount = item.factores ? item.factores.length : 0;
        const factSum = item.factores ? item.factores.reduce((s, f) => s + f.peso, 0) : 0;
        const factOk = factSum === 100;
        return `<tr>
      <td style="font-weight:500">${item.nombre}</td>
      <td class="num">${item.unidad}</td>
      <td class="num">${item.cantidad}</td>
      <td class="num">${fmt$(item.precio)}</td>
      <td class="num fw6">${fmt$(total)}</td>
      <td>
        <button class="btn btn-sm" onclick="verEstructura(${item.id})">
          ${factCount} factor${factCount !== 1 ? 'es' : ''} ${factOk ? '<span class="tag tag-ok" style="font-size:10px;padding:1px 5px">100%</span>' : '<span class="tag tag-warn" style="font-size:10px;padding:1px 5px">' + (factSum) + '%</span>'}
        </button>
      </td>
      <td><button class="btn btn-sm btn-danger" onclick="eliminarItem(${item.id})">Eliminar</button></td>
    </tr>`;
    }).join('');
}

function agregarFactor() {
    factoresTemp.push({ nombre: '', peso: 0 });
    renderFactoresForm();
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
    el.textContent = total.toFixed(1) + '%';
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
    populateItemSelects();
}
function eliminarItem(id) {
    if (!confirm('¿Eliminás este ítem y todos sus datos asociados?')) return;
    state.items = state.items.filter(i => i.id !== id);
    state.versiones = state.versiones.filter(v => v.itemId !== id);
    state.plan = state.plan.filter(p => p.itemId !== id);
    state.real = state.real.filter(r => r.itemId !== id);
    save(); renderItems(); populateItemSelects();
}
function verEstructura(id) {
    const item = state.items.find(i => i.id === id);
    document.getElementById('ver-estructura-titulo').textContent = 'Estructura — ' + item.nombre;
    const tbody = document.getElementById('ver-estructura-tbody');
    if (!item.factores || !item.factores.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3)">Sin factores definidos</td></tr>';
    } else {
        // En verEstructura(), reemplazá la línea del tbody:
        tbody.innerHTML = item.factores.map(f =>
            `<tr>
    <td>${f.nro ? f.nro + ' — ' : ''}${f.nombre}</td>
    <td class="num">${f.peso}%</td>
    <td>IOP Córdoba</td>
  </tr>`
        ).join('');
    }
    openModal('modal-ver-estructura');
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

            const conFactores = nuevos.filter(i => i.factores.length > 0).length;
            alert(`✓ ${nuevos.length} ítem${nuevos.length !== 1 ? 's' : ''} importado${nuevos.length !== 1 ? 's' : ''} correctamente.\n${conFactores} con estructura de costos definida.`);

        } catch (err) {
            alert('Error al leer el archivo: ' + err.message);
        }
        input.value = '';
    };
    reader.readAsArrayBuffer(file);
}