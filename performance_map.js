// Dedicated Interactive Performance Map Logic for Arab Contractors

const SHEET_ID = '1eRp9k1JWjvyFO8IymyEUAu7Sd6woqgu4Oe0D26xY5k4';
const MAP_DATA_SHEET = 'Dashboard Map';

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
let expectedProjects = new Set();
let expectedBranches = new Set();
let branchToCountryMap = {};
let projectToBranchMap = {};
let projectToCountryMap = {};

const MENA_AFRICA_BOUNDS = [
    [-22.0, -22.0], // South-West (below Zambia & West of Guinea / Atlantic)
    [42.0, 72.0]    // North-East (above Spain/Morocco/Levant & East of Oman/Gulf)
];

const ALLOWED_NAV_BOUNDS = [
    [-38.0, -35.0],
    [62.0, 105.0]   // Fully covers Middle East, Gulf, Asia & Indian Ocean without edge collisions
];

let currentHoveredCountryLayer = null;

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
    const switchButton = document.getElementById('map-theme-switch');
    if (switchButton) {
        const isLightTheme = theme === 'aegov';
        switchButton.setAttribute('aria-pressed', String(isLightTheme));
        const icon = switchButton.querySelector('.tw-theme-thumb');
        if (icon) icon.className = `tw-theme-thumb fa-solid ${isLightTheme ? 'fa-sun' : 'fa-moon'}`;
    }
    if (currentTileLayer && executiveMap && currentTileStyle !== 'satellite') currentTileLayer.setUrl(getMapBaseTileUrl());
}

function toggleMapTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'corporate';
    setMapTheme(currentTheme === 'aegov' ? 'corporate' : 'aegov');
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
    if (geoA && geoB && geoA.id === geoB.id) return true;
    const normalize = value => String(value).toLowerCase().replace(/[\s\-_،,]/g, '');
    const normalizedA = normalize(a);
    const normalizedB = normalize(b);
    return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}

function fetchSheetJSONP(sheetName) {
    return new Promise((resolve, reject) => {
        const callbackName = 'gvizCallback_map_' + Math.random().toString(36).substring(2, 10);
        const script = document.createElement('script');
        const encodedSheet = encodeURIComponent(sheetName);
        script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodedSheet}&_nocache=${Date.now()}`;
        
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout loading sheet: ${sheetName}`));
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
                reject(new Error(`Invalid response for sheet: ${sheetName}`));
            }
        };

        script.onerror = function() {
            cleanup();
            reject(new Error(`Network error loading sheet: ${sheetName}`));
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

function parseDashboardMapReports(table) {
    if (!table || !table.cols || !table.rows) return [];

    const indexOf = (...terms) => table.cols.findIndex(col => {
        const label = String(col.label || '').trim();
        return terms.some(term => label.includes(term));
    });
    const i = {
        projectId: indexOf('PROJECT ID'),
        date: indexOf('تاريخ تحديث البيان'),
        projectName: indexOf('اسم المشروع'),
        scope: indexOf('مجال العمل'),
        client: indexOf('اسم العميل'),
        consultant: indexOf('اسم الاستشار'),
        mapsLink: indexOf('GOOGLE MAP'),
        currency: indexOf('اسم العملة فى العقد'),
        exchangeRate: indexOf('سعر صرف الدولار'),
        contractValue: indexOf('القيمة التعاقدية للمشروع'),
        revisedValue: indexOf('القيمة المعدلة للمشروع'),
        advancePayment: indexOf('الدفعة المقدمة'),
        executedApproved: indexOf('حجم الاعمال المنفذة من بداية'),
        approvedMaterials: indexOf('قيمة التشوينات المدرجة'),
        executedTotal: indexOf('حجم الاعمال المنفذه شامل'),
        paidWork: indexOf('حجم الاعمال المسدده'),
        dueDebt: indexOf('مديونية لم تسدد بعد'),
        uncollectibleWork: indexOf('غير القابلة للصرف'),
        collectedLiquidity: indexOf('اجمالى السيولة المحصله'),
        progress: indexOf('نسبة الانجاز المخططة'),
        profitLoss: indexOf('قيمة الربح او الخسارة'),
        claimsStatus: indexOf('موقف المطالبات'),
        claimsValue: indexOf('حجم المطالبات'),
        retainedLiquidity: indexOf('السيولة النقدية المحجوزة'),
        lettersOfGuarantee: indexOf('خطابات الضمان الاجمالية'),
        contractStart: indexOf('تاريخ بدء المشروع'),
        contractEnd: indexOf('تاريخ نهو المشروع التعاقدى'),
        extensionRequested: indexOf('هل يوجد مد مده'),
        revisedEnd: indexOf('تاريخ نهو المشروع المعدل'),
        expectedFinish: indexOf('تاريخ نهو المشروع المتوقع'),
        subcontractorsDue: indexOf('مستحقات مقاولى الباطن'),
        obstacles: indexOf('معوقات المشروع'),
        financialApprovalDays: indexOf('لم يتم اعتماد مالى'),
        collectionDays: indexOf('لم يتم صرف مستخلصات'),
        wagesCost: indexOf('أجور', 'اجور', 'تكلفة اجور', 'تكلفة أجور', 'العمالة', 'رواتب'),
        country: (indexOf('الدولة', 'country', 'Country') !== -1) ? indexOf('الدولة', 'country', 'Country') : 53
    };

    const value = (row, idx) => idx < 0 || !row.c[idx] ? null : row.c[idx].v;
    const formatted = (row, idx) => idx < 0 || !row.c[idx] ? '' : (row.c[idx].f || String(row.c[idx].v || ''));
    const number = (row, idx) => Number(value(row, idx)) || 0;
    const date = (row, idx) => {
        const parsed = robustParseDate(value(row, idx), formatted(row, idx));
        return parsed && !isNaN(parsed) ? parsed : null;
    };
    const dateText = (row, idx) => {
        const parsed = date(row, idx);
        return parsed ? parsed.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
    };

    return table.rows.map(row => {
        if (!row || !row.c) return null;
        const rate = number(row, i.exchangeRate) || 1;
        const reportDate = date(row, i.date);
        const projectName = String(value(row, i.projectName) || '').trim();
        if (!projectName) return null;
        return {
            timestamp: reportDate ? reportDate.toISOString() : '',
            reportDate,
            projectId: String(value(row, i.projectId) || '').trim(),
            projectName,
            country: String(value(row, i.country) || '').trim(),
            branchName: String(value(row, i.country) || '').trim(),
            clientName: value(row, i.client) || '', consultantName: value(row, i.consultant) || '',
            scopeOfWork: value(row, i.scope) || '', mapsLink: value(row, i.mapsLink) || '',
            currency: value(row, i.currency) || '', exchangeRate: rate,
            contractValue: number(row, i.contractValue), revisedContractValue: number(row, i.revisedValue),
            valueUsd: (number(row, i.revisedValue) || number(row, i.contractValue)) / rate,
            advancePayment: number(row, i.advancePayment), executedWorkApproved: number(row, i.executedApproved),
            approvedMaterials: number(row, i.approvedMaterials), executedWorkTotal: number(row, i.executedTotal),
            paidWork: number(row, i.paidWork), dueDebt: number(row, i.dueDebt),
            uncollectibleWork: number(row, i.uncollectibleWork), collectedLiquidity: number(row, i.collectedLiquidity),
            plannedProgressPercent: number(row, i.progress), profitLoss: number(row, i.profitLoss),
            claimsStatus: value(row, i.claimsStatus) || 'لا يوجد', claimsValue: number(row, i.claimsValue),
            retainedLiquidity: number(row, i.retainedLiquidity), lettersOfGuaranteeValue: number(row, i.lettersOfGuarantee),
            subcontractorsDue: number(row, i.subcontractorsDue), wagesCost: number(row, i.wagesCost),
            projectObstacles: value(row, i.obstacles) || 'لا توجد معوقات مسجلة',
            contractStartDate: dateText(row, i.contractStart), contractEndDate: dateText(row, i.contractEnd),
            revisedEndDate: dateText(row, i.revisedEnd), expectedFinishDate: dateText(row, i.expectedFinish),
            rawStartDate: date(row, i.contractStart),
            rawEndDate: date(row, i.revisedEnd) || date(row, i.contractEnd) || date(row, i.expectedFinish),
            extensionRequested: value(row, i.extensionRequested) || 'لا', measurementDate: dateText(row, i.date),
            financialApprovalDays: number(row, i.financialApprovalDays), collectionDays: number(row, i.collectionDays),
            hasBillOfQuantities: value(row, indexOf('هل يوجد مقايسة', 'مقايسة للمشروع', 'وجود مقايسة')) || '',
            boqAccuracy: value(row, indexOf('دقة مقايسة', 'دقة المقايسة')) || '',
            lgIssued: value(row, indexOf('خطاب ضمان الدفعة', 'خطابات ضمان', 'وثيقة التأمين')) || '',
            advanceDisbursed: value(row, indexOf('صرف الدفعة المقدمة', 'صرف الدفعه')) || '',
            meetingClient15Days: value(row, indexOf('الاجتماع مع العميل', '15 يوم', 'خلال 15')) || '',
            formalLetterSent: value(row, indexOf('خطاب رسمي', 'خطاب رسمى', 'عدم القدرة علي البدء', 'رئيس الهيئة')) || '',
            supplySchedulePrepared: value(row, indexOf('برنامج توريدات', 'توريدات (خامات', 'اعداد برنامج توريدات')) || '',
            mepApproved: value(row, indexOf('مهام الكهروميكانيك', 'الكهروميكانيك', 'كهروميكانيك')) || '',
            scheduleStatus: value(row, indexOf('الموقف التنفيذى', 'موقف تاريخ نهاية', 'الموقف التنفيذي')) || '',
            extensionResubmitted: value(row, indexOf('تقديم مد مدة للعميل (مجددا)', 'مجدداً', 'مجددا')) || '',
            extensionClaimDate: dateText(row, indexOf('تاريخ المطالبة بمد المدة', 'تاريخ المطالبة')),
            extensionPeriodSubmitted: value(row, indexOf('المدة الاضافية المقدمة', 'المدة الإضافية', 'المدة الاضافية')) || '',
            extensionApprovalStatus: value(row, indexOf('موقف اعتماد العميل للمدة', 'موقف اعتماد العميل')) || '',
            isProjectReport: true
        };
    }).filter(Boolean);
}

function parseGvizReports(table) {
    if (!table || !table.cols || !table.rows || table.rows.length === 0) return [];
    
    const cols = table.cols;
    const firstRowCells = table.rows[0].c;
    const firstRowValues = firstRowCells ? firstRowCells.map(cell => cell ? String(cell.v).toLowerCase().trim() : '') : [];
    const isFirstRowHeader = firstRowValues.includes('timestamp') && firstRowValues.includes('branch id');
    
    const getIndex = (key) => {
        const k = key.toLowerCase().trim();
        if (isFirstRowHeader) return firstRowValues.indexOf(k);
        return cols.findIndex(col => {
            const label = col.label.toLowerCase().trim();
            if (label === k) return true;
            if (label.includes(k)) {
                const idx = label.indexOf(k);
                const before = idx > 0 ? label[idx - 1] : ' ';
                const after = idx + k.length < label.length ? label[idx + k.length] : ' ';
                const isBoundary = (char) => /[\s\(\)\[\]_.,-]/.test(char);
                return isBoundary(before) && isBoundary(after);
            }
            return false;
        });
    };
    
    const tsIndex = getIndex('timestamp');
    const branchIdIdx = getIndex('branch id');
    const projIdIdx = getIndex('project id');
    const userstampIdx = getIndex('userstamp');
    const countryIdx = getIndex('q1win1');
    const branchNameIdx = getIndex('q2win1');
    const projNameIdx = getIndex('q1');
    const dateIdx = getIndex('q2');
    const clientIdx = getIndex('q3');
    const consultantIdx = getIndex('q4');
    const scopeIdx = getIndex('q5');
    const contractTypeIdx = getIndex('q6');
    const fundingSourceIdx = getIndex('q7');
    const mapsLinkIdx = getIndex('q8');
    
    const contractStartDateIdx = getIndex('q9');
    const siteHandoverDateIdx = getIndex('q10');
    const drawingsDateIdx = getIndex('q11');
    const contractEndDateIdx = getIndex('q12');
    const revisedEndDateIdx = getIndex('q13');
    
    const valIdx = getIndex('q14');
    const revisedContractValIdx = getIndex('q15');
    const curIdx = getIndex('q16');
    const exchangeRateIdx = getIndex('q17');
    const valUsdIdx = getIndex('q18');
    
    const advancePaymentIdx = getIndex('q19');
    const executedWorkApprovedIdx = getIndex('q20');
    const approvedMaterialsIdx = getIndex('q21');
    const executedWorkTotalIdx = getIndex('q22');
    const totalMaterialsIdx = getIndex('q23');
    const plannedProgressIdx = getIndex('q24');
    const paidWorkIdx = getIndex('q25');
    const dueDebtIdx = getIndex('q26');
    const uncollectibleWorkIdx = getIndex('q27');
    const collectedLiquidityIdx = getIndex('q28');
    const lastInvoiceApprovalDateIdx = getIndex('q29');
    const lastCollectionDateIdx = getIndex('q30');
    const laborCostIdx = getIndex('q31');
    const profitLossIdx = getIndex('q32');
    const claimsStatusIdx = getIndex('q33');
    const claimsValueIdx = getIndex('q34');
    const retainedLiquidityIdx = getIndex('q35');
    const lettersOfGuaranteeIdx = getIndex('q36');
    const expectedFinishDateIdx = getIndex('q37');
    const scheduleStatusIdx = getIndex('q38');
    const extensionRequestedIdx = getIndex('q39');
    const extensionReasonNoClaimIdx = getIndex('q40');
    const extensionClaimDateIdx = getIndex('q41');
    const extensionPeriodIdx = getIndex('q42');
    const extensionApprovalStatusIdx = getIndex('q43');
    const extensionApprovedPeriodIdx = getIndex('q45');
    const revisedEndDateUnderApprovalIdx = getIndex('q46');
    
    const subcontractorsDueIdx = getIndex('q57');
    const openLGTotalIdx = getIndex('q59');
    const projectObstaclesIdx = getIndex('q66');
    
    const results = [];
    const startIndex = isFirstRowHeader ? 1 : 0;
    
    table.rows.slice(startIndex).forEach(row => {
        if (!row || !row.c) return;
        
        const cellVal = (idx) => (idx === -1 || idx === undefined || idx >= row.c.length) ? null : (row.c[idx] ? row.c[idx].v : null);
        const cellFmt = (idx) => (idx === -1 || idx === undefined || idx >= row.c.length) ? '' : (row.c[idx] ? (row.c[idx].f || String(row.c[idx].v || '')) : '');
        
        const tsVal = cellVal(tsIndex);
        if (tsVal && String(tsVal).trim().toLowerCase() === 'timestamp') return;
        
        const pId = cellVal(projIdIdx) ? String(cellVal(projIdIdx)).trim() : '';
        const pName = cellVal(projNameIdx) ? String(cellVal(projNameIdx)).trim() : '';
        
        const formatNum = (idx) => {
            const raw = cellVal(idx);
            if (raw === null || raw === undefined || raw === '') return 0;
            const n = parseFloat(String(raw).replace(/,/g, ''));
            return isNaN(n) ? 0 : n;
        };

        const formatDate = (idx) => {
            const rawVal = cellVal(idx);
            const fmtVal = cellFmt(idx);
            if (!rawVal && !fmtVal) return '-';
            const parsed = robustParseDate(rawVal, fmtVal);
            if (parsed && !isNaN(parsed.getTime())) {
                return parsed.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            }
            return fmtVal || String(rawVal);
        };
        
        results.push({
            timestamp: cellVal(tsIndex) || '',
            branchId: cellVal(branchIdIdx) || '',
            projectId: pId,
            userstamp: cellVal(userstampIdx) || '',
            country: cellVal(countryIdx) || '',
            branchName: cellVal(branchNameIdx) || '',
            projectName: pName,
            measurementDate: formatDate(dateIdx),
            clientName: cellVal(clientIdx) || '',
            consultantName: cellVal(consultantIdx) || '',
            scopeOfWork: cellVal(scopeIdx) || '',
            contractType: cellVal(contractTypeIdx) || '',
            fundingSource: cellVal(fundingSourceIdx) || '',
            mapsLink: cellVal(mapsLinkIdx) || '',
            
            contractStartDate: formatDate(contractStartDateIdx),
            siteHandoverDate: formatDate(siteHandoverDateIdx),
            drawingsDate: formatDate(drawingsDateIdx),
            contractEndDate: formatDate(contractEndDateIdx),
            revisedEndDate: formatDate(revisedEndDateIdx),
            
            contractValue: formatNum(valIdx),
            revisedContractValue: formatNum(revisedContractValIdx),
            currency: cellVal(curIdx) || '',
            exchangeRate: formatNum(exchangeRateIdx),
            valueUsd: formatNum(valUsdIdx),
            
            advancePayment: formatNum(advancePaymentIdx),
            executedWorkApproved: formatNum(executedWorkApprovedIdx),
            approvedMaterials: formatNum(approvedMaterialsIdx),
            executedWorkTotal: formatNum(executedWorkTotalIdx),
            totalMaterials: formatNum(totalMaterialsIdx),
            plannedProgressPercent: formatNum(plannedProgressIdx),
            paidWork: formatNum(paidWorkIdx),
            dueDebt: formatNum(dueDebtIdx),
            uncollectibleWork: formatNum(uncollectibleWorkIdx),
            collectedLiquidity: formatNum(collectedLiquidityIdx),
            lastInvoiceApprovalDate: formatDate(lastInvoiceApprovalDateIdx),
            lastCollectionDate: formatDate(lastCollectionDateIdx),
            laborCost: formatNum(laborCostIdx),
            profitLoss: formatNum(profitLossIdx),
            claimsStatus: cellVal(claimsStatusIdx) || 'لا يوجد',
            claimsValue: formatNum(claimsValueIdx),
            retainedLiquidity: formatNum(retainedLiquidityIdx),
            lettersOfGuaranteeValue: formatNum(lettersOfGuaranteeIdx),
            expectedFinishDate: formatDate(expectedFinishDateIdx),
            scheduleStatus: cellVal(scheduleStatusIdx) || 'داخل المدة',
            extensionRequested: cellVal(extensionRequestedIdx) || 'لا',
            extensionPeriod: cellVal(extensionPeriodIdx) || '-',
            extensionApprovedPeriod: cellVal(extensionApprovedPeriodIdx) || '-',
            revisedEndDateUnderApproval: formatDate(revisedEndDateUnderApprovalIdx),
            
            subcontractorsDue: formatNum(subcontractorsDueIdx),
            openLGTotal: formatNum(openLGTotalIdx),
            projectObstacles: cellVal(projectObstaclesIdx) || 'لا توجد معوقات مسجلة',
            
            isProjectReport: !!(pId || pName)
        });
    });
    
    return results;
}

function parseDropdownRegistry(table) {
    if (!table || !table.cols || !table.rows) return;
    
    expectedProjects.clear();
    expectedBranches.clear();
    branchToCountryMap = {};
    projectToBranchMap = {};
    projectToCountryMap = {};

    table.rows.forEach(row => {
        if (!row || !row.c) return;
        const cell = (idx) => (idx < row.c.length && row.c[idx] && row.c[idx].v) ? String(row.c[idx].v).trim() : '';
        
        const cBranch = cell(2) || cell(0);
        const b = cell(3);
        const bProj = cell(5);
        const p = cell(6);

        if (b) {
            expectedBranches.add(b);
            if (cBranch) branchToCountryMap[b] = cBranch;
        }
        if (p) {
            expectedProjects.add(p);
            if (bProj) {
                projectToBranchMap[p] = bProj;
            }
        }
    });

    for (const proj of expectedProjects) {
        const bName = projectToBranchMap[proj];
        if (bName && branchToCountryMap[bName]) {
            projectToCountryMap[proj] = branchToCountryMap[bName];
        }
    }
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

function reportUsd(report, field) {
    return (Number(report[field]) || 0) / (Number(report.exchangeRate) || 1);
}

function latestProjectReports() {
    const latest = new Map();
    reportsData.forEach(report => {
        const key = report.projectId || report.projectName;
        if (!key) return;
        const existing = latest.get(key);
        if (!existing || (report.reportDate && (!existing.reportDate || report.reportDate > existing.reportDate))) latest.set(key, report);
    });
    return [...latest.values()];
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
                spacing: 4,
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

function getShortProjectName(fullName) {
    if (!fullName) return '';
    let name = String(fullName).trim();
    name = name.replace(/^(مشروع|عملية|مشروعات|تنفيذ|إنشاء|انشاء)\s+/i, '').trim();
    if (name.length > 24) {
        return name.substring(0, 22) + '...';
    }
    return name;
}

function renderHeaderStockTicker() {
    const track = document.getElementById('stock-ticker-track');
    if (!track) return;

    const projectMap = new Map();

    // Group all reports by project name
    (reportsData || []).forEach(r => {
        if (!r || !r.projectName) return;
        if (!projectMap.has(r.projectName)) projectMap.set(r.projectName, []);
        projectMap.get(r.projectName).push(r);
    });

    // Also include projects from expectedProjects if missing in reportsData
    (expectedProjects || new Set()).forEach(pName => {
        if (!projectMap.has(pName)) {
            const country = projectToCountryMap[pName] || '';
            projectMap.set(pName, [{ projectName: pName, country, plannedProgressPercent: 0, profitLoss: 0 }]);
        }
    });

    const projectList = [];
    projectMap.forEach((repList, pName) => {
        // Sort reports descending by date/timestamp
        repList.sort((a, b) => new Date(b.timestamp || b.reportDate || 0) - new Date(a.timestamp || a.reportDate || 0));
        const latest = repList[0];
        const previous = repList.length > 1 ? repList[1] : null;
        const country = latest.country || projectToCountryMap[pName] || (latest.branchName && branchToCountryMap[latest.branchName]) || 'GLOBAL';

        const latestPl = reportUsd(latest, 'profitLoss');
        const prevPl = previous ? reportUsd(previous, 'profitLoss') : null;
        const latestProg = Number(latest.plannedProgressPercent) || 0;
        const prevProg = previous ? (Number(previous.plannedProgressPercent) || 0) : null;

        // Profit MoM Delta (%)
        let plDeltaPercent = 0;
        if (prevPl !== null && Math.abs(prevPl) > 0) {
            plDeltaPercent = ((latestPl - prevPl) / Math.abs(prevPl)) * 100;
        } else if (prevPl !== null && prevPl === 0) {
            plDeltaPercent = latestPl !== 0 ? (latestPl > 0 ? 100 : -100) : 0;
        }

        // Progress MoM Delta (% points)
        let progDelta = 0;
        if (prevProg !== null) {
            progDelta = latestProg - prevProg;
        }

        projectList.push({
            projectName: pName,
            country,
            latestPl,
            plDeltaPercent,
            latestProg,
            progDelta,
            report: latest
        });
    });

    if (projectList.length === 0) {
        track.innerHTML = '<span style="color:#94a3b8; font-size:11px; padding:0 12px;">جاري تحميل مؤشرات المشروعات...</span>';
        return;
    }

    const generateItemHtml = (p) => {
        const absPl = Math.abs(p.latestPl);
        const plFormatted = formatCurrencyUSD(absPl);
        const plSign = p.latestPl > 0 ? '+' : (p.latestPl < 0 ? '-' : '');
        const plClass = p.latestPl > 0 ? 'profit' : (p.latestPl < 0 ? 'loss' : 'neutral');

        let plDeltaTag = '';
        if (p.plDeltaPercent > 0) {
            plDeltaTag = `<span class="ticker-delta-val up"><bdi dir="ltr">(▲ +${p.plDeltaPercent.toFixed(1)}%)</bdi></span>`;
        } else if (p.plDeltaPercent < 0) {
            plDeltaTag = `<span class="ticker-delta-val down"><bdi dir="ltr">(▼ ${Math.abs(p.plDeltaPercent).toFixed(1)}%)</bdi></span>`;
        } else {
            plDeltaTag = `<span class="ticker-delta-val neutral"><bdi dir="ltr">(0.0%)</bdi></span>`;
        }

        let progDeltaTag = '';
        if (p.progDelta > 0) {
            progDeltaTag = `<span class="ticker-delta-val up"><bdi dir="ltr">(▲ +${p.progDelta.toFixed(1)}%)</bdi></span>`;
        } else if (p.progDelta < 0) {
            progDeltaTag = `<span class="ticker-delta-val down"><bdi dir="ltr">(▼ ${Math.abs(p.progDelta).toFixed(1)}%)</bdi></span>`;
        } else {
            progDeltaTag = `<span class="ticker-delta-val neutral"><bdi dir="ltr">(0.0%)</bdi></span>`;
        }

        const shortName = getShortProjectName(p.projectName);

        return `
            <div class="stock-ticker-item" onclick="openProjectFromTicker('${escapeHtml(p.projectName)}', '${escapeHtml(p.country)}')" title="${escapeHtml(p.projectName)} (${escapeHtml(p.country)}) - اضغط لعرض التقرير">
                <div class="ticker-row-title">
                    <span class="ticker-proj-title">${escapeHtml(shortName)}</span>
                </div>
                <div class="ticker-row-metric">
                    <span class="ticker-metric-label">الربحية :</span>
                    <span class="ticker-metric-val ${plClass}"><bdi dir="ltr">${plSign}${plFormatted}</bdi></span>
                    ${plDeltaTag}
                </div>
                <div class="ticker-row-metric">
                    <span class="ticker-metric-label">إنجاز :</span>
                    <span class="ticker-metric-val prog"><bdi dir="ltr">${p.latestProg}%</bdi></span>
                    ${progDeltaTag}
                </div>
            </div>
            <span class="stock-ticker-separator">•</span>
        `;
    };

    const itemsHtml = projectList.map(generateItemHtml).join('');
    // Duplicate twice to achieve seamless infinite scroll
    track.innerHTML = itemsHtml + itemsHtml;

    // Initialize Wheel & Drag & RAF Auto-scroll Engine
    initStockTickerScroll();
}

let tickerScrollPos = 0;
let tickerTargetPos = 0;
let tickerAutoSpeed = 0.40; // Calm, continuous drift
let tickerRafId = null;

function initStockTickerScroll() {
    const container = document.getElementById('header-stock-ticker');
    if (!container) return;

    tickerScrollPos = container.scrollLeft || 0;
    tickerTargetPos = container.scrollLeft || 0;

    let isHovered = false;

    container.onmouseenter = () => { isHovered = true; };
    container.onmouseleave = () => { isHovered = false; };

    // Mouse Wheel Boost with momentum (Smooth acceleration)
    container.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        tickerTargetPos += delta * 1.85;
    };

    // Smooth Drag / Swipe support
    let isDragging = false;
    let startX = 0;
    let dragStartPos = 0;

    container.onmousedown = (e) => {
        isDragging = true;
        startX = e.pageX;
        dragStartPos = tickerTargetPos;
    };

    window.addEventListener('mouseup', () => { isDragging = false; });

    container.onmousemove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const diff = (e.pageX - startX) * 1.8;
        tickerTargetPos = dragStartPos - diff;
    };

    if (tickerRafId) cancelAnimationFrame(tickerRafId);

    function loop() {
        // Continuous auto-drift runs when not hovered and not dragging
        if (!isDragging && !isHovered) {
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

function openProjectFromTicker(projectName, countryName) {
    if (!projectName) return;
    openCountryDrawer(countryName || 'all', projectName);
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
        zoomControl: true,
        attributionControl: false
    });

    if (executiveMap.zoomControl) {
        executiveMap.zoomControl.setPosition('topleft');
    }

    executiveMap.fitBounds(MENA_AFRICA_BOUNDS, { padding: [10, 10] });

    currentTileLayer = L.tileLayer(getMapBaseTileUrl(), {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(executiveMap);

    markersGroup = L.layerGroup().addTo(executiveMap);
    businessBubblesGroup = L.layerGroup().addTo(executiveMap);
    arabicMapLabelsGroup = L.layerGroup().addTo(executiveMap);

    executiveMap.on('mouseout', () => {
        if (currentHoveredCountryLayer && geoJsonLayer) {
            geoJsonLayer.resetStyle(currentHoveredCountryLayer);
            currentHoveredCountryLayer = null;
        }
    });

    if (typeof MENA_GEOJSON !== 'undefined' && MENA_GEOJSON) {
        menaGeoJsonData = MENA_GEOJSON;
        renderGeoJsonBoundaries();
    }

    renderArabicMapLabels();

    setTimeout(() => {
        if (executiveMap) {
            executiveMap.invalidateSize();
            executiveMap.fitBounds(MENA_AFRICA_BOUNDS, { padding: [10, 10] });
        }
    }, 400);
}

const ARABIC_GEOGRAPHY = {
    countries: [
        { name: 'جمهورية مصر العربية', lat: 26.8206, lng: 30.8025 },
        { name: 'المملكة العربية السعودية', lat: 23.8859, lng: 45.0792 },
        { name: 'الإمارات', lat: 23.4241, lng: 53.8478 },
        { name: 'سلطنة عُمان', lat: 21.4735, lng: 55.9754 },
        { name: 'دولة الكويت', lat: 29.3117, lng: 47.4818 },
        { name: 'دولة قطر', lat: 25.3548, lng: 51.1839 },
        { name: 'مملكة البحرين', lat: 26.0667, lng: 50.5577 },
        { name: 'العراق', lat: 33.2232, lng: 43.6793 },
        { name: 'الأردن', lat: 30.5852, lng: 36.2384 },
        { name: 'سوريا', lat: 34.8021, lng: 38.9968 },
        { name: 'لبنان', lat: 33.8547, lng: 35.8623 },
        { name: 'فلسطين', lat: 31.9522, lng: 35.2332 },
        { name: 'اليمن', lat: 15.5527, lng: 48.5164 },
        { name: 'ليبيا', lat: 26.3351, lng: 17.2283 },
        { name: 'تونس', lat: 33.8869, lng: 9.5375 },
        { name: 'الجزائر', lat: 28.0339, lng: 1.6596 },
        { name: 'المملكة المغربية', lat: 31.7917, lng: -7.0926 },
        { name: 'موريتانيا', lat: 21.0079, lng: -10.9408 },
        { name: 'السودان', lat: 14.8628, lng: 30.2176 },
        { name: 'جنوب السودان', lat: 6.8770, lng: 31.3070 },
        { name: 'تشاد', lat: 15.4542, lng: 18.7322 },
        { name: 'النيجر', lat: 17.6078, lng: 8.0817 },
        { name: 'مالي', lat: 17.5707, lng: -3.9962 },
        { name: 'نيجيريا', lat: 9.0820, lng: 8.6753 },
        { name: 'الكاميرون', lat: 6.0000, lng: 12.3547 },
        { name: 'غينيا الاستوائية', lat: 1.6508, lng: 10.2679 },
        { name: 'الغابون', lat: -0.8037, lng: 11.6094 },
        { name: 'الكونغو', lat: -0.2280, lng: 15.8277 },
        { name: 'الكونغو الديمقراطية', lat: -4.0383, lng: 21.7587 },
        { name: 'أوغندا', lat: 1.3733, lng: 32.2903 },
        { name: 'كينيا', lat: -0.0236, lng: 37.9062 },
        { name: 'تنزانيا', lat: -6.3690, lng: 34.8888 },
        { name: 'زامبيا', lat: -13.1339, lng: 27.8493 },
        { name: 'أنغولا', lat: -11.2027, lng: 17.8739 },
        { name: 'غانا', lat: 7.9465, lng: -1.0232 },
        { name: 'كوت ديفوار', lat: 7.5400, lng: -5.5471 },
        { name: 'بنين', lat: 9.3077, lng: 2.3158 },
        { name: 'توغو', lat: 8.6195, lng: 0.8248 },
        { name: 'إثيوبيا', lat: 9.1450, lng: 40.4897 },
        { name: 'الصومال', lat: 5.1521, lng: 46.1996 },
        { name: 'جزر القمر', lat: -11.8753, lng: 43.8722 }
    ],
    waters: [
        { name: 'البحر الأبيض المتوسط', lat: 34.2, lng: 19.5 },
        { name: 'البحر الأحمر', lat: 21.5, lng: 38.0 },
        { name: 'الخليج العربي', lat: 26.5, lng: 52.0 },
        { name: 'بحر العرب', lat: 15.5, lng: 63.5 }
    ],
    cities: [
        { name: 'القاهرة', lat: 30.0444, lng: 31.2357 },
        { name: 'الرياض', lat: 24.7136, lng: 46.6753 },
        { name: 'جدة', lat: 21.4858, lng: 39.1925 },
        { name: 'أبوظبي', lat: 24.4539, lng: 54.3773 },
        { name: 'دبي', lat: 25.2048, lng: 55.2708 },
        { name: 'مسقط', lat: 23.5880, lng: 58.3829 },
        { name: 'الدوحة', lat: 25.2854, lng: 51.5310 },
        { name: 'مدينة الكويت', lat: 29.3759, lng: 47.9774 },
        { name: 'بغداد', lat: 33.3152, lng: 44.3661 },
        { name: 'أبوجا', lat: 9.0765, lng: 7.3986 },
        { name: 'لاغوس', lat: 6.5244, lng: 3.3792 },
        { name: 'كمبالا', lat: 0.3476, lng: 32.5825 },
        { name: 'انجمينا', lat: 12.1348, lng: 15.0557 },
        { name: 'ياوندي', lat: 3.8480, lng: 11.5021 },
        { name: 'أكرا', lat: 5.6037, lng: -0.1870 },
        { name: 'أبيدجان', lat: 5.3600, lng: -4.0083 },
        { name: 'لوساكا', lat: -15.3875, lng: 28.3228 },
        { name: 'دار السلام', lat: -6.7924, lng: 39.2083 },
        { name: 'الخرطوم', lat: 15.5007, lng: 32.5599 },
        { name: 'الجزائر', lat: 36.7538, lng: 3.0588 },
        { name: 'تونس', lat: 36.8065, lng: 10.1815 },
        { name: 'الرباط', lat: 34.0209, lng: -6.8416 }
    ]
};

function renderArabicMapLabels() {
    if (!executiveMap) return;
    if (!arabicMapLabelsGroup) {
        arabicMapLabelsGroup = L.layerGroup().addTo(executiveMap);
    }
    arabicMapLabelsGroup.clearLayers();

    // 1. Waters
    ARABIC_GEOGRAPHY.waters.forEach(w => {
        const icon = L.divIcon({
            html: `<span class="map-label-water">${escapeHtml(w.name)}</span>`,
            className: 'arabic-map-label',
            iconSize: [160, 20],
            iconAnchor: [80, 10]
        });
        arabicMapLabelsGroup.addLayer(L.marker([w.lat, w.lng], { icon, interactive: false }));
    });

    // 2. Countries
    ARABIC_GEOGRAPHY.countries.forEach(c => {
        const icon = L.divIcon({
            html: `<span class="map-label-country">${escapeHtml(c.name)}</span>`,
            className: 'arabic-map-label',
            iconSize: [160, 20],
            iconAnchor: [80, 10]
        });
        arabicMapLabelsGroup.addLayer(L.marker([c.lat, c.lng], { icon, interactive: false }));
    });

    // 3. Cities
    ARABIC_GEOGRAPHY.cities.forEach(city => {
        const icon = L.divIcon({
            html: `<span class="map-label-city"><span class="map-city-bullet"></span>${escapeHtml(city.name)}</span>`,
            className: 'arabic-map-label',
            iconSize: [100, 18],
            iconAnchor: [3, 9]
        });
        arabicMapLabelsGroup.addLayer(L.marker([city.lat, city.lng], { icon, interactive: false }));
    });
}

const precomputedCountryStats = new Map();
const precomputedEarlyWarningStats = new Map();

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
    (reportsData || []).forEach(r => {
        if (!r || !r.country) return;
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(r.country) : null;
        const canKey = geo ? geo.id : String(r.country).trim();

        if (!countryReports.has(canKey)) countryReports.set(canKey, []);
        countryReports.get(canKey).push(r);

        if (r.projectName) {
            if (!countryProjects.has(canKey)) countryProjects.set(canKey, new Set());
            countryProjects.get(canKey).add(r.projectName);
        }
    });

    // 2. Index expectedProjects
    (expectedProjects || new Set()).forEach(proj => {
        const pCountry = projectToCountryMap[proj] || (projectToBranchMap[proj] && branchToCountryMap[projectToBranchMap[proj]]) || '';
        if (!pCountry) return;
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(pCountry) : null;
        const canKey = geo ? geo.id : String(pCountry).trim();

        if (!countryProjects.has(canKey)) countryProjects.set(canKey, new Set());
        countryProjects.get(canKey).add(proj);
    });

    // 3. Index expectedBranches
    (expectedBranches || new Set()).forEach(b => {
        const bCountry = branchToCountryMap[b] || '';
        if (!bCountry) return;
        const geo = typeof findCountryGeo === 'function' ? findCountryGeo(bCountry) : null;
        const canKey = geo ? geo.id : String(bCountry).trim();

        if (!countryBranches.has(canKey)) countryBranches.set(canKey, new Set());
        countryBranches.get(canKey).add(b);
    });

    precomputedEarlyWarningStats.clear();

    // Populate all canonical keys
    const allCanKeys = new Set([...countryReports.keys(), ...countryProjects.keys(), ...countryBranches.keys()]);
    allCanKeys.forEach(canKey => {
        const pSet = countryProjects.get(canKey) || new Set();
        const bSet = countryBranches.get(canKey) || new Set();
        const rList = countryReports.get(canKey) || [];
        const totalValueUsd = rList.reduce((sum, r) => sum + (Number(r.valueUsd) || 0), 0);
        const stats = {
            projectsCount: pSet.size,
            branchesCount: bSet.size,
            reportsCount: rList.length,
            totalValueUsd,
            hasData: pSet.size > 0 || bSet.size > 0 || rList.length > 0
        };

        // Compute Early Warning Stats for this country
        const pList = [];
        const seenP = new Set();
        rList.forEach(r => {
            if (r.projectName && !seenP.has(r.projectName)) {
                seenP.add(r.projectName);
                pList.push(r);
            }
        });

        let totalScore = 0;
        let dangerCount = 0;
        let mediumCount = 0;
        let safeCount = 0;

        pList.forEach(p => {
            const ew = evaluateProjectEarlyWarning(p);
            totalScore += ew.score;
            if (ew.level === 'danger') dangerCount++;
            else if (ew.level === 'medium') mediumCount++;
            else safeCount++;
        });

        const totalProjects = pList.length;
        let avgScore = totalProjects > 0 ? Math.round(totalScore / totalProjects) : 75;
        let ewColor = getEarlyWarningColor(avgScore, dangerCount, totalProjects);
        let ewLevel = 'safe';
        let ewLevelLabel = 'مستقر وآمن';

        if (avgScore < 50 || dangerCount >= Math.max(1, Math.ceil(totalProjects * 0.35))) {
            ewLevel = 'danger';
            ewLevelLabel = 'إنذار حرج';
            ewColor = '#ef4444';
        } else if (avgScore < 75 || dangerCount > 0) {
            ewLevel = 'medium';
            ewLevelLabel = 'ملاحظة ومتابعة';
            ewColor = '#f59e0b';
        }

        const ewStats = {
            score: avgScore,
            color: ewColor,
            level: ewLevel,
            levelLabel: ewLevelLabel,
            dangerCount,
            mediumCount,
            safeCount,
            totalProjects
        };

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

    // Compute max value for heatmap normalization
    maxCountryValueUsd = 1;
    precomputedCountryStats.forEach(s => {
        if (s.totalValueUsd > maxCountryValueUsd) maxCountryValueUsd = s.totalValueUsd;
    });
}


function getCountryDataCounts(countryName, isoCode) {
    if (isoCode) {
        if (precomputedCountryStats.has(isoCode)) return precomputedCountryStats.get(isoCode);
        if (precomputedCountryStats.has(isoCode.toLowerCase())) return precomputedCountryStats.get(isoCode.toLowerCase());
    }
    if (!countryName) return { projectsCount: 0, branchesCount: 0, reportsCount: 0, hasData: false };

    const clean = String(countryName).trim();
    if (precomputedCountryStats.has(clean)) return precomputedCountryStats.get(clean);
    if (precomputedCountryStats.has(clean.toLowerCase())) return precomputedCountryStats.get(clean.toLowerCase());

    const geo = typeof findCountryGeo === 'function' ? findCountryGeo(clean) : null;
    if (geo && geo.id) {
        if (precomputedCountryStats.has(geo.id)) return precomputedCountryStats.get(geo.id);
        if (precomputedCountryStats.has(geo.id.toLowerCase())) return precomputedCountryStats.get(geo.id.toLowerCase());
    }

    return { projectsCount: 0, branchesCount: 0, reportsCount: 0, hasData: false };
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
    let counts = { projectsCount: 0, branchesCount: 0, reportsCount: 0, hasData: false };
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
        if (counts.projectsCount > 0 || counts.reportsCount > 0) {
            // 🟢 Heatmap green: intensity ∝ totalValueUsd / maxCountryValueUsd
            const ratio = counts.totalValueUsd > 0
                ? Math.sqrt(counts.totalValueUsd / maxCountryValueUsd)
                : 0.15;
            const fillOpacity = 0.10 + ratio * 0.55;  // range: 0.10 → 0.65
            const borderOpacity = 0.6 + ratio * 0.4;   // range: 0.60 → 1.00
            return {
                color: '#10b981',
                weight: 2.5,
                opacity: borderOpacity,
                fillColor: '#10b981',
                fillOpacity
            };
        } else if (counts.branchesCount > 0) {
            // 🔴 Red: branches but no projects
            return {
                color: '#ef4444',
                weight: 2.5,
                opacity: 1,
                fillColor: '#ef4444',
                fillOpacity: 0.18
            };
        } else {
            // 🟡 Yellow: no branches at all
            return {
                color: '#facc15',
                weight: 2,
                opacity: 0.9,
                fillColor: '#facc15',
                fillOpacity: 0.12
            };
        }
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

            const flagClass = getFlagIconClass(countryName);
            const flagHtml = flagClass && flagClass !== 'fi-xx'
                ? `<span class="fi ${flagClass}" style="border-radius:2px; font-size:14px;"></span>`
                : (countryGeo && countryGeo.flag ? countryGeo.flag : '🌐');

            // Robust counts lookup (same logic as getCountryBoundaryStyle)
            let counts = { projectsCount: 0, branchesCount: 0, reportsCount: 0, hasData: false };
            if (isoCode) {
                const d = precomputedCountryStats.get(isoCode) || precomputedCountryStats.get(isoCode.toLowerCase());
                if (d) counts = d;
            }
            if (!counts.hasData && countryGeo && countryGeo.id) {
                const d = precomputedCountryStats.get(countryGeo.id) || precomputedCountryStats.get(countryGeo.id.toLowerCase());
                if (d) counts = d;
            }
            if (!counts.hasData && countryName) counts = getCountryDataCounts(countryName, isoCode);


            // Countries WITHOUT projects or branches
            if (!counts.hasData) {
                layer.on('mouseover', () => {
                    const bar = document.getElementById('map-hovered-country-bar');
                    if (bar && countryName) {
                        if (isBusinessAnalysisMode) {
                            bar.innerHTML = `
                                ${flagHtml}
                                <span class="hover-country-name" style="color:#facc15;">${countryName}</span>
                                <span class="hover-divider"></span>
                                <span class="hover-stat" style="color:#facc15; font-weight:800;">🟡 سوق غير مستغل (لا يوجد فرع أو مشاريع)</span>
                            `;
                        } else {
                            bar.innerHTML = `
                                ${flagHtml}
                                <span class="hover-country-name" style="color:#94a3b8;">${countryName}</span>
                                <span class="hover-divider"></span>
                                <span class="hover-stat" style="color:#64748b; font-size:11px;">لا توجد مشاريع أو فروع حالية مسجلة</span>
                            `;
                        }
                    }
                });

                layer.on('mouseout', () => {
                    const bar = document.getElementById('map-hovered-country-bar');
                    if (bar) {
                        bar.innerHTML = `
                            <span class="hover-flag">🌐</span>
                            <span class="hover-hint">مرر الماوس فوق أي دولة أو مشروع أو فرع لعرض التفاصيل</span>
                        `;
                    }
                });

                return;
            }

            // Countries WITH projects or branches: Glow on hover and enable interactive drawer
            layer.on('mouseover', () => {
                if (currentHoveredCountryLayer && currentHoveredCountryLayer !== layer) {
                    geoJsonLayer.resetStyle(currentHoveredCountryLayer);
                }
                currentHoveredCountryLayer = layer;
                
                if (isEarlyWarningMode) {
                    const ewData = evaluateCountryEarlyWarning(countryName);
                    layer.setStyle({
                        color: ewData.color,
                        weight: 3.5,
                        opacity: 1.0,
                        fillColor: ewData.color,
                        fillOpacity: 0.5
                    });
                } else if (isBusinessAnalysisMode) {
                    const strokeColor = counts.projectsCount > 0 ? '#10b981' : '#ef4444';
                    layer.setStyle({
                        color: strokeColor,
                        weight: 3.2,
                        opacity: 1.0,
                        fillColor: strokeColor,
                        fillOpacity: 0.18
                    });
                } else {
                    layer.setStyle({
                        color: '#FACC15',
                        weight: 2.2,
                        opacity: 0.95,
                        fillColor: '#F59E0B',
                        fillOpacity: 0.14
                    });
                }

                // Update bottom country hover bar
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar && countryName) {
                    if (isEarlyWarningMode) {
                        const ewData = evaluateCountryEarlyWarning(countryName);
                        bar.innerHTML = `
                            ${flagHtml}
                            <span class="hover-country-name" style="color:${ewData.color};">${countryName}</span>
                            <span class="hover-divider"></span>
                            <span class="hover-stat" style="color:${ewData.color}; font-weight:900;">🚨 مؤشر الإنذار المبكر: ${ewData.score}% (${ewData.levelLabel})</span>
                            <span class="hover-divider"></span>
                            <span class="hover-stat">🔴 ${ewData.dangerCount} حرج</span>
                            <span class="hover-stat">🟡 ${ewData.mediumCount} متوسط</span>
                            <span class="hover-stat">🟢 ${ewData.safeCount} آمن</span>
                            <span class="hover-divider"></span>
                            <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط للتقريب وفحص المشاريع ❯</span>
                        `;
                    } else if (isBusinessAnalysisMode) {
                        if (counts.projectsCount > 0) {
                            bar.innerHTML = `
                                ${flagHtml}
                                <span class="hover-country-name" style="color:#10b981;">${countryName}</span>
                                <span class="hover-divider"></span>
                                <span class="hover-stat" style="color:#10b981; font-weight:800;">🟢 دولة بها مشاريع نشطة (${counts.projectsCount} مشاريع)</span>
                                <span class="hover-divider"></span>
                                <span class="hover-stat">🏢 ${counts.branchesCount} فروع ومقرات</span>
                                <span class="hover-divider"></span>
                                <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط لتفاصيل الدولة ❯</span>
                            `;
                        } else {
                            bar.innerHTML = `
                                ${flagHtml}
                                <span class="hover-country-name" style="color:#ef4444;">${countryName}</span>
                                <span class="hover-divider"></span>
                                <span class="hover-stat" style="color:#ef4444; font-weight:800;">🔴 فرع/مقر مسجل بدون مشاريع جارية (${counts.branchesCount} فروع)</span>
                                <span class="hover-divider"></span>
                                <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط لتفاصيل الفرع ❯</span>
                            `;
                        }
                    } else {
                        bar.innerHTML = `
                            ${flagHtml}
                            <span class="hover-country-name">${countryName}</span>
                            <span class="hover-divider"></span>
                            <span class="hover-stat">🏢 ${counts.branchesCount} فرع وشركة</span>
                            <span class="hover-stat">🏗️ ${counts.projectsCount} مشروع</span>
                            <span class="hover-divider"></span>
                            <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط للعرض ❯</span>
                        `;
                    }
                }
            });

            layer.on('mouseout', () => {
                geoJsonLayer.resetStyle(layer);
                if (currentHoveredCountryLayer === layer) {
                    currentHoveredCountryLayer = null;
                }
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar) {
                    bar.innerHTML = `
                        <span class="hover-flag">🌐</span>
                        <span class="hover-hint">مرر الماوس فوق أي دولة أو مشروع أو فرع لعرض التفاصيل</span>
                    `;
                }
            });

            layer.on('click', (e) => {
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

function updateMapMarkers() {
    if (!executiveMap || !markersGroup) return;

    markersGroup.clearLayers();

    const branchesToRender = new Set(expectedBranches);
    const projectsToRender = new Set(expectedProjects);

    reportsData.forEach(r => {
        if (r.branchName) branchesToRender.add(r.branchName);
        if (r.isProjectReport && r.projectName) projectsToRender.add(r.projectName);
    });

    // 1. Render Blue Glowing Branch Markers (No popup tooltip, info in bottom bar)
    if (showBranches) {
        branchesToRender.forEach(branchName => {
            if (!branchName) return;
            const country = branchToCountryMap[branchName] || '';
            const bReports = reportsData.filter(r => r.branchName === branchName);
            const bMapsLink = bReports.find(r => r.mapsLink)?.mapsLink || null;
            const coords = typeof getBranchCoordinates === 'function' ? getBranchCoordinates(branchName, country, bMapsLink) : { lat: 30.0444, lng: 31.2357, isHQ: false };
            
            const subProjectsCount = Array.from(projectsToRender).filter(p => projectToBranchMap[p] === branchName).length;
            const submittalsCount = bReports.length;
            const isHQ = coords.isHQ;

            const iconHtml = `
                <div class="branch-beacon-container" onclick="openBranchDetailModal('${escapeHtml(branchName)}', '${escapeHtml(country)}')">
                    <div class="branch-beacon-glow-outer"></div>
                    <div class="branch-3d-building">
                        <svg viewBox="0 0 24 24" width="22" height="22" class="branch-3d-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="bRoofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#BAE6FD"/>
                                    <stop offset="100%" stop-color="#60A5FA"/>
                                </linearGradient>
                                <linearGradient id="bLeftWall" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#2563EB"/>
                                    <stop offset="100%" stop-color="#1E3A8A"/>
                                </linearGradient>
                                <linearGradient id="bRightWall" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#3B82F6"/>
                                    <stop offset="100%" stop-color="#1D4ED8"/>
                                </linearGradient>
                            </defs>
                            <ellipse cx="12" cy="21.5" rx="7.5" ry="2.2" fill="rgba(37,99,235,0.4)"/>
                            <polygon points="5,7 12,11 12,21 5,17" fill="url(#bLeftWall)" stroke="#1E40AF" stroke-width="0.5" stroke-linejoin="round"/>
                            <polygon points="12,11 19,7 19,17 12,21" fill="url(#bRightWall)" stroke="#1E40AF" stroke-width="0.5" stroke-linejoin="round"/>
                            <polygon points="12,3 19,7 12,11 5,7" fill="url(#bRoofGrad)" stroke="#BFDBFE" stroke-width="0.5" stroke-linejoin="round"/>
                            <line x1="12" y1="11" x2="12" y2="21" stroke="rgba(255,255,255,0.35)" stroke-width="0.6"/>
                            <line x1="6.8" y1="9.8" x2="10.2" y2="11.8" stroke="#93C5FD" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
                            <line x1="6.8" y1="12.5" x2="10.2" y2="14.5" stroke="#93C5FD" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
                            <line x1="6.8" y1="15.2" x2="10.2" y2="17.2" stroke="#93C5FD" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
                            <line x1="13.8" y1="11.8" x2="17.2" y2="9.8" stroke="#EFF6FF" stroke-width="0.9" stroke-linecap="round" opacity="0.95"/>
                            <line x1="13.8" y1="14.5" x2="17.2" y2="12.5" stroke="#EFF6FF" stroke-width="0.9" stroke-linecap="round" opacity="0.95"/>
                            <line x1="13.8" y1="17.2" x2="17.2" y2="15.2" stroke="#EFF6FF" stroke-width="0.9" stroke-linecap="round" opacity="0.95"/>
                            <line x1="12" y1="3" x2="12" y2="0.8" stroke="#BFDBFE" stroke-width="1.2" stroke-linecap="round"/>
                            <circle cx="12" cy="0.8" r="1.1" fill="#60A5FA" stroke="#FFFFFF" stroke-width="0.5"/>
                        </svg>
                    </div>
                </div>
            `;

            const branchIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-branch-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([coords.lat, coords.lng], { icon: branchIcon });

            const bFlagClass = getFlagIconClass(country);
            const bFlagHtml = bFlagClass && bFlagClass !== 'fi-xx' 
                ? `<span class="fi ${bFlagClass}" style="border-radius:2px; font-size:14px;"></span>` 
                : '🏢';

            marker.on('mouseover', () => {
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar) {
                    bar.innerHTML = `
                        ${bFlagHtml}
                        <span class="hover-country-name">${escapeHtml(country || '-')}</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat" style="color:#60A5FA; font-weight:700;">🏢 ${escapeHtml(branchName)} ${isHQ ? '(المقر الرئيسي)' : ''}</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat">📁 <strong>${subProjectsCount}</strong> مشاريع</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat">📝 <strong>${submittalsCount}</strong> تقارير</span>
                        <span class="hover-divider"></span>
                        <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط لتفاصيل الفرع ❯</span>
                    `;
                }
            });

            marker.on('mouseout', () => {
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar) {
                    bar.innerHTML = `
                        <span class="hover-flag">🌐</span>
                        <span class="hover-hint">مرر الماوس فوق أي دولة أو مشروع أو فرع لعرض التفاصيل</span>
                    `;
                }
            });

            marker.on('click', () => openBranchDetailModal(branchName, country));
            markersGroup.addLayer(marker);
        });
    }

    // 2. Render Glowing Yellow Live Project Beacons (No popup tooltip, info in bottom bar)
    if (showProjects) {
        const projBuckets = new Map();
        projectsToRender.forEach(projectName => {
            if (!projectName) return;
            const branchName = projectToBranchMap[projectName] || '';
            const countryName = projectToCountryMap[projectName] || branchToCountryMap[branchName] || '';
            const projReports = reportsData.filter(r => r.projectName === projectName || (r.isProjectReport && r.projectName && r.projectName.includes(projectName)));
            const pMapsLink = projReports.find(r => r.mapsLink)?.mapsLink || null;
            const rawCoords = typeof getProjectCoordinates === 'function' ? getProjectCoordinates(projectName, branchName, countryName, pMapsLink) : { lat: 30.0444, lng: 31.2357 };
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
                    const radius = 0.14 + (count > 6 ? 0.06 : 0);
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

                const pFlagClass = getFlagIconClass(countryName);
                const pFlagHtml = pFlagClass && pFlagClass !== 'fi-xx' 
                    ? `<span class="fi ${pFlagClass}" style="border-radius:2px; font-size:14px;"></span>` 
                    : '🏗️';

                marker.on('mouseover', () => {
                    const bar = document.getElementById('map-hovered-country-bar');
                    if (bar) {
                        bar.innerHTML = `
                            ${pFlagHtml}
                            <span class="hover-country-name">${escapeHtml(countryName || '-')}</span>
                            <span class="hover-divider"></span>
                            <span class="hover-stat" style="color:#60A5FA;">🏢 ${escapeHtml(branchName || '-')}</span>
                            <span class="hover-divider"></span>
                            <span class="hover-stat" style="color:${projectColor}; font-weight:700;">🏗️ ${escapeHtml(projectName)}</span>
                            <span class="hover-divider"></span>
                            <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط للبيانات المالية ❯</span>
                        `;
                    }
                });

                marker.on('mouseout', () => {
                    const bar = document.getElementById('map-hovered-country-bar');
                    if (bar) {
                        bar.innerHTML = `
                            <span class="hover-flag">🌐</span>
                            <span class="hover-hint">مرر الماوس فوق أي دولة أو مشروع أو فرع لعرض التفاصيل</span>
                        `;
                    }
                });

                marker.on('click', () => openProjectDetailModal(projectName, branchName, countryName));
                markersGroup.addLayer(marker);
            });
        });
    }

    const statsEl = document.getElementById('map-quick-stats');
    if (statsEl) {
        statsEl.innerHTML = `<i class="fa-solid fa-layer-group"></i> <span>${branchesToRender.size} فرع</span> • <span>${projectsToRender.size} مشروع</span> • <span>${reportsData.length} تقرير</span>`;
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

function toggleMapControlsMenu(event) {
    if (event) event.stopPropagation();
    const container = document.getElementById('map-controls-container');
    const btn = document.getElementById('map-controls-trigger');
    if (!container || !btn) return;
    const isOpen = container.classList.contains('is-open');
    if (isOpen) {
        container.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
    } else {
        container.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
    }
}

function closeMapControlsMenu() {
    const container = document.getElementById('map-controls-container');
    const btn = document.getElementById('map-controls-trigger');
    if (container) container.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Auto-close menu when clicking outside
document.addEventListener('click', (e) => {
    const container = document.getElementById('map-controls-container');
    if (container && !container.contains(e.target)) {
        closeMapControlsMenu();
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
        geoJsonLayer.setStyle(getCountryBoundaryStyle);
    }

    if (isBusinessAnalysisMode) {
        if (markersGroup) markersGroup.clearLayers();
        if (showBranches) renderBranchMarkersOnly();
    } else {
        updateMapMarkers();
    }
    updateFloatingMapLegend();
}

/* ==================================================== */
/* Early Warning Mechanism (آلية الإنذار المبكر)         */
/* ==================================================== */
let isEarlyWarningMode = false;
let earlyWarningMarkersGroup = null;

function evaluateProjectEarlyWarning(report) {
    if (!report) {
        return {
            score: 25,
            level: 'danger',
            levelLabel: 'بيانات غير مكتملة',
            color: '#ef4444',
            pulseClass: 'radar-pulse-fast',
            groups: []
        };
    }

    let score = 0;
    const groups = [];

    const A = report.revisedContractValue || report.contractValue || 0;
    const B = report.executedWorkTotal || 0;
    const C = report.executedWorkApproved || 0;
    const D = report.paidWork || 0;
    const G = report.dueDebt || 0;
    const H = report.uncollectibleWork || 0;
    const progress = report.plannedProgressPercent || 0;
    const status = String(report.scheduleStatus || '').trim();
    const obstacles = String(report.projectObstacles || '').trim();
    const claims = String(report.claimsStatus || '').trim();
    const claimsVal = report.claimsValue || 0;

    const isDelayedStatus = status.includes('متأخر') || status.includes('خارج') || status.includes('متوقف') || status.includes('بطيء') || status.includes('تعثر') || status.includes('تأخير');
    const hasObstacles = obstacles && !obstacles.includes('لا توجد') && !obstacles.includes('لايوجد') && obstacles.length > 4;
    const hasClaims = claims && !claims.includes('لا يوجد') && !claims.includes('لايوجد') && !claims.includes('ودى') && !claims.includes('ودي');
    const collectionRatio = C > 0 ? (D / C) : (D > 0 ? 1 : 0.5);

    // 1. المقايسة ودقة التقدير المالي (15 pts)
    const boqItems = [];
    const hasBoqRaw = String(report.hasBillOfQuantities || '').trim();
    const hasBoq = hasBoqRaw.includes('نعم') || hasBoqRaw.includes('متاح') || hasBoqRaw.includes('يوجد') || (A > 0 && report.contractValue > 0);
    if (hasBoq) score += 8; else score += 1;
    boqItems.push({
        q: 'هل يوجد مقايسة للمشروع؟',
        ans: hasBoq ? 'يوجد مقايسة تعاقدية معتمدة' : 'غير متوفرة / قيد الإعداد',
        status: hasBoq ? 'pass' : 'fail'
    });

    const boqAccRaw = String(report.boqAccuracy || '').trim();
    const boqVariance = (A > 0 && report.contractValue > 0) ? Math.abs(A - report.contractValue) / report.contractValue : 0;
    const isBoqAcc = boqAccRaw.includes('عالي') || boqAccRaw.includes('ممتاز') || boqAccRaw.includes('دقيق') || (boqVariance < 0.15 && boqVariance >= 0);
    if (isBoqAcc) score += 7; else if (boqVariance < 0.35) score += 4; else score += 1;
    boqItems.push({
        q: 'دقة مقايسة المشروع',
        ans: boqAccRaw || (isBoqAcc ? 'دقة تقدير جيدة ومطابقة' : `فروق كميات بنسبة ${(boqVariance * 100).toFixed(0)}%`),
        status: isBoqAcc ? 'pass' : 'warn'
    });
    groups.push({ title: 'المقايسة ودقة التقدير المالي', icon: 'fa-file-invoice-dollar', items: boqItems });

    // 2. المطالبات والتحكيم (15 pts)
    const claimsItems = [];
    if (!hasClaims && claimsVal === 0) {
        score += 15;
        claimsItems.push({
            q: 'موقف المطالبات والتحكيم',
            ans: 'لا توجد نزاعات أو تحكيم معلق',
            status: 'pass'
        });
        claimsItems.push({
            q: 'حجم المطالبات والتحكيم',
            ans: 'صفر (لا توجد مطالبات مالية)',
            status: 'pass'
        });
    } else if (claims.includes('تفاوض') || claims.includes('ودى') || claims.includes('ودي') || (claimsVal > 0 && claimsVal < A * 0.1)) {
        score += 7;
        claimsItems.push({
            q: 'موقف المطالبات والتحكيم',
            ans: claims || 'جاري التفاوض والتسوية الودية',
            status: 'warn'
        });
        claimsItems.push({
            q: 'حجم المطالبات والتحكيم',
            ans: claimsVal > 0 ? formatCurrencyUSD(claimsVal) : 'مطالبات تحت الدراسة',
            status: 'warn'
        });
    } else {
        score += 1;
        claimsItems.push({
            q: 'موقف المطالبات والتحكيم',
            ans: claims || 'نزاع أو تحكيم قائم',
            status: 'fail'
        });
        claimsItems.push({
            q: 'حجم المطالبات والتحكيم',
            ans: claimsVal > 0 ? formatCurrencyUSD(claimsVal) : 'مطالبات مالية مؤثرة',
            status: 'fail'
        });
    }
    groups.push({ title: 'المطالبات والتحكيم والنزاعات التعاقدية', icon: 'fa-scale-balanced', items: claimsItems });

    // 3. السيولة والمستحقات والتحصيل (25 pts)
    const finItems = [];
    if (collectionRatio >= 0.85) {
        score += 10;
        finItems.push({
            q: 'كفاءة التحصيل (المسدد مقارنة بالمعتمد)',
            ans: `تحصيل ممتاز بنسبة ${(collectionRatio * 100).toFixed(0)}%`,
            status: 'pass'
        });
    } else if (collectionRatio >= 0.60) {
        score += 5;
        finItems.push({
            q: 'كفاءة التحصيل (المسدد مقارنة بالمعتمد)',
            ans: `تحصيل متوسط بنسبة ${(collectionRatio * 100).toFixed(0)}%`,
            status: 'warn'
        });
    } else {
        score += 1;
        finItems.push({
            q: 'كفاءة التحصيل (المسدد مقارنة بالمعتمد)',
            ans: `تأخر تحصيل حرج بنسبة ${(collectionRatio * 100).toFixed(0)}%`,
            status: 'fail'
        });
    }

    if (H === 0) {
        score += 5;
        finItems.push({
            q: 'الأعمال غير القابلة للصرف',
            ans: 'صفر (كافة الأعمال قابلة للصرف)',
            status: 'pass'
        });
    } else {
        score += 0;
        finItems.push({
            q: 'الأعمال غير القابلة للصرف',
            ans: formatCurrencyUSD(H) + ' (مستحقات معلقة)',
            status: 'fail'
        });
    }

    const isDebtHigh = C > 0 && (G / C) > 0.25;
    if (!isDebtHigh) {
        score += 5;
        finItems.push({
            q: 'مديونية أعمال لم تسدد بعد',
            ans: G > 0 ? formatCurrencyUSD(G) : 'ضمن الحدود المقبولة',
            status: 'pass'
        });
    } else {
        score += 1;
        finItems.push({
            q: 'مديونية أعمال لم تسدد بعد',
            ans: formatCurrencyUSD(G) + ' (مديونية مرتفعة)',
            status: 'fail'
        });
    }

    const isSubOk = report.subcontractorsDue === 0 || (report.collectedLiquidity > 0 && report.subcontractorsDue / report.collectedLiquidity < 0.35);
    if (isSubOk) score += 5; else score += 1;
    finItems.push({
        q: 'مستحقات مقاولي الباطن',
        ans: report.subcontractorsDue > 0 ? formatCurrencyUSD(report.subcontractorsDue) : 'مستحقات مسددة ومنتظمة',
        status: isSubOk ? 'pass' : 'warn'
    });
    groups.push({ title: 'السيولة والمستحقات والتحصيل', icon: 'fa-coins', items: finItems });

    // 4. المعوقات والتواصل الرسمي (15 pts)
    const obsItems = [];
    if (!hasObstacles) {
        score += 15;
        obsItems.push({
            q: 'معوقات المشروع الميدانية',
            ans: 'لا توجد معوقات تعيق سير الأعمال',
            status: 'pass'
        });
        obsItems.push({
            q: 'التواصل والخطابات الرسمية للجهة المالكة',
            ans: 'موقف تعاقدي مستقر ومنتظم',
            status: 'pass'
        });
    } else {
        const formalSent = String(report.formalLetterSent || '').trim();
        const isLetterOk = formalSent.includes('تم') || formalSent.includes('نعم') || formalSent.includes('ارسال');
        if (isLetterOk) score += 7; else score += 1;
        obsItems.push({
            q: 'معوقات المشروع الميدانية',
            ans: obstacles,
            status: 'fail'
        });
        obsItems.push({
            q: 'التواصل والخطابات الرسمية للجهة المالكة',
            ans: isLetterOk ? 'تم إرسال وتوثيق خطابات رسمية بالمعوقات' : 'معوقات قائمة تتطلب مخاطبة رسمية عاجلة',
            status: isLetterOk ? 'warn' : 'fail'
        });
    }
    groups.push({ title: 'المعوقات والتواصل الرسمي مع العميل', icon: 'fa-handshake', items: obsItems });

    // 5. التوريدات والكهروميكانيك (15 pts)
    const mepItems = [];
    const supRaw = String(report.supplySchedulePrepared || '').trim();
    const isSup = supRaw.includes('نعم') || supRaw.includes('تم') || supRaw.includes('معتمد');
    if (isSup || !hasObstacles) score += 8; else score += 2;
    mepItems.push({
        q: 'إعداد برنامج توريدات الخامات والمهمات',
        ans: isSup ? 'برنامج توريدات معتمد ومنفذ' : (supRaw || 'برنامج توريدات قيد التحديث'),
        status: (isSup || !hasObstacles) ? 'pass' : 'warn'
    });

    const mepRaw = String(report.mepApproved || '').trim();
    const isMep = mepRaw.includes('نعم') || mepRaw.includes('تم') || mepRaw.includes('معتمد');
    if (isMep || !hasObstacles) score += 7; else score += 2;
    mepItems.push({
        q: 'اعتماد جميع مهام الكهروميكانيك',
        ans: isMep ? 'مهام معتمدة ومطابقة للمواصفات' : (mepRaw || 'اعتماد جزئي جاري استكماله'),
        status: (isMep || !hasObstacles) ? 'pass' : 'warn'
    });
    groups.push({ title: 'التوريدات والأعمال الكهروميكانيكية', icon: 'fa-gears', items: mepItems });

    // 6. البرنامج الزمني ومد المدة ومعدلات الأداء (15 pts)
    const schedItems = [];
    if (!isDelayedStatus && progress >= 30) {
        score += 15;
        schedItems.push({
            q: 'الموقف التنفيذي والجدول الزمني',
            ans: `منتظم بمعدل إنجاز ${progress}%`,
            status: 'pass'
        });
        schedItems.push({
            q: 'تاريخ النهو المتوقع مقارنة بالمعتمد',
            ans: report.revisedEndDate || report.contractEndDate || 'وفق الجدول التعاقدي',
            status: 'pass'
        });
    } else if (!isDelayedStatus || progress >= 20) {
        score += 8;
        schedItems.push({
            q: 'الموقف التنفيذي والجدول الزمني',
            ans: status || `معدل إنجاز ${progress}% يحتاج زيادة وتيرة التنفيذ`,
            status: 'warn'
        });
        schedItems.push({
            q: 'تاريخ النهو المتوقع مقارنة بالمعتمد',
            ans: report.expectedFinishDate || report.revisedEndDate || 'قيد المتابعة',
            status: 'warn'
        });
    } else {
        score += 1;
        schedItems.push({
            q: 'الموقف التنفيذي والجدول الزمني',
            ans: status || `تأخر حرج بمعدل إنجاز ${progress}%`,
            status: 'fail'
        });
        schedItems.push({
            q: 'تاريخ النهو المتوقع مقارنة بالمعتمد',
            ans: report.expectedFinishDate || report.revisedEndDate || 'تأخر متوقع عن الموعد التعاقدي',
            status: 'fail'
        });
    }
    groups.push({ title: 'البرنامج الزمني ومعدلات الأداء', icon: 'fa-stopwatch', items: schedItems });

    // Final Score bounded between 15% and 100%
    score = Math.min(100, Math.max(15, Math.round(score)));

    let level = 'safe';
    let levelLabel = 'مستقر وآمن';
    let color = '#10b981';
    let pulseClass = 'radar-pulse-slow';

    if (score < 50) {
        level = 'danger';
        levelLabel = 'إنذار مبكر حرج';
        color = '#ef4444';
        pulseClass = 'radar-pulse-fast';
    } else if (score < 75) {
        level = 'medium';
        levelLabel = 'تحت المتابعة والملاحظة';
        color = '#f59e0b';
        pulseClass = 'radar-pulse-medium';
    }

    return {
        score,
        level,
        levelLabel,
        color,
        pulseClass,
        groups
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
    reportsData.forEach(r => {
        if (!r || !r.projectName || seen.has(r.projectName)) return;
        const c = r.country || branchToCountryMap[r.branchName] || projectToCountryMap[r.projectName] || '';
        if (countriesMatch(c, countryName) || (isoCode && countriesMatch(c, isoCode))) {
            seen.add(r.projectName);
            countryProjects.push(r);
        }
    });

    if (countryProjects.length === 0) {
        return {
            score: 75,
            level: 'safe',
            levelLabel: 'مستقر',
            color: '#10b981',
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

    countryProjects.forEach(p => {
        const ew = evaluateProjectEarlyWarning(p);
        totalScore += ew.score;
        if (ew.level === 'danger') dangerCount++;
        else if (ew.level === 'medium') mediumCount++;
        else safeCount++;
    });

    const totalProjects = countryProjects.length;
    const avgScore = Math.round(totalScore / totalProjects);
    let ewColor = getEarlyWarningColor(avgScore, dangerCount, totalProjects);
    let level = 'safe';
    let levelLabel = 'مستقر وآمن';

    if (avgScore < 50 || dangerCount >= Math.max(1, Math.ceil(totalProjects * 0.35))) {
        level = 'danger';
        levelLabel = 'إنذار حرج';
        ewColor = '#ef4444';
    } else if (avgScore < 75 || dangerCount > 0) {
        level = 'medium';
        levelLabel = 'ملاحظة ومتابعة';
        ewColor = '#f59e0b';
    }

    return {
        score: avgScore,
        level,
        levelLabel,
        color: ewColor,
        totalProjects,
        dangerCount,
        mediumCount,
        safeCount
    };
}

function getEarlyWarningColor(score) {
    if (score >= 80) return '#10b981'; // Emerald Green (Healthy)
    if (score >= 70) return '#22c55e'; // Green
    if (score >= 60) return '#84cc16'; // Lime / Yellow-Green
    if (score >= 50) return '#eab308'; // Amber-Yellow
    if (score >= 40) return '#f97316'; // Orange (High Risk)
    return '#ef4444'; // Red (Critical Danger)
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
}

function updateFloatingMapLegend() {
    const container = document.getElementById('map-floating-legend');
    const content = document.getElementById('legend-card-content');
    if (!container || !content) return;

    if (isEarlyWarningMode) {
        content.innerHTML = `
            <div class="legend-header">
                <div class="legend-title">
                    <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i>
                    <span>دليل مؤشرات الإنذار المبكر</span>
                </div>
            </div>
            <div class="legend-items">
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#10b981; color:rgba(16,185,129,0.55);"></span>
                        <span class="legend-label">مستقر / أداء ممتاز</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#f59e0b; color:rgba(245,158,11,0.55);"></span>
                        <span class="legend-label">تحت المراقبة / أداء متوسط</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#ef4444; color:rgba(239,68,68,0.55);"></span>
                        <span class="legend-label">خطر / حرج</span>
                    </div>
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (isBusinessAnalysisMode) {
        content.innerHTML = `
            <div class="legend-header">
                <div class="legend-title">
                    <i class="fa-solid fa-chart-pie" style="color:#10b981;"></i>
                    <span>دليل تحليل الأعمال والأسواق</span>
                </div>
            </div>
            <div class="legend-items">
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#10b981; color:rgba(16,185,129,0.55);"></span>
                        <span class="legend-label">أسواق نشطة بمشاريع قائمة</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#ef4444; color:rgba(239,68,68,0.55);"></span>
                        <span class="legend-label">فروع قائمة بدون مشاريع</span>
                    </div>
                </div>
                <div class="legend-row">
                    <div class="legend-swatch-group">
                        <span class="legend-swatch" style="background:#facc15; color:rgba(250,204,21,0.55);"></span>
                        <span class="legend-label">أسواق مستهدفة</span>
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
                const radius = 0.16 + (count > 6 ? 0.08 : 0);
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

            marker.on('mouseover', () => {
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar) {
                    bar.innerHTML = `
                        <span class="hover-country-name">${escapeHtml(country || '-')}</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat" style="color:#60A5FA;">🏢 ${escapeHtml(proj.branchName || '-')}</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat" style="color:${projColor}; font-weight:800;">🏗️ ${escapeHtml(proj.projectName)}</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat" style="color:${projColor}; font-weight:800;">الحالة: ${ew.levelLabel} (${ew.score}%)</span>
                        <span class="hover-divider"></span>
                        <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط لتقرير الإنذار ❯</span>
                    `;
                }
            });

            marker.on('mouseout', () => {
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar) {
                    bar.innerHTML = `
                        <span class="hover-flag">🌐</span>
                        <span class="hover-hint">مرر الماوس فوق أي دولة أو مشروع أو فرع لعرض التفاصيل</span>
                    `;
                }
            });

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
                <div class="ew-status-badge" style="background:${ew.color}22; color:${ew.color}; border:1px solid ${ew.color};">
                    <span style="font-size:14px;">●</span> ${ew.levelLabel}
                </div>
            </div>

            ${ew.groups.map(g => `
                <div class="ew-group">
                    <div class="ew-group-title">
                        <i class="fa-solid ${g.icon}"></i> ${g.title}
                    </div>
                    ${g.items.map(item => `
                        <div class="ew-item">
                            <span class="ew-item-q">${escapeHtml(item.q)}</span>
                            <span class="ew-item-ans ew-ans-${item.status}">${escapeHtml(item.ans)}</span>
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
    const branchesToRender = new Set(expectedBranches);
    reportsData.forEach(r => {
        if (r.branchName) branchesToRender.add(r.branchName);
    });

    branchesToRender.forEach(branchName => {
        if (!branchName) return;
        const country = branchToCountryMap[branchName] || '';
        const bReports = reportsData.filter(r => r.branchName === branchName);
        const bMapsLink = bReports.find(r => r.mapsLink)?.mapsLink || null;
        const coords = typeof getBranchCoordinates === 'function' ? getBranchCoordinates(branchName, country, bMapsLink) : { lat: 30.0444, lng: 31.2357, isHQ: false };
        const isHQ = coords.isHQ;

        const iconHtml = `
            <div class="branch-beacon-container" onclick="openBranchDetailModal('${escapeHtml(branchName)}', '${escapeHtml(country)}')">
                <div class="branch-beacon-glow-outer"></div>
                <div class="branch-3d-building">
                    <svg viewBox="0 0 24 24" width="22" height="22" class="branch-3d-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="bRoofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#BAE6FD"/>
                                <stop offset="100%" stop-color="#60A5FA"/>
                            </linearGradient>
                            <linearGradient id="bLeftWall" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#2563EB"/>
                                <stop offset="100%" stop-color="#1E3A8A"/>
                            </linearGradient>
                            <linearGradient id="bRightWall" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#3B82F6"/>
                                <stop offset="100%" stop-color="#1D4ED8"/>
                            </linearGradient>
                        </defs>
                        <ellipse cx="12" cy="21.5" rx="7.5" ry="2.2" fill="rgba(37,99,235,0.4)"/>
                        <polygon points="5,7 12,11 12,21 5,17" fill="url(#bLeftWall)" stroke="#1E40AF" stroke-width="0.5" stroke-linejoin="round"/>
                        <polygon points="12,11 19,7 19,17 12,21" fill="url(#bRightWall)" stroke="#1E40AF" stroke-width="0.5" stroke-linejoin="round"/>
                        <polygon points="12,3 19,7 12,11 5,7" fill="url(#bRoofGrad)" stroke="#BFDBFE" stroke-width="0.5" stroke-linejoin="round"/>
                        <line x1="12" y1="11" x2="12" y2="21" stroke="rgba(255,255,255,0.35)" stroke-width="0.6"/>
                        <line x1="6.8" y1="9.8" x2="10.2" y2="11.8" stroke="#93C5FD" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
                        <line x1="6.8" y1="12.5" x2="10.2" y2="14.5" stroke="#93C5FD" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
                        <line x1="6.8" y1="15.2" x2="10.2" y2="17.2" stroke="#93C5FD" stroke-width="0.9" stroke-linecap="round" opacity="0.85"/>
                        <line x1="13.8" y1="11.8" x2="17.2" y2="9.8" stroke="#EFF6FF" stroke-width="0.9" stroke-linecap="round" opacity="0.95"/>
                        <line x1="13.8" y1="14.5" x2="17.2" y2="12.5" stroke="#EFF6FF" stroke-width="0.9" stroke-linecap="round" opacity="0.95"/>
                        <line x1="13.8" y1="17.2" x2="17.2" y2="15.2" stroke="#EFF6FF" stroke-width="0.9" stroke-linecap="round" opacity="0.95"/>
                        <line x1="12" y1="3" x2="12" y2="0.8" stroke="#BFDBFE" stroke-width="1.2" stroke-linecap="round"/>
                        <circle cx="12" cy="0.8" r="1.1" fill="#60A5FA" stroke="#FFFFFF" stroke-width="0.5"/>
                    </svg>
                </div>
            </div>
        `;

        const branchIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-branch-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([coords.lat, coords.lng], { icon: branchIcon });
        marker.on('click', () => openBranchDetailModal(branchName, country));
        markersGroup.addLayer(marker);
    });
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

        marker.on('mouseover', () => {
            const bar = document.getElementById('map-hovered-country-bar');
            if (bar) {
                bar.innerHTML = `
                    ${flagHtml}
                    <span class="hover-country-name">${escapeHtml(countryName)}</span>
                    <span class="hover-divider"></span>
                    <span class="hover-stat" style="color:#34D399; font-weight:800;">💰 إجمالي حجم الأعمال: ${formatCurrencyUSD(totalVal)}</span>
                    <span class="hover-divider"></span>
                    <span class="hover-stat" style="color:#60A5FA; font-weight:700;">📁 ${projCount} مشاريع نشطة</span>
                    <span class="hover-divider"></span>
                    <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط لعرض تفاصيل الدولة ❯</span>
                `;
            }
        });

        marker.on('mouseout', () => {
            const bar = document.getElementById('map-hovered-country-bar');
            if (bar) {
                bar.innerHTML = `
                    <span class="hover-flag">🌐</span>
                    <span class="hover-hint">مرر الماوس فوق أي دولة أو مشروع أو فرع لعرض التفاصيل</span>
                `;
            }
        });

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

    return openCountryBoard(countryGeo, countryName, initialProjectName);
}

function openCountryBoard(countryGeo, countryName, initialProjectName = null) {
    const overlay = document.getElementById('country-drawer-overlay');
    const dialog = document.getElementById('country-drawer');
    if (!overlay || !dialog) return;

    const reports = reportsData.filter(report => countriesMatch(report.country, countryName));
    const latestByProject = new Map();
    reports.forEach(report => {
        const key = report.projectId || report.projectName;
        const current = latestByProject.get(key);
        if (key && (!current || (report.reportDate && (!current.reportDate || report.reportDate > current.reportDate)))) {
            latestByProject.set(key, report);
        }
    });
    const projects = [...latestByProject.values()];

    const getMetrics = (p) => {
        if (!p) return { a: 0, b: 0, c: 0, d: 0, f: 0, j: 0, i: 0, h: 0, g: 0, coll: 0 };
        const rate = p.exchangeRate || 1;
        const a = (Number(p.revisedContractValue) || Number(p.contractValue) || 0) / rate;
        const c = (Number(p.executedWorkApproved) || 0) / rate;
        const b = (Number(p.executedWorkTotal) || c) / rate;
        const d = (Number(p.paidWork) || 0) / rate;
        const f = (Number(p.collectedLiquidity) || 0) / rate;
        const j = (Number(p.wagesCost) || 0) / rate;
        const i = (Number(p.profitLoss) || 0) / rate;
        const h = (Number(p.uncollectibleWork) || 0) / rate;
        const g = (Number(p.dueDebt) || 0) / rate;
        const coll = Math.max(0, c - d) || g;
        return { a, b, c, d, f, j, i, h, g, coll };
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
        acc.coll += m.coll;
        return acc;
    }, { a: 0, b: 0, c: 0, d: 0, f: 0, j: 0, i: 0, h: 0, g: 0, coll: 0 });

    const kpisList = [
        {
            key: 'kpi_a',
            title: 'القيمة التعاقدية المعدلة',
            subTitle: 'الوزن النسبي',
            getMain: (m) => m.a,
            getSub: (m, isAgg) => isAgg ? 100 : (countryTotals.a ? (m.a / countryTotals.a * 100) : 0),
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_c',
            title: 'الأعمال المنفذة المعتمدة',
            subTitle: 'نسبة التقدم المعتمد',
            getMain: (m) => m.c,
            getSub: (m) => m.a ? (m.c / m.a * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_b',
            title: 'الأعمال شامل الداخلي',
            subTitle: 'نسبة تقدم الأعمال',
            getMain: (m) => m.b,
            getSub: (m) => m.a ? (m.b / m.a * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_d',
            title: 'الأعمال المسددة',
            subTitle: 'نسبة كفاءة التحصيل',
            getMain: (m) => m.d,
            getSub: (m) => m.c ? (m.d / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_f',
            title: 'إجمالي السيولة المحصلة',
            subTitle: 'نسبة السيولة للعمل',
            getMain: (m) => m.f,
            getSub: (m) => m.c ? (m.f / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_j',
            title: 'تكلفة أجور المشروع',
            subTitle: 'نسبة الأجور',
            getMain: (m) => m.j,
            getSub: (m) => m.c ? (m.j / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_i',
            title: 'ربحية المشروع',
            subTitle: 'نسبة الربحية',
            getMain: (m) => m.i,
            getSub: (m) => m.c ? (m.i / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_h',
            title: 'غير القابل للصرف',
            subTitle: 'نسبة غير القابل',
            getMain: (m) => m.h,
            getSub: (m) => m.c ? (m.h / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_g',
            title: 'أعمال لم تسدد بعد',
            subTitle: 'نسبة غير المسدد',
            getMain: (m) => m.g,
            getSub: (m) => m.c ? (m.g / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        },
        {
            key: 'kpi_coll',
            title: 'مديونية قابلة للتحصيل',
            subTitle: 'نسبة التحصيل المتوقع',
            getMain: (m) => m.coll,
            getSub: (m) => m.c ? (m.coll / m.c * 100) : 0,
            formatMain: formatCurrencyUSD,
            formatSub: (v) => `${v.toFixed(1)}%`
        }
    ];

    dialog.className = 'country-drawer board-country-dialog';
    dialog.innerHTML = `
        <div class="country-board-head">
            <div>
                <div class="country-board-eyebrow">COUNTRY PORTFOLIO</div>
                <h3 class="country-board-title">${escapeHtml(countryName)}</h3>
            </div>
            <button class="drawer-close-btn" onclick="closeCountryDrawer()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="country-board-grid">
            <div class="country-board-kpis" id="country-board-kpis-grid">
                ${kpisList.map(kpi => `
                    <button type="button" class="country-board-kpi" data-kpi="${kpi.key}" aria-expanded="false" aria-controls="country-kpi-projects">
                        <span class="kpi-main-label">${kpi.title}</span>
                        <strong class="kpi-main-val" id="val-${kpi.key}">${kpi.formatMain(kpi.getMain(countryTotals))}</strong>
                        <div class="kpi-sub-ratio">
                            <span class="kpi-sub-label">${kpi.subTitle}</span>
                            <span class="kpi-sub-val" id="sub-${kpi.key}">${kpi.formatSub(kpi.getSub(countryTotals, true))}</span>
                        </div>
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

            <div class="country-chart-card">
                <div class="country-chart-title">توزيع قيمة العقود</div>
                <div class="country-chart-canvas">
                    <canvas id="country-contract-chart"></canvas>
                    <div class="country-chart-metric" id="country-contract-metric" aria-live="polite"></div>
                </div>
            </div>

            <div class="country-chart-card">
                <div class="country-chart-title">نسب الإنجاز الحالية</div>
                <div class="country-chart-canvas">
                    <canvas id="country-progress-chart"></canvas>
                    <div class="country-chart-metric" id="country-progress-metric" aria-live="polite"></div>
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

    function renderKpiCardsData(focusedProject = null) {
        const m = focusedProject ? getMetrics(focusedProject) : countryTotals;
        const isAgg = !focusedProject;
        kpisList.forEach(kpi => {
            const valEl = document.getElementById(`val-${kpi.key}`);
            const subEl = document.getElementById(`sub-${kpi.key}`);
            if (valEl) valEl.textContent = kpi.formatMain(kpi.getMain(m));
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

        kpiProjectList.innerHTML = rankedProjects.map(proj => {
            const pKey = projectKey(proj);
            const m = getMetrics(proj);
            const mainVal = config.formatMain(config.getMain(m));
            const subVal = config.formatSub(config.getSub(m, false));
            const isSelected = selectedProjectKey === pKey;
            const isDimmed = selectedProjectKey && !isSelected;

            return `<div class="country-kpi-project-item${isSelected ? ' is-selected' : ''}${isDimmed ? ' is-dimmed' : ''}" data-project-key="${escapeHtml(pKey)}">
                <span class="country-kpi-project-name">🏗️ ${escapeHtml(proj.projectName)}</span>
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:12px;color:#38bdf8;font-weight:700;">(${subVal})</span>
                    <strong class="country-kpi-project-value" dir="ltr">${mainVal}</strong>
                </div>
            </div>`;
        }).join('');

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
    const progressProjects = [...projects].sort((a, b) => progressValue(b.plannedProgressPercent) - progressValue(a.plannedProgressPercent));
    const progressCutout = `${Math.max(0, 100 - progressProjects.length * 10)}%`;

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
        setMetric('country-progress-metric', clearSelection ? '' : `نسبة الإنجاز: ${progressValue(project.plannedProgressPercent)}%`);
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
                spacing: 4,
                hoverOffset: 6,
                offset: projects.map(() => 0)
            }]
        },
        options: {
            maintainAspectRatio: false,
            cutout: '30%',
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
            const progress = progressValue(project.plannedProgressPercent);
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
                            return `${item.dataset.label}: ${proj ? progressValue(proj.plannedProgressPercent) : ''}%`;
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

    const clearSelectedProject = event => {
        if (!selectedProjectKey || event.target.closest('.country-chart-canvas, .country-board-kpi, .country-kpi-projects, .country-kpi-project-item')) return;
        const selectedProject = projects.find(project => projectKey(project) === selectedProjectKey);
        if (selectedProject) selectProject(selectedProject);
    };
    dialog.addEventListener('pointerdown', clearSelectedProject);
    dialog.addEventListener('click', clearSelectedProject);

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

function openBranchDetailModal(branchName, countryName) {
    const modal = document.getElementById('branch-detail-modal');
    if (!modal) return;

    document.getElementById('branch-modal-name').innerText = branchName;
    const country = countryName || branchToCountryMap[branchName] || '-';
    document.getElementById('branch-modal-country').innerText = country;

    const bProjects = Array.from(expectedProjects).filter(p => projectToBranchMap[p] === branchName);
    const bReports = reportsData.filter(r => r.branchName === branchName);

    document.getElementById('branch-modal-proj-count').innerText = bProjects.length;
    document.getElementById('branch-modal-rep-count').innerText = bReports.length;
    document.getElementById('branch-modal-status').innerText = bReports.length > 0 ? 'تم رفع التحديثات' : 'لم يتم الرفع';

    const listEl = document.getElementById('branch-modal-projects-list');
    listEl.innerHTML = '';
    if (bProjects.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:8px;">لا توجد مشاريع مسجلة تحت هذا الفرع</div>';
    } else {
        bProjects.forEach(p => {
            const isRep = bReports.some(r => r.projectName === p);
            const row = document.createElement('div');
            row.className = 'detail-project-row';
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-helmet-safety" style="color:var(--theme-accent);"></i>
                    <strong style="color:var(--text-primary);">${escapeHtml(p)}</strong>
                </div>
                <span style="font-weight:700; color:${isRep ? '#10B981' : '#F59E0B'};">
                    ${isRep ? '✓ تم الرفع' : '⏳ متأخر'}
                </span>
            `;
            listEl.appendChild(row);
        });
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('show'), 10);

    if (executiveMap && typeof getBranchCoordinates === 'function') {
        const bMapsLink = bReports.length > 0 ? bReports[0].mapsLink : null;
        const coords = getBranchCoordinates(branchName, country, bMapsLink);
        executiveMap.flyTo([coords.lat, coords.lng], 7, { duration: 1.0 });
    }
}

function closeBranchDetailModal() {
    const modal = document.getElementById('branch-detail-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
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

        const [reportsTable, ddTable] = await Promise.all([
            fetchSheetJSONP(MAP_DATA_SHEET),
            fetchSheetJSONP('dd_lst')
        ]);

        parseDropdownRegistry(ddTable);
        globalRawReports = parseDashboardMapReports(reportsTable);
        reportsData = globalRawReports;
        reportsData.forEach(report => {
            if (!report.projectName) return;
            projectToBranchMap[report.projectName] = report.branchName || report.country || '';
            projectToCountryMap[report.projectName] = report.country || '';
        });

        rebuildCountryStatsCache();
        renderGeoJsonBoundaries();
        updateMapMarkers();
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

function updateHeaderKPIStats() {
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
    const countriesCount = uniqueCountries.size || 21;

    // Branches count
    const branchesCount = expectedBranches.size || 50;

    // Projects count
    const projectsCount = expectedProjects.size || (reportsData ? reportsData.filter(r => r.projectName).length : 0);

    // Run slow 5-second counting animation
    animateNumberCounting('kpi-count-countries', countriesCount, 5000);
    animateNumberCounting('kpi-count-branches', branchesCount, 5000);
    animateNumberCounting('kpi-count-projects', projectsCount, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    setMapTheme(localStorage.getItem('appTheme') || 'corporate');
    const themeSwitch = document.getElementById('map-theme-switch');
    if (themeSwitch) themeSwitch.addEventListener('click', toggleMapTheme);
    loadMapPageData();
});
