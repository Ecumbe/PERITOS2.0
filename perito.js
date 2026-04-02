(() => {
const { normalizar, getValue, parseFechaFlexible, formatFechaEs, fetchAllRows } = window.peritosApi;
let peritosCatalogo = [];

window.addEventListener("DOMContentLoaded", async () => {
  crearFormularioPerito();
  await cargarAniosUnicos();
});

function crearFormularioPerito() {
  const main = document.querySelector("main");
  if (!main) return;

  const contenedor = document.createElement("section");
  contenedor.style.marginTop = "32px";
  contenedor.innerHTML = `
    <div class="busqueda-perito-bar">
      <input type="text" id="peritoInput" class="input-perito" placeholder="Buscar por apellido o nombre de perito...">
      <datalist id="peritoSugerencias"></datalist>
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
            <th>FISCALIA</th>
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
  document.getElementById("peritoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarPorPerito();
  });
  document.getElementById("peritoInput").setAttribute("list", "peritoSugerencias");
  document.getElementById("peritoInput").addEventListener("input", actualizarSugerenciasPerito);
  document.getElementById("imprimirPeritoBtn").addEventListener("click", imprimirTablaPerito);
}

async function cargarAniosUnicos() {
  const select = document.getElementById("anioFiltro");
  select.innerHTML = `<option value="">Cargando anos...</option>`;

  try {
    const rows = await fetchAllRows("id,F_RECEPCION,PERITO");
    const anios = new Set();
    const peritos = new Set();

    rows.forEach((row) => {
      const fecha = parseFechaFlexible(row.F_RECEPCION);
      if (fecha) anios.add(String(fecha.getFullYear()));

      const perito = String(row.PERITO || "").trim();
      if (perito) peritos.add(perito);
    });

    peritosCatalogo = Array.from(peritos).sort((a, b) => normalizar(a).localeCompare(normalizar(b)));

    select.innerHTML = `<option value="">-- Todos los anos --</option>`;
    Array.from(anios)
      .sort()
      .forEach((anio) => {
        select.innerHTML += `<option value="${anio}">${anio}</option>`;
      });
  } catch (error) {
    select.innerHTML = `<option value="">-- Todos los anos --</option>`;
    console.error(error);
  }
}

function actualizarSugerenciasPerito() {
  const input = document.getElementById("peritoInput");
  const datalist = document.getElementById("peritoSugerencias");
  if (!input || !datalist) return;

  const q = normalizar(input.value);
  if (!q || q.length < 2) {
    datalist.innerHTML = "";
    return;
  }

  const sugerencias = peritosCatalogo
    .filter((nombre) => normalizar(nombre).includes(q))
    .slice(0, 12);

  datalist.innerHTML = sugerencias.map((nombre) => `<option value="${nombre}"></option>`).join("");
}

async function buscarPorPerito() {
  const queryRaw = document.getElementById("peritoInput").value.trim();
  const filtroCumplimiento = document.getElementById("cumplimientoFiltro").value;
  const anioFiltro = document.getElementById("anioFiltro").value;
  const tabla = document.getElementById("perito-results-table");
  const tbody = document.getElementById("perito-results-body");

  tbody.innerHTML = "";
  tabla.style.display = "";

  if (!queryRaw) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">Por favor, ingrese el nombre o apellido del perito.</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">Consultando en Supabase...</td></tr>`;

  const safe = queryRaw.replace(/[%]/g, "");
  const { data, error } = await window.peritosApi.supabase
    .from("FLAGRANCIA")
    .select("*")
    .ilike("PERITO", `%${safe}%`)
    .order("id", { ascending: true })
    .limit(1000);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">Error al consultar Supabase: ${error.message}</td></tr>`;
    return;
  }

  let resultados = (data || []).filter((row) => {
    const nombrePerito = normalizar(getValue(row, ["PERITO", "APELLIDOS Y NOMBRES AGENTE"]));
    if (!nombrePerito.includes(normalizar(queryRaw))) return false;

    if (anioFiltro) {
      const fecha = parseFechaFlexible(row.F_RECEPCION);
      if (!fecha || String(fecha.getFullYear()) !== anioFiltro) return false;
    }

    if (filtroCumplimiento) {
      const cumplimiento = normalizar(row.CUMPLIMIENTO_TOTAL);
      if (filtroCumplimiento === "si" && cumplimiento !== "si" && cumplimiento !== "sí") return false;
      if (filtroCumplimiento === "no" && (cumplimiento === "si" || cumplimiento === "sí")) return false;
    }

    return true;
  });

  if (!resultados.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">No se encontraron resultados para el perito "${queryRaw}" con los filtros seleccionados.</td></tr>`;
    return;
  }

  resultados.sort((a, b) => {
    const peritoA = normalizar(getValue(a, ["PERITO", "APELLIDOS Y NOMBRES AGENTE"]));
    const peritoB = normalizar(getValue(b, ["PERITO", "APELLIDOS Y NOMBRES AGENTE"]));
    return peritoA.localeCompare(peritoB);
  });

  tbody.innerHTML = "";
  resultados.forEach((row, idx) => {
    const ifValue = getValue(row, ["IF", "NUMERO DE INSTRUCCIÓN FISCAL"]);
    const grado = getValue(row, ["GRADO"]);
    const perito = getValue(row, ["PERITO", "APELLIDOS Y NOMBRES AGENTE"]);
    const delito = getValue(row, ["DELITO_TIPIFICADO_EN_DELEGACION", "DELITO TIPIFICADO EN DELEGACION"]);
    const detenido = getValue(row, ["DETENIDO", "APELLIDOS Y NOMBRES DEL DETENIDO O SOPECHOSO"]);
    const fiscal = getValue(row, ["APELLIDOS_Y_NOMBRES_DEL_FISCAL", "APELLIDOS Y NOMBRES DEL FISCAL"]);
    const unidad = getValue(row, ["UNIDAD_ESPECIALIZADA_DE_FISCALIA", "UNIDAD ESPECIALIZADA DE FISCALIA"]);
    const fIngreso = formatFechaEs(row.F_RECEPCION);
    const cumplimiento = row.CUMPLIMIENTO_TOTAL;
    const fCumplimiento = formatFechaEs(getValue(row, ["F_CUMPLIMIENTO", "FECHA CUMPLIMIENTO O DESCARGO DE DELEGACION"]));
    const nOficio = getValue(row, ["N_INFORME", "Nº_DE_OFICIO_CON_LA_QUE_RECIBE_LA_DILIGENCIA_EL_AGENTE", "NUMERO DE INFORME", "N° OFICIO", "N_OFICIO"]);

    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${ifValue || "-"}</td>
        <td>${grado || "-"}</td>
        <td>${perito || "-"}</td>
        <td>${delito || "-"}</td>
        <td>${detenido || "-"}</td>
        <td>${fiscal || "-"}</td>
        <td>${unidad || "-"}</td>
        <td>${fIngreso || "-"}</td>
        <td>${cumplimiento || "-"}</td>
        <td>${fCumplimiento || "-"}</td>
        <td>${nOficio || "-"}</td>
      </tr>
    `;
  });
}

function imprimirTablaPerito() {
  const tabla = document.getElementById("perito-results-table");
  if (!tabla || tabla.style.display === "none") {
    alert("No hay resultados para imprimir.");
    return;
  }

  const tablaHtml = tabla.outerHTML;
  const win = window.open("", "", "width=900,height=700");
  if (!win) return;

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

})();
