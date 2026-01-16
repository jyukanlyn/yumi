import { scenario } from "../data/scenario.js";
import { characters } from "../data/characters.js";
import { state, backgrounds } from "./state.js";

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
  eventImage: document.getElementById("event-image")
};

// 下一步核心
function nextStep() { /* 同你原本 engine.js nextStep 內容 */ }

// 上一步
function prevStep() { /* 同你原本 engine.js prevStep 內容 */ }

// 渲染
function render(step) { 
  if (!step) return;

  // 背景
  if (step.bg) switchScene(step.bg);

  // 名字
  if (ui.namePlate) {
    if (!step.speaker || step.speaker==="Narrator") ui.namePlate.style.visibility="hidden";
    else {
      ui.namePlate.style.visibility="visible";
      ui.namePlate.textContent = step.speaker;
    }
  }

  // 文字
  if (ui.textBox) ui.textBox.textContent = step.text||"";

  // 角色立繪
  updateCharacters(step);
}

function updateCharacters(step) {
  if (ui.avatarRight) { ui.avatarRight.style.display="none"; ui.avatarRight.classList.remove("active"); }
  if (!step.speaker || step.speaker==="Narrator") {
    if (ui.avatarLeft) { ui.avatarLeft.style.display="none"; ui.avatarLeft.classList.remove("active"); ui.avatarLeft.src=""; }
    return;
  }
  const char = characters[step.speaker];
  if (char && char.sprites && ui.avatarLeft) {
    const emotion = step.emotion||"normal";
    const src = char.sprites[emotion];
    if (src && !ui.avatarLeft.src.endsWith(src)) ui.avatarLeft.src = src;
    ui.avatarLeft.style.display="block";
    ui.avatarLeft.classList.add("active");
  }
}

// LOG
function showLog() {
  if (!ui.logContent) return;
  ui.logContent.innerHTML="";
  state.history.forEach(log=>{
    const entry=document.createElement("div"); entry.className="log-entry";
    const nameHtml = log.speaker && log.speaker!=="Narrator" ? `<span class="log-name">${log.speaker}</span>`:"";
    entry.innerHTML = `${nameHtml}<span class="log-text">${log.text}</span>`;
    ui.logContent.appendChild(entry);
  });
  ui.logWindow.hidden=false;
  setTimeout(()=>ui.logContent.scrollTop=ui.logContent.scrollHeight,50);
}

// 章節選單
function setupChapterMenu() {
  if(!ui.chapterMenu) return;
  ui.chapterMenu.innerHTML="<h2>章節選擇</h2>";
  scenario.map((s,i)=>s.chapter?{title:s.chapter,index:i}:null).filter(Boolean)
    .forEach(ch=>{
      const div=document.createElement("div");
      div.className="chapter-item"; div.textContent=ch.title;
      div.onclick=(e)=>{ e.stopPropagation(); jumpToChapter(ch.index); };
      ui.chapterMenu.appendChild(div);
    });
}
function jumpToChapter(index){ state.index=index; state.textQueue=[]; state.backStack=[]; state.lastSpeaker=null; if(ui.chapterMenu) ui.chapterMenu.hidden=true; nextStep(); }

// 場景切換
function switchScene(name){
  if(!ui.gameScreen) return;
  ui.gameScreen.classList.remove("scene1","scene2");
  if(name) ui.gameScreen.classList.add(name);
}

// 點擊水波
document.addEventListener('click',function(e){
  const ripple=document.createElement('div'); ripple.className='click-ripple';
  ripple.style.left=e.clientX+'px'; ripple.style.top=e.clientY+'px';
  document.body.appendChild(ripple);
  setTimeout(()=>ripple.remove(),800);
});

// 初始化
function initGame() {
  if(!ui.gameScreen) return;
  if(ui.chapterBtn) ui.chapterBtn.addEventListener("click",(e)=>{ e.stopPropagation(); setupChapterMenu(); if(ui.chapterMenu) ui.chapterMenu.hidden=false; });
  if(ui.chapterMenu) ui.chapterMenu.addEventListener("click",()=>{ ui.chapterMenu.hidden=true; });
  if(ui.gameScreen) ui.gameScreen.addEventListener("click",(e)=>{
    if(e.target.tagName==="BUTTON"|| e.target.closest("#back-btn") || e.target.closest("#chapter-menu") || e.target.closest("#log-window")) return;
    nextStep();
  });
  if(ui.logBtn) ui.logBtn.onclick=(e)=>{ e.stopPropagation(); showLog(); };
  if(ui.closeLogBtn) ui.closeLogBtn.onclick=(e)=>{ e.stopPropagation(); ui.logWindow.hidden=true; };
  if(ui.backBtn) ui.backBtn.onclick=(e)=>{ e.stopPropagation(); prevStep(); };

  nextStep();
}

initGame();
