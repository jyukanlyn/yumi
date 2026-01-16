import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

/* UI 元素對應 */
const ui = {
  themeLink: document.getElementById("scene-theme"), // ★ CSS 切換插槽
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

/* --- [功能] 場景切換 (CSS 換皮) --- */
let currentScene = null;

export function switchScene(name) {
  // 1. 切換 CSS 檔案 (href="ui/scene2.css")
  if (ui.themeLink) {
    ui.themeLink.href = `ui/${name}.css`;
  }

  // 2. 更新容器 Class (用於轉場動畫或備用樣式)
  if (ui.gameScreen) {
    if (currentScene) ui.gameScreen.classList.remove(currentScene);
    ui.gameScreen.classList.add(name);
  }
  // ★★★ 新增這行：清除 JS 留下的背景圖，讓 CSS 背景能顯示出來 ★★★
    ui.gameScreen.style.backgroundImage = ""; 
  }
  
  currentScene = name;
}

/* --- [助手] 文字分頁邏輯 (已修復高度計算) --- */
function cleanPageStart(t) { return t.replace(/^[\n\r\s]+/, ""); }

function splitTextByHeight(text, maxH) {
  const test = document.createElement("div");
  const style = getComputedStyle(ui.textBox);
  
  // 建立測試容器，模擬真實環境寬度與樣式
  Object.assign(test.style, {
    position: "absolute",
    visibility: "hidden",
    width: ui.textBox.clientWidth + "px", // 使用 clientWidth 扣除邊框
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
    // 嘗試加入下一個字
    test.textContent = cur + c; 
    
    // 檢查高度是否爆掉
    if (test.scrollHeight > maxH) {
      if (cur.length === 0) {
        // 防止死循環 (如果連一個字都放不下，強行放入)
        pages.push(c);
      } else {
        pages.push(cleanPageStart(cur));
        cur = c;
      }
    } else {
      cur += c;
    }
  }
  // 加入最後剩下的文字
  if (cur.trim()) pages.push(cleanPageStart(cur));
  document.body.removeChild(test);
  return pages;
}

/* --- [核心] 下一步邏輯 --- */
function nextStep() {
  let step;

  // 1. 檢查是否有剩餘的文字分頁
  if (state.textQueue.length) {
    const chunk = state.textQueue.shift();
    const last = state.backStack.at(-1);
    step = { ...last.stepData, text: chunk }; // 繼承上一頁的狀態，只換文字
  } else {
    // 2. 讀取新的劇本行
    if (state.index >= scenario.length) return; // 劇本結束
    
    let raw = { ...scenario[state.index++] };

    // 繼承說話者 (如果這行沒寫人名，預設是上一個人)
    if (!raw.speaker && state.lastSpeaker) raw.speaker = state.lastSpeaker;
    if (raw.speaker) state.lastSpeaker = raw.speaker;

    // ★ 偵測場景切換 (如果劇本有寫 scene: "scene2")
    if (raw.scene) {
      switchScene(raw.scene);
    }

    // 處理文字分頁
    if (raw.text) {
      const box = ui.textBox;
      if (box) {
        // [修復] 動態計算可用高度
        const style = window.getComputedStyle(box);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        
        // 總高度 - Padding - 10px 緩衝
        let maxH = box.clientHeight - paddingY - 10;
        
        // [安全機制] 如果高度太小 (CSS未載入或隱藏)，給予預設值防止"一字一頁"
        if (maxH < 30) maxH = 200; 

        const pages = splitTextByHeight(raw.text, maxH);
        raw.text = pages.shift(); // 取第一頁
        state.textQueue = pages;  // 剩下的存起來
      }
    }

    state.history.push({ speaker: raw.speaker, text: raw.text });
    step = raw;
  }

  render(step);
  
  // 存入回放堆疊 (深拷貝 stepData 防止污染)
  state.backStack.push({ 
    index: state.index, 
    textQueue: [...state.textQueue], 
    stepData: JSON.parse(JSON.stringify(step)) 
  });
}

function prevStep() {
  if (state.backStack.length <= 1) return; // 已經在第一頁
  state.backStack.pop();
  const prev = state.backStack.at(-1);
  
  // 還原狀態
  state.index = prev.index;
  state.textQueue = [...prev.textQueue];
  
  // 如果這一步有切換場景，倒退時也要切換回去 (檢查 scene 屬性)
  if (prev.stepData.scene) {
    switchScene(prev.stepData.scene);
  } else {
    // 如果沒有 scene 屬性，可能需要還原到上一個已知的場景 (這裡視需求實作，暫不處理複雜回溯)
  }

  render(prev.stepData);
}

/* --- [Render] 渲染畫面 --- */
function render(step) {
  // 背景圖片 (如果還保留 changeBackground 功能)
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
  
  if (ui.textBox) ui.textBox.textContent = step.text || "";
  
  // 立繪更新
  updateCharacters(step);
}

function changeBackground(bg) { 
  if (!backgrounds[bg]) return; 
  // 注意：這會改變 inline style，優先級高於 CSS class
  ui.gameScreen.style.backgroundImage = `url('${backgrounds[bg]}')`; 
}

function updateCharacters(step) {
  // 如果是旁白，隱藏立繪
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

  // 隱藏非當前位置的立繪
  if (other) {
    other.style.display = "none";
    other.classList.remove("active");
  }

  if (!target) return;

  // 切換圖片並觸發轉場動畫
  if (!target.src.endsWith(src)) {
    target.src = src;
    target.style.display = "block";
    target.classList.remove("active");
    // 使用 setTimeout 觸發 CSS transition
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
  // 點擊螢幕推進劇情
  ui.gameScreen.addEventListener("click", e => {
    // 排除點擊 UI 按鈕的情況
    if (e.target.closest("#log-window") || 
        e.target.closest("#chapter-menu") || 
        e.target.closest("button") || 
        e.target.closest("#back-btn")) return;
    nextStep();
  });

  // 按鈕事件綁定
  if (ui.logBtn) ui.logBtn.onclick = e => { e.stopPropagation(); showLog(); };
  if (ui.closeLogBtn) ui.closeLogBtn.onclick = e => { e.stopPropagation(); ui.logWindow.hidden = true; };
  if (ui.backBtn) ui.backBtn.onclick = e => { e.stopPropagation(); prevStep(); };

  // 點擊波紋效果 (可選)
  document.addEventListener("click", e => {
    const r = document.createElement("div");
    r.className = "click-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 900);
  });

  // 初始場景與開始
  // 你可以改成 switchScene("scene1");
  switchScene("scene1"); 
  nextStep();
}

initGame();