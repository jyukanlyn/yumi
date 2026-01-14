import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

/* ===============================
   UI 元素快取
================================ */
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

/* ===============================
   初始化
================================ */
function initGame() {
    if (!ui.gameScreen) {
        console.error("錯誤：找不到 #game-screen");
        return;
    }

    ui.gameScreen.addEventListener("click", nextStep);
    setupChapterMenu();

    ui.logBtn?.addEventListener("click", e => {
        e.stopPropagation();
        showLog();
    });

    ui.closeLogBtn?.addEventListener("click", e => {
        e.stopPropagation();
        ui.logWindow.hidden = true;
    });

    ui.backBtn?.addEventListener("click", e => {
        e.stopPropagation();
        prevStep();
    });

    if (state.index === 0 && scenario.length > 0) {
        nextStep();
    } else {
        render(scenario[state.index - 1] || scenario[0]);
    }
}

/* ===============================
   核心流程
================================ */
const CHAR_LIMIT = 60;

function nextStep() {
    let stepData = null;

    /* --- 1. 先處理文字佇列 --- */
    if (state.textQueue.length > 0) {
        const chunk = state.textQueue.shift();
        const rawStep = scenario[state.index - 1];
        stepData = { ...rawStep, text: chunk };
    }

    /* --- 2. 讀新句 --- */
    else {
        if (state.index >= scenario.length) return;

        let step = { ...scenario[state.index] };

        state.history.push({
            index: state.index,
            speaker: step.speaker || "",
            text: step.text || ""
        });

        state.index++;
        state.textQueue = [];

        if (step.text && step.text.length > CHAR_LIMIT) {
            const chunks = splitText(step.text);
            step.text = chunks.shift();
            state.textQueue = chunks;
        }

        stepData = step;
    }

    render(stepData);

    state.backStack.push({
        index: state.index,
        textQueue: [...state.textQueue],
        stepData
    });
}

function prevStep() {
    if (state.backStack.length <= 1) return;

    const current = state.backStack.pop();
    const prev = state.backStack[state.backStack.length - 1];

    if (current.index !== prev.index) {
        state.history.pop();
    }

    state.index = prev.index;
    state.textQueue = [...prev.textQueue];

    render(prev.stepData);
}

/* ===============================
   渲染
================================ */
function render(step) {
    if (!step) return;

    if (step.bg) changeBackground(step.bg);
    renderName(step);
    renderText(step);
    renderEvent(step);
    updateCharacters(step);
}

function renderName(step) {
    if (!ui.namePlate) return;

    if (step.speaker === "Narrator") {
        ui.namePlate.style.display = "none";
        return;
    }

    ui.namePlate.style.display = "";
    ui.namePlate.textContent = step.speaker || "";

    const char = characters[step.speaker];
    if (char?.nameColor) {
        ui.namePlate.style.backgroundColor = char.nameColor;
        ui.namePlate.style.color = char.textColor || "#fff";
    } else {
        ui.namePlate.style.backgroundColor = "";
        ui.namePlate.style.color = "";
    }
}

function renderText(step) {
    if (ui.textBox) {
        ui.textBox.textContent = step.text || "";
    }
}

function renderEvent(step) {
    if (!ui.eventImage) return;

    if (step.special === "dice") {
        ui.eventImage.src = "assets/effect/dice.png";
        ui.eventImage.hidden = false;
    } else {
        ui.eventImage.hidden = true;
        ui.eventImage.src = "";
    }
}

/* ===============================
   背景（保留漸層）
================================ */
function changeBackground(bgID) {
    const bgPath = backgrounds[bgID];
    if (!bgPath || !ui.gameScreen) return;

    ui.gameScreen.style.backgroundImage = `
        linear-gradient(
            rgba(255,255,255,0.35),
            rgba(255,255,255,0.55)
        ),
        url('${bgPath}')
    `;
    ui.gameScreen.style.backgroundSize = "cover";
    ui.gameScreen.style.backgroundPosition = "center";
}

/* ===============================
   角色
================================ */
function updateCharacters(step) {
    ui.avatarLeft?.classList.remove("active", "inactive");
    ui.avatarRight?.classList.remove("active", "inactive");

    ui.avatarLeft && (ui.avatarLeft.style.display = "none");
    ui.avatarRight && (ui.avatarRight.style.display = "none");

    if (step.speaker === "Narrator") return;

    const char = characters[step.speaker];
    if (!char?.sprites) return;

    const emotion = step.emotion || "normal";
    const sprite = char.sprites[emotion];
    if (!sprite || !ui.avatarLeft) return;

    ui.avatarLeft.src = sprite;
    ui.avatarLeft.style.display = "block";
    ui.avatarLeft.classList.add("active");
}

/* ===============================
   LOG
================================ */
function showLog() {
    if (!ui.logContent) return;
    ui.logContent.innerHTML = "";

    state.history.forEach(log => {
        if (!log.text) return;

        const entry = document.createElement("div");
        entry.className = "log-entry";

        if (log.speaker && log.speaker !== "Narrator") {
            const name = document.createElement("span");
            name.className = "log-name";
            name.textContent = log.speaker + "：";
            entry.appendChild(name);
        }

        const text = document.createElement("span");
        text.className = "log-text";
        text.textContent = log.text;
        entry.appendChild(text);

        ui.logContent.appendChild(entry);
    });

    ui.logWindow.hidden = false;
    setTimeout(() => {
        ui.logContent.scrollTop = ui.logContent.scrollHeight;
    }, 10);
}

/* ===============================
   章節
================================ */
function setupChapterMenu() {
    if (!ui.chapterBtn || !ui.chapterMenu) return;

    const chapters = scenario
        .map((s, i) => s.chapter ? { title: s.chapter, index: i } : null)
        .filter(Boolean);

    ui.chapterBtn.addEventListener("click", e => {
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
        div.onclick = e => {
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
    state.backStack = [];
    ui.chapterMenu.hidden = true;
    nextStep();
}

/* ===============================
   工具
================================ */
function splitText(text) {
    const punctuation = ["。", "！", "？", "\n", "……", "⋯⋯", "」"];
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= CHAR_LIMIT) {
            chunks.push(remaining);
            break;
        }

        let attempt = remaining.substring(0, CHAR_LIMIT);
        let cut = -1;

        for (let p of punctuation) {
            const idx = attempt.lastIndexOf(p);
            if (idx > cut) cut = idx;
        }

        const end = cut !== -1 ? cut + 1 : CHAR_LIMIT;
        chunks.push(remaining.substring(0, end));
        remaining = remaining.substring(end);
    }

    return chunks;
}

/* ===============================
   啟動
================================ */
initGame();
