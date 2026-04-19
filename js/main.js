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
        fechaReplanteo: document.getElementById('obra-fecha-replanteo').value,
        contratista: document.getElementById('obra-contratista').value.trim(),
        duracionDias: Number(document.getElementById('obra-duracion-dias').value),
        anticipoPct: Number(document.getElementById('obra-anticipo-pct').value) || 0,
        anticipoPeriodo: document.getElementById('obra-anticipo-periodo').value || ''
    };
    await crearNuevaObra(datosObra);
}

document.addEventListener("DOMContentLoaded", () => {
    const inputDias = document.getElementById("obra-duracion-dias");
    const outputMeses = document.getElementById("obra-duracion-meses");
    inputDias.addEventListener("input", function () {
        const dias = Number(this.value);
        const meses = Math.ceil(dias / 30);
        outputMeses.value = isNaN(meses) ? "" : `${meses} meses`;
    });

    const editInputDias = document.getElementById("edit-obra-duracion-dias");
    const editOutputMeses = document.getElementById("edit-obra-duracion-meses");
    editInputDias.addEventListener("input", function () {
        const dias = Number(this.value);
        const meses = Math.ceil(dias / 30);
        editOutputMeses.value = isNaN(meses) ? "" : `${meses} meses`;
    });
});

function abrirEditarObra() {
    const o = state.obra || {};
    document.getElementById('edit-obra-nombre').value = o.nombre || '';
    document.getElementById('edit-obra-expediente').value = o.expediente || '';
    document.getElementById('edit-obra-contratista').value = o.contratista || '';
    document.getElementById('edit-obra-fecha-apertura').value = o.fechaApertura || '';
    document.getElementById('edit-obra-fecha').value = o.fecha || '';
    document.getElementById('edit-obra-fecha-replanteo').value = o.fechaReplanteo || '';
    document.getElementById('edit-obra-duracion-dias').value = o.duracionDias || '';
    document.getElementById('edit-obra-anticipo-pct').value = o.anticipoPct || '';
    document.getElementById('edit-obra-anticipo-periodo').value = o.anticipoPeriodo || '';
    const meses = o.duracionDias ? Math.ceil(o.duracionDias / 30) : '';
    document.getElementById('edit-obra-duracion-meses').value = meses ? `${meses} meses` : '';
    openModal('modal-editar-obra');
}

async function guardarEdicionObra() {
    const nombre = document.getElementById('edit-obra-nombre').value.trim();
    if (!nombre) return alert('El nombre de la obra es obligatorio.');

    const fechaReplanteoAnterior = state.obra.fechaReplanteo;

    state.obra = {
        ...state.obra,
        nombre,
        expediente: document.getElementById('edit-obra-expediente').value.trim(),
        contratista: document.getElementById('edit-obra-contratista').value.trim(),
        fechaApertura: document.getElementById('edit-obra-fecha-apertura').value,
        fecha: document.getElementById('edit-obra-fecha').value,
        fechaReplanteo: document.getElementById('edit-obra-fecha-replanteo').value,
        duracionDias: Number(document.getElementById('edit-obra-duracion-dias').value),
        anticipoPct: Number(document.getElementById('edit-obra-anticipo-pct').value) || 0,
        anticipoPeriodo: document.getElementById('edit-obra-anticipo-periodo').value || ''
    };

    const fechaReplanteoNueva = state.obra.fechaReplanteo;

    if (fechaReplanteoNueva && fechaReplanteoNueva !== fechaReplanteoAnterior) {
        const meses = Math.ceil(state.obra.duracionDias / 30);
        const [anioBase, mesBase] = fechaReplanteoNueva.split("-").map(Number);
        const mapaFechas = {};
        for (let i = 0; i < meses; i++) {
            const label = "MES-" + (i + 1);
            const fecha = new Date(anioBase, mesBase - 1 + i, 1);
            const yyyy = fecha.getFullYear();
            const mm = String(fecha.getMonth() + 1).padStart(2, "0");
            mapaFechas[label] = `${yyyy}-${mm}`;
        }
        state.plan = state.plan.map(p => mapaFechas[p.periodo] ? { ...p, periodo: mapaFechas[p.periodo] } : p);
        state.real = state.real.map(r => mapaFechas[r.periodo] ? { ...r, periodo: mapaFechas[r.periodo] } : r);
    }

    await save();
    closeModal('modal-editar-obra');
    if (typeof renderTopbarObra === 'function') renderTopbarObra();
    if (typeof renderSelectorObras === 'function') renderSelectorObras();
    if (typeof renderResumen === 'function') renderResumen();
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