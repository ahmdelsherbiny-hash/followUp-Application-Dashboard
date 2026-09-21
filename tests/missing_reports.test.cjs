const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const headers = ['BRANCH ID', 'PROJECT ID', 'PROJECT NAME'];
const row = values => ({ c: values.map(v => v === null ? null : { v }) });
const roster = rows => ({ cols: headers.map(label => ({ label })), rows: rows.map(row) });
const main = rows => ({ rows: rows.map(([id, name]) => row(['Entity', 'SA00', id, 'Saudi Arabia', null, name])) });

async function setup(t) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'performance_map.html'), 'utf8'), {
        runScripts: 'outside-only', url: 'https://map.test/'
    });
    t.after(() => dom.window.close());
    await new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    for (const file of ['geo_coords.js', 'missing_reports.js', 'performance_map.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), dom.getInternalVMContext(), { filename: file });
    }
    dom.window.initMissingReportsPanel();
    return dom.window;
}

test('project IDs determine missing reports across duplicates, renamed projects, and country aliases', async t => {
    const w = await setup(t);
    const projects = w.parseExpectedMapProjects(roster([
        ['SA00', 1001, 'Old name'], ['SA00', 1001, 'Updated name'],
        ['SA01', 1002, 'Same name'], ['SA00', 1003, 'Same name'],
        ['LB00', 1004, 'Complete Libya project'], ['UNKNOWN', 1005, 'Unmapped project'],
        ['SA00', null, 'No ID'], ['SA00', 1006, '']
    ]));
    const registry = new Map([
        ['SA00', { country: 'SAUDI ARABIA' }], ['SA01', { country: 'السعودية' }],
        ['LB00', { country: 'LIBYA' }]
    ]);
    const reports = main([[1001, 'Renamed report'], [1001, 'Older report'], [1002, 'Same name'], [1004, 'Complete'], [1005, '']]);
    reports.rows[0].c[2].f = '1,001';
    const groups = w.summarizeMissingMapReports(projects, reports, registry);
    assert.equal(projects.length, 5);
    assert.equal(projects.find(project => project.projectId === '1001').projectName, 'Updated name');
    const saudi = groups.find(group => group.countryName === 'المملكة العربية السعودية');
    assert.ok(saudi);
    assert.equal(saudi.total, 3);
    assert.deepEqual(Array.from(saudi.missing, project => project.projectId), ['1003']);
    assert.equal(groups.length, 2);
    const unknownCountry = groups.find(group => group.countryName === 'دولة غير محددة');
    assert.ok(unknownCountry);
    assert.equal(unknownCountry.missing[0].projectId, '1005');
});

test('sheet headers can be metadata or a first row, while wrong columns fail explicitly', async t => {
    const w = await setup(t);
    const table = roster([['SA00', 1001, 'Project']]);
    table.cols.forEach(column => { column.label = ''; });
    table.rows.unshift(row(headers));
    assert.equal(w.parseExpectedMapProjects(table).length, 1);
    table.rows.shift();
    assert.throws(() => w.parseExpectedMapProjects(table), /expected BRANCH ID/);
});

test('missing project names render as text and per-country denominators include received reports', async t => {
    const w = await setup(t);
    const name = '<img src=x onerror=alert(1)> مشروع';
    const projects = w.parseExpectedMapProjects(roster([['SA00', 1, name], ['SA00', 2, 'Received']]));
    const groups = w.summarizeMissingMapReports(projects, main([[2, 'Received']]), new Map([['SA00', { country: 'Saudi Arabia' }]]));
    w.renderMissingMapReports(projects, groups);
    const body = w.document.getElementById('missing-reports-body');
    assert.equal(body.querySelector('li').textContent, name);
    assert.equal(body.querySelector('img'), null);
    assert.match(body.textContent, /1 تقارير ناقصة من 2 مشروع/);
    assert.match(w.document.getElementById('missing-reports-summary').textContent, /1 تقرير ناقص من 2 مشروع/);
});

test('loading, no expected projects, all received, and failed source remain distinct', async t => {
    const w = await setup(t);
    const body = w.document.getElementById('missing-reports-body');
    const registry = new Map([['SA00', { country: 'Saudi Arabia' }]]);
    for (const scenario of [
        { table: roster([]), message: /لا توجد مشروعات في قائمة المصدر/ },
        { table: roster([['SA00', 1, 'Project']]), message: /كل المشروعات لها تقارير/ },
        { error: new Error('Network unavailable'), message: /تعذّر التحقق/ }
    ]) {
        let resolveRequest, rejectRequest;
        w.fetchSheetByGidJSONP = () => new Promise((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject; });
        const loading = w.loadMissingMapReports(main([[1, 'Project']]), registry);
        assert.equal(body.getAttribute('aria-busy'), 'true');
        assert.match(body.textContent, /جاري التحقق/);
        if (scenario.error) rejectRequest(scenario.error);
        else resolveRequest(scenario.table);
        await loading;
        assert.equal(body.getAttribute('aria-busy'), 'false');
        assert.match(body.textContent, scenario.message);
    }
});

test('both header triggers open the same panel, with keyboard and outside-click dismissal', async t => {
    const w = await setup(t);
    const panel = w.document.getElementById('missing-reports-panel');
    const close = w.document.getElementById('missing-reports-close');
    for (const trigger of w.document.querySelectorAll('[data-missing-reports-trigger]')) {
        trigger.click();
        assert.equal(panel.hidden, false);
        assert.equal(trigger.getAttribute('aria-expanded'), 'true');
        assert.equal(w.document.activeElement, close);
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(panel.hidden, true);
        assert.equal(w.document.activeElement, trigger);
        trigger.click();
        w.document.body.click();
        assert.equal(panel.hidden, true);
        trigger.click();
        close.click();
        assert.equal(panel.hidden, true);
        assert.equal(w.document.activeElement, trigger);
    }
});

test('panel positioning stays inside narrow, landscape, and desktop viewport bounds', async t => {
    const w = await setup(t);
    const trigger = w.document.querySelector('[data-missing-reports-trigger]');
    const panel = w.document.getElementById('missing-reports-panel');
    for (const [width, height] of [[320, 568], [390, 844], [667, 375], [1440, 900]]) {
        w.innerWidth = width;
        w.innerHeight = height;
        trigger.getBoundingClientRect = () => ({ right: width - 24, bottom: 92 });
        trigger.click();
        const left = parseFloat(panel.style.left);
        const top = parseFloat(panel.style.top);
        assert.ok(left >= 12);
        assert.ok(left + parseFloat(panel.style.width) <= width - 12);
        assert.ok(top + parseFloat(panel.style.maxHeight) <= height - 12);
        w.dispatchEvent(new w.Event('resize'));
        assert.equal(panel.hidden, true);
    }
});
