"use strict";

// Game configuration is kept in one place for easy balancing.
const STARTING_CREDITS = 1000;
const DEFAULT_BET = 25;
const STORAGE_KEY = "golden-fortune-slots";
const SYMBOLS = ["🍒", "🍋", "🔔", "💎", "⭐", "7️⃣"];
const SYMBOL_WEIGHTS = [24, 22, 18, 15, 13, 8];

const creditsElement = document.querySelector("#credits");
const currentBetElement = document.querySelector("#current-bet");
const messageElement = document.querySelector("#message");
const spinButton = document.querySelector("#spin-button");
const betButtons = [...document.querySelectorAll(".bet-button")];
const reels = [...document.querySelectorAll(".reel")];
const machine = document.querySelector(".machine");

let credits = STARTING_CREDITS;
let currentBet = DEFAULT_BET;
let isSpinning = false;

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);

// Restore only valid values so malformed storage cannot break the game.
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const validBets = betButtons.map((button) => Number(button.dataset.bet));

    if (Number.isFinite(saved?.credits) && saved.credits >= 0) {
      credits = saved.credits;
    }

    if (validBets.includes(saved?.currentBet)) {
      currentBet = saved.currentBet;
    }
  } catch {
    // A fresh game is safer than failing when browser storage is unavailable.
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ credits, currentBet }));
  } catch {
    // The game remains playable when storage is disabled.
  }
}

function updateDisplay() {
  creditsElement.textContent = formatMoney(credits);
  currentBetElement.textContent = formatMoney(currentBet);

  betButtons.forEach((button) => {
    const selected = Number(button.dataset.bet) === currentBet;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected);
  });

  spinButton.disabled = isSpinning || credits < currentBet;
}

function showMessage(text, type = "") {
  messageElement.textContent = text;
  messageElement.className = `message ${type}`.trim();
}

// Weighted selection makes rare symbols—and therefore jackpots—feel special.
function getRandomSymbol() {
  const totalWeight = SYMBOL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (let index = 0; index < SYMBOLS.length; index += 1) {
    roll -= SYMBOL_WEIGHTS[index];
    if (roll < 0) return SYMBOLS[index];
  }

  return SYMBOLS[0];
}

function calculatePayout(results) {
  const [first, second, third] = results;
  const allMatch = first === second && second === third;
  const twoMatch = first === second || first === third || second === third;

  if (allMatch && first === "7️⃣") {
    return { multiplier: 25, label: "JACKPOT! Triple sevens", jackpot: true };
  }

  if (allMatch && first === "⭐") {
    return { multiplier: 10, label: "Triple stars", jackpot: false };
  }

  if (allMatch) {
    return { multiplier: 5, label: "Three of a kind", jackpot: false };
  }

  if (twoMatch) {
    return { multiplier: 2, label: "Two symbols matched", jackpot: false };
  }

  return { multiplier: 0, label: "", jackpot: false };
}

function stopReel(reel, symbol, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      reel.classList.remove("spinning");
      reel.querySelector("span").textContent = symbol;
      reel.classList.add("stopping");

      setTimeout(() => {
        reel.classList.remove("stopping");
        resolve();
      }, 300);
    }, delay);
  });
}

async function spin() {
  if (isSpinning) return;

  if (credits < currentBet) {
    showMessage(`You need ${formatMoney(currentBet)} to spin.`, "error");
    return;
  }

  isSpinning = true;
  credits -= currentBet;
  machine.classList.remove("big-win");
  showMessage("The reels are spinning…");
  betButtons.forEach((button) => { button.disabled = true; });
  reels.forEach((reel) => reel.classList.add("spinning"));
  updateDisplay();
  saveProgress();

  const results = reels.map(() => getRandomSymbol());
  await Promise.all(
    reels.map((reel, index) => stopReel(reel, results[index], 850 + index * 420))
  );

  const payout = calculatePayout(results);
  const winnings = currentBet * payout.multiplier;

  if (winnings > 0) {
    credits += winnings;
    showMessage(`${payout.label} — you won ${formatMoney(winnings)}!`, payout.jackpot ? "jackpot" : "win");
    if (payout.multiplier >= 10) machine.classList.add("big-win");
  } else {
    showMessage(`No match — ${formatMoney(currentBet)} lost. Try again!`);
  }

  isSpinning = false;
  betButtons.forEach((button) => { button.disabled = false; });
  updateDisplay();
  saveProgress();

  if (credits < Math.min(...betButtons.map((button) => Number(button.dataset.bet)))) {
    showMessage("You’re out of credits. Clear site data to start a new game.", "error");
  } else if (credits < currentBet) {
    showMessage("Not enough for that bet—choose a lower amount.", "error");
  }
}

betButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isSpinning) return;
    currentBet = Number(button.dataset.bet);
    showMessage(
      credits >= currentBet
        ? `${formatMoney(currentBet)} bet selected. Good luck!`
        : `You need ${formatMoney(currentBet)} to place that bet.`,
      credits >= currentBet ? "" : "error"
    );
    updateDisplay();
    saveProgress();
  });
});

spinButton.addEventListener("click", spin);

loadProgress();
updateDisplay();
