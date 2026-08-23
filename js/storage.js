/**
 * FinFlow 智富記帳 - 本地持久化與資料管理模組
 */

const STORAGE_KEY = 'finflow_app_data_v1';

/**
 * 預設帳戶資料庫（依據使用者指示設置玉山與富邦信用卡，額度6萬，安全上限1.8萬）
 */
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_bank_main',
    name: '台幣主要活存 (薪轉/日常)',
    type: 'liquid',
    bankName: '主要銀行活存',
    balance: 68500,
    icon: '🏦',
    color: '#3B82F6',
    description: '日常流動資金儲存與卡費扣款帳戶'
  },
  {
    id: 'card_esun',
    name: '玉山銀行信用卡',
    type: 'credit',
    bankName: '玉山銀行',
    creditLimit: 60000,
    safeLimit: 18000, // 30% 信用安全線
    balance: 4200,    // 當前待繳帳款
    icon: '💳',
    color: '#059669', // 玉山品牌翡翠綠
    description: '額度 $60,000 / 每月嚴格風控安全上限 $18,000'
  },
  {
    id: 'card_fubon',
    name: '富邦銀行信用卡',
    type: 'credit',
    bankName: '富邦銀行',
    creditLimit: 60000,
    safeLimit: 18000, // 30% 信用安全線
    balance: 7800,    // 當前待繳帳款
    icon: '💳',
    color: '#0284C7', // 富邦品牌活力藍
    description: '額度 $60,000 / 每月嚴格風控安全上限 $18,000'
  },
  {
    id: 'acc_emergency',
    name: '🛡️ 緊急預備金專戶',
    type: 'emergency',
    bankName: '高利活存/專屬避風港',
    balance: 120000,
    icon: '🛡️',
    color: '#6366F1',
    description: '應對生病、失業或意外之 3~6 個月安全防護金，非緊急絕不動用'
  },
  {
    id: 'acc_invest',
    name: '📈 指數化投資專戶 (ETF/複利)',
    type: 'investment',
    bankName: '證券交割戶',
    balance: 210000,
    icon: '📈',
    color: '#8B5CF6',
    description: '長期財務自由引擎（0050/006208/VT/VOO），只進不出'
  }
];

/**
 * 產生當月日期的輔助函式
 */
function getThisMonthDate(dayNumber) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(dayNumber).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 初始範例交易資料（示範 50/30/20 與雙信用卡操作情境）
 */
const DEFAULT_TRANSACTIONS = [
  {
    id: 'tx_demo_01',
    type: 'income',
    date: getThisMonthDate(5),
    amount: 55000,
    categoryId: 'salary',
    categoryName: '本業薪資',
    categoryIcon: '💼',
    tag: 'income',
    accountId: 'acc_bank_main',
    accountName: '台幣主要活存 (薪轉/日常)',
    note: '本月薪資入帳（已自動分流）'
  },
  {
    id: 'tx_demo_02',
    type: 'expense',
    date: getThisMonthDate(6),
    amount: 15000,
    categoryId: 'housing_rent',
    categoryName: '房租/房貸',
    categoryIcon: '🏠',
    tag: 'need', // 50% 必要
    accountId: 'acc_bank_main',
    accountName: '台幣主要活存 (薪轉/日常)',
    note: '本月房租轉帳'
  },
  {
    id: 'tx_demo_03',
    type: 'expense',
    date: getThisMonthDate(8),
    amount: 11000,
    categoryId: 'education_self',
    categoryName: '進修課程/書籍購置',
    categoryIcon: '📚',
    tag: 'invest', // 20% 投資儲蓄
    accountId: 'acc_bank_main',
    accountName: '台幣主要活存 (薪轉/日常)',
    note: '定期定額 ETF 與財商進修'
  },
  {
    id: 'tx_demo_04',
    type: 'expense',
    date: getThisMonthDate(10),
    amount: 4200,
    categoryId: 'food_dining',
    categoryName: '外食大餐/聚會',
    categoryIcon: '🥩',
    tag: 'want', // 30% 慾望
    accountId: 'card_esun',
    accountName: '玉山銀行信用卡',
    note: '週末好友慶生聚餐（刷玉山卡）'
  },
  {
    id: 'tx_demo_05',
    type: 'expense',
    date: getThisMonthDate(12),
    amount: 3500,
    categoryId: 'shopping_clothing',
    categoryName: '服飾鞋包/精品',
    categoryIcon: '🛍️',
    tag: 'want', // 30% 慾望
    accountId: 'card_fubon',
    accountName: '富邦銀行信用卡',
    note: '換季添購衣物（刷富邦卡）'
  },
  {
    id: 'tx_demo_06',
    type: 'expense',
    date: getThisMonthDate(15),
    amount: 4300,
    categoryId: 'utilities',
    categoryName: '水電瓦斯/網路',
    categoryIcon: '⚡',
    tag: 'need', // 50% 必要
    accountId: 'card_fubon',
    accountName: '富邦銀行信用卡',
    note: '家用網路與水電費自動扣繳（刷富邦卡）'
  },
  {
    id: 'tx_demo_07',
    type: 'expense',
    date: getThisMonthDate(18),
    amount: 3200,
    categoryId: 'traffic_commute',
    categoryName: '通勤交通/加油',
    categoryIcon: '🚇',
    tag: 'need', // 50% 必要
    accountId: 'acc_bank_main',
    accountName: '台幣主要活存 (薪轉/日常)',
    note: '定期票與日常通勤'
  }
];

/**
 * 載入或初始化應用程式狀態
 */
export function loadAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initialData = {
        version: '1.0',
        accounts: DEFAULT_ACCOUNTS,
        transactions: DEFAULT_TRANSACTIONS,
        settings: {
          currency: 'NT$',
          emergencyMonthsTarget: 6,
          monthlyNeedTarget: 30000,
          theme: 'dark'
        }
      };
      saveAppData(initialData);
      return initialData;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error('無法讀取本地儲存資料，重設為預設狀態：', error);
    return {
      version: '1.0',
      accounts: DEFAULT_ACCOUNTS,
      transactions: DEFAULT_TRANSACTIONS,
      settings: {
        currency: 'NT$',
        emergencyMonthsTarget: 6,
        monthlyNeedTarget: 30000,
        theme: 'dark'
      }
    };
  }
}

/**
 * 儲存資料至 localStorage
 */
export function saveAppData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('儲存本地資料失敗：', error);
  }
}

/**
 * 重設為初始示範資料
 */
export function resetToDefaultData() {
  localStorage.removeItem(STORAGE_KEY);
  return loadAppData();
}

/**
 * 匯出完整 JSON 備份檔
 */
export function exportDataAsJson(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.setAttribute('download', `finflow_backup_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 匯入 JSON 備份資料
 */
export function importDataFromJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.accounts || !parsed.transactions) {
      throw new Error('匯入的檔案格式不正確，缺少必要欄位 (accounts / transactions)');
    }
    saveAppData(parsed);
    return { success: true, data: parsed };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
