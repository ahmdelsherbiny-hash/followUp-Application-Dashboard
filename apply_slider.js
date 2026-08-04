const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf-8');
const sliderCSS = \
.timeline-slider-wrapper { width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 20px; }
.timeline-slider-container { position: relative; height: 60px; margin-top: 10px; }
.timeline-track { position: absolute; top: 25px; left: 0; right: 0; height: 6px; background: var(--surface-hover); border-radius: 4px; }
.timeline-fill { position: absolute; top: 25px; height: 6px; background: var(--theme-accent); border-radius: 4px; opacity: 0.6; }
.timeline-thumb { position: absolute; top: 18px; width: 20px; height: 20px; background: var(--theme-accent); border: 2px solid white; border-radius: 50%; cursor: grab; transform: translateX(-50%); z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.timeline-thumb:active { cursor: grabbing; }
.timeline-ticks { position: absolute; top: 40px; left: 0; right: 0; height: 20px; }
.timeline-tick { position: absolute; transform: translateX(-50%); text-align: center; font-size: 11px; color: var(--text-muted); }
\;
if (!css.includes('.timeline-slider-wrapper')) fs.writeFileSync('style.css', css + sliderCSS, 'utf-8');

let html = fs.readFileSync('index.html', 'utf-8');
const densityHTML = '<div class="filter-density-label">\\r\\n                        <i class="fa-solid fa-chart-column"></i>\\r\\n                        <span> Ê“Ì⁄ «· Ê«—ÌŒ (⁄„Êœ J Ê BW) ó «”Õ» ⁄»— «·√⁄„œ… · ÕœÌœ ‰ÿ«ﬁﬂ «·“„‰Ì</span>\\r\\n                    </div>\\r\\n                    <div class="filter-density-scroll-wrapper">\\r\\n                        <div class="filter-density-chart" id="filter-density-chart">\\r\\n                            <!-- Bars injected by JS -->\\r\\n                        </div>\\r\\n                        <div class="filter-density-axis" id="filter-density-axis">\\r\\n                            <!-- Date labels injected by JS -->\\r\\n                        </div>\\r\\n                    </div>';
const densityHTMLUnix = densityHTML.replace(/\\r\\n/g, '\\n');
const sliderHTML = \
<div class="filter-density-label">
    <i class="fa-solid fa-timeline"></i>
    <span>«”Õ» «·„ƒ‘—Ì‰ · ÕœÌœ «·‰ÿ«ﬁ «·“„‰Ì ( Ê«—ÌŒ «·√⁄„œ… J Ê BW)</span>
</div>
<div class="timeline-slider-wrapper">
    <div class="timeline-slider-container" id="timeline-slider">
        <div class="timeline-track"></div>
        <div class="timeline-fill" id="timeline-fill"></div>
        <div class="timeline-thumb" id="timeline-thumb-left" style="left: 0%;"></div>
        <div class="timeline-thumb" id="timeline-thumb-right" style="left: 100%;"></div>
        <div class="timeline-ticks" id="timeline-ticks"></div>
    </div>
</div>\;
html = html.replace(densityHTML, sliderHTML).replace(densityHTMLUnix, sliderHTML);
html = html.replace('dashboard.js?v=1.10', 'dashboard.js?v=1.11').replace('style.css?v=1.6', 'style.css?v=1.7');
fs.writeFileSync('index.html', html, 'utf-8');

let js = fs.readFileSync('dashboard.js', 'utf-8');
js = js.replace(/const densityChart\\s*=\\s*document\\.getElementById\\('filter-density-chart'\\);\\s*const densityAxis\\s*=\\s*document\\.getElementById\\('filter-density-axis'\\);/, '');
js = js.replace(/buildDensityChart\\(\\)/g, 'buildTimelineSlider()');
let match = js.match(/function buildDensityChart\\(\\)\\s*\\{[\\s\\S]*?\\}\\s*(?=\\/\\/ Apply Filter Button)/);

const sliderJS = \unction buildTimelineSlider() {
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
}\;

if (match) { js = js.replace(match[0], sliderJS + '\\n    '); fs.writeFileSync('dashboard.js', js, 'utf-8'); console.log('Success'); } else { console.log('Failed to find buildDensityChart block'); }
