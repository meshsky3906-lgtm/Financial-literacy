/**
 * FinFlow 智富記帳 - 預設收支分類庫與財商標籤
 * 
 * 財商標籤分為：
 * 1. need: 50% 必要需求 (生活必需、固定開支)
 * 2. want: 30% 彈性慾望 (提升生活品質、休閒娛樂)
 * 3. invest: 20% 投資儲蓄 (未來成長、自我投資、資產累積)
 * 4. income: 收入來源
 */

export const FINANCE_TAGS = {
  NEED: {
    id: 'need',
    label: '50% 必要需求',
    shortLabel: '必要',
    description: '維持基本生存與工作的固定與必要開銷（房租、三餐、水電、通勤）',
    color: '#6366F1', // Indigo
    badgeClass: 'badge-need'
  },
  WANT: {
    id: 'want',
    label: '30% 彈性慾望',
    shortLabel: '慾望',
    description: '非生存必需、提升生活樂趣與享受的開銷（聚餐、購物、娛樂、旅遊）',
    color: '#F43F5E', // Rose Coral
    badgeClass: 'badge-want'
  },
  INVEST: {
    id: 'invest',
    label: '20% 投資儲蓄',
    shortLabel: '投資/儲蓄',
    description: '讓未來的自己更有錢（ETF/股票、緊急預備金、自我進修課程）',
    color: '#8B5CF6', // Violet Purple
    badgeClass: 'badge-invest'
  }
};

export const DEFAULT_EXPENSE_CATEGORIES = [
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

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: '本業薪資', icon: '💼' },
  { id: 'bonus', name: '工作獎金/年終', icon: '🏆' },
  { id: 'side_hustle', name: '副業/接案收入', icon: '💻' },
  { id: 'dividend', name: '股票股利/配息', icon: '📊' },
  { id: 'interest', name: '銀行利息/回饋', icon: '🪙' },
  { id: 'other_income', name: '其他收入/紅包', icon: '🧧' }
];

// 每日財商金句庫
export const WEALTH_QUOTES = [
  {
    quote: "不要把花剩的錢存起來，而是先把該存的錢存下，再花剩下的錢。",
    author: "華倫·巴菲特 (Warren Buffett)"
  },
  {
    quote: "維持每張信用卡月刷卡額在總額度的 30% 以下，是保護個人銀行信用評分的黃金護城河。",
    author: "金融信用風控準則"
  },
  {
    quote: "緊急預備金不是用來賺取高回報的，而是讓你在風暴來臨時不用被迫賣出優質資產。",
    author: "《致富心態》摩根·豪瑟"
  },
  {
    quote: "富人買入資產，窮人只有支出，中產階級買入他們以為是資產的負債。",
    author: "《富爸爸·窮爸爸》羅伯特·清崎"
  },
  {
    quote: "刷卡是先享受後付款，記帳時務必刷卡當下記入支出，避免假性富裕的心理盲點。",
    author: "現代行為經濟學"
  },
  {
    quote: "將 50% 投入生活必需、30% 犒賞適度慾望、20% 投資未來，能讓你在享受當下的同時持續邁向財務自由。",
    author: "50/30/20 黃金資產配置法"
  }
];
