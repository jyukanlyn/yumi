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

// ===== 對話框高度分頁工具 =====
function splitTextByHeight(text, maxHeight) {
    const testBox = document.createElement("div");
    testBox.style.position = "absolute";
    testBox.style.visibility = "hidden";
    testBox.style.pointerEvents = "none";
    testBox.style.width = ui.textBox.clientWidth + "px";
    
    // 獲取目前的樣式以確保測量準確
    const style = getComputedStyle(ui.textBox);
    testBox.style.font = style.font;
    testBox.style.lineHeight = style.lineHeight;
    testBox.style.padding = style.padding;
    testBox.style.boxSizing = style.boxSizing;
    testBox.style.whiteSpace = "pre-wrap";
    document.body.appendChild(testBox);

    const pages = [];
    let current = "";

    // 逐字檢查高度
    for (let i = 0; i < text.length; i++) {
        current += text[i];
        testBox.textContent = current;

        if (testBox.scrollHeight > maxHeight) {
            // 超過高度，存入目前內容（扣除最後一個字）
            pages.push(current.slice(0, -1));
            current = text[i];
        }
    }

    if (current.trim()) pages.push(current);

    document.body.removeChild(testBox);
    return pages;
}

// ===== 文字清理與段落化 =====
function formatText(rawText) {
    if (!rawText) return "";
    let clean = rawText.replace(/^\s+|\s+$/g, "");
    clean = clean.replace(/\n{3,}/g, "\n\n");
    return clean;
}

// --- 初始化系統 ---
function initGame() {
    if (!ui.gameScreen) return;

    ui.gameScreen.addEventListener("click", nextStep);
    setupChapterMenu();

    if (ui.logBtn) ui.logBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
        showLog();
    });

    if (ui.closeLogBtn) ui.closeLogBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.logWindow.hidden = true;
    });

    if (ui.logWindow) {
        ui.logWindow.addEventListener("click", (e) => {
            if (e.target === ui.logWindow) ui.logWindow.hidden = true;
        });
    }

    if (ui.backBtn) ui.backBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
        prevStep();
    });

    if (state.index === 0 && scenario.length > 0) {
        nextStep(); 
    } else {
        render(scenario[state.index - 1] || scenario[0]);
    }
}

// --- LOG 顯示邏輯 ---
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
        if(ui.logContent) ui.logContent.scrollTop = ui.logContent.scrollHeight; 
    }, 50);
}

// --- 核心運作邏輯 ---

function nextStep() {
    let currentStepData = null;

    // 1. 處理待顯示的隊列（分頁內容）
    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        const rawStep = scenario[state.index - 1];
        currentStepData = { ...rawStep, text: nextChunk };
    } 
    // 2. 讀取新的劇情行
    else {
        if (state.index >= scenario.length) return;

        let step = { ...scenario[state.index] };

        // 存入完整對話到歷史紀錄
        state.history.push({
            index: state.index,
            speaker: step.speaker || "",
            text: step.text || ""
        });

        state.index++;
        state.textQueue = [];

        // --- ⭐ 修改處：動態計算對話框可顯示高度 ---
        if (step.text && ui.textBox) {
            const dialogueBox = document.getElementById("dialogue-box");
            const boxStyle = getComputedStyle(dialogueBox);
            
            // 從 CSS 抓取高度並減去 padding/UI 空間
            let maxHeight = parseFloat(boxStyle.getPropertyValue("--dialogue-height")) - 90;
            
            // 安全機制：如果抓不到高度或數值異常，使用你指定的死高度 130
            if (isNaN(maxHeight) || maxHeight <= 0) {
                maxHeight = 130; 
            }

            const pages = splitTextByHeight(step.text, maxHeight);

            step.text = pages.shift();
            state.textQueue = pages;
        }

        currentStepData = step;
    }

    render(currentStepData);

    // 存入返回堆疊（深拷貝以防狀態干擾）
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });
}

function prevStep() {
    if (state.backStack.length <= 1) return;

    const currentSnapshot = state.backStack.pop(); 
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    if (currentSnapshot.index !== prevSnapshot.index) {
        state.history.pop();
    }

    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue];
    render(prevSnapshot.stepData);
}

function render(step) {
    if (!step) return;
    if (step.bg) changeBackground(step.bg);

    // 渲染名字標籤
    if (ui.namePlate) {
        if (step.speaker === "Narrator") {
            ui.namePlate.style.display = "none";
        } else {
            ui.namePlate.style.display = ""; 
            ui.namePlate.textContent = step.speaker || "";
            const charData = characters[step.speaker];
            if (charData && charData.nameColor) {
                ui.namePlate.style.backgroundColor = charData.nameColor;
                ui.namePlate.style.color = charData.textColor || "white"; 
            } else {
                ui.namePlate.style.backgroundColor = ""; 
                ui.namePlate.style.color = ""; 
            }
        }
    }

    // 渲染對話文字
    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
        ui.textBox.scrollTop = 0;
    }

    // 渲染特殊事件圖
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

function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (bgPath && ui.gameScreen) {
        ui.gameScreen.style.backgroundImage = `url('${bgPath}')`;
    }
}

function updateCharacters(step) {
    if (ui.avatarRight) ui.avatarRight.style.display = "none";
    if (ui.avatarLeft) {
        ui.avatarLeft.style.display = "none";
        ui.avatarLeft.className = "avatar left";
    }

    if (step.speaker === "Narrator") return;

    const char = characters[step.speaker];
    if (char && char.sprites) {
        const emotion = step.emotion || "normal";
        if (char.sprites[emotion] && ui.avatarLeft) {
            ui.avatarLeft.src = char.sprites[emotion];
            ui.avatarLeft.style.display = "block";
            ui.avatarLeft.classList.add("active");
        }
    }
}

function setupChapterMenu() {
    if (!ui.chapterBtn || !ui.chapterMenu) return;
    const chapters = scenario
        .map((step, index) => step.chapter ? { title: step.chapter, index } : null)
        .filter(Boolean);

    ui.chapterBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
        openChapterMenu(chapters);
    });

    ui.chapterMenu.addEventListener("click", () => { ui.chapterMenu.hidden = true; });
}

function openChapterMenu(chapters) {
    ui.chapterMenu.innerHTML = "<h2>章節選擇</h2>";
    chapters.forEach(ch => {
        const div = document.createElement("div");
        div.className = "chapter-item";
        div.textContent = ch.title;
        div.onclick = (e) => { e.stopPropagation(); jumpToChapter(ch.index); };
        ui.chapterMenu.appendChild(div);
    });
    ui.chapterMenu.hidden = false;
}

function jumpToChapter(index) {
    state.index = index;
    state.textQueue = [];
    state.backStack = [];
    state.history = state.history.filter(h => h.index < index);
    ui.chapterMenu.hidden = true;
    nextStep();
}

initGame();
