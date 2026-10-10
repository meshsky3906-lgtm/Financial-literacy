/**
 * FinFlow 智富記帳 — 應用程式主檔(app.js)
 * 畫面渲染、事件、狀態與本機儲存。純計算在 core.js。
 * 以一般 <script> 載入(非 ES 模組),雙擊 index.html 以 file:/// 開啟也能運作。
 */
    (function() {
      // 純計算函式來自 core.js(須先於本檔載入)
      const {
        getLocalDateString, getLocalMonthString, getCurrentMonthKey, formatCurrency,
        calculate503020, generatePeriodReport, calculateCreditCardHealth,
        calculateRealAvailableBalance, calculateEmergencyFundHealth,
        DEBT_CATEGORIES, applyDebtPayment, deleteTransactionFromState
      } = window.FinFlowCore;

      // 1. 分類與財商標籤庫
      const FINANCE_TAGS = {
        NEED: { id: 'need', label: '50% 必要需求', shortLabel: '必要', color: '#6366F1' },
        WANT: { id: 'want', label: '30% 彈性慾望', shortLabel: '慾望', color: '#F43F5E' },
        INVEST: { id: 'invest', label: '20% 投資儲蓄', shortLabel: '投資/儲蓄', color: '#8B5CF6' }
      };

      const DEFAULT_EXPENSE_CATEGORIES = [
        { id: 'food_daily', name: '日常三餐', icon: '🍚', defaultTag: 'need' },
        { id: 'food_dining', name: '外食大餐/聚會', icon: '🥩', defaultTag: 'want' },
        { id: 'beverage', name: '手搖咖啡/甜點', icon: '☕', defaultTag: 'want' },
        { id: 'housing_rent', name: '房租/房貸', icon: '🏠', defaultTag: 'need' },
        { id: 'utilities', name: '水電瓦斯/網路', icon: '⚡', defaultTag: 'need' },
        { id: 'traffic_commute', name: '通勤交通/加油', icon: '🚇', defaultTag: 'need' },
        { id: 'shopping_daily', name: '生活日用耗品', icon: '🧻', defaultTag: 'need' },
        { id: 'shopping_clothing', name: '服飾鞋包/精品', icon: '🛍️', defaultTag: 'want' },
        { id: 'entertainment', name: '電影/遊戲/展覽', icon: '🎮', defaultTag: 'want' },
        { id: 'subscription', name: '串流訂閱(Netflix/YT)', icon: '📱', defaultTag: 'want' },
        { id: 'travel', name: '度假旅遊/住宿', icon: '✈️', defaultTag: 'want' },
        { id: 'medical', name: '醫療看診/保健品', icon: '💊', defaultTag: 'need' },
        { id: 'insurance', name: '人身/財產保險', icon: '🛡️', defaultTag: 'need' },
        { id: 'education_self', name: '進修課程/書籍購置', icon: '📚', defaultTag: 'invest' },
        { id: 'investment_fee', name: '投資手續費/工具', icon: '📈', defaultTag: 'invest' },
        { id: 'social_gift', name: '人際禮金/孝親費', icon: '🎁', defaultTag: 'want' }
      ];

      const DEFAULT_INCOME_CATEGORIES = [
        { id: 'salary', name: '本業薪資', icon: '💼' },
        { id: 'bonus', name: '工作獎金/年終', icon: '🏆' },
        { id: 'side_hustle', name: '副業/接案收入', icon: '💻' },
        { id: 'dividend', name: '股票股利/配息', icon: '📊' },
        { id: 'interest', name: '銀行利息/回饋', icon: '🪙' },
        { id: 'other_income', name: '其他收入/紅包', icon: '🧧' }
      ];

      const WEALTH_QUOTES = [
        { quote: "不要把花剩的錢存起來，而是先把該存的錢存下，再花剩下的錢。", author: "華倫·巴菲特 (Warren Buffett)" },
        { quote: "維持每張信用卡月刷卡額在總額度的 30% 以下，是保護個人銀行信用評分的黃金護城河。", author: "金融信用風控準則" },
        { quote: "緊急預備金不是用來賺取高回報的，而是讓你在風暴來臨時不用被迫賣出優質資產。", author: "《致富心態》摩根·豪瑟" },
        { quote: "富人買入資產，窮人只有支出，中產階級買入他們以為是資產的負債。", author: "《富爸爸·窮爸爸》羅伯特·清崎" },
        { quote: "刷卡是先享受後付款，記帳時務必刷卡當下記入支出，避免假性富裕的心理盲點。", author: "現代行為經濟學" },
        { quote: "將 50% 投入生活必需、30% 犒賞適度慾望、20% 投資未來，能讓你在享受當下的同時持續邁向財務自由。", author: "50/30/20 黃金資產配置法" }
      ];

      // ===== 自訂類別儲存管理 (localStorage) =====
      const CUSTOM_CAT_KEY = 'finflow_custom_categories_v1';

      function loadCustomCategories() {
        try {
          const raw = localStorage.getItem(CUSTOM_CAT_KEY);
          if (!raw) return { expense: [], income: [] };
          const parsed = JSON.parse(raw);
          return {
            expense: Array.isArray(parsed.expense) ? parsed.expense : [],
            income:  Array.isArray(parsed.income)  ? parsed.income  : []
          };
        } catch {
          return { expense: [], income: [] };
        }
      }

      function saveCustomCategories(data) {
        try {
          localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(data));
        } catch (e) {
          console.error('儲存自訂類別失敗：', e);
        }
      }

      function getExpenseCategories() {
        const custom = loadCustomCategories();
        const map = new Map(DEFAULT_EXPENSE_CATEGORIES.map(c => [c.id, { ...c }]));
        (custom.expense || []).forEach(c => map.set(c.id, c));
        return Array.from(map.values());
      }

      function getIncomeCategories() {
        const custom = loadCustomCategories();
        const map = new Map(DEFAULT_INCOME_CATEGORIES.map(c => [c.id, { ...c }]));
        (custom.income || []).forEach(c => map.set(c.id, c));
        return Array.from(map.values());
      }

      // 2. 本地儲存與初始資料 (v3 乾淨全歸零狀態)
      const STORAGE_KEY = 'finflow_app_data_v3';


      const DEFAULT_ACCOUNTS = [
        {
          id: 'acc_bank_main',
          name: '台幣主要活存 (薪轉/日常)',
          type: 'liquid',
          bankName: '主要銀行活存',
          balance: 0,
          icon: '🏦',
          color: '#3B82F6'
        },
        {
          id: 'card_esun',
          name: '玉山銀行信用卡',
          type: 'credit',
          bankName: '玉山銀行',
          creditLimit: 60000,
          safeLimit: 18000, // 30% 信用安全線
          balance: 0,       // 當前待繳帳款歸零
          statementDay: 21, // 每月 21 號結帳
          dueDay: 6,        // 隔月 6 號繳款
          icon: '💳',
          color: '#059669'
        },
        {
          id: 'card_fubon',
          name: '富邦銀行信用卡',
          type: 'credit',
          bankName: '富邦銀行',
          creditLimit: 60000,
          safeLimit: 18000, // 30% 信用安全線
          balance: 0,       // 當前待繳帳款歸零
          statementDay: 24, // 每月 24 號結帳
          dueDay: 9,        // 隔月 9 號繳款
          icon: '💳',
          color: '#0284C7'
        },
        {
          id: 'acc_emergency',
          name: '🛡️ 緊急預備金專戶',
          type: 'emergency',
          bankName: '高利活存避風港',
          balance: 0,
          icon: '🛡️',
          color: '#6366F1'
        },
        {
          id: 'acc_invest',
          name: '📈 指數化投資專戶 (ETF)',
          type: 'investment',
          bankName: '證券交割戶',
          balance: 0,
          icon: '📈',
          color: '#8B5CF6'
        }
      ];

      const DEFAULT_TRANSACTIONS = [];

      function loadAppData() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) {
            const initial = { version: '4.0', accounts: DEFAULT_ACCOUNTS, transactions: DEFAULT_TRANSACTIONS };
            saveAppData(initial);
            return initial;
          }
          const parsed = JSON.parse(raw);
          // 自動補全結帳日與繳款日
          if (parsed.accounts) {
            parsed.accounts.forEach(acc => {
              if (acc.id === 'card_esun') {
                if (!acc.statementDay) acc.statementDay = 21;
                if (!acc.dueDay) acc.dueDay = 6;
              } else if (acc.id === 'card_fubon') {
                if (!acc.statementDay) acc.statementDay = 24;
                if (!acc.dueDay) acc.dueDay = 9;
              }
            });
          }
          return parsed;
        } catch (e) {
          return { version: '4.0', accounts: DEFAULT_ACCOUNTS, transactions: DEFAULT_TRANSACTIONS };
        }
      }

      // 有帳目之後,請瀏覽器把本站資料標記為「持久儲存」,降低被系統自動清除的機會(不支援的瀏覽器會直接略過)
      let persistRequested = false;
      function requestPersistentStorage(data) {
        if (persistRequested) return;
        if (!data || !Array.isArray(data.transactions) || data.transactions.length === 0) return;
        persistRequested = true;
        try {
          if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
          }
        } catch (e) {}
      }

      function saveAppData(data) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
        requestPersistentStorage(data);
      }

      // ===== 備份提醒 =====
      // 資料只存在這個瀏覽器裡,超過 30 天沒匯出備份就在首頁提醒;「稍後」會暫停提醒 7 天。
      // 使用獨立的 localStorage 鍵,不更動帳務資料的結構。
      const LAST_BACKUP_KEY = 'finflow_last_backup_v1';
      const BACKUP_SNOOZE_KEY = 'finflow_backup_snooze_v1';
      const BACKUP_REMIND_DAYS = 30;
      const BACKUP_SNOOZE_DAYS = 7;

      function readStored(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
      }

      function writeStored(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
      }

      // 兩個本地日期字串(YYYY-MM-DD)相差幾天;格式不正確回傳 null
      function daysSinceLocalDate(dateStr, now = new Date()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        const from = new Date(y, m - 1, d);
        const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.round((to - from) / 86400000);
      }

      function renderBackupReminder() {
        const box = document.getElementById('backup-reminder');
        const info = document.getElementById('backup-last-info');
        const lastBackup = readStored(LAST_BACKUP_KEY);
        const days = daysSinceLocalDate(lastBackup);

        if (info) {
          info.textContent = days === null
            ? '尚未備份過'
            : `上次備份：${lastBackup}（${days <= 0 ? '今天' : days + ' 天前'}）`;
        }
        if (!box) return;

        const hasData = ((appState && appState.transactions) || []).length > 0;
        const overdue = days === null || days >= BACKUP_REMIND_DAYS;
        const snoozeDays = daysSinceLocalDate(readStored(BACKUP_SNOOZE_KEY));
        const snoozed = snoozeDays !== null && snoozeDays >= 0 && snoozeDays < BACKUP_SNOOZE_DAYS;
        const show = hasData && overdue && !snoozed;

        box.hidden = !show;
        const title = document.getElementById('backup-reminder-title');
        if (show && title) {
          title.textContent = days === null ? '還沒有備份過您的帳務資料' : `已經 ${days} 天沒有備份了`;
        }
      }


      function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : '✨';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-10px)';
          setTimeout(() => toast.remove(), 300);
        }, 3200);
      }

      // 4. UI 渲染模組與狀態
      let appState = loadAppData();
      let currentFilter = 'all';
      let pendingPayCard = null;
      let currentReportType = 'month';
      let currentReportKey = getCurrentMonthKey();

      let currentEntryState = {
        type: 'expense',
        amount: 0,
        categoryId: 'food_daily',
        categoryName: '日常三餐',
        categoryIcon: '🍚',
        tag: 'need',
        accountId: 'card_esun',
        accountName: '玉山銀行信用卡',
        date: getLocalDateString(),
        note: ''
      };

      function renderDashboard() {
        renderBackupReminder();
        const { accounts, transactions } = appState;
        const currentMonth = getCurrentMonthKey();
        const realBalInfo = calculateRealAvailableBalance(accounts);
        const fin503020 = calculate503020(transactions, currentMonth);

        // 頂部四卡
        document.getElementById('val-real-available').textContent = formatCurrency(realBalInfo.realAvailable);
        document.getElementById('sub-real-available').innerHTML = `已扣除待繳卡費 ${formatCurrency(realBalInfo.totalCreditDebt)}（杜絕假性富裕）`;
        document.getElementById('val-total-income').textContent = formatCurrency(fin503020.totalIncome);
        document.getElementById('val-total-expense').textContent = formatCurrency(fin503020.totalExpense);
        document.getElementById('val-savings-rate').textContent = `${fin503020.savingsRate.toFixed(1)}%`;
        document.getElementById('sub-savings-rate').textContent = `淨存下 ${formatCurrency(fin503020.netSavings)}`;

        // V2 Hero 環形儲蓄率圖
        const heroRingFill = document.getElementById('hero-ring-fill');
        const heroRingPct = document.getElementById('hero-ring-pct');
        if (heroRingFill && heroRingPct) {
          const circumference = 251.3; // 2 * Math.PI * 40
          const pct = Math.min(100, Math.max(0, fin503020.savingsRate));
          const offset = circumference - (circumference * pct / 100);
          heroRingFill.setAttribute('stroke-dashoffset', offset.toFixed(1));
          heroRingPct.textContent = `${pct.toFixed(0)}%`;
        }

        // 雙信用卡 30% 信用風控
        const creditContainer = document.getElementById('credit-cards-container');
        const creditAccounts = accounts.filter(a => a.type === 'credit');
        creditContainer.innerHTML = '';

        creditAccounts.forEach(card => {
          const health = calculateCreditCardHealth(card, transactions, currentMonth);
          const isEsun = card.id === 'card_esun' || card.bankName.includes('玉山');
          const themeClass = isEsun ? 'card-esun-theme' : 'card-fubon-theme';
          const fillPercent = Math.min(100, health.utilizationRatio);
          let fillClass = health.statusLevel === 'warning' ? 'warning' : health.statusLevel === 'danger' ? 'danger' : '';

          const cardEl = document.createElement('div');
          cardEl.className = `credit-card-item ${themeClass}`;
          cardEl.innerHTML = `
            <div class="card-top">
              <div class="bank-identity">
                <div class="bank-chip"></div>
                <div>
                  <div class="bank-name-text">${card.bankName}</div>
                  <div class="bank-sub-text">總額度 ${formatCurrency(card.creditLimit)}</div>
                </div>
              </div>
              <span class="badge badge-${health.statusLevel}">${health.statusText}</span>
            </div>
            <div class="credit-card-number">•••• •••• •••• ${isEsun ? '8899' : '6688'}</div>
            <div class="credit-cycle-badge-wrap">
              <span class="cycle-tag statement">📅 結帳日：每月 ${card.statementDay || (isEsun ? 21 : 24)} 號</span>
              <span class="cycle-tag due">⏰ 繳款日：次月 ${card.dueDay || (isEsun ? 6 : 9)} 號</span>
            </div>
            <div class="utilization-gauge-wrap">
              <div class="gauge-header">
                <span>佔用待繳：<strong>${formatCurrency(health.currentUnpaid)}</strong> (${health.utilizationRatio.toFixed(1)}%)</span>
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
            <div class="card-footer-info">
              <div class="debt-amount-wrap">
                <div class="label">當前待繳總額</div>
                <div class="amount">${formatCurrency(card.balance)}</div>
              </div>
              <button class="btn-pay-bill" data-card-id="${card.id}">💳 繳納卡費</button>
            </div>
          `;
          creditContainer.appendChild(cardEl);
        });

        // 50/30/20 面板
        document.getElementById('ratio-cards-container').innerHTML = `
          <div class="ratio-box">
            <div class="ratio-box-header">
              <span class="ratio-tag-title text-need">🏠 50% 必要需求 (Needs)</span>
              <span class="badge badge-need">${fin503020.need.percent.toFixed(1)}%</span>
            </div>
            <div class="ratio-box-amount">${formatCurrency(fin503020.need.amount)}</div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${Math.min(100, fin503020.need.percent)}%; background: var(--color-need);"></div>
            </div>
            <div class="ratio-box-sub"><span>房租、三餐、水電等固定開銷</span><span>目標 ≤ 50%</span></div>
          </div>
          <div class="ratio-box">
            <div class="ratio-box-header">
              <span class="ratio-tag-title text-negative">🛍️ 30% 彈性慾望 (Wants)</span>
              <span class="badge badge-want">${fin503020.want.percent.toFixed(1)}%</span>
            </div>
            <div class="ratio-box-amount">${formatCurrency(fin503020.want.amount)}</div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${Math.min(100, fin503020.want.percent)}%; background: var(--color-want);"></div>
            </div>
            <div class="ratio-box-sub"><span>聚餐、購物、娛樂享受</span><span>目標 ≤ 30%</span></div>
          </div>
          <div class="ratio-box">
            <div class="ratio-box-header">
              <span class="ratio-tag-title text-invest">📈 20% 投資儲蓄 (Invest)</span>
              <span class="badge badge-invest">${fin503020.invest.percent.toFixed(1)}%</span>
            </div>
            <div class="ratio-box-amount">${formatCurrency(fin503020.invest.amount)}</div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${Math.min(100, fin503020.invest.percent)}%; background: var(--color-invest);"></div>
            </div>
            <div class="ratio-box-sub"><span>ETF複利、自我投資進修</span><span>目標 ≥ 20%</span></div>
          </div>
          <p style="grid-column: 1 / -1; margin: 4px 0 0; font-size: 0.72rem; color: var(--text-muted);">
            ${fin503020.ratioBasis === 'income' ? '比例 = 該類支出 ÷ 當月收入（未花掉的收入即為儲蓄）' : '本月尚無收入紀錄，暫以總支出為比例基準'}
          </p>
        `;

        // 財商診斷建議
        const diagContainer = document.getElementById('diagnostics-container');
        if (fin503020.diagnostics.length === 0) {
          diagContainer.innerHTML = `
            <div class="diagnostic-item success">
              <span>🎯</span>
              <div><strong>本月財務配置平衡</strong>：您的收支結構健康，持續堅持資產分流原則！</div>
            </div>
          `;
        } else {
          diagContainer.innerHTML = fin503020.diagnostics.map(d => `
            <div class="diagnostic-item ${d.type}">
              <span>${d.type === 'warning' ? '⚠️' : d.type === 'caution' ? '💡' : '🌟'}</span>
              <div><strong>${d.title}</strong>：${d.message}</div>
            </div>
          `).join('');
        }

        // 緊急預備金防護盾
        const emAcc = accounts.find(a => a.type === 'emergency') || { balance: 0 };
        const emHealth = calculateEmergencyFundHealth(emAcc.balance, fin503020.need.amount);
        document.getElementById('shield-balance').textContent = formatCurrency(emHealth.emergencyBalance);
        document.getElementById('shield-months').textContent = `${emHealth.monthsCovered} 個月`;
        document.getElementById('shield-progress-fill').style.width = `${emHealth.progressTo6Months}%`;
        const shieldBadge = document.getElementById('shield-badge');
        shieldBadge.textContent = emHealth.healthText;
        shieldBadge.style.color = emHealth.badgeColor;

        // 明細清單
        renderLedgerList();
      }

      function groupTransactionsByYearAndMonth(transactions) {
        const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const yearMap = new Map();
        
        sorted.forEach(tx => {
          const d = new Date(tx.date);
          const year = isNaN(d.getFullYear()) ? '其他年份' : String(d.getFullYear());
          const monthNum = isNaN(d.getMonth()) ? '00' : String(d.getMonth() + 1).padStart(2, '0');
          const monthKey = `${year}-${monthNum}`;

          if (!yearMap.has(year)) {
            yearMap.set(year, new Map());
          }
          const monthMap = yearMap.get(year);
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, {
              year,
              month: monthNum,
              monthKey,
              txs: [],
              totalExpense: 0,
              totalIncome: 0,
              needAmt: 0,
              wantAmt: 0,
              investAmt: 0,
              transferAmt: 0
            });
          }

          const mData = monthMap.get(monthKey);
          mData.txs.push(tx);

          const amt = Number(tx.amount) || 0;
          if (tx.type === 'income') {
            mData.totalIncome += amt;
          } else if (tx.type === 'transfer') {
            mData.transferAmt += amt;
          } else {
            mData.totalExpense += amt;
            if (tx.tag === 'need') mData.needAmt += amt;
            else if (tx.tag === 'want') mData.wantAmt += amt;
            else if (tx.tag === 'invest') mData.investAmt += amt;
          }
        });

        return yearMap;
      }

      // ===== 手風琴折疊展開狀態與月份篩選管理 =====
      const expandedMonthKeys = new Set();
      const monthSubFilters = new Map(); // monthKey -> 'all' | 'need' | 'want' | 'invest' | 'income' | 'transfer'
      let isFirstLedgerRender = true;

      function renderLedgerList() {
        const container = document.getElementById('transaction-list');
        if (!container) return;
        let filtered = [...(appState.transactions || [])];

        if (currentFilter === 'need') filtered = filtered.filter(t => t.tag === 'need' && t.type !== 'income' && t.type !== 'transfer');
        else if (currentFilter === 'want') filtered = filtered.filter(t => t.tag === 'want' && t.type !== 'income' && t.type !== 'transfer');
        else if (currentFilter === 'invest') filtered = filtered.filter(t => t.tag === 'invest' && t.type !== 'income' && t.type !== 'transfer');
        else if (currentFilter === 'income') filtered = filtered.filter(t => t.type === 'income');
        else if (currentFilter === 'card_esun') filtered = filtered.filter(t => t.accountId === 'card_esun' || t.toAccountId === 'card_esun');
        else if (currentFilter === 'card_fubon') filtered = filtered.filter(t => t.accountId === 'card_fubon' || t.toAccountId === 'card_fubon');

        if (filtered.length === 0) {
          container.innerHTML = `<div class="empty-state"><p>目前尚無符合篩選條件的交易紀錄</p></div>`;
          return;
        }

        const yearMap = groupTransactionsByYearAndMonth(filtered);
        const years = Array.from(yearMap.keys()).sort((a, b) => b.localeCompare(a));

        // 第一次渲染時，預設自動展開最新的一個月份
        if (isFirstLedgerRender && years.length > 0) {
          const firstYearMonths = Array.from(yearMap.get(years[0]).values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
          if (firstYearMonths.length > 0) {
            expandedMonthKeys.add(firstYearMonths[0].monthKey);
          }
          isFirstLedgerRender = false;
        }

        container.innerHTML = years.map(year => {
          const monthMap = yearMap.get(year);
          const months = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
          
          let yearTxsCount = 0;
          let yearExpense = 0;
          months.forEach(m => {
            yearTxsCount += m.txs.length;
            yearExpense += m.totalExpense;
          });

          const monthCardsHtml = months.map(m => {
            const isOpen = expandedMonthKeys.has(m.monthKey);
            const subFilter = monthSubFilters.get(m.monthKey) || 'all';

            const netSavings = m.totalIncome - m.totalExpense;
            const netSign = netSavings >= 0 ? '+' : '';
            const netColor = netSavings >= 0 ? '#10B981' : '#F43F5E';
            
            const totalExp = m.totalExpense;
            const needPct = totalExp > 0 ? (m.needAmt / totalExp) * 100 : 0;
            const wantPct = totalExp > 0 ? (m.wantAmt / totalExp) * 100 : 0;
            const investPct = totalExp > 0 ? (m.investAmt / totalExp) * 100 : 0;

            // 根據月內子篩選過濾當月交易
            let displayTxs = m.txs;
            if (subFilter === 'need') displayTxs = m.txs.filter(t => t.tag === 'need' && t.type !== 'income' && t.type !== 'transfer');
            else if (subFilter === 'want') displayTxs = m.txs.filter(t => t.tag === 'want' && t.type !== 'income' && t.type !== 'transfer');
            else if (subFilter === 'invest') displayTxs = m.txs.filter(t => t.tag === 'invest' && t.type !== 'income' && t.type !== 'transfer');
            else if (subFilter === 'income') displayTxs = m.txs.filter(t => t.type === 'income');
            else if (subFilter === 'transfer') displayTxs = m.txs.filter(t => t.type === 'transfer');

            const txRowsHtml = displayTxs.length === 0
              ? `<div class="empty-state" style="padding: 16px;"><p style="font-size:0.82rem; color:var(--text-muted);">此分類下尚無明細</p></div>`
              : displayTxs.map(tx => {
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';
                  let tagBadge = '';
                  if (isIncome) tagBadge = `<span class="badge badge-income">💰 收入</span>`;
                  else if (isTransfer) tagBadge = `<span class="badge badge-need">🔄 沖銷轉帳</span>`;
                  else if (tx.tag === 'need') tagBadge = `<span class="badge badge-need">50% 必要</span>`;
                  else if (tx.tag === 'want') tagBadge = `<span class="badge badge-want">30% 慾望</span>`;
                  else if (tx.tag === 'invest') tagBadge = `<span class="badge badge-invest">20% 投資</span>`;

                  const sign = isIncome ? '+' : (isTransfer ? '' : '-');
                  const amountColorClass = isIncome ? 'text-positive' : (isTransfer ? 'text-primary' : 'text-primary');

                  return `
                    <div class="transaction-row" data-tx-id="${tx.id}" title="點擊查看此筆帳務完整明細">
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
                        <div style="text-align: right;">
                          <div class="tx-amount money-amount ${amountColorClass}">${sign}${formatCurrency(tx.amount)}</div>
                          <span style="font-size: 0.68rem; color: #A5B4FC; font-weight: 500; display: inline-flex; align-items: center; gap: 2px; margin-top: 2px; opacity: 0.85;">🔍 查詳情</span>
                        </div>
                        <button class="btn-tx-delete" data-tx-id="${tx.id}" title="刪除本筆紀錄">🗑️</button>
                      </div>
                    </div>
                  `;
                }).join('');

            return `
              <div class="month-accordion-card ${isOpen ? 'open' : ''}" data-month-card="${m.monthKey}">
                <div class="month-accordion-header" data-toggle-month="${m.monthKey}" role="button" aria-expanded="${isOpen}">
                  <div class="month-card-header-top">
                    <div class="month-card-title-wrap">
                      <span class="month-badge-pill">📅 ${m.year} 年 ${m.month} 月</span>
                      <span class="month-tx-count-pill">${m.txs.length} 筆紀錄</span>
                    </div>
                    <div class="month-toggle-btn">
                      <span>${isOpen ? '收合' : '展開明細'}</span>
                      <span style="transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s; display: inline-block;">▼</span>
                    </div>
                  </div>

                  <div class="month-stats-row">
                    <div class="month-stat-item">
                      <span class="month-stat-label">💸 總支出</span>
                      <span class="month-stat-val text-negative">${formatCurrency(m.totalExpense)}</span>
                    </div>
                    <div class="month-stat-item">
                      <span class="month-stat-label">💰 總收入</span>
                      <span class="month-stat-val text-positive">${formatCurrency(m.totalIncome)}</span>
                    </div>
                    <div class="month-stat-item">
                      <span class="month-stat-label">⚖️ 淨結餘</span>
                      <span class="month-stat-val" style="color: ${netColor};">${netSign}${formatCurrency(netSavings)}</span>
                    </div>
                  </div>

                  ${totalExp > 0 ? `
                    <div class="month-ratio-mini-bar" title="50% 必要 (${needPct.toFixed(0)}%) / 30% 慾望 (${wantPct.toFixed(0)}%) / 20% 投資 (${investPct.toFixed(0)}%)">
                      <div class="month-ratio-mini-seg" style="width: ${needPct}%; background: var(--color-need);"></div>
                      <div class="month-ratio-mini-seg" style="width: ${wantPct}%; background: var(--color-want);"></div>
                      <div class="month-ratio-mini-seg" style="width: ${investPct}%; background: var(--color-invest);"></div>
                    </div>
                  ` : ''}
                </div>

                <div class="month-accordion-body">
                  <div class="month-inline-filter-bar">
                    <button type="button" class="month-filter-chip ${subFilter === 'all' ? 'active' : ''}" data-month-key="${m.monthKey}" data-month-filter="all">全部 (${m.txs.length})</button>
                    <button type="button" class="month-filter-chip ${subFilter === 'need' ? 'active' : ''}" data-month-key="${m.monthKey}" data-month-filter="need">🏠 50% 必要</button>
                    <button type="button" class="month-filter-chip ${subFilter === 'want' ? 'active' : ''}" data-month-key="${m.monthKey}" data-month-filter="want">🛍️ 30% 慾望</button>
                    <button type="button" class="month-filter-chip ${subFilter === 'invest' ? 'active' : ''}" data-month-key="${m.monthKey}" data-month-filter="invest">📈 20% 投資</button>
                    <button type="button" class="month-filter-chip ${subFilter === 'income' ? 'active' : ''}" data-month-key="${m.monthKey}" data-month-filter="income">💰 收入</button>
                    <button type="button" class="month-filter-chip ${subFilter === 'transfer' ? 'active' : ''}" data-month-key="${m.monthKey}" data-month-filter="transfer">🔄 沖銷轉帳</button>
                  </div>

                  <div class="month-tx-rows-container">
                    ${txRowsHtml}
                  </div>
                </div>
              </div>
            `;
          }).join('');

          return `
            <div class="year-group-section">
              <div class="year-group-header">
                <div class="year-group-title">
                  <span>📆 ${year} 年度</span>
                </div>
                <div class="year-group-badges">
                  <span class="year-group-badge">共 ${yearTxsCount} 筆</span>
                  <span class="year-group-badge" style="background: rgba(244, 63, 94, 0.12); color: #FDA4AF; border-color: rgba(244, 63, 94, 0.25);">年支出 ${formatCurrency(yearExpense)}</span>
                </div>
              </div>
              <div class="month-cards-grid">
                ${monthCardsHtml}
              </div>
            </div>
          `;
        }).join('');
      }

      function renderCategorySelectGrid(type = 'expense') {
        const container = document.getElementById('category-grid-select');
        if (!container) return;
        const list = type === 'income' ? getIncomeCategories() : getExpenseCategories();
        container.innerHTML = '';

        list.forEach((cat, index) => {
          const tile = document.createElement('div');
          tile.className = `category-tile ${index === 0 ? 'active' : ''}`;
          tile.dataset.catId = cat.id;
          tile.innerHTML = `<span class="tile-icon">${cat.icon}</span><span class="tile-name">${cat.name}</span>`;

          tile.addEventListener('click', () => {
            container.querySelectorAll('.category-tile').forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            currentEntryState.categoryId = cat.id;
            currentEntryState.categoryName = cat.name;
            currentEntryState.categoryIcon = cat.icon;

            if (type === 'expense' && cat.defaultTag) {
              currentEntryState.tag = cat.defaultTag;
              document.querySelectorAll('.tag-select-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tag === cat.defaultTag);
              });
            }
          });

          container.appendChild(tile);
        });

        if (list.length > 0) {
          currentEntryState.categoryId = list[0].id;
          currentEntryState.categoryName = list[0].name;
          currentEntryState.categoryIcon = list[0].icon;
          if (type === 'expense' && list[0].defaultTag) {
            currentEntryState.tag = list[0].defaultTag;
            document.querySelectorAll('.tag-select-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.tag === list[0].defaultTag);
            });
          }
        }
      }

      // ===== 收支類別自訂管理彈窗邏輯 =====
      let catMgrType = 'expense';
      let catMgrEditingId = null;
      let catMgrCallback = null;

      function openCategoryManagerModal(type = 'expense', onChangeCallback) {
        catMgrType = type;
        catMgrEditingId = null;
        catMgrCallback = onChangeCallback;

        const tabExpense = document.getElementById('catmgr-tab-expense');
        const tabIncome  = document.getElementById('catmgr-tab-income');
        if (tabExpense) tabExpense.classList.toggle('active', type === 'expense');
        if (tabIncome)  tabIncome.classList.toggle('active',  type === 'income');

        const tagWrap = document.getElementById('catmgr-tag-wrap');
        if (tagWrap) tagWrap.style.display = type === 'income' ? 'none' : '';

        renderCatMgrList();
        resetCatMgrForm();
        setupCatMgrEvents();

        document.getElementById('modal-category-manager')?.classList.add('active');
      }

      function renderCatMgrList() {
        const container = document.getElementById('catmgr-list');
        if (!container) return;

        const isExpense = catMgrType === 'expense';
        const custom    = loadCustomCategories();
        const customArr = isExpense ? (custom.expense || []) : (custom.income || []);
        const defaultArr = isExpense ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

        const map = new Map(defaultArr.map(c => [c.id, { ...c, _source: 'default' }]));
        customArr.forEach(c => map.set(c.id, { ...c, _source: 'custom' }));
        const all = Array.from(map.values());

        if (all.length === 0) {
          container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">尚無類別，請於下方新增。</div>';
          return;
        }

        const tagColors = { need: '#6366F1', want: '#F43F5E', invest: '#8B5CF6' };
        const tagLabels = { need: '必要', want: '慾望', invest: '投資' };

        container.innerHTML = all.map(cat => {
          const isCustom = cat._source === 'custom';
          const tagColor = tagColors[cat.defaultTag] || '#6B7280';
          const tagLabel = tagLabels[cat.defaultTag] || '';
          return `<div class="catmgr-row" data-cat-id="${cat.id}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--surface-border);border-radius:10px;">
            <span style="font-size:1.4rem;min-width:30px;text-align:center;">${cat.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.88rem;font-weight:600;color:#FFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cat.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                ${(isExpense && tagLabel) ? `<span style="font-size:0.68rem;padding:1px 7px;background:${tagColor}22;color:${tagColor};border-radius:20px;border:1px solid ${tagColor}44;">${tagLabel}</span>` : ''}
                <span style="font-size:0.68rem;color:${isCustom ? '#A5B4FC' : 'var(--text-muted)'};">${isCustom ? '✏️ 已自訂' : '📦 預設'}</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button type="button" class="catmgr-btn-edit" data-cat-id="${cat.id}" title="修改此類別" style="font-size:0.75rem;padding:4px 10px;background:rgba(165,180,252,0.15);border:1px solid rgba(165,180,252,0.3);border-radius:8px;color:#A5B4FC;cursor:pointer;">✏️ 修改</button>
              ${isCustom ? `<button type="button" class="catmgr-btn-delete" data-cat-id="${cat.id}" title="刪除此自訂類別" style="font-size:0.75rem;padding:4px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#F87171;cursor:pointer;">🗑️</button>` : ''}
            </div>
          </div>`;
        }).join('');
      }

      function resetCatMgrForm() {
        catMgrEditingId = null;
        const title    = document.getElementById('catmgr-form-title');
        const iconEl   = document.getElementById('catmgr-input-icon');
        const nameEl   = document.getElementById('catmgr-input-name');
        const tagEl    = document.getElementById('catmgr-input-tag');
        const cancelEl = document.getElementById('catmgr-btn-cancel-edit');
        if (title)    title.textContent = '✚ 新增類別';
        if (iconEl)   iconEl.value = '';
        if (nameEl)   nameEl.value = '';
        if (tagEl)    tagEl.value = 'need';
        if (cancelEl) cancelEl.style.display = 'none';
      }

      let catMgrEventsSetup = false;
      function setupCatMgrEvents() {
        if (catMgrEventsSetup) return;
        catMgrEventsSetup = true;

        document.getElementById('catmgr-tab-expense')?.addEventListener('click', () => {
          catMgrType = 'expense';
          document.getElementById('catmgr-tab-expense')?.classList.add('active');
          document.getElementById('catmgr-tab-income')?.classList.remove('active');
          const tagWrap = document.getElementById('catmgr-tag-wrap');
          if (tagWrap) tagWrap.style.display = '';
          renderCatMgrList();
          resetCatMgrForm();
        });

        document.getElementById('catmgr-tab-income')?.addEventListener('click', () => {
          catMgrType = 'income';
          document.getElementById('catmgr-tab-income')?.classList.add('active');
          document.getElementById('catmgr-tab-expense')?.classList.remove('active');
          const tagWrap = document.getElementById('catmgr-tag-wrap');
          if (tagWrap) tagWrap.style.display = 'none';
          renderCatMgrList();
          resetCatMgrForm();
        });

        document.getElementById('catmgr-btn-save')?.addEventListener('click', () => {
          const iconVal = (document.getElementById('catmgr-input-icon')?.value.trim()) || '📦';
          const nameVal = document.getElementById('catmgr-input-name')?.value.trim();
          const tagVal  = document.getElementById('catmgr-input-tag')?.value || 'need';
          if (!nameVal) {
            showToast('請輸入類別名稱！', 'warning');
            document.getElementById('catmgr-input-name')?.focus();
            return;
          }
          const custom    = loadCustomCategories();
          const isExpense = catMgrType === 'expense';
          const arr       = [...(isExpense ? (custom.expense || []) : (custom.income || []))];
          if (catMgrEditingId) {
            const idx = arr.findIndex(c => c.id === catMgrEditingId);
            const newCat = { id: catMgrEditingId, name: nameVal, icon: iconVal, ...(isExpense ? { defaultTag: tagVal } : {}) };
            if (idx >= 0) arr[idx] = newCat; else arr.push(newCat);
            showToast(`✅ 類別「${nameVal}」已修改完成！`, 'success');
          } else {
            const newId = 'custom_' + catMgrType + '_' + Date.now();
            arr.push({ id: newId, name: nameVal, icon: iconVal, ...(isExpense ? { defaultTag: tagVal } : {}) });
            showToast(`✅ 已新增類別「${nameVal}」！`, 'success');
          }
          if (isExpense) custom.expense = arr; else custom.income = arr;
          saveCustomCategories(custom);
          renderCatMgrList();
          resetCatMgrForm();
          if (typeof catMgrCallback === 'function') catMgrCallback(catMgrType);
        });

        document.getElementById('catmgr-btn-cancel-edit')?.addEventListener('click', () => {
          resetCatMgrForm();
        });

        document.getElementById('catmgr-list')?.addEventListener('click', (e) => {
          const editBtn = e.target.closest('.catmgr-btn-edit');
          if (editBtn) {
            const catId     = editBtn.dataset.catId;
            const isExpense = catMgrType === 'expense';
            const custom    = loadCustomCategories();
            const defaults  = isExpense ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
            const customArr = isExpense ? (custom.expense || []) : (custom.income || []);
            const cat = customArr.find(c => c.id === catId) || defaults.find(c => c.id === catId);
            if (!cat) return;
            catMgrEditingId = catId;
            document.getElementById('catmgr-input-icon').value = cat.icon || '';
            document.getElementById('catmgr-input-name').value = cat.name || '';
            if (isExpense && document.getElementById('catmgr-input-tag')) {
              document.getElementById('catmgr-input-tag').value = cat.defaultTag || 'need';
            }
            document.getElementById('catmgr-form-title').textContent = '✏️ 修改類別：' + cat.name;
            document.getElementById('catmgr-btn-cancel-edit').style.display = '';
            document.getElementById('catmgr-input-name')?.focus();
            return;
          }
          const delBtn = e.target.closest('.catmgr-btn-delete');
          if (delBtn) {
            const catId     = delBtn.dataset.catId;
            const custom    = loadCustomCategories();
            const isExpense = catMgrType === 'expense';
            if (isExpense) {
              custom.expense = (custom.expense || []).filter(c => c.id !== catId);
            } else {
              custom.income = (custom.income || []).filter(c => c.id !== catId);
            }
            saveCustomCategories(custom);
            if (catMgrEditingId === catId) resetCatMgrForm();
            renderCatMgrList();
            if (typeof catMgrCallback === 'function') catMgrCallback(catMgrType);
            showToast('已刪除自訂類別！', 'success');
          }
        });
      }

      function renderAccountSelectOptions(type = 'expense') {
        const container = document.getElementById('account-select-container');
        const defaultAccId = 'acc_bank_main';
        currentEntryState.accountId = defaultAccId;
        const targetAcc = appState.accounts.find(a => a.id === defaultAccId);
        currentEntryState.accountName = targetAcc ? targetAcc.name : '台幣主要活存 (薪轉/日常)';

        container.innerHTML = '';
        appState.accounts.forEach(acc => {
          const opt = document.createElement('div');
          let brandClass = acc.id === 'card_esun' ? 'esun' : acc.id === 'card_fubon' ? 'fubon' : '';
          opt.className = `account-option ${brandClass} ${acc.id === defaultAccId ? 'active' : ''}`;
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
            currentEntryState.accountId = acc.id;
            currentEntryState.accountName = acc.name;
            checkCreditRiskOnInput();
          });
          container.appendChild(opt);
        });
      }

      function checkCreditRiskOnInput() {
        const badge = document.getElementById('credit-warning-badge');
        if (!badge) return;

        if (currentEntryState.type === 'transfer') {
          badge.style.display = 'none';
          return;
        }

        const amtEl = document.getElementById('input-amount');
        const currentAmt = amtEl ? (Number(amtEl.value) || 0) : 0;
        const currentMonth = getCurrentMonthKey();
        const selectedAcc = appState.accounts.find(a => a.id === currentEntryState.accountId);

        if (!selectedAcc || selectedAcc.type !== 'credit') {
          badge.style.display = 'none';
          return;
        }

        const monthlySpent = (appState.transactions || [])
          .filter(tx => tx && tx.type === 'expense' && tx.accountId === selectedAcc.id && tx.date && tx.date.startsWith(currentMonth))
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const totalAfterThis = monthlySpent + currentAmt;
        const safeLimit = selectedAcc.safeLimit || 18000;

        if (totalAfterThis > safeLimit) {
          badge.style.display = 'inline-flex';
          badge.className = 'badge badge-danger';
          badge.textContent = `🚨 本筆將超 $18,000 安全線 (${formatCurrency(totalAfterThis)})`;
        } else if (totalAfterThis >= safeLimit * 0.8) {
          badge.style.display = 'inline-flex';
          badge.className = 'badge badge-warning';
          badge.textContent = `⚠️ 接近 30% 警戒線 (累計 ${formatCurrency(totalAfterThis)})`;
        } else {
          badge.style.display = 'none';
        }
      }

      function openEntryModal(type = 'expense') {
        const modal = document.getElementById('modal-entry');
        const today = getLocalDateString();
        const dateInput = document.getElementById('input-date');
        const amtInput = document.getElementById('input-amount');
        const noteInput = document.getElementById('input-note');
        const previewDisplay = document.getElementById('amount-preview-display');

        if (dateInput) dateInput.value = today;
        if (amtInput) amtInput.value = '';
        if (noteInput) noteInput.value = '';
        if (previewDisplay) previewDisplay.textContent = 'NT$ 0';

        currentEntryState.date = today;
        currentEntryState.amount = 0;

        const typeBtn = document.querySelector(`.type-toggle-btn[data-tx-type="${type}"]`);
        if (typeBtn) typeBtn.click();

        modal.classList.add('active');
        setTimeout(() => {
          if (amtInput) amtInput.focus();
        }, 100);
      }

      function populateReportPeriodSelect(type) {
        const select = document.getElementById('select-report-period');
        if (!select) return;
        const now = new Date();
        const curY = now.getFullYear();
        select.innerHTML = '';

        if (type === 'month') {
          for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${y}-${m}`;
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${y} 年 ${m} 月`;
            select.appendChild(opt);
          }
        } else if (type === 'quarter') {
          const curQ = Math.floor(now.getMonth() / 3) + 1;
          for (let i = 0; i < 6; i++) {
            let q = curQ - i;
            let y = curY;
            if (q <= 0) {
              q += 4;
              y -= 1;
            }
            const key = `${y}-Q${q}`;
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${y} 年 第 ${q} 季`;
            select.appendChild(opt);
          }
        } else if (type === 'year') {
          for (let i = 0; i < 3; i++) {
            const y = curY - i;
            const key = String(y);
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${y} 年度`;
            select.appendChild(opt);
          }
        }
        currentReportKey = select.value;
      }

      function renderReportsCenter(type = currentReportType, key = currentReportKey) {
        currentReportType = type;
        currentReportKey = key;
        const container = document.getElementById('report-content-container');
        if (!container) return;
        const report = generatePeriodReport(appState.transactions, type, key);

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

      // =========================================================================
      // 債務管理模組 (Debt Manager - 內嵌自包含)
      // =========================================================================


      let pendingDebtId = null;
      let currentDebtCategoryId = 'mortgage';

      function getDebts() {
        return Array.isArray(appState.debts) ? appState.debts : [];
      }

      function addDebt(debtData) {
        if (!Array.isArray(appState.debts)) appState.debts = [];
        const cat = DEBT_CATEGORIES.find(c => c.id === (debtData.category || 'other')) || DEBT_CATEGORIES[7];
        const newDebt = {
          id: `debt_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
          name: debtData.name.trim(),
          category: debtData.category || 'other',
          creditor: (debtData.creditor || '').trim(),
          totalAmount: Number(debtData.totalAmount) || 0,
          remaining: Number(debtData.remaining) || 0,
          monthlyPayment: Number(debtData.monthlyPayment) || 0,
          interestRate: Number(debtData.interestRate) || 0,
          dueDay: Number(debtData.dueDay) || 0,
          startDate: debtData.startDate || getLocalMonthString(),
          note: (debtData.note || '').trim(),
          isPaid: false,
          createdAt: new Date().toISOString()
        };
        appState.debts.unshift(newDebt);
        return newDebt;
      }

      function deleteDebtById(debtId) {
        if (!Array.isArray(appState.debts)) return false;
        const idx = appState.debts.findIndex(d => d.id === debtId);
        if (idx === -1) return false;
        appState.debts.splice(idx, 1);
        return true;
      }

      // 債務還款的計算已移至 core.js(applyDebtPayment),這裡保留原函式名稱供畫面流程呼叫
      function doMonthlyPayment(debtId, customAmount) {
        return applyDebtPayment(appState, debtId, customAmount);
      }

      function calcDebtSummary() {
        const debts = getDebts();
        const active = debts.filter(d => !d.isPaid);
        const paid   = debts.filter(d => d.isPaid);

        const totalRemaining   = active.reduce((s, d) => s + Number(d.remaining || 0), 0);
        const totalOriginal    = debts.reduce((s, d) => s + Number(d.totalAmount || 0), 0);
        const totalMonthly     = active.reduce((s, d) => s + Number(d.monthlyPayment || 0), 0);
        const totalAlreadyPaid = debts.reduce((s, d) => s + (Number(d.totalAmount||0) - Number(d.remaining||0)), 0);

        const totalAssets = (appState.accounts || []).reduce((s, a) => {
          if (a.type === 'credit') return s;
          return s + Math.max(0, Number(a.balance || 0));
        }, 0);

        const debtRatio = (totalAssets + totalRemaining) > 0
          ? Math.min(100, Math.round(totalRemaining / (totalAssets + totalRemaining) * 100))
          : (totalRemaining > 0 ? 100 : 0);

        const mainAcc = (appState.accounts || []).find(a => a.type === 'liquid');
        const mainBalance = mainAcc ? Number(mainAcc.balance || 0) : 0;
        const pressureRatio = mainBalance > 0
          ? Math.round(totalMonthly / mainBalance * 100)
          : (totalMonthly > 0 ? 100 : 0);

        const overallPct = totalOriginal > 0
          ? Math.round(totalAlreadyPaid / totalOriginal * 100) : 0;

        const debtsWithETA = active.map(d => {
          const monthly = Number(d.monthlyPayment || 0);
          const rem = Number(d.remaining || 0);
          const monthsLeft = monthly > 0 ? Math.ceil(rem / monthly) : null;
          const catInfo = DEBT_CATEGORIES.find(c => c.id === d.category) || DEBT_CATEGORIES[7];
          const paidAmt = Number(d.totalAmount || 0) - rem;
          const progress = Number(d.totalAmount) > 0
            ? Math.round(paidAmt / Number(d.totalAmount) * 100) : 0;
          return { ...d, monthsLeft, catInfo, progress, paidAmt };
        });

        return { totalRemaining, totalOriginal, totalMonthly, totalAlreadyPaid,
          totalAssets, debtRatio, pressureRatio, mainBalance, overallPct,
          activeCount: active.length, paidCount: paid.length, totalCount: debts.length,
          debtsWithETA, paidDebts: paid };
      }

      // --- 渲染函式 ---
      function renderDebtPage() {
        const s = calcDebtSummary();
        // 總覽卡片
        const el = (id) => document.getElementById(id);
        if (el('debt-val-total'))   el('debt-val-total').textContent   = formatCurrency(s.totalRemaining);
        if (el('debt-sub-total'))   el('debt-sub-total').textContent   = `共 ${s.activeCount} 筆未清償`;
        if (el('debt-val-monthly')) el('debt-val-monthly').textContent = formatCurrency(s.totalMonthly);
        if (el('debt-sub-monthly')) el('debt-sub-monthly').textContent = `活存 ${formatCurrency(s.mainBalance)}`;
        if (el('debt-val-ratio'))   el('debt-val-ratio').textContent   = `${s.debtRatio}%`;
        if (el('debt-sub-ratio'))   el('debt-sub-ratio').textContent   =
          s.debtRatio < 30 ? '✅ 負債比率健康' : s.debtRatio < 40 ? '⚠️ 接近警戒值' : '🚨 超過安全紅線';
        if (el('debt-val-paid'))    el('debt-val-paid').textContent    = `${s.paidCount} 筆`;
        if (el('debt-sub-paid'))    el('debt-sub-paid').textContent    = `累積已還 ${formatCurrency(s.totalAlreadyPaid)}`;

        // 壓力警示
        const bar = el('debt-pressure-bar');
        if (bar) {
          bar.className = 'debt-pressure-bar';
          if (s.totalMonthly === 0) {
            bar.classList.add('safe');
            el('debt-pressure-icon').textContent = '✅';
            el('debt-pressure-text').textContent = '目前無債務還款壓力，財務現金流健康。';
          } else if (s.pressureRatio < 30) {
            bar.classList.add('safe');
            el('debt-pressure-icon').textContent = '✅';
            el('debt-pressure-text').textContent = `月還款 ${formatCurrency(s.totalMonthly)} 佔活存 ${s.pressureRatio}%，現金流穩健。`;
          } else if (s.pressureRatio < 60) {
            bar.classList.add('warning');
            el('debt-pressure-icon').textContent = '⚠️';
            el('debt-pressure-text').textContent = `月還款 ${formatCurrency(s.totalMonthly)} 佔活存 ${s.pressureRatio}%，注意現金儲備。`;
          } else {
            bar.classList.add('danger');
            el('debt-pressure-icon').textContent = '🚨';
            el('debt-pressure-text').textContent = `月還款 ${formatCurrency(s.totalMonthly)} 佔活存 ${s.pressureRatio}%，現金流壓力極高！`;
          }
        }

        // 整體進度
        if (el('debt-overall-fill')) el('debt-overall-fill').style.width = `${s.overallPct}%`;
        if (el('debt-overall-pct'))  el('debt-overall-pct').textContent  = `${s.overallPct}%`;
        if (el('debt-progress-sub')) el('debt-progress-sub').textContent =
          s.totalCount === 0 ? '尚未建立任何債務紀錄'
            : `已還清 ${formatCurrency(s.totalAlreadyPaid)}，剩餘 ${formatCurrency(s.totalRemaining)}`;

        // 到期提示
        renderUpcomingPaymentsBanner();

        // 債務卡片
        renderDebtCards(s);

        // 已還清區塊
        const paidSec = el('debt-paid-section');
        const paidList = el('debt-paid-list');
        const paidBadge = el('paid-debts-count-badge');
        if (paidSec) paidSec.style.display = s.paidDebts.length > 0 ? 'block' : 'none';
        if (paidBadge) paidBadge.textContent = `${s.paidDebts.length} 筆`;
        if (paidList) {
          paidList.innerHTML = s.paidDebts.map(d => {
            const c = DEBT_CATEGORIES.find(x => x.id === d.category) || DEBT_CATEGORIES[7];
            
            // 擷取還款歷史 (只需精確到年月日)
            const historyTxs = (appState.transactions || []).filter(tx => tx.debtId === d.id).sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date).getTime();
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date).getTime();
              return timeB - timeA;
            });
            const historyHtml = historyTxs.map(tx => {
              return `<div class="debt-history-item">
                <span class="debt-history-time">📅 ${tx.date}</span>
                <span class="debt-history-amount">${formatCurrency(tx.amount)}</span>
              </div>`;
            }).join('');

            return `<div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:var(--radius-sm); margin-bottom:8px; padding:10px;">
              <div class="debt-paid-item" style="display:flex;justify-content:space-between;align-items:center; margin-bottom:8px;">
                <span style="display:flex;align-items:center;gap:8px;font-size:0.85rem;">
                  ${c.icon} ${d.name}
                  ${d.creditor ? `<span style="font-size:0.7rem;color:var(--text-muted)">${d.creditor}</span>` : ''}
                </span>
                <span style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:0.82rem;color:#6EE7B7;font-weight:700;">✅ 已還清</span>
                  <button class="btn btn-outline-danger btn-delete-debt" data-debt-id="${d.id}" style="padding:3px 8px;font-size:0.7rem;">🗑️</button>
                </span>
              </div>
              <button class="debt-history-toggle" data-debt-id="${d.id}" style="margin-top:0;">
                查看還款紀錄 (${historyTxs.length} 筆) ▾
              </button>
              <div class="debt-history-list" id="history-list-${d.id}">
                ${historyHtml || '<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:0.75rem;">目前尚無還款紀錄</div>'}
              </div>
            </div>`;
          }).join('');
        }
      }

      function renderUpcomingPaymentsBanner() {
        const section = document.getElementById('upcoming-payments-section');
        const listEl  = document.getElementById('upcoming-payments-list');
        if (!section || !listEl) return;
        const debts = getDebts();
        const today = new Date();
        const curDay = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const upcoming = debts
          .filter(d => !d.isPaid && d.dueDay > 0 && d.monthlyPayment > 0)
          .map(d => {
            const due = d.dueDay >= curDay ? d.dueDay - curDay : (daysInMonth - curDay) + d.dueDay;
            const c = DEBT_CATEGORIES.find(x => x.id === d.category) || DEBT_CATEGORIES[7];
            return { ...d, due, catInfo: c };
          })
          .sort((a, b) => a.due - b.due)
          .slice(0, 5);

        if (upcoming.length === 0) { section.style.display = 'none'; return; }
        section.style.display = 'flex';
        listEl.innerHTML = upcoming.map(d => {
          const cls = d.due === 0 ? 'urgent' : d.due <= 3 ? 'urgent' : d.due <= 7 ? 'soon' : 'ok';
          const label = d.due === 0 ? '今日到期' : `還剩 ${d.due} 天`;
          return `<div class="upcoming-item">
            <span class="upcoming-item-name">${d.catInfo.icon} ${d.name}
              <span style="font-size:0.7rem;color:var(--text-muted)">${formatCurrency(d.monthlyPayment)}</span>
            </span>
            <span class="upcoming-item-days ${cls}">${label}</span>
          </div>`;
        }).join('');
      }

      function renderDebtCards(s) {
        const container = document.getElementById('debt-cards-container');
        if (!container) return;
        if (s.debtsWithETA.length === 0) {
          container.innerHTML = `<div class="debt-empty-state">
            <div class="debt-empty-icon">🎉</div>
            <div class="debt-empty-title">目前無未清償債務</div>
            <div class="debt-empty-sub">點擊右上角「新增債務」<br>開始建立您的債務管理紀錄</div>
          </div>`;
          return;
        }
        container.innerHTML = s.debtsWithETA.map(d => {
          const fc = d.catInfo.color;
          const eta = d.monthsLeft !== null ? `約 ${d.monthsLeft} 個月還清` : '未設月還款';
          const rate = d.interestRate > 0 ? `年利率 ${d.interestRate}%` : '—';
          const due = d.dueDay > 0 ? `每月 ${d.dueDay} 號` : '—';
          
          // 擷取此債務的還款歷史
          const historyTxs = (appState.transactions || []).filter(tx => tx.debtId === d.id).sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date).getTime();
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date).getTime();
            return timeB - timeA;
          });
          const historyHtml = historyTxs.map(tx => {
            const dateObj = tx.timestamp ? new Date(tx.timestamp) : new Date(tx.date);
            // 格式化為 YYYY-MM-DD HH:mm
            const timeStr = isNaN(dateObj.getTime()) ? tx.date : 
              `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
            return `<div class="debt-history-item">
              <span class="debt-history-time">🕒 ${timeStr}</span>
              <span class="debt-history-amount">${formatCurrency(tx.amount)}</span>
            </div>`;
          }).join('');

          return `<div class="debt-card" data-debt-id="${d.id}">
            <div class="debt-card-top">
              <div class="debt-card-left">
                <div class="debt-cat-icon" style="background:${fc}22;border:1px solid ${fc}55">${d.catInfo.icon}</div>
                <div class="debt-card-info">
                  <div class="debt-card-name">${d.name}</div>
                  <div class="debt-card-meta">${d.creditor ? d.creditor + ' ･ ' : ''}${d.catInfo.name}</div>
                </div>
              </div>
              <div class="debt-card-right">
                <div class="debt-remaining-amount">${formatCurrency(d.remaining)}</div>
                <div class="debt-card-actions">
                  <button class="btn-pay-debt" data-debt-id="${d.id}">💸 本月還款</button>
                  <button class="btn btn-outline-danger btn-delete-debt" data-debt-id="${d.id}">🗑️</button>
                </div>
              </div>
            </div>
            <div class="debt-card-progress-wrap">
              <div class="debt-card-progress-labels">
                <span>已還 ${d.progress}%</span>
                <span>剩 ${formatCurrency(d.remaining)} / 原 ${formatCurrency(d.totalAmount)}</span>
              </div>
              <div class="debt-card-progress-track">
                <div class="debt-card-progress-fill" style="width:${d.progress}%;background:linear-gradient(90deg,${fc},${fc}aa)"></div>
              </div>
            </div>
            <div class="debt-card-kpi-row">
              <div class="debt-kpi-item"><span class="debt-kpi-label">月還款</span><span class="debt-kpi-value">${d.monthlyPayment > 0 ? formatCurrency(d.monthlyPayment) : '—'}</span></div>
              <div class="debt-kpi-item"><span class="debt-kpi-label">還款日</span><span class="debt-kpi-value">${due}</span></div>
              <div class="debt-kpi-item"><span class="debt-kpi-label">利率</span><span class="debt-kpi-value">${rate}</span></div>
              <div class="debt-kpi-item"><span class="debt-kpi-label">預計還清</span><span class="debt-kpi-value">${eta}</span></div>
            </div>
            ${d.note ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:8px">📝 ${d.note}</div>` : ''}
            
            <button class="debt-history-toggle" data-debt-id="${d.id}">
              查看還款紀錄 (${historyTxs.length} 筆) ▾
            </button>
            <div class="debt-history-list" id="history-list-${d.id}">
              ${historyHtml || '<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:0.75rem;">目前尚無還款紀錄</div>'}
            </div>
          </div>`;
        }).join('');
      }

      // --- Tab Bar 切換 ---
      function switchPage(pageId) {
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.page === pageId);
          b.setAttribute('aria-selected', b.dataset.page === pageId ? 'true' : 'false');
        });
        document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`page-${pageId}`);
        if (target) target.classList.add('active');
        if (pageId === 'debt') renderDebtPage();
      }

      // --- 開啟新增債務 Modal ---
      function openAddDebtModal() {
        currentDebtCategoryId = DEBT_CATEGORIES[0].id;
        const catGrid = document.getElementById('debt-cat-grid');
        if (catGrid) {
          catGrid.innerHTML = DEBT_CATEGORIES.map(c =>
            `<button type="button" class="debt-cat-btn ${c.id === currentDebtCategoryId ? 'active' : ''}" data-cat-id="${c.id}">
              <span class="dcat-icon">${c.icon}</span>
              <span class="dcat-name">${c.name}</span>
            </button>`).join('');
          catGrid.querySelectorAll('.debt-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              catGrid.querySelectorAll('.debt-cat-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              currentDebtCategoryId = btn.dataset.catId;
            });
          });
        }
        ['debt-input-name','debt-input-creditor','debt-input-total',
         'debt-input-remaining','debt-input-monthly','debt-input-rate',
         'debt-input-dueday','debt-input-note'].forEach(id => {
          const e = document.getElementById(id); if (e) e.value = '';
        });
        const startEl = document.getElementById('debt-input-start');
        if (startEl) startEl.value = getLocalMonthString();
        document.getElementById('modal-add-debt')?.classList.add('active');
      }

      // --- 儲存新增債務 ---
      function handleSaveDebt() {
        const name = document.getElementById('debt-input-name')?.value.trim();
        const total = Number(document.getElementById('debt-input-total')?.value) || 0;
        const rem   = Number(document.getElementById('debt-input-remaining')?.value) || 0;
        if (!name) { showToast('請填寫債務名稱！', 'error'); return; }
        if (total <= 0) { showToast('請填寫借款總額！', 'error'); return; }
        if (rem < 0 || rem > total) { showToast('剩餘金額不合理（不可大於借款總額）！', 'error'); return; }

        addDebt({
          name, category: currentDebtCategoryId,
          creditor: document.getElementById('debt-input-creditor')?.value || '',
          totalAmount: total, remaining: rem,
          monthlyPayment: Number(document.getElementById('debt-input-monthly')?.value) || 0,
          interestRate: Number(document.getElementById('debt-input-rate')?.value) || 0,
          dueDay: Number(document.getElementById('debt-input-dueday')?.value) || 0,
          startDate: document.getElementById('debt-input-start')?.value || '',
          note: document.getElementById('debt-input-note')?.value || ''
        });
        saveAppData(appState);
        document.getElementById('modal-add-debt')?.classList.remove('active');
        renderDebtPage();
        showToast(`✅ 已新增債務【${name}】剩餘 ${formatCurrency(rem)}！`, 'success');
      }

      // --- 開啟月還款確認 Modal ---
      function openDebtPayModal(debtId) {
        const debt = getDebts().find(d => d.id === debtId);
        if (!debt) return;
        pendingDebtId = debtId;
        const nameEl   = document.getElementById('debt-pay-name');
        const amtEl    = document.getElementById('debt-pay-amount-display');
        const prevEl   = document.getElementById('debt-pay-remaining-preview');
        const custEl   = document.getElementById('debt-pay-custom-amount');
        if (nameEl) nameEl.textContent = `${debt.name}${debt.creditor ? ` (${debt.creditor})` : ''}`;
        if (amtEl)  amtEl.textContent  = formatCurrency(debt.monthlyPayment);
        if (custEl) custEl.value = '';
        const afterPay = Math.max(0, Number(debt.remaining) - Number(debt.monthlyPayment));
        if (prevEl) prevEl.textContent = `按月還款額後剩餘：${formatCurrency(afterPay)}`;
        if (custEl) {
          custEl.oninput = () => {
            const v = Number(custEl.value) || Number(debt.monthlyPayment);
            const after = Math.max(0, Number(debt.remaining) - v);
            if (amtEl)  amtEl.textContent  = formatCurrency(v);
            if (prevEl) prevEl.textContent = `還款後剩餘：${formatCurrency(after)}`;
          };
        }
        document.getElementById('modal-debt-pay')?.classList.add('active');
      }

      // --- 確認執行還款 ---
      function handleConfirmDebtPay() {
        if (!pendingDebtId) return;
        const custEl = document.getElementById('debt-pay-custom-amount');
        const cust = custEl ? (Number(custEl.value) || null) : null;
        const newTx = doMonthlyPayment(pendingDebtId, cust);
        if (!newTx) { showToast('還款金額有誤，請確認！', 'error'); return; }
        saveAppData(appState);
        document.getElementById('modal-debt-pay')?.classList.remove('active');
        renderDashboard(); // 同步儀表板
        renderDebtPage();
        const debt = getDebts().find(d => d.id === pendingDebtId);
        const msg = debt?.isPaid
          ? `🎉 恭喜！債務【${newTx.categoryName.replace('債務還款：','')}】已完全還清！`
          : `✅ 已還款 ${formatCurrency(newTx.amount)}，資金已同步扣除！`;
        showToast(msg, 'success');
        pendingDebtId = null;
      }

      // =========================================================================
      // 單一 DOMContentLoaded 事件處理器
      // =========================================================================
      document.addEventListener('DOMContentLoaded', () => {
        renderDashboard();
        renderDebtPage();

        // 每日金句
        const randQuote = WEALTH_QUOTES[Math.floor(Math.random() * WEALTH_QUOTES.length)];
        const quoteEl = document.getElementById('daily-wisdom-quote');
        const authorEl = document.getElementById('daily-wisdom-author');
        if (quoteEl) quoteEl.textContent = `“${randQuote.quote}”`;
        if (authorEl) authorEl.textContent = `—— ${randQuote.author}`;

        // 頂部導航列「➕ 記一筆」按鈕
        const quickHeaderBtn = document.getElementById('btn-quick-add-header');
        if (quickHeaderBtn) {
          quickHeaderBtn.addEventListener('click', () => openEntryModal());
        }

        // 關閉 Modal 按鈕
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const modal = btn.closest('.modal-overlay');
            if (modal) {
              modal.classList.remove('active');
            } else {
              document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            }
          });
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
          });
        });

        // 管理類別按鈕
        const btnManageCategories = document.getElementById('btn-open-category-manager-from-entry');
        if (btnManageCategories) {
          btnManageCategories.addEventListener('click', () => {
            openCategoryManagerModal(currentEntryState.type || 'expense', () => {
              renderCategorySelectGrid(currentEntryState.type || 'expense');
            });
          });
        }

        // 類型切換 (支出 / 收入 / 轉帳)
        document.querySelectorAll('.type-toggle-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.dataset.txType;
            currentEntryState.type = type;

            const tagGroup = document.getElementById('group-tag-select');
            const accountGroup = document.getElementById('group-account-select');
            const categoryGroup = document.getElementById('group-category-select');
            const transferGroup = document.getElementById('group-transfer-fields');
            const categoryHint = document.getElementById('selected-category-hint');

            if (type === 'transfer') {
              if (tagGroup) tagGroup.style.display = 'none';
              if (accountGroup) accountGroup.style.display = 'none';
              if (categoryGroup) categoryGroup.style.display = 'none';
              if (transferGroup) transferGroup.style.display = 'block';

              currentEntryState.tag = 'transfer';
              currentEntryState.categoryId = 'transfer';
              currentEntryState.categoryName = '帳戶內部轉帳';
              currentEntryState.categoryIcon = '🔄';

              const fromSelect = document.getElementById('select-transfer-from');
              const toSelect = document.getElementById('select-transfer-to');
              if (fromSelect && toSelect) {
                fromSelect.innerHTML = appState.accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>`).join('');
                toSelect.innerHTML = appState.accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>`).join('');
                fromSelect.value = 'acc_bank_main';
                toSelect.value = 'acc_emergency';
              }

              document.querySelectorAll('[data-transfer-preset]').forEach(pBtn => {
                pBtn.onclick = () => {
                  const preset = pBtn.dataset.transferPreset;
                  fromSelect.value = 'acc_bank_main';
                  if (preset === 'emergency') toSelect.value = 'acc_emergency';
                  if (preset === 'invest') toSelect.value = 'acc_invest';
                  if (preset === 'esun') toSelect.value = 'card_esun';
                  if (preset === 'fubon') toSelect.value = 'card_fubon';
                  showToast(`已套用：${pBtn.textContent}`, 'success');
                };
              });
              return;
            }

            if (transferGroup) transferGroup.style.display = 'none';
            if (categoryGroup) categoryGroup.style.display = 'block';
            if (accountGroup) accountGroup.style.display = 'block';

            if (type === 'income') {
              currentEntryState.tag = 'income';
              if (tagGroup) tagGroup.style.display = 'none';
              if (categoryHint) categoryHint.textContent = '入帳時將提供 50/30/20 智能分流建議';
            } else {
              if (tagGroup) tagGroup.style.display = 'block';
              if (categoryHint) categoryHint.textContent = '自動關聯財商標籤（可手動微調）';
            }

            renderCategorySelectGrid(type);
            renderAccountSelectOptions(type);
            checkCreditRiskOnInput();
          });
        });

        // 財商標籤按鈕
        document.querySelectorAll('.tag-select-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.tag-select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentEntryState.tag = btn.dataset.tag;
          });
        });

        // 輸入金額即時千分位大字確認與風控檢查
        const inputAmount = document.getElementById('input-amount');
        const previewDisplay = document.getElementById('amount-preview-display');
        if (inputAmount) {
          inputAmount.addEventListener('input', () => {
            const rawVal = inputAmount.value;
            const val = Number(rawVal) || 0;
            if (previewDisplay) {
              previewDisplay.textContent = formatCurrency(val);
            }
            checkCreditRiskOnInput();
          });
        }

        // 提交記帳 (含轉帳與收支)
        const submitEntryBtn = document.getElementById('btn-submit-entry');
        if (submitEntryBtn) {
          submitEntryBtn.addEventListener('click', () => {
            const amtInput = document.getElementById('input-amount');
            const amount = Number(amtInput.value);
            if (!amount || amount <= 0) {
              showToast('請輸入正確金額！', 'error');
              amtInput.focus();
              return;
            }

            const dateInput = document.getElementById('input-date').value || getLocalDateString();
            const noteInput = document.getElementById('input-note').value.trim();

            // 處理轉帳
            if (currentEntryState.type === 'transfer') {
              const fromId = document.getElementById('select-transfer-from').value;
              const toId = document.getElementById('select-transfer-to').value;
              if (fromId === toId) {
                showToast('轉出與轉入帳戶不能相同！', 'error');
                return;
              }

              const fromAcc = appState.accounts.find(a => a.id === fromId);
              const toAcc = appState.accounts.find(a => a.id === toId);

              if (fromAcc && toAcc) {
                if (fromAcc.type === 'credit') fromAcc.balance = Number(fromAcc.balance || 0) + amount;
                else fromAcc.balance = Number(fromAcc.balance || 0) - amount;

                if (toAcc.type === 'credit') toAcc.balance = Math.max(0, Number(toAcc.balance || 0) - amount);
                else toAcc.balance = Number(toAcc.balance || 0) + amount;

                const newTx = {
                  id: `tx_transfer_${Date.now()}`,
                  type: 'transfer',
                  amount: amount,
                  categoryId: 'transfer',
                  categoryName: `轉帳：${fromAcc.name} ➔ ${toAcc.name}`,
                  categoryIcon: '🔄',
                  tag: 'transfer',
                  accountId: fromAcc.id,
                  accountName: fromAcc.name,
                  toAccountId: toAcc.id,
                  toAccountName: toAcc.name,
                  date: dateInput,
                  note: noteInput ? noteInput : `內部資金調配 (${fromAcc.name} ➔ ${toAcc.name})`
                };

                appState.transactions.unshift(newTx);
                saveAppData(appState);
                document.getElementById('modal-entry').classList.remove('active');
                renderDashboard();
                showToast(`🎉 成功完成轉帳 ${formatCurrency(amount)}！信用卡待繳款與資產結構已同步更新。`, 'success');
                return;
              }
            }

            // 常規收支
            const newTx = {
              id: `tx_${Date.now()}`,
              type: currentEntryState.type,
              amount: amount,
              categoryId: currentEntryState.categoryId,
              categoryName: currentEntryState.categoryName,
              categoryIcon: currentEntryState.categoryIcon,
              tag: currentEntryState.tag,
              accountId: currentEntryState.accountId,
              accountName: currentEntryState.accountName,
              date: dateInput,
              note: noteInput
            };

            const targetAcc = appState.accounts.find(a => a.id === newTx.accountId);
            if (targetAcc) {
              if (newTx.type === 'expense') {
                if (targetAcc.type === 'credit') targetAcc.balance = Number(targetAcc.balance || 0) + amount;
                else targetAcc.balance = Number(targetAcc.balance || 0) - amount;
              } else if (newTx.type === 'income') {
                targetAcc.balance = Number(targetAcc.balance || 0) + amount;
              }
            }

            appState.transactions.unshift(newTx);
            saveAppData(appState);
            document.getElementById('modal-entry').classList.remove('active');
            renderDashboard();
            showToast(`已成功記錄【${newTx.categoryName}】${formatCurrency(amount)}！`, 'success');

            if (newTx.type === 'income' && amount >= 5000) {
              setTimeout(() => {
                const modalSplit = document.getElementById('modal-split-advisor');
                document.getElementById('split-total-amount').textContent = formatCurrency(amount);
                document.getElementById('split-need-amt').textContent = formatCurrency(Math.round(amount * 0.5));
                document.getElementById('split-want-amt').textContent = formatCurrency(Math.round(amount * 0.3));
                document.getElementById('split-invest-amt').textContent = formatCurrency(Math.round(amount * 0.2));
                modalSplit.classList.add('active');
              }, 400);
            }
          });
        }

        // 篩選標籤
        document.querySelectorAll('.filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderLedgerList();
          });
        });

        // 統一刪除交易邏輯（包含明細詳情彈窗與列表刪除）
        function handleDeleteTxById(txId) {
          const txIndex = (appState.transactions || []).findIndex(t => t.id === txId);
          if (txIndex === -1) return;
          const tx = appState.transactions[txIndex];
          if (confirm(`確定要刪除【${tx.categoryName}】${formatCurrency(tx.amount)} 的紀錄嗎？\n此操作將同步回退關聯帳戶餘額與信用卡待繳款。${tx.debtId ? '\n此筆為債務還款，也會一併回復該債務的剩餘金額。' : ''}`)) {
            // 回退帳戶餘額、信用卡待繳款與(若為債務還款)債務剩餘金額,邏輯在 core.js 的 deleteTransactionFromState
            deleteTransactionFromState(appState, txId);
            saveAppData(appState);
            renderDashboard();
            showToast('已刪除紀錄並回退餘額！', 'success');
          }
        }

        // 開啟交易明細詳情 Modal
        function openTxDetailModal(txId) {
          const tx = (appState.transactions || []).find(t => t.id === txId);
          if (!tx) return;

          const isIncome = tx.type === 'income';
          const isTransfer = tx.type === 'transfer';
          const sign = isIncome ? '+' : (isTransfer ? '' : '-');
          const amountColorClass = isIncome ? 'text-positive' : (isTransfer ? 'text-primary' : 'text-primary');

          // 圖示與大金額
          document.getElementById('tx-detail-icon').textContent = tx.categoryIcon || (isIncome ? '💰' : (isTransfer ? '🔄' : '💸'));
          const elAmt = document.getElementById('tx-detail-amount');
          elAmt.className = `tx-detail-hero-amount money-amount ${amountColorClass}`;
          elAmt.textContent = `${sign}${formatCurrency(tx.amount)}`;

          document.getElementById('tx-detail-category').textContent = tx.categoryName || '未分類';

          // 標籤徽章
          const elBadge = document.getElementById('tx-detail-type-badge');
          if (isIncome) {
            elBadge.innerHTML = `<span class="badge badge-income" style="font-size:0.85rem; padding: 4px 10px;">💰 收入入帳</span>`;
          } else if (isTransfer) {
            elBadge.innerHTML = `<span class="badge badge-need" style="font-size:0.85rem; padding: 4px 10px;">🔄 內部資產調配 / 沖銷</span>`;
          } else if (tx.tag === 'need') {
            elBadge.innerHTML = `<span class="badge badge-need" style="font-size:0.85rem; padding: 4px 10px;">🏠 50% 必要需求</span>`;
          } else if (tx.tag === 'want') {
            elBadge.innerHTML = `<span class="badge badge-want" style="font-size:0.85rem; padding: 4px 10px;">🛍️ 30% 彈性慾望</span>`;
          } else if (tx.tag === 'invest') {
            elBadge.innerHTML = `<span class="badge badge-invest" style="font-size:0.85rem; padding: 4px 10px;">📈 20% 投資儲蓄</span>`;
          } else {
            elBadge.innerHTML = `<span class="badge" style="font-size:0.85rem; padding: 4px 10px;">一般交易</span>`;
          }

          // 星期幾計算
          let dayName = '';
          try {
            const dateObj = new Date(tx.date);
            const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            if (!isNaN(dateObj.getTime())) {
              dayName = ` (${days[dateObj.getDay()]})`;
            }
          } catch(e) {}

          document.getElementById('tx-detail-date').textContent = `${tx.date}${dayName}`;
          
          if (isTransfer) {
            document.getElementById('tx-detail-account').textContent = `${tx.accountName || '轉出戶'} ➔ ${tx.toAccountName || '轉入戶'}`;
          } else {
            document.getElementById('tx-detail-account').textContent = tx.accountName || '活存';
          }

          let tagDesc = '一般交易紀錄';
          if (isIncome) tagDesc = '收入總額（建議遵循 50/30/20 進行自動化分流）';
          else if (isTransfer) tagDesc = '帳戶間調配沖銷（不重疊列入生活支出）';
          else if (tx.tag === 'need') tagDesc = '50% 必要需求（維持生命基本開支）';
          else if (tx.tag === 'want') tagDesc = '30% 彈性慾望（個人享受與休閒品味）';
          else if (tx.tag === 'invest') tagDesc = '20% 投資儲蓄（長期資產複利累積）';
          document.getElementById('tx-detail-tag').textContent = tagDesc;

          document.getElementById('tx-detail-id').textContent = tx.id || 'N/A';

          // 備註展示
          const elNote = document.getElementById('tx-detail-note');
          elNote.textContent = tx.note ? tx.note : '（此筆紀錄無填寫備註）';

          // 智慧影響診斷
          const elImpactBox = document.getElementById('tx-detail-impact');
          const elImpactText = document.getElementById('tx-detail-impact-text');

          if (isTransfer) {
            elImpactBox.className = 'diagnostic-item info';
            elImpactText.innerHTML = `<strong>資產調配沖銷</strong>：屬於內部資金移轉，已同步更新轉出與轉入帳戶（若轉入信用卡已即時扣抵待繳款並釋出信用額度），不重複計入生活支出。`;
          } else if (tx.accountId === 'card_esun' || tx.accountId === 'card_fubon') {
            elImpactBox.className = 'diagnostic-item caution';
            elImpactText.innerHTML = `<strong>信用卡風控提示</strong>：此筆款項計入【${tx.accountName}】之待繳款，系統已自「真實可用現金」中即時扣除，確保您遠離假性富裕，並持續嚴守 30% 額度安全紅線（$18,000）！`;
          } else if (tx.tag === 'need') {
            elImpactBox.className = 'diagnostic-item info';
            elImpactText.innerHTML = `<strong>必要開支評估</strong>：此類固定需求開銷是衡量「緊急預備金（3~6個月）」的重要基準，精準記帳讓資產護城河更穩固。`;
          } else if (tx.tag === 'want') {
            elImpactBox.className = 'diagnostic-item warning';
            elImpactText.innerHTML = `<strong>慾望開支提醒</strong>：屬於適度犒賞性質，請確認本月 30% 慾望預算是否充裕，享受當下同時也保護未來。`;
          } else if (tx.tag === 'invest') {
            elImpactBox.className = 'diagnostic-item success';
            elImpactText.innerHTML = `<strong>資產滾動利多</strong>：這筆資金正為您的長期財務自由工作，恭喜持續貫徹 20% 投資儲蓄原則！`;
          } else {
            elImpactBox.className = 'diagnostic-item success';
            elImpactText.innerHTML = `<strong>財務健康</strong>：此筆交易已正確記入本地帳本，所有即時圖表與總額均已動態同步更新。`;
          }

          // 綁定彈窗內刪除按鈕
          const delBtn = document.getElementById('btn-tx-detail-delete');
          if (delBtn) {
            delBtn.onclick = () => {
              document.getElementById('modal-tx-detail').classList.remove('active');
              handleDeleteTxById(tx.id);
            };
          }

          document.getElementById('modal-tx-detail').classList.add('active');
        }

        // 全域委派點擊事件 (手風琴展開/收合、月份篩選、單筆詳情查看、刪除、卡片繳費等)
        document.addEventListener('click', (e) => {
          // 1. 刪除單筆交易按鈕
          const deleteBtn = e.target.closest('.btn-tx-delete');
          if (deleteBtn) {
            e.stopPropagation();
            const txId = deleteBtn.dataset.txId;
            handleDeleteTxById(txId);
            return;
          }

          // 2. 點擊月份內嵌篩選標籤
          const monthFilterChip = e.target.closest('.month-filter-chip');
          if (monthFilterChip) {
            e.stopPropagation();
            const mKey = monthFilterChip.dataset.monthKey;
            const f = monthFilterChip.dataset.monthFilter;
            if (mKey && f) {
              monthSubFilters.set(mKey, f);
              renderLedgerList();
              return;
            }
          }

          // 3. 點擊手風琴頭部（切換該月份展開/收合）
          const toggleHeader = e.target.closest('[data-toggle-month]');
          if (toggleHeader) {
            const mKey = toggleHeader.dataset.toggleMonth;
            if (mKey) {
              if (expandedMonthKeys.has(mKey)) {
                expandedMonthKeys.delete(mKey);
              } else {
                expandedMonthKeys.add(mKey);
              }
              renderLedgerList();
              return;
            }
          }

          // 4. 點擊交易紀錄列查看詳情（單一乾淨彈窗，無疊加遮蔽問題）
          const txRow = e.target.closest('.transaction-row');
          if (txRow) {
            const txId = txRow.dataset.txId;
            if (txId) {
              openTxDetailModal(txId);
              return;
            }
          }

          // 5. 點擊信用卡上的「繳納卡費」按鈕
          const payBillBtn = e.target.closest('.btn-pay-bill');
          if (payBillBtn) {
            const cardId = payBillBtn.dataset.cardId;
            const card = appState.accounts.find(a => a.id === cardId);
            if (!card) return;
            pendingPayCard = card;
            document.getElementById('pay-bill-card-name').textContent = `${card.bankName} (${card.name})`;
            document.getElementById('pay-bill-amount-display').textContent = formatCurrency(card.balance);

            const selectSrc = document.getElementById('select-pay-source-account');
            const liquidAccs = appState.accounts.filter(a => a.type === 'liquid' || a.type === 'bank' || a.type === 'cash');
            selectSrc.innerHTML = liquidAccs.map(a => `<option value="${a.id}">${a.name} (餘額: ${formatCurrency(a.balance)})</option>`).join('');

            const custAmtInput = document.getElementById('pay-bill-custom-amount');
            if (custAmtInput) custAmtInput.value = '';

            document.getElementById('modal-pay-bill').classList.add('active');
          }
        });

        // 確認繳清卡費
        const btnConfirmPay = document.getElementById('btn-confirm-pay-bill');
        if (btnConfirmPay) {
          btnConfirmPay.addEventListener('click', () => {
            if (!pendingPayCard) return;
            const billAmount = Number(pendingPayCard.balance || 0);
            if (billAmount <= 0) {
              showToast('目前此卡無待繳帳款！', 'warning');
              document.getElementById('modal-pay-bill').classList.remove('active');
              return;
            }

            let payAmount = billAmount;
            const custAmtInput = document.getElementById('pay-bill-custom-amount');
            if (custAmtInput && custAmtInput.value.trim() !== '') {
              const val = Number(custAmtInput.value);
              if (!isNaN(val) && val > 0) payAmount = val;
            }

            const selectSrc = document.getElementById('select-pay-source-account');
            const srcAcc = appState.accounts.find(a => a.id === selectSrc.value);
            if (srcAcc) {
              if (srcAcc.balance < payAmount) {
                if (!confirm(`警告：轉出活存帳戶餘額 (${formatCurrency(srcAcc.balance)}) 小於本次繳納金額 (${formatCurrency(payAmount)})，確定繼續扣款嗎？`)) {
                  return;
                }
              }
              srcAcc.balance = Number(srcAcc.balance) - payAmount;
            }
            pendingPayCard.balance = Math.max(0, Number(pendingPayCard.balance) - payAmount);

            appState.transactions.unshift({
              id: `tx_pay_${Date.now()}`,
              type: 'transfer',
              amount: payAmount,
              categoryId: 'transfer',
              categoryName: `繳納${pendingPayCard.bankName}卡費`,
              categoryIcon: '💳',
              tag: 'transfer',
              accountId: srcAcc ? srcAcc.id : 'acc_bank_main',
              accountName: srcAcc ? srcAcc.name : '主要活存',
              toAccountId: pendingPayCard.id,
              toAccountName: pendingPayCard.name,
              date: getLocalDateString(),
              note: `沖銷結清 ${pendingPayCard.name} 待繳款（內部轉帳，無重複計算）`
            });

            saveAppData(appState);
            document.getElementById('modal-pay-bill').classList.remove('active');
            renderDashboard();
            showToast(`🎉 成功繳納 ${pendingPayCard.bankName} 卡費 ${formatCurrency(payAmount)}！`, 'success');
            pendingPayCard = null;
          });
        }

        // 財務報表分析中心 Modal
        const modalReports = document.getElementById('modal-reports');
        const openReportsBtn = document.getElementById('btn-open-reports-modal');
        if (openReportsBtn && modalReports) {
          openReportsBtn.addEventListener('click', () => {
            populateReportPeriodSelect(currentReportType);
            renderReportsCenter(currentReportType, currentReportKey);
            modalReports.classList.add('active');
          });
        }

        document.querySelectorAll('.report-tab-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.dataset.reportType;
            populateReportPeriodSelect(type);
            renderReportsCenter(type, currentReportKey);
          });
        });

        const selectReportPeriod = document.getElementById('select-report-period');
        if (selectReportPeriod) {
          selectReportPeriod.addEventListener('change', (e) => {
            renderReportsCenter(currentReportType, e.target.value);
          });
        }

        // 資料備份功能
        const modalBackup = document.getElementById('modal-backup');
        const openBackupBtn = document.getElementById('btn-open-backup-modal');
        if (openBackupBtn && modalBackup) {
          openBackupBtn.addEventListener('click', () => modalBackup.classList.add('active'));
        }

        const reminderOpenBtn = document.getElementById('btn-backup-reminder-open');
        if (reminderOpenBtn && modalBackup) {
          reminderOpenBtn.addEventListener('click', () => modalBackup.classList.add('active'));
        }

        const reminderSnoozeBtn = document.getElementById('btn-backup-reminder-snooze');
        if (reminderSnoozeBtn) {
          reminderSnoozeBtn.addEventListener('click', () => {
            writeStored(BACKUP_SNOOZE_KEY, getLocalDateString());
            renderBackupReminder();
          });
        }

        const exportJsonBtn = document.getElementById('btn-export-json');
        if (exportJsonBtn) {
          exportJsonBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finflow_backup_${getLocalDateString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            writeStored(LAST_BACKUP_KEY, getLocalDateString());
            writeStored(BACKUP_SNOOZE_KEY, '');
            renderBackupReminder();
            showToast('已匯出 JSON 備份檔！', 'success');
          });
        }

        const importJsonInput = document.getElementById('file-import-json');
        if (importJsonInput) {
          importJsonInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed.accounts || !parsed.transactions) throw new Error('缺少必要欄位');
                appState = parsed;
                saveAppData(appState);
                renderDashboard();
                showToast('成功還原備份資料！', 'success');
                modalBackup.classList.remove('active');
              } catch (err) {
                showToast('匯入失敗，請確認檔案格式！', 'error');
              }
            };
            reader.readAsText(file);
          });
        }

        const resetDemoBtn = document.getElementById('btn-reset-demo');
        if (resetDemoBtn) {
          resetDemoBtn.addEventListener('click', () => {
            if (confirm('確定要清空並重設為全部歸零的乾淨狀態嗎？')) {
              localStorage.removeItem(STORAGE_KEY);
              appState = loadAppData();
              renderDashboard();
              showToast('已重設為全部歸零的乾淨狀態！', 'success');
              modalBackup.classList.remove('active');
            }
          });
        }

        // =========================================================================
        // 頂部導航「🔄 重新整理」功能
        // =========================================================================
        const btnRefresh = document.getElementById('btn-refresh-page');
        if (btnRefresh) {
          btnRefresh.addEventListener('click', () => {
            appState = loadAppData();
            renderDashboard();
            renderDebtPage();
            showToast('🔄 帳務資料已重新整理並同步！', 'success');
          });
        }

        // =========================================================================
        // Tab Bar 分頁切換
        // =========================================================================
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', () => switchPage(btn.dataset.page));
        });

        // =========================================================================
        // 債務管理：新增債務 Modal
        // =========================================================================
        const btnOpenAddDebt = document.getElementById('btn-open-add-debt');
        if (btnOpenAddDebt) btnOpenAddDebt.addEventListener('click', openAddDebtModal);

        const btnSaveDebt = document.getElementById('btn-save-debt');
        if (btnSaveDebt) btnSaveDebt.addEventListener('click', handleSaveDebt);

        const btnConfirmDebtPay = document.getElementById('btn-confirm-debt-pay');
        if (btnConfirmDebtPay) btnConfirmDebtPay.addEventListener('click', handleConfirmDebtPay);

        // 事件委派：本月還款、刪除債務、已還清折疊
        document.addEventListener('click', (e) => {
          const payDebtBtn = e.target.closest('.btn-pay-debt');
          if (payDebtBtn) {
            e.stopPropagation();
            openDebtPayModal(payDebtBtn.dataset.debtId);
            return;
          }
          const delDebtBtn = e.target.closest('.btn-delete-debt');
          if (delDebtBtn) {
            e.stopPropagation();
            const debt = getDebts().find(d => d.id === delDebtBtn.dataset.debtId);
            if (!debt) return;
            if (!confirm(`確定要刪除債務【${debt.name}】？此操作不可復原。`)) return;
            deleteDebtById(delDebtBtn.dataset.debtId);
            saveAppData(appState);
            renderDebtPage();
            showToast(`已刪除債務【${debt.name}】`, 'success');
            return;
          }
          const paidToggle = e.target.closest('#btn-toggle-paid-debts');
          if (paidToggle) {
            document.getElementById('debt-paid-list')?.classList.toggle('open');
            return;
          }
          const historyToggle = e.target.closest('.debt-history-toggle');
          if (historyToggle) {
            const list = document.getElementById(`history-list-${historyToggle.dataset.debtId}`);
            if (list) {
              list.classList.toggle('open');
              const isOpen = list.classList.contains('open');
              const txCount = historyToggle.textContent.match(/\d+/)[0];
              historyToggle.innerHTML = `查看還款紀錄 (${txCount} 筆) ${isOpen ? '▴' : '▾'}`;
            }
            return;
          }
        });
      });
    })();
