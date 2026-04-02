(() => {
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
const inputEl = document.getElementById("busquedaInput");
const buscarBtnEl = document.getElementById("buscarBtn");
const resultadosEl = document.getElementById("resultados");
const busquedaSectionEl = document.querySelector("section.busqueda");

let ifIndexCache = [];
let ifIndexPromise = null;
let debounceTimer = null;
let previewSeq = 0;

const sugerenciasEl = document.createElement("div");
sugerenciasEl.id = "if-sugerencias";
sugerenciasEl.style.marginTop = "10px";
sugerenciasEl.style.display = "none";
sugerenciasEl.style.border = "1px solid #d6dde5";
sugerenciasEl.style.borderRadius = "8px";
sugerenciasEl.style.background = "#fff";
sugerenciasEl.style.padding = "10px";
sugerenciasEl.style.width = "100%";
sugerenciasEl.style.boxSizing = "border-box";

if (busquedaSectionEl && busquedaSectionEl.parentNode) {
    busquedaSectionEl.insertAdjacentElement("afterend", sugerenciasEl);
}

buscarBtnEl.addEventListener("click", buscar);
inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscar();
});

inputEl.addEventListener("input", () => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        mostrarVistaPrevia();
    }, 180);
});

// Precarga en segundo plano para que las sugerencias respondan rapido al escribir.
ensureIfIndex().catch(() => {});

function normalizarIf(valor) {
    return String(valor ?? "").replace(/\D/g, "");
}

async function ensureIfIndex() {
    if (ifIndexCache.length > 0) {
        return ifIndexCache;
    }

    if (ifIndexPromise) {
        return ifIndexPromise;
    }

    ifIndexPromise = (async () => {
        const PAGE_SIZE = 1000;
        let from = 0;
        const filas = [];

        while (true) {
            const to = from + PAGE_SIZE - 1;
            const { data, error } = await window.peritosApi.supabase
                .from("FLAGRANCIA")
                .select("id,IF,DETENIDO,PERITO")
                .order("id", { ascending: false })
                .range(from, to);

            if (error) {
                throw new Error(error.message || "No se pudo cargar indice de IF.");
            }

            const chunk = data || [];
            filas.push(...chunk);

            if (chunk.length < PAGE_SIZE) {
                break;
            }
            from += PAGE_SIZE;
        }

        ifIndexCache = filas.map((row) => ({
            id: row.id,
            IF: row.IF,
            IF_DIGITS: normalizarIf(row.IF),
            DETENIDO: row.DETENIDO || "",
            PERITO: row.PERITO || "",
        }));

        return ifIndexCache;
    })();

    try {
        return await ifIndexPromise;
    } finally {
        ifIndexPromise = null;
    }
}

async function buscarPorIfParcial(soloDigitos) {
    await ensureIfIndex();

    const matches = ifIndexCache
        .filter((row) => row.IF_DIGITS.includes(soloDigitos))
        .slice(0, 200);

    if (!matches.length) {
        return { data: [], error: null };
    }

    const ids = matches.map((m) => m.id).filter((id) => id !== null && id !== undefined);
    const CHUNK = 100;
    const detalles = [];

    for (let i = 0; i < ids.length; i += CHUNK) {
        const sub = ids.slice(i, i + CHUNK);
        const { data, error } = await window.peritosApi.supabase
            .from("FLAGRANCIA")
            .select("*")
            .in("id", sub);

        if (error) {
            return { data: [], error };
        }

        detalles.push(...(data || []));
    }

    detalles.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    return { data: detalles, error: null };
}

async function mostrarVistaPrevia() {
    const currentSeq = ++previewSeq;
    const txt = inputEl.value.trim();
    const soloDigitos = normalizarIf(txt);

    if (soloDigitos.length < 4) {
        sugerenciasEl.style.display = "none";
        sugerenciasEl.innerHTML = "";
        return;
    }

    sugerenciasEl.style.display = "block";
    sugerenciasEl.innerHTML = `<div style="font-size:12px;color:#5b6572;padding:6px;">Buscando coincidencias...</div>`;

    try {
        await ensureIfIndex();
        if (currentSeq !== previewSeq) {
            return;
        }

        const sugerencias = ifIndexCache
            .filter((row) => row.IF_DIGITS.includes(soloDigitos))
            .slice(0, 12);

        if (!sugerencias.length) {
            sugerenciasEl.innerHTML = `<div style="font-size:12px;color:#5b6572;padding:6px;">Sin coincidencias parecidas.</div>`;
            return;
        }

        let html = `
            <div style="font-size:12px;color:#5b6572;padding:2px 2px 8px 2px;">Coincidencias parecidas (vista previa):</div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr>
                            <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">IF</th>
                            <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">Detenido</th>
                            <th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;color:#374151;">Accion</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        sugerencias.forEach((row) => {
            html += `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#111827;font-weight:600;">${row.IF || "-"}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#334155;">${row.DETENIDO || "-"}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;">
                        <button type="button" data-if="${row.IF}" style="border:0;background:#1677c8;color:#ffffff;padding:6px 10px;border-radius:6px;cursor:pointer;">Ver</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
        sugerenciasEl.innerHTML = html;

        Array.from(sugerenciasEl.querySelectorAll("button[data-if]")).forEach((btn) => {
            btn.addEventListener("click", () => {
                inputEl.value = btn.getAttribute("data-if") || "";
                sugerenciasEl.style.display = "none";
                buscar();
            });
        });
    } catch (error) {
        sugerenciasEl.innerHTML = `<div style="font-size:12px;color:#a33;padding:6px;">Error cargando sugerencias: ${error.message}</div>`;
    }
}

async function buscar() {
    const queryRaw = inputEl.value.trim();
    if (!queryRaw) return;

    sugerenciasEl.style.display = "none";
    resultadosEl.innerHTML = "<p>Consultando en Supabase...</p>";

    const safe = queryRaw.replace(/[%]/g, "");
    const soloDigitos = queryRaw.replace(/\D/g, "");

    const consultas = [
        window.peritosApi.supabase
            .from("FLAGRANCIA")
            .select("*")
            .ilike("DETENIDO", `%${safe}%`)
            .order("id", { ascending: false })
            .limit(300),
    ];

    if (soloDigitos.length > 0) {
        consultas.push(
            window.peritosApi.supabase
                .from("FLAGRANCIA")
                .select("*")
                .eq("IF", Number(soloDigitos))
                .limit(50)
        );
    }

    if (soloDigitos.length >= 4) {
        consultas.push(buscarPorIfParcial(soloDigitos));
    }

    const respuestas = await Promise.all(consultas);
    const conError = respuestas.find((r) => r.error);

    if (conError && conError.error) {
        resultadosEl.innerHTML = `<p>Error al consultar Supabase: ${conError.error.message}</p>`;
        return;
    }

    const combinados = respuestas.flatMap((r) => r.data || []);
    const mapById = new Map();
    combinados.forEach((row) => {
        mapById.set(String(row.id ?? row.IF ?? Math.random()), row);
    });

    mostrarResultados(Array.from(mapById.values()));
}

function mostrarResultados(resultados) {
    resultadosEl.innerHTML = "";

    if (!resultados.length) {
        resultadosEl.innerHTML = "<p>No se encontraron resultados.</p>";
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
    resultadosEl.innerHTML = html;
}

})();
