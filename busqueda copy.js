const columnas = [
  { keys: ["IF", "NUMERO DE INSTRUCCIÓN FISCAL"], mostrar: "N° Instrucción Fiscal" },
  { keys: ["GRADO"], mostrar: "Grado" },
  { keys: ["PERITO", "APELLIDOS Y NOMBRES AGENTE"], mostrar: "Agente" },
  { keys: ["DELITO_TIPIFICADO_EN_DELEGACION", "DELITO TIPIFICADO EN DELEGACION"], mostrar: "Delito Tipificado" },
  { keys: ["DETENIDO", "APELLIDOS Y NOMBRES DEL DETENIDO O SOPECHOSO"], mostrar: "Detenido/Sospechoso" },
  { keys: ["APELLIDOS_Y_NOMBRES_DEL_FISCAL", "APELLIDOS Y NOMBRES DEL FISCAL"], mostrar: "Fiscal" },
  { keys: ["UNIDAD_ESPECIALIZADA_DE_FISCALIA", "UNIDAD ESPECIALIZADA DE FISCALIA"], mostrar: "Unidad Fiscalía" },
  { keys: ["F_RECEPCION", "FECHA DE RECEPCIÓN EN LA PJ"], mostrar: "Fecha Recepción PJ" },
  { keys: ["CUMPLIMIENTO_TOTAL", "CUMPLIMIENTO TOTAL"], mostrar: "Cumplimiento Total" },
  { keys: ["EXTRACTO"], mostrar: "Extracto" },
  { keys: ["N_INFORME", "FOJAS"], mostrar: "N° Informe" },
];

const { getValue, formatFechaEs } = window.peritosApi;

document.getElementById("buscarBtn").addEventListener("click", buscar);
document.getElementById("busquedaInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") buscar();
});

async function buscar() {
  const queryRaw = document.getElementById("busquedaInput").value.trim();
  if (!queryRaw) return;

  const contenedor = document.getElementById("resultados");
  contenedor.innerHTML = "<p>Consultando en Supabase...</p>";

  const safe = queryRaw.replace(/[%]/g, "");
  const orFilter = `IF.ilike.%${safe}%,DETENIDO.ilike.%${safe}%`;

  const { data, error } = await window.peritosApi.supabase
    .from("FLAGRANCIA")
    .select("*")
    .or(orFilter)
    .order("id", { ascending: false })
    .limit(300);

  if (error) {
    contenedor.innerHTML = `<p>Error al consultar Supabase: ${error.message}</p>`;
    return;
  }

  mostrarResultados(data || []);
}

function mostrarResultados(resultados) {
  const contenedor = document.getElementById("resultados");
  contenedor.innerHTML = "";

  if (!resultados.length) {
    contenedor.innerHTML = "<p>No se encontraron resultados.</p>";
    return;
  }

  let html = `<div style="overflow-x:auto;"><table class="tabla-resultados"><thead><tr>`;
  columnas.forEach((col) => {
    html += `<th>${col.mostrar}</th>`;
  });
  html += "</tr></thead><tbody>";

  resultados.forEach((fila) => {
    html += "<tr>";
    columnas.forEach((col) => {
      let valor = getValue(fila, col.keys);
      if (col.mostrar.includes("Fecha")) {
        valor = formatFechaEs(valor);
      }
      html += `<td data-label="${col.mostrar}">${valor || "-"}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  contenedor.innerHTML = html;
}
