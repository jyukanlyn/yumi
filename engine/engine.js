import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state } from "./state.js";

const namePlate = document.getElementById("name-plate");
const textBox = document.getElementById("dialogue-text");

const avatarLeft = document.getElementById("avatar-left");
const avatarRight = document.getElementById("avatar-right");

document.getElementById("game-screen")
  .addEventListener("click", nextStep);

function nextStep() {
  if (state.index >= scenario.length) return;

  const step = scenario[state.index++];
  render(step);
}

function render(step) {
  namePlate.textContent = step.speaker === "Narrator" ? "" : step.speaker;
  textBox.textContent = step.text;

  updateCharacters(step);
}

function updateCharacters(step) {
  resetAvatars();

  if (step.speaker === "Narrator") {
    dimAll();
    return;
  }

  const char = characters[step.speaker];
  if (!char) return;

  const target = char.side === "left" ? avatarLeft : avatarRight;
  target.src = char.sprites[step.emotion || "normal"];
  target.classList.add("active");

  dimOther(char.side);
}

function resetAvatars() {
  [avatarLeft, avatarRight].forEach(a => {
    a.className = a.classList.contains("left")
      ? "avatar left"
      : "avatar right";
  });
}

function dimOther(activeSide) {
  if (activeSide === "left") avatarRight.classList.add("inactive");
  if (activeSide === "right") avatarLeft.classList.add("inactive");
}

function dimAll() {
  avatarLeft.classList.add("inactive");
  avatarRight.classList.add("inactive");
}
const chapters = scenario
  .map((step, index) => step.chapter ? { title: step.chapter, index } : null)
  .filter(Boolean);
const chapterBtn = document.getElementById("chapter-btn");
const chapterMenu = document.getElementById("chapter-menu");

chapterBtn.addEventListener("click", e => {
  e.stopPropagation();
  openChapterMenu();
});
function openChapterMenu() {
  chapterMenu.innerHTML = "<h2>章節選擇</h2>";

  chapters.forEach(ch => {
    const div = document.createElement("div");
    div.className = "chapter-item";
    div.textContent = ch.title;
    div.onclick = () => jumpToChapter(ch.index);
    chapterMenu.appendChild(div);
  });

  chapterMenu.hidden = false;
}
function jumpToChapter(index) {
  state.index = index;
  chapterMenu.hidden = true;
  nextStep();
}
chapterMenu.addEventListener("click", () => {
  chapterMenu.hidden = true;
});
