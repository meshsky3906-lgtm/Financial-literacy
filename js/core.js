/**
 * FinFlow 智富記帳 — 核心計算(core.js)
 * --------------------------------------------------------------------------
 * 只放「純計算」:不碰 DOM、不碰 localStorage,輸入進、結果出,因此可以用 Node 自動化測試。
 * 以一般 <script> 載入(非 ES 模組),所以雙擊 index.html 以 file:/// 開啟仍可運作。
 * 瀏覽器端掛在 window.FinFlowCore;Node 端以 module.exports 匯出。
 */
(function (root) {
  'use strict';

  // ===== 日期工具:一律使用「本地時間」 =====
  // 不可用 new Date().toISOString().split('T')[0]:它以 UTC 計算,
  // 台灣(UTC+8)凌晨 0–8 點會變成前一天,月底月初還會記到錯的月份。
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getLocalDateString(date) {
    const d = date ? new Date(date) : new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function getLocalMonthString(date) {
    return getLocalDateString(date).slice(0, 7);
  }


  // ===== 月份鍵(本地時間) =====
  function getCurrentMonthKey(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // ===== 財商計算演算法 =====
  function formatCurrency(amount, prefix = 'NT$ ') {
    const num = Math.round(Number(amount) || 0);
    return `${prefix}${num.toLocaleString()}`;
  }

  function calculate503020(transactions = [], monthKey = getCurrentMonthKey()) {
    const monthlyTx = (transactions || []).filter(tx => tx && tx.date && tx.date.startsWith(monthKey));
    let totalIncome = 0, totalExpense = 0, needExpense = 0, wantExpense = 0, investExpense = 0;

    monthlyTx.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'income') {
        totalIncome += amt;
      } else if (tx.type === 'expense') {
        totalExpense += amt;
        if (tx.tag === 'need') needExpense += amt;
        else if (tx.tag === 'want') wantExpense += amt;
        else if (tx.tag === 'invest') investExpense += amt;
      }
    });

    const needPercent = totalExpense > 0 ? (needExpense / totalExpense) * 100 : 0;
    const wantPercent = totalExpense > 0 ? (wantExpense / totalExpense) * 100 : 0;
    const investPercent = totalExpense > 0 ? (investExpense / totalExpense) * 100 : 0;
    const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100) : 0;

    const diagnostics = [];
    if (totalExpense > 0) {
      if (wantPercent > 35) {
        diagnostics.push({
          type: 'warning',
          title: '慾望支出偏高預警',
          message: `本月彈性慾望佔總支出 ${wantPercent.toFixed(1)}%（建議控制在 30% 以內），適度延遲非必要享樂能加速累積本金。`
        });
      }
      if (investExpense === 0 && totalIncome > 0) {
        diagnostics.push({
          type: 'caution',
          title: '尚未啟動資產投資',
          message: '本月尚未規劃自我成長或指數化投資，記得落實「先支付給未來的自己」法則！'
        });
      } else if (investPercent >= 20) {
        diagnostics.push({
          type: 'success',
          title: '投資儲蓄達標',
          message: `本月投資與儲蓄佔比達 ${investPercent.toFixed(1)}%，表現優異！持續保持複利滾動。`
        });
      }
    }

    return {
      monthKey,
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      savingsRate,
      need: { amount: needExpense, percent: needPercent },
      want: { amount: wantExpense, percent: wantPercent },
      invest: { amount: investExpense, percent: investPercent },
      diagnostics
    };
  }

  // 週期財務報表演算法 (月報表 / 季報表 / 年報表)
  function generatePeriodReport(transactions = [], periodType = 'month', periodKey = '') {
    let periodTitle = '';
    let filteredTx = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    if (periodType === 'month') {
      const key = periodKey || getCurrentMonthKey();
      const parts = key.split('-');
      const y = parts[0] || currentYear;
      const m = parts[1] || '01';
      periodTitle = `${y} 年 ${m} 月財務報表`;
      filteredTx = (transactions || []).filter(t => t && t.date && t.date.startsWith(key));
    } else if (periodType === 'quarter') {
      const qKey = periodKey || `${currentYear}-Q${Math.floor(now.getMonth() / 3) + 1}`;
      const parts = qKey.split('-');
      const y = parts[0] || currentYear;
      const qStr = parts[1] || 'Q1';
      const qNum = parseInt(qStr.replace('Q', ''), 10) || 1;
      periodTitle = `${y} 年 第 ${qNum} 季報表`;
      const startMonth = (qNum - 1) * 3 + 1;
      const qMonths = [
        `${y}-${String(startMonth).padStart(2, '0')}`,
        `${y}-${String(startMonth + 1).padStart(2, '0')}`,
        `${y}-${String(startMonth + 2).padStart(2, '0')}`
      ];
      filteredTx = (transactions || []).filter(t => t && t.date && qMonths.some(m => t.date.startsWith(m)));
    } else if (periodType === 'year') {
      const yKey = periodKey || String(currentYear);
      periodTitle = `${yKey} 年度財務總報表`;
      filteredTx = (transactions || []).filter(t => t && t.date && t.date.startsWith(yKey));
    }

    let totalIncome = 0, totalExpense = 0, needExpense = 0, wantExpense = 0, investExpense = 0;
    let esunSpent = 0, fubonSpent = 0;
    const categoryMap = {};

    filteredTx.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'income') {
        totalIncome += amt;
      } else if (tx.type === 'expense') {
        totalExpense += amt;
        if (tx.tag === 'need') needExpense += amt;
        else if (tx.tag === 'want') wantExpense += amt;
        else if (tx.tag === 'invest') investExpense += amt;

        if (tx.accountId === 'card_esun') esunSpent += amt;
        if (tx.accountId === 'card_fubon') fubonSpent += amt;

        const catName = tx.categoryName || '其他';
        const catIcon = tx.categoryIcon || '💸';
        if (!categoryMap[catName]) categoryMap[catName] = { name: catName, icon: catIcon, amount: 0, tag: tx.tag };
        categoryMap[catName].amount += amt;
      }
    });

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;
    const needPercent = totalExpense > 0 ? (needExpense / totalExpense) * 100 : 0;
    const wantPercent = totalExpense > 0 ? (wantExpense / totalExpense) * 100 : 0;
    const investPercent = totalExpense > 0 ? (investExpense / totalExpense) * 100 : 0;

    const topCategories = Object.values(categoryMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(c => ({
        ...c,
        percent: totalExpense > 0 ? (c.amount / totalExpense) * 100 : 0
      }));

    return {
      periodType,
      periodTitle,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      needExpense,
      needPercent,
      wantExpense,
      wantPercent,
      investExpense,
      investPercent,
      esunSpent,
      fubonSpent,
      topCategories,
      transactionCount: filteredTx.length
    };
  }

  function calculateCreditCardHealth(account, transactions = [], monthKey = getCurrentMonthKey()) {
    if (!account || account.type !== 'credit') return null;
    const limit = Number(account.creditLimit || 60000);
    const safeLimit = Number(account.safeLimit || 18000);
    // 當前待繳佔用額度 (經刷卡增加、轉帳沖銷後即時扣減)
    const currentUnpaid = Math.max(0, Number(account.balance || 0));

    // 信用卡風控佔用率以「當前實際待繳佔用額度」計算
    const utilizationRatio = limit > 0 ? (currentUnpaid / limit) * 100 : 0;
    const remainingSafeCredit = Math.max(0, safeLimit - currentUnpaid);
    const isOverSafeLimit = currentUnpaid > safeLimit;
    const isNearSafeLimit = currentUnpaid >= safeLimit * 0.8 && !isOverSafeLimit;

    let statusLevel = 'safe', statusText = '信用安全 (極佳)', statusColor = '#10B981';
    if (isOverSafeLimit) {
      statusLevel = 'danger';
      statusText = '已超 30% 安全線 (影響評分)';
      statusColor = '#EF4444';
    } else if (isNearSafeLimit) {
      statusLevel = 'warning';
      statusText = '接近 30% 警戒線 (請留意)';
      statusColor = '#F59E0B';
    }

    return {
      accountId: account.id,
      accountName: account.name,
      bankName: account.bankName,
      creditLimit: limit,
      safeLimit,
      monthlySpent: currentUnpaid, // 當前佔用額度
      currentUnpaid,
      remainingSafeCredit,
      utilizationRatio,
      statusLevel,
      statusText,
      statusColor
    };
  }

  function calculateRealAvailableBalance(accounts = []) {
    let liquidAssets = 0, totalCreditDebt = 0, emergencyFund = 0, investmentAssets = 0;
    (accounts || []).forEach(acc => {
      const bal = Number(acc.balance || 0);
      if (acc.type === 'liquid' || acc.type === 'bank' || acc.type === 'cash') liquidAssets += bal;
      else if (acc.type === 'credit') totalCreditDebt += bal;
      else if (acc.type === 'emergency') emergencyFund += bal;
      else if (acc.type === 'investment') investmentAssets += bal;
    });
    return {
      liquidAssets,
      totalCreditDebt,
      emergencyFund,
      investmentAssets,
      realAvailable: liquidAssets - totalCreditDebt
    };
  }

  function calculateEmergencyFundHealth(emergencyBalance, monthlyNeedExpense = 30000) {
    const validNeed = monthlyNeedExpense > 0 ? monthlyNeedExpense : 30000;
    const monthsCovered = emergencyBalance / validNeed;
    const progress = Math.min(100, (emergencyBalance / (validNeed * 6)) * 100);
    let healthText = '防護尚未建立', badgeColor = '#94A3B8';

    if (emergencyBalance <= 0) {
      healthText = '防護尚未建立 (NT$ 0)';
      badgeColor = '#94A3B8';
    } else if (monthsCovered >= 6) {
      healthText = '黃金安全盾 (6個月以上)';
      badgeColor = '#10B981';
    } else if (monthsCovered >= 3) {
      healthText = '基礎防護達成 (3~6個月)';
      badgeColor = '#6366F1';
    } else if (monthsCovered >= 1) {
      healthText = '初步建立中 (1~3個月)';
      badgeColor = '#F59E0B';
    } else {
      healthText = '防護不足 (< 1個月)';
      badgeColor = '#EF4444';
    }

    return {
      emergencyBalance,
      monthsCovered: Number(monthsCovered.toFixed(1)),
      progressTo6Months: Number(progress.toFixed(1)),
      healthText,
      badgeColor
    };
  }

  // ===== 債務分類 =====
  const DEBT_CATEGORIES = [
    { id: 'mortgage',    name: '房貸',       icon: '🏠', color: '#6366F1' },
    { id: 'car_loan',    name: '車貸',       icon: '🚗', color: '#3B82F6' },
    { id: 'student',     name: '學貸',       icon: '🎓', color: '#8B5CF6' },
    { id: 'personal',    name: '個人信貸',   icon: '🏦', color: '#0EA5E9' },
    { id: 'credit_card', name: '信用卡循環', icon: '💳', color: '#F43F5E' },
    { id: 'installment', name: '分期付款',   icon: '📦', color: '#F59E0B' },
    { id: 'friend',      name: '私人借貸',   icon: '🤝', color: '#10B981' },
    { id: 'other',       name: '其他債務',   icon: '📋', color: '#64748B' }
  ];

  // ===== 債務還款與交易刪除(純函式:直接修改傳入的 state) =====

  /**
   * 執行一次債務還款:扣債務剩餘、從主要活存扣款、新增一筆「債務還款」支出。
   * 交易上另記 debtApplied(實際沖銷的債務金額),刪除該筆時才能精準回復;
   * 舊資料沒有這個欄位,刪除時會退而使用 amount,不需要資料遷移。
   */
  function applyDebtPayment(state, debtId, customAmount, now) {
    if (!state || !Array.isArray(state.debts)) return null;
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) return null;
    const payAmount = (customAmount !== null && customAmount !== undefined && customAmount > 0)
      ? Number(customAmount) : Number(debt.monthlyPayment);
    if (!(payAmount > 0)) return null;

    const prevRemaining = Number(debt.remaining) || 0;
    const applied = Math.min(payAmount, prevRemaining);
    debt.remaining = Math.max(0, prevRemaining - payAmount);
    if (debt.remaining === 0) debt.isPaid = true;

    // 連動主要活存
    const mainAcc = (state.accounts || []).find(a => a.type === 'liquid');
    if (mainAcc) mainAcc.balance = Number(mainAcc.balance || 0) - payAmount;

    const at = now ? new Date(now) : new Date();
    const catInfo = DEBT_CATEGORIES.find(c => c.id === debt.category) || DEBT_CATEGORIES[7];
    const newTx = {
      id: `tx_debt_${at.getTime()}`,
      type: 'expense',
      amount: payAmount,
      categoryId: 'debt_payment',
      categoryName: `債務還款：${debt.name}`,
      categoryIcon: catInfo.icon,
      tag: 'need',
      accountId: mainAcc ? mainAcc.id : 'acc_bank_main',
      accountName: mainAcc ? mainAcc.name : '主要活存',
      date: getLocalDateString(at),
      timestamp: at.toISOString(), // 精確時間點(此處用 UTC 是正確的,它代表時間點而非日曆日期)
      note: `${debt.creditor ? `[${debt.creditor}] ` : ''}月還款（自動連動扣款）`,
      debtId: debtId,
      debtApplied: applied
    };
    if (!Array.isArray(state.transactions)) state.transactions = [];
    state.transactions.unshift(newTx);
    return newTx;
  }

  /**
   * 從 state 刪除一筆交易,並回退關聯帳戶餘額、信用卡待繳款;
   * 若是債務還款,連同債務剩餘金額一併回復。回傳被刪除的交易,找不到則回傳 null。
   */
  function deleteTransactionFromState(state, txId) {
    if (!state || !Array.isArray(state.transactions)) return null;
    const txIndex = state.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return null;
    const tx = state.transactions[txIndex];
    const amount = Number(tx.amount);
    const accounts = state.accounts || [];

    if (tx.type === 'transfer') {
      const fromAcc = accounts.find(a => a.id === tx.accountId);
      const toAcc = accounts.find(a => a.id === tx.toAccountId);
      // 轉出帳戶加回 (若是信用卡則減回待繳款)
      if (fromAcc) {
        if (fromAcc.type === 'credit') fromAcc.balance = Math.max(0, Number(fromAcc.balance || 0) - amount);
        else fromAcc.balance = Number(fromAcc.balance || 0) + amount;
      }
      // 轉入帳戶扣回 (若是信用卡則加回待繳款)
      if (toAcc) {
        if (toAcc.type === 'credit') toAcc.balance = Number(toAcc.balance || 0) + amount;
        else toAcc.balance = Number(toAcc.balance || 0) - amount;
      }
    } else {
      const targetAcc = accounts.find(a => a.id === tx.accountId);
      if (targetAcc) {
        if (tx.type === 'expense') {
          if (targetAcc.type === 'credit') targetAcc.balance = Math.max(0, Number(targetAcc.balance || 0) - amount);
          else targetAcc.balance = Number(targetAcc.balance || 0) + amount;
        } else if (tx.type === 'income') {
          targetAcc.balance = Number(targetAcc.balance || 0) - amount;
        }
      }
    }

    // 債務還款:回復債務剩餘金額(舊資料沒有 debtApplied,退而使用 amount)
    if (tx.debtId && Array.isArray(state.debts)) {
      const debt = state.debts.find(d => d.id === tx.debtId);
      if (debt) {
        const restore = (tx.debtApplied !== undefined && tx.debtApplied !== null) ? Number(tx.debtApplied) : amount;
        let restored = (Number(debt.remaining) || 0) + restore;
        const total = Number(debt.totalAmount);
        if (total > 0) restored = Math.min(total, restored);
        debt.remaining = restored;
        if (debt.remaining > 0 && debt.isPaid) debt.isPaid = false;
      }
    }

    state.transactions.splice(txIndex, 1);
    return tx;
  }

  const api = {
    getLocalDateString,
    getLocalMonthString,
    getCurrentMonthKey,
    formatCurrency,
    calculate503020,
    generatePeriodReport,
    calculateCreditCardHealth,
    calculateRealAvailableBalance,
    calculateEmergencyFundHealth,
    DEBT_CATEGORIES,
    applyDebtPayment,
    deleteTransactionFromState
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FinFlowCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
