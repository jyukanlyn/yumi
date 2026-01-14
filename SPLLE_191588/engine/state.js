// engine/state.js

// 遊戲狀態 (存檔相關資料放這裡)
export const state = {
  index: 0,           // 目前讀到第幾句
  history: [],        // (文字紀錄用) 用來存 LOG 內容
  backStack: [],      // ✨ (必須有這行) 用來存「每一頁的狀態快照」，給上一頁功能專用
  chapter: 1,         // 目前章節
  flags: {},          // 選項或好感度
  textQueue: []       // 還沒講完的文字
};

// 背景圖片對照表 (註冊場景 ID 對應的路徑)
// ⚠️ 注意：變數名稱 backgrounds 只能宣告一次，所以這裡整合在一起
export const backgrounds = {
  // 格式 -> 場景ID: "圖片相對路徑"
  
  // 您的範例
  room: "assets/bg/bedroom.png",
  
  // 擴充範例 (請依照您實際的 assets 資料夾內容修改，如果沒有這些圖，請刪除或換成有的圖)
  school: "assets/bg/school_gate.jpg",
  classroom: "assets/bg/classroom_day.jpg",
  park: "assets/bg/park_sunset.png",
  black: "assets/bg/black.png" // 全黑背景，適合回憶或轉場用
};