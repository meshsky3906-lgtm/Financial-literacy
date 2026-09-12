/**
 * FinFlow 智富記帳 - 核心控制器 (App Controller)
 */

import { loadAppData, saveAppData, resetToDefaultData, exportDataAsJson, importDataFromJson } from './storage.js';
import { 
  renderDashboard, 
  renderTransactionLedger, 
  renderCategorySelectGrid, 
  renderAccountSelectOptions, 
  renderReportsModal,
  openTxDetailModal,
  showToast, 
  formatCurrency 
} from './uiRenderer.js';
import { calculateIncomeSplit, getCurrentMonthKey, generatePeriodReport } from './financeLogic.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './categories.js';
import {
  DEBT_CATEGORIES,
  addDebt,
  deleteDebt,
  markMonthlyPayment,
  calcDebtSummary,
  getUpcomingPayments
} from './debtManager.js';

// 全域應用程式狀態
let appState = {
  accounts: [],
  transactions: [],
  settings: {}
};

// 記帳表單當前暫存狀態
let currentEntryState = {
  type: 'expense',           // expense | income | transfer
  amount: 0,
  categoryId: 'food_daily',
  categoryName: '日常三餐',
  categoryIcon: '🍚',
  tag: 'need',              // need | want | invest | income
  accountId: 'card_esun',   // 預設玉山卡
  accountName: '玉山銀行信用卡',
  date: new Date().toISOString().split('T')[0],
  note: ''
};

// 當前進行繳費的卡片暫存
let pendingPayCard = null;

/**
 * 程式初始化入口
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. 載入資料
  appState = loadAppData();

  // 2. 初始化渲染儀表板
  renderDashboard(appState);

  // 3. 初始化渲染債務頁面
  renderDebtPage();

  // 4. 綁定所有互動事件
  setupEventListeners();

  // 5. 渲染完畢（iOS 捷徑功能已移除）
});

/**
 * 綁定全站事件監聽
 */
function setupEventListeners() {
  // --- 記帳 Modal 開關 ---
  const modalEntry = document.getElementById('modal-entry');
  const openEntryBtns = [
    document.getElementById('btn-quick-record-trigger'),
    document.getElementById('btn-quick-add-header')
  ];

  openEntryBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => openEntryModal());
    }
  });

  // 通用關閉 Modal 按鈕
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    });
  });

  // 點擊遮罩外圍關閉
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // --- 記帳類型切換 (支出 / 收入 / 轉帳) ---
  const typeBtns = document.querySelectorAll('.type-toggle-btn');
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.txType;
      handleEntryTypeChange(type);
    });
  });

  // --- 財商標籤手動切換 ---
  const tagBtns = document.querySelectorAll('.tag-select-btn');
  tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tagBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEntryState.tag = btn.dataset.tag;
    });
  });

  // --- 金額輸入即時檢查（信用風控警戒 + 千分位動態預覽） ---
  const inputAmount = document.getElementById('input-amount');
  const previewDisplay = document.getElementById('amount-preview-display');
  if (inputAmount) {
    inputAmount.addEventListener('input', () => {
      const val = Number(inputAmount.value) || 0;
      if (previewDisplay) {
        previewDisplay.textContent = formatCurrency(val);
      }
      checkCreditRiskOnInput();
    });
  }

  // --- 送出記帳表單 ---
  const btnSubmitEntry = document.getElementById('btn-submit-entry');
  if (btnSubmitEntry) {
    btnSubmitEntry.addEventListener('click', () => {
      handleSaveTransaction();
    });
  }

  // --- 明細篩選器標籤點擊 ---
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      renderTransactionLedger(appState, filter);
    });
  });

  // --- 交易明細刪除與卡片繳費點擊（事件委派） ---
  document.addEventListener('click', (e) => {
    // 刪除單筆交易
    const deleteBtn = e.target.closest('.btn-tx-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const txId = deleteBtn.dataset.txId;
      handleDeleteTransaction(txId);
      return;
    }

    // 點擊交易列開啟詳情查看
    const txRow = e.target.closest('.transaction-row');
    if (txRow) {
      const txId = txRow.dataset.txId;
      if (txId) {
        openTxDetailModal(txId, appState, (id) => handleDeleteTransaction(id));
        return;
      }
    }

    // 點擊信用卡上的「繳納卡費」按鈕
    const payBillBtn = e.target.closest('.btn-pay-bill');
    if (payBillBtn) {
      const cardId = payBillBtn.dataset.cardId;
      openPayBillModal(cardId);
      return;
    }
  });

  // --- 重新整理按鈕 ---
  const btnRefresh = document.getElementById('btn-refresh-page');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      // 重新從 LocalStorage 載入最新資料並重繪儀表板
      appState = loadAppData();
      renderDashboard(appState);
      showToast('✅ 資料已同步重新整理！', 'success');
    });
  }

  // --- 確認繳納信用卡費 ---
  const btnConfirmPay = document.getElementById('btn-confirm-pay-bill');
  if (btnConfirmPay) {
    btnConfirmPay.addEventListener('click', () => {
      handleConfirmPayBill();
    });
  }

  // --- 財務報表分析中心 Modal ---
  let currentReportType = 'month';
  let currentReportKey = getCurrentMonthKey();

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
        while (q <= 0) {
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

  function updateReportsView(type = currentReportType, key = currentReportKey) {
    currentReportType = type;
    currentReportKey = key;
    const reportData = generatePeriodReport(appState.transactions, type, key);
    renderReportsModal(reportData);
  }

  const btnOpenReports = document.getElementById('btn-open-reports-modal');
  const modalReports = document.getElementById('modal-reports');
  if (btnOpenReports && modalReports) {
    btnOpenReports.addEventListener('click', () => {
      populateReportPeriodSelect(currentReportType);
      updateReportsView(currentReportType, currentReportKey);
      modalReports.classList.add('active');
    });
  }

  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.reportType;
      populateReportPeriodSelect(type);
      updateReportsView(type, currentReportKey);
    });
  });

  const selectReportPeriod = document.getElementById('select-report-period');
  if (selectReportPeriod) {
    selectReportPeriod.addEventListener('change', (e) => {
      updateReportsView(currentReportType, e.target.value);
    });
  }

  // --- 備份管理 Modal ---
  const btnOpenBackup = document.getElementById('btn-open-backup-modal');
  const modalBackup = document.getElementById('modal-backup');
  if (btnOpenBackup && modalBackup) {
    btnOpenBackup.addEventListener('click', () => {
      modalBackup.classList.add('active');
    });
  }

  // 匯出 JSON
  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportDataAsJson(appState);
      showToast('已成功匯出 JSON 備份檔案！', 'success');
    });
  }

  // 匯入 JSON
  const fileImport = document.getElementById('file-import-json');
  if (fileImport) {
    fileImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = importDataFromJson(event.target.result);
        if (result.success) {
          appState = result.data;
          renderDashboard(appState);
          showToast('成功還原備份資料！', 'success');
          modalBackup.classList.remove('active');
        } else {
          showToast(`匯入失敗：${result.error}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // 重設為乾淨空白初始狀態
  const btnReset = document.getElementById('btn-reset-demo');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('確定要清空並重設為全部歸零的空白狀態嗎？')) {
        appState = resetToDefaultData();
        renderDashboard(appState);
        renderDebtPage();
        showToast('已重設為全部歸零的乾淨狀態！', 'success');
        modalBackup.classList.remove('active');
      }
    });
  }

  // ---- 債務管理頁面事件 ----
  setupDebtEvents();
}

/**
 * 開啟記帳 Modal 並重設預設欄位
 */
function openEntryModal(defaultType = 'expense') {
  const modal = document.getElementById('modal-entry');
  if (!modal) return;

  // 重設日期為今天
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('input-date').value = today;
  document.getElementById('input-amount').value = '';
  document.getElementById('input-note').value = '';

  currentEntryState.date = today;
  currentEntryState.amount = 0;
  currentEntryState.note = '';

  // 切換至對應類型
  const typeBtn = document.querySelector(`.type-toggle-btn[data-tx-type="${defaultType}"]`);
  if (typeBtn) typeBtn.click();

  modal.classList.add('active');
  setTimeout(() => {
    const inputAmt = document.getElementById('input-amount');
    if (inputAmt) inputAmt.focus();
  }, 100);
}

/**
 * 處理記帳類型切換 (支出 / 收入 / 轉帳)
 */
function handleEntryTypeChange(type) {
  currentEntryState.type = type;
  const tagGroup = document.getElementById('group-tag-select');
  const accountGroup = document.getElementById('group-account-select');
  const categoryGroup = document.getElementById('group-category-select');
  const transferGroup = document.getElementById('group-transfer-fields');
  const categoryHint = document.getElementById('selected-category-hint');

  if (type === 'transfer') {
    // 轉帳模式：隱藏消費類別與標籤，顯示雙帳戶轉移區塊
    if (tagGroup) tagGroup.style.display = 'none';
    if (accountGroup) accountGroup.style.display = 'none';
    if (categoryGroup) categoryGroup.style.display = 'none';
    if (transferGroup) transferGroup.style.display = 'block';

    currentEntryState.tag = 'transfer';
    currentEntryState.categoryId = 'transfer';
    currentEntryState.categoryName = '帳戶內部轉帳';
    currentEntryState.categoryIcon = '🔄';

    // 填充轉出與轉入下拉選單
    setupTransferSelects();
    return;
  }

  // 支出或收入模式：顯示常規選擇區塊
  if (transferGroup) transferGroup.style.display = 'none';
  if (categoryGroup) categoryGroup.style.display = 'block';
  if (accountGroup) accountGroup.style.display = 'block';

  if (type === 'income') {
    currentEntryState.tag = 'income';
    if (tagGroup) tagGroup.style.display = 'none';
    if (categoryHint) categoryHint.textContent = '入帳時將提供 50/30/20 智能分流建議';
  } else {
    if (tagGroup) tagGroup.style.display = 'block';
    if (categoryHint) categoryHint.textContent = '自動關聯財商標籤（可自由微調）';
  }

  // 渲染對應分類網格
  renderCategorySelectGrid(type, (selectedCat) => {
    currentEntryState.categoryId = selectedCat.id;
    currentEntryState.categoryName = selectedCat.name;
    currentEntryState.categoryIcon = selectedCat.icon;

    if (type === 'expense' && selectedCat.defaultTag) {
      currentEntryState.tag = selectedCat.defaultTag;
      document.querySelectorAll('.tag-select-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tag === selectedCat.defaultTag);
      });
    }
  });

  // 預設選中第一個分類
  const defaultList = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  if (defaultList.length > 0) {
    currentEntryState.categoryId = defaultList[0].id;
    currentEntryState.categoryName = defaultList[0].name;
    currentEntryState.categoryIcon = defaultList[0].icon;
    if (type === 'expense' && defaultList[0].defaultTag) {
      currentEntryState.tag = defaultList[0].defaultTag;
      document.querySelectorAll('.tag-select-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tag === defaultList[0].defaultTag);
      });
    }
  }

  // 渲染帳戶選擇器
  const defaultAccId = type === 'income' ? 'acc_bank_main' : 'card_esun';
  currentEntryState.accountId = defaultAccId;
  const targetAcc = appState.accounts.find(a => a.id === defaultAccId);
  currentEntryState.accountName = targetAcc ? targetAcc.name : '玉山銀行信用卡';

  renderAccountSelectOptions(appState.accounts, defaultAccId, (selectedAcc) => {
    currentEntryState.accountId = selectedAcc.id;
    currentEntryState.accountName = selectedAcc.name;
    checkCreditRiskOnInput();
  });
}

/**
 * 初始化轉帳雙帳戶選擇與快捷情境按鈕
 */
function setupTransferSelects() {
  const fromSelect = document.getElementById('select-transfer-from');
  const toSelect = document.getElementById('select-transfer-to');
  if (!fromSelect || !toSelect) return;

  const accounts = appState.accounts;
  fromSelect.innerHTML = accounts.map(a => `
    <option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>
  `).join('');

  toSelect.innerHTML = accounts.map(a => `
    <option value="${a.id}">${a.name} (${formatCurrency(a.balance)})</option>
  `).join('');

  // 預設轉出為主要活存，轉入為緊急預備金
  fromSelect.value = 'acc_bank_main';
  toSelect.value = 'acc_emergency';

  // 綁定快捷情境按鈕
  document.querySelectorAll('[data-transfer-preset]').forEach(btn => {
    btn.onclick = () => {
      const preset = btn.dataset.transferPreset;
      fromSelect.value = 'acc_bank_main';
      if (preset === 'emergency') toSelect.value = 'acc_emergency';
      if (preset === 'invest') toSelect.value = 'acc_invest';
      if (preset === 'esun') toSelect.value = 'card_esun';
      if (preset === 'fubon') toSelect.value = 'card_fubon';
      showToast(`已套用快捷情境：${btn.textContent}`, 'success');
    };
  });
}

/**
 * 即時檢查刷卡金額是否接近或超過 $18,000 (30% 安全紅線)
 */
function checkCreditRiskOnInput() {
  const badge = document.getElementById('credit-warning-badge');
  if (!badge) return;

  if (currentEntryState.type === 'transfer') {
    badge.style.display = 'none';
    return;
  }

  const currentAmt = Number(document.getElementById('input-amount').value) || 0;
  const currentMonth = getCurrentMonthKey();
  const selectedAcc = appState.accounts.find(a => a.id === currentEntryState.accountId);

  if (!selectedAcc || selectedAcc.type !== 'credit') {
    badge.style.display = 'none';
    return;
  }

  // 計算該卡當月已刷
  const monthlySpent = appState.transactions
    .filter(tx => tx.type === 'expense' && tx.accountId === selectedAcc.id && tx.date.startsWith(currentMonth))
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

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

/**
 * 儲存一筆新交易 (支援支出/收入/帳戶轉帳)
 */
function handleSaveTransaction() {
  const amountInput = document.getElementById('input-amount');
  const amount = Number(amountInput.value);

  if (!amount || amount <= 0) {
    showToast('請輸入大於 0 的正確金額！', 'error');
    amountInput.focus();
    return;
  }

  const dateInput = document.getElementById('input-date').value || new Date().toISOString().split('T')[0];
  const noteInput = document.getElementById('input-note').value.trim();

  // 若為內部轉帳
  if (currentEntryState.type === 'transfer') {
    const fromId = document.getElementById('select-transfer-from').value;
    const toId = document.getElementById('select-transfer-to').value;

    if (fromId === toId) {
      showToast('轉出帳戶與轉入帳戶不能相同！', 'error');
      return;
    }

    const fromAcc = appState.accounts.find(a => a.id === fromId);
    const toAcc = appState.accounts.find(a => a.id === toId);

    if (fromAcc && toAcc) {
      // 轉出帳戶扣款
      if (fromAcc.type === 'credit') {
        fromAcc.balance = Number(fromAcc.balance || 0) + amount; // 信用卡預借現金或特殊扣款
      } else {
        fromAcc.balance = Number(fromAcc.balance || 0) - amount;
      }

      // 轉入帳戶加款 (若轉入信用卡代表繳款沖銷)
      if (toAcc.type === 'credit') {
        toAcc.balance = Math.max(0, Number(toAcc.balance || 0) - amount);
      } else {
        toAcc.balance = Number(toAcc.balance || 0) + amount;
      }

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
        date: dateInput,
        note: noteInput ? noteInput : `內部資產調配 (${fromAcc.name} ➔ ${toAcc.name})`
      };

      appState.transactions.unshift(newTx);
      saveAppData(appState);
      document.getElementById('modal-entry').classList.remove('active');
      renderDashboard(appState);
      showToast(`🎉 成功完成轉帳 ${formatCurrency(amount)}！資產結構已同步。`, 'success');
      return;
    }
  }

  // 常規支出或收入
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
      if (targetAcc.type === 'credit') {
        targetAcc.balance = Number(targetAcc.balance || 0) + amount;
      } else {
        targetAcc.balance = Number(targetAcc.balance || 0) - amount;
      }
    } else if (newTx.type === 'income') {
      targetAcc.balance = Number(targetAcc.balance || 0) + amount;
    }
  }

  appState.transactions.unshift(newTx);
  saveAppData(appState);

  document.getElementById('modal-entry').classList.remove('active');
  renderDashboard(appState);
  showToast(`已成功記錄【${newTx.categoryName}】${formatCurrency(amount)}！`, 'success');

  if (newTx.type === 'income' && amount >= 5000) {
    setTimeout(() => {
      openSplitAdvisorModal(amount);
    }, 400);
  }
}

/**
 * 刪除一筆交易並回退帳戶餘額
 * 注意：transfer 類型需同時回退轉出與轉入帳戶
 */
function handleDeleteTransaction(txId) {
  const txIndex = appState.transactions.findIndex(t => t.id === txId);
  if (txIndex === -1) return;

  const tx = appState.transactions[txIndex];
  if (!confirm(`確定要刪除這筆【${tx.categoryName}】${formatCurrency(tx.amount)} 的紀錄嗎？`)) {
    return;
  }

  const amount = Number(tx.amount || 0);

  if (tx.type === 'transfer') {
    // 轉帳記錄：解析轉出與轉入帳戶並各自回退
    // categoryName 格式：「轉帳：fromAcc.name ➔ toAcc.name」或「繳納XXX卡費」
    const fromAcc = appState.accounts.find(a => a.id === tx.accountId);

    // 嘗試從 categoryName 反查轉入帳戶
    const transferMatch = tx.categoryName && tx.categoryName.includes('➔');
    let toAcc = null;
    if (transferMatch) {
      const parts = tx.categoryName.split('➔');
      const toName = parts[1] ? parts[1].trim() : '';
      toAcc = appState.accounts.find(a => a.name.trim() === toName);
    } else if (tx.categoryName && tx.categoryName.includes('繳納')) {
      // 繳納卡費：fromAcc 是活存（已從 accountId 找到），toAcc 是信用卡
      // 找出 balance=0 且 type=credit 的信用卡（繳清後 balance=0）
      // 改用 bankName 比對：categoryName 格式「繳納XXX卡費」
      const bankNameMatch = tx.categoryName.replace('繳納', '').replace('卡費', '').trim();
      toAcc = appState.accounts.find(a => a.type === 'credit' && (a.bankName.includes(bankNameMatch) || bankNameMatch.includes(a.bankName)));
    }

    // 回退轉出帳戶（活存 +、信用卡 -）
    if (fromAcc) {
      if (fromAcc.type === 'credit') {
        fromAcc.balance = Math.max(0, Number(fromAcc.balance || 0) - amount);
      } else {
        fromAcc.balance = Number(fromAcc.balance || 0) + amount;
      }
    }

    // 回退轉入帳戶（信用卡 +、活存 -）
    if (toAcc) {
      if (toAcc.type === 'credit') {
        // 原本是沖銷（credit balance - amount），回退後 balance + amount
        toAcc.balance = Number(toAcc.balance || 0) + amount;
      } else {
        toAcc.balance = Math.max(0, Number(toAcc.balance || 0) - amount);
      }
    }

  } else {
    // 常規支出/收入回退
    const targetAcc = appState.accounts.find(a => a.id === tx.accountId);
    if (targetAcc) {
      if (tx.type === 'expense') {
        if (targetAcc.type === 'credit') {
          targetAcc.balance = Math.max(0, Number(targetAcc.balance || 0) - amount);
        } else {
          targetAcc.balance = Number(targetAcc.balance || 0) + amount;
        }
      } else if (tx.type === 'income') {
        targetAcc.balance = Number(targetAcc.balance || 0) - amount;
      }
    }
  }

  appState.transactions.splice(txIndex, 1);
  saveAppData(appState);
  renderDashboard(appState);
  showToast('交易已成功刪除並回退餘額！', 'success');
}

/**
 * 開啟繳納信用卡費 Modal (內部轉帳沖銷)
 */
function openPayBillModal(cardId) {
  const card = appState.accounts.find(a => a.id === cardId);
  if (!card) return;

  pendingPayCard = card;
  const modal = document.getElementById('modal-pay-bill');
  const nameEl = document.getElementById('pay-bill-card-name');
  const amtEl = document.getElementById('pay-bill-amount-display');
  const selectSrc = document.getElementById('select-pay-source-account');

  if (nameEl) nameEl.textContent = `${card.bankName} (${card.name})`;
  if (amtEl) amtEl.textContent = formatCurrency(card.balance);

  // 填充可供扣款的活存帳戶
  if (selectSrc) {
    const liquidAccs = appState.accounts.filter(a => a.type === 'liquid' || a.type === 'bank' || a.type === 'cash');
    selectSrc.innerHTML = liquidAccs.map(acc => `
      <option value="${acc.id}">${acc.name} (餘額: ${formatCurrency(acc.balance)})</option>
    `).join('');
  }

  modal.classList.add('active');
}

/**
 * 確認執行繳納信用卡費（內部轉帳沖銷，不重複計算為支出）
 */
function handleConfirmPayBill() {
  if (!pendingPayCard) return;

  const billAmount = Number(pendingPayCard.balance || 0);
  if (billAmount <= 0) {
    showToast('目前此卡無待繳卡費，無需繳納！', 'warning');
    document.getElementById('modal-pay-bill').classList.remove('active');
    return;
  }

  const selectSrc = document.getElementById('select-pay-source-account');
  const srcAccId = selectSrc ? selectSrc.value : 'acc_bank_main';
  const srcAcc = appState.accounts.find(a => a.id === srcAccId);

  if (srcAcc) {
    if (srcAcc.balance < billAmount) {
      if (!confirm(`警告：轉出活存帳戶餘額 (${formatCurrency(srcAcc.balance)}) 小於應繳卡費 (${formatCurrency(billAmount)})，確定繼續扣款嗎？`)) {
        return;
      }
    }
    // 活存扣除卡費
    srcAcc.balance = Number(srcAcc.balance) - billAmount;
  }

  // 信用卡待繳帳款歸零
  const paidAmount = billAmount;
  pendingPayCard.balance = 0;

  // 記錄一筆內部轉帳沖銷備註（不列入 50/30/20 支出，防止重複扣預算）
  appState.transactions.unshift({
    id: `tx_pay_${Date.now()}`,
    type: 'transfer',
    amount: paidAmount,
    categoryId: 'transfer',
    categoryName: `繳納${pendingPayCard.bankName}卡費`,
    categoryIcon: '💳',
    tag: 'transfer',
    accountId: srcAccId,
    accountName: srcAcc ? srcAcc.name : '主要活存',
    date: new Date().toISOString().split('T')[0],
    note: `沖銷結清 ${pendingPayCard.name} 待繳款（內部轉帳，無重複扣款）`
  });

  saveAppData(appState);
  document.getElementById('modal-pay-bill').classList.remove('active');
  renderDashboard(appState);

  showToast(`🎉 成功繳清 ${pendingPayCard.bankName} 卡費 ${formatCurrency(paidAmount)}！已完成內部沖銷。`, 'success');
  pendingPayCard = null;
}

/**
 * 開啟 50/30/20 收入分流建議 Modal
 */
function openSplitAdvisorModal(amount) {
  const modal = document.getElementById('modal-split-advisor');
  if (!modal) return;

  const split = calculateIncomeSplit(amount);

  const totalEl = document.getElementById('split-total-amount');
  const needEl = document.getElementById('split-need-amt');
  const wantEl = document.getElementById('split-want-amt');
  const investEl = document.getElementById('split-invest-amt');

  if (totalEl) totalEl.textContent = formatCurrency(split.total);
  if (needEl) needEl.textContent = formatCurrency(split.need);
  if (wantEl) wantEl.textContent = formatCurrency(split.want);
  if (investEl) investEl.textContent = formatCurrency(split.invest);

  modal.classList.add('active');
}

// iOS 捷徑功能已移除

// =========================================================================
// 全域暫存：待還款債務 ID
// =========================================================================
let pendingDebtId = null;
let currentDebtCategoryId = DEBT_CATEGORIES[0].id;

// =========================================================================
// Tab Bar 分頁切換
// =========================================================================

/**
 * 初始化 Tab Bar 頁面切換事件（在 setupEventListeners 中呼叫）
 */
function setupTabBar() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      switchPage(page);
    });
  });
}

/**
 * 切換頁面視圖
 * @param {'dashboard'|'debt'} pageId
 */
function switchPage(pageId) {
  // 切換 tab 按鈕 active 狀態
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
    b.setAttribute('aria-selected', b.dataset.page === pageId ? 'true' : 'false');
  });

  // 切換頁面 view
  document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) targetPage.classList.add('active');

  // 切換至債務頁時重新渲染（確保資料最新）
  if (pageId === 'debt') {
    renderDebtPage();
  }
}

// =========================================================================
// 債務頁面渲染
// =========================================================================

/**
 * 渲染整個債務管理頁面（統計 + 清單 + 還款提示）
 */
function renderDebtPage() {
  const summary = calcDebtSummary(appState);
  renderDebtOverviewCards(summary);
  renderDebtPressureBar(summary);
  renderDebtProgressBar(summary);
  renderUpcomingPayments();
  renderDebtCards(summary);
  renderPaidDebts(summary);
}

/**
 * 渲染債務 4 大總覽卡片（連動主帳戶資產）
 */
function renderDebtOverviewCards(summary) {
  const elTotal   = document.getElementById('debt-val-total');
  const elSubTot  = document.getElementById('debt-sub-total');
  const elMonthly = document.getElementById('debt-val-monthly');
  const elSubMon  = document.getElementById('debt-sub-monthly');
  const elRatio   = document.getElementById('debt-val-ratio');
  const elSubRat  = document.getElementById('debt-sub-ratio');
  const elPaid    = document.getElementById('debt-val-paid');
  const elSubPaid = document.getElementById('debt-sub-paid');

  if (elTotal)   elTotal.textContent   = formatCurrency(summary.totalRemaining);
  if (elSubTot)  elSubTot.textContent  = `共 ${summary.activeCount} 筆未清償`;
  if (elMonthly) elMonthly.textContent = formatCurrency(summary.totalMonthly);
  if (elSubMon)  elSubMon.textContent  = `活存餘額 ${formatCurrency(summary.mainBalance)}`;
  if (elRatio)   elRatio.textContent   = `${summary.debtRatio}%`;
  if (elSubRat) {
    const ratioText = summary.debtRatio < 30 ? '✅ 負債比率健康'
                    : summary.debtRatio < 40 ? '⚠️ 接近警戒值'
                    : '🚨 超過安全紅線';
    elSubRat.textContent = ratioText;
  }
  if (elPaid)    elPaid.textContent    = `${summary.paidCount} 筆`;
  if (elSubPaid) elSubPaid.textContent = `累積已還 ${formatCurrency(summary.totalAlreadyPaid)}`;
}

/**
 * 渲染月還款壓力警示橫幅
 */
function renderDebtPressureBar(summary) {
  const bar  = document.getElementById('debt-pressure-bar');
  const icon = document.getElementById('debt-pressure-icon');
  const text = document.getElementById('debt-pressure-text');
  if (!bar) return;

  bar.className = 'debt-pressure-bar';
  const ratio = summary.monthlyPressureRatio;

  if (summary.totalMonthly === 0) {
    bar.classList.add('safe');
    if (icon) icon.textContent = '✅';
    if (text) text.textContent = '目前無債務還款壓力，財務現金流健康。';
  } else if (ratio < 30) {
    bar.classList.add('safe');
    if (icon) icon.textContent = '✅';
    if (text) text.textContent = `月還款 ${formatCurrency(summary.totalMonthly)} 佔活存 ${ratio}%，現金流穩健。`;
  } else if (ratio < 60) {
    bar.classList.add('warning');
    if (icon) icon.textContent = '⚠️';
    if (text) text.textContent = `月還款 ${formatCurrency(summary.totalMonthly)} 佔活存 ${ratio}%，注意現金儲備。`;
  } else {
    bar.classList.add('danger');
    if (icon) icon.textContent = '🚨';
    if (text) text.textContent = `月還款 ${formatCurrency(summary.totalMonthly)} 佔活存 ${ratio}%，現金流壓力極高！`;
  }
}

/**
 * 渲染整體還清進度條
 */
function renderDebtProgressBar(summary) {
  const fill = document.getElementById('debt-overall-fill');
  const pct  = document.getElementById('debt-overall-pct');
  const sub  = document.getElementById('debt-progress-sub');

  if (fill) fill.style.width = `${summary.overallProgress}%`;
  if (pct)  pct.textContent  = `${summary.overallProgress}%`;
  if (sub) {
    if (summary.totalCount === 0) {
      sub.textContent = '尚未建立任何債務紀錄';
    } else {
      sub.textContent = `已還清 ${formatCurrency(summary.totalAlreadyPaid)}，剩餘 ${formatCurrency(summary.totalRemaining)}`;
    }
  }
}

/**
 * 渲染即將到期還款提示橫幅
 */
function renderUpcomingPayments() {
  const section = document.getElementById('upcoming-payments-section');
  const list    = document.getElementById('upcoming-payments-list');
  if (!section || !list) return;

  const upcoming = getUpcomingPayments(appState);
  if (upcoming.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'flex';
  list.innerHTML = upcoming.map(d => {
    let daysLabel, daysCls;
    if (d.daysUntilDue === 0) {
      daysLabel = '今日到期'; daysCls = 'urgent';
    } else if (d.daysUntilDue <= 3) {
      daysLabel = `還剩 ${d.daysUntilDue} 天`; daysCls = 'urgent';
    } else if (d.daysUntilDue <= 7) {
      daysLabel = `還剩 ${d.daysUntilDue} 天`; daysCls = 'soon';
    } else {
      daysLabel = `還剩 ${d.daysUntilDue} 天`; daysCls = 'ok';
    }
    return `
      <div class="upcoming-item">
        <span class="upcoming-item-name">
          ${d.catInfo.icon} ${d.name}
          <span style="font-size:0.7rem; color:var(--text-muted);">${formatCurrency(d.monthlyPayment)}</span>
        </span>
        <span class="upcoming-item-days ${daysCls}">${daysLabel}</span>
      </div>`;
  }).join('');
}

/**
 * 渲染活躍債務卡片清單
 */
function renderDebtCards(summary) {
  const container = document.getElementById('debt-cards-container');
  if (!container) return;

  if (summary.debtsWithETA.length === 0) {
    container.innerHTML = `
      <div class="debt-empty-state">
        <div class="debt-empty-icon">🎉</div>
        <div class="debt-empty-title">目前無未清償債務</div>
        <div class="debt-empty-sub">點擊右上角「新增債務」<br>開始建立您的債務管理紀錄</div>
      </div>`;
    return;
  }

  container.innerHTML = summary.debtsWithETA.map(d => {
    const fillColor = d.catInfo.color;
    const etaText   = d.monthsLeft !== null ? `預計 ${d.monthsLeft} 個月還清` : '未設定月還款額';
    const rateText  = d.interestRate > 0 ? `年利率 ${d.interestRate}%` : '無利率資料';
    const dueTxt    = d.dueDay > 0 ? `每月 ${d.dueDay} 號` : '無還款日';
    return `
      <div class="debt-card" data-debt-id="${d.id}">
        <div class="debt-card-top">
          <div class="debt-card-left">
            <div class="debt-cat-icon" style="background: ${fillColor}22; border: 1px solid ${fillColor}55;">
              ${d.catInfo.icon}
            </div>
            <div class="debt-card-info">
              <div class="debt-card-name">${d.name}</div>
              <div class="debt-card-meta">
                ${d.creditor ? `${d.creditor} ･ ` : ''}${d.catInfo.name}
              </div>
            </div>
          </div>
          <div class="debt-card-right">
            <div class="debt-remaining-amount">${formatCurrency(d.remaining)}</div>
            <div class="debt-card-actions">
              <button class="btn-pay-debt" data-debt-id="${d.id}" title="記錄本月還款">
                💸 本月還款
              </button>
              <button class="btn btn-outline-danger btn-delete-debt" data-debt-id="${d.id}" title="刪除此筆債務">
                🗑️
              </button>
            </div>
          </div>
        </div>

        <div class="debt-card-progress-wrap">
          <div class="debt-card-progress-labels">
            <span>已還 ${d.progress}%</span>
            <span>剩餘 ${formatCurrency(d.remaining)} / 原始 ${formatCurrency(d.totalAmount)}</span>
          </div>
          <div class="debt-card-progress-track">
            <div class="debt-card-progress-fill" style="width: ${d.progress}%; background: linear-gradient(90deg, ${fillColor}, ${fillColor}aa);"></div>
          </div>
        </div>

        <div class="debt-card-kpi-row">
          <div class="debt-kpi-item">
            <span class="debt-kpi-label">月還款</span>
            <span class="debt-kpi-value">${d.monthlyPayment > 0 ? formatCurrency(d.monthlyPayment) : '—'}</span>
          </div>
          <div class="debt-kpi-item">
            <span class="debt-kpi-label">還款日</span>
            <span class="debt-kpi-value">${dueTxt}</span>
          </div>
          <div class="debt-kpi-item">
            <span class="debt-kpi-label">利率</span>
            <span class="debt-kpi-value">${rateText}</span>
          </div>
          <div class="debt-kpi-item">
            <span class="debt-kpi-label">預計還清</span>
            <span class="debt-kpi-value">${etaText}</span>
          </div>
        </div>
        ${d.note ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:8px;">📝 ${d.note}</div>` : ''}
      </div>`;
  }).join('');
}

/**
 * 渲染已還清債務折疊區
 */
function renderPaidDebts(summary) {
  const section = document.getElementById('debt-paid-section');
  const list    = document.getElementById('debt-paid-list');
  const badge   = document.getElementById('paid-debts-count-badge');
  if (!section) return;

  if (summary.paidDebts.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  if (badge) badge.textContent = `${summary.paidDebts.length} 筆`;

  if (list) {
    list.innerHTML = summary.paidDebts.map(d => {
      const catInfo = DEBT_CATEGORIES.find(c => c.id === d.category) || DEBT_CATEGORIES[7];
      return `
        <div class="debt-paid-item">
          <span style="display:flex; align-items:center; gap:8px; font-size:0.85rem;">
            ${catInfo.icon} ${d.name}
            ${d.creditor ? `<span style="font-size:0.7rem; color:var(--text-muted);">${d.creditor}</span>` : ''}
          </span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.82rem; color:#6EE7B7; font-weight:700;">✅ 已還清</span>
            <button class="btn btn-outline-danger btn-delete-debt" data-debt-id="${d.id}" style="padding:3px 8px; font-size:0.7rem;">🗑️</button>
          </span>
        </div>`;
    }).join('');
  }
}

// =========================================================================
// 債務管理 Modal 與事件
// =========================================================================

/**
 * 開啟新增債務 Modal（渲染分類選擇格）
 */
function openAddDebtModal() {
  const catGrid = document.getElementById('debt-cat-grid');
  if (catGrid) {
    currentDebtCategoryId = DEBT_CATEGORIES[0].id;
    catGrid.innerHTML = DEBT_CATEGORIES.map(c => `
      <button type="button" class="debt-cat-btn ${c.id === currentDebtCategoryId ? 'active' : ''}"
        data-cat-id="${c.id}">
        <span class="dcat-icon">${c.icon}</span>
        <span class="dcat-name">${c.name}</span>
      </button>`).join('');

    // 綁定分類選擇
    catGrid.querySelectorAll('.debt-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        catGrid.querySelectorAll('.debt-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDebtCategoryId = btn.dataset.catId;
      });
    });
  }

  // 重設表單
  ['debt-input-name','debt-input-creditor','debt-input-total',
   'debt-input-remaining','debt-input-monthly','debt-input-rate',
   'debt-input-dueday','debt-input-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const startInput = document.getElementById('debt-input-start');
  if (startInput) startInput.value = new Date().toISOString().substr(0, 7);

  document.getElementById('modal-add-debt')?.classList.add('active');
}

/**
 * 儲存新增債務（表單驗證 + 新增 + 渲染）
 */
function handleSaveDebt() {
  const name      = document.getElementById('debt-input-name')?.value.trim();
  const totalAmt  = Number(document.getElementById('debt-input-total')?.value) || 0;
  const remaining = Number(document.getElementById('debt-input-remaining')?.value) || 0;

  if (!name) {
    showToast('請填寫債務名稱！', 'error');
    document.getElementById('debt-input-name')?.focus();
    return;
  }
  if (totalAmt <= 0) {
    showToast('請填寫借款總額！', 'error');
    return;
  }
  if (remaining < 0 || remaining > totalAmt) {
    showToast('剩餘未還金額不合理（不可大於借款總額）！', 'error');
    return;
  }

  const debtData = {
    name,
    category:       currentDebtCategoryId,
    creditor:       document.getElementById('debt-input-creditor')?.value || '',
    totalAmount:    totalAmt,
    remaining:      remaining,
    monthlyPayment: Number(document.getElementById('debt-input-monthly')?.value) || 0,
    interestRate:   Number(document.getElementById('debt-input-rate')?.value) || 0,
    dueDay:         Number(document.getElementById('debt-input-dueday')?.value) || 0,
    startDate:      document.getElementById('debt-input-start')?.value || '',
    note:           document.getElementById('debt-input-note')?.value || ''
  };

  addDebt(appState, debtData);
  saveAppData(appState);

  document.getElementById('modal-add-debt')?.classList.remove('active');
  renderDebtPage();
  showToast(`✅ 已新增債務【${name}】，剩餘 ${formatCurrency(remaining)}！`, 'success');
}

/**
 * 開啟「本月還款確認」Modal
 */
function openDebtPayModal(debtId) {
  const debt = (appState.debts || []).find(d => d.id === debtId);
  if (!debt) return;

  pendingDebtId = debtId;

  const nameEl      = document.getElementById('debt-pay-name');
  const amtEl       = document.getElementById('debt-pay-amount-display');
  const previewEl   = document.getElementById('debt-pay-remaining-preview');
  const customInput = document.getElementById('debt-pay-custom-amount');

  if (nameEl) nameEl.textContent = `${debt.name}${debt.creditor ? ` (${debt.creditor})` : ''}`;
  if (amtEl)  amtEl.textContent  = formatCurrency(debt.monthlyPayment);
  if (customInput) customInput.value = '';

  // 計算還款後剩餘
  const afterPay = Math.max(0, Number(debt.remaining) - Number(debt.monthlyPayment));
  if (previewEl) previewEl.textContent = `按月還款額後剩餘：${formatCurrency(afterPay)}`;

  // 自訂金額即時更新預覽
  if (customInput) {
    customInput.oninput = () => {
      const customVal = Number(customInput.value) || Number(debt.monthlyPayment);
      const afterCustom = Math.max(0, Number(debt.remaining) - customVal);
      if (amtEl)     amtEl.textContent     = formatCurrency(customVal || debt.monthlyPayment);
      if (previewEl) previewEl.textContent = `還款後剩餘：${formatCurrency(afterCustom)}`;
    };
  }

  document.getElementById('modal-debt-pay')?.classList.add('active');
}

/**
 * 確認執行還款（資金連動）
 */
function handleConfirmDebtPay() {
  if (!pendingDebtId) return;

  const customInput = document.getElementById('debt-pay-custom-amount');
  const customVal   = customInput ? (Number(customInput.value) || null) : null;

  const newTx = markMonthlyPayment(appState, pendingDebtId, customVal);
  if (!newTx) {
    showToast('還款金額有誤，請確認！', 'error');
    return;
  }

  saveAppData(appState);

  document.getElementById('modal-debt-pay')?.classList.remove('active');

  // 同步更新儀表板（資金已連動）
  renderDashboard(appState);
  renderDebtPage();

  const debt = (appState.debts || []).find(d => d.id === pendingDebtId);
  const msg  = debt?.isPaid
    ? `🎉 恭喜！債務【${newTx.categoryName.replace('債務還款：','')}】已完全還清！`
    : `✅ 已還款 ${formatCurrency(newTx.amount)}，資金已同步扣除並記錄！`;
  showToast(msg, 'success');
  pendingDebtId = null;
}

/**
 * 刪除債務（事件委派中呼叫）
 */
function handleDeleteDebt(debtId) {
  const debt = (appState.debts || []).find(d => d.id === debtId);
  if (!debt) return;
  if (!confirm(`確定要刪除債務【${debt.name}】？此操作不可復原，且不會回退已還款紀錄。`)) return;

  deleteDebt(appState, debtId);
  saveAppData(appState);
  renderDebtPage();
  showToast(`已刪除債務【${debt.name}】`, 'success');
}

// =========================================================================
// 補充 setupEventListeners：Tab Bar + 債務頁事件
// (在原本的 setupEventListeners 最末尾呼叫 setupDebtEvents)
// =========================================================================

/**
 * 債務頁面所有事件綁定（由 setupEventListeners 統一呼叫）
 */
function setupDebtEvents() {
  // Tab Bar 切換
  setupTabBar();

  // 開啟新增債務 Modal
  const btnOpenAddDebt = document.getElementById('btn-open-add-debt');
  if (btnOpenAddDebt) {
    btnOpenAddDebt.addEventListener('click', openAddDebtModal);
  }

  // 儲存新增債務
  const btnSaveDebt = document.getElementById('btn-save-debt');
  if (btnSaveDebt) {
    btnSaveDebt.addEventListener('click', handleSaveDebt);
  }

  // 確認還款
  const btnConfirmDebtPay = document.getElementById('btn-confirm-debt-pay');
  if (btnConfirmDebtPay) {
    btnConfirmDebtPay.addEventListener('click', handleConfirmDebtPay);
  }

  // 事件委派：還款按鈕 + 刪除按鈕
  document.addEventListener('click', (e) => {
    // 本月還款按鈕
    const payDebtBtn = e.target.closest('.btn-pay-debt');
    if (payDebtBtn) {
      e.stopPropagation();
      openDebtPayModal(payDebtBtn.dataset.debtId);
      return;
    }
    // 刪除債務按鈕
    const deleteDebtBtn = e.target.closest('.btn-delete-debt');
    if (deleteDebtBtn) {
      e.stopPropagation();
      handleDeleteDebt(deleteDebtBtn.dataset.debtId);
      return;
    }
    // 已還清折疊開關
    const paidToggle = e.target.closest('#btn-toggle-paid-debts');
    if (paidToggle) {
      const paidList = document.getElementById('debt-paid-list');
      if (paidList) paidList.classList.toggle('open');
      return;
    }
  });
}
