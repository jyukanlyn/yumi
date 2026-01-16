/* engine/engine.js */
import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

// ============================================================
// 1. UI 元素快取 (DOM Cache)
// ============================================================
const ui = {
    namePlate: document.getElementById("name-plate"),
    textBox: document.getElementById("dialogue-text"),
    avatarLeft: document.getElementById("avatar-left"),
    avatarRight: document.getElementById("avatar-right"), // 預留，雖然目前強制隱藏
    gameScreen: document.getElementById("game-screen"),
    chapterBtn: document.getElementById("chapter-btn"), // HTML記得要對應加這個ID或class
    chapterMenu: document.getElementById("chapter-menu"), // 這是隱藏的選單
    logBtn: document.getElementById("log-btn"), // CSS中的 .drop-btn (LOG)
    logWindow: document.getElementById("log-window"),
    logContent: document.getElementById("log-content"),
    closeLogBtn: document.getElementById("close-log-btn"),
    backBtn: document.getElementById("back-btn"),
    eventImage: document.getElementById("event-image"), 
};

// ============================================================
// 2. 工具函數：字串處理與分頁
// ============================================================

// 清理分頁後的頁首空行
function cleanPageStart(text) {
    if (!text) return "";
    return text
        .replace(/^[\n\r]+/, "")  // 移除頁首所有換行
        .replace(/^\s+/, "");     // 移除頁首空白
}

// 高度分頁計算 (核心演算法)
function splitTextByHeight(text, maxHeight) {
    if (!ui.textBox) return [text];

    // 建立一個隱形的測試容器來測量高度
    const testBox = document.createElement("div");
    const style = getComputedStyle(ui.textBox);
    
    testBox.style.position = "absolute";
    testBox.style.visibility = "hidden";
    
    // 複製真實對話框的寬度與 Box Model
    testBox.style.width = ui.textBox.offsetWidth + "px"; 
    testBox.style.boxSizing = "border-box"; 
    
    // 複製字體樣式
    testBox.style.font = style.font;
    testBox.style.fontFamily = style.fontFamily;
    testBox.style.fontSize = style.fontSize;
    testBox.style.lineHeight = style.lineHeight;
    testBox.style.letterSpacing = style.letterSpacing;
    
    // 複製 Padding
    testBox.style.paddingTop = style.paddingTop;
    testBox.style.paddingBottom = style.paddingBottom;
    testBox.style.paddingLeft = style.paddingLeft;
    testBox.style.paddingRight = style.paddingRight;

    testBox.style.whiteSpace = "pre-wrap";
    testBox.style.wordBreak = "break-all";
    
    document.body.appendChild(testBox);

    const pages = [];
    let current = "";

    // 逐字堆疊測試高度
    for (let i = 0; i < text.length; i++) {
        current += text[i];
        testBox.textContent = current;

        // 如果高度超過限制 (預留 10px 緩衝)
        if (testBox.scrollHeight > (maxHeight - 10)) { 
            const page = current.slice(0, -1); // 退回一個字
            pages.push(cleanPageStart(page));
            current = text[i]; // 那個字變成下一頁的開頭
        }
    }

    if (current.trim()) {
        pages.push(cleanPageStart(current));
    }
    
    document.body.removeChild(testBox);
    return pages;
}

// ============================================================
// 3. 核心運作：下一步 (Next Step)
// ============================================================

function nextStep() {
    let currentStepData = null;

    // --- 情況 A: 還有分頁沒看完 ---
    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        
        // 取出當前正在進行的劇本行 (state.index 已經指到下一行了，所以要 -1)
        // 注意：這裡我們要拿 BackStack 最後一筆的 "完整資料" 來繼承 speaker
        const lastSnapshot = state.backStack[state.backStack.length - 1];
        
        currentStepData = { 
            ...lastSnapshot.stepData, // 繼承原本的 speaker, bg, emotion
            text: nextChunk           // 只換文字
        };
    } 
    // --- 情況 B: 讀取新的一行劇本 ---
    else {
        if (state.index >= scenario.length) {
            console.log("劇本結束");
            return;
        }

        // 複製原始資料
        let rawStep = { ...scenario[state.index] };

        // [關鍵修改] 處理發言者繼承邏輯
        // 如果 rawStep.speaker 是空字串，就沿用 state.lastSpeaker
        let displaySpeaker = rawStep.speaker;
        let isContinuation = false;

        if (!displaySpeaker && displaySpeaker !== "Narrator") {
            // 如果是空的，且前記憶裡有人，就沿用
            if (state.lastSpeaker) {
                displaySpeaker = state.lastSpeaker;
                isContinuation = true;
            }
        } else {
            // 如果這行有人講話，更新記憶
            state.lastSpeaker = displaySpeaker;
        }

        // 建立要渲染的最終資料物件
        let finalStep = {
            ...rawStep,
            speaker: displaySpeaker,       // 補上名字 (為了顯示頭像)
            originalSpeaker: rawStep.speaker, // 保留原始設定 (如果需要判斷是否真的有人講話)
            isContinuation: isContinuation // 標記：這是延續發言
        };

        // 存入 LOG 歷史 (存完整文字)
        if (state.index >= 0) {
            state.history.push({
                index: state.index,
                speaker: finalStep.speaker || "",
                text: finalStep.text || ""
            });
        }

        state.index++;
        state.textQueue = []; // 清空分頁佇列

        // --- 處理長文分頁 ---
        if (finalStep.text && ui.textBox) {
            const dialogueBox = document.getElementById("dialogue-box");
            const boxStyle = getComputedStyle(dialogueBox);
            
            // 取得 CSS 設定的高度
            let cssHeight = parseFloat(boxStyle.getPropertyValue("--dialogue-height"));
            if (isNaN(cssHeight)) cssHeight = dialogueBox.offsetHeight;

            // 計算文字可用高度 (扣除 padding 與 nameplate 空間)
            let maxHeight = cssHeight - 100; 
            if (isNaN(maxHeight) || maxHeight <= 60) maxHeight = 100;

            const pages = splitTextByHeight(finalStep.text, maxHeight);
            
            finalStep.text = pages.shift(); // 設定為第一頁內容
            state.textQueue = pages;        // 剩下的存入佇列
        }

        currentStepData = finalStep;
    }

    // 執行渲染
    render(currentStepData);

    // 存入返回堆疊 (用於 Prev 按鈕)
    // 我們存入的是 "處理過" (Resolved) 的資料，所以 Back 時頭像也會正確
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });
}

// ============================================================
// 4. 上一步 (Prev Step)
// ============================================================

function prevStep() {
    if (state.backStack.length <= 1) return;

    state.backStack.pop(); // 彈出當前狀態
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    // 如果退回的是新的劇情行 (index 變了)，同步清理 LOG
    if (state.index !== prevSnapshot.index) {
        state.history.pop();
        
        // [重要] 退回時，也要把 "最後發言者記憶" 倒退回那一頁的狀態
        // 因為我們在 nextStep 存 snapshot 時已經把 speaker 寫死了，
        // 所以直接讀取 snapshot 的 speaker 寫回 state.lastSpeaker 即可
        if (prevSnapshot.stepData.speaker) {
            state.lastSpeaker = prevSnapshot.stepData.speaker;
        }
    }

    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue];
    
    render(prevSnapshot.stepData);
}

// ============================================================
// 5. 渲染函數 (Render)
// ============================================================

function render(step) {
    if (!step) return;

    // 1. 背景切換
    if (step.bg) changeBackground(step.bg);

    // 2. 名字標籤渲染
    if (ui.namePlate) {
        if (step.speaker === "Narrator" || !step.speaker) {
            ui.namePlate.style.visibility = "hidden";
        } else {
            ui.namePlate.style.visibility = "visible";
            ui.namePlate.textContent = step.speaker;
            ui.namePlate.classList.remove("right-side");
            
            // 顏色處理
            const charData = characters[step.speaker];
            if (charData && charData.nameColor) {
                ui.namePlate.style.color = charData.nameColor;
            } else {
                ui.namePlate.style.color = "var(--primary-color)"; // 改用 CSS 變數比較漂亮
            }
        }
    }

    // 3. 文字內容渲染
    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
        ui.textBox.scrollTop = 0;
    }

    // 4. 特殊事件圖 (如 Dice)
    if (ui.eventImage) {
        if (step.special === "dice") {
            ui.eventImage.src = "assets/effect/dice.png";
            ui.eventImage.hidden = false;
        } else {
            ui.eventImage.hidden = true;
        }
    }

    // 5. 角色立繪更新
    updateCharacters(step);
}

// ============================================================
// 6. 輔助功能模組
// ============================================================

function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (bgPath && ui.gameScreen) {
        ui.gameScreen.style.backgroundImage = `url('${bgPath}')`;
    }
}

function updateCharacters(step) {
    // 強制隱藏右側 (單立繪模式)
    if (ui.avatarRight) {
        ui.avatarRight.style.display = "none";
        ui.avatarRight.classList.remove("active");
    }

    // 重置左側
    if (ui.avatarLeft) {
        // 先移除 active class 來重置動畫狀態
    }

    if (step.speaker === "Narrator" || !step.speaker) {
        // 如果是旁白，隱藏立繪
        if (ui.avatarLeft) {
            ui.avatarLeft.style.display = "none";
            ui.avatarLeft.classList.remove("active");
            ui.avatarLeft.src = "";
        }
        return;
    }

    // 顯示立繪
    const char = characters[step.speaker];
    if (char && char.sprites) {
        const emotion = step.emotion || "normal";
        const targetAvatar = ui.avatarLeft;

        if (char.sprites[emotion] && targetAvatar) {
            // 檢查是否需要更新圖片 (避免重複加載閃爍)
            const newSrc = char.sprites[emotion];
            // 這裡假設路徑是相對的，用 endsWith 簡單判斷
            if (!targetAvatar.src.endsWith(newSrc)) {
                targetAvatar.src = newSrc;
                targetAvatar.style.display = "block";
                
                // 重啟淡入動畫
                targetAvatar.classList.remove("active");
                setTimeout(() => targetAvatar.classList.add("active"), 10);
            } else {
                // 如果圖片一樣，確保它是顯示的
                 targetAvatar.style.display = "block";
                 if (!targetAvatar.classList.contains("active")) {
                     targetAvatar.classList.add("active");
                 }
            }
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
    state.backStack = [];
    state.lastSpeaker = null; // 跳章節時重置發言者記憶
    if(ui.chapterMenu) ui.chapterMenu.hidden = true;
    nextStep();
}

// ============================================================
// 7. 切換場景1/2
// ============================================================


function setSceneTheme(name) {
    document.body.classList.remove("scene2");
    if (name) document.body.classList.add(name);
}



// ============================================================
//8. 初始化與事件監聽
// ============================================================

function initGame() {
    if (!ui.gameScreen) return;
    
    console.log("引擎啟動：含發言者繼承邏輯");

    // 章節選單
    if (ui.chapterBtn) ui.chapterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setupChapterMenu();
        if(ui.chapterMenu) ui.chapterMenu.hidden = false;
    });

    if (ui.chapterMenu) ui.chapterMenu.addEventListener("click", () => {
        ui.chapterMenu.hidden = true;
    });

    // 點擊畫面 (下一步)
    ui.gameScreen.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" || 
            e.target.closest("#back-btn") || 
            e.target.closest("#chapter-menu") || 
            e.target.closest(".menu-controls") || /* 新增：避免點擊到右上角按鈕觸發下一步 */
            e.target.closest("#log-window")) return;
        nextStep();
    });

    // UI 按鈕
    // 這裡我們需要根據 HTML 中的 class 來綁定，假設你的 LOG 按鈕有一個特定的 ID 或 Class
    // 如果你在 HTML 裡是用 onclick="showLog()"，這裡可以省略。
    // 但為了保險，我們保留 ID 綁定
    if (ui.logBtn) ui.logBtn.onclick = (e) => { e.stopPropagation(); showLog(); };
    if (ui.closeLogBtn) ui.closeLogBtn.onclick = (e) => { e.stopPropagation(); ui.logWindow.hidden = true; };
    if (ui.backBtn) ui.backBtn.onclick = (e) => { e.stopPropagation(); prevStep(); };

    // 點擊特效 (水滴) - 這裡保留一份即可
    document.addEventListener('click', function(e) {
        const ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        ripple.style.left = e.clientX + 'px';
        ripple.style.top = e.clientY + 'px';
        document.body.appendChild(ripple);
        setTimeout(() => { ripple.remove(); }, 800);
    });

    // 啟動第一步
    if (state.index === 0 && scenario.length > 0) {
        // 在這之前確保 state 有 lastSpeaker 屬性
        if (typeof state.lastSpeaker === 'undefined') state.lastSpeaker = null;
        nextStep(); 
    }
} // <--- 補上了這個括號

initGame();