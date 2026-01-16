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

// ============================================================
// 2. 工具函數：字串處理與分頁
// ============================================================
function cleanPageStart(text) {
    if (!text) return "";
    return text.replace(/^[\n\r]+/, "").replace(/^\s+/, "");
}

function splitTextByHeight(text, maxHeight) {
    if (!ui.textBox) return [text];
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
// 3. 核心運作：下一步 (Next Step)
// ============================================================
function nextStep() {
    let currentStepData = null;

    // --- 情況 A: 還有分頁沒看完 ---
    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        const lastSnapshot = state.backStack[state.backStack.length - 1];
        currentStepData = { 
            ...lastSnapshot.stepData,
            text: nextChunk
        };
    } 
    // --- 情況 B: 讀取新的一行劇本 ---
    else {
        if (state.index >= scenario.length) {
            console.log("劇本結束");
            return;
        }

        let rawStep = { ...scenario[state.index] };
        let displaySpeaker = rawStep.speaker;
        let isContinuation = false;

        if (!displaySpeaker && displaySpeaker !== "Narrator") {
            if (state.lastSpeaker) {
                displaySpeaker = state.lastSpeaker;
                isContinuation = true;
            }
        } else {
            state.lastSpeaker = displaySpeaker;
        }

        let finalStep = {
            ...rawStep,
            speaker: displaySpeaker,
            originalSpeaker: rawStep.speaker,
            isContinuation: isContinuation
        };

        if (state.index >= 0) {
            state.history.push({
                index: state.index,
                speaker: finalStep.speaker || "",
                text: finalStep.text || ""
            });
        }

        state.index++;
        state.textQueue = [];

        if (finalStep.text && ui.textBox) {
            const dialogueBox = document.getElementById("dialogue-box");
            const boxStyle = getComputedStyle(dialogueBox);
            let cssHeight = parseFloat(boxStyle.getPropertyValue("--dialogue-height"));
            if (isNaN(cssHeight)) cssHeight = dialogueBox.offsetHeight;
            let maxHeight = cssHeight - 100; 
            if (isNaN(maxHeight) || maxHeight <= 60) maxHeight = 100;

            const pages = splitTextByHeight(finalStep.text, maxHeight);
            finalStep.text = pages.shift();
            state.textQueue = pages;
        }

        currentStepData = finalStep;
    }

    // 執行渲染
    render(currentStepData);

    // 存入返回堆疊
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });

    // ---- 場景切換自動觸發 ----
    if (currentStepData.scene) {
        switchScene(currentStepData.scene);
    }
}

// ============================================================
// 4. 上一步 (Prev Step)
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
// 5. 渲染函數 (Render)
// ============================================================
function render(step) {
    if (!step) return;

    if (step.bg) changeBackground(step.bg);

    if (ui.namePlate) {
        if (step.speaker === "Narrator" || !step.speaker) {
            ui.namePlate.style.visibility = "hidden";
        } else {
            ui.namePlate.style.visibility = "visible";
            ui.namePlate.textContent = step.speaker;
            ui.namePlate.classList.remove("right-side");
            const charData = characters[step.speaker];
            if (charData && charData.nameColor) ui.namePlate.style.color = charData.nameColor;
            else ui.namePlate.style.color = "var(--primary-color)";
        }
    }

    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
        ui.textBox.scrollTop = 0;
    }

    if (ui.eventImage) {
        if (step.special === "dice") {
            ui.eventImage.src = "assets/effect/dice.png";
            ui.eventImage.hidden = false;
        } else ui.eventImage.hidden = true;
    }

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
    if (ui.avatarRight) {
        ui.avatarRight.style.display = "none";
        ui.avatarRight.classList.remove("active");
    }

    if (!step.speaker || step.speaker === "Narrator") {
        if (ui.avatarLeft) {
            ui.avatarLeft.style.display = "none";
            ui.avatarLeft.classList.remove("active");
            ui.avatarLeft.src = "";
        }
        return;
    }

    const char = characters[step.speaker];
    if (char && char.sprites) {
        const emotion = step.emotion || "normal";
        const targetAvatar = ui.avatarLeft;
        if (char.sprites[emotion] && targetAvatar) {
            const newSrc = char.sprites[emotion];
            if (!targetAvatar.src.endsWith(newSrc)) {
                targetAvatar.src = newSrc;
                targetAvatar.style.display = "block";
                targetAvatar.classList.remove("active");
                setTimeout(() => targetAvatar.classList.add("active"), 10);
            } else {
                targetAvatar.style.display = "block";
                if (!targetAvatar.classList.contains("active")) targetAvatar.classList.add("active");
            }
        }
    }
}

// ============================================================
// 7. LOG / 章節功能
// ============================================================
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
    setTimeout(() => { ui.logContent.scrollTop = ui.logContent.scrollHeight; }, 50);
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

    const step = scenario[index];
    if (step && step.scene) switchScene(step.scene);

    nextStep();
}

// ============================================================
// 8. 場景切換整合
// ============================================================
function switchScene(sceneName) {
    const screen = ui.gameScreen;
    if (!screen) return;

    // 移除所有已知場景 class
    screen.classList.remove("scene1", "scene2");

    if (sceneName) screen.classList.add(sceneName);

    // 可選：漣漪動畫淡入
    screen.style.transition = "background 0.6s ease, filter 0.6s ease";
}

// ============================================================
// 9. 初始化與事件監聽
// ============================================================
function initGame() {
    if (!ui.gameScreen) return;
    
    console.log("遊戲引擎啟動");

    if (ui.chapterBtn) ui.chapterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setupChapterMenu();
        if(ui.chapterMenu) ui.chapterMenu.hidden = false;
    });

    if (ui.chapterMenu) ui.chapterMenu.addEventListener("click", () => {
        ui.chapterMenu.hidden = true;
    });

    ui.gameScreen.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" || 
            e.target.closest("#back-btn") || 
            e.target.closest("#chapter-menu") || 
            e.target.closest(".menu-controls") || 
            e.target.closest("#log-window")) return;
        nextStep();
    });

    if (ui.logBtn) ui.logBtn.onclick = (e) => { e.stopPropagation(); showLog(); };
    if (ui.closeLogBtn) ui.closeLogBtn.onclick = (e) => { e.stopPropagation(); ui.logWindow.hidden = true; };
    if (ui.backBtn) ui.backBtn.onclick = (e) => { e.stopPropagation(); prevStep(); };

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
        if (typeof state.lastSpeaker === 'undefined') state.lastSpeaker = null;
        const firstStep = scenario[0];
        if (firstStep.scene) switchScene(firstStep.scene);
        nextStep(); 
    }
}

initGame();
