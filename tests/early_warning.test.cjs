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
    return context;
}

function evaluate(context, expression) {
    return JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
}

test('new map data source02 maps all twelve answers in sheet order', () => {
    const context = mapContext();
    const values = ['1057', '2026-07-31', 'Project', ...Array.from({ length: 12 }, (_, index) => `answer-${index + 1}`)];
    context.testRow = { c: values.map(value => ({ v: value })) };
    context.table = { cols: values.map(() => ({})), rows: [context.testRow] };
    assert.doesNotThrow(() => vm.runInContext("validateGvizTable(table, 15, 'Early Alert')", context));
    context.table.cols.pop();
    assert.throws(() => vm.runInContext("validateGvizTable(table, 15, 'Early Alert')", context), /schema mismatch/);
    assert.deepEqual(evaluate(context, 'earlyAlertAnswers(testRow)'), {
        claimsStatus: 'answer-1',
        hasBillOfQuantities: 'answer-2',
        boqAccuracy: 'answer-3',
        advancePaymentReceived: 'answer-4',
        lgIssued: 'answer-5',
        meetingClient15Days: 'answer-6',
        formalLetterSent: 'answer-7',
        supplySchedulePrepared: 'answer-8',
        mepApproved: 'answer-9',
        cashFlowPlanPrepared: 'answer-10',
        negativeCashFlow: 'answer-11',
        subcontractorsDueAnswer: 'answer-12',
        subcontractorsDue: 0
    });
});

test('base matrix has twelve questions and sums to 100', () => {
    const context = mapContext();
    context.report = {
        claimsStatus: 'لا يوجد', hasBillOfQuantities: 'نعم', boqAccuracy: 'دقيقة للغاية',
        advancePaymentReceived: 'نعم', lgIssued: 'نعم', meetingClient15Days: 'نعم',
        formalLetterSent: 'نعم', supplySchedulePrepared: 'نعم', mepApproved: 'نعم',
        cashFlowPlanPrepared: 'نعم', negativeCashFlow: 'لا',
        subcontractorsDueAnswer: '0', subcontractorsDue: 0
    };
    assert.deepEqual(evaluate(context, 'evaluateEarlyWarningQuestions(report).map(q => q.maxPoints)'),
        [12, 5, 6, 6, 5, 5, 5, 10, 12, 12, 12, 10]);
    assert.equal(evaluate(context, 'evaluateProjectEarlyWarning(report).score'), 100);
});

test('Q4 yes awards Q5 full points despite its answer', () => {
    const context = mapContext();
    context.report = { advancePaymentReceived: 'نعم', lgIssued: 'لا', cashFlowPlanPrepared: 'نعم' };
    assert.equal(evaluate(context, 'evaluateEarlyWarningQuestions(report)[4].points'), 5);
    context.report.cashFlowPlanPrepared = 'لا';
    assert.equal(evaluate(context, 'evaluateEarlyWarningQuestions(report)[4].points'), 6);
    context.report.advancePaymentReceived = 'لا';
    assert.equal(evaluate(context, 'evaluateEarlyWarningQuestions(report)[4].points'), 0);
});

test('Q10 no deactivates Q11 and applies the supplied revised weights', () => {
    const context = mapContext();
    context.report = { cashFlowPlanPrepared: 'لا', negativeCashFlow: 'لا' };
    const questions = evaluate(context, 'evaluateEarlyWarningQuestions(report)');
    assert.deepEqual(questions.map(q => q.maxPoints), [12, 6, 7, 7, 6, 6, 6, 12, 13, 13, 0, 12]);
    assert.equal(questions[10].isDeactivated, true);
    assert.equal(questions[10].points, 0);
    context.report.cashFlowPlanPrepared = '';
    assert.equal(evaluate(context, 'evaluateEarlyWarningQuestions(report)[10].maxPoints'), 12);
});
