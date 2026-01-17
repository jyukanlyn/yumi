import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

/* ============================================================
   📍 UI 元素對應
   (請確保 HTML ID 與此處一致)
============================================================ */
const ui = {
  themeLink: document.getElementById("scene-theme"),
  gameScreen: document.getElementById("game-screen"),
  
  // 轉場遮罩
  transitionOverlay: document.getElementById("transition-overlay"),
  
  // 彈窗
  popupOverlay: document.getElementById("popup-overlay"),
  popupContent: document.getElementById("popup-content"),

  // 對話相關
  namePlate: document.getElementById("name-plate"),
  textBox: document.getElementById("dialogue-text"),
  dialogueBox: document.getElementById("dialogue-box"),
  
  // 立繪
  avatarLeft: document.getElementById("avatar-left"),
  avatarRight: document.getElementById("avatar-right"),
  
  // 選單與 Log
  chapterBtn: document.getElementById("chapter-btn"),
  chapterMenu: document.getElementById("chapter-menu"),
  logBtn: document.getElementById("log-btn"),
  logWindow: document.getElementById("log-window"),
  logContent: document.getElementById("log-content"),
  closeLogBtn: document.getElementById("close-log-btn"),
  backBtn: document.getElementById("back-btn"),
  eventImage: document.getElementById("event-image"),
};

/* ============================================================
   ⌨️ 打字機狀態
============================================================ */
let typingTimer = null;
let isTyping = false;
let fullTextCache = "";
let typeIndex = 0;
const TYPE_SPEED = 40; // 打字速度 (毫秒)

/* ============================================================
   🏁 遊戲狀態與變數
============================================================ */
let isPopupMode = false; // 是否正在顯示彈窗
let currentScene = null; // 當前場景 CSS 名稱

/* ============================================================
   🛠️ 輔助功能：場景切換與文字處理
============================================================ */

/**
 * 切換 CSS 主題場景
 * @param {string} name - css 檔案名稱 (不含路徑與副檔名)
 */
export function switchScene(name) {
  // 1. 換 CSS 檔
  if (ui.themeLink) {
    ui.themeLink.href = `ui/${name}.css`;
  }

  // 2. 換 Class 並清除殘留的 JS 背景設定
  if (ui.gameScreen) {
    if (currentScene) ui.gameScreen.classList.remove(currentScene);
    ui.gameScreen.classList.add(name);
    
    // ★ 清除 JS 設定的背景，讓 CSS 能完全接管 (避免 style="background:..." 殘留)
    ui.gameScreen.style.backgroundImage = ""; 
    ui.gameScreen.style.backgroundSize = ""; 
    ui.gameScreen.style.backgroundPosition = "";
  }
  currentScene = name;
}

// 清除段落開頭的空白與換行
function cleanPageStart(t) { return t.replace(/^[\n\r\s]+/, ""); }

// 根據高度切割文字 (分頁邏輯)
function splitTextByHeight(text, maxH) {
  const test = document.createElement("div");
  const style = getComputedStyle(ui.textBox);
  
  Object.assign(test.style, {
    position: "absolute",
    visibility: "hidden",
    width: ui.textBox.clientWidth + "px",
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding, 
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  });
  
  document.body.appendChild(test);
  let pages = [], cur = "";
  
  for (let c of text) {
    test.textContent = cur + c; 
    if (test.scrollHeight > maxH) {
      if (cur.length === 0) {
        pages.push(c);
      } else {
        pages.push(cleanPageStart(cur));
        cur = c;
      }
    } else {
      cur += c;
    }
  }
  if (cur.trim()) pages.push(cleanPageStart(cur));
  document.body.removeChild(test);
  return pages;
}

/* ============================================================
   ✍️ 打字機核心
============================================================ */
function startTypewriter(text) {
  if (!ui.textBox) return;

  clearInterval(typingTimer);
  isTyping = true;
  fullTextCache = text || "";
  typeIndex = 0;
  ui.textBox.textContent = "";

  if (!fullTextCache) {
    isTyping = false;
    return;
  }

  typingTimer = setInterval(() => {
    if (typeIndex >= fullTextCache.length) {
      clearInterval(typingTimer);
      isTyping = false;
      return;
    }
    ui.textBox.textContent += fullTextCache[typeIndex++];
  }, TYPE_SPEED);
}

function skipTypewriter() {
  if (!isTyping) return;
  clearInterval(typingTimer);
  ui.textBox.textContent = fullTextCache;
  isTyping = false;
}

/* ============================================================
   🎬 轉場控制 (Transition)
============================================================ */
function handleTransition(type, callback) {
  if (type === "fade" && ui.transitionOverlay) {
    // 1. 變黑 (Fade Out)
    ui.transitionOverlay.classList.add("active");

    // 2. 等待動畫時間 (0.5s = 500ms)
    setTimeout(() => {
      // 3. 執行真正的換場邏輯 (回呼函式)
      callback();

      // 4. 等待畫面渲染後，再變亮 (Fade In)
      setTimeout(() => {
        ui.transitionOverlay.classList.remove("active");
      }, 50); 
    }, 500);
  } else {
    // 如果沒有轉場或元素缺失，直接執行
    callback();
  }
}

/* ============================================================
   🚀 核心流程控制 (Next / Prev)
============================================================ */

/**
 * 決定下一步要做什麼 (判斷分頁、轉場、執行)
 */
function nextStep() {
  // 1. 彈窗模式：優先關閉彈窗，不讀下一句
  // (因為 click 事件會觸發 nextStep，這裡只需 return，讓 closePopup 透過 render 自動處理)
  if (isPopupMode) return;

  // 2. 檢查是否有剩餘的文字分頁
  if (state.textQueue.length) {
    const chunk = state.textQueue.shift();
    const last = state.backStack.length > 0 ? state.backStack.at(-1) : { stepData: {} };
    const step = { ...last.stepData, text: chunk };
    
    // ★★★ [LOG 修復] 分頁後的文字也要進 Log ★★★
    state.history.push({ speaker: step.speaker || "System", text: chunk });
    
    render(step, false);
    
    state.backStack.push({ 
        index: state.index, 
        textQueue: [...state.textQueue], 
        stepData: JSON.parse(JSON.stringify(step)) 
    });
    return;
  }

  // 3. 劇本結束檢查
  if (state.index >= scenario.length) return;

  // 4. 預讀下一行資料 (尚未 index++)
  let raw = { ...scenario[state.index] };

  // 5. 判斷是否需要轉場
  if (raw.transition) {
    handleTransition(raw.transition, () => {
      executeStep(); // 轉場黑屏中間執行
    });
  } else {
    executeStep(); // 直接執行
  }
}

/**
 * 真正執行下一句 (更新 index, 處理邏輯)
 */
function executeStep() {
  let raw = { ...scenario[state.index++] };

  // 繼承說話者 (如果不是彈窗)
  if (!raw.popup) {
    if (!raw.speaker && state.lastSpeaker) raw.speaker = state.lastSpeaker;
    if (raw.speaker) state.lastSpeaker = raw.speaker;
  }

  // ★ 偵測場景切換：換 CSS 並自動清空立繪
  if (raw.scene) {
    switchScene(raw.scene);
    raw.clearChars = true; 
  }

  // 文字分頁計算 (僅在非彈窗時)
  if (raw.text && !raw.popup) {
    const box = ui.textBox;
    if (box) {
      const style = window.getComputedStyle(box);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      let maxH = box.clientHeight - paddingY - 10;
      if (maxH < 30) maxH = 200; 

      const pages = splitTextByHeight(raw.text, maxH);
      raw.text = pages.shift(); 
      state.textQueue = pages;  
    }
  }

  // [LOG 正常紀錄] 新的一行文字進 Log
  state.history.push({ speaker: raw.speaker || "System", text: raw.text });
  
  // 渲染畫面
  render(raw, false);
  
  // 存入 BackStack (深拷貝)
  state.backStack.push({ 
    index: state.index, 
    textQueue: [...state.textQueue], 
    stepData: JSON.parse(JSON.stringify(raw)) 
  });
}

function prevStep() {
  // 彈窗模式下禁止回頭，強制關閉彈窗
  if (isPopupMode) {
      closePopup();
      return; 
  }

  clearInterval(typingTimer);
  isTyping = false;

  if (state.backStack.length <= 1) return; 
  state.backStack.pop(); 
  const prev = state.backStack.at(-1); 
  
  state.index = prev.index;
  state.textQueue = [...prev.textQueue];
  
  if (prev.stepData.scene) {
    switchScene(prev.stepData.scene);
  }

  // 回放模式：instant = true (不打字)
  render(prev.stepData, true);
}

/* ============================================================
   🎨 Render 畫面渲染
============================================================ */
function render(step, instant = false) {
  // 1. 背景處理 (支援陣列疊圖)
  if (step.bg) changeBackground(step.bg);

  // 2. 彈窗 (Popup) 處理
  if (step.popup) {
      isPopupMode = true;
      if (ui.popupContent) ui.popupContent.textContent = step.text;
      if (ui.popupOverlay) {
          ui.popupOverlay.classList.remove("hidden");
          setTimeout(() => ui.popupOverlay.classList.add("active"), 10);
      }
      
      // 隱藏對話框，保留背景
      if (ui.dialogueBox) ui.dialogueBox.style.opacity = "0";
      
      return; // 彈窗模式下不處理後續對話框邏輯
  } else {
      closePopup();
  }

  // 3. 名字與對話框顯示
  if (ui.namePlate) {
    if (!step.speaker || step.speaker === "Narrator") {
      ui.namePlate.style.visibility = "hidden";
    } else {
      ui.namePlate.style.visibility = "visible";
      ui.namePlate.textContent = step.speaker;
    }
  }
  
  // 4. 文字內容顯示
  if (ui.textBox) {
    if (instant) {
      ui.textBox.textContent = step.text || "";
      isTyping = false;
      fullTextCache = step.text || ""; 
    } else {
      startTypewriter(step.text || "");
    }
  }
  
  // 5. 立繪更新
  updateCharacters(step);
}

/* 關閉彈窗 */
function closePopup() {
    isPopupMode = false;
    if (ui.popupOverlay) {
        ui.popupOverlay.classList.remove("active");
        setTimeout(() => ui.popupOverlay.classList.add("hidden"), 400);
    }
    if (ui.dialogueBox) ui.dialogueBox.style.opacity = "1";
}

/* 切換背景 (支援單張字串或多張陣列) */
function changeBackground(bg) { 
  if (!bg) return;

  let bgString = "";
  
  if (Array.isArray(bg)) {
    // 陣列處理：["A", "B"] -> url(A), url(B)
    const urls = bg.map(name => {
      const path = backgrounds[name];
      return path ? `url('${path}')` : null;
    }).filter(u => u);
    bgString = urls.join(", ");
  } else {
    // 字串處理
    const path = backgrounds[bg];
    if (path) bgString = `url('${path}')`;
  }

  if (bgString && ui.gameScreen) {
    ui.gameScreen.style.backgroundImage = bgString;
    // 確保樣式正確
    ui.gameScreen.style.backgroundSize = "cover";
    ui.gameScreen.style.backgroundPosition = "center";
    ui.gameScreen.style.backgroundRepeat = "no-repeat";
  }
}

/* 立繪更新邏輯 */
function updateCharacters(step) {
  // 1. 清空立繪指令
  if (step.clearChars) {
    if (ui.avatarLeft) {
      ui.avatarLeft.style.display = "none";
      ui.avatarLeft.classList.remove("active");
    }
    if (ui.avatarRight) {
      ui.avatarRight.style.display = "none";
      ui.avatarRight.classList.remove("active");
    }
  }

  // 2. 旁白隱藏
  if (!step.speaker || step.speaker === "Narrator") {
    if (ui.avatarLeft) ui.avatarLeft.style.display = "none";
    if (ui.avatarRight) ui.avatarRight.style.display = "none";
    return;
  }

  const char = characters[step.speaker];
  if (!char) return;

  const emotion = step.emotion || "normal";
  const src = char.sprites[emotion];
  if (!src) return;

  const pos = step.position || char.defaultPosition || "left";
  const target = pos === "right" ? ui.avatarRight : ui.avatarLeft;
  const other = pos === "right" ? ui.avatarLeft : ui.avatarRight;

  if (other) {
    other.style.display = "none";
    other.classList.remove("active");
  }

  if (!target) return;

  // 切換圖片與動畫
  if (!target.src.endsWith(src)) {
    target.src = src;
    target.style.display = "block";
    target.classList.remove("active");
    setTimeout(() => target.classList.add("active"), 20);
  } else {
    target.style.display = "block";
    if (!target.classList.contains("active")) target.classList.add("active");
  }
}

/* ============================================================
   📜 Log 歷史紀錄
============================================================ */
function showLog() {
  if (!ui.logWindow) return;
  ui.logContent.innerHTML = "";
  state.history.forEach(l => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<span class="log-name">${l.speaker || ""}</span><span class="log-text">${l.text}</span>`;
    ui.logContent.appendChild(div);
  });
  ui.logWindow.hidden = false;
}

/* ============================================================
   🎮 遊戲初始化與事件監聽
============================================================ */
function initGame() {
  // 1. 點擊螢幕推進
  ui.gameScreen.addEventListener("click", e => {
    // 忽略按鈕與選單點擊
    if (e.target.closest("#log-window") || 
        e.target.closest("#chapter-menu") || 
        e.target.closest("button") || 
        e.target.closest("#back-btn")) return;

    // ★ 彈窗邏輯：點擊關閉並前進
    if (isPopupMode) {
        nextStep(); 
        return;
    }

    if (isTyping) {
      skipTypewriter();
      return;
    }
    nextStep();
  });

  // 2. 按鈕綁定
  if (ui.logBtn) ui.logBtn.onclick = e => { e.stopPropagation(); showLog(); };
  if (ui.closeLogBtn) ui.closeLogBtn.onclick = e => { e.stopPropagation(); ui.logWindow.hidden = true; };
  if (ui.backBtn) ui.backBtn.onclick = e => { e.stopPropagation(); prevStep(); };

  // 3. 點擊波紋效果 (Ripple)
  document.addEventListener("click", e => {
    const r = document.createElement("div");
    r.className = "click-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 900);
  });

  // 4. 鍵盤控制 (Keyboard)
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }

    if (!ui.logWindow.hidden) {
      if (e.code === "Escape" || e.code === "KeyL") ui.logWindow.hidden = true;
      return;
    }

    switch (e.code) {
      case "Space":       
      case "Enter":       
      case "ArrowRight":  
      case "ArrowDown":   
        if (isPopupMode) {
            nextStep();
        } else if (isTyping) {
          skipTypewriter();
        } else {
          nextStep();
        }
        break;

      case "ArrowLeft":   
      case "ArrowUp":     
      case "Backspace":   
        prevStep();
        break;

      case "KeyL":        
        showLog();
        break;
        
      case "Escape":
        break;
    }
  });

  // 啟動遊戲
  switchScene("scene1"); 
  nextStep();
}

initGame();
