window.obras = window.obras || [];
let obras = window.obras;
window.state = obraVacia();
let state = window.state;
const STORAGE_ACTIVA = 'redeterminaciones_obraActiva';

function obraVacia() {
    return {
        id: Date.now(),
        fechaCreacion: new Date().toISOString().slice(0, 7),
        obra: { nombre: '', expediente: '', fecha: '', fechaApertura: '', contratista: '' },
        items: [], modificaciones: [], planMod: [], realMod: [], plan: [], real: [], adecuaciones: [],
        gatillo: 10, iopBase: null, nextId: 1
    };
}

function getObraActivaId() {
    return localStorage.getItem(STORAGE_ACTIVA);
}

function setObraActivaId(id) {
    localStorage.setItem(STORAGE_ACTIVA, String(id));
}

async function save() {
    if (state._sinGuardar) return;
    try {
        const user = window.auth.currentUser;
        if (!user) return;
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(window.db, 'usuarios', user.uid, 'obras', String(state.id)), {
            ...state,
            ultimaEdicion: new Date().toISOString()
        });
        console.log("Obra guardada:", state.obra.nombre);
    } catch (e) { console.error(e); }
}

async function saveIOP() {
    try {
        const user = window.auth.currentUser;
        if (!user) return;
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(window.db, 'usuarios', user.uid, 'iop', 'cordoba'), {
            datos: window.iopGlobal,
            orden: window.iopOrden || {},
            ultimaEdicion: new Date().toISOString()
        });
        console.log("IOP guardado");
    } catch (e) { console.error(e); }
}

async function crearNuevaObra(datosObra) {
    const nueva = obraVacia();
    nueva.obra = { ...nueva.obra, ...datosObra };
    delete nueva._sinGuardar;

    window.obras.push(nueva);
    obras = window.obras;

    state = nueva;
    window.state = state;
    setObraActivaId(nueva.id);

    await save();

    if (typeof renderSelectorObras === 'function') renderSelectorObras();
    if (typeof renderTopbarObra === 'function') renderTopbarObra();
    if (typeof renderResumen === 'function') renderResumen();
    if (typeof closeModal === 'function') closeModal('modal-nueva-obra');
    if (typeof renderOficial === 'function') renderOficial();
    if (typeof actualizarCardEstructura === 'function') actualizarCardEstructura();

    return nueva;
}

function cambiarObraActiva(id) {
    const obra = obras.find(o => String(o.id) === String(id));
    if (!obra) return false;
    state = obra;
    window.state = state;
    setObraActivaId(id);
    return true;
}

async function eliminarObra(id) {
    try {
        const user = window.auth.currentUser;
        if (!user) return;
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await deleteDoc(doc(window.db, 'usuarios', user.uid, 'obras', String(id)));
    } catch (e) { console.error(e); }

    obras = obras.filter(o => String(o.id) !== String(id));
    window.obras = obras;

    if (String(getObraActivaId()) === String(id)) {
        if (obras.length > 0) {
            state = obras[0];
            window.state = state;
            setObraActivaId(state.id);
        } else {
            state = obraVacia();
            window.state = state;
            state._sinGuardar = true;
        }
    }
    location.reload();
}

async function descargarTodoDeNube() {
    const user = window.auth.currentUser;
    if (!user) return;

    try {
        const { collection, getDocs, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

        const pLogin = document.getElementById('pantalla-login');
        const pApp = document.getElementById('pantalla-app');
        if (pLogin) pLogin.style.display = 'none';
        if (pApp) pApp.style.display = 'block';

        // Cargar obras
        const obrasSnap = await getDocs(collection(window.db, 'usuarios', user.uid, 'obras'));
        obras = [];
        obrasSnap.forEach(d => obras.push(d.data()));
        obras.sort((a, b) => a.id - b.id);
        window.obras = obras;

        // Cargar IOP global
        const iopSnap = await getDoc(doc(window.db, 'usuarios', user.uid, 'iop', 'cordoba'));
        if (iopSnap.exists()) {
            window.iopGlobal = iopSnap.data().datos || {};
            window.iopOrden = iopSnap.data().orden || {};
        } else {
            window.iopGlobal = {};
            window.iopOrden = {};
        }

        // Activar obra
        const activaId = getObraActivaId();
        if (activaId) {
            state = obras.find(o => String(o.id) === String(activaId)) || obras[0];
        } else if (obras.length > 0) {
            state = obras[0];
        }

        if (state) {
            if (!state.modificaciones) state.modificaciones = [];
            if (!state.planMod) state.planMod = [];
            if (!state.realMod) state.realMod = [];
            if (!state.adecuacionesMod) state.adecuacionesMod = [];
            window.state = state;
            setObraActivaId(state.id);
        } else {
            state = obraVacia();
            state._sinGuardar = true;
            window.state = state;
        }

        if (typeof renderItems === 'function') renderItems();
        if (typeof renderOficial === 'function') renderOficial();
        if (typeof populateItemSelects === 'function') populateItemSelects();
        if (typeof renderSelectorObras === 'function') renderSelectorObras();
        if (typeof renderTopbarObra === 'function') renderTopbarObra();
        if (typeof renderResumen === 'function') renderResumen();


        document.body.classList.remove('app-cargando');
        console.log("Datos descargados. Obras:", obras.length);

    } catch (error) {
        console.error("Error al descargar:", error);
    }
}

window.addEventListener('load', () => {
    if (window.auth) {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                // Verificar licencia
                try {
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
                    const licRef = doc(window.db, 'licencias', user.uid);
                    const licSnap = await getDoc(licRef);
                    if (!licSnap.exists()) {
                        mostrarPantallaLicencia('Sin licencia activa. Contactá al administrador.');
                        return;
                    }
                    const lic = licSnap.data();
                    if (!lic.activa) {
                        mostrarPantallaLicencia('Tu licencia está inactiva. Contactá al administrador.');
                        return;
                    }
                    if (lic.vencimiento && lic.vencimiento < new Date().toISOString().slice(0, 10)) {
                        mostrarPantallaLicencia(`Tu licencia venció el ${lic.vencimiento}. Contactá al administrador.`);
                        return;
                    }
                    descargarTodoDeNube();
                } catch (e) {
                    console.error('Error verificando licencia:', e);
                    mostrarPantallaLicencia('Error al verificar licencia. Contactá al administrador.');
                }
            } else {
                obras = [];
                window.obras = [];
                window.iopGlobal = {};
                state = obraVacia();
                state._sinGuardar = true;
                window.state = state;
            }
        });
    }
});

function mostrarPantallaLicencia(mensaje) {
    document.body.classList.remove('app-cargando');
    document.getElementById('pantalla-app').style.display = 'none';
    document.getElementById('pantalla-login').style.display = 'none';
    let el = document.getElementById('pantalla-licencia');
    if (!el) {
        el = document.createElement('div');
        el.id = 'pantalla-licencia';
        el.style.cssText = 'position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:9999';
        el.innerHTML = `
            <div style="font-size:32px">🔒</div>
            <div style="font-size:18px;font-weight:600;color:var(--text)">Acceso restringido</div>
            <div id="licencia-mensaje" style="font-size:14px;color:var(--text2);text-align:center;max-width:320px"></div>
            <button class="btn btn-primary" onclick="window.auth.signOut()">Cerrar sesión</button>
        `;
        document.body.appendChild(el);
    }
    document.getElementById('licencia-mensaje').textContent = mensaje;
    el.style.display = 'flex';
}