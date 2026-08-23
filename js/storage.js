/**
 * FinFlow 智富記帳 - 本地持久化與資料管理模組
 */

const STORAGE_KEY = 'finflow_app_data_v3';

/**
 * 預設帳戶資料庫（依據使用者指示設置玉山與富邦信用卡，額度6萬，安全上限1.8萬，初始餘額歸零）
 */
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_bank_main',
    name: '台幣主要活存 (薪轉/日常)',
    type: 'liquid',
    bankName: '主要銀行活存',
    balance: 0,
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
    balance: 0,       // 當前待繳帳款歸零
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
    balance: 0,       // 當前待繳帳款歸零
    icon: '💳',
    color: '#0284C7', // 富邦品牌活力藍
    description: '額度 $60,000 / 每月嚴格風控安全上限 $18,000'
  },
  {
    id: 'acc_emergency',
    name: '🛡️ 緊急預備金專戶',
    type: 'emergency',
    bankName: '高利活存/專屬避風港',
    balance: 0,
    icon: '🛡️',
    color: '#6366F1',
    description: '應對生病、失業或意外之 3~6 個月安全防護金，非緊急絕不動用'
  },
  {
    id: 'acc_invest',
    name: '📈 指數化投資專戶 (ETF/複利)',
    type: 'investment',
    bankName: '證券交割戶',
    balance: 0,
    icon: '📈',
    color: '#8B5CF6',
    description: '長期財務自由引擎（0050/006208/VT/VOO），只進不出'
  }
];

/**
 * 初始交易資料（全新空白狀態）
 */
const DEFAULT_TRANSACTIONS = [];

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
