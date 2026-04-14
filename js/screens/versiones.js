// ═══════════════════════════════════════════════
// VERSIONES / MODIFICACIONES
// ═══════════════════════════════════════════════
function renderVersiones() {
    populateItemSelects();
    const tbody = document.getElementById('versiones-tbody');
    const empty = document.getElementById('versiones-empty');
    if (!state.versiones.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    const sorted = [...state.versiones].sort((a, b) => b.fecha.localeCompare(a.fecha));
    tbody.innerHTML = sorted.map(v => {
        const item = state.items.find(i => i.id === v.itemId);
        if (!item) return '';
        // find previous version
        const prevVers = state.versiones
            .filter(x => x.itemId === v.itemId && x.fecha < v.fecha)
            .sort((a, b) => b.fecha.localeCompare(a.fecha));
        const cantAnterior = prevVers.length ? prevVers[0].cantidad : item.cantidad;
        const diff = v.cantidad - cantAnterior;
        const tipo = diff < 0 ? 'economia' : 'demasia';
        return `<tr>
      <td class="num">${periodoLabel(v.fecha)}</td>
      <td>${item.nombre}</td>
      <td class="num">${cantAnterior} ${item.unidad}</td>
      <td class="num">${v.cantidad} ${item.unidad}</td>
      <td class="num ${diff < 0 ? 'text-danger' : 'text-ok'}">${diff > 0 ? '+' : ''}${diff.toFixed(4)}</td>
      <td><span class="tag ${tipo === 'economia' ? 'tag-no' : 'tag-ok'}">${tipo === 'economia' ? 'Economía' : 'Demasía'}</span></td>
      <td><button class="btn btn-sm btn-danger" onclick="eliminarVersion('${v.itemId}','${v.fecha}')">Eliminar</button></td>
    </tr>`;
    }).join('');
}
function guardarVersion() {
    const itemId = parseInt(document.getElementById('mod-item-select').value);
    const fecha = document.getElementById('mod-fecha').value;
    const cantidad = parseFloat(document.getElementById('mod-cantidad').value);
    const motivo = document.getElementById('mod-motivo').value.trim();
    if (!itemId || !fecha || isNaN(cantidad)) return alert('Completá todos los campos');
    // Remove existing version for same item+fecha
    state.versiones = state.versiones.filter(v => !(v.itemId === itemId && v.fecha === fecha));
    state.versiones.push({ itemId, fecha, cantidad, motivo });
    save(); closeModal('modal-nueva-version'); renderVersiones();
}
function eliminarVersion(itemId, fecha) {
    if (!confirm('¿Eliminar esta modificación?')) return;
    state.versiones = state.versiones.filter(v => !(v.itemId == itemId && v.fecha === fecha));
    save(); renderVersiones();
}