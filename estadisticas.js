(() => {
const { fetchAllRows, normalizar, getValue, parseFechaFlexible } = window.peritosApi;

let datos = [];

window.addEventListener("DOMContentLoaded", async () => {
  crearFormularioFechas();
  await cargarDatos();
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

async function cargarDatos() {
  const body = document.getElementById("cumplimiento-results-body");
  const table = document.getElementById("cumplimiento-results-table");
  table.style.display = "";
  body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Cargando datos desde Supabase...</td></tr>`;

  try {
    datos = await fetchAllRows("id,GRADO,PERITO,F_RECEPCION,CUMPLIMIENTO_TOTAL");
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Datos listos. Selecciona un rango y presiona Buscar.</td></tr>`;
  } catch (error) {
    console.error(error);
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error al cargar Supabase: ${error.message}</td></tr>`;
  }
}

function buscarPorFechas() {
  const fechaInicioStr = document.getElementById("fechaInicio").value;
  const fechaFinStr = document.getElementById("fechaFin").value;
  const cumplimientoResultsTable = document.getElementById("cumplimiento-results-table");
  const cumplimientoResultsBody = document.getElementById("cumplimiento-results-body");

  if (!fechaInicioStr || !fechaFinStr) {
    cumplimientoResultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Por favor, ingrese un rango de fechas.</td></tr>`;
    cumplimientoResultsTable.style.display = "";
    return;
  }

  const dateFrom = new Date(`${fechaInicioStr}T00:00:00`);
  const dateTo = new Date(`${fechaFinStr}T23:59:59`);

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    cumplimientoResultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Las fechas ingresadas no son válidas.</td></tr>`;
    cumplimientoResultsTable.style.display = "";
    return;
  }

  const resultadosFiltrados = datos.filter((row) => {
    const fIngreso = parseFechaFlexible(row.F_RECEPCION);
    return fIngreso && fIngreso >= dateFrom && fIngreso <= dateTo;
  });

  const peritoCounts = resultadosFiltrados.reduce((acc, row) => {
    let grado = String(getValue(row, ["GRADO"]) || "SIN GRADO").trim();
    let perito = String(getValue(row, ["PERITO", "APELLIDOS Y NOMBRES AGENTE"]) || "SIN PERITO").trim();
    let peritoKey = normalizar(perito);

    if (peritoKey === normalizar("BUSTAMANTE FAJARDO RONALD GEORGE")) {
      grado = "CBOP";
      perito = "BUSTAMANTE FAJARDO RONALD GEORGE";
      peritoKey = normalizar(perito);
    }

    const cumplimientoTotal = normalizar(getValue(row, ["CUMPLIMIENTO_TOTAL", "CUMPLIMIENTO TOTAL"]));
    const clave = `${grado}||${peritoKey}`;

    if (!acc[clave]) {
      acc[clave] = { GRADO: grado, PERITO: perito, SI: 0, NO: 0 };
    }

    if (cumplimientoTotal === "si" || cumplimientoTotal === "sí") {
      acc[clave].SI += 1;
    } else {
      // Todo valor distinto de SI se considera NO para el resumen solicitado.
      acc[clave].NO += 1;
    }

    return acc;
  }, {});

  mostrarTablaCumplimiento(peritoCounts, cumplimientoResultsTable, cumplimientoResultsBody);
}

function mostrarTablaCumplimiento(peritoCounts, cumplimientoResultsTable, cumplimientoResultsBody) {
  cumplimientoResultsBody.innerHTML = "";
  let totalRowsDisplayed = 0;

  const ordenAgentes = [
    "JARAMILLO JARA FRANCO ISRAEL",
    "CUERO CEVALLOS LUIS EFREN",
    "VARGAS QUINTANA NESTOR JOSELITO",
    "SERRANO ESTRADA ALEX DANIEL",
    "JAIME OLAYA MICHAEL JONATHAN",
    "BUSTAMANTE FAJARDO RONALD GEORGE",
  ].map(normalizar);

  const sortedKeys = Object.keys(peritoCounts).sort((a, b) => {
    const peritoA = normalizar(peritoCounts[a].PERITO);
    const peritoB = normalizar(peritoCounts[b].PERITO);
    const idxA = ordenAgentes.indexOf(peritoA);
    const idxB = ordenAgentes.indexOf(peritoB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return peritoA.localeCompare(peritoB);
  });

  for (const key of sortedKeys) {
    const { GRADO, PERITO, SI, NO } = peritoCounts[key];
    const total = SI + NO;

    if (total > 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Grado">${GRADO}</td>
        <td data-label="Perito">${PERITO}</td>
        <td data-label="DeleCum_SI">${SI}</td>
        <td data-label="DeleCum_NO">${NO}</td>
        <td data-label="TOTAL">${total}</td>
      `;
      cumplimientoResultsBody.appendChild(tr);
      totalRowsDisplayed += 1;
    }
  }

  if (totalRowsDisplayed > 0) {
    cumplimientoResultsTable.style.display = "";
  } else {
    cumplimientoResultsTable.style.display = "";
    cumplimientoResultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No se encontraron resultados en el rango de fechas.</td></tr>`;
  }
}

})();
