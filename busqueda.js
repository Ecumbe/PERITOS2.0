const SHEET_ID = "1j52vjPyQi5algYyyFvZxNdVPXkpKpDRPamaPqGPMtAM";
const SHEET_NAME = "FLAGRANCIA";
// Si el archivo está en Google Drive como XLSX, pon aquí el enlace directo de descarga (.xlsx)
// Si usas Google Sheets, usa la exportación:
const PUBLIC_XLSX_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&sheet=${SHEET_NAME}`;
// const PUBLIC_XLSX_URL = "URL_DIRECTA_A_TU/DELEGACIONES.XLSX"; // <-- Cambia esto si es necesario
const PUBLIC_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

const columnas = [
    { nombre: "NUMERO DE INSTRUCCIÓN FISCAL", mostrar: "N° Instrucción Fiscal" },
    { nombre: "GRADO", mostrar: "Grado" },
    { nombre: "APELLIDOS Y NOMBRES AGENTE", mostrar: "Agente" },
    { nombre: "DELITO TIPIFICADO EN DELEGACION", mostrar: "Delito Tipificado" },
    { nombre: "APELLIDOS Y NOMBRES DEL DETENIDO O SOPECHOSO", mostrar: "Detenido/Sospechoso" },
    { nombre: "APELLIDOS Y NOMBRES DEL FISCAL", mostrar: "Fiscal" },
    { nombre: "UNIDAD ESPECIALIZADA DE FISCALIA", mostrar: "Unidad Fiscalía" },
    { nombre: "FECHA DE RECEPCIÓN EN LA PJ", mostrar: "Fecha Recepción PJ" },
    { nombre: "FECHA CUMPLIMIENTO O DESCARGO DE DELEGACION", mostrar: "Fecha Cumplimiento" },
    { nombre: "CODIGO SIIPNE", mostrar: "Fecha Original Oficio" },
    { nombre: "FOJAS", mostrar: "N° Informe" }
];

let datos = [];

document.getElementById("buscarBtn").addEventListener("click", buscar);
document.getElementById("busquedaInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") buscar();
});

function normalizar(texto) {
    return (texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function cargarDatos() {
    Papa.parse(PUBLIC_CSV_URL, {
        download: true,
        header: true,
        complete: function(results) {
            datos = results.data;
            if (datos.length > 0) {
                console.log("Encabezados reales:", Object.keys(datos[0]));
                console.log("Primer registro:", datos[0]);
            } else {
                console.log("No se cargaron datos.");
            }
            if (!datos.length) {
                alert("No se cargaron los datos correctamente.");
            }
        }
    });
}

function buscar() {
    const queryRaw = document.getElementById("busquedaInput").value.trim();
    const query = normalizar(queryRaw);
    if (!query) return;

    // Busca por número de instrucción fiscal o por nombre del detenido/sospechoso
    const resultados = datos.filter(fila => {
        const numero = normalizar(fila["NUMERO DE INSTRUCCIÓN FISCAL"]);
        const nombre = normalizar(fila["APELLIDOS Y NOMBRES DEL DETENIDO O SOPECHOSO"]);
        return numero.includes(query) || nombre.includes(query);
    });

    console.log("Resultados encontrados:", resultados);

    mostrarResultados(resultados);
}

function mostrarResultados(resultados) {
    const contenedor = document.getElementById("resultados");
    contenedor.innerHTML = "";

    if (!resultados.length) {
        contenedor.innerHTML = "<p>No se encontraron resultados.</p>";
        return;
    }

    // Crear tabla responsive (data-label para vertical en móvil)
    let html = `<div style="overflow-x:auto;"><table class="tabla-resultados"><thead><tr>`;
    columnas.forEach(col => {
        html += `<th>${col.mostrar}</th>`;
    });
    html += `</tr></thead><tbody>`;

    resultados.forEach(fila => {
        html += `<tr>`;
        columnas.forEach(col => {
            html += `<td data-label="${col.mostrar}">${fila[col.nombre] || "-"}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

// Elimina la función de búsqueda por fechas y el bloque que la inserta en el DOM
// Borra todo el bloque que comienza con (function() { ... }) y la función buscarPorFechas

cargarDatos();
