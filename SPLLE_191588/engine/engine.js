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

// ===== 文字清理與段落化 =====
function formatText(rawText) {
    if (!rawText) return "";
    // 去掉開頭結尾空格或換行
    let clean = rawText.replace(/^\s+|\s+$/g, "");
    // 將多個換行縮成最多兩個
    clean = clean.replace(/\n{3,}/g, "\n\n");
    // 轉成段落 <p>
    const paragraphs = clean.split(/\n+/).map(p => `<p>${p}</p>`);
    return paragraphs.join("");
}

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
        ui.logWindow.hidden = false;
    });

    if (ui.closeLogBtn) ui.closeLogBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        ui.logWindow.hidden = true;
    });

    // 點擊 LOG 外側區域也可關閉
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

// --- 核心運作邏輯 ---
const CHAR_LIMIT = 60;

function nextStep() {
    let currentStepData = null;

    if (state.textQueue && state.textQueue.length > 0) {
        const nextChunk = state.textQueue.shift();
        const rawStep = scenario[state.index - 1];
        currentStepData = { ...rawStep, text: nextChunk };
    } else {
        if (state.index >= scenario.length) return;

        let step = { ...scenario[state.index] };

        if (state.index >= 0) {
            state.history.push({
                index: state.index,
                speaker: step.speaker || "",
                text: step.text || ""
            });
        }

        state.index++;
        state.textQueue = [];

        if (step.text && step.text.length > CHAR_LIMIT) {
            const chunks = [];
            let remaining = step.text;

            while (remaining.length > 0) {
                if (remaining.length <= CHAR_LIMIT) {
                    chunks.push(remaining);
                    break;
                }
                let chunkAttempt = remaining.substring(0, CHAR_LIMIT);
                const punctuation = ["。","！","？","\n","……","⋯⋯","」"];
                let bestSplitIndex = -1;
                for (let p of punctuation) {
                    const idx = chunkAttempt.lastIndexOf(p);
                    if (idx > bestSplitIndex) bestSplitIndex = idx;
                }
                let finalCutIndex = (bestSplitIndex !== -1) ? bestSplitIndex + 1 : CHAR_LIMIT;
                chunks.push(remaining.substring(0, finalCutIndex));
                remaining = remaining.substring(finalCutIndex);
            }

            step.text = chunks.shift();
            state.textQueue = chunks;
        }

        currentStepData = step;
    }

    render(currentStepData);

    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData: currentStepData
    });
}

function prevStep() {
    if (state.backStack.length <= 1) return;

    state.backStack.pop();
    const prevSnapshot = state.backStack[state.backStack.length - 1];

    state.index = prevSnapshot.index;
    state.textQueue = [...prevSnapshot.textQueue];

    if (state.backStack[state.backStack.length - 1].index !== state.index) {
        state.history.pop();
    }

    render(prevSnapshot.stepData);
}

function render(step) {
    if (!step) return;

    if (step.bg) changeBackground(step.bg);

    if (ui.namePlate) {
        if (step.speaker === "Narrator") {
            ui.namePlate.style.display = "none";
        } else {
            ui.namePlate.style.display = ""; 
            ui.namePlate.textContent = step.speaker || "";
            ui.namePlate.setAttribute("data-name", step.speaker || "");
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
        ui.textBox.innerHTML = formatText(step.text || "");
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

function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (bgPath) {
        ui.gameScreen.style.backgroundImage = `url('${bgPath}')`;
        ui.gameScreen.style.backgroundSize = "cover";     
        ui.gameScreen.style.backgroundPosition = "center"; 
    }
}

function updateCharacters(step) {
    if (ui.avatarRight) {
        ui.avatarRight.style.display = "none";
        ui.avatarRight.classList.remove("active");
    }

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

function setupChapterMenu() {
    if (!ui.chapterBtn || !ui.chapterMenu) return;
    const chapters = scenario
        .map((step,index) => step.chapter ? { title: step.chapter, index } : null)
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
        div.onclick = (e) => { e.stopPropagation(); jumpToChapter(ch.index); };
        ui.chapterMenu.appendChild(div);
    });
    ui.chapterMenu.hidden = false;
}

function jumpToChapter(index) {
    state.index = index;
    state.textQueue = [];
    state.backStack = [];
    ui.chapterMenu.hidden = true;
    nextStep();
}

console.log("引擎啟動！");
initGame();
