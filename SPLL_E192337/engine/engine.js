import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

/* UI 元素對應 */
const ui = {
  themeLink: document.getElementById("scene-theme"),
  gameScreen: document.getElementById("game-screen"),
  namePlate: document.getElementById("name-plate"),
  textBox: document.getElementById("dialogue-text"),
  dialogueBox: document.getElementById("dialogue-box"), // 新增：為了控制對話框隱藏
  avatarLeft: document.getElementById("avatar-left"),
  avatarRight: document.getElementById("avatar-right"),
  
  // ★ 新增：彈窗相關 UI
  popupOverlay: document.getElementById("popup-overlay"),
  popupContent: document.getElementById("popup-content"),

  chapterBtn: document.getElementById("chapter-btn"),
  chapterMenu: document.getElementById("chapter-menu"),
  logBtn: document.getElementById("log-btn"),
  logWindow: document.getElementById("log-window"),
  logContent: document.getElementById("log-content"),
  closeLogBtn: document.getElementById("close-log-btn"),
  backBtn: document.getElementById("back-btn"),
  eventImage: document.getElementById("event-image"),
};

/* --- [Typewriter] 打字機狀態 --- */
let typingTimer = null;
let isTyping = false;
let fullTextCache = "";
let typeIndex = 0;
const TYPE_SPEED = 45;

/* --- [Popup] 彈窗狀態 --- */
let isPopupMode = false;

/* --- [功能] 場景切換 --- */
let currentScene = null;

export function switchScene(name) {
  if (ui.themeLink) {
    ui.themeLink.href = `ui/${name}.css`;
  }
  if (ui.gameScreen) {
    if (currentScene) ui.gameScreen.classList.remove(currentScene);
    ui.gameScreen.classList.add(name);
    ui.gameScreen.style.backgroundImage = ""; 
  }
  currentScene = name;
}

/* --- [助手] 文字分頁邏輯 --- */
function cleanPageStart(t) { return t.replace(/^[\n\r\s]+/, ""); }

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

/* --- [Typewriter] 打字機功能 --- */
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

/* --- [核心] 下一步邏輯 --- */
function nextStep() {
  // 如果正在彈窗模式，先關閉彈窗，但不急著讀下一行（因為 click 事件會再次觸發 nextStep）
  // 這裡的邏輯主要由 click handler 控制
  
  let step;

  // 1. 檢查是否有剩餘的文字分頁
  if (state.textQueue.length) {
    const chunk = state.textQueue.shift();
    const last = state.backStack.length > 0 ? state.backStack.at(-1) : { stepData: {} };
    step = { ...last.stepData, text: chunk }; 
  } else {
    // 2. 讀取新的劇本行
    if (state.index >= scenario.length) return; 
    
    let raw = { ...scenario[state.index++] };

    // 繼承說話者 (如果不是彈窗)
    if (!raw.popup) {
        if (!raw.speaker && state.lastSpeaker) raw.speaker = state.lastSpeaker;
        if (raw.speaker) state.lastSpeaker = raw.speaker;
    }

    // 偵測場景切換並自動標記清空
    if (raw.scene) {
      switchScene(raw.scene);
      raw.clearChars = true; 
    }

    // 處理文字分頁 (僅在非彈窗時)
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

    state.history.push({ speaker: raw.speaker || "System", text: raw.text });
    step = raw;
  }

  render(step, false);
  
  state.backStack.push({ 
    index: state.index, 
    textQueue: [...state.textQueue], 
    stepData: JSON.parse(JSON.stringify(step)) 
  });
}

function prevStep() {
  // 彈窗模式下禁止回頭，或者強制關閉彈窗
  if (isPopupMode) {
      closePopup();
      return; // 這裡可以選擇是否要真的退回上一句，還是只是關視窗
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

  render(prev.stepData, true);
}

/* --- [Render] 渲染畫面 --- */
function render(step, instant = false) {
  // 背景圖片
  if (step.bg) changeBackground(step.bg);

  // ★★★ 處理 Popup 邏輯 ★★★
  if (step.popup) {
      // 1. 顯示彈窗
      isPopupMode = true;
      ui.popupContent.textContent = step.text;
      ui.popupOverlay.classList.remove("hidden");
      
      // 2. 為了動畫效果，給予 active class
      // 使用 setTimeout 確保 transition 效果
      setTimeout(() => ui.popupOverlay.classList.add("active"), 10);

      // 3. 隱藏對話框與立繪 (可選，看你要不要保留背景)
      // 這裡選擇保留立繪背景，但隱藏對話框本體以免干擾
      if (ui.dialogueBox) ui.dialogueBox.style.opacity = "0";
      
      return; // ★ 重要：如果是彈窗，就不執行下方的打字機邏輯
  } else {
      // 恢復非彈窗狀態
      closePopup();
  }

  // 名字與對話框
  if (ui.namePlate) {
    if (!step.speaker || step.speaker === "Narrator") {
      ui.namePlate.style.visibility = "hidden";
    } else {
      ui.namePlate.style.visibility = "visible";
      ui.namePlate.textContent = step.speaker;
    }
  }
  
  // 文字顯示
  if (ui.textBox) {
    if (instant) {
      ui.textBox.textContent = step.text || "";
      isTyping = false;
      fullTextCache = step.text || ""; 
    } else {
      startTypewriter(step.text || "");
    }
  }
  
  updateCharacters(step);
}

function closePopup() {
    isPopupMode = false;
    if (ui.popupOverlay) {
        ui.popupOverlay.classList.remove("active");
        setTimeout(() => ui.popupOverlay.classList.add("hidden"), 400); // 等待動畫結束再隱藏
    }
    // 恢復對話框顯示
    if (ui.dialogueBox) ui.dialogueBox.style.opacity = "1";
}

function changeBackground(bg) { 
  if (!backgrounds[bg]) return; 
  ui.gameScreen.style.backgroundImage = `url('${backgrounds[bg]}')`; 
}

/* --- [Update Characters] 立繪更新邏輯 --- */
function updateCharacters(step) {
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

/* --- [Log] 歷史紀錄 --- */
function showLog() {
  ui.logContent.innerHTML = "";
  state.history.forEach(l => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<span class="log-name">${l.speaker || ""}</span><span class="log-text">${l.text}</span>`;
    ui.logContent.appendChild(div);
  });
  ui.logWindow.hidden = false;
}

/* --- [初始化] --- */
function initGame() {
  // 1. 滑鼠/觸控點擊事件
  ui.gameScreen.addEventListener("click", e => {
    if (e.target.closest("#log-window") || 
        e.target.closest("#chapter-menu") || 
        e.target.closest("button") || 
        e.target.closest("#back-btn")) return;

    // ★ 彈窗邏輯：如果彈窗開著，點擊就是「關閉彈窗並執行下一步」
    if (isPopupMode) {
        // closePopup(); // closePopup 會在 render(nextStep) 中自動呼叫
        nextStep();     // 直接讀下一句，下一句 render 時會自動把彈窗關掉
        return;
    }

    if (isTyping) {
      skipTypewriter();
      return;
    }
    nextStep();
  });

  // 2. 按鈕事件
  if (ui.logBtn) ui.logBtn.onclick = e => { e.stopPropagation(); showLog(); };
  if (ui.closeLogBtn) ui.closeLogBtn.onclick = e => { e.stopPropagation(); ui.logWindow.hidden = true; };
  if (ui.backBtn) ui.backBtn.onclick = e => { e.stopPropagation(); prevStep(); };

  // 3. 點擊波紋效果
  document.addEventListener("click", e => {
    const r = document.createElement("div");
    r.className = "click-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 900);
  });

  // 4. 鍵盤控制
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

  switchScene("scene1"); 
  nextStep();
}

initGame();