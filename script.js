"use strict";

const SAVE_KEY = "lucky-star-casino-v2";
const today = () => new Date().toISOString().slice(0, 10);
const defaults = {
  version: 3, credits: 1000, debt: 0, gameOver: false, xp: 0, level: 1, totalXp: 0, jackpot: 5000,
  inventory: ["classic"], equipped: { theme: "classic", reel: "standard", sound: "bells", charm: null },
  upgrades: { speed: 0, payout: 0, jackpot: 0, auto: 0 }, sound: true, daily: { last: "", streak: 0 },
  quests: { date: "", claimed: [], base: {} }, achievements: [], milestone: 0,
  stats: { plays: 0, wins: 0, wagered: 0, won: 0, jackpots: 0, slots: 0, roulette: 0, blackjack: 0, baccarat: 0, plinko: 0, prizewheel: 0, russian: 0, lottery: 0, bestWin: 0 },
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
let state = load(), slotBet = 25, slotBusy = false, rouletteBusy = false, blackjackActive = false, autoTimer = null, rouletteChoice = null, rouletteHistory = [], deck = [], player = [], dealer = [], blackjackWager = 25;
let baccaratChoice=null, baccaratBusy=false, plinkoBusy=false, prizewheelBusy=false, russianBusy=false;
const WAGERS=[10,25,50,100,500,1000,5000,10000,50000,100000,500000,1000000];
const DEBT_LIMIT = 5000;
const $ = (q) => document.querySelector(q), $$ = (q) => [...document.querySelectorAll(q)];
const fmt = n => Math.round(n).toLocaleString("en-US");

function load() {
  const fresh = () => JSON.parse(JSON.stringify(defaults));
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved) return fresh();
    return {...fresh(), ...saved, equipped:{...defaults.equipped,...saved.equipped}, upgrades:{...defaults.upgrades,...saved.upgrades}, stats:{...defaults.stats,...saved.stats}};
  } catch { return fresh(); }
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
  $("#debt").textContent=fmt(state.debt); $("#open-cashier").classList.toggle("has-debt",state.debt>0);
  $("#sound-toggle").textContent=state.sound?"🔊":"🔇"; document.body.dataset.theme=state.equipped.theme;
}
function switchView(name){ $$(".view,.nav-btn").forEach(e=>e.classList.remove("active")); $(`#${name}-view`).classList.add("active"); $(`.nav-btn[data-view="${name}"]`).classList.add("active"); if(name==="shop")renderShop(); if(name==="lottery")renderLottery(); if(name==="quests")renderQuests(); if(name==="achievements")renderAchievements(); if(name==="profile")renderProfile(); window.scrollTo({top:0,behavior:"smooth"}); }

function canPay(amount){if(state.gameOver)return false;if(state.credits>=amount)return true;stopAuto();openCashier();toast(`You need ${fmt(amount-state.credits)} more credits.`);return false;}
function openCashier(){renderCashier();$("#cashier-modal").classList.add("open");$("#cashier-modal").setAttribute("aria-hidden","false");}
function closeCashier(){$("#cashier-modal").classList.remove("open");$("#cashier-modal").setAttribute("aria-hidden","true");}
function renderCashier(){$("#cashier-debt").textContent=`${fmt(state.debt)} / ${fmt(DEBT_LIMIT)}`;$("#debt-bar").style.width=`${state.debt/DEBT_LIMIT*100}%`;$("#borrow-500").disabled=state.debt+500>DEBT_LIMIT;$("#repay-500").disabled=!state.debt||!state.credits;}
function borrow(){if(state.debt+500>DEBT_LIMIT)return;state.debt+=500;state.credits+=500;if(state.debt>=DEBT_LIMIT){state.gameOver=true;closeCashier();stopAuto();$("#gameover").classList.add("open");}save();renderAll();renderCashier();}
function repay(){const amount=Math.min(500,state.debt,state.credits);if(!amount)return;state.debt-=amount;state.credits-=amount;save();renderAll();renderCashier();toast(`${fmt(amount)} debt repaid.`);}

const symbols=["🍒","🍋","🍊","🍇","🍀","🔔","🃏","💎","⭐","7️⃣"], weights=[14,14,14,13,12,10,9,7,4,1];
function randomSymbol(){
  const luck=state.upgrades.jackpot+(state.equipped.charm?1:0); const adjusted=[...weights]; adjusted[8]+=luck*.45; adjusted[9]+=luck*.18;
  let r=Math.random()*adjusted.reduce((a,b)=>a+b,0); for(let i=0;i<symbols.length;i++){r-=adjusted[i];if(r<0)return symbols[i];} return symbols[0];
}
async function spin(){
  if(slotBusy)return;
  if(!canPay(slotBet)){$("#slot-message").textContent="Visit the cashier to fund this spin.";return;}
  slotBusy=true; state.credits-=slotBet; state.jackpot+=Math.ceil(slotBet*.03); renderHeader(); save(); $("#slot-message").textContent="Reels spinning…";
  const result=$$(".reel").map(()=>randomSymbol()), delay=Math.max(330,850-state.upgrades.speed*150);
  $$(".reel").forEach(r=>r.classList.add("spinning"));
  await new Promise(resolve=>setTimeout(resolve,delay));
  $$(".reel").forEach((r,i)=>{r.classList.remove("spinning");r.querySelector("span").textContent=result[i];});
  const all=result.every(x=>x===result[0]), pair=new Set(result).size===2; let mult=all?(result[0]==="7️⃣"?25:result[0]==="⭐"?10:5):pair?2:0;
  let win=Math.round(slotBet*mult*(1+state.upgrades.payout*.05));
  if(all&&result[0]==="7️⃣"){win+=state.jackpot;state.stats.jackpots++;state.jackpot=5000;celebrate();}
  $("#slot-message").textContent=win?`${all&&result[0]==="7️⃣"?"JACKPOT! ":""}You won ${fmt(win)} credits!`:"No match — try again.";
  slotBusy=false; record("slots",slotBet,win); if(autoTimer)autoTimer=setTimeout(spin,450);
}
function stopAuto(){clearTimeout(autoTimer);autoTimer=null;$("#auto-status").textContent="Off";$("#auto-spin").classList.remove("active");}
function celebrate(){document.body.classList.add("celebrate");setTimeout(()=>document.body.classList.remove("celebrate"),1200);}

const redNums=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function setupRoulette(){
  const grid=$("#number-grid"); for(let n=0;n<=36;n++){const b=document.createElement("button");b.textContent=n;b.dataset.choice=String(n);b.className=n===0?"green":redNums.has(n)?"red":"black";grid.append(b);}
  $$("#number-grid button,#outside-bets button").forEach(b=>b.onclick=()=>{rouletteChoice=b.dataset.choice;$$(".number-grid button,.outside-bets button").forEach(x=>x.classList.toggle("selected",x===b));});
}
function rouletteSpin(){
  if(rouletteBusy)return;
  if(rouletteChoice===null)return toast("Choose a roulette bet first.");
  const wager=Number($("#roulette-wager").value);if(!canPay(wager))return;
  rouletteBusy=true;state.credits-=wager;renderHeader();$("#wheel").classList.add("rolling");$("#roulette-message").textContent="No more bets…";
  setTimeout(()=>{const n=Math.floor(Math.random()*37),color=n===0?"green":redNums.has(n)?"red":"black";let mult=0;if(String(n)===rouletteChoice)mult=36;else if(rouletteChoice===color)mult=2;else if(n&&rouletteChoice==="even"&&n%2===0)mult=2;else if(n&&rouletteChoice==="odd"&&n%2)mult=2;else if(rouletteChoice==="low"&&n>=1&&n<=18)mult=2;else if(rouletteChoice==="high"&&n>=19)mult=2;
    const win=Math.round(wager*mult*(1+state.upgrades.payout*.05));$("#wheel").classList.remove("rolling");$("#wheel-number").textContent=n;rouletteHistory.unshift({n,color});rouletteHistory=rouletteHistory.slice(0,7);$("#roulette-history").innerHTML=rouletteHistory.map(x=>`<i class="${x.color}">${x.n}</i>`).join("");$("#roulette-message").textContent=win?`${n} ${color} — won ${fmt(win)}!`:`${n} ${color} — better luck next spin.`;rouletteBusy=false;record("roulette",wager,win);},1150);
}

function freshDeck(){const suits=["♠","♥","♦","♣"],ranks=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];return suits.flatMap(s=>ranks.map(r=>({r,s}))).sort(()=>Math.random()-.5);}
function handValue(hand){return hand.reduce((a,c)=>a+(c.r==="A"?1:c.r==="J"?11:c.r==="Q"?12:c.r==="K"?13:Number(c.r)),0);}
function cardHtml(c){return `<i class="card ${["♥","♦"].includes(c.s)?"red-card":""}"><b>${c.r}</b><span>${c.s}</span></i>`;}
function drawHands(hide=false){$("#player-cards").innerHTML=player.map(cardHtml).join("");$("#dealer-cards").innerHTML=dealer.map((c,i)=>hide&&i===1?'<i class="card back">★</i>':cardHtml(c)).join("");$("#player-score").textContent=handValue(player);$("#dealer-score").textContent=hide?"":handValue(dealer);}
function deal(){
  blackjackWager=Number($("#blackjack-wager").value);if(blackjackActive)return;if(!canPay(blackjackWager))return;
  state.credits-=blackjackWager;blackjackActive=true;deck=freshDeck();player=[deck.pop(),deck.pop()];dealer=[deck.pop(),deck.pop()];drawHands(true);renderHeader();$("#deal-button").disabled=true;$("#hit-button").disabled=false;$("#stand-button").disabled=false;$("#blackjack-message").textContent="Hit or stand?";
  if(handValue(player)===21)finishBlackjack();
}
function hit(){if(!blackjackActive)return;player.push(deck.pop());drawHands(true);if(handValue(player)>=21)finishBlackjack();}
function finishBlackjack(){
  if(!blackjackActive)return;while(handValue(player)<=21&&handValue(dealer)<17)dealer.push(deck.pop());const p=handValue(player),d=handValue(dealer);let mult=p>21?0:d>21||p>d?(p===21&&player.length===2?2.5:2):p===d?1:0;const win=Math.round(blackjackWager*mult*(1+state.upgrades.payout*.05));drawHands();$("#blackjack-message").textContent=p>21?`Bust at ${p}.`:win>blackjackWager?`You win ${fmt(win)} credits!`:win===blackjackWager?"Push — wager returned.":`Dealer wins with ${d}.`;blackjackActive=false;$("#deal-button").disabled=false;$("#hit-button").disabled=true;$("#stand-button").disabled=true;record("blackjack",blackjackWager,win);
}

function baccaratValue(cards){return cards.reduce((sum,c)=>sum+(c.r==="A"?1:["10","J","Q","K"].includes(c.r)?0:Number(c.r)),0)%10;}
function dealBaccarat(){
  if(baccaratBusy)return;if(!baccaratChoice)return toast("Choose Player, Banker, or Tie first.");const wager=Number($("#baccarat-wager").value);if(!canPay(wager))return;
  baccaratBusy=true;state.credits-=wager;renderHeader();const d=freshDeck(),p=[d.pop(),d.pop()],b=[d.pop(),d.pop()];if(baccaratValue(p)<=5)p.push(d.pop());if(baccaratValue(b)<=5)b.push(d.pop());
  $("#baccarat-player").innerHTML=p.map(cardHtml).join("");$("#baccarat-banker").innerHTML=b.map(cardHtml).join("");const pv=baccaratValue(p),bv=baccaratValue(b),result=pv===bv?"tie":pv>bv?"player":"banker";$("#baccarat-player-score").textContent=pv;$("#baccarat-banker-score").textContent=bv;
  const mult=baccaratChoice===result?(result==="tie"?9:result==="banker"?1.95:2):0,win=Math.round(wager*mult*(1+state.upgrades.payout*.05));$("#baccarat-message").textContent=`${result[0].toUpperCase()+result.slice(1)} wins ${pv}–${bv}${win?` · You won ${fmt(win)}!`:"."}`;baccaratBusy=false;record("baccarat",wager,win);
}

const plinkoMultipliers=[5,2,.5,0,.5,2,5];
function setupPlinko(){$("#plinko-pegs").innerHTML=Array.from({length:36},()=>"<i></i>").join("");$("#plinko-slots").innerHTML=plinkoMultipliers.map(x=>`<b>${x}×</b>`).join("");}
function dropPlinko(){if(plinkoBusy)return;const wager=Number($("#plinko-wager").value);if(!canPay(wager))return;plinkoBusy=true;state.credits-=wager;renderHeader();const index=Math.floor(Math.random()*plinkoMultipliers.length),mult=plinkoMultipliers[index],chip=$("#plinko-chip");chip.style.setProperty("--landing",`${(index-3)*48}px`);chip.classList.remove("dropping");void chip.offsetWidth;chip.classList.add("dropping");$("#plinko-message").textContent="Chip dropping…";setTimeout(()=>{const win=Math.round(wager*mult*(1+state.upgrades.payout*.05));$("#plinko-message").textContent=`Landed on ${mult}×${win?` · You won ${fmt(win)}!`:" · No payout."}`;plinkoBusy=false;record("plinko",wager,win);},1200);}

const wheelMultipliers=[0,.5,1,2,0,3,1,10];
function spinPrizeWheel(){if(prizewheelBusy)return;const wager=Number($("#prizewheel-wager").value);if(!canPay(wager))return;prizewheelBusy=true;state.credits-=wager;renderHeader();const index=Math.floor(Math.random()*8),mult=wheelMultipliers[index],wheel=$("#prize-wheel"),turns=5+Math.floor(Math.random()*3),degrees=turns*360-index*45;wheel.style.transform=`rotate(${degrees}deg)`;$("#prizewheel-message").textContent="Wheel spinning…";setTimeout(()=>{const win=Math.round(wager*mult*(1+state.upgrades.payout*.05));$("#prizewheel-message").textContent=`The wheel landed on ${mult}×${win?` · You won ${fmt(win)}!`:" · No prize."}`;prizewheelBusy=false;record("prizewheel",wager,win);},2200);}

function playRussian(){if(russianBusy)return;const wager=Number($("#russian-wager").value);if(!canPay(wager))return;russianBusy=true;state.credits-=wager;renderHeader();const chamber=$("#chamber");chamber.classList.add("spinning");$("#russian-message").textContent="The chamber spins…";setTimeout(()=>{const safe=Math.random()>=1/6,win=safe?Math.round(wager*1.18*(1+state.upgrades.payout*.05)):0;chamber.classList.remove("spinning");chamber.classList.toggle("bang",!safe);$("#russian-message").textContent=safe?`Click — safe. You won ${fmt(win)} credits!`:"Bang — the house takes the wager.";setTimeout(()=>chamber.classList.remove("bang"),650);russianBusy=false;record("russian",wager,win);},1100);}

const lotteryTickets=[
  {id:"match",name:"Triple Match",icon:"🍀",price:25,tag:"Scratch & match",desc:"Reveal three symbols. A pair pays 2×; three of a kind pays 8×."},
  {id:"multiplier",name:"Multiplier Mania",icon:"⚡",price:50,tag:"Boost your prize",desc:"Reveal a base prize, then flip a random multiplier from 1× to 10×."},
  {id:"pick",name:"Pick Three",icon:"🔢",price:75,tag:"Choose your lucky number",desc:"Pick 1–9, then draw three balls. Every match improves the payout."},
  {id:"vault",name:"Five Vaults",icon:"🔐",price:100,tag:"One shot jackpot",desc:"Choose one vault. Find cash, a dud, or the rare 2,000-credit jackpot."}
];
function renderLottery(){$("#ticket-count").textContent=fmt(state.stats.lottery);$("#ticket-grid").innerHTML=lotteryTickets.map(t=>`<article class="ticket-option"><div>${t.icon}</div><span>${t.tag}</span><h3>${t.name}</h3><p>${t.desc}</p><button class="primary" data-ticket="${t.id}">Play for ${fmt(t.price)}</button></article>`).join("");$$('[data-ticket]').forEach(b=>b.onclick=()=>buyTicket(b.dataset.ticket));}
function buyTicket(id){const t=lotteryTickets.find(x=>x.id===id);if(!canPay(t.price))return;if(id==="pick")return showPickTicket(t);if(id==="vault")return showVaultTicket(t);state.credits-=t.price;renderHeader();if(id==="match")playMatch(t);else playMultiplier(t);}
function settleTicket(t,win,message){$("#ticket-stage").querySelector(".ticket-result").innerHTML=message+`<strong>${win?`You won ${fmt(win)} credits!`:"No prize this time."}</strong><button class="secondary" data-replay="${t.id}">Play again</button>`;$("[data-replay]").onclick=()=>buyTicket(t.id);record("lottery",t.price,win);renderLottery();}
function ticketShell(t,content){$("#ticket-stage").innerHTML=`<div class="live-ticket"><div class="ticket-head"><span>${t.icon}</span><div><small>${t.tag}</small><h2>${t.name}</h2></div><b>${fmt(t.price)}</b></div>${content}<div class="ticket-result"></div></div>`;}
function playMatch(t){const pool=["🍒","⭐","💎","7","🍀"],r=[0,0,0].map(()=>pool[Math.floor(Math.random()*pool.length)]);ticketShell(t,`<div class="scratch-row">${r.map(x=>`<i>${x}</i>`).join("")}</div>`);const same=new Set(r).size,win=same===1?t.price*8:same===2?t.price*2:0;setTimeout(()=>settleTicket(t,win,`<p>${same===1?"Triple match!":same===2?"You found a pair.":"All three were different."}</p>`),350);}
function playMultiplier(t){const bases=[0,10,20,25,50,100],mults=[1,1,1,2,2,3,5,10],base=bases[Math.floor(Math.random()*bases.length)],mult=mults[Math.floor(Math.random()*mults.length)];ticketShell(t,`<div class="multiplier-reveal"><div><small>Prize</small><b>${base}</b></div><span>×</span><div><small>Boost</small><b>${mult}×</b></div></div>`);setTimeout(()=>settleTicket(t,base*mult,`<p>${base} credits boosted by ${mult}×.</p>`),350);}
function showPickTicket(t){ticketShell(t,`<p class="ticket-prompt">Choose your lucky number</p><div class="pick-grid">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-pick="${n}">${n}</button>`).join("")}</div>`);$$('[data-pick]').forEach(b=>b.onclick=()=>playPick(t,Number(b.dataset.pick)));}
function playPick(t,pick){state.credits-=t.price;renderHeader();const balls=[0,0,0].map(()=>1+Math.floor(Math.random()*9)),matches=balls.filter(n=>n===pick).length,pays=[0,2,6,25];$(".pick-grid").innerHTML=balls.map(n=>`<i class="ball ${n===pick?"match":""}">${n}</i>`).join("");settleTicket(t,t.price*pays[matches],`<p>You picked ${pick} and matched ${matches} ball${matches===1?"":"s"}.</p>`);}
function showVaultTicket(t){ticketShell(t,`<p class="ticket-prompt">One vault holds the jackpot. Choose carefully.</p><div class="vault-grid">${[1,2,3,4,5].map(n=>`<button data-vault="${n}">🔒<small>Vault ${n}</small></button>`).join("")}</div>`);$$('[data-vault]').forEach(b=>b.onclick=()=>playVault(t,Number(b.dataset.vault)));}
function playVault(t,choice){state.credits-=t.price;renderHeader();const prizes=[0,50,100,250,2000].sort(()=>Math.random()-.5),win=prizes[choice-1];$$('[data-vault]').forEach((b,i)=>{b.disabled=true;b.innerHTML=`${prizes[i]?"💰":"🕸️"}<small>${fmt(prizes[i])}</small>`;b.classList.toggle("chosen",i===choice-1);});settleTicket(t,win,`<p>Vault ${choice} contained ${fmt(win)} credits.</p>`);}

function renderShop(filter="all"){
  $("#shop-balance").textContent=`${fmt(state.credits)} credits`;$("#owned-count").textContent=`${state.inventory.length-1} collectibles owned`;
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
function renderProfile(){const marks=[25,100,250,500,1000],names=["Getting Started","Casino Regular","High Roller","VIP Legend","Casino Royalty"],next=marks[state.milestone];$("#profile-title").textContent=state.level>=10?"Casino Veteran":state.level>=5?"Club Regular":"Rising Player";$("#milestone-name").textContent=next?names[state.milestone]:"All milestones complete";$("#milestone-copy").textContent=next?`${state.stats.plays} / ${next} total games`:"You conquered the club.";$("#milestone-bar").style.width=next?`${Math.min(100,state.stats.plays/next*100)}%`:"100%";const data=[["Games played",state.stats.plays],["Games won",state.stats.wins],["Win rate",state.stats.plays?`${Math.round(state.stats.wins/state.stats.plays*100)}%`:"0%"],["Credits wagered",fmt(state.stats.wagered)],["Credits won",fmt(state.stats.won)],["Best win",fmt(state.stats.bestWin)],["Slot spins",state.stats.slots],["Roulette spins",state.stats.roulette],["Blackjack hands",state.stats.blackjack],["Baccarat hands",state.stats.baccarat],["Plinko drops",state.stats.plinko],["Prize wheel spins",state.stats.prizewheel],["Russian roulette",state.stats.russian]];$("#stats-grid").innerHTML=data.map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");}
function renderDaily(){const claimed=state.daily.last===today();$("#daily-claim").disabled=claimed;$("#daily-claim").textContent=claimed?"Claimed ✓":"Claim reward";$("#daily-streak").textContent=`Day ${Math.max(1,state.daily.streak)} streak`;$("#daily-note").textContent=claimed?"Next reward tomorrow":"Up to 1,000 credits";}
function renderAll(){renderHeader();renderDaily();$("#shop-badge").textContent=state.level>=3?"New":"";ensureDaily();const ready=quests.filter(q=>questProgress(q)>=q.goal&&!state.quests.claimed.includes(q.id)).length;$("#quest-badge").textContent=ready||"";if(state.gameOver)$("#gameover").classList.add("open");}

$$(".nav-btn").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$$(".high-wager").forEach(s=>s.innerHTML=WAGERS.map(v=>`<option value="${v}" ${v===25?"selected":""}>${fmt(v)}</option>`).join(""));
$$("#slot-bets button").forEach(b=>b.onclick=()=>{slotBet=Number(b.dataset.bet);$$("#slot-bets button").forEach(x=>x.classList.toggle("active",x===b));});
$("#spin-button").onclick=spin;$("#auto-spin").onclick=()=>{if(!state.upgrades.auto)return toast("Unlock Auto-Spin in the shop.");if(autoTimer)stopAuto();else{$("#auto-status").textContent="On";$("#auto-spin").classList.add("active");autoTimer=setTimeout(spin,100);}};
$("#roulette-spin").onclick=rouletteSpin;$("#deal-button").onclick=deal;$("#hit-button").onclick=hit;$("#stand-button").onclick=finishBlackjack;
$$("#baccarat-choice button").forEach(b=>b.onclick=()=>{baccaratChoice=b.dataset.choice;$$("#baccarat-choice button").forEach(x=>x.classList.toggle("selected",x===b));});
$("#baccarat-deal").onclick=dealBaccarat;$("#plinko-drop").onclick=dropPlinko;$("#prizewheel-spin").onclick=spinPrizeWheel;$("#russian-fire").onclick=playRussian;
$("#sound-toggle").onclick=()=>{state.sound=!state.sound;save();renderHeader();};
$("#open-cashier").onclick=openCashier;$("#close-cashier").onclick=closeCashier;$("#cashier-modal").onclick=e=>{if(e.target===$("#cashier-modal"))closeCashier();};$("#borrow-500").onclick=borrow;$("#repay-500").onclick=repay;
$("#new-run").onclick=()=>{localStorage.removeItem(SAVE_KEY);location.reload();};
$("#daily-claim").onclick=()=>{if(state.daily.last===today())return;const yesterday=new Date(Date.now()-864e5).toISOString().slice(0,10);state.daily.streak=state.daily.last===yesterday?state.daily.streak+1:1;const reward=Math.min(1000,200+state.daily.streak*100);state.daily.last=today();state.credits+=reward;addXp(40);toast(`Daily reward: +${fmt(reward)} credits`);save();renderAll();};
$$("#shop-filters button").forEach(b=>b.onclick=()=>{$$("#shop-filters button").forEach(x=>x.classList.toggle("active",x===b));renderShop(b.dataset.filter);});
$("#reset-save").onclick=()=>{if(confirm("Reset all credits, levels, unlocks, and statistics? This cannot be undone.")){localStorage.removeItem(SAVE_KEY);location.reload();}};
document.addEventListener("keydown",e=>{if(e.code==="Space"&&!e.repeat&&$("#slots-view").classList.contains("active")){e.preventDefault();spin();}});
$("#blackjack-view .view-heading p").textContent="A = 1 · Number cards use face value · J = 11 · Q = 12 · K = 13 · No jokers.";
setupRoulette();setupPlinko();renderAll();renderShop();renderLottery();renderQuests();
