const SUPABASE_URL = "https://rquhakdxqdoqwqsivgga.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWhha2R4cWRvcXdxc2l2Z2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg0MjgsImV4cCI6MjA5MDE2NDQyOH0.QTyds7vKjqrBBGxq9Nqufng_5Qaw9w6ObgdhguAq2NM";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("No se encontro el SDK de Supabase en window.supabase.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizar(texto) {
  return (texto || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function parseFechaFlexible(valor) {
  if (!valor) return null;

  const txt = String(valor).trim();
  if (!txt) return null;

  if (/^\d{4}[\/-]\d{2}[\/-]\d{2}$/.test(txt)) {
    const normalized = txt.replace(/\//g, "-");
    const d = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(txt)) {
    const parts = txt.split(/[\/-]/);
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(txt);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatFechaEs(valor) {
  const d = parseFechaFlexible(valor);
  if (!d) return valor || "-";
  return d.toLocaleDateString("es-EC");
}

async function fetchAllRows(columns = "*") {
  const PAGE_SIZE = 1000;
  let from = 0;
  const allRows = [];

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabaseClient
      .from("FLAGRANCIA")
      .select(columns)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message || "No se pudo leer FLAGRANCIA en Supabase.");
    }

    const chunk = data || [];
    allRows.push(...chunk);

    if (chunk.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return allRows;
}

window.peritosApi = {
  supabase: supabaseClient,
  normalizar,
  getValue,
  parseFechaFlexible,
  formatFechaEs,
  fetchAllRows,
};
