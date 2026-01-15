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
// ===== 分頁後清理頁首空行工具 =====
function cleanPageStart(text) {
    if (!text) return "";
    return text
        .replace(/^[\n\r]+/, "")  // 移除頁首所有換行
        .replace(/^\s+/, "");     // 移除頁首空白
}


/* ============================================================
   🛠 工具函數：高度分頁處理
============================================================ */
/* engine/engine.js */

function splitTextByHeight(text, maxHeight) {
    if (!ui.textBox) return [text];

    const testBox = document.createElement("div");
    const style = getComputedStyle(ui.textBox);
    
    testBox.style.position = "absolute";
    testBox.style.visibility = "hidden";
    
    // ✨✨✨ 關鍵修改 1：確保寬度完全一致 ✨✨✨
    // 我們直接複製 offsetWidth (包含 border + padding + content)
    // 然後強制設定 box-sizing 為 border-box，這樣寬度計算才不會錯
    testBox.style.width = ui.textBox.offsetWidth + "px"; 
    testBox.style.boxSizing = "border-box"; 
    
    // 複製關鍵字體樣式
    testBox.style.font = style.font;
    testBox.style.fontFamily = style.fontFamily; // 保險起見多加這行
    testBox.style.fontSize = style.fontSize;
    testBox.style.lineHeight = style.lineHeight;
    testBox.style.letterSpacing = style.letterSpacing;
    
    // ✨✨✨ 關鍵修改 2：複製 padding ✨✨✨
    testBox.style.paddingTop = style.paddingTop;
    testBox.style.paddingBottom = style.paddingBottom;
    testBox.style.paddingLeft = style.paddingLeft;
    testBox.style.paddingRight = style.paddingRight;

    testBox.style.whiteSpace = "pre-wrap";
    testBox.style.wordBreak = "break-all";
    
    document.body.appendChild(testBox);

    const pages = [];
    let current = "";

    for (let i = 0; i < text.length; i++) {
        current += text[i];
        testBox.textContent = current;

        // ✨✨✨ 關鍵修改 3：預留一點緩衝空間 (-10px) ✨✨✨
        // 讓測量稍微保守一點，寧願早一點換頁，也不要被切掉
        if (testBox.scrollHeight > (maxHeight - 10)) { 
            const page = current.slice(0, -1);
            pages.push(cleanPageStart(page));
            current = text[i];
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
        const rawStep = scenario[state.index - 1]; // 獲取當前劇情的原始資料
        currentStepData = { ...rawStep, text: nextChunk };
    } 
    // 2. 讀取新劇情行
    else {
        if (state.index >= scenario.length) {
            console.log("劇本結束");
            return;
        }

        let step = { ...scenario[state.index] };

        // 存入 LOG 歷史（存完整原始文字）
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
        if (step.text && ui.textBox) {
            const dialogueBox = document.getElementById("dialogue-box");
            const boxStyle = getComputedStyle(dialogueBox);
            
            // 嘗試抓取 CSS 變數，如果抓不到就用 offsetHeight
            let cssHeight = parseFloat(boxStyle.getPropertyValue("--dialogue-height"));
            if (isNaN(cssHeight)) {
                cssHeight = dialogueBox.offsetHeight;
            }

            // 扣除 UI 空間（名字與上下留白）
            // 建議根據您的 padding 設定調整這裡的 130
            let maxHeight = cssHeight - 100; 
            
            if (isNaN(maxHeight) || maxHeight <= 60) maxHeight = 100; // 備用安全高度

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
            ui.namePlate.classList.remove("right-side"); // 強制左側
            
            const charData = characters[step.speaker];
            // 如果有自定義角色顏色則套用
            if (charData && charData.nameColor) {
                ui.namePlate.style.color = charData.nameColor;
            } else {
                // 預設顏色 (防止變數不存在變成黑色)
                ui.namePlate.style.color = "var(--champagne-gold, #F0E68C)";
            }
        }
    }

    // 文字渲染
    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
        ui.textBox.scrollTop = 0; // 換頁時捲動回頂部
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
    // 強制隱藏右側 (配合您的單立繪需求)
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
    
    console.log("引擎啟動：高度分頁模式");

    // 綁定選單按鈕
    if (ui.chapterBtn) ui.chapterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setupChapterMenu(); // 確保每次點擊都重新生成（如果需要）
        if(ui.chapterMenu) ui.chapterMenu.hidden = false;
    });

    if (ui.chapterMenu) ui.chapterMenu.addEventListener("click", () => {
        ui.chapterMenu.hidden = true;
    });

    // 點擊全螢幕前進
    ui.gameScreen.addEventListener("click", (e) => {
        // 排除掉按鈕點擊，避免前進兩次
        if (e.target.tagName === "BUTTON" || e.target.closest("#back-btn") || e.target.closest("#chapter-menu") || e.target.closest("#log-window")) return;
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

// 補上章節選單邏輯
function setupChapterMenu() {
    if (!ui.chapterMenu) return;
    ui.chapterMenu.innerHTML = "<h2>章節選擇</h2>";
    
    // 找出有 chapter 屬性的段落
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
    state.backStack = [];
    if(ui.chapterMenu) ui.chapterMenu.hidden = true;
    nextStep();
}

// 全域點擊水滴特效
document.addEventListener('click', function(e) {
    // 創建水滴元素
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    
    // 設定位置
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    
    // 加入畫面
    document.body.appendChild(ripple);
    
    // 動畫結束後移除元素 (0.8s 與 CSS 動畫時間一致)
    setTimeout(() => {
        ripple.remove();
    }, 800);
});

initGame();
