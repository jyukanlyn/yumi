/* engine/engine.js */
import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state } from "./state.js"; // 注意：移除了 backgrounds 引用，因為改用 CSS class 切換

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
    // ✨ 補回：需要這個來計算高度
    dialogueBox: document.getElementById("dialogue-box")
};

// ============================================================
// 1. 工具函數：高度分頁 (這是最核心的部分，不能省略)
// ============================================================
function cleanPageStart(text) {
    if (!text) return "";
    return text.replace(/^[\n\r]+/, "").replace(/^\s+/, "");
}

function splitTextByHeight(text, maxHeight) {
    if (!ui.textBox || ui.textBox.offsetWidth === 0) return [text];

    const testBox = document.createElement("div");
    const style = getComputedStyle(ui.textBox);
    
    // 複製樣式以進行測量
    testBox.style.position = "absolute";
    testBox.style.visibility = "hidden";
    testBox.style.width = ui.textBox.offsetWidth + "px"; 
    testBox.style.boxSizing = "border-box"; 
    testBox.style.font = style.font;
    testBox.style.fontFamily = style.fontFamily;
    testBox.style.fontSize = style.fontSize;
    testBox.style.lineHeight = style.lineHeight;
    testBox.style.letterSpacing = style.letterSpacing;
    testBox.style.padding = style.padding;
    testBox.style.whiteSpace = "pre-wrap";
    testBox.style.wordBreak = "break-all";
    
    document.body.appendChild(testBox);

    const pages = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
        current += text[i];
        testBox.textContent = current;
        if (testBox.scrollHeight > (maxHeight - 10)) { 
            const page = current.slice(0, -1);
            pages.push(cleanPageStart(page));
            current = text[i];
        }
    }
    if (current.trim()) pages.push(cleanPageStart(current));
    
    document.body.removeChild(testBox);
    return pages;
}

// ============================================================
// 2. 核心流程：下一步 (Next)
// ============================================================
function nextStep() {
    let currentStepData = null;

    // A. 讀取分頁隊列
    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        const lastSnapshot = state.backStack[state.backStack.length - 1];
        currentStepData = { ...lastSnapshot.stepData, text: nextChunk };
    } 
    // B. 讀取新的一行
    else {
        if (state.index >= scenario.length) {
            console.log("劇本結束");
            return;
        }

        let rawStep = { ...scenario[state.index] };
        
        // 發言者繼承邏輯
        let displaySpeaker = rawStep.speaker;
        if (!displaySpeaker && displaySpeaker !== "Narrator" && state.lastSpeaker) {
            displaySpeaker = state.lastSpeaker;
        } else {
            state.lastSpeaker = displaySpeaker;
        }

        let finalStep = { ...rawStep, speaker: displaySpeaker };

        // 寫入 LOG
        state.history.push({ index: state.index, speaker: finalStep.speaker || "", text: finalStep.text || "" });

        state.index++;
        state.textQueue = [];

        // 計算分頁
        if (finalStep.text && ui.textBox && ui.dialogueBox) {
            const boxStyle = getComputedStyle(ui.dialogueBox);
            const totalHeight = ui.dialogueBox.clientHeight;
            const pt = parseFloat(boxStyle.paddingTop) || 0;
            const pb = parseFloat(boxStyle.paddingBottom) || 0;
            let maxHeight = totalHeight - pt - pb - 40; // 扣除 padding 和緩衝
            
            if (maxHeight > 60) {
                const pages = splitTextByHeight(finalStep.text, maxHeight);
                finalStep.text = pages.shift();
                state.textQueue = pages;
            }
        }
        currentStepData = finalStep;
    }

    render(currentStepData);

    // 存入堆疊
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });
}

// ============================================================
// 3. 核心流程：上一步 (Prev)
// ============================================================
function prevStep() {
    if (state.backStack.length <= 1) return;

    state.backStack.pop();
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    if (state.index !== prevSnapshot.index) {
        state.history.pop();
        if (prevSnapshot.stepData.speaker) state.lastSpeaker = prevSnapshot.stepData.speaker;
    }

    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue];
    render(prevSnapshot.stepData);
}

// ============================================================
// 4. 渲染 (Render)
// ============================================================
function render(step) { 
    if (!step) return;

    // 背景 (改用您新的 switchScene 邏輯)
    if (step.bg) switchScene(step.bg);

    // 名字
    if (ui.namePlate) {
        if (!step.speaker || step.speaker === "Narrator") {
            ui.namePlate.style.visibility = "hidden";
        } else {
            ui.namePlate.style.visibility = "visible";
            ui.namePlate.textContent = step.speaker;
            // 顏色處理
            const charData = characters[step.speaker];
            ui.namePlate.style.color = (charData && charData.nameColor) ? charData.nameColor : "var(--primary-color)";
        }
    }

    // 文字
    if (ui.textBox) ui.textBox.textContent = step.text || "";

    // 事件圖
    if (ui.eventImage) {
        ui.eventImage.hidden = (step.special !== "dice");
        if (step.special === "dice") ui.eventImage.src = "assets/effect/dice.png";
    }

    // 角色立繪
    updateCharacters(step);
}

function updateCharacters(step) {
    // 隱藏右側 (單立繪模式)
    if (ui.avatarRight) { ui.avatarRight.style.display = "none"; ui.avatarRight.classList.remove("active"); }
    
    // 旁白或無人說話時隱藏左側
    if (!step.speaker || step.speaker === "Narrator") {
        if (ui.avatarLeft) { 
            ui.avatarLeft.style.display = "none"; 
            ui.avatarLeft.classList.remove("active"); 
            ui.avatarLeft.src = ""; 
        }
        return;
    }

    const char = characters[step.speaker];
    if (char && char.sprites && ui.avatarLeft) {
        const emotion = step.emotion || "normal";
        const src = char.sprites[emotion];
        
        if (src) {
            // 防止重複載入閃爍
            if (!ui.avatarLeft.src.includes(src)) {
                ui.avatarLeft.src = src;
                ui.avatarLeft.style.display = "block";
                
                // ✨ 關鍵修正：延遲添加 active class 以觸發 CSS transition
                ui.avatarLeft.classList.remove("active");
                setTimeout(() => ui.avatarLeft.classList.add("active"), 20);
            } else {
                // 圖片相同，確保顯示
                ui.avatarLeft.style.display = "block";
                ui.avatarLeft.classList.add("active");
            }
        }
    }
}

// ============================================================
// 5. 其他功能 (LOG, 選單, 特效)
// ============================================================
function showLog() {
    if (!ui.logContent) return;
    ui.logContent.innerHTML = "";
    state.history.forEach(log => {
        const entry = document.createElement("div"); 
        entry.className = "log-entry";
        const nameHtml = log.speaker && log.speaker !== "Narrator" ? `<span class="log-name">${log.speaker}</span>` : "";
        entry.innerHTML = `${nameHtml}<span class="log-text">${log.text}</span>`;
        ui.logContent.appendChild(entry);
    });
    ui.logWindow.hidden = false;
    setTimeout(() => ui.logContent.scrollTop = ui.logContent.scrollHeight, 50);
}

function setupChapterMenu() {
    if(!ui.chapterMenu) return;
    ui.chapterMenu.innerHTML = "<h2>章節選擇</h2>";
    scenario.map((s,i) => s.chapter ? {title:s.chapter, index:i} : null)
        .filter(Boolean)
        .forEach(ch => {
            const div = document.createElement("div");
            div.className = "chapter-item"; 
            div.textContent = ch.title;
            div.onclick = (e) => { e.stopPropagation(); jumpToChapter(ch.index); };
            ui.chapterMenu.appendChild(div);
        });
}

function jumpToChapter(index) { 
    state.index = index; 
    state.textQueue = []; 
    state.backStack = []; 
    state.lastSpeaker = null; 
    if(ui.chapterMenu) ui.chapterMenu.hidden = true; 
    nextStep(); 
}

function switchScene(name) {
    if(!ui.gameScreen) return;
    ui.gameScreen.classList.remove("scene1", "scene2");
    if(name) ui.gameScreen.classList.add(name);
}

document.addEventListener('click', function(e) {
    const ripple = document.createElement('div'); 
    ripple.className = 'click-ripple';
    ripple.style.left = e.clientX + 'px'; 
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);
});

// ============================================================
// 6. 初始化
// ============================================================
function initGame() {
    if(!ui.gameScreen) return;
    console.log("Engine Started: Compact & Functional");

    if(ui.chapterBtn) ui.chapterBtn.addEventListener("click", (e) => { e.stopPropagation(); setupChapterMenu(); if(ui.chapterMenu) ui.chapterMenu.hidden = false; });
    if(ui.chapterMenu) ui.chapterMenu.addEventListener("click", () => { ui.chapterMenu.hidden = true; });
    
    if(ui.gameScreen) ui.gameScreen.addEventListener("click", (e) => {
        // ✨ 補上 .menu-controls 檢查，防止按按鈕時觸發下一句
        if(e.target.tagName === "BUTTON" || 
           e.target.closest("#back-btn") || 
           e.target.closest("#chapter-menu") || 
           e.target.closest("#log-window") ||
           e.target.closest(".menu-controls")) return;
        nextStep();
    });

    if(ui.logBtn) ui.logBtn.onclick = (e) => { e.stopPropagation(); showLog(); };
    if(ui.closeLogBtn) ui.closeLogBtn.onclick = (e) => { e.stopPropagation(); ui.logWindow.hidden = true; };
    if(ui.backBtn) ui.backBtn.onclick = (e) => { e.stopPropagation(); prevStep(); };

    // 啟動
    if (state.index === 0 && scenario.length > 0) {
        if (typeof state.lastSpeaker === 'undefined') state.lastSpeaker = null;
        nextStep();
    }
}

initGame();
