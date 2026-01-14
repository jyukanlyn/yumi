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

// --- 初始化系統 ---
function initGame() {
    if (!ui.gameScreen) {
        console.error("錯誤：找不到 id='game-screen' 的元素！");
        return;
    }

    console.log("引擎啟動！初始化事件...");

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

    if (ui.backBtn) ui.backBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
        prevStep();
    });

    // 初始啟動
    if (state.index === 0 && scenario.length > 0) {
        nextStep(); 
    } else {
        render(scenario[state.index - 1] || scenario[0]);
    }
}

// --- 核心運作邏輯 ---
// 一頁字數
const CHAR_LIMIT = 60; 

function nextStep() {
    let currentStepData = null;

    // 1. 【優先檢查佇列】如果這句話還沒講完 (被切斷的對話)
    if (state.textQueue && state.textQueue.length > 0) {
        // 取出下一段文字
        const nextChunk = state.textQueue.shift();
        
        // 為了顯示，我們需要構造一個臨時的 step 物件，沿用上一句的屬性(名字、表情等)
        // 我們去抓 scenario 裡「目前正在讀的那一句」
        // 注意：因為讀到新句時 index 已經 +1 了，所以這裡是 index - 1
        const rawStep = scenario[state.index - 1];
        
        currentStepData = {
            ...rawStep,
            text: nextChunk // 替換成切分後的文字
        };

        console.log("顯示剩餘文字:", nextChunk);
    } 
    // 2. 【讀取新的一句】佇列空了，讀劇本的下一行
    else {
        if (state.index >= scenario.length) {
            console.log("劇本已結束");
            return;
        }

        // 取得原始劇本資料
        let step = { ...scenario[state.index] };
        
        // --- 💾 存入 LOG (只有在讀新的一整句時才存) ---
        if (state.index >= 0) {
             state.history.push({
                index: state.index, // 記錄這是第幾句
                speaker: step.speaker || "",
                text: step.text || "" // 記錄完整文字
            });
        }

        // 索引 +1 (指向下一句)
        state.index++;
        state.textQueue = []; // 清空舊佇列

        // --- ✨ 聰明切割邏輯 ---
        if (step.text && step.text.length > CHAR_LIMIT) {
            const fullText = step.text;
            const chunks = [];
            let remaining = fullText;

            while (remaining.length > 0) {
                if (remaining.length <= CHAR_LIMIT) {
                    chunks.push(remaining);
                    break;
                }
                let chunkAttempt = remaining.substring(0, CHAR_LIMIT);
                const punctuation = ["。", "！", "？", "\n", "……", "⋯⋯", "」"];
                let bestSplitIndex = -1;
                for (let p of punctuation) {
                    const idx = chunkAttempt.lastIndexOf(p);
                    if (idx > bestSplitIndex) bestSplitIndex = idx;
                }
                let finalCutIndex = (bestSplitIndex !== -1) ? bestSplitIndex + 1 : CHAR_LIMIT;

                chunks.push(remaining.substring(0, finalCutIndex));
                remaining = remaining.substring(finalCutIndex);
            }

            // 第一段馬上顯示，剩下的放進佇列
            step.text = chunks.shift(); 
            state.textQueue = chunks;   
            console.log(`文字太長，已切割，剩餘段數: ${chunks.length}`);
        }

        currentStepData = step;
    }

    // 3. 執行渲染
    render(currentStepData);

    // 4. ✨【關鍵修改】將這個畫面「存檔」到 backStack
    // 我們存下：目前的 index、目前的佇列狀態、目前顯示的這包資料
    state.backStack.push({
        index: state.index,
        // 這裡必須用 [...array] 拷貝一份，不然會被後面的操作影響
        textQueue: [...state.textQueue], 
        stepData: currentStepData
    });
}

// ✨ 精準上一頁功能 (時光倒流)
function prevStep() {
    // 如果堆疊裡只有 1 個或更少，代表在第一頁，不能再退了
    if (state.backStack.length <= 1) return; 

    // 1. 移除當前頁面 (Pop Current)
    const currentSnapshot = state.backStack.pop();

    // 2. 偷看前一個頁面 (Peek Previous)
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    // 3. 恢復引擎狀態
    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue]; // 恢復當時的佇列

    // 4. 處理 LOG (如果退回的是「上一整句」，才刪除 Log)
    // 判斷方式：如果 index 變了，代表跨越了句子
    if (currentSnapshot.index !== prevSnapshot.index) {
        state.history.pop();
    }

    // 5. 重新渲染前一頁的內容
    console.log("返回上一頁:", prevSnapshot.stepData);
    render(prevSnapshot.stepData);
}

function render(step) {
    if (!step) return;

    if (step.bg) changeBackground(step.bg);

    const speakerName = step.speaker || "";
    
    if (ui.namePlate) {
        if (step.speaker === "Narrator") {
            ui.namePlate.style.display = "none";
        } else {
            ui.namePlate.style.display = ""; 
            ui.namePlate.textContent = speakerName;
            ui.namePlate.setAttribute("data-name", speakerName); 
            ui.namePlate.classList.remove("right-side"); 

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

    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
    }

    if (ui.eventImage) {
        if (step.special === "dice") {
            ui.eventImage.src = "assets/effect/dice.png";
            ui.eventImage.hidden = false; 
        } else {
            ui.eventImage.hidden = true;
            ui.eventImage.src = ""; 
        }
    }

    updateCharacters(step);
}
function showLog() {
    if (!ui.logContent) return;
    ui.logContent.innerHTML = ""; 

    state.history.forEach(log => {
        if (!log.text) return;
        
        const entry = document.createElement("div");
        entry.className = "log-entry";
        
        // 判斷是否為旁白 (Narrator)
        const isNarrator = !log.speaker || log.speaker === "Narrator";
        
        let htmlContent = "";
        if (!isNarrator) {
            htmlContent += `<span class="log-name">${log.speaker}</span>`;
        }
        
        htmlContent += `<span class="log-text">${log.text}</span>`;
        
        entry.innerHTML = htmlContent;
        ui.logContent.appendChild(entry);
    });

    ui.logWindow.hidden = false;
    
    // 確保捲動到最底部
    setTimeout(() => {
        ui.logContent.scrollTop = ui.logContent.scrollHeight;
    }, 50);
}

function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (bgPath) {
        ui.gameScreen.style.backgroundImage = `url('${bgPath}')`;
        ui.gameScreen.style.backgroundSize = "cover";     
        ui.gameScreen.style.backgroundPosition = "center"; 
    }
}

function updateCharacters(step) {
    // 隱藏右邊
    if (ui.avatarRight) {
        ui.avatarRight.style.display = "none";
        ui.avatarRight.classList.remove("active");
    }

    // 重置左邊
    if (ui.avatarLeft) {
        ui.avatarLeft.src = "";
        ui.avatarLeft.style.display = "none";
        ui.avatarLeft.classList.remove("active");
        ui.avatarLeft.className = "avatar left"; 
    }

    if (step.speaker === "Narrator") return;

    const char = characters[step.speaker];
    if (!char || !char.sprites) return;

    const emotion = step.emotion || "normal";
    if (char.sprites[emotion] && ui.avatarLeft) {
        ui.avatarLeft.src = char.sprites[emotion];
        ui.avatarLeft.style.display = "block";
        ui.avatarLeft.classList.add("active");
        ui.avatarLeft.classList.remove("inactive");
    }
}

// 輔助函式：章節選單
function setupChapterMenu() {
    if (!ui.chapterBtn || !ui.chapterMenu) return;
    const chapters = scenario
        .map((step, index) => step.chapter ? { title: step.chapter, index } : null)
        .filter(Boolean);

    ui.chapterBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
        openChapterMenu(chapters);
    });

    ui.chapterMenu.addEventListener("click", () => {
        ui.chapterMenu.hidden = true;
    });
}

function openChapterMenu(chapters) {
    ui.chapterMenu.innerHTML = "<h2>章節選擇</h2>";
    chapters.forEach(ch => {
        const div = document.createElement("div");
        div.className = "chapter-item";
        div.textContent = ch.title;
        div.style.cursor = "pointer"; 
        div.style.padding = "10px";   
        div.onclick = (e) => {
            e.stopPropagation();
            jumpToChapter(ch.index);
        };
        ui.chapterMenu.appendChild(div);
    });
    ui.chapterMenu.hidden = false;
}

function jumpToChapter(index) {
    state.index = index;
    state.textQueue = [];
    state.backStack = []; // 跳章節時清空返回堆疊，避免邏輯混亂
    ui.chapterMenu.hidden = true;
    nextStep();
}
// 範例：將對話加入 LOG 視窗
function addLogEntry(name, text) {
    const logContent = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // 判斷是否有名字（旁白可能沒有名字）
    const nameHtml = name ? `<span class="log-name">${name}</span>` : '';
    
    entry.innerHTML = `
        ${nameHtml}
        <span class="log-text">${text}</span>
    `;
    
    logContent.appendChild(entry);
}

console.log("引擎啟動！");
initGame();
