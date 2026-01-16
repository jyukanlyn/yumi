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
  eventImage: document.getElementById("event-image"),
};

/* 場景切換 */
let currentScene = null;
export function switchScene(name){
  if(!ui.gameScreen) return;
  if(currentScene) ui.gameScreen.classList.remove(currentScene);
  ui.gameScreen.classList.add(name);
  currentScene = name;
}

/* 助手 */
function cleanPageStart(t){ return t.replace(/^[\n\r\s]+/, ""); }

function splitTextByHeight(text, maxH) {
  const test = document.createElement("div");
  const style = getComputedStyle(ui.textBox);
  
  // 設置測試容器樣式，模擬真實環境
  Object.assign(test.style, {
    position: "absolute",
    visibility: "hidden",
    width: ui.textBox.clientWidth + "px", // 改用 clientWidth 扣除邊框影響
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding, 
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  });
  
  document.body.appendChild(test);
  let pages = [], cur = "";
  
  for (let c of text) {
    // 預測加入下一個字後的高度
    test.textContent = cur + c; 
    
    // 如果高度超過限制
    if (test.scrollHeight > maxH) {
      // 安全機制：如果連第一個字都放不進去，強行放入避免死循環
      if (cur.length === 0) {
        pages.push(c);
      } else {
        pages.push(cleanPageStart(cur));
        cur = c;
      }
    } else {
      cur += c;
    }
  }
  if (cur.trim()) pages.push(cleanPageStart(cur));
  document.body.removeChild(test);
  return pages;
}

/* 核心 */
function nextStep() {
  let step;
  if (state.textQueue.length) {
    const chunk = state.textQueue.shift();
    const last = state.backStack.at(-1);
    step = { ...last.stepData, text: chunk };
  } else {
    if (state.index >= scenario.length) return;
    let raw = { ...scenario[state.index++] };
    if (!raw.speaker && state.lastSpeaker) raw.speaker = state.lastSpeaker;
    if (raw.speaker) state.lastSpeaker = raw.speaker;
    
    if (raw.text) {
      const box = ui.textBox;
      if (box) {
        // --- [修復] 高度計算邏輯 ---
        const style = window.getComputedStyle(box);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        
        // 計算可用高度：總高度 - Padding - 10px緩衝
        let maxH = box.clientHeight - paddingY - 10;
        
        // [安全檢查] 如果計算出的高度太小（例如CSS未加載或隱藏時），給予預設值防止"一頁一字"
        if (maxH < 30) {
            maxH = 200; 
        }
        
        const pages = splitTextByHeight(raw.text, maxH);
        raw.text = pages.shift();
        state.textQueue = pages;
      }
    }
    state.history.push({ speaker: raw.speaker, text: raw.text });
    step = raw;
  }
  render(step);
  state.backStack.push({ index: state.index, textQueue: [...state.textQueue], stepData: JSON.parse(JSON.stringify(step)) });
}

function prevStep(){
  if(state.backStack.length<=1) return;
  state.backStack.pop();
  const prev=state.backStack.at(-1);
  state.index=prev.index;
  state.textQueue=[...prev.textQueue];
  render(prev.stepData);
}

/* Render */
function render(step){
  if(step.bg) changeBackground(step.bg);
  if(ui.namePlate){
    if(!step.speaker || step.speaker==="Narrator") ui.namePlate.style.visibility="hidden";
    else { ui.namePlate.style.visibility="visible"; ui.namePlate.textContent=step.speaker; }
  }
  if(ui.textBox) ui.textBox.textContent=step.text||"";
  updateCharacters(step);
}
function changeBackground(bg){ if(!backgrounds[bg]) return; ui.gameScreen.style.backgroundImage=`url('${backgrounds[bg]}')`; }

function updateCharacters(step){
  if(!step.speaker || step.speaker==="Narrator"){ ui.avatarLeft.style.display="none"; ui.avatarRight.style.display="none"; return; }
  const char=characters[step.speaker]; if(!char) return;
  const emotion=step.emotion||"normal";
  const src=char.sprites[emotion]; if(!src) return;
  const pos=step.position||char.defaultPosition||"left";
  const target=pos==="right"?ui.avatarRight:ui.avatarLeft;
  const other=pos==="right"?ui.avatarLeft:ui.avatarRight;
  if(other){other.style.display="none"; other.classList.remove("active");}
  if(!target) return;
  if(!target.src.endsWith(src)){ target.src=src; target.style.display="block"; target.classList.remove("active"); setTimeout(()=>target.classList.add("active"),20);}
  else { target.style.display="block"; if(!target.classList.contains("active")) target.classList.add("active"); }
}

/* Log */
function showLog(){
  ui.logContent.innerHTML="";
  state.history.forEach(l=>{
    const div=document.createElement("div");
    div.className="log-entry";
    div.innerHTML=`<span class="log-name">${l.speaker||""}</span><span class="log-text">${l.text}</span>`;
    ui.logContent.appendChild(div);
  });
  ui.logWindow.hidden=false;
}

/* 初始化 */
function initGame(){
  ui.gameScreen.addEventListener("click",e=>{
    if(e.target.closest("#log-window")||e.target.closest("#chapter-menu")||e.target.closest("button")||e.target.closest("#back-btn")) return;
    nextStep();
  });

  if(ui.logBtn) ui.logBtn.onclick=e=>{ e.stopPropagation(); showLog(); };
  if(ui.closeLogBtn) ui.closeLogBtn.onclick=e=>{ e.stopPropagation(); ui.logWindow.hidden=true; };
  if(ui.backBtn) ui.backBtn.onclick=e=>{ e.stopPropagation(); prevStep(); };

  document.addEventListener("click",e=>{
    const r=document.createElement("div");
    r.className="click-ripple";
    r.style.left=e.clientX+"px";
    r.style.top=e.clientY+"px";
    document.body.appendChild(r);
    setTimeout(()=>r.remove(),900);
  });

  switchScene("scene1");
  nextStep();
}

initGame();