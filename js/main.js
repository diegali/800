// ═══════════════════════════════════════════════
// GUARDAR OBRA
// ═══════════════════════════════════════════════
async function guardarObra() {
    const nombre = document.getElementById('obra-nombre').value.trim();
    if (!nombre) return alert('El nombre de la obra es obligatorio.');

    const datosObra = {
        nombre,
        expediente: document.getElementById('obra-expediente').value.trim(),
        fechaApertura: document.getElementById('obra-fecha-apertura').value,
        fecha: document.getElementById('obra-fecha').value,
        contratista: document.getElementById('obra-contratista').value.trim()
    };

    if (state._sinGuardar) {
        await crearNuevaObra(datosObra);
    } else {
        state.obra = { ...state.obra, ...datosObra };
        await save();
    }
    if (typeof renderSelectorObras === 'function') renderSelectorObras();
    if (typeof renderTopbarObra === 'function') renderTopbarObra();
    if (typeof renderResumen === 'function') renderResumen();
    closeModal('modal-nueva-obra');
    renderTopbarObra();
    renderSelectorObras();
}

function renderTopbarObra() {
    const el = document.getElementById('topbar-sub');
    if (el) el.textContent = (state && state.obra) ? (state.obra.nombre || '—') : '—';
}

// ═══════════════════════════════════════════════
// INIT - Control de Acceso y Login
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-login');
    if (btn) {
        btn.addEventListener('click', async () => {
            try {
                // Importación necesaria para Firebase v10
                const { signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
                await signInWithPopup(window.auth, window.googleProvider);
            } catch (e) {
                console.error("Error Login:", e);
            }
        });
    }
});

document.addEventListener("wheel", function (e) {
    if (document.activeElement.classList.contains("input-peso")) {
        e.preventDefault();
    }
}, { passive: false });