/**
 * FinFlow 智富記帳 - 債務管理模組 (Debt Manager)
 * 功能：債務 CRUD、統計計算、與主帳戶資金連動
 */

// =========================================================================
// 債務分類定義
// =========================================================================
export const DEBT_CATEGORIES = [
  { id: 'mortgage',    name: '房貸',       icon: '🏠', color: '#6366F1' },
  { id: 'car_loan',    name: '車貸',       icon: '🚗', color: '#3B82F6' },
  { id: 'student',     name: '學貸',       icon: '🎓', color: '#8B5CF6' },
  { id: 'personal',    name: '個人信貸',   icon: '🏦', color: '#0EA5E9' },
  { id: 'credit_card', name: '信用卡循環', icon: '💳', color: '#F43F5E' },
  { id: 'installment', name: '分期付款',   icon: '📦', color: '#F59E0B' },
  { id: 'friend',      name: '私人借貸',   icon: '🤝', color: '#10B981' },
  { id: 'other',       name: '其他債務',   icon: '📋', color: '#64748B' }
];

// =========================================================================
// 工具函式
// =========================================================================

/** 產生唯一債務 ID */
export function generateDebtId() {
  return `debt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

/** 從 appState 讀取債務陣列（向後相容，若無則回傳空陣列） */
export function getDebts(appState) {
  return Array.isArray(appState.debts) ? appState.debts : [];
}

// =========================================================================
// CRUD 操作
// =========================================================================

/**
 * 新增一筆債務
 * @param {object} appState - 全域應用程式狀態
 * @param {object} debtData - 債務資料物件
 * @returns {object} 新建的債務物件
 */
export function addDebt(appState, debtData) {
  if (!Array.isArray(appState.debts)) {
    appState.debts = [];
  }

  const newDebt = {
    id: generateDebtId(),
    name: debtData.name.trim(),
    category: debtData.category || 'other',
    creditor: (debtData.creditor || '').trim(),
    totalAmount: Number(debtData.totalAmount) || 0,
    remaining: Number(debtData.remaining) || 0,
    monthlyPayment: Number(debtData.monthlyPayment) || 0,
    interestRate: Number(debtData.interestRate) || 0,
    dueDay: Number(debtData.dueDay) || 1,
    startDate: debtData.startDate || new Date().toISOString().substr(0, 7),
    endDate: debtData.endDate || '',
    note: (debtData.note || '').trim(),
    isPaid: false,
    createdAt: new Date().toISOString()
  };

  appState.debts.unshift(newDebt);
  return newDebt;
}

/**
 * 刪除一筆債務
 * @param {object} appState
 * @param {string} debtId
 * @returns {boolean}
 */
export function deleteDebt(appState, debtId) {
  if (!Array.isArray(appState.debts)) return false;
  const idx = appState.debts.findIndex(d => d.id === debtId);
  if (idx === -1) return false;
  appState.debts.splice(idx, 1);
  return true;
}

/**
 * 標記「本月已還款」：從 remaining 扣除還款金額
 * 並在 transactions 中新增一筆還款紀錄（從主要活存帳戶扣除，連動資金）
 * @param {object} appState
 * @param {string} debtId
 * @param {number|null} customAmount - 自訂金額，null 時使用 monthlyPayment
 * @returns {object|null} 新增的交易物件 or null
 */
export function markMonthlyPayment(appState, debtId, customAmount = null) {
  if (!Array.isArray(appState.debts)) return null;
  const debt = appState.debts.find(d => d.id === debtId);
  if (!debt) return null;

  const payAmount = customAmount !== null ? Number(customAmount) : Number(debt.monthlyPayment);
  if (payAmount <= 0) return null;

  // 1. 更新剩餘債務金額（不低於 0）
  debt.remaining = Math.max(0, Number(debt.remaining) - payAmount);
  if (debt.remaining === 0) {
    debt.isPaid = true;
  }

  // 2. 從主要活存帳戶扣除（連動資金）
  const mainAccount = Array.isArray(appState.accounts)
    ? appState.accounts.find(a => a.type === 'liquid')
    : null;

  if (mainAccount) {
    mainAccount.balance = Number(mainAccount.balance || 0) - payAmount;
  }

  // 3. 在交易紀錄中新增還款明細（tag = 'need' 必要支出，列入 50% 配置）
  const catInfo = DEBT_CATEGORIES.find(c => c.id === debt.category) || DEBT_CATEGORIES[7];
  const newTx = {
    id: `tx_debt_pay_${Date.now()}`,
    type: 'expense',
    amount: payAmount,
    categoryId: 'debt_payment',
    categoryName: `債務還款：${debt.name}`,
    categoryIcon: catInfo.icon,
    tag: 'need',
    accountId: mainAccount ? mainAccount.id : 'acc_bank_main',
    accountName: mainAccount ? mainAccount.name : '主要活存',
    date: new Date().toISOString().split('T')[0],
    note: `${debt.creditor ? `[${debt.creditor}] ` : ''}每月還款（系統自動連動扣款）`,
    debtId: debtId
  };

  if (!Array.isArray(appState.transactions)) appState.transactions = [];
  appState.transactions.unshift(newTx);

  return newTx;
}

/**
 * 手動修正債務剩餘金額
 */
export function updateDebtRemaining(appState, debtId, newRemaining) {
  if (!Array.isArray(appState.debts)) return;
  const debt = appState.debts.find(d => d.id === debtId);
  if (!debt) return;
  debt.remaining = Math.max(0, Number(newRemaining));
  debt.isPaid = debt.remaining === 0;
}

// =========================================================================
// 統計計算
// =========================================================================

/**
 * 計算所有債務的統計摘要（與主帳戶資金連動）
 * @param {object} appState
 * @returns {object}
 */
export function calcDebtSummary(appState) {
  const debts = getDebts(appState);
  const activeDebts = debts.filter(d => !d.isPaid);
  const paidDebts  = debts.filter(d => d.isPaid);

  const totalRemaining   = activeDebts.reduce((s, d) => s + Number(d.remaining    || 0), 0);
  const totalOriginal    = debts.reduce((s, d)       => s + Number(d.totalAmount  || 0), 0);
  const totalMonthly     = activeDebts.reduce((s, d) => s + Number(d.monthlyPayment || 0), 0);
  const totalAlreadyPaid = debts.reduce((s, d)       => s + (Number(d.totalAmount || 0) - Number(d.remaining || 0)), 0);

  // 總資產（排除信用卡待繳帳款）
  const totalAssets = Array.isArray(appState.accounts)
    ? appState.accounts.reduce((s, a) => {
        if (a.type === 'credit') return s;
        return s + Math.max(0, Number(a.balance || 0));
      }, 0)
    : 0;

  // 負債比率 = 總負債 / (總資產 + 總負債)
  const debtRatio = (totalAssets + totalRemaining) > 0
    ? Math.min(100, Math.round((totalRemaining / (totalAssets + totalRemaining)) * 100))
    : (totalRemaining > 0 ? 100 : 0);

  // 主要活存月還款壓力
  const mainAccount = Array.isArray(appState.accounts)
    ? appState.accounts.find(a => a.type === 'liquid')
    : null;
  const mainBalance = mainAccount ? Number(mainAccount.balance || 0) : 0;

  const monthlyPressureRatio = mainBalance > 0
    ? Math.round((totalMonthly / mainBalance) * 100)
    : (totalMonthly > 0 ? 100 : 0);

  // 整體還清進度
  const overallProgress = totalOriginal > 0
    ? Math.round((totalAlreadyPaid / totalOriginal) * 100)
    : 0;

  // 各債務附加 ETA、進度等計算欄位
  const debtsWithETA = activeDebts.map(d => {
    const monthly   = Number(d.monthlyPayment || 0);
    const remaining = Number(d.remaining || 0);
    const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
    const catInfo   = DEBT_CATEGORIES.find(c => c.id === d.category) || DEBT_CATEGORIES[7];
    const paidAmt   = Number(d.totalAmount || 0) - remaining;
    const progress  = Number(d.totalAmount) > 0
      ? Math.round((paidAmt / Number(d.totalAmount)) * 100)
      : 0;
    return { ...d, monthsLeft, catInfo, progress, paidAmt };
  });

  return {
    totalRemaining,
    totalOriginal,
    totalMonthly,
    totalAlreadyPaid,
    totalAssets,
    debtRatio,
    monthlyPressureRatio,
    mainBalance,
    overallProgress,
    activeCount: activeDebts.length,
    paidCount:   paidDebts.length,
    totalCount:  debts.length,
    debtsWithETA,
    paidDebts
  };
}

/**
 * 取得即將到期（本月內）的還款提示清單
 * @param {object} appState
 * @returns {Array}
 */
export function getUpcomingPayments(appState) {
  const debts = getDebts(appState);
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  return debts
    .filter(d => !d.isPaid && d.dueDay > 0 && d.monthlyPayment > 0)
    .map(d => {
      const daysUntilDue = d.dueDay >= currentDay
        ? d.dueDay - currentDay
        : (daysInMonth - currentDay) + d.dueDay;
      const isOverdue = d.dueDay < currentDay;
      const catInfo = DEBT_CATEGORIES.find(c => c.id === d.category) || DEBT_CATEGORIES[7];
      return { ...d, daysUntilDue, isOverdue, catInfo };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 5);
}
