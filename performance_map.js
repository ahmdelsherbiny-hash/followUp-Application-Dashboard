// Dedicated Interactive Performance Map Logic for Arab Contractors

const SHEET_ID = '1eRp9k1JWjvyFO8IymyEUAu7Sd6woqgu4Oe0D26xY5k4';

let executiveMap = null;
let markersGroup = null;
let currentTileLayer = null;
let currentTileStyle = 'dark';
let showBranches = true;
let showProjects = true;
let currentRegion = 'all';
let menaGeoJsonData = null;
let geoJsonLayer = null;

let reportsData = [];
let globalRawReports = [];
let expectedProjects = new Set();
let expectedBranches = new Set();
let branchToCountryMap = {};
let projectToBranchMap = {};
let projectToCountryMap = {};

const MENA_AFRICA_BOUNDS = [
    [-22.0, -22.0], // South-West (below Zambia & West of Guinea / Atlantic)
    [40.0, 66.0]    // North-East (above Spain/Morocco/Levant & East of Oman/Gulf)
];

const ALLOWED_NAV_BOUNDS = [
    [-26.0, -26.0],
    [44.0, 70.0]
];

let currentHoveredCountryLayer = null;

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
    if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
        return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
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
        maxBoundsViscosity: 1.0,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
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

    const tileUrl = currentTileStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    currentTileLayer = L.tileLayer(tileUrl, {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(executiveMap);

    markersGroup = L.layerGroup().addTo(executiveMap);

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

    setTimeout(() => {
        if (executiveMap) {
            executiveMap.invalidateSize();
            executiveMap.fitBounds(MENA_AFRICA_BOUNDS, { padding: [10, 10] });
        }
    }, 400);
}

function getCountryBoundaryDefaultStyle() {
    return {
        color: 'rgba(250, 204, 21, 0.08)',
        weight: 0.8,
        opacity: 0.4,
        fillColor: 'transparent',
        fillOpacity: 0,
        className: 'outline-none focus:outline-none select-none'
    };
}

function renderGeoJsonBoundaries() {
    if (!executiveMap || !menaGeoJsonData) return;

    if (geoJsonLayer) {
        executiveMap.removeLayer(geoJsonLayer);
    }

    geoJsonLayer = L.geoJSON(menaGeoJsonData, {
        style: getCountryBoundaryDefaultStyle,
        onEachFeature: (feature, layer) => {
            const isoCode = feature.properties ? feature.properties['ISO3166-1-Alpha-2'] : null;
            const countryGeo = isoCode && typeof COUNTRIES_GEO !== 'undefined' ? COUNTRIES_GEO[isoCode] : null;
            const countryName = countryGeo ? countryGeo.nameAr : (feature.properties ? (feature.properties.name || '') : '');

            const flagClass = getFlagIconClass(countryName);
            const flagHtml = flagClass && flagClass !== 'fi-xx' 
                ? `<span class="fi ${flagClass}" style="border-radius:2px; font-size:14px;"></span>`
                : (countryGeo && countryGeo.flag ? countryGeo.flag : '🌐');

            layer.on('mouseover', () => {
                if (currentHoveredCountryLayer && currentHoveredCountryLayer !== layer) {
                    geoJsonLayer.resetStyle(currentHoveredCountryLayer);
                }
                currentHoveredCountryLayer = layer;
                layer.setStyle({
                    color: '#FACC15',
                    weight: 2.2,
                    opacity: 0.95,
                    fillColor: '#F59E0B',
                    fillOpacity: 0.12
                });

                // Update bottom-left country hover bar
                const bar = document.getElementById('map-hovered-country-bar');
                if (bar && countryName) {
                    const countryProjectsCount = Array.from(expectedProjects).filter(p => {
                        const pCountry = projectToCountryMap[p] || (projectToBranchMap[p] && branchToCountryMap[projectToBranchMap[p]]) || '';
                        return pCountry === countryName || pCountry.includes(countryName) || countryName.includes(pCountry);
                    }).length;

                    const countryBranchesCount = Array.from(expectedBranches).filter(b => {
                        const bCountry = branchToCountryMap[b] || '';
                        return bCountry === countryName || bCountry.includes(countryName) || countryName.includes(bCountry);
                    }).length;

                    bar.innerHTML = `
                        ${flagHtml}
                        <span class="hover-country-name">${countryName}</span>
                        <span class="hover-divider"></span>
                        <span class="hover-stat">🏢 ${countryBranchesCount} فرع وشركة</span>
                        <span class="hover-stat">🏗️ ${countryProjectsCount} مشروع</span>
                        <span class="hover-divider"></span>
                        <span style="color:var(--theme-accent); font-size:11px; font-weight:700;">اضغط للعرض ❯</span>
                    `;
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
                    <div class="branch-beacon-glow-inner"></div>
                    <div class="branch-beacon-core"></div>
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
        projectsToRender.forEach(projectName => {
            if (!projectName) return;
            const branchName = projectToBranchMap[projectName] || '';
            const countryName = projectToCountryMap[projectName] || branchToCountryMap[branchName] || '';
            const projReports = reportsData.filter(r => r.projectName === projectName || (r.isProjectReport && r.projectName && r.projectName.includes(projectName)));
            const pMapsLink = projReports.find(r => r.mapsLink)?.mapsLink || null;
            const coords = typeof getProjectCoordinates === 'function' ? getProjectCoordinates(projectName, branchName, countryName, pMapsLink) : { lat: 30.0444, lng: 31.2357 };

            const iconHtml = `
                <div class="project-beacon-container" onclick="openProjectDetailModal('${escapeHtml(projectName)}', '${escapeHtml(branchName)}', '${escapeHtml(countryName)}')">
                    <div class="project-beacon-glow-outer"></div>
                    <div class="project-beacon-glow-inner"></div>
                    <div class="project-beacon-core"></div>
                </div>
            `;

            const projIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-project-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([coords.lat, coords.lng], { icon: projIcon });

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
                        <span class="hover-stat" style="color:#FCD34D; font-weight:700;">🏗️ ${escapeHtml(projectName)}</span>
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

function toggleMapLayer(layer) {
    if (layer === 'branches') {
        showBranches = !showBranches;
        const legendItem = document.getElementById('legend-toggle-branches');
        if (legendItem) {
            legendItem.classList.toggle('active', showBranches);
            legendItem.classList.toggle('inactive', !showBranches);
        }
    } else if (layer === 'projects') {
        showProjects = !showProjects;
        const legendItem = document.getElementById('legend-toggle-projects');
        if (legendItem) {
            legendItem.classList.toggle('active', showProjects);
            legendItem.classList.toggle('inactive', !showProjects);
        }
    }
    updateMapMarkers();
}

function toggleTileLayerStyle() {
    currentTileStyle = currentTileStyle === 'dark' ? 'satellite' : 'dark';
    const btn = document.getElementById('toggle-tile-style-btn');
    const label = document.getElementById('tile-style-label');

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
        const tileUrl = currentTileStyle === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        currentTileLayer.setUrl(tileUrl);
    }
}

function openCountryDrawer(countryDataOrName) {
    const drawerOverlay = document.getElementById('country-drawer-overlay');
    if (!drawerOverlay) return;

    let countryGeo = null;
    let countryName = '';

    if (typeof countryDataOrName === 'string') {
        countryName = countryDataOrName;
        countryGeo = typeof findCountryGeo === 'function' ? findCountryGeo(countryName) : null;
    } else if (countryDataOrName && typeof countryDataOrName === 'object') {
        countryGeo = countryDataOrName;
        countryName = countryGeo.nameAr || countryGeo.fullNameAr || countryGeo.nameEn;
    }

    const flagClass = (typeof getFlagIconClass === 'function') ? getFlagIconClass(countryName) : (countryGeo ? countryGeo.flagClass : '');
    const region = countryGeo ? countryGeo.region : 'إقليمي';

    document.getElementById('drawer-country-name').innerText = countryName;
    const flagEl = document.getElementById('drawer-country-flag');
    if (flagEl && flagClass) flagEl.className = `drawer-flag fi ${flagClass}`;
    
    const regEl = document.getElementById('drawer-country-region');
    if (regEl) regEl.innerText = region.replace('_', ' ');

    const countryProjects = Array.from(expectedProjects).filter(p => {
        const c = projectToCountryMap[p] || branchToCountryMap[projectToBranchMap[p]] || '';
        return c.toLowerCase().includes(countryName.toLowerCase()) || countryName.toLowerCase().includes(c.toLowerCase());
    });

    const countryBranches = Array.from(expectedBranches).filter(b => {
        const c = branchToCountryMap[b] || '';
        return c.toLowerCase().includes(countryName.toLowerCase()) || countryName.toLowerCase().includes(c.toLowerCase());
    });

    const countryReports = reportsData.filter(r => {
        return (r.country && (r.country.includes(countryName) || countryName.includes(r.country))) ||
               (r.projectName && countryProjects.includes(r.projectName)) ||
               (r.branchName && countryBranches.includes(r.branchName));
    });

    document.getElementById('drawer-projects-count').innerText = countryProjects.length;
    document.getElementById('drawer-branches-count').innerText = countryBranches.length;
    document.getElementById('drawer-reports-count').innerText = countryReports.length;

    const branchesListEl = document.getElementById('drawer-branches-list');
    branchesListEl.innerHTML = '';
    if (countryBranches.length === 0) {
        branchesListEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:8px;">لا توجد فروع مسجلة مباشرة</div>';
    } else {
        countryBranches.forEach(bName => {
            const bSubProjects = countryProjects.filter(p => projectToBranchMap[p] === bName).length;
            const bSubReports = countryReports.filter(r => r.branchName === bName).length;
            const card = document.createElement('div');
            card.className = 'drawer-item-card';
            card.innerHTML = `
                <div class="drawer-item-header">
                    <span class="drawer-item-title">🏢 ${escapeHtml(bName)}</span>
                    <span class="drawer-item-badge">${bSubReports > 0 ? '✓ تم التحديث' : '⏳ بانتظار التقرير'}</span>
                </div>
                <div class="drawer-item-sub">
                    <span>عدد المشاريع: <strong>${bSubProjects}</strong></span>
                    <span>التقارير: <strong>${bSubReports}</strong></span>
                </div>
            `;
            card.onclick = () => {
                closeCountryDrawer();
                openBranchDetailModal(bName, countryName);
            };
            branchesListEl.appendChild(card);
        });
    }

    const projectsListEl = document.getElementById('drawer-projects-list');
    projectsListEl.innerHTML = '';
    if (countryProjects.length === 0) {
        projectsListEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px; padding:8px;">لا توجد مشروعات مسجلة في هذا النطاق</div>';
    } else {
        countryProjects.forEach(pName => {
            const pReports = countryReports.filter(r => r.projectName === pName);
            const latestReport = pReports.length > 0 ? pReports[0] : null;
            const bName = projectToBranchMap[pName] || '-';
            const val = latestReport && latestReport.valueUsd > 0 ? formatCurrencyUSD(latestReport.valueUsd) : '';

            const card = document.createElement('div');
            card.className = 'drawer-item-card';
            card.innerHTML = `
                <div class="drawer-item-header">
                    <span class="drawer-item-title">🏗️ ${escapeHtml(pName)}</span>
                    ${val ? `<span class="drawer-item-badge">${val}</span>` : ''}
                </div>
                <div class="drawer-item-sub">
                    <span>الفرع: <strong>${escapeHtml(bName)}</strong></span>
                    <span style="color:${latestReport ? '#10b981' : '#f59e0b'};">${latestReport ? '✓ مرفوع' : '⏳ معلق'}</span>
                </div>
            `;
            card.onclick = () => {
                closeCountryDrawer();
                openProjectDetailModal(pName, bName, countryName);
            };
            projectsListEl.appendChild(card);
        });
    }

    drawerOverlay.classList.remove('hidden');
    setTimeout(() => drawerOverlay.classList.add('show'), 10);
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

function openProjectDetailModal(projectName, branchName, countryName) {
    const modal = document.getElementById('project-detail-modal');
    if (!modal) return;

    switchProjModalTab('financials', document.querySelector('.proj-tab-btn'));

    document.getElementById('project-modal-name').innerText = projectName;
    const branch = branchName || projectToBranchMap[projectName] || '-';
    const country = countryName || projectToCountryMap[projectName] || branchToCountryMap[branch] || '-';

    document.getElementById('project-modal-country-badge').innerText = `🌍 ${country}`;
    document.getElementById('project-modal-branch-badge').innerText = `🏢 ${branch}`;

    const pReports = reportsData.filter(r => r.projectName === projectName || (r.isProjectReport && r.projectName.includes(projectName)));
    const latestReport = pReports.length > 0 ? pReports[0] : (globalRawReports.find(r => r.projectName === projectName) || null);

    const fmtMoney = (val, cur) => {
        if (!val || val === 0) return '-';
        return `${Number(val).toLocaleString('ar-EG')} ${cur || ''}`.trim();
    };

    const scheduleBadge = document.getElementById('project-modal-schedule-badge');
    const mapLinkBtn = document.getElementById('project-modal-map-link');

    if (!latestReport) {
        if (scheduleBadge) {
            scheduleBadge.className = 'detail-tag status delayed';
            scheduleBadge.innerText = 'لم يتم رفع تقرير بعد';
        }
        if (mapLinkBtn) mapLinkBtn.classList.add('hidden');

        document.getElementById('pm-val-usd').innerText = '-';
        document.getElementById('pm-val-local').innerText = 'لا توجد بيانات مرفوعة';
        document.getElementById('pm-progress-percent').innerText = '-';
        document.getElementById('pm-executed-work-label').innerText = 'حجم المنفذ: -';
        document.getElementById('pm-collected-liquidity').innerText = '-';
        document.getElementById('pm-advance-sub').innerText = 'الدفعة المقدمة: -';
        document.getElementById('pm-due-debt').innerText = '-';
        document.getElementById('pm-paid-sub').innerText = 'المسدد للمشروع: -';

        document.getElementById('pm-revised-val').innerText = '-';
        document.getElementById('pm-advance-val').innerText = '-';
        document.getElementById('pm-executed-approved').innerText = '-';
        document.getElementById('pm-materials-val').innerText = '-';
        document.getElementById('pm-executed-total').innerText = '-';
        document.getElementById('pm-paid-work').innerText = '-';
        document.getElementById('pm-lg-val').innerText = '-';
        document.getElementById('pm-retained-liquidity').innerText = '-';
        document.getElementById('pm-subcontractors-due').innerText = '-';
        document.getElementById('pm-profit-loss').innerText = '-';

        document.getElementById('pm-start-date').innerText = '-';
        document.getElementById('pm-handover-date').innerText = '-';
        document.getElementById('pm-drawings-date').innerText = '-';
        document.getElementById('pm-end-date').innerText = '-';
        document.getElementById('pm-revised-end-date').innerText = '-';
        document.getElementById('pm-expected-finish-date').innerText = '-';
        document.getElementById('pm-last-invoice-date').innerText = '-';
        document.getElementById('pm-last-collection-date').innerText = '-';

        document.getElementById('pm-schedule-status-txt').innerText = 'غير متوفر';
        document.getElementById('pm-ext-requested-txt').innerText = '-';
        document.getElementById('pm-ext-period-txt').innerText = '-';
        document.getElementById('pm-ext-approved-txt').innerText = '-';
        document.getElementById('pm-measurement-date-txt').innerText = '-';

        document.getElementById('pm-client-txt').innerText = '-';
        document.getElementById('pm-consultant-txt').innerText = '-';
        document.getElementById('pm-branch-txt').innerText = branch;
        document.getElementById('pm-country-txt').innerText = country;
        document.getElementById('pm-scope-txt').innerText = '-';
        document.getElementById('pm-contract-type-txt').innerText = '-';
        document.getElementById('pm-funding-txt').innerText = '-';
        document.getElementById('pm-currency-rate-txt').innerText = '-';

        document.getElementById('pm-obstacles-txt').innerText = 'لم يتم تسجيل تقرير تحديث لهذا المشروع خلال الفترة المحددة.';
        document.getElementById('pm-claims-status-txt').innerText = 'لا يوجد';
        document.getElementById('pm-claims-val-txt').innerText = '-';
        document.getElementById('pm-userstamp-txt').innerText = 'لم يُرفع بعد';
    } else {
        const cur = latestReport.currency || '';
        const isDelayed = latestReport.scheduleStatus && (latestReport.scheduleStatus.includes('متأخر') || latestReport.scheduleStatus.includes('خارج'));
        
        if (scheduleBadge) {
            scheduleBadge.className = `detail-tag status ${isDelayed ? 'delayed' : ''}`;
            scheduleBadge.innerText = latestReport.scheduleStatus || 'داخل المدة';
        }

        if (mapLinkBtn) {
            if (latestReport.mapsLink && latestReport.mapsLink.startsWith('http')) {
                mapLinkBtn.href = latestReport.mapsLink;
                mapLinkBtn.classList.remove('hidden');
            } else {
                mapLinkBtn.classList.add('hidden');
            }
        }

        document.getElementById('pm-val-usd').innerText = latestReport.valueUsd > 0 ? formatCurrencyUSD(latestReport.valueUsd) : 'غير مدخل';
        document.getElementById('pm-val-local').innerText = latestReport.contractValue > 0 ? fmtMoney(latestReport.contractValue, cur) : '-';
        document.getElementById('pm-progress-percent').innerText = latestReport.plannedProgressPercent > 0 ? `${latestReport.plannedProgressPercent}%` : '-';
        document.getElementById('pm-executed-work-label').innerText = latestReport.executedWorkApproved > 0 ? `المنفذ: ${fmtMoney(latestReport.executedWorkApproved, cur)}` : 'حجم المنفذ: -';
        
        document.getElementById('pm-collected-liquidity').innerText = latestReport.collectedLiquidity > 0 ? fmtMoney(latestReport.collectedLiquidity, cur) : '-';
        document.getElementById('pm-advance-sub').innerText = latestReport.advancePayment > 0 ? `الدفعة المقدمة: ${fmtMoney(latestReport.advancePayment, cur)}` : 'الدفعة المقدمة: -';
        
        document.getElementById('pm-due-debt').innerText = latestReport.dueDebt > 0 ? fmtMoney(latestReport.dueDebt, cur) : '-';
        document.getElementById('pm-paid-sub').innerText = latestReport.paidWork > 0 ? `المسدد: ${fmtMoney(latestReport.paidWork, cur)}` : 'المسدد: -';

        document.getElementById('pm-revised-val').innerText = fmtMoney(latestReport.revisedContractValue, cur);
        document.getElementById('pm-advance-val').innerText = fmtMoney(latestReport.advancePayment, cur);
        document.getElementById('pm-executed-approved').innerText = fmtMoney(latestReport.executedWorkApproved, cur);
        document.getElementById('pm-materials-val').innerText = fmtMoney(latestReport.approvedMaterials, cur);
        document.getElementById('pm-executed-total').innerText = fmtMoney(latestReport.executedWorkTotal, cur);
        document.getElementById('pm-paid-work').innerText = fmtMoney(latestReport.paidWork, cur);
        document.getElementById('pm-lg-val').innerText = fmtMoney(latestReport.lettersOfGuaranteeValue || latestReport.openLGTotal, cur);
        document.getElementById('pm-retained-liquidity').innerText = fmtMoney(latestReport.retainedLiquidity, cur);
        document.getElementById('pm-subcontractors-due').innerText = fmtMoney(latestReport.subcontractorsDue, cur);
        document.getElementById('pm-profit-loss').innerText = fmtMoney(latestReport.profitLoss, cur);

        document.getElementById('pm-start-date').innerText = latestReport.contractStartDate || '-';
        document.getElementById('pm-handover-date').innerText = latestReport.siteHandoverDate || '-';
        document.getElementById('pm-drawings-date').innerText = latestReport.drawingsDate || '-';
        document.getElementById('pm-end-date').innerText = latestReport.contractEndDate || '-';
        document.getElementById('pm-revised-end-date').innerText = latestReport.revisedEndDate || '-';
        document.getElementById('pm-expected-finish-date').innerText = latestReport.expectedFinishDate || '-';
        document.getElementById('pm-last-invoice-date').innerText = latestReport.lastInvoiceApprovalDate || '-';
        document.getElementById('pm-last-collection-date').innerText = latestReport.lastCollectionDate || '-';

        document.getElementById('pm-schedule-status-txt').innerText = latestReport.scheduleStatus || '-';
        document.getElementById('pm-ext-requested-txt').innerText = latestReport.extensionRequested || '-';
        document.getElementById('pm-ext-period-txt').innerText = latestReport.extensionPeriod || '-';
        document.getElementById('pm-ext-approved-txt').innerText = latestReport.extensionApprovedPeriod || '-';
        document.getElementById('pm-measurement-date-txt').innerText = latestReport.measurementDate || '-';

        document.getElementById('pm-client-txt').innerText = latestReport.clientName || '-';
        document.getElementById('pm-consultant-txt').innerText = latestReport.consultantName || '-';
        document.getElementById('pm-branch-txt').innerText = latestReport.branchName || branch;
        document.getElementById('pm-country-txt').innerText = latestReport.country || country;
        document.getElementById('pm-scope-txt').innerText = latestReport.scopeOfWork || '-';
        document.getElementById('pm-contract-type-txt').innerText = latestReport.contractType || '-';
        document.getElementById('pm-funding-txt').innerText = latestReport.fundingSource || '-';
        document.getElementById('pm-currency-rate-txt').innerText = `${cur || '-'} ${latestReport.exchangeRate > 0 ? `(سعر الصرف للدولار: ${latestReport.exchangeRate})` : ''}`.trim();

        document.getElementById('pm-obstacles-txt').innerText = latestReport.projectObstacles || 'لا توجد معوقات مسجلة حالياً.';
        document.getElementById('pm-claims-status-txt').innerText = latestReport.claimsStatus || 'لا يوجد';
        document.getElementById('pm-claims-val-txt').innerText = fmtMoney(latestReport.claimsValue, cur);

        const dObj = new Date(latestReport.timestamp);
        const dateStr = isNaN(dObj.getTime()) ? latestReport.timestamp : dObj.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
        document.getElementById('pm-userstamp-txt').innerText = `${latestReport.userstamp || '-'} (${dateStr})`;
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('show'), 10);

    if (executiveMap && typeof getProjectCoordinates === 'function') {
        const coords = getProjectCoordinates(projectName, branch, country, latestReport ? latestReport.mapsLink : null);
        executiveMap.flyTo([coords.lat, coords.lng], 8, { duration: 1.0 });
    }
}

function closeProjectDetailModal() {
    const modal = document.getElementById('project-detail-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

async function loadMapPageData() {
    try {
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.classList.remove('hidden');

        initExecutiveMap();

        const [reportsTable, ddTable] = await Promise.all([
            fetchSheetJSONP('master output database'),
            fetchSheetJSONP('dd_lst')
        ]);

        parseDropdownRegistry(ddTable);
        globalRawReports = parseGvizReports(reportsTable);
        reportsData = globalRawReports;

        renderGeoJsonBoundaries();
        updateMapMarkers();

        if (loader) loader.classList.add('hidden');
    } catch (err) {
        console.error("Error loading performance map data:", err);
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadMapPageData();
});
