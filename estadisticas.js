const SHEET_ID = "19eV5If38DRpX0utKbID2V_xZWaxnYi2g";
const SHEET_NAME = "DELEGACIONES";
// Si el archivo está en Google Drive como XLSX, pon aquí el enlace directo de descarga (.xlsx)
// Si usas Google Sheets, usa la exportación:
const PUBLIC_XLSX_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&sheet=${SHEET_NAME}`;
// const PUBLIC_XLSX_URL = "URL_DIRECTA_A_TU/DELEGACIONES.XLSX"; // <-- Cambia esto si es necesario
const PUBLIC_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

let datos = [];

window.addEventListener("DOMContentLoaded", function() {
    cargarDatos();
    crearFormularioFechas();
});

function crearFormularioFechas() {
    const main = document.querySelector("main");
    if (!main) return;
    const contenedor = document.createElement("section");
    contenedor.style.marginTop = "32px";
    contenedor.innerHTML = `
        <div class="busqueda-fechas-bar">
            <label for="fechaInicio">Desde:</label>
            <input type="date" id="fechaInicio">
            <label for="fechaFin">Hasta:</label>
            <input type="date" id="fechaFin">
            <button id="buscarFechasBtn">Buscar</button>
        </div>
        <div style="overflow-x:auto;">
            <table class="tabla-resultados" id="cumplimiento-results-table" style="display:none;">
                <thead>
                    <tr>
                        <th>Grado</th>
                        <th>Perito</th>
                        <th>DeleCum_SI</th>
                        <th>DeleCum_NO</th>
                        <th>TOTAL</th>
                    </tr>
                </thead>
                <tbody id="cumplimiento-results-body"></tbody>
            </table>
        </div>
    `;
    main.appendChild(contenedor);

    document.getElementById("buscarFechasBtn").addEventListener("click", buscarPorFechas);
}

// *** FUNCIÓN CARGARDATOS MODIFICADA PARA XLSX ***
async function cargarDatos() {
    try {
        const response = await fetch(PUBLIC_XLSX_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer(); // Obtener el archivo como un ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: 'array' }); // Leer el workbook
        
        // Asumiendo que la hoja se llama "delegaciones"
        const sheet = workbook.Sheets[SHEET_NAME];
        if (!sheet) {
            throw new Error(`Hoja '${SHEET_NAME}' no encontrada en el archivo XLSX.`);
        }

        // Convertir la hoja a un array de objetos JSON
        datos = XLSX.utils.sheet_to_json(sheet);

        // Limpiar datos con filas vacías o sin datos relevantes para el conteo
        datos = datos.filter(row => 
            row["FECHA DE RECEPCIÓN EN LA PJ"] && 
            row["GRADO"] && 
            row["APELLIDOS Y NOMBRES AGENTE"]
        );

        // Para depuración:
        // if (datos.length > 0) {
        //     console.log("Encabezados reales (después de carga XLSX):", Object.keys(datos[0]));
        //     console.log("Primer registro (después de carga XLSX):", datos[0]);
        // }

    } catch (error) {
        console.error("Error al cargar o parsear el XLSX:", error);
        alert(`Error al cargar los datos desde el archivo XLSX. Por favor, verifica la URL y que la hoja '${SHEET_NAME}' exista.\nDetalle: ${error.message}`);
    }
}

function normalizarNombre(nombre) {
    return (nombre || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function parseFecha(fecha) {
    // Convierte dd/mm/yyyy o yyyy-mm-dd a Date
    // SheetJS a menudo devuelve fechas como números (serial Excel), necesitamos manejarlos.
    if (typeof fecha === 'number') {
        // Asumiendo que es un número de serie de Excel (basado en 1900)
        // XLSX.utils.format_date no está directamente disponible aquí, pero podemos convertirlo
        // Un día en Excel es un número, 1 es 1-Jan-1900. Ajustar por el bug de 1900 de Excel.
        const excelDate = new Date(Date.UTC(1899, 11, 30)); // 30 Dec 1899 es 0 en Excel (con bug 1900)
        excelDate.setDate(excelDate.getDate() + fecha);
        return excelDate;
    }
    
    if (!fecha) return null;
    fecha = String(fecha).trim(); // Asegurarse de que es un string y limpiar espacios
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
        const [d, m, y] = fecha.split("/");
        return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`); // Añadir T00:00:00 para evitar problemas de zona horaria
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return new Date(`${fecha}T00:00:00`); // Añadir T00:00:00 para evitar problemas de zona horaria
    }
    // Si la fecha ya viene en un formato Date válido desde SheetJS (ISO 8601 string)
    if (!isNaN(new Date(fecha).getTime()) && (fecha.includes('-') || fecha.includes('/'))) {
        return new Date(fecha + 'T00:00:00'); // Asumir es una fecha y añadir hora para consistencia
    }
    return null;
}

function buscarPorFechas() {
    const fechaInicioInput = document.getElementById('fechaInicio');
    const fechaFinInput = document.getElementById('fechaFin');
    const cumplimientoResultsTable = document.getElementById('cumplimiento-results-table');
    const cumplimientoResultsBody = document.getElementById('cumplimiento-results-body');

    const fechaInicioStr = fechaInicioInput.value;
    const fechaFinStr = fechaFinInput.value;

    if (!fechaInicioStr || !fechaFinStr) {
        cumplimientoResultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Por favor, ingrese un rango de fechas.</td></tr>`;
        cumplimientoResultsTable.style.display = "";
        return;
    }

    const dateFrom = new Date(fechaInicioStr + 'T00:00:00');
    const dateTo = new Date(fechaFinStr + 'T23:59:59'); 

    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
        cumplimientoResultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Las fechas ingresadas no son válidas.</td></tr>`;
        cumplimientoResultsTable.style.display = "";
        return;
    }

    const resultadosFiltrados = datos.filter(row => {
        const fechaRecepcionPJ = row["FECHA DE RECEPCIÓN EN LA PJ"];
        const fIngreso = parseFecha(fechaRecepcionPJ);
        return fIngreso && !isNaN(fIngreso.getTime()) && fIngreso >= dateFrom && fIngreso <= dateTo;
    });

    // Agrupar por GRADO y APELLIDOS Y NOMBRES AGENTE (normalizando el nombre)
    const peritoCounts = resultadosFiltrados.reduce((acc, row) => {
        let grado = (row["GRADO"] || "SIN GRADO").trim();
        let perito = (row["APELLIDOS Y NOMBRES AGENTE"] || "SIN PERITO").trim();
        let peritoKey = normalizarNombre(perito);

        // Unificar BUSTAMANTE FAJARDO RONALD GEORGE bajo CBOP
        if (peritoKey === normalizarNombre("BUSTAMANTE FAJARDO RONALD GEORGE")) {
            grado = "CBOP";
            perito = "BUSTAMANTE FAJARDO RONALD GEORGE";
            peritoKey = normalizarNombre(perito);
        }

        const cumplimientoTotal = (row["CUMPLIMIENTO TOTAL"] || "").trim().toLowerCase();
        const clave = `${grado}||${peritoKey}`; 

        if (!acc[clave]) {
            acc[clave] = { GRADO: grado, PERITO: perito, SI: 0, NO: 0 };
        }

        if (cumplimientoTotal === 'si' || cumplimientoTotal === 'sí') {
            acc[clave].SI += 1;
        } else if (cumplimientoTotal === 'no') {
            acc[clave].NO += 1;
        }
        return acc;
    }, {});

    mostrarTablaCumplimiento(peritoCounts, cumplimientoResultsTable, cumplimientoResultsBody);
}

function mostrarTablaCumplimiento(peritoCounts, cumplimientoResultsTable, cumplimientoResultsBody) {
    cumplimientoResultsBody.innerHTML = '';
    let totalRowsDisplayed = 0;

    // Orden personalizado de agentes (ajusta los nombres exactamente como los tienes en la base)
    const ordenAgentes = [
        "JARAMILLO JARA FRANCO ISRAEL",
        "CUERO CEVALLOS LUIS EFREN",
        "VARGAS QUINTANA NESTOR JOSELITO",
        "SERRANO ESTRADA ALEX DANIEL",
        "JAIME OLAYA MICHAEL JONATHAN",
        "BUSTAMANTE FAJARDO RONALD GEORGE"
        // ...agrega más si lo necesitas
    ].map(normalizarNombre);

    const sortedKeys = Object.keys(peritoCounts).sort((a, b) => {
        const peritoA = normalizarNombre(peritoCounts[a].PERITO);
        const peritoB = normalizarNombre(peritoCounts[b].PERITO);
        const idxA = ordenAgentes.indexOf(peritoA);
        const idxB = ordenAgentes.indexOf(peritoB);

        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return peritoA.localeCompare(peritoB);
    });

    for (let key of sortedKeys) {
        const { GRADO, PERITO, SI, NO } = peritoCounts[key];
        const total = SI + NO;

        if (total > 0) { 
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Grado">${GRADO}</td>
                <td data-label="Perito">${PERITO}</td>
                <td data-label="DeleCum_SI">${SI}</td>
                <td data-label="DeleCum_NO">${NO}</td>
                <td data-label="TOTAL">${total}</td>
            `;
            cumplimientoResultsBody.appendChild(tr);
            totalRowsDisplayed++;
        }
    }

    if (totalRowsDisplayed > 0) {
        cumplimientoResultsTable.style.display = ""; 
    } else {
        cumplimientoResultsTable.style.display = ""; 
        cumplimientoResultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No se encontraron resultados en el rango de fechas.</td></tr>`;
    }
}