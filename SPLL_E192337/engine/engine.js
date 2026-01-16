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
   Scene Switch (Fixed)
================================ */
let currentSceneClass = null; // 用來記錄當前的場景 class

export function switchScene(name) {
  if (!ui.gameScreen) return;
  
  // 自動移除上一個場景，不需要硬寫 remove("scene1", "scene2"...)
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
      // 確保 box 存在再計算高度，避免報錯
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
  // 1. 如果沒有講者或是旁白，隱藏左右兩側立繪
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

  // 2. 判斷位置：優先讀取 step.position，其次讀取 character 設定，預設為 left
  const position = step.position || char.defaultPosition || "left";
  
  // 3. 決定目標 DOM
  const targetAvatar = position === "right" ? ui.avatarRight : ui.avatarLeft;
  const otherAvatar = position === "right" ? ui.avatarLeft : ui.avatarRight;

  // 4. 隱藏另一側（避免左右同時出現同一個人的殘影，或是單人對話模式）
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
    
    // 短暫延遲觸發 CSS transition
    setTimeout(() => targetAvatar.classList.add("active"), 20);
  } else {
    // 圖片一樣時，確保它是顯示狀態
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
   Init
================================ */
function initGame() {
document.addEventListener("click", e => {
  if (
    e.target.closest("#log-window") ||
    e.target.closest("#chapter-menu") ||
    e.target.closest("button") ||
    e.target.closest("#back-btn")
  ) return;

  nextStep();
});


  if (ui.logBtn) ui.logBtn.onclick = e => {
    e.stopPropagation();
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

function initGame() {
  document.addEventListener("click", e => {
    if (
      e.target.closest("#log-window") ||
      e.target.closest("#chapter-menu") ||
      e.target.closest("button") ||
      e.target.closest("#back-btn")
    ) return;

    nextStep();
  });

  if (ui.logBtn) ui.logBtn.onclick = e => {
    e.stopPropagation();
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
