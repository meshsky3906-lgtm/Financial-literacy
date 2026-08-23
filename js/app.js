/**
 * FinFlow 智富記帳 - 核心控制器 (App Controller)
 */

import { loadAppData, saveAppData, resetToDefaultData, exportDataAsJson, importDataFromJson } from './storage.js';
import { 
  renderDashboard, 
  renderTransactionLedger, 
  renderCategorySelectGrid, 
  renderAccountSelectOptions, 
  showToast, 
  formatCurrency 
} from './uiRenderer.js';
import { calculateIncomeSplit, getCurrentMonthKey } from './financeLogic.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './categories.js';

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

  // 3. 綁定所有互動事件
  setupEventListeners();
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

  // --- 金額輸入即時檢查（信用風控警戒） ---
  const inputAmount = document.getElementById('input-amount');
  if (inputAmount) {
    inputAmount.addEventListener('input', () => {
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
      const txId = deleteBtn.dataset.txId;
      handleDeleteTransaction(txId);
      return;
    }

    // 點擊信用卡上的「繳納卡費」按鈕
    const payBillBtn = e.target.closest('.btn-pay-bill');
    if (payBillBtn) {
      const cardId = payBillBtn.dataset.cardId;
      openPayBillModal(cardId);
      return;
    }
  });

  // --- 確認繳納信用卡費 ---
  const btnConfirmPay = document.getElementById('btn-confirm-pay-bill');
  if (btnConfirmPay) {
    btnConfirmPay.addEventListener('click', () => {
      handleConfirmPayBill();
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

  // 重設為初始示範資料
  const btnReset = document.getElementById('btn-reset-demo');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('確定要重設為初始示範資料嗎？所有手動變更將被恢復為預設設定。')) {
        appState = resetToDefaultData();
        renderDashboard(appState);
        showToast('已重設為包含玉山、富邦與 50/30/20 的初始狀態！', 'success');
        modalBackup.classList.remove('active');
      }
    });
  }
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
  const categoryHint = document.getElementById('selected-category-hint');

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
      // 同步 UI 標籤按鈕高亮
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
  // 支出預設玉山卡或富邦卡，收入預設活存帳戶
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
 * 即時檢查刷卡金額是否接近或超過 $18,000 (30% 安全紅線)
 */
function checkCreditRiskOnInput() {
  const badge = document.getElementById('credit-warning-badge');
  if (!badge) return;

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
 * 儲存一筆新交易 (權責發生制 + 帳戶餘額同步)
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

  // 更新對應帳戶餘額 (信用卡增加待繳負債，活存減少現金；收入則增加活存)
  const targetAcc = appState.accounts.find(a => a.id === newTx.accountId);
  if (targetAcc) {
    if (newTx.type === 'expense') {
      if (targetAcc.type === 'credit') {
        // 信用卡：增加待繳帳款
        targetAcc.balance = Number(targetAcc.balance || 0) + amount;
      } else {
        // 活存/現金：減少可用餘額
        targetAcc.balance = Number(targetAcc.balance || 0) - amount;
      }
    } else if (newTx.type === 'income') {
      targetAcc.balance = Number(targetAcc.balance || 0) + amount;
    }
  }

  // 寫入交易陣列
  appState.transactions.unshift(newTx);
  saveAppData(appState);

  // 關閉記帳 Modal
  document.getElementById('modal-entry').classList.remove('active');

  // 重新渲染儀表板
  renderDashboard(appState);
  showToast(`已成功記錄【${newTx.categoryName}】${formatCurrency(amount)}！`, 'success');

  // 若為較大金額之收入，彈出 50/30/20 黃金分流建議 Modal
  if (newTx.type === 'income' && amount >= 5000) {
    setTimeout(() => {
      openSplitAdvisorModal(amount);
    }, 400);
  }
}

/**
 * 刪除一筆交易並回退帳戶餘額
 */
function handleDeleteTransaction(txId) {
  const txIndex = appState.transactions.findIndex(t => t.id === txId);
  if (txIndex === -1) return;

  const tx = appState.transactions[txIndex];
  if (!confirm(`確定要刪除這筆【${tx.categoryName}】${formatCurrency(tx.amount)} 的紀錄嗎？`)) {
    return;
  }

  // 回退帳戶餘額
  const targetAcc = appState.accounts.find(a => a.id === tx.accountId);
  if (targetAcc) {
    if (tx.type === 'expense') {
      if (targetAcc.type === 'credit') {
        targetAcc.balance = Math.max(0, Number(targetAcc.balance || 0) - Number(tx.amount));
      } else {
        targetAcc.balance = Number(targetAcc.balance || 0) + Number(tx.amount);
      }
    } else if (tx.type === 'income') {
      targetAcc.balance = Number(targetAcc.balance || 0) - Number(tx.amount);
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
