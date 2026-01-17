// engine/state.js

// 遊戲狀態 (存檔相關資料放這裡)
export const state = {
  index: 0,           // 目前讀到第幾句
  history: [],        // (文字紀錄用) 用來存 LOG 內容
  backStack: [],      // ✨ (必須有這行) 用來存「每一頁的狀態快照」，給上一頁功能專用
  chapter: 1,         // 目前章節
  flags: {},          // 選項或好感度
  textQueue: [],       // 還沒講完的文字
  lastSpeaker: null,  // ✨ 新增這行：用來記憶上一位發言者
};

// 背景圖片對照表 (註冊場景 ID 對應的路徑)
// ⚠️ 注意：變數名稱 backgrounds 只能宣告一次，所以這裡整合在一起
export const backgrounds = {
  // 格式 -> 場景ID: "圖片相對路徑"
  
  // 您的範例
  room: "assets/bg/ex.png",
  island: "assets/bg/island.jpg",
  black: "assets/bg/black.png",



};
