const SHEET_ID = "19eV5If38DRpX0utKbID2V_xZWaxnYi2g";
const SHEET_NAME = "DELEGACIONES"; // Asegúrate de que este sea el nombre EXACTO de tu pestaña
const PUBLIC_XLSX_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&sheet=${SHEET_NAME}`;

let datos = [];

window.addEventListener("DOMContentLoaded", function() {
    cargarDatos();
    crearFormularioPerito();
});

function crearFormularioPerito() {
    const main = document.querySelector("main");
    if (!main) return;
    const contenedor = document.createElement("section");
    contenedor.style.marginTop = "32px";
    contenedor.innerHTML = `
        <div class="busqueda-perito-bar">
            <input type="text" id="peritoInput" class="input-perito" placeholder="Buscar por apellido o nombre de perito...">
            <select id="anioFiltro" class="select-perito"></select>
            <select id="cumplimientoFiltro" class="select-perito">
                <option value="">-- Todos --</option>
                <option value="si">Solo Cumplidas (SI)</option>
                <option value="no">Solo No Cumplidas (NO)</option>
            </select>
            <button id="buscarPeritoBtn" class="btn-perito">Buscar</button>
            <button id="imprimirPeritoBtn" class="btn-perito" style="background:#4caf50;">Imprimir</button>
        </div>
        <div class="resultados-perito-scroll">
            <table class="tabla-perito-horizontal" id="perito-results-table" style="display:none;">
                <thead>
                    <tr>
                        <th>NUM</th>
                        <th>IF</th>
                        <th>GRADO</th>
                        <th>PERITO</th>
                        <th>DELITO</th>
                        <th>DETENIDO</th>
                        <th>FISCAL</th>
                        <th>FISCALÍA</th>
                        <th>F_INGRESO</th>
                        <th>CUMPLIMIENTO</th>
                        <th>F_CUMPLIMIENTO</th>
                        <th>N_OFICIO</th>
                    </tr>
                </thead>
                <tbody id="perito-results-body"></tbody>
            </table>
        </div>
    `;
    main.appendChild(contenedor);

    document.getElementById("buscarPeritoBtn").addEventListener("click", buscarPorPerito);
    document.getElementById("peritoInput").addEventListener("keydown", function(e) {
        if (e.key === "Enter") buscarPorPerito();
    });
    document.getElementById("imprimirPeritoBtn").addEventListener("click", imprimirTablaPerito);
}

async function cargarDatos() {
    try {
        const response = await fetch(PUBLIC_XLSX_URL);
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: No se pudo acceder al archivo. Asegúrate de que la hoja de Google Sheets sea pública y la URL sea correcta. Detalle: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { 
            type: 'array',
            cellDates: true 
        });
        
        const sheet = workbook.Sheets[SHEET_NAME];
        if (!sheet) {
            throw new Error(`Hoja '${SHEET_NAME}' no encontrada en el archivo XLSX. Por favor, verifica el nombre de la pestaña en tu Google Sheet.`);
        }

        // Obtener datos como array de arrays para procesar encabezados manualmente
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }); 

        if (rawData.length === 0) {
            return;
        }

        const headers = rawData[0];
        const normalizedHeaders = headers.map(h => (h || "").trim()); 
        
        const parsedData = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            const rowObject = {};
            for (let j = 0; j < normalizedHeaders.length; j++) {
                rowObject[normalizedHeaders[j]] = row[j];
            }
            parsedData.push(rowObject);
        }
        datos = parsedData;

        datos = datos.filter(row => 
            (row["APELLIDOS Y NOMBRES AGENTE"] !== undefined && row["APELLIDOS Y NOMBRES AGENTE"] !== null && String(row["APELLIDOS Y NOMBRES AGENTE"]).trim() !== "")
        );

        if (datos.length > 0) {
            cargarAniosUnicos();
        }

    } catch (error) {
        console.error("Error crítico al cargar o parsear el XLSX:", error);
        alert(`Error al cargar los datos desde el archivo XLSX. Por favor, verifica:\n1. Que la hoja de Google Sheets sea PÚBLICA.\n2. Que el 'SHEET_ID' sea correcto.\n3. Que el 'SHEET_NAME' sea el nombre EXACTO de la pestaña.\n4. Detalle del error: ${error.message}`);
    }
}

function cargarAniosUnicos() {
    const anios = new Set();
    datos.forEach(row => {
        const fecha = row["FECHA DE RECEPCIÓN EN LA PJ"];
        if (fecha instanceof Date && !isNaN(fecha.getTime())) {
            anios.add(fecha.getFullYear().toString());
        } else if (typeof fecha === "number") {
            const excelDate = new Date(Date.UTC(1899, 11, 30));
            excelDate.setDate(excelDate.getDate() + fecha);
            if (!isNaN(excelDate.getTime())) {
                anios.add(excelDate.getFullYear().toString());
            }
        } else if (fecha) {
            const match = String(fecha).match(/(\d{4})/);
            if (match) anios.add(match[1]);
        }
    });
    const select = document.getElementById("anioFiltro");
    select.innerHTML = `<option value="">-- Todos los años --</option>`;
    Array.from(anios).sort().forEach(anio => {
        select.innerHTML += `<option value="${anio}">${anio}</option>`;
    });
}

function normalizar(texto) {
    return (texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim(); // Asegurarse de quitar espacios al final
}

function buscarPorPerito() {
    const queryRaw = document.getElementById("peritoInput").value.trim();
    const query = normalizar(queryRaw);
    const filtroCumplimiento = document.getElementById("cumplimientoFiltro").value; // 'si', 'no', o ''
    const anioFiltro = document.getElementById("anioFiltro").value;
    const tabla = document.getElementById("perito-results-table");
    const tbody = document.getElementById("perito-results-body");
    tbody.innerHTML = ""; // Limpiar resultados anteriores

    if (!query) {
        tabla.style.display = "none";
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">Por favor, ingrese el nombre o apellido del perito.</td></tr>`;
        tabla.style.display = ""; // Mostrar la tabla con el mensaje
        return;
    }

    let resultados = datos.filter(row => {
        const nombrePerito = normalizar(row["APELLIDOS Y NOMBRES AGENTE"]);
        const cumpleNombre = nombrePerito.includes(query);

        let cumpleAnio = true;
        if (anioFiltro) {
            let anio = "";
            const fecha = row["FECHA DE RECEPCIÓN EN LA PJ"];
            if (fecha instanceof Date && !isNaN(fecha.getTime())) {
                anio = fecha.getFullYear().toString();
            } else if (typeof fecha === "number") {
                const excelDate = new Date(Date.UTC(1899, 11, 30));
                excelDate.setDate(excelDate.getDate() + fecha);
                if (!isNaN(excelDate.getTime())) anio = excelDate.getFullYear().toString();
            } else if (fecha) {
                const match = String(fecha).match(/(\d{4})/);
                if (match) anio = match[1];
            }
            cumpleAnio = anio === anioFiltro;
        }

        let cumpleFiltroCumplimiento = true;
        if (filtroCumplimiento) {
            const cumplimientoValor = (row["CUMPLIMIENTO TOTAL"] || "").trim().toLowerCase();
            if (filtroCumplimiento === "si") {
                cumpleFiltroCumplimiento = (cumplimientoValor === "si" || cumplimientoValor === "sí");
            } else if (filtroCumplimiento === "no") {
                cumpleFiltroCumplimiento = cumplimientoValor === "no";
            }
        }
        
        return cumpleNombre && cumpleAnio && cumpleFiltroCumplimiento;
    });

    if (!resultados.length) {
        tabla.style.display = "";
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">No se encontraron resultados para el perito "${queryRaw}" con los filtros seleccionados.</td></tr>`;
        return;
    }

    // Ordenar resultados alfabéticamente por perito
    resultados.sort((a, b) => {
        const peritoA = normalizar(a["APELLIDOS Y NOMBRES AGENTE"]);
        const peritoB = normalizar(b["APELLIDOS Y NOMBRES AGENTE"]);
        return peritoA.localeCompare(peritoB);
    });

    resultados.forEach((row, idx) => {
        // Mejorar el formateo de fechas en la tabla si es necesario
        let fechaIngresoFormatted = row["FECHA DE RECEPCIÓN EN LA PJ"];
        if (fechaIngresoFormatted instanceof Date && !isNaN(fechaIngresoFormatted.getTime())) {
            fechaIngresoFormatted = fechaIngresoFormatted.toLocaleDateString('es-ES'); // Formato dd/mm/yyyy
        } else if (typeof fechaIngresoFormatted === 'number') {
             // Si SheetJS no lo convirtió a Date, lo hacemos manualmente para la visualización
            const excelDate = new Date(Date.UTC(1899, 11, 30));
            excelDate.setDate(excelDate.getDate() + fechaIngresoFormatted);
            if (!isNaN(excelDate.getTime())) fechaIngresoFormatted = excelDate.toLocaleDateString('es-ES');
        }


        let fechaCumplimientoFormatted = row["FECHA CUMPLIMIENTO O DESCARGO DE DELEGACION"];
        if (fechaCumplimientoFormatted instanceof Date && !isNaN(fechaCumplimientoFormatted.getTime())) {
            fechaCumplimientoFormatted = fechaCumplimientoFormatted.toLocaleDateString('es-ES');
        } else if (typeof fechaCumplimientoFormatted === 'number') {
            const excelDate = new Date(Date.UTC(1899, 11, 30));
            excelDate.setDate(excelDate.getDate() + fechaCumplimientoFormatted);
            if (!isNaN(excelDate.getTime())) fechaCumplimientoFormatted = excelDate.toLocaleDateString('es-ES');
        }

        tbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td>${row["NUMERO DE INSTRUCCIÓN FISCAL"] || "-"}</td>
                <td>${row["GRADO"] || "-"}</td>
                <td>${row["APELLIDOS Y NOMBRES AGENTE"] || "-"}</td>
                <td>${row["DELITO TIPIFICADO EN DELEGACION"] || "-"}</td>
                <td>${row["APELLIDOS Y NOMBRES DEL DETENIDO O SOPECHOSO"] || "-"}</td>
                <td>${row["APELLIDOS Y NOMBRES DEL FISCAL"] || "-"}</td>
                <td>${row["UNIDAD ESPECIALIZADA DE FISCALIA"] || "-"}</td>
                <td>${fechaIngresoFormatted || "-"}</td>
                <td>${row["CUMPLIMIENTO TOTAL"] || "-"}</td>
                <td>${fechaCumplimientoFormatted || "-"}</td>
                <td>${row["NUMERO DE INFORME"] || row["N° OFICIO"] || row["N_OFICIO"] || "-"}</td>
            </tr>
            

        `;
    });

    tabla.style.display = ""; // Asegurarse de que la tabla sea visible
}

function imprimirTablaPerito() {
    const tabla = document.getElementById("perito-results-table");
    if (!tabla || tabla.style.display === "none") {
        alert("No hay resultados para imprimir.");
        return;
    }
    // Clonar la tabla y abrir en una nueva ventana para imprimir solo la tabla
    const tablaHtml = tabla.outerHTML;
    const win = window.open('', '', 'width=900,height=700');
    win.document.write(`
        <html>
        <head>
            <title>Imprimir Delegaciones por Perito</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; margin: 0; padding: 24px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
                th, td { border: 1px solid #e0e6ed; padding: 10px 12px; text-align: left; font-size: 1rem; }
                th { background: #f0f4fa; color: #222; font-weight: 600; }
                tr:nth-child(even) { background: #f9fbfd; }
                tr:hover { background: #e6f0fa; transition: background 0.2s; }
            </style>
        </head>
        <body>
            <h2>Delegaciones por Perito</h2>
            ${tablaHtml}
        </body>
        </html>
    `);
    win.document.close();
    win.focus();
    win.print();
}
