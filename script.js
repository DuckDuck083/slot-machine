"use strict";

const SAVE_KEY = "lucky-star-casino-v2";
const today = () => new Date().toISOString().slice(0, 10);
const defaults = {
  version: 2, credits: 1000, xp: 0, level: 1, totalXp: 0, jackpot: 5000,
  inventory: ["classic"], equipped: { theme: "classic", reel: "standard", sound: "bells", charm: null },
  upgrades: { speed: 0, payout: 0, jackpot: 0, auto: 0 }, sound: true, daily: { last: "", streak: 0 },
  quests: { date: "", claimed: [], base: {} }, achievements: [], milestone: 0,
  stats: { plays: 0, wins: 0, wagered: 0, won: 0, jackpots: 0, slots: 0, roulette: 0, blackjack: 0, bestWin: 0 },
  history: []
};
const items = [
  {id:"midnight",type:"theme",name:"Midnight Neon",icon:"🌌",price:900,desc:"Electric violet casino theme."},
  {id:"emerald",type:"theme",name:"Emerald Room",icon:"💚",price:1600,desc:"A refined high-roller palette."},
  {id:"gem-reels",type:"reel",name:"Gemstone Reels",icon:"💎",price:700,desc:"Crystal-finished reel frames."},
  {id:"retro-reels",type:"reel",name:"Retro Reels",icon:"📺",price:1200,desc:"A warm vintage machine look."},
  {id:"synth",type:"sound",name:"Neon Nights",icon:"🎵",price:500,desc:"A synthwave sound pack."},
  {id:"royal",type:"sound",name:"Royal Fanfare",icon:"🎺",price:850,desc:"Orchestral wins and flourishes."},
  {id:"clover",type:"charm",name:"Lucky Clover",icon:"🍀",price:1400,desc:"Equip a little extra luck."},
  {id:"horseshoe",type:"charm",name:"Golden Horseshoe",icon:"🧲",price:2400,desc:"The high roller's favorite charm."},
  {id:"speed",type:"upgrade",name:"Quick Spin",icon:"⚡",base:650,max:3,desc:"Reels settle 18% faster per rank."},
  {id:"payout",type:"upgrade",name:"High Roller",icon:"📈",base:1200,max:5,desc:"+5% winnings per rank, everywhere."},
  {id:"jackpot",type:"upgrade",name:"Jackpot Edge",icon:"✨",base:1800,max:3,desc:"Improves premium slot odds."},
  {id:"auto",type:"upgrade",name:"Auto-Spin",icon:"🔁",base:2200,max:1,desc:"Unlock continuous slot spins."}
];
const quests = [
  {id:"play10",name:"Warm Up",desc:"Play 10 rounds",stat:"plays",goal:10,reward:250,xp:60},
  {id:"win3",name:"On a Roll",desc:"Win 3 rounds",stat:"wins",goal:3,reward:400,xp:90},
  {id:"wager500",name:"Big Action",desc:"Wager 500 credits",stat:"wagered",goal:500,reward:600,xp:120}
];
const achievements = [
  {id:"first",icon:"🎉",name:"First Win",desc:"Win your first game",stat:"wins",goal:1,reward:100},
  {id:"regular",icon:"🎟",name:"Club Regular",desc:"Play 50 rounds",stat:"plays",goal:50,reward:500},
  {id:"winner",icon:"💰",name:"Five Figure Club",desc:"Win 10,000 credits total",stat:"won",goal:10000,reward:1000},
  {id:"jackpot",icon:"👑",name:"Crowned in Gold",desc:"Hit a slot jackpot",stat:"jackpots",goal:1,reward:2500},
  {id:"veteran",icon:"🏆",name:"Casino Veteran",desc:"Reach level 10",stat:"level",goal:10,reward:1500},
  {id:"collector",icon:"🛍",name:"Collector",desc:"Own 5 boutique items",stat:"inventory",goal:5,reward:750}
];
let state = load(), slotBet = 25, busy = false, autoTimer = null, rouletteChoice = null, rouletteHistory = [], deck = [], player = [], dealer = [], blackjackWager = 25;
const $ = (q) => document.querySelector(q), $$ = (q) => [...document.querySelectorAll(q)];
const fmt = n => Math.round(n).toLocaleString("en-US");

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved) return structuredClone(defaults);
    return {...structuredClone(defaults), ...saved, equipped:{...defaults.equipped,...saved.equipped}, upgrades:{...defaults.upgrades,...saved.upgrades}, stats:{...defaults.stats,...saved.stats}};
  } catch { return structuredClone(defaults); }
}
function save(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify(state)); }catch{} }
function toast(text){ const el=$("#toast"); el.textContent=text; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2600); }
function xpNeeded(level){ return 100 + (level-1)*55; }
function addXp(amount){
  state.xp += amount; state.totalXp += amount;
  while(state.xp >= xpNeeded(state.level)){ state.xp-=xpNeeded(state.level); state.level++; const reward=150+state.level*50; state.credits+=reward; toast(`Level ${state.level}! +${fmt(reward)} credits`); }
}
function record(game,wager,win){
  state.credits += win; state.stats.plays++; state.stats[game]++; state.stats.wagered+=wager; state.stats.won+=win; if(win>0)state.stats.wins++; state.stats.bestWin=Math.max(state.stats.bestWin,win);
  addXp(Math.max(8,Math.round(wager/5))+(win>0?12:0)); checkAchievements(); checkMilestones(); save(); renderAll();
}
function checkAchievements(){
  achievements.forEach(a=>{ const value=a.stat==="level"?state.level:a.stat==="inventory"?state.inventory.length:state.stats[a.stat]; if(value>=a.goal&&!state.achievements.includes(a.id)){state.achievements.push(a.id);state.credits+=a.reward;toast(`Achievement: ${a.name} · +${fmt(a.reward)}`);}});
}
function checkMilestones(){
  const marks=[25,100,250,500,1000]; const rewards=[250,600,1200,2500,5000];
  while(state.milestone<marks.length && state.stats.plays>=marks[state.milestone]){state.credits+=rewards[state.milestone];toast(`Milestone reached! +${fmt(rewards[state.milestone])}`);state.milestone++;}
}
function renderHeader(){
  $("#credits").textContent=fmt(state.credits); $("#level").textContent=`Level ${state.level}`; $("#xp-label").textContent=`${state.xp} / ${xpNeeded(state.level)} XP`; $("#xp-bar").style.width=`${state.xp/xpNeeded(state.level)*100}%`; $("#jackpot").textContent=fmt(state.jackpot);
  $("#sound-toggle").textContent=state.sound?"🔊":"🔇"; document.body.dataset.theme=state.equipped.theme;
}
function switchView(name){ $$(".view,.nav-btn").forEach(e=>e.classList.remove("active")); $(`#${name}-view`).classList.add("active"); $(`.nav-btn[data-view="${name}"]`).classList.add("active"); if(name==="shop")renderShop(); if(name==="quests")renderQuests(); if(name==="achievements")renderAchievements(); if(name==="profile")renderProfile(); window.scrollTo({top:0,behavior:"smooth"}); }

const symbols=["🍒","🍋","🍊","🍇","🍀","🔔","🃏","💎","⭐","7️⃣"], weights=[14,14,14,13,12,10,9,7,4,1];
function randomSymbol(){
  const luck=state.upgrades.jackpot+(state.equipped.charm?1:0); const adjusted=[...weights]; adjusted[8]+=luck*.45; adjusted[9]+=luck*.18;
  let r=Math.random()*adjusted.reduce((a,b)=>a+b,0); for(let i=0;i<symbols.length;i++){r-=adjusted[i];if(r<0)return symbols[i];} return symbols[0];
}
async function spin(){
  if(busy||state.credits<slotBet){$("#slot-message").textContent="Not enough credits for that spin.";stopAuto();return;}
  busy=true; state.credits-=slotBet; state.jackpot+=Math.ceil(slotBet*.03); renderHeader(); save(); $("#slot-message").textContent="Reels spinning…";
  const result=$$(".reel").map(()=>randomSymbol()), delay=Math.max(330,850-state.upgrades.speed*150);
  $$(".reel").forEach(r=>r.classList.add("spinning"));
  await new Promise(resolve=>setTimeout(resolve,delay));
  $$(".reel").forEach((r,i)=>{r.classList.remove("spinning");r.querySelector("span").textContent=result[i];});
  const all=result.every(x=>x===result[0]), pair=new Set(result).size===2; let mult=all?(result[0]==="7️⃣"?25:result[0]==="⭐"?10:5):pair?2:0;
  let win=Math.round(slotBet*mult*(1+state.upgrades.payout*.05));
  if(all&&result[0]==="7️⃣"){win+=state.jackpot;state.stats.jackpots++;state.jackpot=5000;celebrate();}
  $("#slot-message").textContent=win?`${all&&result[0]==="7️⃣"?"JACKPOT! ":""}You won ${fmt(win)} credits!`:"No match — try again.";
  busy=false; record("slots",slotBet,win); if(autoTimer)autoTimer=setTimeout(spin,450);
}
function stopAuto(){clearTimeout(autoTimer);autoTimer=null;$("#auto-status").textContent="Off";$("#auto-spin").classList.remove("active");}
function celebrate(){document.body.classList.add("celebrate");setTimeout(()=>document.body.classList.remove("celebrate"),1200);}

const redNums=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function setupRoulette(){
  const grid=$("#number-grid"); for(let n=0;n<=36;n++){const b=document.createElement("button");b.textContent=n;b.dataset.choice=String(n);b.className=n===0?"green":redNums.has(n)?"red":"black";grid.append(b);}
  $$("#number-grid button,#outside-bets button").forEach(b=>b.onclick=()=>{rouletteChoice=b.dataset.choice;$$(".number-grid button,.outside-bets button").forEach(x=>x.classList.toggle("selected",x===b));});
}
function rouletteSpin(){
  if(busy||rouletteChoice===null)return toast("Choose a roulette bet first.");
  const wager=Number($("#roulette-wager").value);if(state.credits<wager)return toast("Not enough credits.");
  busy=true;state.credits-=wager;renderHeader();$("#wheel").classList.add("rolling");$("#roulette-message").textContent="No more bets…";
  setTimeout(()=>{const n=Math.floor(Math.random()*37),color=n===0?"green":redNums.has(n)?"red":"black";let mult=0;if(String(n)===rouletteChoice)mult=36;else if(rouletteChoice===color)mult=2;else if(n&&rouletteChoice==="even"&&n%2===0)mult=2;else if(n&&rouletteChoice==="odd"&&n%2)mult=2;else if(rouletteChoice==="low"&&n>=1&&n<=18)mult=2;else if(rouletteChoice==="high"&&n>=19)mult=2;
    const win=Math.round(wager*mult*(1+state.upgrades.payout*.05));$("#wheel").classList.remove("rolling");$("#wheel-number").textContent=n;rouletteHistory.unshift({n,color});rouletteHistory=rouletteHistory.slice(0,7);$("#roulette-history").innerHTML=rouletteHistory.map(x=>`<i class="${x.color}">${x.n}</i>`).join("");$("#roulette-message").textContent=win?`${n} ${color} — won ${fmt(win)}!`:`${n} ${color} — better luck next spin.`;busy=false;record("roulette",wager,win);},1150);
}

function freshDeck(){const suits=["♠","♥","♦","♣"],ranks=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];return suits.flatMap(s=>ranks.map(r=>({r,s}))).sort(()=>Math.random()-.5);}
function handValue(hand){let v=hand.reduce((a,c)=>a+(c.r==="A"?11:["J","Q","K"].includes(c.r)?10:Number(c.r)),0),aces=hand.filter(c=>c.r==="A").length;while(v>21&&aces--)v-=10;return v;}
function cardHtml(c){return `<i class="card ${["♥","♦"].includes(c.s)?"red-card":""}"><b>${c.r}</b><span>${c.s}</span></i>`;}
function drawHands(hide=false){$("#player-cards").innerHTML=player.map(cardHtml).join("");$("#dealer-cards").innerHTML=dealer.map((c,i)=>hide&&i===1?'<i class="card back">★</i>':cardHtml(c)).join("");$("#player-score").textContent=handValue(player);$("#dealer-score").textContent=hide?"":handValue(dealer);}
function deal(){
  blackjackWager=Number($("#blackjack-wager").value);if(busy||state.credits<blackjackWager)return toast("Not enough credits.");
  state.credits-=blackjackWager;busy=true;deck=freshDeck();player=[deck.pop(),deck.pop()];dealer=[deck.pop(),deck.pop()];drawHands(true);renderHeader();$("#deal-button").disabled=true;$("#hit-button").disabled=false;$("#stand-button").disabled=false;$("#blackjack-message").textContent="Hit or stand?";
  if(handValue(player)===21)finishBlackjack();
}
function hit(){if(!busy)return;player.push(deck.pop());drawHands(true);if(handValue(player)>=21)finishBlackjack();}
function finishBlackjack(){
  if(!busy)return;while(handValue(player)<=21&&handValue(dealer)<17)dealer.push(deck.pop());const p=handValue(player),d=handValue(dealer);let mult=p>21?0:d>21||p>d?(p===21&&player.length===2?2.5:2):p===d?1:0;const win=Math.round(blackjackWager*mult*(1+state.upgrades.payout*.05));drawHands();$("#blackjack-message").textContent=p>21?`Bust at ${p}.`:win>blackjackWager?`You win ${fmt(win)} credits!`:win===blackjackWager?"Push — wager returned.":`Dealer wins with ${d}.`;busy=false;$("#deal-button").disabled=false;$("#hit-button").disabled=true;$("#stand-button").disabled=true;record("blackjack",blackjackWager,win);
}

function renderShop(filter="all"){
  $("#shop-grid").innerHTML=items.filter(i=>filter==="all"||i.type===filter).map(i=>{const rank=state.upgrades[i.id]||0,owned=i.type==="upgrade"?rank>=i.max:state.inventory.includes(i.id),equipped=state.equipped[i.type]===i.id,price=i.base?i.base*(rank+1):i.price;return `<article class="store-card ${owned?"owned":""}"><div class="item-icon">${i.icon}</div><span>${i.type}${i.max?` · ${rank}/${i.max}`:""}</span><h3>${i.name}</h3><p>${i.desc}</p><button data-buy="${i.id}" ${owned&&i.type==="upgrade"?"disabled":""}>${equipped?"Equipped":owned?"Equip":`${fmt(price)} credits`}</button></article>`;}).join("");
  $$("[data-buy]").forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));
}
function buyItem(id){
  const i=items.find(x=>x.id===id),rank=state.upgrades[id]||0,owned=i.type==="upgrade"?rank>=i.max:state.inventory.includes(id),price=i.base?i.base*(rank+1):i.price;
  if(owned&&i.type!=="upgrade"){state.equipped[i.type]=id;toast(`${i.name} equipped`);}
  else if(state.credits<price)toast("Not enough credits yet.");
  else{state.credits-=price;if(i.type==="upgrade")state.upgrades[id]++;else{state.inventory.push(id);state.equipped[i.type]=id;}toast(`${i.name} unlocked!`);checkAchievements();}
  save();renderAll();renderShop($("#shop-filters .active").dataset.filter);
}
function ensureDaily(){if(state.quests.date!==today()){state.quests={date:today(),claimed:[],base:{plays:state.stats.plays,wins:state.stats.wins,wagered:state.stats.wagered}};save();}}
function questProgress(q){return Math.max(0,state.stats[q.stat]-(state.quests.base?.[q.stat]||0));}
function renderQuests(){ensureDaily();$("#quest-list").innerHTML=quests.map(q=>{const value=Math.min(questProgress(q),q.goal),done=value>=q.goal,claimed=state.quests.claimed.includes(q.id);return `<article class="quest"><div class="quest-icon">${done?"✓":"◆"}</div><div><span>Daily quest</span><h3>${q.name}</h3><p>${q.desc}</p><div class="progress"><i style="width:${value/q.goal*100}%"></i></div><small>${fmt(value)} / ${fmt(q.goal)}</small></div><button data-quest="${q.id}" ${!done||claimed?"disabled":""}>${claimed?"Claimed":`Claim ${fmt(q.reward)}`}</button></article>`;}).join("");$$("[data-quest]").forEach(b=>b.onclick=()=>claimQuest(b.dataset.quest));}
function claimQuest(id){const q=quests.find(x=>x.id===id);state.quests.claimed.push(id);state.credits+=q.reward;addXp(q.xp);toast(`Quest complete! +${fmt(q.reward)} and ${q.xp} XP`);save();renderAll();renderQuests();}
function renderAchievements(){checkAchievements();$("#achievement-grid").innerHTML=achievements.map(a=>{const unlocked=state.achievements.includes(a.id),value=a.stat==="level"?state.level:a.stat==="inventory"?state.inventory.length:state.stats[a.stat];return `<article class="achievement ${unlocked?"unlocked":""}"><div class="item-icon">${unlocked?a.icon:"🔒"}</div><span>${unlocked?"Unlocked":"Locked"}</span><h3>${a.name}</h3><p>${a.desc}</p><small>${Math.min(value,a.goal)} / ${a.goal} · Reward ${fmt(a.reward)}</small></article>`;}).join("");}
function renderProfile(){const marks=[25,100,250,500,1000],names=["Getting Started","Casino Regular","High Roller","VIP Legend","Casino Royalty"],next=marks[state.milestone];$("#profile-title").textContent=state.level>=10?"Casino Veteran":state.level>=5?"Club Regular":"Rising Player";$("#milestone-name").textContent=next?names[state.milestone]:"All milestones complete";$("#milestone-copy").textContent=next?`${state.stats.plays} / ${next} total games`:"You conquered the club.";$("#milestone-bar").style.width=next?`${Math.min(100,state.stats.plays/next*100)}%`:"100%";const data=[["Games played",state.stats.plays],["Games won",state.stats.wins],["Win rate",state.stats.plays?`${Math.round(state.stats.wins/state.stats.plays*100)}%`:"0%"],["Credits wagered",fmt(state.stats.wagered)],["Credits won",fmt(state.stats.won)],["Best win",fmt(state.stats.bestWin)],["Slot spins",state.stats.slots],["Roulette spins",state.stats.roulette],["Blackjack hands",state.stats.blackjack]];$("#stats-grid").innerHTML=data.map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");}
function renderDaily(){const claimed=state.daily.last===today();$("#daily-claim").disabled=claimed;$("#daily-claim").textContent=claimed?"Claimed ✓":"Claim reward";$("#daily-streak").textContent=`Day ${Math.max(1,state.daily.streak)} streak`;$("#daily-note").textContent=claimed?"Next reward tomorrow":"Up to 1,000 credits";}
function renderAll(){renderHeader();renderDaily();$("#shop-badge").textContent=state.level>=3?"New":"";ensureDaily();const ready=quests.filter(q=>questProgress(q)>=q.goal&&!state.quests.claimed.includes(q.id)).length;$("#quest-badge").textContent=ready||"";}

$$(".nav-btn").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$("#slot-bets button").forEach(b=>b.onclick=()=>{slotBet=Number(b.dataset.bet);$$("#slot-bets button").forEach(x=>x.classList.toggle("active",x===b));});
$("#spin-button").onclick=spin;$("#auto-spin").onclick=()=>{if(!state.upgrades.auto)return toast("Unlock Auto-Spin in the shop.");if(autoTimer)stopAuto();else{$("#auto-status").textContent="On";$("#auto-spin").classList.add("active");autoTimer=setTimeout(spin,100);}};
$("#roulette-spin").onclick=rouletteSpin;$("#deal-button").onclick=deal;$("#hit-button").onclick=hit;$("#stand-button").onclick=finishBlackjack;
$("#sound-toggle").onclick=()=>{state.sound=!state.sound;save();renderHeader();};
$("#daily-claim").onclick=()=>{if(state.daily.last===today())return;const yesterday=new Date(Date.now()-864e5).toISOString().slice(0,10);state.daily.streak=state.daily.last===yesterday?state.daily.streak+1:1;const reward=Math.min(1000,200+state.daily.streak*100);state.daily.last=today();state.credits+=reward;addXp(40);toast(`Daily reward: +${fmt(reward)} credits`);save();renderAll();};
$$("#shop-filters button").forEach(b=>b.onclick=()=>{$$("#shop-filters button").forEach(x=>x.classList.toggle("active",x===b));renderShop(b.dataset.filter);});
$("#reset-save").onclick=()=>{if(confirm("Reset all credits, levels, unlocks, and statistics? This cannot be undone.")){localStorage.removeItem(SAVE_KEY);location.reload();}};
document.addEventListener("keydown",e=>{if(e.code==="Space"&&!e.repeat&&$("#slots-view").classList.contains("active")){e.preventDefault();spin();}});
setupRoulette();renderAll();renderShop();renderQuests();
