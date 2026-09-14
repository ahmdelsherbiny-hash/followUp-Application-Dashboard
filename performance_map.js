// Dedicated Interactive Performance Map Logic for Arab Contractors

const SHEET_ID = '1eRp9k1JWjvyFO8IymyEUAu7Sd6woqgu4Oe0D26xY5k4';
const MAIN_DATA_GID = '1034068003';
const EARLY_ALERT_GID = '310448800';
const MAP_REGISTRY_GID = '375973192';
const ENTITY_TYPES = new Set(['BRANCH', 'COMPANY']);

let executiveMap = null;
let markersGroup = null;
let currentTileLayer = null;
let currentTileStyle = 'dark';
let showBranches = true;
let showProjects = true;
let currentRegion = 'all';
let menaGeoJsonData = null;
let geoJsonLayer = null;
let isBusinessAnalysisMode = false;
let businessBubblesGroup = null;
let maxCountryValueUsd = 1;

let reportsData = [];
let globalRawReports = [];
let registeredEntities = [];
let branchToCountryMap = {};
let projectToBranchMap = {};
let projectToCountryMap = {};

const MAP_CONTROL_STATE_KEY = 'mapControlCenterStateV1';
const MAP_CONTROL_TABS = new Set(['map', 'ticker', 'settings']);
const TICKER_SORT_CRITERIA = new Set(['projectCount', 'healthScore', 'progressAverage']);
let mapControlState = normalizeMapControlState(null, 'corporate');
let activeMapControlMenu = null;

function normalizeMapControlState(storedStateCandidate, legacyTheme) {
    const storedState = storedStateCandidate && typeof storedStateCandidate === 'object' ? storedStateCandidate : {};
    const theme = storedState.theme === 'aegov' || storedState.theme === 'corporate'
        ? storedState.theme
        : (legacyTheme === 'aegov' ? 'aegov' : 'corporate');
    const businessAnalysis = storedState.businessAnalysis === true;
    return {
        version: 1,
        showProjects: storedState.showProjects !== false,
        showBranches: storedState.showBranches !== false,
        businessAnalysis,
        earlyWarning: businessAnalysis ? false : storedState.earlyWarning === true,
        theme,
        tickerCriterion: TICKER_SORT_CRITERIA.has(storedState.tickerCriterion) ? storedState.tickerCriterion : 'projectCount',
        tickerDirection: storedState.tickerDirection === 'asc' ? 'asc' : 'desc',
        completionSlicerEnabled: storedState.completionSlicerEnabled === true
    };
}

function loadMapControlState() {
    const legacyTheme = localStorage.getItem('appTheme') || 'corporate';
    const serializedState = localStorage.getItem(MAP_CONTROL_STATE_KEY);
    if (!serializedState) return normalizeMapControlState(null, legacyTheme);
    try {
        return normalizeMapControlState(JSON.parse(serializedState), legacyTheme);
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return normalizeMapControlState(null, legacyTheme);
    }
}

function saveMapControlState() {
    localStorage.setItem(MAP_CONTROL_STATE_KEY, JSON.stringify(mapControlState));
}

const MENA_AFRICA_BOUNDS = [
    [-22.0, -22.0], // South-West (below Zambia & West of Guinea / Atlantic)
    [42.0, 72.0]    // North-East (above Spain/Morocco/Levant & East of Oman/Gulf)
];

const ALLOWED_NAV_BOUNDS = [
    [-38.0, -35.0],
    [62.0, 105.0]   // Fully covers Middle East, Gulf, Asia & Indian Ocean without edge collisions
];

let currentHoveredCountryLayers = [];

function getMapBaseTileUrl() {
    if (currentTileStyle === 'satellite') {
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'aegov';
    return isLightTheme
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        : 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
}

function setMapTheme(themeName) {
    const theme = themeName === 'aegov' ? 'aegov' : 'corporate';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appTheme', theme);
    mapControlState.theme = theme;
    saveMapControlState();
    syncMapControlCenterUI();
    if (currentTileLayer && executiveMap && currentTileStyle !== 'satellite') currentTileLayer.setUrl(getMapBaseTileUrl());
}

function toggleMapTheme() {
    const nextTheme = mapControlState.theme === 'corporate' ? 'aegov' : 'corporate';
    setMapTheme(nextTheme);
}

// Get high-fidelity vector flag icon class based on country name
function getFlagIconClass(countryName) {
    if (!countryName) return 'fi-xx';
    const clean = String(countryName).trim();
    if (typeof findCountryGeo === 'function') {
        const geo = findCountryGeo(clean);
        if (geo && geo.flagClass) return geo.flagClass;
    }
    const flags = {
        'جمهورية مصر العربية': 'fi-eg', 'مصر': 'fi-eg',
        'المملكة العربية السعودية': 'fi-sa', 'السعودية': 'fi-sa',
        'الإمارات العربية المتحدة': 'fi-ae', 'الإمارات': 'fi-ae',
        'جمهورية نيجيريا الاتحادية': 'fi-ng', 'نيجيريا': 'fi-ng',
        'الجمهورية الجزائرية الديمقراطية الشعبية': 'fi-dz', 'الجزائر': 'fi-dz',
        'جمهورية تشاد': 'fi-td', 'تشاد': 'fi-td',
        'اتحاد جزر القمر': 'fi-km', 'جزر القمر': 'fi-km',
        'سلطنة عُمان': 'fi-om', 'سلطنة عمان': 'fi-om', 'عمان': 'fi-om',
        'أوغندا': 'fi-ug', 'جمهورية أوغندا': 'fi-ug',
        'زامبيا': 'fi-zm', 'جمهورية زامبيا': 'fi-zm',
        'غانا': 'fi-gh', 'جمهورية غانا': 'fi-gh',
        'غينيا': 'fi-gn', 'جمهورية غينيا': 'fi-gn',
        'الكاميرون': 'fi-cm', 'جمهورية الكاميرون': 'fi-cm',
        'كوت ديفوار': 'fi-ci', 'ساحل العاج': 'fi-ci',
        'الكونغو': 'fi-cg', 'جمهورية الكونغو': 'fi-cg',
        'جمهورية الكونغو الديمقراطية': 'fi-cd', 'الكونغو الديمقراطية': 'fi-cd',
        'قطر': 'fi-qa', 'دولة قطر': 'fi-qa',
        'دولة الكويت': 'fi-kw', 'الكويت': 'fi-kw',
        'جمهورية العراق': 'fi-iq', 'العراق': 'fi-iq',
        'جمهورية تنزانيا المتحدة': 'fi-tz', 'تنزانيا': 'fi-tz',
        'دولة ليبيا': 'fi-ly', 'ليبيا': 'fi-ly',
        'جمهورية السودان': 'fi-sd', 'السودان': 'fi-sd',
        'المملكة المغربية': 'fi-ma', 'المغرب': 'fi-ma',
        'الجمهورية اللبنانية': 'fi-lb', 'لبنان': 'fi-lb',
        'غينيا الاستوائية': 'fi-gq', 'جمهورية غينيا الاستوائية': 'fi-gq',
        'موريتانيا': 'fi-mr', 'الجمهورية الإسلامية الموريتانية': 'fi-mr',
        'إثيوبيا': 'fi-et', 'اثيوبيا': 'fi-et',
        'جيبوتي': 'fi-dj', 'الصومال': 'fi-so',
        'جنوب السودان': 'fi-ss', 'كينيا': 'fi-ke',
        'الأردن': 'fi-jo', 'المملكة الأردنية الهاشمية': 'fi-jo',
        'فلسطين': 'fi-ps', 'دولة فلسطين': 'fi-ps',
        'سوريا': 'fi-sy', 'الجمهورية العربية السورية': 'fi-sy',
        'اليمن': 'fi-ye', 'الجمهورية اليمنية': 'fi-ye',
        'تونس': 'fi-tn', 'الجمهورية التونسية': 'fi-tn',
        'البحرين': 'fi-bh', 'مملكة البحرين': 'fi-bh'
    };
    for (const k in flags) {
        if (clean.includes(k) || k.includes(clean)) return flags[k];
    }
    return 'fi-xx';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function countriesMatch(first, second) {
    if (!first || !second) return false;
    const a = String(first).trim();
    const b = String(second).trim();
    const geoA = typeof findCountryGeo === 'function' ? findCountryGeo(a) : null;
    const geoB = typeof findCountryGeo === 'function' ? findCountryGeo(b) : null;
    if (geoA && geoB) return geoA.id === geoB.id;
    const normalize = value => String(value).toLowerCase().replace(/[\s\-_،,]/g, '');
    const normalizedA = normalize(a);
    const normalizedB = normalize(b);
    return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

function fetchGvizJSONP(queryParameter, sourceLabel) {
    return new Promise((resolve, reject) => {
        const callbackName = 'gvizCallback_map_' + Math.random().toString(36).substring(2, 10);
        const script = document.createElement('script');
        script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&${queryParameter}&_nocache=${Date.now()}`;
        
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout loading sheet: ${sourceLabel}`));
        }, 15000);

        function cleanup() {
            clearTimeout(timeout);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[callbackName] = function(response) {
            cleanup();
            if (response && (response.table || response.status === 'ok')) {
                resolve(response.table);
            } else {
                reject(new Error(`Invalid response for sheet: ${sourceLabel}`));
            }
        };

        script.onerror = function() {
            cleanup();
            reject(new Error(`Network error loading sheet: ${sourceLabel}`));
        };

        document.head.appendChild(script);
    });
}

function robustParseDate(val, fmt) {
    if (val && typeof val === 'string' && val.startsWith('Date(')) {
        const m = val.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return new Date(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
    }
    if (fmt) {
        const parts = String(fmt).split(/[-/]/);
        if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
            return new Date(parts[2], parseInt(parts[1])-1, parts[0]);
        }
        const d = new Date(fmt);
        if (!isNaN(d.getTime())) return d;
    }
    if (val) {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 30000) return new Date(Math.round((n - 25569) * 86400000));
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

function gvizCellValue(row, columnIndex) {
    const cell = row && row.c ? row.c[columnIndex] : null;
    return cell ? cell.v : null;
}

function gvizCellText(row, columnIndex) {
    const cell = row && row.c ? row.c[columnIndex] : null;
    if (!cell) return '';
    return String(cell.f ?? cell.v ?? '').trim();
}

function gvizCellNumber(row, columnIndex) {
    const rawValue = gvizCellValue(row, columnIndex);
    const numericValue = Number(String(rawValue ?? '').replace(/,/g, ''));
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function gvizCellPercent(row, columnIndex) {
    const cell = row && row.c ? row.c[columnIndex] : null;
    if (!cell) return 0;
    if (cell.f && typeof cell.f === 'string' && cell.f.includes('%')) {
        const parsed = Number(cell.f.replace(/%/g, '').replace(/,/g, '').trim());
        if (Number.isFinite(parsed)) return parsed;
    }
    const rawValue = cell.v;
    const numericValue = Number(String(rawValue ?? '').replace(/,/g, ''));
    if (!Number.isFinite(numericValue)) return 0;
    return numericValue > 0 && numericValue <= 1 ? numericValue * 100 : numericValue;
}

function gvizCellDate(row, columnIndex) {
    const cell = row && row.c ? row.c[columnIndex] : null;
    return cell ? robustParseDate(cell.v, cell.f) : null;
}

function mainFinancialFields(row) {
    const contractValue = gvizCellNumber(row, 7);
    const executedWorkTotal = gvizCellNumber(row, 8);
    return {
        contractValue,
        valueUsd: contractValue,
        executedWorkTotal,
        executionProgressPercent: gvizCellPercent(row, 9) || (contractValue > 0 ? executedWorkTotal / contractValue * 100 : 0),
        executedWorkApproved: gvizCellNumber(row, 10),
        approvedExecutionPercent: gvizCellPercent(row, 11),
        paidWork: gvizCellNumber(row, 12),
        paidToApprovedPercent: gvizCellPercent(row, 13),
        collectedLiquidity: gvizCellNumber(row, 14),
        collectedToApprovedPercent: gvizCellPercent(row, 15),
        dueDebt: gvizCellNumber(row, 16),
        payableToExecutedPercent: gvizCellPercent(row, 17),
        uncollectibleWork: gvizCellNumber(row, 18),
        unpayableToApprovedPercent: gvizCellPercent(row, 19),
        profitLoss: gvizCellNumber(row, 20),
        profitabilityPercent: gvizCellPercent(row, 21),
        wagesCost: gvizCellNumber(row, 22),
        wagesToApprovedPercent: gvizCellPercent(row, 23)
    };
}

function mainScheduleFields(row) {
    const totalDurationDays = gvizCellNumber(row, 26);
    const elapsedDays = gvizCellNumber(row, 27);
    return {
        contractStartDate: gvizCellText(row, 24),
        revisedEndDate: gvizCellText(row, 25),
        rawStartDate: gvizCellDate(row, 24),
        rawEndDate: gvizCellDate(row, 25),
        totalDurationDays,
        elapsedDays,
        timeElapsedPercent: gvizCellPercent(row, 28) || (totalDurationDays > 0 ? elapsedDays / totalDurationDays * 100 : 0)
    };
}

function parseFinalMainRow(row) {
    const projectId = gvizCellText(row, 2);
    const projectName = gvizCellText(row, 5);
    if (!projectId || !projectName) return null;
    const reportDate = gvizCellDate(row, 4);
    return {
        branchName: gvizCellText(row, 0),
        entityId: gvizCellText(row, 1),
        projectId,
        country: gvizCellText(row, 3),
        timestamp: reportDate ? reportDate.toISOString() : '',
        reportDate,
        projectName,
        mapsLink: gvizCellText(row, 6),
        ...mainFinancialFields(row),
        ...mainScheduleFields(row),
        isProjectReport: true
    };
}

function parseFinalMainReports(table) {
    return table && Array.isArray(table.rows) ? table.rows.map(parseFinalMainRow).filter(Boolean) : [];
}

function earlyAlertAnswers(row) {
    return {
        claimsStatus: gvizCellText(row, 3),
        hasBillOfQuantities: gvizCellText(row, 4),
        boqAccuracy: gvizCellText(row, 5),
        lgIssued: gvizCellText(row, 6),
        meetingClient15Days: gvizCellText(row, 7),
        formalLetterSent: gvizCellText(row, 8),
        supplySchedulePrepared: gvizCellText(row, 9),
        mepApproved: gvizCellText(row, 10),
        cashFlowPlanPrepared: gvizCellText(row, 11),
        negativeCashFlow: gvizCellText(row, 12),
        subcontractorsDueAnswer: gvizCellText(row, 13),
        subcontractorsDue: gvizCellNumber(row, 13)
    };
}

function parseFinalEarlyAlertRow(row) {
    const projectId = gvizCellText(row, 0);
    if (!projectId) return null;
    const reportDate = gvizCellDate(row, 1);
    return {
        projectId,
        projectName: gvizCellText(row, 2),
        timestamp: reportDate ? reportDate.toISOString() : '',
        reportDate,
        answers: earlyAlertAnswers(row)
    };
}

function parseFinalEarlyAlerts(table) {
    return table && Array.isArray(table.rows) ? table.rows.map(parseFinalEarlyAlertRow).filter(Boolean) : [];
}

function mergeEarlyAlertAnswers(mainReports, earlyAlerts) {
    const latestAlerts = latestReportsByProject(earlyAlerts);
    return mainReports.map(report => {
        const earlyAlert = latestAlerts.get(report.projectId);
        return earlyAlert ? { ...report, ...earlyAlert.answers } : report;
    });
}

function parseMapRegistryRow(row, rowIndex) {
    const entityId = gvizCellText(row, 1);
    const entityType = gvizCellText(row, 2).toUpperCase();
    const country = gvizCellText(row, 4);
    if (!entityId || !country || !ENTITY_TYPES.has(entityType)) {
        console.warn(`Map Registry row ${rowIndex + 2} excluded: invalid Entity ID, Entity Type, or Country.`);
        return null;
    }
    return {
        entityName: gvizCellText(row, 0) || entityId,
        entityId,
        entityType,
        mapsLink: gvizCellText(row, 3),
        country
    };
}

function parseMapRegistry(table) {
    if (!table || !Array.isArray(table.rows)) return [];
    return table.rows.map(parseMapRegistryRow).filter(Boolean);
}

function buildMapRegistryIndex(entities) {
    const registryIndex = new Map();
    entities.forEach(entity => {
        if (registryIndex.has(entity.entityId)) {
            console.warn(`Duplicate Map Registry Entity ID ${entity.entityId}; using the last valid row.`);
        }
        registryIndex.set(entity.entityId, entity);
    });
    return registryIndex;
}

function joinMainReportsWithRegistry(mainReports, registryIndex) {
    return mainReports.flatMap(report => {
        const entity = registryIndex.get(report.entityId);
        if (!entity) {
            console.warn(`Main project ${report.projectId} excluded: Entity ID ${report.entityId || '(blank)'} is not in Map Registry.`);
            return [];
        }
        return [{
            ...report,
            branchName: entity.entityName,
            country: entity.country,
            entityType: entity.entityType,
            entityMapsLink: entity.mapsLink
        }];
    });
}

function filterCountryProjectsByEntityType(projects, activeEntityTypes) {
    return projects.filter(project => activeEntityTypes.has(project.entityType));
}

function applyMapRegistry(entities) {
    registeredEntities = entities;
    branchToCountryMap = {};
    projectToBranchMap = {};
    projectToCountryMap = {};
    entities.forEach(entity => {
        branchToCountryMap[entity.entityName] = entity.country;
    });
}

function formatCurrencyUSD(value) {
    if (value >= 1e9) {
        return `$${(value / 1e9).toFixed(3)}B`;
    } else if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
        return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
}

function chartValuesWithMinimumShare(values) {
    const cleanValues = values.map(value => Math.max(0, Number(value) || 0));
    const total = cleanValues.reduce((sum, value) => sum + value, 0);
    const activeCount = cleanValues.filter(value => value > 0).length;
    if (!total || !activeCount) return cleanValues;

    const minimumShare = Math.min(0.03, 0.5 / activeCount);
    const minimumValue = total * minimumShare;
    const displayValues = cleanValues.map(value => value > 0 ? Math.max(value, minimumValue) : 0);
    const displayTotal = displayValues.reduce((sum, value) => sum + value, 0);
    return displayValues.map(value => value ? value * total / displayTotal : 0);
}

let boardCompositionChart = null;
let boardCompositionRevealObserver = null;
let countryCharts = [];
let countryChartObserver = null;
let countryChartAnimationFrame = null;
let activeCountryEntityTypes = new Set(ENTITY_TYPES);
let activeCountryBoardContext = null;

function reportUsd(report, field) {
    return Number(report[field]) || 0;
}

function isProjectExcludedByCompletion(report, forBusinessAnalysis = false) {
    if (!mapControlState.completionSlicerEnabled) return false;
    if (forBusinessAnalysis || isBusinessAnalysisMode) return false;
    if (!report) return false;
    const progress = Number(report.executionProgressPercent !== undefined && report.executionProgressPercent !== null
        ? report.executionProgressPercent
        : (report.plannedProgressPercent || 0)) || 0;
    return progress >= 95;
}

function latestProjectReports(includeCompleted = false) {
    const allLatest = [...latestReportsByProject(reportsData).values()];
    if (includeCompleted || isBusinessAnalysisMode || !mapControlState.completionSlicerEnabled) {
        return allLatest;
    }
    return allLatest.filter(report => !isProjectExcludedByCompletion(report));
}

function renderBoardBriefing() {
    const latest = latestProjectReports();
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    if (!latest.length) return;

    const portfolioValue = latest.reduce((sum, report) => sum + (report.valueUsd || 0), 0);
    const collectibleDebt = latest.reduce((sum, report) => sum + reportUsd(report, 'dueDebt'), 0);
    const collected = latest.reduce((sum, report) => sum + reportUsd(report, 'collectedLiquidity'), 0);
    const collectionRate = portfolioValue ? (collected / portfolioValue) * 100 : 0;
    const newest = latest.reduce((last, report) => !last || (report.reportDate && report.reportDate > last) ? report : last, null);

    setText('board-collectible-debt', formatCurrencyUSD(collectibleDebt));
    const debtEl = document.getElementById('board-collectible-debt');
    if (debtEl) debtEl.insertAdjacentHTML('beforeend', '<span>مديونية قابلة للتحصيل</span>');
    setText('board-portfolio-value', formatCurrencyUSD(portfolioValue));
    setText('board-collection-rate', `${collectionRate.toFixed(1)}%`);
    setText('board-project-count', String(latest.length));
    setText('board-period-label', newest && newest.reportDate ? `حتى ${newest.reportDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })}` : 'آخر بيانات المشروعات');

    const watchlist = [...latest]
        .sort((a, b) => reportUsd(b, 'dueDebt') - reportUsd(a, 'dueDebt'))
        .slice(0, 3);
    const list = document.getElementById('board-watchlist-items');
    if (list) list.innerHTML = watchlist.map(report => `
        <div class="board-watchlist-item"><span>${escapeHtml(report.projectName)}</span><strong>${formatCurrencyUSD(reportUsd(report, 'dueDebt'))}</strong></div>
    `).join('');

    if (typeof Chart === 'undefined') return;
    const uncollectibleDebt = latest.reduce((sum, report) => sum + reportUsd(report, 'uncollectibleWork'), 0);
    const composition = [
        { label: 'قابلة للتحصيل', value: collectibleDebt, color: '#d8b05a' },
        { label: 'غير قابلة للصرف', value: uncollectibleDebt, color: '#e27963' },
        { label: 'سيولة محصلة', value: collected, color: '#5eaf9b' }
    ];
    const compositionList = document.getElementById('board-composition-list');
    if (compositionList) compositionList.innerHTML = composition.map(item => `
        <div class="board-composition-item"><span class="board-composition-key"><i style="background:${item.color}"></i>${item.label}</span><b>${formatCurrencyUSD(item.value)}</b></div>
    `).join('');
    setText('board-composition-center', formatCurrencyUSD(collectibleDebt));
    const donutCanvas = document.getElementById('board-composition-chart');
    if (!donutCanvas || typeof Chart === 'undefined') return;
    if (boardCompositionChart) boardCompositionChart.destroy();
    boardCompositionChart = new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
            labels: composition.map(item => item.label),
            datasets: [{
                data: composition.map(item => item.value),
                backgroundColor: composition.map(item => item.color),
                borderColor: 'transparent',
                borderWidth: 0,
                spacing: 0,
                hoverOffset: 6,
                offset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: '64%',
            plugins: {
                legend: { display: false },
                tooltip: { displayColors: false, callbacks: { label: item => `${item.label}: ${formatCurrencyUSD(item.raw)}` } }
            }
        }
    });

    const revealBoardComposition = () => {
        if (!boardCompositionChart) return;
        boardCompositionChart.resize();
        boardCompositionChart.options.animation = { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutCubic' };
        boardCompositionChart.reset();
        boardCompositionChart.update();
    };
    const compositionTarget = donutCanvas.closest('.board-composition-card') || donutCanvas.parentElement || donutCanvas;
    if (boardCompositionRevealObserver) boardCompositionRevealObserver.disconnect();
    if ('IntersectionObserver' in window) {
        boardCompositionRevealObserver = new IntersectionObserver((entries, observer) => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            requestAnimationFrame(revealBoardComposition);
            observer.disconnect();
            boardCompositionRevealObserver = null;
        }, { threshold: 0.12 });
        boardCompositionRevealObserver.observe(compositionTarget);
    } else {
        requestAnimationFrame(revealBoardComposition);
    }

    // Also update header stock ticker tape
    renderHeaderStockTicker();
}

function resolveTickerCountryName(report) {
    if (!report) return '';
    return report.country
        || projectToCountryMap[report.projectName]
        || (report.branchName && branchToCountryMap[report.branchName])
        || '';
}

function getCountryTickerIdentity(countryName) {
    const cleanName = String(countryName || '').trim();
    const geo = cleanName && typeof findCountryGeo === 'function' ? findCountryGeo(cleanName) : null;
    const displayName = geo ? (geo.nameAr || geo.nameEn || cleanName) : cleanName;
    return {
        key: geo && geo.id ? geo.id : cleanName.toLowerCase(),
        isoCode: geo && geo.id ? geo.id : null,
        countryName: displayName,
        flagClass: getFlagIconClass(displayName)
    };
}

function summarizeCountryTickerGroup(countryGroup) {
    const countryWarning = evaluateCountryEarlyWarning(countryGroup.countryName, countryGroup.isoCode);
    const progressTotal = countryGroup.reports.reduce((sum, report) => sum + (Number(report.executionProgressPercent) || 0), 0);
    return {
        countryName: countryGroup.countryName,
        isoCode: countryGroup.isoCode,
        flagClass: countryGroup.flagClass,
        projectCount: countryGroup.reports.length,
        healthScore: Number.isFinite(Number(countryWarning.score)) ? Number(countryWarning.score) : 0,
        healthColor: countryWarning.color || '#64748b',
        progressAverage: Math.round((progressTotal / countryGroup.reports.length) * 10) / 10
    };
}

function buildCountryTickerItems() {
    const countryGroups = new Map();
    latestProjectReports().forEach(report => {
        const countryName = resolveTickerCountryName(report);
        if (!countryName) return;
        const countryIdentity = getCountryTickerIdentity(countryName);
        if (!countryGroups.has(countryIdentity.key)) countryGroups.set(countryIdentity.key, { ...countryIdentity, reports: [] });
        countryGroups.get(countryIdentity.key).reports.push(report);
    });

    return [...countryGroups.values()].map(summarizeCountryTickerGroup);
}

function sortCountryTickerItems(countryItems, criterion, direction) {
    const sortCriterion = TICKER_SORT_CRITERIA.has(criterion) ? criterion : 'projectCount';
    const directionFactor = direction === 'asc' ? 1 : -1;
    return [...countryItems].sort((countryA, countryB) => {
        const metricDifference = (Number(countryA[sortCriterion]) || 0) - (Number(countryB[sortCriterion]) || 0);
        if (metricDifference !== 0) return metricDifference * directionFactor;
        return countryA.countryName.localeCompare(countryB.countryName, 'ar');
    });
}

function fetchSheetByGidJSONP(gid, sourceLabel) {
    return fetchGvizJSONP(`gid=${encodeURIComponent(gid)}`, sourceLabel);
}

function validateGvizTable(table, minimumColumnCount, sourceLabel) {
    const hasRows = table && Array.isArray(table.rows);
    const hasColumns = table && Array.isArray(table.cols) && table.cols.length >= minimumColumnCount;
    if (!hasRows || !hasColumns) {
        throw new Error(`${sourceLabel} schema mismatch: expected at least ${minimumColumnCount} columns.`);
    }
}

function generateCountryTickerItemHtml(country, rank) {
    const safeCountryName = escapeHtml(country.countryName);
    const rankHtml = rank ? `<span class="ticker-rank-badge" title="الترتيب #${rank}">#${rank}</span>` : '';
    return `
        <div class="stock-ticker-item" role="button" tabindex="0" data-country="${safeCountryName}" title="${safeCountryName}${rank ? ` (الترتيب #${rank})` : ''} - اضغط لعرض الدولة">
            <div class="ticker-row-title">
                <span class="fi ${country.flagClass}" aria-hidden="true" style="margin-left:6px"></span>
                <span class="ticker-proj-title">${safeCountryName}</span>
                ${rankHtml}
            </div>
            <div class="ticker-row-metric">
                <span class="ticker-metric-label">عدد المشروعات :</span>
                <span class="ticker-metric-val neutral"><bdi dir="ltr">${country.projectCount}</bdi></span>
            </div>
            <div class="ticker-row-metric">
                <span class="ticker-metric-label">مؤشر صحة المشروعات :</span>
                <span class="ticker-metric-val" style="color:${country.healthColor}"><bdi dir="ltr">${country.healthScore.toFixed(1)}%</bdi></span>
            </div>
            <div class="ticker-row-metric">
                <span class="ticker-metric-label">نسبة إنجاز المشروعات :</span>
                <span class="ticker-metric-val prog"><bdi dir="ltr">${country.progressAverage.toFixed(1)}%</bdi></span>
            </div>
        </div>
        <span class="stock-ticker-separator">•</span>
    `;
}

let tickerDragMoved = false;

function bindCountryTickerInteractions(track) {
    track.querySelectorAll('.stock-ticker-item').forEach(tickerElement => {
        const openCountry = (e) => {
            if (tickerDragMoved) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            openCountryFromTicker(tickerElement.dataset.country);
        };
        tickerElement.addEventListener('click', openCountry);
        tickerElement.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openCountry();
        });
    });
}

function renderHeaderStockTicker() {
    const track = document.getElementById('stock-ticker-track');
    if (!track) return;
    const countryList = sortCountryTickerItems(
        buildCountryTickerItems(),
        mapControlState.tickerCriterion,
        mapControlState.tickerDirection
    );
    if (countryList.length === 0) {
        track.innerHTML = '<span style="color:#94a3b8; font-size:11px; padding:0 12px;">جاري تحميل مؤشرات الدول...</span>';
        return;
    }

    const itemsHtml = countryList.map((country, index) => generateCountryTickerItemHtml(country, index + 1)).join('');
    track.innerHTML = itemsHtml + itemsHtml;
    bindCountryTickerInteractions(track);
    initStockTickerScroll();
}

let tickerScrollPos = 0;
let tickerTargetPos = 0;
let tickerAutoSpeed = 0.40; // Calm, continuous drift
let tickerRafId = null;
let tickerIsInteracting = false;

function initStockTickerScroll() {
    const container = document.getElementById('header-stock-ticker');
    if (!container) return;

    tickerScrollPos = container.scrollLeft || 0;
    tickerTargetPos = container.scrollLeft || 0;

    let isHovered = false;
    let isDragging = false;
    let startX = 0;
    let dragStartPos = 0;
    let lastX = 0;
    let velocity = 0;
    const dragMovedThreshold = 6;
    let dragDistance = 0;

    container.onmouseenter = () => { isHovered = true; };
    container.onmouseleave = () => { isHovered = false; };

    // Mouse Wheel Boost with momentum (Smooth acceleration)
    container.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        tickerTargetPos += delta * 1.85;
    };

    // 1. Mouse Drag Support (Desktop)
    container.onmousedown = (e) => {
        isDragging = true;
        tickerIsInteracting = true;
        tickerDragMoved = false;
        dragDistance = 0;
        startX = e.pageX;
        lastX = e.pageX;
        velocity = 0;
        dragStartPos = tickerTargetPos;
    };

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        tickerIsInteracting = false;
        // Momentum release
        tickerTargetPos -= velocity * 6;
        if (dragDistance > dragMovedThreshold) {
            tickerDragMoved = true;
            setTimeout(() => { tickerDragMoved = false; }, 80);
        }
    });

    container.onmousemove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const diff = (e.pageX - startX) * 1.6;
        dragDistance = Math.abs(e.pageX - startX);
        if (dragDistance > dragMovedThreshold) {
            tickerDragMoved = true;
        }
        tickerTargetPos = dragStartPos - diff;
        velocity = e.pageX - lastX;
        lastX = e.pageX;
    };

    // 2. Mobile Touch Swipe & Kinetic Scroll Support
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouching = false;
    let touchStartPos = 0;
    let touchLastX = 0;
    let touchVelocity = 0;
    let isHorizontalGesture = null;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        isTouching = true;
        tickerIsInteracting = true;
        tickerDragMoved = false;
        dragDistance = 0;
        isHorizontalGesture = null;
        touchStartX = touch.pageX;
        touchStartY = touch.pageY;
        touchLastX = touch.pageX;
        touchVelocity = 0;
        touchStartPos = tickerTargetPos;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!isTouching || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const deltaX = touch.pageX - touchStartX;
        const deltaY = touch.pageY - touchStartY;

        if (isHorizontalGesture === null) {
            if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
                isHorizontalGesture = Math.abs(deltaX) >= Math.abs(deltaY);
            }
        }

        if (isHorizontalGesture) {
            if (e.cancelable) e.preventDefault();
            dragDistance = Math.abs(deltaX);
            if (dragDistance > dragMovedThreshold) {
                tickerDragMoved = true;
            }
            tickerTargetPos = touchStartPos - deltaX * 1.5;
            touchVelocity = touch.pageX - touchLastX;
            touchLastX = touch.pageX;
        }
    }, { passive: false });

    const handleTouchEnd = () => {
        if (!isTouching) return;
        isTouching = false;
        tickerIsInteracting = false;
        if (isHorizontalGesture && dragDistance > dragMovedThreshold) {
            tickerDragMoved = true;
            // Apply kinetic momentum
            tickerTargetPos -= touchVelocity * 7;
            setTimeout(() => { tickerDragMoved = false; }, 120);
        } else {
            tickerDragMoved = false;
        }
        isHorizontalGesture = null;
    };

    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    if (tickerRafId) cancelAnimationFrame(tickerRafId);

    function loop() {
        // Continuous auto-drift runs when not hovered and not interacting
        if (!tickerIsInteracting && !isHovered) {
            tickerTargetPos += tickerAutoSpeed;
        }

        // Fluid momentum interpolation (lerp damping for silky smooth glide)
        tickerScrollPos += (tickerTargetPos - tickerScrollPos) * 0.085;

        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0) {
            if (tickerScrollPos >= halfWidth) {
                tickerScrollPos -= halfWidth;
                tickerTargetPos -= halfWidth;
            } else if (tickerScrollPos <= 0) {
                tickerScrollPos += halfWidth;
                tickerTargetPos += halfWidth;
            }
        }

        container.scrollLeft = tickerScrollPos;
        tickerRafId = requestAnimationFrame(loop);
    }
    tickerRafId = requestAnimationFrame(loop);
}

function openCountryFromTicker(countryName) {
    if (!countryName) return;
    openCountryDrawer(countryName);
}

// Initialize Leaflet Map
function initExecutiveMap() {
    const mapEl = document.getElementById('standalone-executive-map');
    if (!mapEl || typeof L === 'undefined') return;
    if (executiveMap) return;

    executiveMap = L.map('standalone-executive-map', {
        center: [10.5, 22.0],
        zoom: 3.8,
        minZoom: 3.5,
        maxZoom: 16,
        maxBounds: ALLOWED_NAV_BOUNDS,
        maxBoundsViscosity: 0.65,
        dragging: true,
        touchZoom: true,
        // Keep wheel zoom anchored to the map center so it does not feel like panning.
        scrollWheelZoom: 'center',
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        preferCanvas: true,
        zoomControl: true,
        attributionControl: false
    });

    if (executiveMap.zoomControl) {
        executiveMap.zoomControl.setPosition('topleft');
    }

    executiveMap.fitBounds(MENA_AFRICA_BOUNDS, { padding: [10, 10] });

    currentTileLayer = L.tileLayer(getMapBaseTileUrl(), {
        subdomains: 'abcd',
        maxZoom: 19,
        updateWhenZooming: false,
        updateWhenIdle: true
    }).addTo(executiveMap);

    markersGroup = L.layerGroup().addTo(executiveMap);
    businessBubblesGroup = L.layerGroup().addTo(executiveMap);

    executiveMap.on('mouseout', () => {
        resetHoveredCountryLayers();
    });

    if (typeof MENA_GEOJSON !== 'undefined' && MENA_GEOJSON) {
        menaGeoJsonData = MENA_GEOJSON;
        renderGeoJsonBoundaries();
    }

    setTimeout(() => {
        if (executiveMap) {
            executiveMap.invalidateSize();
            executiveMap.fitBounds(MENA_AFRICA_BOUNDS, { padding: [10, 10] });
        }
    }, 400);
}

function reportTimestamp(report) {
    if (report.reportDate && typeof report.reportDate.getTime === 'function') {
        return report.reportDate.getTime();
    }
    return Date.parse(report.timestamp || '');
}

function isNewerReport(candidate, current) {
    const candidateTimestamp = reportTimestamp(candidate);
    if (!Number.isFinite(candidateTimestamp)) return false;
    const currentTimestamp = reportTimestamp(current);
    return !Number.isFinite(currentTimestamp) || candidateTimestamp > currentTimestamp;
}

function latestReportsByProject(reports) {
    const latestReports = new Map();
    reports.forEach(report => {
        const projectKey = report.projectId || report.projectName;
        if (!projectKey) return;
        const currentReport = latestReports.get(projectKey);
        if (!currentReport || isNewerReport(report, currentReport)) {
            latestReports.set(projectKey, report);
        }
    });
    return latestReports;
}

function reportContractValueUsd(report) {
    return Number(report.contractValue) || 0;
}

function reportExecutedWorkUsd(report) {
    return Number(report.executedWorkTotal) || 0;
}

function countryExecutionRatioPercent(reports) {
    const contractTotalUsd = reports.reduce((sum, report) => sum + reportContractValueUsd(report), 0);
    if (contractTotalUsd <= 0) return 0;
    const executedTotalUsd = reports.reduce((sum, report) => sum + reportExecutedWorkUsd(report), 0);
    return (executedTotalUsd / contractTotalUsd) * 100;
}

function marketStateForCountry(counts) {
    if (counts.projectsCount === 0) return counts.branchesCount > 0 ? 'presence' : 'absent';
    if (counts.executionRatioPercent >= 100) return 'ended';
    return counts.executionRatioPercent > 95 ? 'closeToEnding' : 'active';
}

const MARKET_STATE_COLORS = {
    active: '#10b981',
    closeToEnding: '#fca5a5',
    ended: '#991b1b',
    presence: '#facc15',
    absent: '#64748b'
};

const MARKET_HIGHLIGHT_COUNTRY_GROUPS = [
    ['SD', 'SS'],
    ['CG', 'CD']
];

const precomputedCountryStats = new Map();
const precomputedEarlyWarningStats = new Map();
const precomputedMarketHighlightStats = new Map();

function combinedMarketHighlightStats(countryIds, countryIndexes) {
    const projects = new Set();
    const branches = new Set();
    const reports = [];
    countryIds.forEach(countryId => {
        (countryIndexes.projects.get(countryId) || new Set()).forEach(project => projects.add(project));
        (countryIndexes.branches.get(countryId) || new Set()).forEach(branch => branches.add(branch));
        reports.push(...(countryIndexes.reports.get(countryId) || []));
    });
    const latestReports = [...latestReportsByProject(reports).values()];
    const stats = {
        projectsCount: projects.size,
        branchesCount: branches.size,
        reportsCount: reports.length,
        totalValueUsd: reports.reduce((sum, report) => sum + (Number(report.valueUsd) || 0), 0),
        executionRatioPercent: countryExecutionRatioPercent(latestReports),
        hasData: projects.size > 0 || branches.size > 0 || reports.length > 0
    };
    stats.marketState = marketStateForCountry(stats);
    return stats;
}

function cacheCombinedMarketHighlights(countryIndexes, getKeysForCountry) {
    precomputedMarketHighlightStats.clear();
    MARKET_HIGHLIGHT_COUNTRY_GROUPS.forEach(countryIds => {
        const combinedStats = combinedMarketHighlightStats(countryIds, countryIndexes);
        countryIds.flatMap(getKeysForCountry).forEach(alias => {
            precomputedMarketHighlightStats.set(alias, combinedStats);
            precomputedMarketHighlightStats.set(alias.toLowerCase(), combinedStats);
        });
    });
}

function rebuildCountryStatsCache() {
    precomputedCountryStats.clear();

    const countryProjects = new Map();
    const countryBranches = new Map();
    const countryReports = new Map();

    const getKeysForCountry = (rawName) => {
        if (!rawName) return [];
        const clean = String(rawName).trim();
        const keys = [clean, clean.toLowerCase()];
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(clean) : null;
        if (geo) {
            if (geo.id) keys.push(geo.id, geo.id.toLowerCase());
            if (geo.nameAr) keys.push(geo.nameAr, geo.nameAr.toLowerCase());
            if (geo.fullNameAr) keys.push(geo.fullNameAr, geo.fullNameAr.toLowerCase());
            if (geo.nameEn) keys.push(geo.nameEn, geo.nameEn.toLowerCase());
            if (geo.aliases && Array.isArray(geo.aliases)) {
                geo.aliases.forEach(a => keys.push(a, a.toLowerCase()));
            }
        }
        return [...new Set(keys.filter(Boolean))];
    };

    // 1. Index reportsData
    const countryProjectsRaw = new Map();
    (reportsData || []).forEach(r => {
        if (!r || !r.country) return;
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(r.country) : null;
        const canKey = geo ? geo.id : String(r.country).trim();

        if (!countryReports.has(canKey)) countryReports.set(canKey, []);
        countryReports.get(canKey).push(r);

        if (r.projectName) {
            if (!countryProjectsRaw.has(canKey)) countryProjectsRaw.set(canKey, new Set());
            countryProjectsRaw.get(canKey).add(r.projectName);

            if (!countryProjects.has(canKey)) countryProjects.set(canKey, new Set());
            if (!isProjectExcludedByCompletion(r)) {
                countryProjects.get(canKey).add(r.projectName);
            }
        }
    });

    registeredEntities.forEach(entity => {
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(entity.country) : null;
        const canKey = geo ? geo.id : String(entity.country).trim();

        if (!countryBranches.has(canKey)) countryBranches.set(canKey, new Set());
        countryBranches.get(canKey).add(entity.entityId);
    });

    precomputedEarlyWarningStats.clear();

    // Populate all canonical keys
    const allCanKeys = new Set([...countryReports.keys(), ...countryProjectsRaw.keys(), ...countryBranches.keys()]);
    allCanKeys.forEach(canKey => {
        const pSet = countryProjects.get(canKey) || new Set();
        const bSet = countryBranches.get(canKey) || new Set();
        const rList = countryReports.get(canKey) || [];
        const totalValueUsd = rList.reduce((sum, r) => sum + (Number(r.valueUsd) || 0), 0);
        const latestReports = latestReportsByProject(rList);
        const executionRatioPercent = countryExecutionRatioPercent([...latestReports.values()]);
        const stats = {
            projectsCount: pSet.size,
            branchesCount: bSet.size,
            reportsCount: rList.length,
            totalValueUsd,
            executionRatioPercent,
            hasData: pSet.size > 0 || bSet.size > 0 || rList.length > 0
        };
        stats.marketState = marketStateForCountry(stats);

        // Compute Early Warning Stats for this country
        const pList = [];
        const seenP = new Set();
        rList.forEach(r => {
            if (r.projectName && !seenP.has(r.projectName)) {
                seenP.add(r.projectName);
                if (!isProjectExcludedByCompletion(r)) {
                    pList.push(r);
                }
            }
        });

        const ewStats = summarizeCountryEarlyWarning(pList);

        const allAliases = getKeysForCountry(canKey);
        allAliases.forEach(aliasKey => {
            precomputedCountryStats.set(aliasKey, stats);
            precomputedCountryStats.set(aliasKey.toLowerCase(), stats);
            precomputedEarlyWarningStats.set(aliasKey, ewStats);
            precomputedEarlyWarningStats.set(aliasKey.toLowerCase(), ewStats);
        });
        precomputedCountryStats.set(canKey, stats);
        precomputedEarlyWarningStats.set(canKey, ewStats);

        // Also index by ISO-2 code and English name for GeoJSON boundary lookup
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(canKey) : null;
        if (geo) {
            if (geo.id) {
                precomputedCountryStats.set(geo.id, stats);
                precomputedCountryStats.set(geo.id.toLowerCase(), stats);
                precomputedEarlyWarningStats.set(geo.id, ewStats);
                precomputedEarlyWarningStats.set(geo.id.toLowerCase(), ewStats);
            }
            if (geo.nameEn) {
                precomputedCountryStats.set(geo.nameEn, stats);
                precomputedCountryStats.set(geo.nameEn.toLowerCase(), stats);
                precomputedEarlyWarningStats.set(geo.nameEn, ewStats);
                precomputedEarlyWarningStats.set(geo.nameEn.toLowerCase(), ewStats);
            }
            if (geo.nameAr) {
                precomputedEarlyWarningStats.set(geo.nameAr, ewStats);
                precomputedEarlyWarningStats.set(geo.nameAr.toLowerCase(), ewStats);
            }
        }
    });

    cacheCombinedMarketHighlights({
        projects: countryProjectsRaw,
        branches: countryBranches,
        reports: countryReports
    }, getKeysForCountry);

    // Compute max value for heatmap normalization
    maxCountryValueUsd = 1;
    precomputedCountryStats.forEach(s => {
        if (s.totalValueUsd > maxCountryValueUsd) maxCountryValueUsd = s.totalValueUsd;
    });
    precomputedMarketHighlightStats.forEach(stats => {
        if (stats.totalValueUsd > maxCountryValueUsd) maxCountryValueUsd = stats.totalValueUsd;
    });
}


function getCountryDataCounts(countryName, isoCode) {
    if (isoCode) {
        if (precomputedCountryStats.has(isoCode)) return precomputedCountryStats.get(isoCode);
        if (precomputedCountryStats.has(isoCode.toLowerCase())) return precomputedCountryStats.get(isoCode.toLowerCase());
    }
    if (!countryName) return { projectsCount: 0, branchesCount: 0, reportsCount: 0, executionRatioPercent: 0, marketState: 'absent', hasData: false };

    const clean = String(countryName).trim();
    if (precomputedCountryStats.has(clean)) return precomputedCountryStats.get(clean);
    if (precomputedCountryStats.has(clean.toLowerCase())) return precomputedCountryStats.get(clean.toLowerCase());

    const geo = typeof findCountryGeo === 'function' ? findCountryGeo(clean) : null;
    if (geo && geo.id) {
        if (precomputedCountryStats.has(geo.id)) return precomputedCountryStats.get(geo.id);
        if (precomputedCountryStats.has(geo.id.toLowerCase())) return precomputedCountryStats.get(geo.id.toLowerCase());
    }

    return { projectsCount: 0, branchesCount: 0, reportsCount: 0, executionRatioPercent: 0, marketState: 'absent', hasData: false };
}

function getMarketHighlightCounts(countryName, isoCode) {
    const lookupKeys = [isoCode, countryName].filter(Boolean);
    for (const lookupKey of lookupKeys) {
        const groupedStats = precomputedMarketHighlightStats.get(lookupKey)
            || precomputedMarketHighlightStats.get(String(lookupKey).toLowerCase());
        if (groupedStats) return groupedStats;
    }
    return getCountryDataCounts(countryName, isoCode);
}

function getCountryBoundaryStyle(feature) {
    const props = feature && feature.properties ? feature.properties : {};
    const isoCode = props['ISO3166-1-Alpha-2'] || props['ISO_A2'] || props['iso_a2'] || null;
    
    // Try COUNTRIES_GEO first (MENA countries)
    let countryGeo = isoCode && typeof COUNTRIES_GEO !== 'undefined' ? COUNTRIES_GEO[isoCode] : null;
    
    // Fallback: try findCountryGeo with English name from GeoJSON feature
    if (!countryGeo && typeof findCountryGeo === 'function') {
        const nameCandidates = [
            props['name'], props['NAME'], props['ADMIN'], props['admin'],
            props['name_long'], props['formal_en'], isoCode
        ].filter(Boolean);
        for (const candidate of nameCandidates) {
            countryGeo = findCountryGeo(candidate);
            if (countryGeo) break;
        }
    }

    const countryName = countryGeo
        ? (countryGeo.nameAr || countryGeo.nameEn || '')
        : (props['name'] || props['NAME'] || props['ADMIN'] || '');

    // --- Lookup stats: first try by ISO code directly, then by name ---
    let counts = { projectsCount: 0, branchesCount: 0, reportsCount: 0, executionRatioPercent: 0, marketState: 'absent', hasData: false };
    if (isoCode) {
        const direct = precomputedCountryStats.get(isoCode) || precomputedCountryStats.get(isoCode.toLowerCase());
        if (direct) counts = direct;
    }
    if (!counts.hasData && countryGeo && countryGeo.id) {
        const byId = precomputedCountryStats.get(countryGeo.id) || precomputedCountryStats.get(countryGeo.id.toLowerCase());
        if (byId) counts = byId;
    }
    if (!counts.hasData && countryName) {
        counts = getCountryDataCounts(countryName, isoCode);
    }

    if (isEarlyWarningMode) {
        if (counts.projectsCount > 0 || counts.reportsCount > 0) {
            const ewData = evaluateCountryEarlyWarning(countryName, isoCode);
            const fillOpacity = ewData.level === 'danger' ? 0.46 : (ewData.level === 'medium' ? 0.36 : 0.28);
            return {
                color: ewData.color,
                weight: 2.8,
                opacity: 0.95,
                fillColor: ewData.color,
                fillOpacity: fillOpacity,
                className: 'country-ew-feature outline-none focus:outline-none select-none'
            };
        } else if (counts.branchesCount > 0) {
            return {
                color: '#64748b',
                weight: 1.5,
                opacity: 0.5,
                fillColor: '#64748b',
                fillOpacity: 0.1,
                className: 'country-inactive-feature outline-none focus:outline-none select-none'
            };
        } else {
            return {
                color: 'rgba(148, 163, 184, 0.05)',
                weight: 0.5,
                opacity: 0.1,
                fillColor: 'transparent',
                fillOpacity: 0,
                className: 'country-inactive-feature outline-none focus:outline-none select-none'
            };
        }
    }

    if (isBusinessAnalysisMode) {
        counts = getMarketHighlightCounts(countryName, isoCode);
        if (counts.marketState === 'active') {
            const ratio = counts.totalValueUsd > 0
                ? Math.sqrt(counts.totalValueUsd / maxCountryValueUsd)
                : 0.15;
            const fillOpacity = 0.10 + ratio * 0.55;
            const borderOpacity = 0.6 + ratio * 0.4;
            return {
                color: MARKET_STATE_COLORS.active,
                weight: 2.5,
                opacity: borderOpacity,
                fillColor: MARKET_STATE_COLORS.active,
                fillOpacity
            };
        } else if (counts.marketState === 'ended' || counts.marketState === 'closeToEnding') {
            const stateColor = MARKET_STATE_COLORS[counts.marketState];
            return {
                color: stateColor,
                weight: 2.5,
                opacity: 1,
                fillColor: stateColor,
                fillOpacity: counts.marketState === 'ended' ? 0.24 : 0.2
            };
        } else if (counts.marketState === 'presence') {
            return {
                color: MARKET_STATE_COLORS.presence,
                weight: 2,
                opacity: 0.9,
                fillColor: MARKET_STATE_COLORS.presence,
                fillOpacity: 0.16
            };
        }
        return {
            color: 'rgba(148, 163, 184, 0.05)',
            weight: 0.5,
            opacity: 0.1,
            fillColor: 'transparent',
            fillOpacity: 0,
            className: 'country-inactive-feature outline-none focus:outline-none select-none'
        };
    }

    if (counts.hasData) {
        return {
            color: 'rgba(250, 204, 21, 0.18)',
            weight: 1.0,
            opacity: 0.55,
            fillColor: 'transparent',
            fillOpacity: 0,
            className: 'country-active-feature outline-none focus:outline-none select-none'
        };
    } else {
        return {
            color: 'rgba(148, 163, 184, 0.05)',
            weight: 0.5,
            opacity: 0.12,
            fillColor: 'transparent',
            fillOpacity: 0,
            className: 'country-inactive-feature outline-none focus:outline-none select-none'
        };
    }
}

function countryIsoCodeFromLayer(countryLayer) {
    const properties = countryLayer && countryLayer.feature ? countryLayer.feature.properties || {} : {};
    return properties['ISO3166-1-Alpha-2'] || properties['ISO_A2'] || properties['iso_a2'] || null;
}

function hoveredCountryLayers(countryLayer, isoCode) {
    if (!geoJsonLayer || !isoCode) return [countryLayer];
    const countryGroup = MARKET_HIGHLIGHT_COUNTRY_GROUPS.find(countryIds => countryIds.includes(isoCode));
    if (!countryGroup) return [countryLayer];

    const groupedLayers = [];
    geoJsonLayer.eachLayer(candidateLayer => {
        if (countryGroup.includes(countryIsoCodeFromLayer(candidateLayer))) groupedLayers.push(candidateLayer);
    });
    return groupedLayers.length > 0 ? groupedLayers : [countryLayer];
}

function resetHoveredCountryLayers() {
    if (geoJsonLayer) {
        currentHoveredCountryLayers.forEach(countryLayer => geoJsonLayer.resetStyle(countryLayer));
    }
    currentHoveredCountryLayers = [];
}

function renderGeoJsonBoundaries() {
    if (!executiveMap || !menaGeoJsonData) return;

    if (geoJsonLayer) {
        executiveMap.removeLayer(geoJsonLayer);
    }

    geoJsonLayer = L.geoJSON(menaGeoJsonData, {
        style: getCountryBoundaryStyle,
        onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const isoCode = props['ISO3166-1-Alpha-2'] || props['ISO_A2'] || props['iso_a2'] || null;

            let countryGeo = isoCode && typeof COUNTRIES_GEO !== 'undefined' ? COUNTRIES_GEO[isoCode] : null;
            if (!countryGeo && typeof findCountryGeo === 'function') {
                const candidates = [props['name'], props['NAME'], props['ADMIN'], props['admin'], props['name_long'], isoCode].filter(Boolean);
                for (const c of candidates) { countryGeo = findCountryGeo(c); if (countryGeo) break; }
            }
            const countryName = countryGeo
                ? (countryGeo.nameAr || countryGeo.nameEn || props['name'] || '')
                : (props['name'] || props['NAME'] || props['ADMIN'] || '');

            // Robust counts lookup (same logic as getCountryBoundaryStyle)
            let counts = { projectsCount: 0, branchesCount: 0, reportsCount: 0, executionRatioPercent: 0, marketState: 'absent', hasData: false };
            if (isoCode) {
                const d = precomputedCountryStats.get(isoCode) || precomputedCountryStats.get(isoCode.toLowerCase());
                if (d) counts = d;
            }
            if (!counts.hasData && countryGeo && countryGeo.id) {
                const d = precomputedCountryStats.get(countryGeo.id) || precomputedCountryStats.get(countryGeo.id.toLowerCase());
                if (d) counts = d;
            }
            if (!counts.hasData && countryName) counts = getCountryDataCounts(countryName, isoCode);

            const groupedMarketCounts = getMarketHighlightCounts(countryName, isoCode);
            if (!counts.hasData && !groupedMarketCounts.hasData) return;

            // Countries WITH projects or branches: Glow on hover and enable interactive drawer
            layer.on('mouseover', (event) => {
                if (!counts.hasData && !isBusinessAnalysisMode) return;
                resetHoveredCountryLayers();
                currentHoveredCountryLayers = hoveredCountryLayers(layer, isoCode);
                const hoverCounts = isBusinessAnalysisMode
                    ? getMarketHighlightCounts(countryName, isoCode)
                    : counts;
                if (isBusinessAnalysisMode) {
                    const executionRatio = Number(hoverCounts.executionRatioPercent) || 0;
                    layer.bindTooltip('', {
                        sticky: true,
                        direction: 'top',
                        className: 'market-hover-tooltip',
                        opacity: 0.9
                    });
                    layer.setTooltipContent(`${countryName}: نسبة الإنجاز ${executionRatio.toFixed(1)}%`);
                    layer.openTooltip(event.latlng);
                }
                let hoverStyle;
                
                if (isEarlyWarningMode) {
                    const ewData = evaluateCountryEarlyWarning(countryName);
                    hoverStyle = {
                        color: ewData.color,
                        weight: 3.5,
                        opacity: 1.0,
                        fillColor: ewData.color,
                        fillOpacity: 0.5
                    };
                } else if (isBusinessAnalysisMode) {
                    const strokeColor = MARKET_STATE_COLORS[hoverCounts.marketState];
                    hoverStyle = {
                        color: strokeColor,
                        weight: 3.2,
                        opacity: 1.0,
                        fillColor: strokeColor,
                        fillOpacity: 0.18
                    };
                } else {
                    hoverStyle = {
                        color: '#FACC15',
                        weight: 2.2,
                        opacity: 0.95,
                        fillColor: '#F59E0B',
                        fillOpacity: 0.14
                    };
                }
                currentHoveredCountryLayers.forEach(countryLayer => countryLayer.setStyle(hoverStyle));
            });

            layer.on('mouseout', () => {
                resetHoveredCountryLayers();
                layer.closeTooltip();
                layer.unbindTooltip();
            });

            layer.on('click', (e) => {
                if (!counts.hasData) return;
                if (e && e.originalEvent && e.originalEvent.target && typeof e.originalEvent.target.blur === 'function') {
                    e.originalEvent.target.blur();
                }
                if (isEarlyWarningMode) {
                    if (counts.projectsCount > 0 || counts.reportsCount > 0) {
                        try {
                            const b = layer.getBounds();
                            executiveMap.flyToBounds(b, {
                                padding: [40, 40],
                                maxZoom: 6.0,
                                duration: 1.0,
                                easeLinearity: 0.25
                            });
                        } catch (err) {
                            console.warn('flyToBounds error:', err);
                        }
                        return;
                    }
                }
                if (countryGeo) {
                    openCountryDrawer(countryGeo);
                } else if (countryName) {
                    openCountryDrawer(countryName);
                }
            });
        }
    });

    geoJsonLayer.addTo(executiveMap);
}

function createEntity3DMarkerIcon() {
    const iconHtml = `
        <div class="branch-beacon-container" aria-hidden="true">
            <div class="branch-beacon-glow-outer"></div>
            <div class="branch-3d-building">
                <svg viewBox="0 0 64 64" width="28" height="28" class="branch-3d-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="pTop" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#94A3B8"/>
                            <stop offset="100%" stop-color="#64748B"/>
                        </linearGradient>
                        <linearGradient id="pLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#475569"/>
                            <stop offset="100%" stop-color="#334155"/>
                        </linearGradient>
                        <linearGradient id="pRight" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#334155"/>
                            <stop offset="100%" stop-color="#1E293B"/>
                        </linearGradient>
                        <linearGradient id="fTop" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#FFFFFF"/>
                            <stop offset="100%" stop-color="#E2E8F0"/>
                        </linearGradient>
                        <linearGradient id="fLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#FFFFFF"/>
                            <stop offset="100%" stop-color="#CBD5E1"/>
                        </linearGradient>
                        <linearGradient id="fRight" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#94A3B8"/>
                            <stop offset="100%" stop-color="#64748B"/>
                        </linearGradient>
                        <linearGradient id="gLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#38BDF8"/>
                            <stop offset="50%" stop-color="#0284C7"/>
                            <stop offset="100%" stop-color="#0369A1"/>
                        </linearGradient>
                        <linearGradient id="gRight" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#0284C7"/>
                            <stop offset="100%" stop-color="#0F172A"/>
                        </linearGradient>
                        <linearGradient id="rRecess" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#E2E8F0"/>
                            <stop offset="100%" stop-color="#CBD5E1"/>
                        </linearGradient>
                    </defs>
                    <ellipse cx="32" cy="56" rx="22" ry="7" fill="#0284C7" fill-opacity="0.4"/>
                    <path d="M10 46 L32 58 L32 61 L10 49 Z" fill="url(#pLeft)"/>
                    <path d="M32 58 L54 46 L54 49 L32 61 Z" fill="url(#pRight)"/>
                    <path d="M32 34 L54 46 L32 58 L10 46 Z" fill="url(#pTop)"/>
                    <path d="M32 52 L48 43 L40 38 L32 43 Z" fill="#1E293B" fill-opacity="0.45"/>
                    <path d="M17 18 L32 26 L32 52 L17 44 Z" fill="url(#fLeft)"/>
                    <path d="M32 26 L47 18 L47 44 L32 52 Z" fill="url(#fRight)"/>
                    <path d="M32 10 L47 18 L32 26 L17 18 Z" fill="url(#fTop)"/>
                    <path d="M32 13 L44 19.5 L32 24 L20 19.5 Z" fill="url(#rRecess)"/>
                    <path d="M20 19.5 L32 24 L32 25 L18 20 Z" fill="#94A3B8" fill-opacity="0.6"/>
                    <path d="M32 13 L32 14.5 L44 20.5 L44 19.5 Z" fill="#64748B" fill-opacity="0.5"/>
                    <path d="M28 15.5 L33 18 L33 21 L28 18.5 Z" fill="#E2E8F0"/>
                    <path d="M33 18 L38 15.5 L38 18.5 L33 21 Z" fill="#94A3B8"/>
                    <path d="M33 13.5 L38 15.5 L33 18 L28 15.5 Z" fill="#FFFFFF"/>
                    <path d="M33 21 L38 18.5 L41 20 L36 22 Z" fill="#64748B" fill-opacity="0.4"/>
                    <path d="M18.5 20.5 L30.5 27 L30.5 50 L18.5 43.5 Z" fill="url(#gLeft)"/>
                    <path d="M18.5 25 L30.5 31.5" stroke="#FFFFFF" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M18.5 29.5 L30.5 36" stroke="#FFFFFF" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M18.5 34 L30.5 40.5" stroke="#FFFFFF" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M18.5 38.5 L30.5 45" stroke="#FFFFFF" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M21.5 22.1 L21.5 45.1" stroke="#FFFFFF" stroke-width="0.8"/>
                    <path d="M24.5 23.7 L24.5 46.7" stroke="#FFFFFF" stroke-width="0.8"/>
                    <path d="M27.5 25.3 L27.5 48.3" stroke="#FFFFFF" stroke-width="0.8"/>
                    <path d="M33.5 27 L45.5 20.5 L45.5 43.5 L33.5 50 Z" fill="url(#gRight)"/>
                    <path d="M33.5 31.5 L45.5 25" stroke="#CBD5E1" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M33.5 36 L45.5 29.5" stroke="#CBD5E1" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M33.5 40.5 L45.5 34" stroke="#CBD5E1" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M33.5 45 L45.5 38.5" stroke="#CBD5E1" stroke-width="0.8" stroke-linecap="round"/>
                    <path d="M36.5 28.6 L36.5 48.3" stroke="#CBD5E1" stroke-width="0.8"/>
                    <path d="M39.5 27.0 L39.5 46.7" stroke="#CBD5E1" stroke-width="0.8"/>
                    <path d="M42.5 25.4 L42.5 45.1" stroke="#CBD5E1" stroke-width="0.8"/>
                    <line x1="32" y1="26" x2="32" y2="52" stroke="#FFFFFF" stroke-width="1.2"/>
                </svg>
            </div>
        </div>
    `;
    return L.divIcon({
        html: iconHtml,
        className: 'custom-branch-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

function hasValidEntityMapLocation(mapsLink) {
    return /^https?:\/\//i.test(String(mapsLink || '').trim());
}

function addEntityMarkers(targetGroup) {
    registeredEntities.forEach(entity => {
        if (!hasValidEntityMapLocation(entity.mapsLink)) return;
        const coords = typeof getBranchCoordinates === 'function'
            ? getBranchCoordinates(entity.entityName, entity.country, entity.mapsLink)
            : null;
        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
        const marker = L.marker([coords.lat, coords.lng], {
            icon: createEntity3DMarkerIcon(),
            interactive: false,
            keyboard: false
        });
        targetGroup.addLayer(marker);
    });
}

function updateMapMarkers() {
    if (!executiveMap || !markersGroup) return;

    markersGroup.clearLayers();

    const projectsToRender = latestProjectReports();

    // 1. Render Blue Glowing Branch Markers
    if (showBranches) addEntityMarkers(markersGroup);

    // 2. Render Glowing Yellow Live Project Beacons
    if (showProjects) {
        const projBuckets = new Map();
        projectsToRender.forEach(project => {
            const projectName = project.projectName;
            const branchName = project.branchName || '';
            const countryName = project.country || '';
            const rawCoords = typeof getProjectCoordinates === 'function'
                ? getProjectCoordinates(projectName, branchName, countryName, project.mapsLink)
                : { lat: 30.0444, lng: 31.2357 };
            const key = `${rawCoords.lat.toFixed(2)}_${rawCoords.lng.toFixed(2)}`;
            if (!projBuckets.has(key)) {
                projBuckets.set(key, { baseLat: rawCoords.lat, baseLng: rawCoords.lng, list: [] });
            }
            projBuckets.get(key).list.push({ projectName, branchName, countryName, rawCoords });
        });

        projBuckets.forEach(bucket => {
            const count = bucket.list.length;
            bucket.list.forEach((item, idx) => {
                const { projectName, branchName, countryName, rawCoords } = item;
                const projectColor = '#F59E0B';
                const projectGlow = 'rgba(245,158,11,.30)';

                let finalLat = rawCoords.lat;
                let finalLng = rawCoords.lng;
                if (count > 1) {
                    const angle = (idx / count) * 2 * Math.PI - (Math.PI / 2);
                    // Keep collision offsets local so clustered projects stay near their real site.
                    const radius = Math.min(0.018, 0.008 + count * 0.001);
                    finalLat = bucket.baseLat + Math.sin(angle) * radius;
                    finalLng = bucket.baseLng + Math.cos(angle) * radius * 1.2;
                }

                const iconHtml = `
                    <div class="project-beacon-container" onclick="openProjectDetailModal('${escapeHtml(projectName)}', '${escapeHtml(branchName)}', '${escapeHtml(countryName)}')">
                        <div class="project-beacon-glow-outer" style="background:${projectGlow};"></div>
                        <div class="project-beacon-glow-inner" style="background:${projectGlow};"></div>
                        <div class="project-beacon-core" style="background:${projectColor}; box-shadow:0 0 9px 2px ${projectGlow};"></div>
                    </div>
                `;

                const projIcon = L.divIcon({
                    html: iconHtml,
                    className: 'custom-project-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const marker = L.marker([finalLat, finalLng], { icon: projIcon });

                marker.on('click', () => openProjectDetailModal(projectName, branchName, countryName));
                markersGroup.addLayer(marker);
            });
        });
    }

    const statsEl = document.getElementById('map-quick-stats');
    if (statsEl) {
        const branchCount = registeredEntities.filter(entity => entity.entityType === 'BRANCH').length;
        statsEl.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${branchCount} فرع</span> • <span>${projectsToRender.length} مشروع</span> • <span>${reportsData.length} تقرير</span>`;
    }
}

function filterMapRegion(region) {
    currentRegion = region;
    document.querySelectorAll('.region-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-region') === region);
    });

    if (!executiveMap) return;

    if (region === 'all') {
        executiveMap.flyToBounds(MENA_AFRICA_BOUNDS, { padding: [10, 10], duration: 1.0 });
    } else if (region === 'gcc') {
        executiveMap.flyToBounds([[15.0, 35.0], [33.0, 60.0]], { padding: [15, 15], duration: 1.0 });
    } else if (region === 'north_africa') {
        executiveMap.flyToBounds([[18.0, -18.0], [37.5, 36.0]], { padding: [15, 15], duration: 1.0 });
    } else if (region === 'sub_saharan') {
        executiveMap.flyToBounds([[-35.0, -18.0], [16.0, 52.0]], { padding: [15, 15], duration: 1.0 });
    } else if (region === 'middle_east') {
        executiveMap.flyToBounds([[28.0, 33.0], [38.0, 50.0]], { padding: [15, 15], duration: 1.0 });
    }
}

function setControlToggleState(buttonId, stateId, isActive) {
    const controlButton = document.getElementById(buttonId);
    const stateLabel = document.getElementById(stateId);
    if (controlButton) {
        controlButton.classList.toggle('active', isActive);
        controlButton.setAttribute('aria-pressed', String(isActive));
    }
    if (stateLabel) stateLabel.textContent = isActive ? 'نشط' : 'معطل';
}

function syncControlCenterTabs() {
    const container = document.getElementById('map-controls-container');
    const primaryMenu = document.getElementById('fab-primary-menu');
    const isRootOpen = container?.classList.contains('is-open') === true;
    if (primaryMenu) primaryMenu.setAttribute('aria-hidden', String(!isRootOpen));
    document.querySelectorAll('[data-control-tab]').forEach(tabButton => {
        const isActive = isRootOpen && tabButton.dataset.controlTab === activeMapControlMenu;
        tabButton.classList.toggle('is-active', isActive);
        tabButton.setAttribute('aria-expanded', String(isActive));
    });
    document.querySelectorAll('[data-control-panel]').forEach(tabPanel => {
        const isActive = isRootOpen && tabPanel.dataset.controlPanel === activeMapControlMenu;
        tabPanel.classList.toggle('is-open', isActive);
        tabPanel.setAttribute('aria-hidden', String(!isActive));
    });
    if (container) container.classList.toggle('has-submenu', isRootOpen && activeMapControlMenu !== null);
}

function syncTickerControlUI() {
    document.querySelectorAll('[data-ticker-criterion]').forEach(criterionButton => {
        const isActive = criterionButton.dataset.tickerCriterion === mapControlState.tickerCriterion;
        criterionButton.classList.toggle('active', isActive);
        criterionButton.setAttribute('aria-pressed', String(isActive));
    });
    document.querySelectorAll('[data-ticker-direction]').forEach(directionButton => {
        const isActive = directionButton.dataset.tickerDirection === mapControlState.tickerDirection;
        directionButton.classList.toggle('active', isActive);
        directionButton.setAttribute('aria-pressed', String(isActive));
    });
}

function syncSettingsControlUI() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeState = document.getElementById('fab-state-theme');
    const themeKnobIcon = document.getElementById('theme-knob-icon');
    const isLight = mapControlState.theme === 'aegov';

    if (themeBtn) {
        themeBtn.setAttribute('data-theme-active', mapControlState.theme);
        themeBtn.classList.toggle('active', isLight);
        themeBtn.setAttribute('aria-pressed', String(isLight));
    }
    if (themeState) {
        themeState.textContent = isLight ? 'Light' : 'Dark';
    }
    if (themeKnobIcon) {
        themeKnobIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    const slicer = document.getElementById('completion-slicer-toggle');
    if (slicer) {
        slicer.classList.toggle('active', mapControlState.completionSlicerEnabled);
        slicer.setAttribute('aria-pressed', String(mapControlState.completionSlicerEnabled));
    }
}

function syncMapControlCenterUI() {
    syncControlCenterTabs();
    setControlToggleState('fab-action-projects', 'fab-state-projects', showProjects);
    setControlToggleState('fab-action-branches', 'fab-state-branches', showBranches);
    setControlToggleState('fab-action-analysis', 'fab-state-analysis', isBusinessAnalysisMode);
    setControlToggleState('fab-action-warning', 'fab-state-warning', isEarlyWarningMode);
    syncTickerControlUI();
    syncSettingsControlUI();
}

function selectMapControlTab(tabName) {
    if (!MAP_CONTROL_TABS.has(tabName)) return;
    activeMapControlMenu = activeMapControlMenu === tabName ? null : tabName;
    syncMapControlCenterUI();
}

function setTickerSortCriterion(criterion) {
    if (!TICKER_SORT_CRITERIA.has(criterion)) return;
    mapControlState.tickerCriterion = criterion;
    saveMapControlState();
    syncMapControlCenterUI();
    renderHeaderStockTicker();
}

function setTickerSortDirection(direction) {
    if (direction !== 'asc' && direction !== 'desc') return;
    mapControlState.tickerDirection = direction;
    saveMapControlState();
    syncMapControlCenterUI();
    renderHeaderStockTicker();
}

function setCompletionSlicerEnabled(isEnabled) {
    mapControlState.completionSlicerEnabled = isEnabled === true;
    saveMapControlState();
    syncMapControlCenterUI();

    rebuildCountryStatsCache();
    applyRestoredMapDisplayMode();
    renderBoardBriefing();
    renderHeaderStockTicker();

    const projCountEl = document.getElementById('kpi-count-projects');
    if (projCountEl) projCountEl.textContent = String(latestProjectReports().length);

    if (activeCountryBoardContext && document.getElementById('country-drawer-overlay')?.classList.contains('show')) {
        const { countryGeo, countryName } = activeCountryBoardContext;
        openCountryBoard(countryGeo, countryName);
    }
}

function toggleCompletionSlicerEnabled() {
    setCompletionSlicerEnabled(!mapControlState.completionSlicerEnabled);
}

function persistMapModeState() {
    mapControlState.showProjects = showProjects;
    mapControlState.showBranches = showBranches;
    mapControlState.businessAnalysis = isBusinessAnalysisMode;
    mapControlState.earlyWarning = isEarlyWarningMode;
    saveMapControlState();
    syncMapControlCenterUI();
}

function restoreMapControlState() {
    mapControlState = loadMapControlState();
    showProjects = mapControlState.showProjects;
    showBranches = mapControlState.showBranches;
    isBusinessAnalysisMode = mapControlState.businessAnalysis;
    isEarlyWarningMode = mapControlState.earlyWarning;
    setMapTheme(mapControlState.theme);
}

function applyRestoredMapDisplayMode() {
    if (geoJsonLayer) geoJsonLayer.setStyle(getCountryBoundaryStyle);
    if (isEarlyWarningMode) {
        if (markersGroup) markersGroup.clearLayers();
        renderAllEarlyWarningMarkers();
    } else if (isBusinessAnalysisMode) {
        if (markersGroup) markersGroup.clearLayers();
        if (showBranches) renderBranchMarkersOnly();
    } else {
        updateMapMarkers();
    }
    updateFloatingMapLegend();
}

function toggleMapControlsMenu(event) {
    if (event) event.stopPropagation();
    const container = document.getElementById('map-controls-container');
    const btn = document.getElementById('map-controls-trigger');
    if (!container || !btn) return;
    const isOpen = container.classList.contains('is-open');
    if (isOpen) {
        closeMapControlsMenu();
    } else {
        container.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        syncControlCenterTabs();
    }
}

function closeMapControlsMenu() {
    const container = document.getElementById('map-controls-container');
    const btn = document.getElementById('map-controls-trigger');
    if (container) container.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    activeMapControlMenu = null;
    syncControlCenterTabs();
}

// Auto-close menu when clicking outside
document.addEventListener('click', (e) => {
    const container = document.getElementById('map-controls-container');
    if (container && !container.contains(e.target)) {
        closeMapControlsMenu();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        const btn = document.getElementById('map-controls-trigger');
        const wasOpen = document.getElementById('map-controls-container')?.classList.contains('is-open');
        closeMapControlsMenu();
        if (wasOpen && btn) btn.focus();
    }
});

function toggleMapLayer(layer) {
    if (layer === 'branches') {
        showBranches = !showBranches;
        const btn = document.getElementById('fab-action-branches');
        const state = document.getElementById('fab-state-branches');
        if (btn) btn.classList.toggle('active', showBranches);
        if (state) state.textContent = showBranches ? 'نشط' : 'معطل';
    } else if (layer === 'projects') {
        showProjects = !showProjects;
        const btn = document.getElementById('fab-action-projects');
        const state = document.getElementById('fab-state-projects');
        if (btn) btn.classList.toggle('active', showProjects);
        if (state) state.textContent = showProjects ? 'نشط' : 'معطل';
    }
    
    if (isBusinessAnalysisMode) {
        if (showBranches) {
            renderBranchMarkersOnly();
        } else if (markersGroup) {
            markersGroup.clearLayers();
        }
    } else {
        updateMapMarkers();
    }
    persistMapModeState();
}

function toggleBusinessAnalysisMode() {
    isBusinessAnalysisMode = !isBusinessAnalysisMode;
    if (isBusinessAnalysisMode && isEarlyWarningMode) {
        toggleEarlyWarningMode();
    }
    const btn = document.getElementById('fab-action-analysis');
    const state = document.getElementById('fab-state-analysis');

    if (btn) btn.classList.toggle('active', isBusinessAnalysisMode);
    if (state) state.textContent = isBusinessAnalysisMode ? 'نشط' : 'معطل';

    // Re-apply boundary colors (heatmap green / red / yellow)
    if (geoJsonLayer) {
        geoJsonLayer.eachLayer(countryLayer => {
            if (typeof countryLayer.closeTooltip === 'function') countryLayer.closeTooltip();
            if (typeof countryLayer.unbindTooltip === 'function') countryLayer.unbindTooltip();
        });
        geoJsonLayer.setStyle(getCountryBoundaryStyle);
    }

    if (isBusinessAnalysisMode) {
        if (markersGroup) markersGroup.clearLayers();
        if (showBranches) renderBranchMarkersOnly();
    } else {
        updateMapMarkers();
    }
    updateFloatingMapLegend();
    persistMapModeState();
}

/* ==================================================== */
/* Early Warning Mechanism (آلية الإنذار المبكر)         */
/* ==================================================== */
let isEarlyWarningMode = false;
let earlyWarningMarkersGroup = null;

const EARLY_WARNING_MAX_SCORE = 100;

function normalizeEarlyWarningText(answerValue) {
    return String(answerValue === null || answerValue === undefined ? '' : answerValue)
        .normalize('NFKC')
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[\u061C\u200B-\u200F\u202A-\u202E]/g, '')
        .toLowerCase()
        .replace(/[\s\-_/.,،:;؛؟!?()[\]{}]+/g, '');
}

function earlyWarningAnswerIncludes(answerValue, candidates) {
    const normalized = normalizeEarlyWarningText(answerValue);
    return normalized !== '' && candidates.some(candidate => normalized.includes(normalizeEarlyWarningText(candidate)));
}

function isEarlyWarningNoAnswer(answerValue) {
    const normalized = normalizeEarlyWarningText(answerValue);
    if (!normalized) return false;
    return normalized === 'لا'
        || normalized === 'no'
        || normalized === 'كلا'
        || normalized.startsWith('لايوجد')
        || normalized.startsWith('لاتوجد')
        || normalized.startsWith('لميتم')
        || normalized.startsWith('غيرموجود')
        || normalized.startsWith('غيرمتوفر');
}

function isEarlyWarningYesAnswer(answerValue) {
    const normalized = normalizeEarlyWarningText(answerValue);
    if (!normalized || isEarlyWarningNoAnswer(answerValue)) return false;
    return normalized === 'نعم'
        || normalized === 'yes'
        || normalized.startsWith('تم')
        || normalized.includes('يوجد')
        || normalized.includes('موجود')
        || normalized.includes('متوفر')
        || normalized.includes('معتمد');
}

function isNoStartupProblemAnswer(answerValue) {
    const normalized = normalizeEarlyWarningText(answerValue);
    if (!normalized) return false;
    if (earlyWarningAnswerIncludes(answerValue, [
        'لا يوجد مشاكل في القدرة',
        'لا توجد مشاكل في القدرة',
        'لا يوجد مشاكل في القدره',
        'لا توجد مشاكل في القدره',
        'لا يوجد مشاكل تخص القدرة على البدء',
        'لا توجد مشاكل تخص القدرة على البدء',
        'لا يوجد مشاكل تخص القدرة على البدأ',
        'لا توجد مشاكل تخص القدرة على البدأ',
        'لا يوجد مشاكل في البدء',
        'لا توجد مشاكل في البدء',
        'لا يوجد معوقات',
        'لا توجد معوقات',
        'لا ينطبق'
    ])) return true;

    // Accept equivalent wording even when the sheet contains hidden marks or extra words.
    const hasNoProblem = normalized.includes('لايوجد') || normalized.includes('لاتوجد');
    return hasNoProblem && normalized.includes('قدر') && normalized.includes('بدء');
}

function makeEarlyWarningItem(questionResult) {
    const { question, answer, points, maxPoints, answerUnit = '', isDeactivated } = questionResult;
    const cleanAnswer = String(answer === null || answer === undefined ? '' : answer).trim();
    const displayedAnswer = isDeactivated
        ? 'غير منطبق (معطل)'
        : (cleanAnswer && answerUnit ? `${cleanAnswer} ${answerUnit}` : cleanAnswer);
    return {
        q: question,
        ans: displayedAnswer || 'بيانات غير مكتملة',
        points,
        maxPoints,
        isDeactivated: !!isDeactivated,
        status: isDeactivated ? 'neutral' : (points === maxPoints ? 'pass' : (points > 0 ? 'warn' : 'fail'))
    };
}

function boqAccuracyRatio(answer) {
    if (!normalizeEarlyWarningText(answer)) return 0;
    if (earlyWarningAnswerIncludes(answer, ['غير دقيقة', 'غير دقيق'])) return 0;
    if (earlyWarningAnswerIncludes(answer, ['دقيقة للغاية', 'دقيق للغاية', 'دقيقة جدا', 'دقيق جدا', 'ممتاز'])) return 1;
    if (earlyWarningAnswerIncludes(answer, ['فوق المتوسطة', 'فوق المتوسط', 'اعلى من المتوسط'])) return 0.75;
    if (earlyWarningAnswerIncludes(answer, ['متوسطة', 'متوسط'])) return 0.5;
    if (earlyWarningAnswerIncludes(answer, ['دقيقة', 'دقيق'])) return 1;
    return 0;
}

function noOutstandingValueRatio(rawAnswer, numericValue) {
    const hasRawAnswer = rawAnswer !== null
        && rawAnswer !== undefined
        && String(rawAnswer).trim() !== '';
    if (!hasRawAnswer) return 0;

    const numericAnswer = typeof rawAnswer === 'number'
        ? rawAnswer
        : Number(String(rawAnswer).replace(/,/g, '').trim());

    if (Number.isFinite(numericAnswer)) return numericAnswer === 0 ? 1 : 0;
    if (earlyWarningAnswerIncludes(rawAnswer, ['صفر', 'zero']) || isEarlyWarningNoAnswer(rawAnswer)) return 1;
    if (Number(numericValue) > 0) return 0;
    return 0;
}

function getEarlyWarningLevel(score) {
    // Boundary contract: 75 is green, 50 is yellow, and every lower score is red.
    if (score >= 75) {
        return {
            level: 'safe',
            levelLabel: 'مستقر وآمن',
            color: '#10b981',
            pulseClass: 'radar-pulse-slow'
        };
    }
    if (score >= 50) {
        return {
            level: 'medium',
            levelLabel: 'تحت المتابعة والملاحظة',
            color: '#f59e0b',
            pulseClass: 'radar-pulse-medium'
        };
    }
    return {
        level: 'danger',
        levelLabel: 'إنذار مبكر حرج',
        color: '#ef4444',
        pulseClass: 'radar-pulse-fast'
    };
}

const EARLY_WARNING_GROUPS = [
    { key: 'contract', title: 'الموقف التعاقدي والمقايسة', icon: 'fa-file-contract' },
    { key: 'startup', title: 'إجراءات بدء المشروع والتواصل', icon: 'fa-handshake' },
    { key: 'delivery', title: 'التوريدات والسيولة والمستحقات', icon: 'fa-chart-line' }
];

const EARLY_WARNING_QUESTIONS = [
    {
        groupKey: 'contract',
        question: 'موقف المطالبات والتحكيم',
        maxPoints: 14,
        readAnswer: report => report.claimsStatus,
        scoreRatio: answer => isEarlyWarningNoAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'contract',
        question: 'هل يوجد مقايسة للمشروع (BOQ)؟',
        maxPoints: 5,
        readAnswer: report => report.hasBillOfQuantities,
        scoreRatio: answer => isEarlyWarningYesAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'contract',
        question: 'ما مدى دقة مقايسة المشروع؟',
        maxPoints: 6,
        readAnswer: report => report.boqAccuracy,
        scoreRatio: boqAccuracyRatio
    },
    {
        groupKey: 'contract',
        question: 'هل تم إصدار الضمانات ووثيقة التأمين في بداية المشروع؟',
        maxPoints: 5,
        readAnswer: report => report.lgIssued,
        scoreRatio: answer => isEarlyWarningYesAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'startup',
        question: 'هل تم الاجتماع مع العميل خلال 15 يوما عند تعذر البدء؟',
        maxPoints: 5,
        readAnswer: report => report.meetingClient15Days,
        scoreRatio: answer => (isNoStartupProblemAnswer(answer) || isEarlyWarningYesAnswer(answer)) ? 1 : 0
    },
    {
        groupKey: 'startup',
        question: 'هل تم إرسال خطاب رسمي للعميل موضحا معوقات البدء؟',
        maxPoints: 5,
        readAnswer: report => report.formalLetterSent,
        scoreRatio: answer => (isNoStartupProblemAnswer(answer) || isEarlyWarningYesAnswer(answer)) ? 1 : 0
    },
    {
        groupKey: 'delivery',
        question: 'هل تم إعداد برنامج توريدات مستوف لجميع مراحل الشراء؟',
        maxPoints: 10,
        readAnswer: report => report.supplySchedulePrepared,
        scoreRatio: answer => isEarlyWarningYesAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'delivery',
        question: 'هل تم اعتماد جميع مهمات الكهروميكانيك؟',
        maxPoints: 12,
        readAnswer: report => report.mepApproved,
        scoreRatio: answer => isEarlyWarningYesAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'delivery',
        question: 'هل تم إعداد ومراجعة برنامج التدفقات النقدية؟',
        maxPoints: 13,
        readAnswer: report => report.cashFlowPlanPrepared,
        scoreRatio: answer => isEarlyWarningYesAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'delivery',
        question: 'هل يوجد تدفق نقدي سالب؟',
        maxPoints: 15,
        readAnswer: report => report.negativeCashFlow,
        scoreRatio: answer => isEarlyWarningNoAnswer(answer) ? 1 : 0
    },
    {
        groupKey: 'delivery',
        question: 'إجمالي قيمة مستحقات مقاولي الباطن',
        maxPoints: 10,
        answerUnit: '$',
        readAnswer: report => report.subcontractorsDueAnswer,
        scoreRatio: (answer, report) => noOutstandingValueRatio(answer, report.subcontractorsDue)
    }
];

function evaluateEarlyWarningQuestions(report) {
    const isQ9Yes = isEarlyWarningYesAnswer(report ? report.cashFlowPlanPrepared : null);

    // Condition 01: If Q9 is "No" (or not Yes), deactivate Q10 (0%) and redistribute its 15% weight equally across the remaining 10 questions
    const dynamicWeights = isQ9Yes ? [
        14, // Q1: موقف المطالبات والتحكيم
        5,  // Q2: هل يوجد مقايسة للمشروع (BOQ)؟
        6,  // Q3: ما مدى دقة مقايسة المشروع؟
        5,  // Q4: إصدار خطابات الضمان وبداية المشروع
        5,  // Q5: الاجتماع مع العميل لعرض المعوقات
        5,  // Q6: إرسال خطاب رسمي بالمعوقات
        10, // Q7: برنامج التوريدات ومراحل الشراء
        12, // Q8: اعتماد مهمات الكهروميكانيك
        13, // Q9: إعداد برنامج التدفقات النقدية ومراجعته
        15, // Q10: هل يوجد Negative cashflow؟
        10  // Q11: إجمالي قيمة مستحقات مقاولي الباطن
    ] : [
        16, // Q1: +2% -> 16%
        6,  // Q2: +1% -> 6%
        7,  // Q3: +1% -> 7%
        6,  // Q4: +1% -> 6%
        6,  // Q5: +1% -> 6%
        6,  // Q6: +1% -> 6%
        12, // Q7: +2% -> 12%
        14, // Q8: +2% -> 14%
        15, // Q9: +2% -> 15%
        0,  // Q10: -15% -> 0% (معطل)
        12  // Q11: +2% -> 12%
    ];

    return EARLY_WARNING_QUESTIONS.map((questionDefinition, index) => {
        const maxPoints = dynamicWeights[index] !== undefined ? dynamicWeights[index] : questionDefinition.maxPoints;
        const answer = questionDefinition.readAnswer(report);
        const ratio = maxPoints === 0 ? 0 : questionDefinition.scoreRatio(answer, report);
        const points = Math.round(maxPoints * ratio * 10) / 10;
        return {
            ...questionDefinition,
            maxPoints,
            answer,
            points,
            isDeactivated: maxPoints === 0
        };
    });
}

function groupEarlyWarningQuestions(questionResults) {
    return EARLY_WARNING_GROUPS.map(groupDefinition => ({
        title: groupDefinition.title,
        icon: groupDefinition.icon,
        items: questionResults
            .filter(questionResult => questionResult.groupKey === groupDefinition.key)
            .map(makeEarlyWarningItem)
    }));
}

function calculateEarlyWarningScore(questionResults) {
    const awardedPoints = questionResults.reduce((sum, questionResult) => sum + questionResult.points, 0);
    const boundedPoints = Math.min(EARLY_WARNING_MAX_SCORE, Math.max(0, awardedPoints));
    return Math.round(boundedPoints * 10) / 10;
}

function evaluateProjectEarlyWarning(report) {
    if (!report) {
        return {
            score: 0,
            level: 'danger',
            levelLabel: 'بيانات غير مكتملة',
            color: '#ef4444',
            pulseClass: 'radar-pulse-fast',
            groups: []
        };
    }

    const questionResults = evaluateEarlyWarningQuestions(report);
    const score = calculateEarlyWarningScore(questionResults);
    return {
        score,
        ...getEarlyWarningLevel(score),
        groups: groupEarlyWarningQuestions(questionResults)
    };
}

function summarizeCountryEarlyWarning(projects) {
    const projectList = Array.isArray(projects) ? projects.filter(Boolean) : [];
    if (projectList.length === 0) {
        return {
            score: null,
            level: 'neutral',
            levelLabel: 'لا توجد بيانات مشروعات',
            color: '#64748b',
            totalProjects: 0,
            dangerCount: 0,
            mediumCount: 0,
            safeCount: 0
        };
    }

    let totalScore = 0;
    let dangerCount = 0;
    let mediumCount = 0;
    let safeCount = 0;

    projectList.forEach(project => {
        const projectWarning = evaluateProjectEarlyWarning(project);
        totalScore += projectWarning.score;
        if (projectWarning.level === 'danger') dangerCount++;
        else if (projectWarning.level === 'medium') mediumCount++;
        else safeCount++;
    });

    const score = Math.round((totalScore / projectList.length) * 10) / 10;
    const levelData = getEarlyWarningLevel(score);

    return {
        score,
        level: levelData.level,
        levelLabel: levelData.levelLabel,
        color: levelData.color,
        totalProjects: projectList.length,
        dangerCount,
        mediumCount,
        safeCount
    };
}

function evaluateCountryEarlyWarning(countryName, isoCode = null) {
    if (isoCode) {
        if (precomputedEarlyWarningStats.has(isoCode)) return precomputedEarlyWarningStats.get(isoCode);
        if (precomputedEarlyWarningStats.has(isoCode.toLowerCase())) return precomputedEarlyWarningStats.get(isoCode.toLowerCase());
    }
    if (countryName) {
        const clean = String(countryName).trim();
        if (precomputedEarlyWarningStats.has(clean)) return precomputedEarlyWarningStats.get(clean);
        if (precomputedEarlyWarningStats.has(clean.toLowerCase())) return precomputedEarlyWarningStats.get(clean.toLowerCase());
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(clean) : null;
        if (geo && geo.id) {
            if (precomputedEarlyWarningStats.has(geo.id)) return precomputedEarlyWarningStats.get(geo.id);
            if (precomputedEarlyWarningStats.has(geo.id.toLowerCase())) return precomputedEarlyWarningStats.get(geo.id.toLowerCase());
        }
    }

    const countryProjects = [];
    const seen = new Set();
    reportsData.forEach(report => {
        if (!report || !report.projectName || seen.has(report.projectName)) return;
        if (isProjectExcludedByCompletion(report)) return;
        const country = report.country
            || branchToCountryMap[report.branchName]
            || projectToCountryMap[report.projectName]
            || '';
        if (countriesMatch(country, countryName) || (isoCode && countriesMatch(country, isoCode))) {
            seen.add(report.projectName);
            countryProjects.push(report);
        }
    });

    return summarizeCountryEarlyWarning(countryProjects);
}

function getEarlyWarningColor(score) {
    if (score === null || score === undefined || Number.isNaN(Number(score))) return '#64748b';
    return getEarlyWarningLevel(Number(score)).color;
}

function toggleEarlyWarningMode() {
    isEarlyWarningMode = !isEarlyWarningMode;
    if (isEarlyWarningMode && isBusinessAnalysisMode) {
        toggleBusinessAnalysisMode();
    }
    const btn = document.getElementById('fab-action-warning');
    const state = document.getElementById('fab-state-warning');

    if (btn) btn.classList.toggle('active', isEarlyWarningMode);
    if (state) state.textContent = isEarlyWarningMode ? 'نشط' : 'معطل';

    if (geoJsonLayer) {
        geoJsonLayer.setStyle(getCountryBoundaryStyle);
    }

    if (isEarlyWarningMode) {
        if (markersGroup) markersGroup.clearLayers();
        renderAllEarlyWarningMarkers();
    } else {
        if (earlyWarningMarkersGroup) earlyWarningMarkersGroup.clearLayers();
        closeEarlyWarningSidebar();
        updateMapMarkers();
    }
    updateFloatingMapLegend();
    persistMapModeState();
}

function updateFloatingMapLegend() {
    const container = document.getElementById('map-floating-legend');
    const content = document.getElementById('legend-card-content');
    if (!container || !content) return;

    content.classList.toggle('compact-market-legend', isBusinessAnalysisMode && !isEarlyWarningMode);
    content.classList.toggle('flat-legend', isBusinessAnalysisMode || isEarlyWarningMode);

    if (isEarlyWarningMode) {
        content.innerHTML = `
            <div class="legend-header">
                <div class="legend-title">خريطة مؤشر الإنذار المبكر</div>
            </div>
            <div class="legend-items">
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#10b981; color:rgba(16,185,129,0.55);"></span>
                        <span class="legend-label"><bdi dir="ltr">100 - 75</bdi></span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#f59e0b; color:rgba(245,158,11,0.55);"></span>
                        <span class="legend-label"><bdi dir="ltr">75 - 50</bdi></span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#ef4444; color:rgba(239,68,68,0.55);"></span>
                        <span class="legend-label"><bdi dir="ltr">50 - 0</bdi></span>
                    </div>
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (isBusinessAnalysisMode) {
        content.innerHTML = `
            <div class="legend-header">
                <div class="legend-title">خريطة تحليل الأعمال</div>
            </div>
            <div class="legend-items">
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#facc15; color:rgba(250,204,21,0.55);"></span>
                        <span class="legend-label">فروع بدون مشروعات</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#991b1b; color:rgba(153,27,27,0.55);"></span>
                        <span class="legend-label">فروع أعمالها منتهية</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#fca5a5; color:rgba(252,165,165,0.75);"></span>
                        <span class="legend-label">فروع أعمالها شارفت على الانتهاء</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#10b981; color:rgba(16,185,129,0.55);"></span>
                        <span class="legend-label">فروع بمشروعات نشطة</span>
                    </div>
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function renderAllEarlyWarningMarkers(targetCountry = null) {
    if (!executiveMap) return;
    if (!earlyWarningMarkersGroup) {
        earlyWarningMarkersGroup = L.layerGroup().addTo(executiveMap);
    }
    earlyWarningMarkersGroup.clearLayers();

    const uniqueProjects = [];
    const seen = new Set();

    reportsData.forEach(r => {
        if (!r || !r.projectName || seen.has(r.projectName)) return;
        if (isProjectExcludedByCompletion(r)) return;
        const c = r.country || branchToCountryMap[r.branchName] || '';
        if (targetCountry) {
            if (c === targetCountry || (typeof countriesMatch === 'function' && countriesMatch(c, targetCountry))) {
                seen.add(r.projectName);
                uniqueProjects.push(r);
            }
        } else {
            seen.add(r.projectName);
            uniqueProjects.push(r);
        }
    });

    // Group projects by base coordinate (~15km bucket) to prevent overlapping
    const buckets = new Map();
    uniqueProjects.forEach(proj => {
        const country = proj.country || branchToCountryMap[proj.branchName] || '';
        const rawCoords = getProjectCoordinates(proj.projectName, proj.branchName, country, proj.mapsLink);
        const key = `${rawCoords.lat.toFixed(2)}_${rawCoords.lng.toFixed(2)}`;
        if (!buckets.has(key)) {
            buckets.set(key, { baseLat: rawCoords.lat, baseLng: rawCoords.lng, items: [] });
        }
        buckets.get(key).items.push({ proj, country, rawCoords });
    });

    // Disperse markers around center if multiple in same city/branch
    buckets.forEach(bucket => {
        const count = bucket.items.length;
        bucket.items.forEach((item, idx) => {
            const { proj, country, rawCoords } = item;
            const ew = evaluateProjectEarlyWarning(proj);
            
            let finalLat = rawCoords.lat;
            let finalLng = rawCoords.lng;

            if (count > 1) {
                const angle = (idx / count) * 2 * Math.PI - (Math.PI / 2);
                // Keep early-warning collision offsets local to the project site.
                const radius = Math.min(0.018, 0.008 + count * 0.001);
                finalLat = bucket.baseLat + Math.sin(angle) * radius;
                finalLng = bucket.baseLng + Math.cos(angle) * radius * 1.2;
            }

            const projColor = ew.color;
            const projGlow = projColor === '#ef4444' 
                ? 'rgba(239, 68, 68, 0.35)' 
                : (projColor === '#f59e0b' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)');

            const iconHtml = `
                <div class="project-beacon-container" onclick="openEarlyWarningSidebar('${escapeHtml(proj.projectName)}', '${escapeHtml(country)}', '${escapeHtml(proj.branchName || '')}')">
                    <div class="project-beacon-glow-outer" style="background:${projGlow};"></div>
                    <div class="project-beacon-glow-inner" style="background:${projGlow};"></div>
                    <div class="project-beacon-core" style="background:${projColor}; box-shadow:0 0 9px 2px ${projGlow};"></div>
                </div>
            `;

            const icon = L.divIcon({
                html: iconHtml,
                className: 'custom-project-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([finalLat, finalLng], { icon });

            marker.on('click', () => {
                openEarlyWarningSidebar(proj.projectName, country, proj.branchName);
            });
            earlyWarningMarkersGroup.addLayer(marker);
        });
    });
}

function renderEarlyWarningCountryMarkers(countryName) {
    renderAllEarlyWarningMarkers(countryName);
}

let activeEarlyWarningProject = null;

function openEarlyWarningSidebar(projectName, countryName = null, branchName = null) {
    const sidebar = document.getElementById('early-warning-sidebar');
    if (!sidebar) return;

    const pReports = reportsData.filter(r => r.projectName === projectName || (r.isProjectReport && r.projectName.includes(projectName)));
    const latestReport = pReports.length > 0 ? pReports[0] : (globalRawReports.find(r => r.projectName === projectName) || null);
    const ew = evaluateProjectEarlyWarning(latestReport);

    const country = countryName || (latestReport ? latestReport.country : '') || projectToCountryMap[projectName] || '';
    const branch = branchName || (latestReport ? latestReport.branchName : '') || projectToBranchMap[projectName] || '';

    activeEarlyWarningProject = {
        projectName,
        countryName: country,
        branchName: branch
    };

    document.getElementById('ew-project-name').textContent = projectName;
    const miniBadge = document.getElementById('ew-mini-badge');
    if (miniBadge) {
        miniBadge.innerHTML = `<span style="color:${ew.color};">🚨 ${escapeHtml(projectName)} (${ew.score}%)</span>`;
    }

    const body = document.getElementById('ew-body');
    if (body) {
        body.innerHTML = `
            <div class="ew-score-card" style="border-left: 4px solid ${ew.color};">
                <div>
                    <div style="font-size:11.5px;color:#94a3b8;font-weight:700;">مؤشر صحة المشروع المركب</div>
                    <div class="ew-score-num" style="color:${ew.color};">${ew.score}<span style="font-size:16px;">%</span></div>
                </div>
            </div>

            ${ew.groups.map(g => `
                <div class="ew-group">
                    <div class="ew-group-title">
                        <i class="fa-solid ${g.icon}"></i> ${g.title}
                    </div>
                    ${g.items.map(item => `
                        <div class="ew-item${item.isDeactivated ? ' is-deactivated' : ''}">
                            <span class="ew-item-q">${escapeHtml(item.q)}</span>
                            <span class="ew-item-ans ew-ans-${item.status}">${escapeHtml(item.ans)} · ${item.points}/${item.maxPoints}</span>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
    }

    sidebar.classList.remove('hidden');
    sidebar.classList.remove('is-minimized');
}

function openFullReportFromSidebar(event) {
    if (event) event.stopPropagation();
    if (activeEarlyWarningProject && activeEarlyWarningProject.projectName) {
        const country = activeEarlyWarningProject.countryName || projectToCountryMap[activeEarlyWarningProject.projectName] || '';
        if (country) {
            openCountryDrawer(country, activeEarlyWarningProject.projectName);
        }
        const sidebar = document.getElementById('early-warning-sidebar');
        if (sidebar) {
            sidebar.classList.add('is-minimized');
        }
    }
}

function toggleEarlyWarningSidebarMinimize(event) {
    if (event) event.stopPropagation();
    const sidebar = document.getElementById('early-warning-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('is-minimized');
    }
}

function handleEarlyWarningSidebarClick(event) {
    const sidebar = document.getElementById('early-warning-sidebar');
    if (sidebar && sidebar.classList.contains('is-minimized')) {
        sidebar.classList.remove('is-minimized');
    }
}

function closeEarlyWarningSidebar(event) {
    if (event) event.stopPropagation();
    const sidebar = document.getElementById('early-warning-sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden');
    }
}

function renderBranchMarkersOnly() {
    if (!executiveMap || !markersGroup) return;
    markersGroup.clearLayers();
    addEntityMarkers(markersGroup);
}

function formatCompactUSD(val) {
    if (!val || val === 0) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${Math.round(val)}`;
}

function renderBusinessAnalysisBubbles() {
    if (!executiveMap) return;
    if (!businessBubblesGroup) {
        businessBubblesGroup = L.layerGroup().addTo(executiveMap);
    }
    businessBubblesGroup.clearLayers();
    if (!isBusinessAnalysisMode) return;

    const countryDataMap = new Map();

    reportsData.forEach(r => {
        const country = r.country || (r.projectName ? projectToCountryMap[r.projectName] : '') || '';
        if (!country) return;

        const geoObj = typeof findCountryGeo === 'function' ? findCountryGeo(country) : null;
        const canonical = geoObj ? geoObj.id : String(country).trim().toLowerCase();
        const displayName = geoObj ? (geoObj.nameAr || geoObj.nameEn || country) : country;

        if (!countryDataMap.has(canonical)) {
            countryDataMap.set(canonical, {
                countryName: displayName,
                canonicalKey: canonical,
                geoObj,
                projects: new Map(),
                totalValueUsd: 0
            });
        }

        const cData = countryDataMap.get(canonical);
        if (r.projectName) {
            const pKey = r.projectId || r.projectName;
            if (!cData.projects.has(pKey)) {
                const pVal = Number(r.valueUsd) || 0;
                cData.projects.set(pKey, { name: r.projectName, valueUsd: pVal });
                cData.totalValueUsd += pVal;
            }
        }
    });


    if (countryDataMap.size === 0) return;

    let maxVal = 0;
    countryDataMap.forEach(d => {
        if (d.totalValueUsd > maxVal) maxVal = d.totalValueUsd;
    });
    if (maxVal === 0) maxVal = 1;

    countryDataMap.forEach((cData) => {
        const countryName = cData.countryName;
        const totalVal = cData.totalValueUsd;
        const projCount = cData.projects.size;
        if (projCount === 0 && totalVal === 0) return;

        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(countryName) : null;
        let coords = geo && geo.center ? geo.center : (geo && geo.lat ? [geo.lat, geo.lng] : null);

        // Fallback: compute centroid from GeoJSON feature matching this country
        if (!coords && menaGeoJsonData && menaGeoJsonData.features) {
            const matchedFeature = menaGeoJsonData.features.find(f => {
                const props = f.properties || {};
                const fIso = props['ISO3166-1-Alpha-2'] || props['ISO_A2'] || props['iso_a2'] || '';
                const fName = props['name'] || props['NAME'] || props['ADMIN'] || '';
                if (geo && geo.id && fIso.toUpperCase() === geo.id.toUpperCase()) return true;
                if (fName && fName.toLowerCase() === countryName.toLowerCase()) return true;
                return false;
            });
            if (matchedFeature && matchedFeature.geometry) {
                // Simple centroid of bounding box
                const coords_arr = [];
                const extractCoords = (geom) => {
                    if (!geom) return;
                    if (geom.type === 'Polygon') {
                        geom.coordinates[0].forEach(c => coords_arr.push(c));
                    } else if (geom.type === 'MultiPolygon') {
                        geom.coordinates.forEach(poly => poly[0].forEach(c => coords_arr.push(c)));
                    }
                };
                extractCoords(matchedFeature.geometry);
                if (coords_arr.length > 0) {
                    const avgLng = coords_arr.reduce((s, c) => s + c[0], 0) / coords_arr.length;
                    const avgLat = coords_arr.reduce((s, c) => s + c[1], 0) / coords_arr.length;
                    coords = [avgLat, avgLng];
                }
            }
        }
        if (!coords) return;


        const ratio = Math.sqrt(totalVal / maxVal);
        const diameter = Math.round(38 + ratio * 44);
        const half = Math.round(diameter / 2);

        const flagClass = getFlagIconClass(countryName);
        const flagHtml = flagClass && flagClass !== 'fi-xx' 
            ? `<span class="fi ${flagClass}" style="border-radius:2px; font-size:${Math.max(12, Math.round(diameter * 0.22))}px;"></span>`
            : (geo && geo.flag ? geo.flag : '🌐');

        const formattedVal = formatCompactUSD(totalVal);

        const iconHtml = `
            <div class="country-volume-bubble-wrapper" style="width:${diameter}px; height:${diameter}px;" onclick="openCountryDrawer('${escapeHtml(countryName)}')">
                <div class="country-volume-bubble-pulse" style="inset:-${Math.round(diameter * 0.16)}px;"></div>
                <div class="country-volume-bubble-core" style="width:${diameter}px; height:${diameter}px;">
                    <span class="bubble-flag">${flagHtml}</span>
                    <span class="bubble-value" style="font-size:${Math.max(10, Math.round(diameter * 0.2))}px;">${formattedVal}</span>
                    <span class="bubble-count" style="font-size:${Math.max(8.5, Math.round(diameter * 0.15))}px;">${projCount} مشاريع</span>
                </div>
            </div>
        `;

        const bubbleIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-volume-bubble-icon',
            iconSize: [diameter, diameter],
            iconAnchor: [half, half]
        });

        const marker = L.marker(coords, { icon: bubbleIcon, zIndexOffset: 800 });

        marker.on('click', () => openCountryDrawer(countryName));
        businessBubblesGroup.addLayer(marker);
    });
}

function toggleTileLayerStyle() {
    currentTileStyle = currentTileStyle === 'dark' ? 'satellite' : 'dark';
    const btn = document.getElementById('toggle-tile-style-btn');
    const label = document.getElementById('tile-style-label');
    const mapEl = document.getElementById('standalone-executive-map');

    if (mapEl) {
        if (currentTileStyle === 'satellite') {
            mapEl.classList.add('satellite-active');
        } else {
            mapEl.classList.remove('satellite-active');
        }
    }

    if (btn && label) {
        if (currentTileStyle === 'satellite') {
            btn.classList.add('active');
            label.innerText = 'خريطة داكنة';
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-moon';
        } else {
            btn.classList.remove('active');
            label.innerText = 'قمر صناعي';
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-satellite';
        }
    }

    if (currentTileLayer && executiveMap) {
        currentTileLayer.setUrl(getMapBaseTileUrl());
    }
}

function openCountryDrawer(countryDataOrName, initialProjectName = null) {
    let countryGeo = null;
    let countryName = '';

    if (typeof countryDataOrName === 'string') {
        countryName = countryDataOrName;
        countryGeo = typeof findCountryGeo === 'function' ? findCountryGeo(countryName) : null;
    } else if (countryDataOrName && typeof countryDataOrName === 'object') {
        countryGeo = countryDataOrName;
        countryName = countryGeo.nameAr || countryGeo.fullNameAr || countryGeo.nameEn;
    }

    activeCountryEntityTypes = new Set(ENTITY_TYPES);
    activeCountryBoardContext = { countryGeo, countryName, initialProjectName };
    return openCountryBoard(countryGeo, countryName, initialProjectName);
}

function toggleCountryEntityTypeFilter(entityType) {
    if (!ENTITY_TYPES.has(entityType) || !activeCountryBoardContext) return;
    if (activeCountryEntityTypes.has(entityType)) {
        activeCountryEntityTypes.delete(entityType);
    } else {
        activeCountryEntityTypes.add(entityType);
    }
    activeCountryBoardContext.initialProjectName = null;
    const { countryGeo, countryName } = activeCountryBoardContext;
    openCountryBoard(countryGeo, countryName);
}

function openCountryBoard(countryGeo, countryName, initialProjectName = null) {
    const overlay = document.getElementById('country-drawer-overlay');
    const dialog = document.getElementById('country-drawer');
    if (!overlay || !dialog) return;

    const reports = reportsData.filter(report => countriesMatch(report.country, countryName));
    const latestByProject = latestReportsByProject(reports);
    let countryProjects = [...latestByProject.values()];
    if (!isBusinessAnalysisMode && mapControlState.completionSlicerEnabled) {
        countryProjects = countryProjects.filter(project => !isProjectExcludedByCompletion(project));
    }
    const availableCountryEntityTypes = new Set(
        countryProjects.map(project => project.entityType).filter(entityType => ENTITY_TYPES.has(entityType))
    );
    const registeredCountryEntityTypes = new Set(
        registeredEntities
            .filter(entity => countriesMatch(entity.country, countryName))
            .map(entity => entity.entityType)
            .filter(entityType => ENTITY_TYPES.has(entityType))
    );
    activeCountryEntityTypes = new Set(
        [...activeCountryEntityTypes].filter(entityType => availableCountryEntityTypes.has(entityType))
    );
    const projects = filterCountryProjectsByEntityType(countryProjects, activeCountryEntityTypes);
    const branchProjectsAvailable = availableCountryEntityTypes.has('BRANCH');
    const companyProjectsAvailable = availableCountryEntityTypes.has('COMPANY');
    const branchPillVisible = registeredCountryEntityTypes.has('BRANCH') || branchProjectsAvailable;
    const companyPillVisible = registeredCountryEntityTypes.has('COMPANY') || companyProjectsAvailable;

    const getMetrics = (p) => {
        if (!p) return { a: 0, b: 0, c: 0, d: 0, f: 0, j: 0, i: 0, h: 0, g: 0, ac: null };
        const a = Number(p.contractValue) || 0;
        const c = Number(p.executedWorkApproved) || 0;
        const b = Number(p.executedWorkTotal) || c;
        const d = Number(p.paidWork) || 0;
        const f = Number(p.collectedLiquidity) || 0;
        const j = Number(p.wagesCost) || 0;
        const i = Number(p.profitLoss) || 0;
        const h = Number(p.uncollectibleWork) || 0;
        const g = Number(p.dueDebt) || 0;
        const rawTimeElapsedPercent = Number(p.timeElapsedPercent);
        const ac = Number.isFinite(rawTimeElapsedPercent) ? rawTimeElapsedPercent : null;
        return { a, b, c, d, f, j, i, h, g, ac };
    };

    const countryTotals = projects.reduce((acc, p) => {
        const m = getMetrics(p);
        acc.a += m.a;
        acc.b += m.b;
        acc.c += m.c;
        acc.d += m.d;
        acc.f += m.f;
        acc.j += m.j;
        acc.i += m.i;
        acc.h += m.h;
        acc.g += m.g;
        return acc;
    }, { a: 0, b: 0, c: 0, d: 0, f: 0, j: 0, i: 0, h: 0, g: 0, ac: null });

    const formatPercent = percentage => Number.isFinite(percentage) ? `${percentage.toFixed(1)}%` : '';

    const kpisList = [
        {
            key: 'kpi_a',
            code: 'A',
            formula: '',
            title: 'إجمالي القيمة التعاقدية',
            subTitle: 'النسبة من إجمالي التعاقدات',
            getMain: (m) => m.a,
            getSub: (m, isAgg) => isAgg ? (m.a ? 100 : 0) : (countryTotals.a ? (m.a / countryTotals.a * 100) : 0),
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_b',
            code: 'B',
            formula: 'B/A',
            title: 'منفذ شامل مستخلص داخلي',
            subTitle: 'نسبة تقدم الأعمال',
            getMain: (m) => m.b,
            getSub: (m) => m.a ? (m.b / m.a * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_c',
            code: 'C',
            formula: 'C/A',
            title: 'منفذ معتمد',
            subTitle: 'نسبة التقدم المعتمد',
            getMain: (m) => m.c,
            getSub: (m) => m.a ? (m.c / m.a * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_d',
            code: 'D',
            formula: 'D/C',
            title: 'أعمال مسددة',
            subTitle: 'نسبة كفاءة التحصيل',
            getMain: (m) => m.d,
            getSub: (m) => m.c ? (m.d / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_f',
            code: 'F',
            formula: 'F/C',
            title: 'سيولة محصلة',
            subTitle: 'نسبة السيولة للعمل',
            getMain: (m) => m.f,
            getSub: (m) => m.c ? (m.f / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_h',
            code: 'H',
            formula: 'H/B',
            title: 'الأعمال القابلة للصرف',
            subTitle: 'نسبة القابل للصرف',
            getMain: (m) => m.g,
            getSub: (m) => m.b ? (m.g / m.b * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_g',
            code: 'G',
            formula: 'G/C',
            title: 'غير قابلة للصرف',
            subTitle: 'نسبة غير القابل',
            getMain: (m) => m.h,
            getSub: (m) => m.c ? (m.h / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_i',
            code: 'I',
            formula: 'I/C',
            title: 'الربحية',
            subTitle: 'نسبة الربحية',
            getMain: (m) => m.i,
            getSub: (m) => m.c ? (m.i / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_j',
            code: 'J',
            formula: 'J/C',
            title: 'الأجور',
            subTitle: 'نسبة الأجور',
            getMain: (m) => m.j,
            getSub: (m) => m.c ? (m.j / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: formatPercent
        },
        {
            key: 'kpi_ac',
            code: '',
            formula: '',
            title: 'نسبة انقضاء المدة الزمنية',
            subTitle: '',
            getMain: (m) => m.ac,
            getSub: () => null,
            formatMain: formatPercent,
            formatSub: formatPercent,
            formatProjectMain: formatPercent,
            formatProjectSub: () => '',
            hideSubRow: true,
            isSelectionOnly: true
        }
    ];

    dialog.className = 'country-drawer board-country-dialog';
    dialog.innerHTML = `
        <div class="country-board-head">
            <div>
                <div class="country-board-eyebrow">COUNTRY PORTFOLIO</div>
                <h3 class="country-board-title">
                    <span>${escapeHtml(countryName)}</span>
                    <span class="country-board-title-separator" aria-hidden="true">-</span>
                    <span class="country-board-project-count"><strong>${projects.length}</strong> مشروع</span>
                </h3>
            </div>
            <div class="country-board-head-actions">
                <div class="country-entity-toggles" role="group" aria-label="تصفية المشروعات حسب نوع الجهة">
                    ${branchPillVisible ? `
                        <button type="button" class="country-entity-toggle-btn${branchProjectsAvailable ? '' : ' is-disabled'}" data-entity-type="BRANCH" aria-pressed="${branchProjectsAvailable && activeCountryEntityTypes.has('BRANCH')}" aria-disabled="${!branchProjectsAvailable}" title="${branchProjectsAvailable ? (activeCountryEntityTypes.has('BRANCH') ? 'إخفاء مشروعات الفرع' : 'إظهار مشروعات الفرع') : 'لا توجد مشروعات بالفرع'}" ${branchProjectsAvailable ? '' : 'disabled'}>
                            <span class="country-toggle-title">فرع</span>
                            <span class="country-toggle-track"><span class="country-toggle-thumb"></span></span>
                        </button>` : ''}
                    ${companyPillVisible ? `
                        <button type="button" class="country-entity-toggle-btn${companyProjectsAvailable ? '' : ' is-disabled'}" data-entity-type="COMPANY" aria-pressed="${companyProjectsAvailable && activeCountryEntityTypes.has('COMPANY')}" aria-disabled="${!companyProjectsAvailable}" title="${companyProjectsAvailable ? (activeCountryEntityTypes.has('COMPANY') ? 'إخفاء مشروعات الشركة' : 'إظهار مشروعات الشركة') : 'لا توجد مشروعات بالشركة'}" ${companyProjectsAvailable ? '' : 'disabled'}>
                            <span class="country-toggle-title">شركة</span>
                            <span class="country-toggle-track"><span class="country-toggle-thumb"></span></span>
                        </button>` : ''}
                </div>
                <button class="drawer-close-btn" onclick="closeCountryDrawer()" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div class="country-board-grid">
            <div class="country-board-kpis" id="country-board-kpis-grid">
                ${kpisList.map(kpi => `
                    <button type="button" class="country-board-kpi" data-kpi="${kpi.key}" aria-expanded="false" aria-controls="country-kpi-projects">
                        <span class="kpi-main-head">
                            <span class="kpi-main-label">${kpi.title}</span>
                            ${kpi.code ? `<span class="kpi-card-code" dir="ltr">${kpi.code}</span>` : ''}
                        </span>
                        <strong class="kpi-main-val${kpi.isSelectionOnly ? ' is-selection-only' : ''}" id="val-${kpi.key}">${kpi.formatMain(kpi.getMain(countryTotals), true)}</strong>
                        ${kpi.hideSubRow ? `<div class="kpi-sub-ratio is-placeholder" aria-hidden="true">
                            <span class="kpi-sub-copy"><span class="kpi-sub-label">&nbsp;</span></span>
                            <span class="kpi-sub-val">&nbsp;</span>
                        </div>` : `<div class="kpi-sub-ratio">
                            <span class="kpi-sub-copy">
                                <span class="kpi-sub-label">${kpi.subTitle}</span>
                                ${kpi.formula ? `<span class="kpi-formula" dir="ltr">${kpi.formula}</span>` : ''}
                            </span>
                            <span class="kpi-sub-val" id="sub-${kpi.key}">${kpi.formatSub(kpi.getSub(countryTotals, true))}</span>
                        </div>`}
                    </button>
                `).join('')}
            </div>

            <section class="country-kpi-projects" id="country-kpi-projects" hidden aria-live="polite">
                <div class="country-kpi-projects-head">
                    <div class="country-kpi-projects-title" id="country-kpi-projects-title">مشاريع الدولة</div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="country-kpi-projects-order" id="country-kpi-projects-order"></div>
                        <button type="button" class="country-kpi-project-reset" id="country-kpi-project-reset"><i class="fa-solid fa-rotate-left"></i> عرض إجماليات الدولة</button>
                    </div>
                </div>
                <div class="country-kpi-project-list" id="country-kpi-project-list"></div>
            </section>

            <div class="country-chart-card${projects.length ? '' : ' is-empty'}">
                <div class="country-chart-title">توزيع قيمة العقود</div>
                <div class="country-chart-canvas">
                    <canvas id="country-contract-chart"></canvas>
                    <div class="country-chart-metric" id="country-contract-metric" aria-live="polite">${projects.length ? '' : 'لا توجد مشاريع ضمن عوامل التصفية'}</div>
                </div>
            </div>

            <div class="country-chart-card${projects.length ? '' : ' is-empty'}">
                <div class="country-chart-title">نسب الإنجاز الحالية</div>
                <div class="country-chart-canvas">
                    <canvas id="country-progress-chart"></canvas>
                    <div class="country-chart-metric" id="country-progress-metric" aria-live="polite">${projects.length ? '' : 'لا توجد مشاريع ضمن عوامل التصفية'}</div>
                </div>
            </div>
        </div>`;

    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('show'), 10);

    let activeKpiKey = null;
    let selectedProjectKey = null;
    const kpiPanel = document.getElementById('country-kpi-projects');
    const kpiPanelTitle = document.getElementById('country-kpi-projects-title');
    const kpiPanelOrder = document.getElementById('country-kpi-projects-order');
    const kpiProjectList = document.getElementById('country-kpi-project-list');
    const kpiResetBtn = document.getElementById('country-kpi-project-reset');
    const kpiButtons = [...dialog.querySelectorAll('.country-board-kpi')];
    dialog.querySelectorAll('.country-entity-toggle-btn').forEach(button => {
        button.addEventListener('click', () => toggleCountryEntityTypeFilter(button.dataset.entityType));
    });

    function renderKpiCardsData(focusedProject = null) {
        const m = focusedProject ? getMetrics(focusedProject) : countryTotals;
        const isAgg = !focusedProject;
        kpisList.forEach(kpi => {
            const valEl = document.getElementById(`val-${kpi.key}`);
            const subEl = document.getElementById(`sub-${kpi.key}`);
            if (valEl) valEl.textContent = kpi.formatMain(kpi.getMain(m), isAgg);
            if (subEl) subEl.textContent = kpi.formatSub(kpi.getSub(m, isAgg));
        });
    }

    const projectKey = project => project.projectId || project.projectName;

    const showKpiProjects = key => {
        const config = kpisList.find(k => k.key === key);
        if (!config || !kpiPanel || !kpiPanelTitle || !kpiPanelOrder || !kpiProjectList) return;
        const isActive = activeKpiKey === key;
        activeKpiKey = isActive ? null : key;
        kpiPanel.hidden = isActive;
        kpiButtons.forEach(button => {
            button.setAttribute('aria-expanded', String(!isActive && button.dataset.kpi === key));
            button.classList.toggle('active-kpi', !isActive && button.dataset.kpi === key);
        });
        if (isActive) return;

        const rankedProjects = [...projects].sort((p1, p2) => {
            const v1 = config.getMain(getMetrics(p1));
            const v2 = config.getMain(getMetrics(p2));
            return v2 - v1 || String(p1.projectName).localeCompare(String(p2.projectName), 'ar');
        });

        kpiPanelTitle.textContent = `مشاريع الدولة حسب: ${config.title}`;
        kpiPanelOrder.textContent = `مرتبة من الأعلى إلى الأقل قيمة`;

        kpiProjectList.innerHTML = rankedProjects.length ? rankedProjects.map(proj => {
            const pKey = projectKey(proj);
            const m = getMetrics(proj);
            const mainValue = config.getMain(m);
            const mainVal = config.formatProjectMain
                ? config.formatProjectMain(mainValue)
                : config.formatMain(mainValue, false);
            const subVal = config.formatProjectSub
                ? config.formatProjectSub(config.getSub(m, false))
                : config.formatSub(config.getSub(m, false));
            const isSelected = selectedProjectKey === pKey;
            const isDimmed = selectedProjectKey && !isSelected;

            return `<div class="country-kpi-project-item${isSelected ? ' is-selected' : ''}${isDimmed ? ' is-dimmed' : ''}" data-project-key="${escapeHtml(pKey)}">
                <span class="country-kpi-project-name">🏗️ ${escapeHtml(proj.projectName)}</span>
                <div style="display:flex;align-items:center;gap:12px;">
                    ${subVal ? `<span style="font-size:12px;color:#38bdf8;font-weight:700;">(${subVal})</span>` : ''}
                    <strong class="country-kpi-project-value" dir="ltr">${mainVal}</strong>
                </div>
            </div>`;
        }).join('') : '<div class="country-kpi-project-empty">لا توجد مشاريع ضمن عوامل التصفية الحالية</div>';

        kpiProjectList.querySelectorAll('.country-kpi-project-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const pKey = item.dataset.projectKey;
                const targetProject = projects.find(p => projectKey(p) === pKey);
                if (targetProject) selectProject(targetProject);
            });
        });

        // Position list immediately at selected project (0ms, internal container only, no page shake)
        if (selectedProjectKey) {
            const selectedEl = kpiProjectList.querySelector('.country-kpi-project-item.is-selected');
            if (selectedEl) {
                const topPos = selectedEl.offsetTop - (kpiProjectList.clientHeight / 2) + (selectedEl.clientHeight / 2);
                kpiProjectList.scrollTop = Math.max(0, topPos);
            }
        }
    };

    kpiButtons.forEach(button => button.addEventListener('click', () => showKpiProjects(button.dataset.kpi)));

    if (kpiResetBtn) {
        kpiResetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedProjectKey) {
                const proj = projects.find(p => projectKey(p) === selectedProjectKey);
                if (proj) selectProject(proj);
            }
        });
    }

    countryCharts.forEach(chart => chart.destroy());
    countryCharts = [];
    if (countryChartObserver) {
        countryChartObserver.disconnect();
        countryChartObserver = null;
    }
    if (countryChartAnimationFrame) {
        cancelAnimationFrame(countryChartAnimationFrame);
        countryChartAnimationFrame = null;
    }
    if (typeof Chart === 'undefined') return;

    const labels = projects.map(report => report.projectName);
    const colors = ['#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6'];
    const contractValues = projects.map(report => report.valueUsd || 0);
    const progressValue = value => Math.min(100, Math.max(0, Number(value) || 0));
    const projectColors = new Map(projects.map((project, index) => [projectKey(project), colors[index % colors.length]]));
    const projectColor = project => projectColors.get(projectKey(project)) || colors[0];
    const progressProjects = [...projects].sort((a, b) => progressValue(b.executionProgressPercent) - progressValue(a.executionProgressPercent));
    const progressCutout = `${Math.max(25, 90 - progressProjects.length * 7)}%`;

    let contractChart;
    let progressChart;

    const setMetric = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const selectProject = project => {
        const key = projectKey(project);
        const clearSelection = selectedProjectKey === key;
        selectedProjectKey = clearSelection ? null : key;

        // 1. Dynamic Update for all 10 KPI Cards
        renderKpiCardsData(clearSelection ? null : project);

        // 2. Dimming & Selection in Projects List
        if (kpiProjectList) {
            kpiProjectList.querySelectorAll('.country-kpi-project-item').forEach(item => {
                const itemKey = item.dataset.projectKey;
                const isSelected = !clearSelection && itemKey === key;
                const isDimmed = !clearSelection && itemKey !== key;
                item.classList.toggle('is-selected', isSelected);
                item.classList.toggle('is-dimmed', isDimmed);
            });
            if (!clearSelection && kpiPanel && !kpiPanel.hidden) {
                const selectedEl = kpiProjectList.querySelector('.country-kpi-project-item.is-selected');
                if (selectedEl) {
                    const topPos = selectedEl.offsetTop - (kpiProjectList.clientHeight / 2) + (selectedEl.clientHeight / 2);
                    kpiProjectList.scrollTop = Math.max(0, topPos);
                }
            }
        }
        if (kpiResetBtn) {
            kpiResetBtn.classList.toggle('show', !clearSelection);
        }

        // 3. Highlight in Donut & Radial Charts
        const contractIndex = projects.findIndex(item => projectKey(item) === key);
        const isLight = document.documentElement.getAttribute('data-theme') === 'aegov';
        const contractDataset = contractChart.data.datasets[0];
        contractDataset.backgroundColor = projects.map((item, index) => clearSelection || index === contractIndex ? projectColor(item) : 'rgba(148,163,184,.22)');
        contractDataset.borderColor = projects.map((_, index) => (index === contractIndex && !clearSelection ? (isLight ? '#d97706' : '#f8fafc') : 'transparent'));
        contractDataset.borderWidth = projects.map((_, index) => (index === contractIndex && !clearSelection ? 2 : 0));
        contractDataset.offset = projects.map((_, index) => !clearSelection && index === contractIndex ? 14 : 0);

        progressChart.data.datasets.forEach((dataset) => {
            if (dataset.label === '_spacer_') return;
            const proj = progressProjects.find(p => p.projectName === dataset.label);
            const isTargetProject = proj && projectKey(proj) === key;
            const selected = !clearSelection && isTargetProject;
            const unfilledBg = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)';
            const mutedUnfilledBg = isLight ? 'rgba(0,0,0,.03)' : 'rgba(148,163,184,.06)';
            dataset.backgroundColor = selected
                ? [projectColor(proj), unfilledBg]
                : clearSelection
                    ? [projectColor(proj), unfilledBg]
                    : ['rgba(148,163,184,.22)', mutedUnfilledBg];
            dataset.borderColor = selected ? (isLight ? '#d97706' : '#f8fafc') : 'transparent';
            dataset.borderWidth = selected ? 2 : 0;
        });

        setMetric('country-contract-metric', clearSelection ? '' : `قيمة التعاقد: ${formatCurrencyUSD(project.valueUsd || 0)}`);
        setMetric('country-progress-metric', clearSelection ? '' : `نسبة الإنجاز: ${progressValue(project.executionProgressPercent)}%`);
        contractChart.update();
        progressChart.update();
    };

    // Donut Chart
    contractChart = new Chart(document.getElementById('country-contract-chart'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: chartValuesWithMinimumShare(contractValues),
                backgroundColor: projects.map(projectColor),
                borderColor: 'transparent',
                borderWidth: 0,
                spacing: 0,
                hoverOffset: 6,
                offset: projects.map(() => 0)
            }]
        },
        options: {
            maintainAspectRatio: false,
            cutout: '58%',
            animation: { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutCubic' },
            onClick: (_, elements) => { if (elements[0]) selectProject(projects[elements[0].index]); },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => formatCurrencyUSD(contractValues[item.dataIndex]) } } }
        }
    });

    // Radial Rings Chart
    const buildProgressDatasets = () => {
        const datasets = [];
        const isLight = document.documentElement.getAttribute('data-theme') === 'aegov';
        const unfilledBg = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)';

        progressProjects.forEach((project, index) => {
            const progress = progressValue(project.executionProgressPercent);
            datasets.push({
                label: project.projectName,
                data: [progress, Math.max(.01, 100 - progress)],
                backgroundColor: [projectColor(project), unfilledBg],
                borderColor: 'transparent',
                borderWidth: 0,
                weight: 1.2,
                circumference: 270,
                rotation: 225
            });

            if (index < progressProjects.length - 1) {
                datasets.push({
                    label: '_spacer_',
                    data: [100],
                    backgroundColor: ['transparent'],
                    borderColor: 'transparent',
                    borderWidth: 0,
                    weight: 0.45,
                    circumference: 270,
                    rotation: 225
                });
            }
        });
        return datasets;
    };

    progressChart = new Chart(document.getElementById('country-progress-chart'), {
        type: 'doughnut',
        data: {
            labels: ['المنجز', 'المتبقي'],
            datasets: buildProgressDatasets()
        },
        options: {
            maintainAspectRatio: false,
            cutout: progressCutout,
            animation: { animateRotate: true, animateScale: true, duration: 1100, easing: 'easeOutCubic' },
            onClick: (_, elements) => {
                if (elements[0]) {
                    const ds = progressChart.data.datasets[elements[0].datasetIndex];
                    if (ds && ds.label && ds.label !== '_spacer_') {
                        const proj = progressProjects.find(p => p.projectName === ds.label);
                        if (proj) selectProject(proj);
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter: item => item.dataset.label !== '_spacer_',
                    callbacks: {
                        title: () => '',
                        label: item => {
                            const proj = progressProjects.find(p => p.projectName === item.dataset.label);
                            return `${item.dataset.label}: ${proj ? progressValue(proj.executionProgressPercent) : ''}%`;
                        }
                    }
                }
            }
        }
    });

    // Scroll-Triggered Preview / Observer for Charts
    const scrollContainer = dialog.querySelector('.country-board-grid');
    const chartTargets = [
        {
            canvasId: 'country-contract-chart',
            onScrollIn: (card) => {
                card.classList.add('is-in-view');
                contractChart.resize();
                contractChart.options.animation = { animateRotate: true, animateScale: true, duration: 1000, easing: 'easeOutCubic' };
                contractChart.reset();
                contractChart.update();
            }
        },
        {
            canvasId: 'country-progress-chart',
            onScrollIn: (card) => {
                card.classList.add('is-in-view');
                progressChart.resize();
                progressChart.options.animation = { animateRotate: true, animateScale: true, duration: 1000, easing: 'easeOutCubic' };
                progressChart.reset();
                progressChart.update();
            }
        }
    ];

    if ('IntersectionObserver' in window && scrollContainer) {
        countryChartObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.12) {
                    const target = chartTargets.find(t => {
                        const canvas = document.getElementById(t.canvasId);
                        return canvas && (canvas === entry.target || canvas.closest('.country-chart-card') === entry.target);
                    });
                    if (target) {
                        target.onScrollIn(entry.target);
                        obs.unobserve(entry.target);
                    }
                }
            });
        }, { root: scrollContainer, threshold: [0.12, 0.25] });

        chartTargets.forEach(t => {
            const canvas = document.getElementById(t.canvasId);
            const card = canvas ? canvas.closest('.country-chart-card') : null;
            if (card) countryChartObserver.observe(card);
        });
    } else {
        chartTargets.forEach(t => {
            const canvas = document.getElementById(t.canvasId);
            const card = canvas ? canvas.closest('.country-chart-card') : null;
            if (card) t.onScrollIn(card);
        });
    }

    if (initialProjectName) {
        const initProj = projects.find(p => p.projectName === initialProjectName || (p.projectId && p.projectId === initialProjectName));
        if (initProj) {
            setTimeout(() => selectProject(initProj), 80);
        }
    }

    countryCharts = [contractChart, progressChart];
}

function closeCountryDrawer(e) {
    if (e && e.target && e.target.id !== 'country-drawer-overlay') return;
    const drawerOverlay = document.getElementById('country-drawer-overlay');
    if (drawerOverlay) {
        drawerOverlay.classList.remove('show');
        setTimeout(() => drawerOverlay.classList.add('hidden'), 300);
    }
}

function switchProjModalTab(tabId, btnElement) {
    document.querySelectorAll('.proj-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.proj-tab-content').forEach(content => content.classList.remove('active'));

    if (btnElement) btnElement.classList.add('active');
    const target = document.getElementById('proj-tab-' + tabId);
    if (target) target.classList.add('active');
}

function openProjectAction(projectName, branchName, countryName) {
    const country = countryName || projectToCountryMap[projectName] || branchToCountryMap[branchName] || '';
    if (country) {
        openCountryDrawer(country, projectName);
    }
}

function openProjectDetailModal(projectName, branchName, countryName) {
    openProjectAction(projectName, branchName, countryName);
}

function closeProjectDetailModal() {
    closeEarlyWarningSidebar();
}

async function loadMapPageData() {
    try {
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.classList.remove('hidden');

        initExecutiveMap();

        const [mainTable, earlyAlertTable, registryTable] = await Promise.all([
            fetchSheetByGidJSONP(MAIN_DATA_GID, 'Main Questions'),
            fetchSheetByGidJSONP(EARLY_ALERT_GID, 'Early Alert'),
            fetchSheetByGidJSONP(MAP_REGISTRY_GID, 'Map Registry')
        ]);

        validateGvizTable(mainTable, 29, 'Main Questions');
        validateGvizTable(earlyAlertTable, 14, 'Early Alert');
        validateGvizTable(registryTable, 5, 'Map Registry');
        const entities = parseMapRegistry(registryTable);
        const registryIndex = buildMapRegistryIndex(entities);
        applyMapRegistry([...registryIndex.values()]);
        const mainReports = parseFinalMainReports(mainTable);
        const earlyAlerts = parseFinalEarlyAlerts(earlyAlertTable);
        const registeredMainReports = joinMainReportsWithRegistry(mainReports, registryIndex);
        globalRawReports = mergeEarlyAlertAnswers(registeredMainReports, earlyAlerts);
        reportsData = globalRawReports;
        reportsData.forEach(report => {
            if (!report.projectName) return;
            projectToBranchMap[report.projectName] = report.branchName || report.country || '';
            projectToCountryMap[report.projectName] = report.country || '';
        });

        rebuildCountryStatsCache();
        renderGeoJsonBoundaries();
        applyRestoredMapDisplayMode();
        renderBoardBriefing();
        renderHeaderStockTicker();
        updateHeaderKPIStats();

        if (loader) loader.classList.add('hidden');
    } catch (err) {
        console.error("Error loading performance map data:", err);
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.classList.add('hidden');
    }
}

// ==========================================
// Minimalist Smooth 5s Counters (Header)
// ==========================================
let headerCountersAnimated = false;

function animateNumberCounting(elementId, targetNumber, duration = 5000) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const target = Math.max(0, parseInt(targetNumber, 10) || 0);
    if (target === 0) {
        el.textContent = '0';
        return;
    }
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easeOutQuart curve (starts smoothly, counts steadily, slows down gracefully to finish at 5s)
        const easeOut = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(easeOut * target);

        el.textContent = current.toLocaleString('en-US');

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target.toLocaleString('en-US');
        }
    }

    requestAnimationFrame(update);
}

function updateHeaderLastDataDate() {
    const dateElements = [
        document.getElementById('header-last-update-date'),
        ...document.querySelectorAll('.header-last-update-date-ref')
    ].filter(Boolean);
    if (!dateElements.length) return;
    const latestTimestamp = (reportsData || []).reduce((latest, report) => {
        const timestamp = reportTimestamp(report);
        return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
    }, Number.NEGATIVE_INFINITY);
    if (!Number.isFinite(latestTimestamp)) {
        dateElements.forEach(el => {
            el.textContent = '--';
            el.removeAttribute('datetime');
        });
        return;
    }
    const latestDate = new Date(latestTimestamp);
    const dateText = latestDate.toLocaleDateString('en-GB');
    const year = latestDate.getFullYear();
    const month = String(latestDate.getMonth() + 1).padStart(2, '0');
    const day = String(latestDate.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;
    dateElements.forEach(el => {
        el.textContent = dateText;
        el.setAttribute('datetime', isoDate);
    });
}

function updateHeaderKPIStats() {
    updateHeaderLastDataDate();
    if (headerCountersAnimated) return;
    headerCountersAnimated = true;

    // Unique countries from branches and reports
    const uniqueCountries = new Set();
    Object.values(branchToCountryMap).forEach(c => { 
        if (c) {
            const geo = typeof findCountryGeo === 'function' ? findCountryGeo(c) : null;
            uniqueCountries.add(geo ? geo.id : c);
        }
    });
    (reportsData || []).forEach(r => { 
        if (r && r.country) {
            const geo = typeof findCountryGeo === 'function' ? findCountryGeo(r.country) : null;
            uniqueCountries.add(geo ? geo.id : r.country);
        }
    });
    const countriesCount = uniqueCountries.size;

    const branchesCount = registeredEntities.filter(entity => entity.entityType === 'BRANCH').length;

    const projectsCount = latestProjectReports().length;

    // Run slow 5-second counting animation
    animateNumberCounting('kpi-count-countries', countriesCount, 5000);
    animateNumberCounting('kpi-count-branches', branchesCount, 5000);
    animateNumberCounting('kpi-count-projects', projectsCount, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    restoreMapControlState();
    syncMapControlCenterUI();
    loadMapPageData();
});
