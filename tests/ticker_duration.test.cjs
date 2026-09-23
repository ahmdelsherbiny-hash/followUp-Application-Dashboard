const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mapContext() {
    const context = vm.createContext({
        window: {},
        document: { addEventListener() {} },
        console
    });
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '..', 'performance_map.js'), 'utf8'),
        context,
        { filename: 'performance_map.js' }
    );
    vm.runInContext("evaluateCountryEarlyWarning = () => ({ score: 75, color: '#10b981' })", context);
    return context;
}

function evaluate(context, expression) {
    return JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
}

test('AA and AB map to approved and elapsed project days', () => {
    const context = mapContext();
    context.row = { c: Array.from({ length: 29 }, () => null) };
    context.row.c[26] = { v: 100 };
    context.row.c[27] = { v: 90 };
    const fields = evaluate(context, 'mainScheduleFields(row)');
    assert.equal(fields.totalDurationDays, 100);
    assert.equal(fields.elapsedDays, 90);
});

test('country duration percentage divides summed elapsed days by summed approved days', () => {
    const context = mapContext();
    context.group = {
        countryName: 'دولة ألف',
        isoCode: 'AA',
        flagClass: 'fi-aa',
        reports: [
            { elapsedDays: 90, totalDurationDays: 100, executionProgressPercent: 20 },
            { elapsedDays: 10, totalDurationDays: 900, executionProgressPercent: 40 }
        ]
    };
    const country = evaluate(context, 'summarizeCountryTickerGroup(group)');
    assert.equal(country.timeElapsedAggregatePercent, 10);
    assert.equal(country.progressAverage, 30);
    assert.match(evaluate(context, 'generateCountryTickerItemHtml(summarizeCountryTickerGroup(group), 1)'),
        /اجملي نسب انقضاء المدد الزمنيه[\s\S]*?10\.0%/);
});

test('the new criterion sorts by aggregate duration, with unavailable ratios last', () => {
    const context = mapContext();
    context.countries = [
        { countryName: 'ألف', timeElapsedAggregatePercent: 10 },
        { countryName: 'باء', timeElapsedAggregatePercent: 30 },
        { countryName: 'جيم', timeElapsedAggregatePercent: null }
    ];
    assert.deepEqual(evaluate(context,
        "sortCountryTickerItems(countries, 'timeElapsedAggregatePercent', 'desc').map(country => country.countryName)"),
        ['باء', 'ألف', 'جيم']);
    assert.deepEqual(evaluate(context,
        "sortCountryTickerItems(countries, 'timeElapsedAggregatePercent', 'asc').map(country => country.countryName)"),
        ['ألف', 'باء', 'جيم']);
    context.group = {
        countryName: 'جيم', isoCode: 'CC', flagClass: 'fi-cc',
        reports: [{ elapsedDays: 3, totalDurationDays: 0, executionProgressPercent: 0 }]
    };
    const country = evaluate(context, 'summarizeCountryTickerGroup(group)');
    assert.equal(country.timeElapsedAggregatePercent, null);
    assert.match(evaluate(context, 'generateCountryTickerItemHtml(summarizeCountryTickerGroup(group), 1)'),
        /اجملي نسب انقضاء المدد الزمنيه[\s\S]*?<bdi dir="ltr">—<\/bdi>/);
});

test('ticker controls expose the new criterion', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'performance_map.html'), 'utf8');
    assert.match(html, /data-ticker-criterion="timeElapsedAggregatePercent"/);
});
