/**
 * FinFlow 智富記帳 - 類別管理 Modal 控制模組
 */

import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  loadCustomCategories,
  saveCustomCategories
} from './categories.js';
import { showToast } from './uiRenderer.js';

let catMgrType = 'expense';
let catMgrEditingId = null;
let catMgrEventsSetup = false;
let catMgrCallback = null;

export function openCategoryManagerModal(type = 'expense', onChangeCallback) {
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
    return '<div class="catmgr-row" data-cat-id="' + cat.id + '" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--surface-border);border-radius:10px;">' +
      '<span style="font-size:1.4rem;min-width:30px;text-align:center;">' + cat.icon + '</span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:0.88rem;font-weight:600;color:#FFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + cat.name + '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;">' +
          (isExpense && tagLabel ? '<span style="font-size:0.68rem;padding:1px 7px;background:' + tagColor + '22;color:' + tagColor + ';border-radius:20px;border:1px solid ' + tagColor + '44;">' + tagLabel + '</span>' : '') +
          '<span style="font-size:0.68rem;color:' + (isCustom ? '#A5B4FC' : 'var(--text-muted)') + ';">' + (isCustom ? '✏️ 已自訂' : '📦 預設') + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0;">' +
        '<button class="catmgr-btn-edit" data-cat-id="' + cat.id + '" title="修改此類別" style="font-size:0.75rem;padding:4px 10px;background:rgba(165,180,252,0.15);border:1px solid rgba(165,180,252,0.3);border-radius:8px;color:#A5B4FC;cursor:pointer;">✏️ 修改</button>' +
        (isCustom ? '<button class="catmgr-btn-delete" data-cat-id="' + cat.id + '" title="刪除此自訂類別" style="font-size:0.75rem;padding:4px 10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#F87171;cursor:pointer;">🗑️</button>' : '') +
      '</div>' +
    '</div>';
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

function setupCatMgrEvents() {
  if (catMgrEventsSetup) return;
  catMgrEventsSetup = true;

  document.getElementById('catmgr-tab-expense')?.addEventListener('click', () => {
    catMgrType = 'expense';
    document.getElementById('catmgr-tab-expense')?.classList.add('active');
    document.getElementById('catmgr-tab-income')?.classList.remove('active');
    const tagWrap = document.getElementById('catmgr-tag-wrap');
    if (tagWrap) tagWrap.style.display = '';
    renderCatMgrList(); resetCatMgrForm();
  });

  document.getElementById('catmgr-tab-income')?.addEventListener('click', () => {
    catMgrType = 'income';
    document.getElementById('catmgr-tab-income')?.classList.add('active');
    document.getElementById('catmgr-tab-expense')?.classList.remove('active');
    const tagWrap = document.getElementById('catmgr-tag-wrap');
    if (tagWrap) tagWrap.style.display = 'none';
    renderCatMgrList(); resetCatMgrForm();
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
      showToast('✅ 類別「' + nameVal + '」已修改完成！', 'success');
    } else {
      const newId = 'custom_' + catMgrType + '_' + Date.now();
      arr.push({ id: newId, name: nameVal, icon: iconVal, ...(isExpense ? { defaultTag: tagVal } : {}) });
      showToast('✅ 已新增類別「' + nameVal + '」！', 'success');
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