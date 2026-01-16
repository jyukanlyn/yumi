/* engine/engine.js */
import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

/* ================================
   UI Cache
================================ */
const ui = {
  namePlate: document.getElementById("name-plate"),
  textBox: document.getElementById("dialogue-text"),
  avatarLeft: document.getElementById("avatar-left"),
  avatarRight: document.getElementById("avatar-right"),
  gameScreen: document.getElementById("game-screen"),
  chapterBtn: document.getElementById("chapter-btn"),
  chapterMenu: document.getElementById("chapter-menu"),
  logBtn: document.getElementById("log-btn"),
  logWindow: document.getElementById("log-window"),
  logContent: document.getElementById("log-content"),
  closeLogBtn: document.getElementById("close-log-btn"),
  backBtn: document.getElementById("back-btn"),
  eventImage: document.getElementById("event-image"),
};

/* ================================
   Scene Switch
================================ */
let currentSceneClass = null;

export function switchScene(name) {
  if (!ui.gameScreen) return;
  
  if (currentSceneClass) {
    ui.gameScreen.classList.remove(currentSceneClass);
  }

  if (name) {
    ui.gameScreen.classList.add(name);
    currentSceneClass = name;
  }
}

/* ================================
   Utils
================================ */
function cleanPageStart(text) {
  return text.replace(/^[\n\r\s]+/, "");
}

function splitTextByHeight(text, maxHeight) {
  const test = document.createElement("div");
  const style = getComputedStyle(ui.textBox);

  Object.assign(test.style, {
    position: "absolute",
    visibility: "hidden",
    width: ui.textBox.offsetWidth + "px",
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });

  document.body.appendChild(test);

  let pages = [];
  let current = "";

  for (let c of text) {
    current += c;
    test.textContent = current;
    if (test.scrollHeight > maxHeight - 10) {
      pages.push(cleanPageStart(current.slice(0, -1)));
      current = c;
    }
  }

  if (current.trim()) pages.push(cleanPageStart(current));
  document.body.removeChild(test);
  return pages;
}

/* ================================
   Core Flow
================================ */
function nextStep() {
  let step;

  if (state.textQueue.length) {
    const chunk = state.textQueue.shift();
    const last = state.backStack.at(-1);
    step = { ...last.stepData, text: chunk };
  } else {
    if (state.index >= scenario.length) return;

    let raw = { ...scenario[state.index++] };

    if (!raw.speaker && state.lastSpeaker) raw.speaker = state.lastSpeaker;
    if (raw.speaker) state.lastSpeaker = raw.speaker;

    if (raw.text) {
      const box = document.getElementById("dialogue-box");
      if (box) {
        let maxHeight = box.clientHeight - 90;
        const pages = splitTextByHeight(raw.text, maxHeight);
        raw.text = pages.shift();
        state.textQueue = pages;
      }
    }

    state.history.push({ speaker: raw.speaker, text: raw.text });
    step = raw;
  }

  render(step);

  state.backStack.push({
    index: state.index,
    textQueue: [...state.textQueue],
    stepData: JSON.parse(JSON.stringify(step)),
  });
}

function prevStep() {
  if (state.backStack.length <= 1) return;

  state.backStack.pop();
  const prev = state.backStack.at(-1);

  state.index = prev.index;
  state.textQueue = [...prev.textQueue];
  render(prev.stepData);
}

/* ================================
   Render
================================ */
function render(step) {
  if (step.bg) changeBackground(step.bg);

  if (ui.namePlate) {
    if (!step.speaker || step.speaker === "Narrator") {
      ui.namePlate.style.visibility = "hidden";
    } else {
      ui.namePlate.style.visibility = "visible";
      ui.namePlate.textContent = step.speaker;
    }
  }

  if (ui.textBox) {
    ui.textBox.textContent = step.text || "";
  }

  updateCharacters(step);
}

function changeBackground(bgID) {
  if (!backgrounds[bgID]) return;
  ui.gameScreen.style.backgroundImage = `url('${backgrounds[bgID]}')`;
}

function updateCharacters(step) {
  // 1. 若無講者，隱藏兩側
  if (!step.speaker || step.speaker === "Narrator") {
    if(ui.avatarLeft) ui.avatarLeft.style.display = "none";
    if(ui.avatarRight) ui.avatarRight.style.display = "none";
    return;
  }

  const char = characters[step.speaker];
  if (!char) return;

  const emotion = step.emotion || "normal";
  const src = char.sprites[emotion];
  if (!src) return;

  // 2. 判斷位置
  const position = step.position || char.defaultPosition || "left";
  
  // 3. 決定目標 DOM
  const targetAvatar = position === "right" ? ui.avatarRight : ui.avatarLeft;
  const otherAvatar = position === "right" ? ui.avatarLeft : ui.avatarRight;

  // 4. 隱藏另一側
  if (otherAvatar) {
    otherAvatar.style.display = "none";
    otherAvatar.classList.remove("active");
  }

  if (!targetAvatar) return;

  // 5. 更新圖片與動畫
  if (!targetAvatar.src.endsWith(src)) {
    targetAvatar.src = src;
    targetAvatar.style.display = "block";
    targetAvatar.classList.remove("active");
    
    setTimeout(() => targetAvatar.classList.add("active"), 20);
  } else {
    targetAvatar.style.display = "block";
    if (!targetAvatar.classList.contains("active")) {
        targetAvatar.classList.add("active");
    }
  }
}

/* ================================
   Log
================================ */
function showLog() {
  ui.logContent.innerHTML = "";

  state.history.forEach(l => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<span class="log-name">${l.speaker || ""}</span>
                     <span class="log-text">${l.text}</span>`;
    ui.logContent.appendChild(div);
  });

  ui.logWindow.hidden = false;
}

/* ================================
   Init (修正版：移除重複定義)
================================ */
function initGame() {
  // 主要遊戲點擊推進：建議綁定在 gameScreen 而非 document，避免誤觸
  ui.gameScreen.addEventListener("click", e => {
    // 忽略特定按鈕的點擊
    if (
      e.target.closest("#log-window") ||
      e.target.closest("#chapter-menu") ||
      e.target.closest("button") ||
      e.target.closest(".clickable-area") // 預留給將來的點擊熱區
    ) return;

    nextStep();
  });

  // UI 按鈕事件綁定
  if (ui.logBtn) ui.logBtn.onclick = e => {
    e.stopPropagation(); // 防止觸發上面的 gameScreen click
    showLog();
  };

  if (ui.closeLogBtn) ui.closeLogBtn.onclick = e => {
    e.stopPropagation();
    ui.logWindow.hidden = true;
  };

  if (ui.backBtn) ui.backBtn.onclick = e => {
    e.stopPropagation();
    prevStep();
  };

  // 點擊波紋特效 (Ripple)：綁定在 document 以便所有點擊都有回饋
  document.addEventListener("click", e => {
    const r = document.createElement("div");
    r.className = "click-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 900);
  });

  // 啟動遊戲
  switchScene("scene1");
  nextStep();
}

// 執行初始化
initGame();