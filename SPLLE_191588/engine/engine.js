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
    // ✨ 新增：對話框容器，用於計算高度
    dialogueBox: document.getElementById("dialogue-box"), 
};

// ===== 分頁後清理頁首空行工具 =====
function cleanPageStart(text) {
    if (!text) return "";
    return text.replace(/^[\n\r]+/, "").replace(/^\s+/, "");
}

/* ============================================================
   🛠 工具函數：高度分頁處理
============================================================ */
function splitTextByHeight(text, maxHeight) {
    if (!ui.textBox) return [text];

    // ✨ 安全檢查：如果寬度異常，直接回傳原字串，避免當機
    if (ui.textBox.offsetWidth === 0) return [text];

    const testBox = document.createElement("div");
    const style = getComputedStyle(ui.textBox);
    
    testBox.style.position = "absolute";
    testBox.style.visibility = "hidden";
    testBox.style.width = ui.textBox.offsetWidth + "px"; 
    testBox.style.boxSizing = "border-box"; 
    
    testBox.style.font = style.font;
    testBox.style.fontFamily = style.fontFamily;
    testBox.style.fontSize = style.fontSize;
    testBox.style.lineHeight = style.lineHeight;
    testBox.style.letterSpacing = style.letterSpacing;
    testBox.style.padding = style.padding; // ✨ 直接複製 padding shorthand 比較快
    testBox.style.whiteSpace = "pre-wrap";
    testBox.style.wordBreak = "break-all";
    
    document.body.appendChild(testBox);

    const pages = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
        current += text[i];
        testBox.textContent = current;

        // ✨ 緩衝空間邏輯維持你的 -10，這很好
        if (testBox.scrollHeight > (maxHeight - 10)) { 
            // 如果只有一個字就超高（字體過大），強制切分以免死循環
            if (current.length === 1) {
                 pages.push(current);
                 current = "";
            } else {
                const page = current.slice(0, -1);
                pages.push(cleanPageStart(page));
                current = text[i];
            }
        }
    }

    if (current.trim()) {
        pages.push(cleanPageStart(current));
    }
    
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
        // ✨ 這裡要特別小心：如果 textQueue 是上一句殘留的，要確認 index 是否正確
        // 你的邏輯是用 scenario[state.index - 1] 抓取「正在播放的這一句」，這是正確的
        const rawStep = scenario[state.index - 1]; 
        currentStepData = { ...rawStep, text: nextChunk };
    } 
    // 2. 讀取新劇情行
    else {
        if (state.index >= scenario.length) {
            console.log("劇本結束");
            return;
        }

        let step = { ...scenario[state.index] };

        // 存入 LOG 歷史
        if (state.index >= 0) {
            state.history.push({
                index: state.index,
                speaker: step.speaker || "",
                text: step.text || ""
            });
        }

        state.index++;
        state.textQueue = [];

        // 計算對話框可用高度並分頁
        if (step.text && ui.textBox && ui.dialogueBox) {
            // ✨ 優化高度計算：不依賴 CSS 變數，改用實際高度扣除 padding
            const boxStyle = getComputedStyle(ui.dialogueBox);
            const totalHeight = ui.dialogueBox.clientHeight; // clientHeight 包含 padding 但不含 border
            const paddingTop = parseFloat(boxStyle.paddingTop) || 0;
            const paddingBottom = parseFloat(boxStyle.paddingBottom) || 0;
            
            // ✨ 自動計算可用內容高度，這裡假設文字框佔滿了 dialogue-box 的剩餘空間
            // 如果你的名字框(name-plate)也在 dialogue-box 內，需要再扣除名字框高度
            // 這裡保留你的 -100 做為安全緩衝，但建議檢查 CSS 結構
            let maxHeight = totalHeight - paddingTop - paddingBottom - 40; 
            
            if (isNaN(maxHeight) || maxHeight <= 60) maxHeight = 100;

            const pages = splitTextByHeight(step.text, maxHeight);
            step.text = pages.shift(); 
            state.textQueue = pages;
        }

        currentStepData = step;
    }

    render(currentStepData);

    // 存入返回堆疊
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue], // 複製陣列防止傳參考問題
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });
}

function prevStep() {
    if (state.backStack.length <= 1) return;

    state.backStack.pop(); // 彈出當前狀態
    const prevSnapshot = state.backStack[state.backStack.length - 1]; // 讀取上一個狀態

    // 如果退回的是新的劇情行（index 變小），同步清理歷史記錄
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

    // 名字標籤渲染
    if (ui.namePlate) {
        if (step.speaker === "Narrator" || !step.speaker) {
            ui.namePlate.style.visibility = "hidden";
        } else {
            ui.namePlate.style.visibility = "visible";
            ui.namePlate.textContent = step.speaker;
            
            // ✨ 移除 right-side 樣式，統一顯示在左側
            ui.namePlate.className = "name-plate"; 
            
            const charData = characters[step.speaker];
            if (charData && charData.nameColor) {
                ui.namePlate.style.color = charData.nameColor;
            } else {
                ui.namePlate.style.color = "var(--champagne-gold, #F0E68C)";
            }
        }
    }

    // 文字渲染
    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
        ui.textBox.scrollTop = 0; 
    }

    // 事件圖
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
   功能模組
============================================================ */
function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (bgPath && ui.gameScreen) {
        ui.gameScreen.style.backgroundImage = `url('${bgPath}')`;
    }
}

function updateCharacters(step) {
    // 隱藏右側
    if (ui.avatarRight) {
        ui.avatarRight.style.display = "none";
        ui.avatarRight.classList.remove("active");
    }

    // 重置左側
    if (ui.avatarLeft) {
        ui.avatarLeft.style.display = "none";
        ui.avatarLeft.classList.remove("active");
        ui.avatarLeft.src = "";
    }

    if (step.speaker === "Narrator") return;

    const char = characters[step.speaker];
    if (char && char.sprites) {
        const emotion = step.emotion || "normal";
        // ✨ 加上 ?. 保護，防止 sprites 物件不存在時報錯
        if (char.sprites?.[emotion] && ui.avatarLeft) {
            ui.avatarLeft.src = char.sprites[emotion];
            ui.avatarLeft.style.display = "block";
            setTimeout(() => ui.avatarLeft.classList.add("active"), 10);
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

// 章節選單邏輯
function setupChapterMenu() {
    if (!ui.chapterMenu) return;
    ui.chapterMenu.innerHTML = "<h2>章節選擇</h2>";
    
    const chapters = scenario
        .map((step, index) => step.chapter ? { title: step.chapter, index } : null)
        .filter(Boolean);

    chapters.forEach(ch => {
        const div = document.createElement("div");
        div.className = "chapter-item";
        div.textContent = ch.title;
        div.onclick = (e) => { 
            e.stopPropagation(); 
            jumpToChapter(ch.index); 
        };
        ui.chapterMenu.appendChild(div);
    });
}

function jumpToChapter(index) {
    state.index = index;
    state.textQueue = [];
    state.backStack = []; // 跳轉章節通常會清空「上一步」的歷史
    state.history = [];   // ✨ 選項：通常跳轉章節也會清空對話紀錄，看你需求
    if(ui.chapterMenu) ui.chapterMenu.hidden = true;
    nextStep();
}

/* ============================================================
   🚀 初始化
============================================================ */
function initGame() {
    if (!ui.gameScreen) return;
    
    console.log("引擎啟動：高度分頁模式");

    if (ui.chapterBtn) ui.chapterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setupChapterMenu(); 
        if(ui.chapterMenu) ui.chapterMenu.hidden = false;
    });

    if (ui.chapterMenu) ui.chapterMenu.addEventListener("click", () => {
        ui.chapterMenu.hidden = true;
    });

    ui.gameScreen.addEventListener("click", (e) => {
        // ✨ 改進：使用 closest 檢查是否點擊到 UI 元素，避免誤觸
        if (e.target.tagName === "BUTTON" || 
            e.target.closest(".ui-layer") || // 假設按鈕都在 .ui-layer 內
            e.target.closest("#chapter-menu") || 
            e.target.closest("#log-window")) return;
        nextStep();
    });

    if (ui.logBtn) ui.logBtn.onclick = (e) => { e.stopPropagation(); showLog(); };
    if (ui.closeLogBtn) ui.closeLogBtn.onclick = (e) => { e.stopPropagation(); ui.logWindow.hidden = true; };
    if (ui.backBtn) ui.backBtn.onclick = (e) => { e.stopPropagation(); prevStep(); };

    // 初始化第一步
    if (state.index === 0 && scenario.length > 0) {
        nextStep(); 
    }
}

// ✨ 這裡不要有 }); 
initGame();