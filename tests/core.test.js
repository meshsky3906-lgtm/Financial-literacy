// 執行:TZ=Asia/Taipei node --test tests/   (或 npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const mkState = () => ({
  accounts: [
    { id: 'acc_bank_main', name: '主要活存', type: 'liquid', balance: 100000 },
    { id: 'card_a', name: 'A卡', type: 'credit', creditLimit: 60000, safeLimit: 18000, balance: 10000 },
    { id: 'card_b', name: 'B卡', type: 'credit', creditLimit: 60000, safeLimit: 18000, balance: 5000 },
    { id: 'acc_emergency', type: 'emergency', balance: 90000 },
    { id: 'acc_invest', type: 'investment', balance: 50000 }
  ],
  transactions: [],
  debts: [{ id: 'd1', name: '學貸', category: 'student', totalAmount: 300000, remaining: 100000, monthlyPayment: 6500 }]
});

test('日期:本地時間而非 UTC(台灣凌晨不會變前一天)', () => {
  const d = new Date(2026, 9, 1, 0, 30); // 本地 10/1 00:30
  assert.equal(C.getLocalDateString(d), '2026-10-01');
  assert.equal(C.getLocalMonthString(d), '2026-10');
  assert.equal(C.getCurrentMonthKey(d), '2026-10');
});

test('50/30/20:只計真實收支,轉帳不算', () => {
  const tx = [
    { type: 'income', amount: 60000, date: '2026-10-01' },
    { type: 'expense', amount: 20000, tag: 'need', date: '2026-10-02' },
    { type: 'expense', amount: 6000, tag: 'want', date: '2026-10-03' },
    { type: 'expense', amount: 4000, tag: 'invest', date: '2026-10-04' },
    { type: 'transfer', amount: 15000, date: '2026-10-05' },
    { type: 'expense', amount: 9999, tag: 'need', date: '2026-09-30' }
  ];
  const r = C.calculate503020(tx, '2026-10');
  assert.equal(r.totalIncome, 60000);
  assert.equal(r.totalExpense, 30000);
  assert.equal(r.need.amount, 20000);
  assert.equal(r.want.amount, 6000);
  assert.equal(r.invest.amount, 4000);
  assert.equal(r.netSavings, 30000);
  assert.ok(Math.abs(r.need.percent - 33.333) < 0.01); // 方案 A:分母為收入 60000
});

test('50/30/20:無資料不會除以零', () => {
  const r = C.calculate503020([], '2026-10');
  assert.equal(r.need.percent, 0);
  assert.equal(r.savingsRate, 0);
});

test('信用卡風控:安全 / 警戒 / 超標', () => {
  const card = b => ({ id: 'c', type: 'credit', creditLimit: 60000, safeLimit: 18000, balance: b });
  assert.equal(C.calculateCreditCardHealth(card(5000)).statusLevel, 'safe');
  assert.equal(C.calculateCreditCardHealth(card(14400)).statusLevel, 'warning');
  assert.equal(C.calculateCreditCardHealth(card(18001)).statusLevel, 'danger');
  assert.equal(C.calculateCreditCardHealth(card(-500)).currentUnpaid, 0);
  assert.equal(C.calculateCreditCardHealth({ type: 'liquid' }), null);
});

test('真實可用現金 = 活存 − 各卡待繳', () => {
  const r = C.calculateRealAvailableBalance(mkState().accounts);
  assert.equal(r.liquidAssets, 100000);
  assert.equal(r.totalCreditDebt, 15000);
  assert.equal(r.realAvailable, 85000);
});

test('緊急預備金等級', () => {
  assert.equal(C.calculateEmergencyFundHealth(0).badgeColor, '#94A3B8');
  assert.match(C.calculateEmergencyFundHealth(180000, 30000).healthText, /黃金/);
  assert.match(C.calculateEmergencyFundHealth(90000, 30000).healthText, /基礎/);
  assert.match(C.calculateEmergencyFundHealth(30000, 30000).healthText, /初步/);
  assert.match(C.calculateEmergencyFundHealth(10000, 30000).healthText, /不足/);
  assert.equal(C.calculateEmergencyFundHealth(999999, 30000).progressTo6Months, 100);
});

test('週期報表:月 / 季 / 年', () => {
  const tx = [
    { type: 'income', amount: 1000, date: '2026-01-05' },
    { type: 'expense', amount: 300, tag: 'need', date: '2026-02-05', categoryName: 'x' },
    { type: 'expense', amount: 200, tag: 'want', date: '2026-04-05', categoryName: 'y' }
  ];
  assert.equal(C.generatePeriodReport(tx, 'month', '2026-02').totalExpense, 300);
  assert.equal(C.generatePeriodReport(tx, 'quarter', '2026-Q1').totalIncome, 1000);
  assert.equal(C.generatePeriodReport(tx, 'quarter', '2026-Q1').totalExpense, 300);
  assert.equal(C.generatePeriodReport(tx, 'year', '2026').totalExpense, 500);
});

test('債務還款:扣債務、扣活存、記支出', () => {
  const s = mkState();
  const tx = C.applyDebtPayment(s, 'd1', null, new Date(2026, 9, 10, 1, 0));
  assert.equal(s.debts[0].remaining, 93500);
  assert.equal(s.accounts[0].balance, 93500);
  assert.equal(tx.date, '2026-10-10');
  assert.equal(tx.debtApplied, 6500);
  assert.equal(s.transactions.length, 1);
});

test('債務還款超過剩餘:剩餘歸零,debtApplied 只算實際沖銷', () => {
  const s = mkState();
  s.debts[0].remaining = 2000;
  const tx = C.applyDebtPayment(s, 'd1', null);
  assert.equal(s.debts[0].remaining, 0);
  assert.equal(s.debts[0].isPaid, true);
  assert.equal(tx.debtApplied, 2000);
});

test('第 4 點:刪除債務還款 → 債務剩餘與活存都回復', () => {
  const s = mkState();
  const tx = C.applyDebtPayment(s, 'd1', 6500);
  C.deleteTransactionFromState(s, tx.id);
  assert.equal(s.debts[0].remaining, 100000);
  assert.equal(s.accounts[0].balance, 100000);
  assert.equal(s.transactions.length, 0);
});

test('刪除已還清的最後一期 → 回復並取消 isPaid', () => {
  const s = mkState();
  s.debts[0].remaining = 2000;
  const tx = C.applyDebtPayment(s, 'd1', null);
  C.deleteTransactionFromState(s, tx.id);
  assert.equal(s.debts[0].remaining, 2000);
  assert.equal(s.debts[0].isPaid, false);
});

test('舊資料(無 debtApplied)刪除:退而使用 amount,不需遷移', () => {
  const s = mkState();
  s.transactions.push({ id: 'old', type: 'expense', amount: 6500, accountId: 'acc_bank_main', debtId: 'd1' });
  C.deleteTransactionFromState(s, 'old');
  assert.equal(s.debts[0].remaining, 106500);
});

test('刪除刷卡支出 → 待繳回退;刪除繳卡費轉帳 → 待繳加回', () => {
  const s = mkState();
  s.transactions.push({ id: 'e1', type: 'expense', amount: 3000, accountId: 'card_a' });
  C.deleteTransactionFromState(s, 'e1');
  assert.equal(s.accounts[1].balance, 7000);

  s.transactions.push({ id: 't1', type: 'transfer', amount: 4000, accountId: 'acc_bank_main', toAccountId: 'card_b' });
  C.deleteTransactionFromState(s, 't1');
  assert.equal(s.accounts[0].balance, 104000);
  assert.equal(s.accounts[2].balance, 9000);
});

test('刪除不存在的交易回傳 null', () => {
  assert.equal(C.deleteTransactionFromState(mkState(), 'nope'), null);
});

test('第 3 點(方案 A):50/30/20 比例以當月收入為分母', () => {
  const tx = [
    { type: 'income', amount: 60000, date: '2026-10-01' },
    { type: 'expense', amount: 20000, tag: 'need', date: '2026-10-02' },
    { type: 'expense', amount: 6000, tag: 'want', date: '2026-10-03' },
    { type: 'expense', amount: 4000, tag: 'invest', date: '2026-10-04' }
  ];
  const r = C.calculate503020(tx, '2026-10');
  assert.equal(r.ratioBasis, 'income');
  assert.ok(Math.abs(r.need.percent - 33.333) < 0.01);
  assert.equal(r.want.percent, 10);
  assert.ok(Math.abs(r.invest.percent - 6.667) < 0.01);
  assert.equal(r.savingsRate, 50);
  const rep = C.generatePeriodReport(tx, 'month', '2026-10');
  assert.ok(Math.abs(rep.needPercent - 33.333) < 0.01);
});

test('第 3 點:當月無收入時退而以總支出為分母', () => {
  const r = C.calculate503020([{ type: 'expense', amount: 1000, tag: 'need', date: '2026-10-02' }], '2026-10');
  assert.equal(r.ratioBasis, 'expense');
  assert.equal(r.need.percent, 100);
});

// ===== 每月投入建議 =====
const NOW = new Date(2026, 9, 10, 12, 0); // 2026-10-10
function investState(over = {}) {
  const tx = [];
  ['2026-07', '2026-08', '2026-09'].forEach((m, i) => {
    tx.push({ id: 'n' + i, type: 'expense', amount: 20000, tag: 'need', date: m + '-05' });
    tx.push({ id: 'w' + i, type: 'expense', amount: 7000, tag: 'want', date: m + '-06' });
    tx.push({ id: 'v' + i, type: 'expense', amount: 3000, tag: 'invest', date: m + '-07' });
  });
  tx.push({ id: 'in', type: 'income', amount: 80000, date: '2026-10-01' });
  tx.push({ id: 'ex', type: 'expense', amount: 30000, tag: 'need', date: '2026-10-02' });
  return {
    accounts: [
      { id: 'main', type: 'liquid', balance: over.liquid ?? 200000 },
      { id: 'c1', type: 'credit', balance: 20000, monthlyDue: over.monthlyDue },
      { id: 'em', type: 'emergency', balance: over.emergency ?? 200000 }
    ],
    transactions: tx
  };
}

test('投入建議:預備金已達標 → 取收支結餘,依 60/15/25 拆分且總和相符', () => {
  const r = C.calculateInvestmentPlan(investState(), null, NOW);
  assert.equal(r.avgExpense, 27000);        // 排除 invest 標籤
  assert.equal(r.reserveTarget, 162000);
  assert.equal(r.reserveShortfall, 0);
  assert.equal(r.cashFlow, 50000);
  assert.equal(r.buffer, 20000);            // 1 個月平均必要支出
  assert.equal(r.usableCash, 160000);       // 200000 − 20000(整筆待繳) − 20000
  assert.equal(r.recommended, 50000);
  assert.deepEqual(r.allocation.map(x => x.amount), [30000, 7500, 12500]);
  assert.equal(r.allocation.reduce((a, x) => a + x.amount, 0), 50000);
});

test('投入建議:預備金不足 → 優先補足,剩餘不夠就暫停並說明原因', () => {
  const r = C.calculateInvestmentPlan(investState({ emergency: 100000 }), null, NOW);
  assert.equal(r.reserveShortfall, 62000);
  assert.equal(r.canInvest, false);
  assert.equal(r.recommended, 0);
  assert.ok(r.reasons.some(x => x.includes('預備金')));
});

test('投入建議:每月補足上限 → 補一部分、其餘可投入', () => {
  const r = C.calculateInvestmentPlan(investState({ emergency: 100000 }), { monthlyFillCap: 10000 }, NOW);
  assert.equal(r.reserveFill, 10000);
  assert.equal(r.reserveCapped, true);
  assert.equal(r.recommended, 40000);
});

test('投入建議:卡片填「每月固定應繳」→ 現金保留改用該數字', () => {
  const r = C.calculateInvestmentPlan(investState({ monthlyDue: 5000 }), null, NOW);
  assert.equal(r.cardReserve, 5000);
  assert.equal(r.usableCash, 175000);
});

test('投入建議:活存不足 → 以可動用現金為限並暫停', () => {
  const r = C.calculateInvestmentPlan(investState({ liquid: 30000 }), null, NOW);
  assert.equal(r.usableCash, -10000);
  assert.equal(r.bindingLimit, 'usableCash');
  assert.equal(r.canInvest, false);
  assert.ok(r.reasons.some(x => x.includes('可動用現金')));
});

test('投入建議:收入不足以支應支出 → 暫停', () => {
  const s = investState();
  s.transactions = s.transactions.filter(t => t.id !== 'in');
  const r = C.calculateInvestmentPlan(s, null, NOW);
  assert.equal(r.canInvest, false);
  assert.ok(r.reasons.some(x => x.includes('收支結餘')));
});

test('投入建議:資料不足 N 個月 / 完全沒資料不會出錯', () => {
  const s = investState();
  s.transactions = s.transactions.filter(t => !t.date.startsWith('2026-07') && !t.date.startsWith('2026-08'));
  const r = C.calculateInvestmentPlan(s, null, NOW);
  assert.equal(r.avgMonthsUsed, 1);
  const empty = C.calculateInvestmentPlan({ accounts: [], transactions: [] }, null, NOW);
  assert.equal(empty.avgBasis, 'none');
  assert.equal(empty.canInvest, false);
  assert.equal(empty.trend.length, 12);
});

test('投入建議:走勢為近 12 個月、含本月;比例加總非 100% 不拆分;唯讀不改資料', () => {
  const s = investState();
  const before = JSON.stringify(s);
  const r = C.calculateInvestmentPlan(s, { allocation: [{ symbol: 'A', percent: 50 }] }, NOW);
  assert.equal(r.trend[11].monthKey, '2026-10');
  assert.equal(r.trend[0].monthKey, '2025-11');
  assert.equal(r.allocation[0].amount, 0);
  assert.equal(JSON.stringify(s), before);
});
