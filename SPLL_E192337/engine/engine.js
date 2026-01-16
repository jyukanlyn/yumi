/* engine/engine.js */
import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state } from "./state.js";

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
    dialogueBox: document.getElementById("dialogue-box")
};

// 打字速度 (毫秒)
const TYPING_SPEED = 40;

// ============================================================
// 1. 工具函數
// ============================================================
function cleanPageStart(text) {
    if (!text) return "";
    return text.replace(/^[\n\r]+/, "").replace(/^\s+/, "");
}

// 分頁文字
function splitTextByHeight(text, maxHeight) {
    if (!ui.textBox || ui.textBox.offsetWidth === 0) return [text];

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
// 2. 打字機效果 (改善分頁)
function typeWriter(text, callback) {
    if (!ui.textBox) return;
    ui.textBox.textContent = "";
    state.isTyping = true;
    state.currentFullText = text;
    let i = 0;

    function loop() {
        if (!state.isTyping) return; // 點擊跳過
        if (i < text.length) {
            ui.textBox.textContent += text[i];
            i++;
            state.typingTimer = setTimeout(loop, TYPING_SPEED);
        } else {
            state.isTyping = false;
            if (callback) callback();
        }
    }
    loop();
}

// ============================================================
// 3. 核心流程
// ============================================================
function nextStep() {
    // 如果正在打字，直接顯示本頁完整文字
    if (state.isTyping) {
        clearTimeout(state.typingTimer);
        ui.textBox.textContent = state.currentFullText;
        state.isTyping = false;
        return;
    }

    let currentStepData = null;

    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        const lastSnapshot = state.backStack[state.backStack.length - 1];
        currentStepData = { ...lastSnapshot.stepData, text: nextChunk };
    } else {
        if (state.index >= scenario.length) return;

        let rawStep = { ...scenario[state.index] };
        let displaySpeaker = rawStep.speaker;
        if (!displaySpeaker && displaySpeaker !== "Narrator" && state.lastSpeaker) displaySpeaker = state.lastSpeaker;
        else state.lastSpeaker = displaySpeaker;

        let finalStep = { ...rawStep, speaker: displaySpeaker };

        // 存入 LOG
        state.history.push({ index: state.index, speaker: finalStep.speaker || "", text: finalStep.text || "" });

        state.index++;
        state.textQueue = [];

        // 分頁文字
        if (finalStep.text && ui.dialogueBox) {
            const boxStyle = getComputedStyle(ui.dialogueBox);
            const totalHeight = ui.dialogueBox.clientHeight;
            const pt = parseFloat(boxStyle.paddingTop) || 0;
            const pb = parseFloat(boxStyle.paddingBottom) || 0;
            let maxHeight = totalHeight - pt - pb - 40;
            if (maxHeight > 60) {
                const pages = splitTextByHeight(finalStep.text, maxHeight);
                finalStep.text = pages.shift();
                state.textQueue = pages;
            }
        }

        currentStepData = finalStep;
    }

    render(currentStepData);
    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: JSON.parse(JSON.stringify(currentStepData))
    });
}

// ============================================================
// 4. 上一步
// ============================================================
function prevStep() {
    if (state.isTyping) { clearTimeout(state.typingTimer); state.isTyping = false; }
    if (state.backStack.length <= 1) return;

    state.backStack.pop();
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    if (state.index !== prevSnapshot.index) {
        state.history.pop();
        if (prevSnapshot.stepData.speaker) state.lastSpeaker = prevSnapshot.stepData.speaker;
    }

    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue];

    render(prevSnapshot.stepData, false);
}

// ============================================================
// 5. 渲染函數
// ============================================================
function render(step, animate = true) {
    if (!step) return;

    if (step.bg) switchScene(step.bg);

    if (ui.namePlate) {
        if (!step.speaker || step.speaker === "Narrator") ui.namePlate.style.visibility = "hidden";
        else {
            ui.namePlate.style.visibility = "visible";
            ui.namePlate.textContent = step.speaker;
            const charData = characters[step.speaker];
            ui.namePlate.style.color = (charData && charData.nameColor) ? charData.nameColor : "var(--primary-color)";
        }
    }

    if (ui.textBox) {
        if (animate && step.text) typeWriter(step.text);
        else { ui.textBox.textContent = step.text || ""; state.isTyping = false; }
    }

    if (ui.eventImage) {
        ui.eventImage.hidden = (step.special !== "dice");
        if (step.special === "dice") ui.eventImage.src = "assets/effect/dice.png";
    }

    updateCharacters(step);
}

function updateCharacters(step) {
    if (ui.avatarRight) { ui.avatarRight.style.display = "none"; ui.avatarRight.classList.remove("active"); }

    if (!step.speaker || step.speaker === "Narrator") {
        if (ui.avatarLeft) { ui.avatarLeft.style.display = "none"; ui.avatarLeft.src = ""; ui.avatarLeft.classList.remove("active"); }
        return;
    }

    const char = characters[step.speaker];
    if (char && char.sprites && ui.avatarLeft) {
        const emotion = step.emotion || "normal";
        const src = char.sprites[emotion];
        if (src) {
            if (!ui.avatarLeft.src.includes(src)) {
                ui.avatarLeft.src = src;
                ui.avatarLeft.style.display = "block";
                ui.avatarLeft.classList.remove("active");
                setTimeout(() => ui.avatarLeft.classList.add("active"), 20);
            } else ui.avatarLeft.style.display = "block";
        }
    }
}

// ============================================================
// 6. LOG / 章節 / 場景
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
    if(state.isTyping) { clearTimeout(state.typingTimer); state.isTyping = false; }
    state.index = index; state.textQueue = []; state.backStack = []; state.lastSpeaker = null;
    if(ui.chapterMenu) ui.chapterMenu.hidden = true;
    nextStep();
}

function switchScene(name) {
    if(!ui.gameScreen) return;
    ui.gameScreen.classList.remove("scene1", "scene2");
    if(name) ui.gameScreen.classList.add(name);
}

// 點擊水滴特效
document.addEventListener('click', function(e){
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(()=>ripple.remove(), 800);
});

// ============================================================
// 7. 初始化
// ============================================================
function initGame() {
    if(!ui.gameScreen) return;
    console.log("Engine Started: Typewriter + Paging");

    if(ui.chapterBtn) ui.chapterBtn.addEventListener("click",(e)=>{e.stopPropagation(); setupChapterMenu(); if(ui.chapterMenu) ui.chapterMenu.hidden=false;});
    if(ui.chapterMenu) ui.chapterMenu.addEventListener("click",()=>{ui.chapterMenu.hidden=true;});

    if(ui.gameScreen) ui.gameScreen.addEventListener("click",(e)=>{
        if(e.target.tagName==="BUTTON" || e.target.closest("#back-btn") || e.target.closest("#chapter-menu") || e.target.closest("#log-window") || e.target.closest(".menu-controls")) return;
        nextStep();
    });

    if(ui.logBtn) ui.logBtn.onclick = (e)=>{e.stopPropagation(); showLog();};
    if(ui.closeLogBtn) ui.closeLogBtn.onclick = (e)=>{e.stopPropagation(); ui.logWindow.hidden=true;};
    if(ui.backBtn) ui.backBtn.onclick = (e)=>{e.stopPropagation(); prevStep();};

    if(state.index===0 && scenario.length>0){
        if(typeof state.lastSpeaker==='undefined') state.lastSpeaker=null;
        nextStep();
    }
}

initGame();
