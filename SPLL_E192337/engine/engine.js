import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

/* UI 元素對應 */
const ui = {
  themeLink: document.getElementById("scene-theme"),
  gameScreen: document.getElementById("game-screen"),
  namePlate: document.getElementById("name-plate"),
  textBox: document.getElementById("dialogue-text"),
  avatarLeft: document.getElementById("avatar-left"),
  avatarRight: document.getElementById("avatar-right"),
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
const TYPE_SPEED = 22;

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

/* --- [Typewriter] 打字機功能 (從 nextStep 移出來) --- */
function startTypewriter(text) {
  if (!ui.textBox) return;

  clearInterval(typingTimer);
  isTyping = true;
  fullTextCache = text || "";
  typeIndex = 0;
  ui.textBox.textContent = "";

  // 如果文字是空的，直接結束
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
  let step;

  // 1. 檢查是否有剩餘的文字分頁
  if (state.textQueue.length) {
    const chunk = state.textQueue.shift();
    // 確保 backStack 有資料才取用
    const last = state.backStack.length > 0 ? state.backStack.at(-1) : { stepData: {} };
    step = { ...last.stepData, text: chunk }; 
  } else {
    // 2. 讀取新的劇本行
    if (state.index >= scenario.length) return; // 劇本結束
    
    let raw = { ...scenario[state.index++] };

    if (!raw.speaker && state.lastSpeaker) raw.speaker = state.lastSpeaker;
    if (raw.speaker) state.lastSpeaker = raw.speaker;

    if (raw.scene) {
      switchScene(raw.scene);
    }

    // 處理文字分頁
    if (raw.text) {
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

    state.history.push({ speaker: raw.speaker, text: raw.text });
    step = raw;
  }

  // 渲染畫面 (正常播放模式)
  render(step, false);
  
  // 存入回放堆疊
  state.backStack.push({ 
    index: state.index, 
    textQueue: [...state.textQueue], 
    stepData: JSON.parse(JSON.stringify(step)) 
  });
}

function prevStep() {
  clearInterval(typingTimer);
  isTyping = false;

  if (state.backStack.length <= 1) return; // 已經在第一頁
  state.backStack.pop(); // 移除當前頁
  const prev = state.backStack.at(-1); // 讀取上一頁
  
  // 還原狀態
  state.index = prev.index;
  state.textQueue = [...prev.textQueue];
  
  if (prev.stepData.scene) {
    switchScene(prev.stepData.scene);
  }

  // 渲染畫面 (開啟 instant 模式，不跑打字機)
  render(prev.stepData, true);
}

/* --- [Render] 渲染畫面 --- */
// 參數 instant: true 代表直接顯示文字 (回放時)，false 代表跑打字機
function render(step, instant = false) {
  // 背景圖片
  if (step.bg) changeBackground(step.bg);

  // 名字與對話框
  if (ui.namePlate) {
    if (!step.speaker || step.speaker === "Narrator") {
      ui.namePlate.style.visibility = "hidden";
    } else {
      ui.namePlate.style.visibility = "visible";
      ui.namePlate.textContent = step.speaker;
    }
  }
  
  // 文字顯示邏輯修正
  if (ui.textBox) {
    if (instant) {
      // 回放時直接顯示
      ui.textBox.textContent = step.text || "";
      isTyping = false;
      fullTextCache = step.text || ""; // 更新 cache 以防切換到點擊
    } else {
      // 正常播放跑打字機
      startTypewriter(step.text || "");
    }
  }
  
  // 立繪更新
  updateCharacters(step);
}

function changeBackground(bg) { 
  if (!backgrounds[bg]) return; 
  ui.gameScreen.style.backgroundImage = `url('${backgrounds[bg]}')`; 
}

function updateCharacters(step) {
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
  ui.gameScreen.addEventListener("click", e => {
    if (e.target.closest("#log-window") || 
        e.target.closest("#chapter-menu") || 
        e.target.closest("button") || 
        e.target.closest("#back-btn")) return;

    if (isTyping) {
      skipTypewriter();
      return;
    }

    nextStep();
  });

  if (ui.logBtn) ui.logBtn.onclick = e => { e.stopPropagation(); showLog(); };
  if (ui.closeLogBtn) ui.closeLogBtn.onclick = e => { e.stopPropagation(); ui.logWindow.hidden = true; };
  if (ui.backBtn) ui.backBtn.onclick = e => { e.stopPropagation(); prevStep(); };

  document.addEventListener("click", e => {
    const r = document.createElement("div");
    r.className = "click-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 900);
  });

  switchScene("scene1"); 
  nextStep();
}

initGame();