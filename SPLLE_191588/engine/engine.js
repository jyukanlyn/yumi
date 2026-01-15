import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

// UI 元素快取
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

/* ============================================================
   🛠 工具函數：高度分頁處理
============================================================ */
function splitTextByHeight(text, maxHeight) {
    const testBox = document.createElement("div");
    // 複製對話框的實際樣式以進行精準測量
    const style = getComputedStyle(ui.textBox);
    
    testBox.style.position = "absolute";
    testBox.style.visibility = "hidden";
    testBox.style.width = ui.textBox.clientWidth + "px";
    testBox.style.font = style.font;
    testBox.style.lineHeight = style.lineHeight;
    testBox.style.padding = style.padding;
    testBox.style.boxSizing = style.boxSizing;
    testBox.style.whiteSpace = "pre-wrap";
    testBox.style.wordBreak = "break-all";
    document.body.appendChild(testBox);

    const pages = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
        current += text[i];
        testBox.textContent = current;

        if (testBox.scrollHeight > maxHeight) {
            // 超出高度，存入目前內容並開始新分頁
            pages.push(current.slice(0, -1));
            current = text[i];
        }
    }

    if (current.trim()) pages.push(current);
    document.body.removeChild(testBox);
    return pages;
}

/* ============================================================
   核心運作：下一步與渲染
============================================================ */
function nextStep() {
    let currentStepData = null;

    // 1. 處理隊列中的分頁內容
    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        const rawStep = scenario[state.index - 1]; // 獲取當前劇情的原始資料
        currentStepData = { ...rawStep, text: nextChunk };
    } 
    // 2. 讀取新劇情行
    else {
        if (state.index >= scenario.length) return;

        let step = { ...scenario[state.index] };

        // 存入 LOG 歷史（存完整原始文字）
        state.history.push({
            index: state.index,
            speaker: step.speaker || "",
            text: step.text || ""
        });

        state.index++;
        state.textQueue = [];

        // 計算對話框可用高度
        if (step.text && ui.textBox) {
            const dialogueBox = document.getElementById("dialogue-box");
            const boxStyle = getComputedStyle(dialogueBox);
            
            // 抓取 CSS 變數中的高度並扣除 UI 空間（名字 48px + 底部 62px + 安全邊距）
            let cssHeight = parseFloat(boxStyle.getPropertyValue("--dialogue-height"));
            let maxHeight = cssHeight - 130; 
            
            if (isNaN(maxHeight) || maxHeight <= 0) maxHeight = 120; // 備用安全高度

            const pages = splitTextByHeight(step.text, maxHeight);
            step.text = pages.shift(); // 顯示第一頁
            state.textQueue = pages;   // 剩餘存入隊列
        }

        currentStepData = step;
    }

    render(currentStepData);

    // 存入返回堆疊（用於 Prev 按鈕）
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });
}

function prevStep() {
    if (state.backStack.length <= 1) return;

    state.backStack.pop(); // 彈出當前頁面
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    // 如果退回的是新的劇情行，同步清理歷史記錄
    if (state.index !== prevSnapshot.index) {
        state.history.pop();
    }

    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue];
    render(prevSnapshot.stepData);
}

function render(step) {
    if (!step) return;

    // 背景切換
    if (step.bg) changeBackground(step.bg);

    // 名字標籤渲染與顏色適配
    if (ui.namePlate) {
        if (step.speaker === "Narrator" || !step.speaker) {
            ui.namePlate.style.visibility = "hidden";
        } else {
            ui.namePlate.style.visibility = "visible";
            ui.namePlate.textContent = step.speaker;
            
            const charData = characters[step.speaker];
            // 如果有自定義角色顏色則套用，否則維持 CSS 預設香檳金
            if (charData && charData.nameColor) {
                ui.namePlate.style.color = charData.nameColor;
            } else {
                ui.namePlate.style.color = "var(--champagne-gold)";
            }
        }
    }

    // 文字渲染
    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
        ui.textBox.scrollTop = 0;
    }

    // 事件圖處理
    if (ui.eventImage) {
        if (step.special === "dice") {
            ui.eventImage.src = "assets/effect/dice.png";
            ui.eventImage.hidden = false;
        } else {
            ui.eventImage.hidden = true;
        }
    }

    updateCharacters(step);
}

/* ============================================================
   功能模組：角色、背景與選單
============================================================ */
function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (bgPath && ui.gameScreen) {
        ui.gameScreen.style.backgroundImage = `url('${bgPath}')`;
    }
}

function updateCharacters(step) {
    // 重置立繪
    [ui.avatarLeft, ui.avatarRight].forEach(el => {
        if (el) {
            el.style.display = "none";
            el.classList.remove("active");
        }
    });

    if (step.speaker === "Narrator") return;

    const char = characters[step.speaker];
    if (char && char.sprites) {
        const emotion = step.emotion || "normal";
        const targetAvatar = ui.avatarLeft; // 預設顯示在左側

        if (char.sprites[emotion] && targetAvatar) {
            targetAvatar.src = char.sprites[emotion];
            targetAvatar.style.display = "block";
            // 延遲觸發 active 以確保 CSS 動畫執行
            setTimeout(() => targetAvatar.classList.add("active"), 10);
        }
    }
}

function showLog() {
    if (!ui.logContent) return;
    ui.logContent.innerHTML = ""; 

    state.history.forEach(log => {
        if (!log.text) return;
        const entry = document.createElement("div");
        entry.className = "log-entry";
        const nameHtml = (log.speaker && log.speaker !== "Narrator") 
            ? `<span class="log-name">${log.speaker}</span>` 
            : "";
        entry.innerHTML = `${nameHtml}<span class="log-text">${log.text}</span>`;
        ui.logContent.appendChild(entry);
    });

    ui.logWindow.hidden = false;
    setTimeout(() => { 
        ui.logContent.scrollTop = ui.logContent.scrollHeight; 
    }, 50);
}

/* ============================================================
   🚀 初始化
============================================================ */
function initGame() {
    if (!ui.gameScreen) return;

    // 點擊全螢幕前進
    ui.gameScreen.addEventListener("click", (e) => {
        // 排除掉按鈕點擊，避免前進兩次
        if (e.target.tagName === "BUTTON" || e.target.closest("#back-btn") || e.target.closest(".log-panel")) return;
        nextStep();
    });

    if (ui.logBtn) ui.logBtn.onclick = (e) => { e.stopPropagation(); showLog(); };
    if (ui.closeLogBtn) ui.closeLogBtn.onclick = () => { ui.logWindow.hidden = true; };
    if (ui.backBtn) ui.backBtn.onclick = (e) => { e.stopPropagation(); prevStep(); };

    // 初始化第一步
    if (state.index === 0 && scenario.length > 0) {
        nextStep(); 
    }
}

initGame();
