/**
 * FinFlow 智富記帳 - 介面動態渲染與互動模組 (UI Renderer)
 */

import { FINANCE_TAGS, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, WEALTH_QUOTES } from './categories.js';
import { 
  calculate503020, 
  calculateCreditCardHealth, 
  calculateRealAvailableBalance, 
  calculateEmergencyFundHealth,
  getCurrentMonthKey 
} from './financeLogic.js';

/**
 * 格式化貨幣數字字串 (例如 NT$ 18,000)
 */
export function formatCurrency(amount, prefix = 'NT$ ') {
  const num = Math.round(Number(amount) || 0);
  return `${prefix}${num.toLocaleString()}`;
}

/**
 * 顯示 Toast 提示訊息
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '✨';
  if (type === 'warning') icon = '⚠️';
  if (type === 'error') icon = '🚨';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/**
 * 渲染全站首頁儀表板
 */
export function renderDashboard(state) {
  const { accounts, transactions } = state;
  const currentMonth = getCurrentMonthKey();

  // 1. 計算總覽數據
  const realBalInfo = calculateRealAvailableBalance(accounts);
  const fin503020 = calculate503020(transactions, currentMonth);

  // 渲染頂部總覽四卡
  const elRealAvail = document.getElementById('val-real-available');
  const elTotalIncome = document.getElementById('val-total-income');
  const elTotalExpense = document.getElementById('val-total-expense');
  const elSavingsRate = document.getElementById('val-savings-rate');

  if (elRealAvail) {
    elRealAvail.textContent = formatCurrency(realBalInfo.realAvailable);
    const subText = document.getElementById('sub-real-available');
    if (subText) {
      subText.innerHTML = `已扣除待繳卡費 ${formatCurrency(realBalInfo.totalCreditDebt)}（杜絕假性富裕）`;
    }
  }

  if (elTotalIncome) elTotalIncome.textContent = formatCurrency(fin503020.totalIncome);
  if (elTotalExpense) elTotalExpense.textContent = formatCurrency(fin503020.totalExpense);
  if (elSavingsRate) {
    elSavingsRate.textContent = `${fin503020.savingsRate.toFixed(1)}%`;
    const subSavings = document.getElementById('sub-savings-rate');
    if (subSavings) {
      subSavings.textContent = `淨存下 ${formatCurrency(fin503020.netSavings)}`;
    }
  }

  // 2. 渲染雙信用卡 30% 信用風控專區 (玉山 & 富邦)
  renderCreditGuard(accounts, transactions, currentMonth);

  // 3. 渲染 50/30/20 資產配置面板
  render503020Panel(fin503020);

  // 4. 渲染 🛡️ 緊急預備金防護盾
  renderEmergencyShield(accounts, fin503020.need.amount);

  // 5. 渲染交易明細
  renderTransactionLedger(state);

  // 6. 渲染每日財商智慧金句
  renderDailyWisdom();
}

/**
 * 渲染雙信用卡 30% 信用風控卡片
 */
function renderCreditGuard(accounts, transactions, currentMonth) {
  const container = document.getElementById('credit-cards-container');
  if (!container) return;

  const creditAccounts = accounts.filter(a => a.type === 'credit');
  container.innerHTML = '';

  creditAccounts.forEach(card => {
    const health = calculateCreditCardHealth(card, transactions, currentMonth);
    const isEsun = card.id === 'card_esun' || card.bankName.includes('玉山');
    const themeClass = isEsun ? 'card-esun-theme' : 'card-fubon-theme';

    const cardEl = document.createElement('div');
    cardEl.className = `credit-card-item ${themeClass}`;

    // 計算進度條寬度（上限 100%）
    const fillPercent = Math.min(100, health.utilizationRatio);
    let fillClass = '';
    if (health.statusLevel === 'warning') fillClass = 'warning';
    if (health.statusLevel === 'danger') fillClass = 'danger';

    cardEl.innerHTML = `
      <div class="card-top">
        <div class="bank-identity">
          <div class="bank-chip"></div>
          <div>
            <div class="bank-name-text">${card.bankName}</div>
            <div class="bank-sub-text">額度 ${formatCurrency(card.creditLimit)}</div>
          </div>
        </div>
        <span class="badge badge-${health.statusLevel}">
          ${health.statusText}
        </span>
      </div>

      <div class="credit-card-number">•••• •••• •••• ${isEsun ? '8899' : '6688'}</div>

      <div class="utilization-gauge-wrap">
        <div class="gauge-header">
          <span>已刷：<strong>${formatCurrency(health.monthlySpent)}</strong> (${health.utilizationRatio.toFixed(1)}%)</span>
          <span>安全剩餘：<strong style="color: ${health.statusColor}">${formatCurrency(health.remainingSafeCredit)}</strong></span>
        </div>
        <div class="gauge-bar-track">
          <div class="gauge-bar-fill ${fillClass}" style="width: ${fillPercent}%"></div>
          <div class="safe-limit-marker" title="聯徵 30% 信用評分黃金上限線"></div>
        </div>
        <div class="gauge-footer-labels">
          <span>0%</span>
          <span style="color: #FCD34D; font-weight: 600;">▲ 30% 安全線 $18,000</span>
          <span>額度 $60,000</span>
        </div>
      </div>
      </div>

      <div class="card-footer-info">
        <div class="debt-amount-wrap">
          <div class="label">當前待繳總額</div>
          <div class="amount">${formatCurrency(card.balance)}</div>
        </div>
        <button class="btn-pay-bill" data-card-id="${card.id}" data-card-name="${card.name}" data-balance="${card.balance}">
          💳 繳納卡費
        </button>
      </div>
    `;

    container.appendChild(cardEl);
  });
}

/**
 * 渲染 50/30/20 資產配置與財商診斷
 */
function render503020Panel(fin) {
  const container = document.getElementById('ratio-cards-container');
  if (!container) return;

  container.innerHTML = `
    <!-- 50% 必要需求 -->
    <div class="ratio-box">
      <div class="ratio-box-header">
        <span class="ratio-tag-title text-need">🏠 50% 必要需求 (Needs)</span>
        <span class="badge badge-need">${fin.need.percent.toFixed(1)}%</span>
      </div>
      <div class="ratio-box-amount">${formatCurrency(fin.need.amount)}</div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${Math.min(100, fin.need.percent)}%; background: var(--color-need);"></div>
      </div>
      <div class="ratio-box-sub">
        <span>房租、三餐、水電等生存固定開銷</span>
        <span>目標 ≤ 50%</span>
      </div>
    </div>

    <!-- 30% 彈性慾望 -->
    <div class="ratio-box">
      <div class="ratio-box-header">
        <span class="ratio-tag-title text-negative">🛍️ 30% 彈性慾望 (Wants)</span>
        <span class="badge badge-want">${fin.want.percent.toFixed(1)}%</span>
      </div>
      <div class="ratio-box-amount">${formatCurrency(fin.want.amount)}</div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${Math.min(100, fin.want.percent)}%; background: var(--color-want);"></div>
      </div>
      <div class="ratio-box-sub">
        <span>聚餐、購物、娛樂等品質享受</span>
        <span>目標 ≤ 30%</span>
      </div>
    </div>

    <!-- 20% 投資與安全儲蓄 -->
    <div class="ratio-box">
      <div class="ratio-box-header">
        <span class="ratio-tag-title text-invest">📈 20% 投資儲蓄 (Invest)</span>
        <span class="badge badge-invest">${fin.invest.percent.toFixed(1)}%</span>
      </div>
      <div class="ratio-box-amount">${formatCurrency(fin.invest.amount)}</div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${Math.min(100, fin.invest.percent)}%; background: var(--color-invest);"></div>
      </div>
      <div class="ratio-box-sub">
        <span>ETF複利、自我投資、未來資產</span>
        <span>目標 ≥ 20%</span>
      </div>
    </div>
  `;

  // 渲染診斷訊息
  const diagContainer = document.getElementById('diagnostics-container');
  if (diagContainer) {
    if (fin.diagnostics.length === 0) {
      diagContainer.innerHTML = `
        <div class="diagnostic-item success">
          <span>🎯</span>
          <div><strong>本月財務配置平衡</strong>：您的收支結構健康，持續堅持資產分流原則！</div>
        </div>
      `;
    } else {
      diagContainer.innerHTML = fin.diagnostics.map(d => `
        <div class="diagnostic-item ${d.type}">
          <span>${d.type === 'warning' ? '⚠️' : d.type === 'caution' ? '💡' : '🌟'}</span>
          <div><strong>${d.title}</strong>：${d.message}</div>
        </div>
      `).join('');
    }
  }
}

/**
 * 渲染 🛡️ 緊急預備金防護盾
 */
function renderEmergencyShield(accounts, monthlyNeedExpense) {
  const emAcc = accounts.find(a => a.type === 'emergency') || { balance: 0 };
  const health = calculateEmergencyFundHealth(emAcc.balance, monthlyNeedExpense > 0 ? monthlyNeedExpense : 30000);

  const elBalance = document.getElementById('shield-balance');
  const elMonths = document.getElementById('shield-months');
  const elProgress = document.getElementById('shield-progress-fill');
  const elBadge = document.getElementById('shield-badge');

  if (elBalance) elBalance.textContent = formatCurrency(health.emergencyBalance);
  if (elMonths) elMonths.textContent = `${health.monthsCovered} 個月`;
  if (elProgress) elProgress.style.width = `${health.progressTo6Months}%`;
  if (elBadge) {
    elBadge.textContent = health.healthText;
    elBadge.style.color = health.badgeColor;
  }
}

/**
 * 渲染交易歷史明細流
 */
export function renderTransactionLedger(state, filterTag = 'all') {
  const container = document.getElementById('transaction-list');
  if (!container) return;

  const { transactions } = state;
  let filtered = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filterTag === 'need') filtered = filtered.filter(t => t.tag === 'need');
  else if (filterTag === 'want') filtered = filtered.filter(t => t.tag === 'want');
  else if (filterTag === 'invest') filtered = filtered.filter(t => t.tag === 'invest');
  else if (filterTag === 'income') filtered = filtered.filter(t => t.type === 'income');
  else if (filterTag === 'card_esun') filtered = filtered.filter(t => t.accountId === 'card_esun');
  else if (filterTag === 'card_fubon') filtered = filtered.filter(t => t.accountId === 'card_fubon');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>目前尚無符合篩選條件的交易紀錄</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(tx => {
    const isIncome = tx.type === 'income';
    let tagBadge = '';

    if (isIncome) {
      tagBadge = `<span class="badge badge-income">💰 收入</span>`;
    } else if (tx.tag === 'need') {
      tagBadge = `<span class="badge badge-need">50% 必要</span>`;
    } else if (tx.tag === 'want') {
      tagBadge = `<span class="badge badge-want">30% 慾望</span>`;
    } else if (tx.tag === 'invest') {
      tagBadge = `<span class="badge badge-invest">20% 投資</span>`;
    }

    const sign = isIncome ? '+' : '-';
    const amountColorClass = isIncome ? 'text-positive' : 'text-primary';

    return `
      <div class="transaction-row">
        <div class="tx-left">
          <div class="tx-icon-wrap">${tx.categoryIcon || '💸'}</div>
          <div class="tx-meta">
            <h5>${tx.categoryName || '未分類'} ${tx.note ? `<span style="font-weight:400; font-size:0.8rem; color:var(--text-secondary);">(${tx.note})</span>` : ''}</h5>
            <div class="tx-meta-sub">
              <span>📅 ${tx.date}</span>
              <span>🏦 ${tx.accountName || '活存'}</span>
              ${tagBadge}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount money-amount ${amountColorClass}">
            ${sign}${formatCurrency(tx.amount)}
          </div>
          <button class="btn-tx-delete" data-tx-id="${tx.id}" title="刪除本筆紀錄">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 隨機渲染每日財商金句
 */
function renderDailyWisdom() {
  const quoteEl = document.getElementById('daily-wisdom-quote');
  const authorEl = document.getElementById('daily-wisdom-author');
  if (!quoteEl || !authorEl) return;

  const rand = WEALTH_QUOTES[Math.floor(Math.random() * WEALTH_QUOTES.length)];
  quoteEl.textContent = `“${rand.quote}”`;
  authorEl.textContent = `—— ${rand.author}`;
}

/**
 * 渲染記帳彈窗中的分類按鈕網格
 */
export function renderCategorySelectGrid(type = 'expense', onSelectCallback) {
  const container = document.getElementById('category-grid-select');
  if (!container) return;

  const list = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  container.innerHTML = '';

  list.forEach((cat, index) => {
    const tile = document.createElement('div');
    tile.className = `category-tile ${index === 0 ? 'active' : ''}`;
    tile.dataset.catId = cat.id;
    tile.dataset.catName = cat.name;
    tile.dataset.catIcon = cat.icon;
    tile.dataset.defaultTag = cat.defaultTag || (type === 'income' ? 'income' : 'need');

    tile.innerHTML = `
      <span class="tile-icon">${cat.icon}</span>
      <span class="tile-name">${cat.name}</span>
    `;

    tile.addEventListener('click', () => {
      container.querySelectorAll('.category-tile').forEach(t => t.classList.remove('active'));
      tile.classList.add('active');
      if (onSelectCallback) onSelectCallback(cat);
    });

    container.appendChild(tile);
  });
}

/**
 * 渲染記帳彈窗中的帳戶選擇器
 */
export function renderAccountSelectOptions(accounts, selectedAccountId = 'card_esun', onSelectCallback) {
  const container = document.getElementById('account-select-container');
  if (!container) return;

  container.innerHTML = '';

  accounts.forEach(acc => {
    // 投資與預備金專戶通常不直接做日常刷卡消費，若為支出主要顯示活存與信用卡
    const opt = document.createElement('div');
    let brandClass = '';
    if (acc.id === 'card_esun') brandClass = 'esun';
    if (acc.id === 'card_fubon') brandClass = 'fubon';

    opt.className = `account-option ${brandClass} ${acc.id === selectedAccountId ? 'active' : ''}`;
    opt.dataset.accId = acc.id;

    opt.innerHTML = `
      <span style="font-size: 1.2rem;">${acc.icon || '💳'}</span>
      <div style="text-align: left;">
        <div style="font-size: 0.85rem; font-weight: 600; color: #FFF;">${acc.name}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted);">
          ${acc.type === 'credit' ? `待繳: ${formatCurrency(acc.balance)}` : `餘額: ${formatCurrency(acc.balance)}`}
        </div>
      </div>
    `;

    opt.addEventListener('click', () => {
      container.querySelectorAll('.account-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (onSelectCallback) onSelectCallback(acc);
    });

    container.appendChild(opt);
  });
}

/**
 * 渲染財務報表分析中心內容
 */
export function renderReportsModal(report) {
  const container = document.getElementById('report-content-container');
  if (!container || !report) return;

  container.innerHTML = `
    <!-- 報表頂部概要標題 -->
    <div style="margin-bottom: 14px; text-align: center;">
      <h4 style="font-size: 1.1rem; color: #FFFFFF; font-weight: 800;">${report.periodTitle}</h4>
      <span style="font-size: 0.75rem; color: var(--text-muted);">共統計 ${report.transactionCount} 筆財務明細</span>
    </div>

    <!-- 4 大關鍵數據指標卡片 -->
    <div class="report-summary-grid">
      <div class="report-stat-box">
        <div class="report-stat-label">💰 期間總收入</div>
        <div class="report-stat-val text-positive">${formatCurrency(report.totalIncome)}</div>
      </div>
      <div class="report-stat-box">
        <div class="report-stat-label">💸 期間總支出</div>
        <div class="report-stat-val text-negative">${formatCurrency(report.totalExpense)}</div>
      </div>
      <div class="report-stat-box">
        <div class="report-stat-label">🛡️ 淨儲蓄累積</div>
        <div class="report-stat-val ${report.netSavings >= 0 ? 'text-positive' : 'text-negative'}">
          ${formatCurrency(report.netSavings)}
        </div>
      </div>
      <div class="report-stat-box">
        <div class="report-stat-label">🚀 期間儲蓄率</div>
        <div class="report-stat-val text-invest">${report.savingsRate.toFixed(1)}%</div>
      </div>
    </div>

    <!-- 50/30/20 資產配置診斷條 -->
    <div class="glass-panel" style="padding: 14px; margin-bottom: 14px; background: rgba(255,255,255,0.02);">
      <div style="font-size: 0.85rem; font-weight: 700; color: #FFF; margin-bottom: 8px;">
        📊 50/30/20 配置實際達成情況
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.78rem;">
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #A5B4FC;">🏠 50% 必要需求開銷</span>
            <strong>${formatCurrency(report.needExpense)} (${report.needPercent.toFixed(1)}%)</strong>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width: ${Math.min(100, report.needPercent)}%; background: #6366F1;"></div></div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #FDA4AF;">🛍️ 30% 彈性慾望享樂</span>
            <strong>${formatCurrency(report.wantExpense)} (${report.wantPercent.toFixed(1)}%)</strong>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width: ${Math.min(100, report.wantPercent)}%; background: #F43F5E;"></div></div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span style="color: #DDD6FE;">📈 20% 投資與資產儲備</span>
            <strong>${formatCurrency(report.investExpense)} (${report.investPercent.toFixed(1)}%)</strong>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width: ${Math.min(100, report.investPercent)}%; background: #8B5CF6;"></div></div>
        </div>
      </div>
    </div>

    <!-- 雙信用卡刷卡風控統計 -->
    <div class="glass-panel" style="padding: 14px; margin-bottom: 14px; background: rgba(255,255,255,0.02);">
      <div style="font-size: 0.85rem; font-weight: 700; color: #FFF; margin-bottom: 8px;">
        💳 雙信用卡期間刷卡統計
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="background: rgba(5,150,105,0.1); border: 1px solid rgba(5,150,105,0.3); border-radius: var(--radius-sm); padding: 10px;">
          <div style="font-size: 0.72rem; color: #6EE7B7;">玉山銀行信用卡</div>
          <div style="font-size: 1rem; font-weight: 800; color: #FFF; margin-top: 2px;">${formatCurrency(report.esunSpent)}</div>
        </div>
        <div style="background: rgba(2,132,199,0.1); border: 1px solid rgba(2,132,199,0.3); border-radius: var(--radius-sm); padding: 10px;">
          <div style="font-size: 0.72rem; color: #7DD3FC;">富邦銀行信用卡</div>
          <div style="font-size: 1rem; font-weight: 800; color: #FFF; margin-top: 2px;">${formatCurrency(report.fubonSpent)}</div>
        </div>
      </div>
    </div>

    <!-- 開銷排行榜 Top 5 -->
    <div class="glass-panel" style="padding: 14px; background: rgba(255,255,255,0.02);">
      <div style="font-size: 0.85rem; font-weight: 700; color: #FFF; margin-bottom: 4px;">
        🏆 支出分類排行榜 (Top 5)
      </div>
      ${report.topCategories.length > 0 ? `
        <div class="ranking-list">
          ${report.topCategories.map((c, idx) => `
            <div class="ranking-item">
              <div class="ranking-left">
                <span class="rank-badge top-${idx + 1}">${idx + 1}</span>
                <span>${c.icon} ${c.name}</span>
              </div>
              <div style="font-weight: 700; font-size: 0.85rem; color: #FFF;">
                ${formatCurrency(c.amount)} <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 400;">(${c.percent.toFixed(1)}%)</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.78rem; padding: 16px;">
          此期間尚無支出紀錄
        </div>
      `}
    </div>
  `;
}
