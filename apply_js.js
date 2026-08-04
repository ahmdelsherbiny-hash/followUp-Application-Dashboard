const fs = require('fs');
let js = fs.readFileSync('dashboard.js', 'utf-8');
js = js.replace(/const densityChart\s*=\s*document\.getElementById\('filter-density-chart'\);\s*const densityAxis\s*=\s*document\.getElementById\('filter-density-axis'\);/, '');
js = js.replace(/buildDensityChart\(\)/g, 'buildTimelineSlider()');
let match = js.match(/function buildDensityChart\(\)\s*\{[\s\S]*?\}\s*(?=\/\/ Apply Filter Button)/);

const sliderJS = unction buildTimelineSlider() {
    const sliderContainer = document.getElementById('timeline-slider');
    const fill = document.getElementById('timeline-fill');
    const thumbLeft = document.getElementById('timeline-thumb-left');
    const thumbRight = document.getElementById('timeline-thumb-right');
    const ticksContainer = document.getElementById('timeline-ticks');
    if (!sliderContainer || !fill || !thumbLeft || !thumbRight || !ticksContainer) return;

    function tryParseDate(str) {
        if (!str || String(str).trim() === '') return null;
        const s = String(str).trim();
        let d = parseSheetTimestamp(s);
        if (d && !isNaN(d.getTime())) return d;
        const n = parseFloat(s);
        if (!isNaN(n) && n > 30000) { d = new Date(Math.round((n - 25569) * 86400000)); if (!isNaN(d.getTime())) return d; }
        d = new Date(s); return (!isNaN(d.getTime())) ? d : null;
    }

    const uniqueDates = new Set();
    reportsData.forEach(r => { [r.measurementDate, r.bwDate].forEach(dateStr => { const d = tryParseDate(dateStr); if (d) { uniqueDates.add(\\\\\\-\\\-\\\\\\); } }); });

    const sortedKeys = Array.from(uniqueDates).sort();
    if (sortedKeys.length === 0) { sliderContainer.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px;">·«  ÊÃœ  Ê«—ÌŒ</div>'; return; }

    const minSpacing = 40;
    sliderContainer.style.minWidth = Math.max(400, sortedKeys.length * minSpacing) + 'px';

    ticksContainer.innerHTML = '';
    sortedKeys.forEach((k, i) => {
        const [y, m, d] = k.split('-');
        const tick = document.createElement('div'); tick.className = 'timeline-tick'; tick.style.left = \\\\\\%\\\; tick.textContent = \\\\\\/\\\\\\; ticksContainer.appendChild(tick);
    });

    let startI = 0; let endI = sortedKeys.length - 1;
    const fromVal = filterFromInput ? filterFromInput.value : ''; const toVal = filterToInput ? filterToInput.value : '';
    if (fromVal) { const fI = sortedKeys.findIndex(k => k >= fromVal); if (fI !== -1) startI = fI; }
    if (toVal) { let tI = sortedKeys.length - 1; for (let i = sortedKeys.length - 1; i >= 0; i--) { if (sortedKeys[i] <= toVal) { tI = i; break; } } endI = tI; }
    if (startI > endI) startI = endI;

    const maxI = sortedKeys.length - 1 || 1;
    const updateUI = () => { const p1 = (startI / maxI) * 100; const p2 = (endI / maxI) * 100; thumbLeft.style.left = \\\\\\%\\\; thumbRight.style.left = \\\\\\%\\\; fill.style.left = \\\\\\%\\\; fill.style.width = \\\\\\%\\\; };
    const finaliseRange = () => { if (filterFromInput) filterFromInput.value = sortedKeys[startI]; if (filterToInput) filterToInput.value = sortedKeys[endI]; syncActiveStatusAfterApply(); };

    let draggingThumb = null;
    const onDragStart = (e, type) => { if (e.type !== 'touchstart') e.preventDefault(); draggingThumb = type; };
    const onDragMove = (e) => {
        if (!draggingThumb) return;
        const rect = sliderContainer.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left; let pct = Math.max(0, Math.min(1, x / rect.width)); let i = Math.round(pct * maxI);
        if (draggingThumb === 'left') { if (i > endI) i = endI; startI = i; } else { if (i < startI) i = startI; endI = i; } updateUI();
    };
    const onDragEnd = () => { if (draggingThumb) { draggingThumb = null; finaliseRange(); } };

    if (sliderContainer._onDragMove) { document.removeEventListener('mousemove', sliderContainer._onDragMove); document.removeEventListener('mouseup', sliderContainer._onDragEnd); document.removeEventListener('touchmove', sliderContainer._onDragMove); document.removeEventListener('touchend', sliderContainer._onDragEnd); }
    sliderContainer._onDragMove = onDragMove; sliderContainer._onDragEnd = onDragEnd;
    const newThumbLeft = thumbLeft.cloneNode(true); thumbLeft.parentNode.replaceChild(newThumbLeft, thumbLeft); const newThumbRight = thumbRight.cloneNode(true); thumbRight.parentNode.replaceChild(newThumbRight, thumbRight);
    newThumbLeft.addEventListener('mousedown', e => onDragStart(e, 'left')); newThumbRight.addEventListener('mousedown', e => onDragStart(e, 'right'));
    newThumbLeft.addEventListener('touchstart', e => onDragStart(e, 'left'), {passive: true}); newThumbRight.addEventListener('touchstart', e => onDragStart(e, 'right'), {passive: true});
    document.addEventListener('mousemove', onDragMove); document.addEventListener('mouseup', onDragEnd); document.addEventListener('touchmove', onDragMove, {passive: true}); document.addEventListener('touchend', onDragEnd);
    updateUI();
};

if (match) { js = js.replace(match[0], sliderJS + '\n    '); fs.writeFileSync('dashboard.js', js, 'utf-8'); console.log('Success'); } else { console.log('Failed to find buildDensityChart block'); }
