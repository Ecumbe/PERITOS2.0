(() => {
    const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const PERITO_ORDER = [
        "JARAMILLO JARA FRANCO ISRAEL",
        "VARGAS QUINTANA NESTOR JOSELITO",
        "SERRANO ESTRADA ALEX DANIEL",
        "JAIME OLAYA MICHAEL JONATHAN",
        "BUSTAMANTE FAJARDO RONALD GEORGE"
    ];

    const { fetchAllRows, parseFechaFlexible, formatFechaEs } = window.peritosApi;

    const yearSelect = document.getElementById("yearSelect");
    const monthSelect = document.getElementById("monthSelect");
    const calendarGrid = document.getElementById("calendarGrid");
    const monthSummaryTitle = document.getElementById("monthSummaryTitle");
    const monthSummaryBody = document.getElementById("monthSummaryBody");

    const modal = document.getElementById("audienciaModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    const now = new Date();
    let selectedKey = "";
    let allRows = [];

    function normalizar(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .trim();
    }

    function initYearOptions() {
        const currentYear = now.getFullYear();
        const start = currentYear - 3;
        const end = currentYear + 4;

        for (let y = start; y <= end; y += 1) {
            const opt = document.createElement("option");
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    function isoDate(year, month, day) {
        const mm = String(month + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return `${year}-${mm}-${dd}`;
    }

    function getFirstWeekdayMondayBased(year, month) {
        const jsDay = new Date(year, month, 1).getDay();
        return (jsDay + 6) % 7;
    }

    function daysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function clearGrid() {
        calendarGrid.innerHTML = "";
    }

    function parseAudienciaDate(value) {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d;
    }

    function audienciaTime(value) {
        const d = parseAudienciaDate(value);
        if (!d) return "-";
        return d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    }

    function getRowsByAudienciaDate(year, month) {
        const byDate = new Map();

        allRows.forEach((row) => {
            const d = parseAudienciaDate(row.F_AUDICENCIA);
            if (!d) return;
            if (d.getFullYear() !== year || d.getMonth() !== month) return;

            const key = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key).push(row);
        });

        return byDate;
    }

    function openModal(dateKey, rows) {
        const [y, m, d] = dateKey.split("-").map(Number);
        modalTitle.textContent = `Audiencias del ${d} de ${monthNames[m - 1]} de ${y}`;

        if (!rows.length) {
            modalContent.innerHTML = `<div class="modal-empty">No hay audiencias registradas para este dia.</div>`;
            modal.classList.add("open");
            modal.setAttribute("aria-hidden", "false");
            return;
        }

        let html = "";
        rows.forEach((row) => {
            html += `
                <article class="audiencia-card">
                    <div class="audiencia-grid">
                        <div class="audiencia-item"><b>N° Instruccion Fiscal:</b> ${row.IF || "-"}</div>
                        <div class="audiencia-item"><b>Grado:</b> ${row.GRADO || "-"}</div>
                        <div class="audiencia-item"><b>Agente:</b> ${row.PERITO || "-"}</div>
                        <div class="audiencia-item"><b>Delito Tipificado:</b> ${row.DELITO_TIPIFICADO_EN_DELEGACION || "-"}</div>
                        <div class="audiencia-item"><b>Detenido/Sospechoso:</b> ${row.DETENIDO || "-"}</div>
                        <div class="audiencia-item"><b>Fiscal:</b> ${row.APELLIDOS_Y_NOMBRES_DEL_FISCAL || "-"}</div>
                        <div class="audiencia-item"><b>Unidad Fiscalia:</b> ${row.UNIDAD_ESPECIALIZADA_DE_FISCALIA || "-"}</div>
                        <div class="audiencia-item"><b>Fecha Recepcion PJ:</b> ${formatFechaEs(row.F_RECEPCION) || "-"}</div>
                        <div class="audiencia-item"><b>Hora Audiencia:</b> ${audienciaTime(row.F_AUDICENCIA)}</div>
                    </div>
                </article>
            `;
        });

        modalContent.innerHTML = html;
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }

    function renderMonthSummary(year, month) {
        const map = new Map();

        allRows.forEach((row) => {
            const d = parseFechaFlexible(row.F_RECEPCION);
            if (!d) return;
            if (d.getFullYear() !== year || d.getMonth() !== month) return;

            const grado = String(row.GRADO || "-").trim() || "-";
            const perito = String(row.PERITO || "-").trim() || "-";
            const key = `${grado}||${perito}`;

            if (!map.has(key)) {
                map.set(key, { grado, perito, total: 0 });
            }
            map.get(key).total += 1;
        });

        const list = Array.from(map.values());
        list.sort((a, b) => {
            const ai = PERITO_ORDER.indexOf(normalizar(a.perito));
            const bi = PERITO_ORDER.indexOf(normalizar(b.perito));
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return normalizar(a.perito).localeCompare(normalizar(b.perito));
        });

        monthSummaryTitle.textContent = `Peritos y delegaciones asignadas - ${monthNames[month]} ${year}`;

        if (!list.length) {
            monthSummaryBody.innerHTML = `<tr><td colspan="3">Sin delegaciones para este mes.</td></tr>`;
            return;
        }

        monthSummaryBody.innerHTML = list
            .map((item) => `
                <tr>
                    <td>${item.grado}</td>
                    <td>${item.perito}</td>
                    <td>${item.total}</td>
                </tr>
            `)
            .join("");
    }

    function renderCalendar() {
        const year = Number(yearSelect.value);
        const month = Number(monthSelect.value);
        const firstOffset = getFirstWeekdayMondayBased(year, month);
        const totalDays = daysInMonth(year, month);
        const byDate = getRowsByAudienciaDate(year, month);

        clearGrid();

        dayNames.forEach((name) => {
            const header = document.createElement("div");
            header.className = "day-name";
            header.textContent = name;
            calendarGrid.appendChild(header);
        });

        for (let i = 0; i < firstOffset; i += 1) {
            const empty = document.createElement("div");
            empty.className = "day-cell empty";
            calendarGrid.appendChild(empty);
        }

        for (let d = 1; d <= totalDays; d += 1) {
            const key = isoDate(year, month, d);
            const rows = byDate.get(key) || [];
            const hasAudiencia = rows.length > 0;

            const cell = document.createElement("div");
            cell.className = `day-cell${selectedKey === key ? " selected" : ""}${hasAudiencia ? " has-audiencia" : ""}`;
            cell.dataset.key = key;
            cell.innerHTML = `
                <div class="day-number">${d}</div>
                ${hasAudiencia ? `<div class="day-badge">${rows.length}</div>` : ""}
                <div class="day-meta">${hasAudiencia ? `${rows.length} audiencia(s)` : "Sin audiencias"}</div>
            `;

            cell.addEventListener("click", () => {
                selectedKey = key;
                renderCalendar();
                openModal(key, rows);
            });

            calendarGrid.appendChild(cell);
        }

        renderMonthSummary(year, month);
    }

    async function loadData() {
        monthSummaryBody.innerHTML = `<tr><td colspan="3">Cargando datos desde Supabase...</td></tr>`;

        try {
            allRows = await fetchAllRows(
                "id,IF,GRADO,PERITO,DELITO_TIPIFICADO_EN_DELEGACION,DETENIDO,APELLIDOS_Y_NOMBRES_DEL_FISCAL,UNIDAD_ESPECIALIZADA_DE_FISCALIA,F_RECEPCION,F_AUDICENCIA"
            );
        } catch (error) {
            allRows = [];
            monthSummaryBody.innerHTML = `<tr><td colspan="3">Error al cargar datos: ${error.message}</td></tr>`;
        }
    }

    async function init() {
        initYearOptions();
        monthSelect.value = String(now.getMonth());
        selectedKey = isoDate(now.getFullYear(), now.getMonth(), now.getDate());

        await loadData();
        renderCalendar();

        yearSelect.addEventListener("change", renderCalendar);
        monthSelect.addEventListener("change", renderCalendar);
        modalCloseBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    init();
})();
