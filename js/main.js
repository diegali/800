// ═══════════════════════════════════════════════
// GUARDAR OBRA
// ═══════════════════════════════════════════════
function guardarObra() {
    state.obra.nombre = document.getElementById('obra-nombre').value.trim() || state.obra.nombre;
    state.obra.expediente = document.getElementById('obra-expediente').value.trim();
    state.obra.fecha = document.getElementById('obra-fecha').value;
    state.obra.contratista = document.getElementById('obra-contratista').value.trim();
    save();
    document.getElementById('topbar-sub').textContent = state.obra.nombre;
    closeModal('modal-nueva-obra');
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
populateItemSelects();
renderResumen();