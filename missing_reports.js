const EXPECTED_MAP_PROJECTS_GID = '1907104609';
let missingReportsTrigger = null;
let _missingCache = null;

function setMissingReportsCache(cache) {
    _missingCache = cache;
    if (typeof window !== 'undefined') window._missingCache = cache;
}

function getMissingReportsCache() {
    return (typeof window !== 'undefined' && window._missingCache) || _missingCache;
}

function parseExpectedMapProjects(table) {
    validateGvizTable(table, 3, 'new map data source04');
    const headers = ['BRANCH ID', 'PROJECT ID', 'PROJECT NAME'];
    const matchesHeader = (value, expected) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase() === expected;
    const hasColumnHeaders = headers.every((header, index) => matchesHeader(table.cols[index].label, header));
    const hasRowHeaders = headers.every((header, index) => matchesHeader(gvizCellText(table.rows[0], index), header));
    if (!hasColumnHeaders && !hasRowHeaders) throw new Error('new map data source04: expected BRANCH ID, PROJECT ID, PROJECT NAME in columns A:C.');
    const projects = new Map();
    table.rows.forEach(row => {
        const entityId = gvizCellText(row, 0);
        const projectId = String(gvizCellValue(row, 1) ?? '').trim();
        const projectName = gvizCellText(row, 2);
        if (!projectId || !projectName || projectId.toUpperCase() === 'PROJECT ID') return;
        const completionRaw = gvizCellText(row, 5);
        const isMissingReport = completionRaw.toUpperCase().includes('MISSING REPORT');
        const completion = isMissingReport ? null : gvizCellPercent(row, 5);
        projects.set(projectId, { entityId, projectId, projectName, completion });
    });
    return [...projects.values()];
}

function missingReportCountry(entityId, registryIndex) {
    const entity = registryIndex.get(entityId);
    const country = entity ? entity.country : '';
    const geo = findCountryGeo(country);
    return {
        key: geo ? geo.id : (country || 'unknown'),
        name: geo ? geo.nameAr : (country || 'دولة غير محددة')
    };
}

function isMissingReportSlicerActive() {
    const state = (typeof mapControlState !== 'undefined' ? mapControlState : (typeof window !== 'undefined' ? window.mapControlState : null));
    if (!state) return false;
    const isAnalysis = (typeof isBusinessAnalysisMode !== 'undefined' ? isBusinessAnalysisMode : (typeof window !== 'undefined' ? window.isBusinessAnalysisMode : false));
    if (isAnalysis) return false;
    return state.completionSlicerEnabled === true;
}

function isMissingReportExcludedByCompletion(project) {
    if (!isMissingReportSlicerActive()) return false;
    if (!project) return false;
    const completion = Number(project.completion);
    return project.completion !== null && Number.isFinite(completion) && completion >= 95;
}

function summarizeMissingMapReports(projects, mainTable, registryIndex) {
    const reportedIds = new Set(mainTable.rows
        .filter(row => gvizCellText(row, 5))
        .map(row => String(gvizCellValue(row, 2) ?? '').trim()));
    const countries = new Map();
    const effectiveProjects = projects.filter(project => !isMissingReportExcludedByCompletion(project));
    effectiveProjects.forEach(project => {
        const country = missingReportCountry(project.entityId, registryIndex);
        if (!countries.has(country.key)) {
            countries.set(country.key, { countryName: country.name, total: 0, missing: [] });
        }
        const group = countries.get(country.key);
        group.total += 1;
        if (!reportedIds.has(project.projectId)) group.missing.push(project);
    });
    return [...countries.values()]
        .filter(group => group.missing.length)
        .sort((a, b) => a.countryName.localeCompare(b.countryName, 'ar'));
}

function renderMissingReportCountry(group) {
    const projects = [...group.missing].sort((a, b) => a.projectName.localeCompare(b.projectName, 'ar'));
    return `<section class="missing-reports-country">
        <div class="missing-reports-country-heading">
            <h3>${escapeHtml(group.countryName)}</h3>
            <span><b>${group.missing.length}</b> مشاريع من أصل <b>${group.total}</b> مشاريع</span>
        </div>
        <ul>${projects.map(project => {
            const pct = project.completion === null ? '-' : `${Math.round(project.completion)}%`;
            return `<li><bdi>${escapeHtml(project.projectName)}</bdi> <span class="missing-reports-completion">(${pct})</span></li>`;
        }).join('')}</ul>
    </section>`;
}

function setMissingReportsMessage(message, isError = false) {
    const body = document.getElementById('missing-reports-body');
    const summary = document.getElementById('missing-reports-summary');
    summary.textContent = '';
    body.setAttribute('aria-busy', 'false');
    body.innerHTML = `<p class="missing-reports-message${isError ? ' is-error' : ''}" role="status">${escapeHtml(message)}</p>`;
    document.querySelectorAll('[data-missing-reports-trigger]').forEach(button => {
        button.classList.remove('has-missing-reports');
        button.setAttribute('aria-label', 'مشاريع غير محدثة');
    });
}

function renderMissingMapReports(projects, groups) {
    const effectiveProjects = projects.filter(project => !isMissingReportExcludedByCompletion(project));
    const totalMissing = groups.reduce((sum, group) => sum + group.missing.length, 0);
    if (!projects.length) return setMissingReportsMessage('لا توجد مشروعات في قائمة المصدر.');
    if (!effectiveProjects.length || !totalMissing) return setMissingReportsMessage('كل المشروعات محدثة. لا توجد مشاريع غير محدثة.');
    document.getElementById('missing-reports-summary').textContent = `${totalMissing} مشروع غير محدث من ${effectiveProjects.length} مشروع`;
    const body = document.getElementById('missing-reports-body');
    body.setAttribute('aria-busy', 'false');
    body.innerHTML = groups.map(renderMissingReportCountry).join('');
    document.querySelectorAll('[data-missing-reports-trigger]').forEach(button => {
        button.classList.add('has-missing-reports');
        button.setAttribute('aria-label', `مشاريع غير محدثة: ${totalMissing} مشروع`);
    });
}

async function loadMissingMapReports(mainTable, registryIndex) {
    setMissingReportsMessage('جاري التحقق من المشاريع غير المحدثة…');
    document.getElementById('missing-reports-body').setAttribute('aria-busy', 'true');
    try {
        const table = await fetchSheetByGidJSONP(EXPECTED_MAP_PROJECTS_GID, 'new map data source04');
        const projects = parseExpectedMapProjects(table);
        setMissingReportsCache({ projects, mainTable, registryIndex });
        renderMissingMapReports(projects, summarizeMissingMapReports(projects, mainTable, registryIndex));
    } catch (error) {
        console.error('Unable to check missing map reports:', error);
        setMissingReportsMessage('تعذّر التحقق من المشاريع غير المحدثة. أعد تحميل الصفحة للمحاولة مرة أخرى.', true);
    }
}

function refreshMissingMapReports() {
    const cache = getMissingReportsCache();
    if (!cache) return;
    const { projects, mainTable, registryIndex } = cache;
    renderMissingMapReports(projects, summarizeMissingMapReports(projects, mainTable, registryIndex));
    positionMissingReportsPanel();
}

function positionMissingReportsPanel() {
    const panel = document.getElementById('missing-reports-panel');
    if (panel.hidden || !missingReportsTrigger) return;
    const bounds = missingReportsTrigger.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 24);
    const top = Math.min(bounds.bottom + 8, Math.max(12, window.innerHeight - 180));
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12))}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(0, window.innerHeight - top - 12)}px`;
}

function closeMissingReportsPanel(restoreFocus = false) {
    document.getElementById('missing-reports-panel').hidden = true;
    document.querySelectorAll('[data-missing-reports-trigger]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (restoreFocus && missingReportsTrigger) missingReportsTrigger.focus();
    missingReportsTrigger = null;
}

function toggleMissingReportsPanel(button) {
    const panel = document.getElementById('missing-reports-panel');
    if (!panel.hidden) return closeMissingReportsPanel(true);
    missingReportsTrigger = button;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    positionMissingReportsPanel();
    document.getElementById('missing-reports-close').focus();
}

function initMissingReportsPanel() {
    const panel = document.getElementById('missing-reports-panel');
    document.querySelectorAll('[data-missing-reports-trigger]').forEach(button => {
        button.addEventListener('click', () => toggleMissingReportsPanel(button));
    });
    document.getElementById('missing-reports-close').addEventListener('click', () => closeMissingReportsPanel(true));
    document.addEventListener('click', event => {
        if (!panel.hidden && !panel.contains(event.target) && !event.target.closest('[data-missing-reports-trigger]')) closeMissingReportsPanel();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) closeMissingReportsPanel(true);
    });
    document.addEventListener('focusin', event => {
        if (!panel.hidden && !panel.contains(event.target) && event.target !== missingReportsTrigger) closeMissingReportsPanel();
    });
    window.addEventListener('resize', () => closeMissingReportsPanel());
}
