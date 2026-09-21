const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

async function setup(t) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'performance_map.html'), 'utf8'), {
        runScripts: 'outside-only',
        url: 'https://map.test/'
    });
    t.after(() => dom.window.close());
    await new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    vm.runInContext(
        fs.readFileSync(path.join(root, 'performance_map.js'), 'utf8'),
        dom.getInternalVMContext(),
        { filename: 'performance_map.js' }
    );
    dom.window.initMapDataDisclaimer();
    return { dom, window: dom.window };
}

test('header and disclaimer share the same latest report date and fallback', async t => {
    const { dom, window } = await setup(t);
    const context = dom.getInternalVMContext();
    vm.runInContext("reportsData = [{ timestamp: '2026-09-10T12:00:00Z' }, { timestamp: '2026-09-15T12:00:00Z' }]", context);
    window.updateHeaderLastDataDate();

    const dateElements = [
        window.document.getElementById('header-last-update-date'),
        ...window.document.querySelectorAll('.header-last-update-date-ref'),
        window.document.getElementById('map-data-disclaimer-date')
    ];
    assert.deepEqual(dateElements.map(element => element.textContent), ['15/09/2026', '15/09/2026', '15/09/2026']);
    assert.deepEqual(dateElements.map(element => element.getAttribute('datetime')), ['2026-09-15', '2026-09-15', '2026-09-15']);

    vm.runInContext('reportsData = []', context);
    window.updateHeaderLastDataDate();
    assert.deepEqual(dateElements.map(element => element.textContent), ['--', '--', '--']);
    assert.ok(dateElements.every(element => !element.hasAttribute('datetime')));
});

test('disclaimer stays visible until close button or Escape dismissal', async t => {
    const { window } = await setup(t);
    const backdrop = window.document.getElementById('map-data-disclaimer-backdrop');
    const closeButton = window.document.getElementById('map-data-disclaimer-close');

    assert.equal(backdrop.hidden, true);
    window.openMapDataDisclaimer();
    assert.equal(backdrop.hidden, false);
    assert.equal(window.document.activeElement, closeButton);

    backdrop.click();
    assert.equal(backdrop.hidden, false);
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    assert.equal(window.document.activeElement, closeButton);
    closeButton.click();
    assert.equal(backdrop.hidden, true);

    window.openMapDataDisclaimer();
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(backdrop.hidden, true);
});

test('disclaimer contains the requested message and dialog semantics', async t => {
    const { window } = await setup(t);
    const dialog = window.document.getElementById('map-data-disclaimer');
    const text = window.document.getElementById('map-data-disclaimer-text').textContent.replace(/\s+/g, ' ').trim();

    assert.equal(dialog.getAttribute('role'), 'dialog');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    const followupLineStyle = window.getComputedStyle(window.document.querySelector('.map-data-disclaimer-followup'));
    assert.equal(followupLineStyle.display, 'block');
    assert.equal(followupLineStyle.whiteSpace, 'nowrap');
    assert.equal(followupLineStyle.maxWidth, '100%');
    assert.match(text, /البيانات المعروضه في الموقع محدثه حتى تاريخ/);
    assert.match(text, /وفقا لبرامج المتابعة مع الفروع و الشركات الخارجية/);
});
