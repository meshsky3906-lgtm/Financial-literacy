/**
 * FinFlow 智富記帳 - 核心財商演算法與信用風控模組
 */

/**
 * 取得當前年月字串 YYYY-MM
 */
export function getCurrentMonthKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 計算指定月份的 50/30/20 資產配置與支出分佈
 */
export function calculate503020(transactions = [], monthKey = getCurrentMonthKey()) {
  const monthlyTx = transactions.filter(tx => tx.date.startsWith(monthKey));

  let totalIncome = 0;
  let totalExpense = 0;
  let needExpense = 0;
  let wantExpense = 0;
  let investExpense = 0;

  monthlyTx.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += Number(tx.amount);
    } else if (tx.type === 'expense') {
      const amt = Number(tx.amount);
      totalExpense += amt;
      if (tx.tag === 'need') {
        needExpense += amt;
      } else if (tx.tag === 'want') {
        wantExpense += amt;
      } else if (tx.tag === 'invest') {
        investExpense += amt;
      }
    }
  });

  // 計算實際支出佔比
  const needPercent = totalExpense > 0 ? (needExpense / totalExpense) * 100 : 0;
  const wantPercent = totalExpense > 0 ? (wantExpense / totalExpense) * 100 : 0;
  const investPercent = totalExpense > 0 ? (investExpense / totalExpense) * 100 : 0;

  // 計算若以總收入為基準的儲蓄率與配置比例 (若有收入)
  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  // 財商健康診斷建議
  const diagnostics = [];
  if (totalExpense > 0) {
    if (wantPercent > 35) {
      diagnostics.push({
        type: 'warning',
        title: '慾望支出偏高預警',
        message: `本月彈性慾望佔總支出 ${wantPercent.toFixed(1)}%（建議控制在 30% 以內），適度延遲非必要享樂能加速財富積累。`
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
    need: { amount: needExpense, percent: needPercent, target: 50 },
    want: { amount: wantExpense, percent: wantPercent, target: 30 },
    invest: { amount: investExpense, percent: investPercent, target: 20 },
    diagnostics
  };
}

/**
 * 計算信用卡狀態與「30% 信用使用率安全紅線」風控指標
 * 
 * 聯徵信用評分重要準則：
 * 刷卡金額 ÷ 總額度 需控制在 30% 以內 (60,000 * 30% = 18,000)
 */
export function calculateCreditCardHealth(account, transactions = [], monthKey = getCurrentMonthKey()) {
  if (account.type !== 'credit') return null;

  const limit = Number(account.creditLimit || 60000);
  const safeLimit = Number(account.safeLimit || 18000); // 30% 安全線
  const currentUnpaid = Number(account.balance || 0); // 當前待繳總額

  // 計算當月本卡刷卡總額
  const monthlySpent = transactions
    .filter(tx => tx.type === 'expense' && tx.accountId === account.id && tx.date.startsWith(monthKey))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  // 使用率以「當月刷卡額 / 總額度」計算
  const utilizationRatio = limit > 0 ? (monthlySpent / limit) * 100 : 0;
  const remainingSafeCredit = Math.max(0, safeLimit - monthlySpent);
  const isOverSafeLimit = monthlySpent > safeLimit;
  const isNearSafeLimit = monthlySpent >= safeLimit * 0.8 && !isOverSafeLimit;

  let statusLevel = 'safe'; // safe | warning | danger
  let statusText = '信用安全 (極佳)';
  let statusColor = '#10B981'; // 綠色

  if (isOverSafeLimit) {
    statusLevel = 'danger';
    statusText = '已超 30% 安全線 (影響評分)';
    statusColor = '#EF4444'; // 紅色
  } else if (isNearSafeLimit) {
    statusLevel = 'warning';
    statusText = '接近 30% 警戒線 (請留意)';
    statusColor = '#F59E0B'; // 黃色
  }

  return {
    accountId: account.id,
    accountName: account.name,
    bankName: account.bankName,
    creditLimit: limit,
    safeLimit: safeLimit,
    safeRatio: 30, // 30%
    monthlySpent,
    currentUnpaid,
    remainingSafeCredit,
    utilizationRatio,
    statusLevel,
    statusText,
    statusColor,
    isOverSafeLimit
  };
}

/**
 * 計算真實可用餘額 (Real Available Balance)
 * 真實可用餘額 = 流動存款 (現金/銀行活存) - 所有信用卡待繳帳款
 */
export function calculateRealAvailableBalance(accounts = []) {
  let liquidAssets = 0;
  let totalCreditDebt = 0;
  let emergencyFund = 0;
  let investmentAssets = 0;

  accounts.forEach(acc => {
    const bal = Number(acc.balance || 0);
    if (acc.type === 'liquid' || acc.type === 'bank' || acc.type === 'cash') {
      liquidAssets += bal;
    } else if (acc.type === 'credit') {
      // 信用卡的 balance 代表當前未繳帳款 (負債)
      totalCreditDebt += bal;
    } else if (acc.type === 'emergency') {
      emergencyFund += bal;
    } else if (acc.type === 'investment') {
      investmentAssets += bal;
    }
  });

  const realAvailable = liquidAssets - totalCreditDebt;
  const netWorth = (liquidAssets + emergencyFund + investmentAssets) - totalCreditDebt;

  return {
    liquidAssets,
    totalCreditDebt,
    emergencyFund,
    investmentAssets,
    realAvailable,
    netWorth,
    hasCreditDeficit: realAvailable < 0
  };
}

/**
 * 計算緊急預備金（Emergency Fund）水位守護狀態
 * 基準：以 3~6 個月「月均必要需求生活費 (Needs)」為目標
 */
export function calculateEmergencyFundHealth(emergencyBalance, monthlyNeedExpense = 30000) {
  const validMonthlyNeed = monthlyNeedExpense > 0 ? monthlyNeedExpense : 30000;
  const target3Months = validMonthlyNeed * 3;
  const target6Months = validMonthlyNeed * 6; // 黃金安全防護盾

  const monthsCovered = emergencyBalance / validMonthlyNeed;
  const progressTo6Months = Math.min(100, (emergencyBalance / target6Months) * 100);

  let healthStatus = 'insufficient'; // insufficient | basic | ideal | strong
  let healthText = '防護不足';
  let badgeColor = '#EF4444';

  if (monthsCovered >= 6) {
    healthStatus = 'strong';
    healthText = '黃金安全盾 (6個月以上)';
    badgeColor = '#10B981';
  } else if (monthsCovered >= 3) {
    healthStatus = 'ideal';
    healthText = '基礎防護達成 (3~6個月)';
    badgeColor = '#6366F1';
  } else if (monthsCovered >= 1) {
    healthStatus = 'basic';
    healthText = '初步建立中 (1~3個月)';
    badgeColor = '#F59E0B';
  }

  return {
    emergencyBalance,
    monthlyNeedExpense: validMonthlyNeed,
    monthsCovered: Number(monthsCovered.toFixed(1)),
    target3Months,
    target6Months,
    progressTo6Months: Number(progressTo6Months.toFixed(1)),
    healthStatus,
    healthText,
    badgeColor
  };
}

/**
 * 產生指定週期（月報表 / 季報表 / 年報表）的完整財務分析數據
 * 
 * @param {Array} transactions 交易記錄陣列
 * @param {string} periodType 'month' | 'quarter' | 'year'
 * @param {string} periodKey 例如 '2026-08'、'2026-Q3'、'2026'
 */
export function generatePeriodReport(transactions = [], periodType = 'month', periodKey = '') {
  let periodTitle = '';
  let filteredTx = [];

  const now = new Date();
  const currentYear = now.getFullYear();

  if (periodType === 'month') {
    const key = periodKey || getCurrentMonthKey();
    const [y, m] = key.split('-');
    periodTitle = `${y} 年 ${m} 月報表`;
    filteredTx = transactions.filter(t => t.date.startsWith(key));
  } else if (periodType === 'quarter') {
    // 例如 '2026-Q3'
    const qKey = periodKey || `${currentYear}-Q${Math.floor(now.getMonth() / 3) + 1}`;
    const [y, qStr] = qKey.split('-');
    const qNum = parseInt(qStr.replace('Q', ''), 10);
    periodTitle = `${y} 年 第 ${qNum} 季報表`;

    const startMonth = (qNum - 1) * 3 + 1; // 1, 4, 7, 10
    const quarterMonths = [
      `${y}-${String(startMonth).padStart(2, '0')}`,
      `${y}-${String(startMonth + 1).padStart(2, '0')}`,
      `${y}-${String(startMonth + 2).padStart(2, '0')}`
    ];
    filteredTx = transactions.filter(t => quarterMonths.some(m => t.date.startsWith(m)));
  } else if (periodType === 'year') {
    const yKey = periodKey || String(currentYear);
    periodTitle = `${yKey} 年度財務總報表`;
    filteredTx = transactions.filter(t => t.date.startsWith(yKey));
  }

  let totalIncome = 0;
  let totalExpense = 0;
  let needExpense = 0;
  let wantExpense = 0;
  let investExpense = 0;
  let esunSpent = 0;
  let fubonSpent = 0;

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

      // 統計信用卡刷卡
      if (tx.accountId === 'card_esun') esunSpent += amt;
      if (tx.accountId === 'card_fubon') fubonSpent += amt;

      // 統計分類排行榜
      const catName = tx.categoryName || '其他';
      const catIcon = tx.categoryIcon || '💸';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { name: catName, icon: catIcon, amount: 0, tag: tx.tag };
      }
      categoryMap[catName].amount += amt;
    }
  });

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netSavings / totalIncome) * 100) : 0;
  const needPercent = totalExpense > 0 ? (needExpense / totalExpense) * 100 : 0;
  const wantPercent = totalExpense > 0 ? (wantExpense / totalExpense) * 100 : 0;
  const investPercent = totalExpense > 0 ? (investExpense / totalExpense) * 100 : 0;

  // 排序前 5 大開銷分類
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
