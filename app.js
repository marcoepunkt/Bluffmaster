import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDInWVXEV8AUUBTsc2s0_ZSPnr-A1JeV8c",
  authDomain: "bluffmaster-49131.firebaseapp.com",
  projectId: "bluffmaster-49131",
  storageBucket: "bluffmaster-49131.firebasestorage.app",
  messagingSenderId: "852222010652",
  appId: "1:852222010652:web:ff832ff870a9380ab1c6d9"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const RANKING = [
  "31","32","41","42","43","51","52","53","54",
  "61","62","63","64","65","11","22","33","44","55","66","21"
];

const screens = {
  home: document.getElementById("homeScreen"),
  join: document.getElementById("joinScreen"),
  lobby: document.getElementById("lobbyScreen"),
  game: document.getElementById("gameScreen")
};

const $ = (id) => document.getElementById(id);

const playerNameInput = $("playerName");
const roomCodeInput = $("roomCodeInput");
const createRoomButton = $("createRoomButton");
const openJoinButton = $("openJoinButton");
const joinRoomButton = $("joinRoomButton");
const startOnlineGameButton = $("startOnlineGameButton");
const leaveRoomButton = $("leaveRoomButton");
const leaveGameButton = $("leaveGameButton");
const homeMessage = $("homeMessage");
const joinMessage = $("joinMessage");
const lobbyMessage = $("lobbyMessage");
const gameMessage = $("gameMessage");
const lobbyTitle = $("lobbyTitle");
const roomCodeDisplay = $("roomCodeDisplay");
const connectionBadge = $("connectionBadge");
const playersList = $("playersList");
const playerCount = $("playerCount");
const guestWaitingText = $("guestWaitingText");
const gameRoomCode = $("gameRoomCode");
const gameStatusTitle = $("gameStatusTitle");
const turnPlayerText = $("turnPlayerText");
const phaseText = $("phaseText");
const rollPanel = $("rollPanel");
const diceArea = $("diceArea");
const die1 = $("die1");
const die2 = $("die2");
const realRollText = $("realRollText");
const rollButton = $("rollButton");
const claimArea = $("claimArea");
const claimSelect = $("claimSelect");
const submitClaimButton = $("submitClaimButton");
const decisionPanel = $("decisionPanel");
const lastClaimText = $("lastClaimText");
const lastClaimerText = $("lastClaimerText");
const believeButton = $("believeButton");
const challengeButton = $("challengeButton");
const waitingPanel = $("waitingPanel");
const waitingText = $("waitingText");
const resultPanel = $("resultPanel");
const resultIcon = $("resultIcon");
const resultTitle = $("resultTitle");
const resultClaim = $("resultClaim");
const resultRoll = $("resultRoll");
const resultExplanation = $("resultExplanation");
const nextRoundButton = $("nextRoundButton");
const winnerPanel = $("winnerPanel");
const winnerText = $("winnerText");
const rematchButton = $("rematchButton");
const openScoreButton = $("openScoreButton");
const scoreDialog = $("scoreDialog");
const closeScoreButton = $("closeScoreButton");
const scoreList = $("scoreList");

let currentUser = null;
let currentRoomCode = "";
let currentPlayerName = "";
let isHost = false;
let roomState = null;
let players = [];
let privateRoll = null;
let stopRoomListener = null;
let stopPlayersListener = null;
let stopPrivateListener = null;
let revealHandledForVersion = null;

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMessage(element, text = "", type = "") {
  element.textContent = text;
  element.className = "message";
  if (type) element.classList.add(type);
}

function playerName() {
  return playerNameInput.value.trim();
}

function validateName() {
  const name = playerName();
  if (name.length < 2) {
    setMessage(homeMessage, "Bitte gib einen Namen mit mindestens zwei Zeichen ein.", "error");
    return null;
  }
  return name;
}

function randomRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function rollValue(a, b) {
  return `${Math.max(a, b)}${Math.min(a, b)}`;
}

function valueText(value) {
  if (value === "21") return "Mäxchen";
  if (value?.[0] === value?.[1]) return `Pasch ${value}`;
  return value || "–";
}

function rank(value) {
  return RANKING.indexOf(value);
}

function playerByUid(uid) {
  return players.find((player) => player.uid === uid);
}

function alivePlayers() {
  return players.filter((player) => player.lives > 0);
}

function nextAliveUid(fromUid) {
  if (!players.length) return fromUid;
  const start = players.findIndex((player) => player.uid === fromUid);

  for (let step = 1; step <= players.length; step += 1) {
    const candidate = players[(start + step) % players.length];
    if (candidate?.lives > 0) return candidate.uid;
  }

  return fromUid;
}

async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  currentUser = result.user;
  return result.user;
}

async function unusedRoomCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomRoomCode();
    if (!(await getDoc(doc(db, "rooms", code))).exists()) return code;
  }
  throw new Error("Kein freier Raumcode verfügbar.");
}

async function createRoom() {
  const name = validateName();
  if (!name) return;

  createRoomButton.disabled = true;
  setMessage(homeMessage, "Raum wird erstellt …");

  try {
    const user = await ensureSignedIn();
    const code = await unusedRoomCode();

    await setDoc(doc(db, "rooms", code), {
      code,
      hostUid: user.uid,
      status: "lobby",
      phase: "lobby",
      maxPlayers: 8,
      createdAt: serverTimestamp(),
      version: 0
    });

    await setDoc(doc(db, "rooms", code, "players", user.uid), {
      uid: user.uid,
      name,
      lives: 3,
      joinedAt: serverTimestamp()
    });

    enterRoom(code, name, true);
  } catch (error) {
    console.error(error);
    setMessage(homeMessage, "Raum konnte nicht erstellt werden.", "error");
  } finally {
    createRoomButton.disabled = false;
  }
}

async function joinRoom() {
  const name = playerName();
  const code = roomCodeInput.value.replace(/\D/g, "").slice(0, 6);

  if (name.length < 2) {
    showScreen("home");
    setMessage(homeMessage, "Bitte gib zuerst deinen Namen ein.", "error");
    return;
  }

  if (code.length !== 6) {
    setMessage(joinMessage, "Bitte gib alle sechs Ziffern ein.", "error");
    return;
  }

  joinRoomButton.disabled = true;
  setMessage(joinMessage, "Raum wird gesucht …");

  try {
    const user = await ensureSignedIn();
    const roomSnap = await getDoc(doc(db, "rooms", code));

    if (!roomSnap.exists()) {
      setMessage(joinMessage, "Raum nicht gefunden.", "error");
      return;
    }

    const room = roomSnap.data();
    if (room.status !== "lobby") {
      setMessage(joinMessage, "Dieses Spiel läuft bereits.", "error");
      return;
    }

    await setDoc(doc(db, "rooms", code, "players", user.uid), {
      uid: user.uid,
      name,
      lives: 3,
      joinedAt: serverTimestamp()
    });

    enterRoom(code, name, room.hostUid === user.uid);
  } catch (error) {
    console.error(error);
    setMessage(joinMessage, "Beitritt fehlgeschlagen.", "error");
  } finally {
    joinRoomButton.disabled = false;
  }
}

function enterRoom(code, name, host) {
  currentRoomCode = code;
  currentPlayerName = name;
  isHost = host;
  gameRoomCode.textContent = code;
  roomCodeDisplay.textContent = code;
  lobbyTitle.textContent = host ? "Dein Raum" : "Spielraum";
  startOnlineGameButton.classList.toggle("hidden", !host);
  guestWaitingText.classList.toggle("hidden", host);
  rematchButton.classList.toggle("hidden", !host);
  nextRoundButton.classList.toggle("hidden", !host);
  listen();
  showScreen("lobby");
}

function listen() {
  cleanupListeners();

  stopRoomListener = onSnapshot(
    doc(db, "rooms", currentRoomCode),
    async (snapshot) => {
      if (!snapshot.exists()) {
        cleanupListeners();
        showScreen("home");
        setMessage(homeMessage, "Der Raum wurde geschlossen.", "error");
        return;
      }

      roomState = snapshot.data();
      isHost = roomState.hostUid === auth.currentUser?.uid;
      connectionBadge.textContent = "Online";
      connectionBadge.classList.add("online");

      if (roomState.status === "lobby") {
        showScreen("lobby");
      } else {
        showScreen("game");
        await maybeRevealRequestedRoll();
        renderGame();
      }
    },
    (error) => {
      console.error(error);
      setMessage(gameMessage, "Live-Verbindung unterbrochen.", "error");
    }
  );

  stopPlayersListener = onSnapshot(
    collection(db, "rooms", currentRoomCode, "players"),
    (snapshot) => {
      players = snapshot.docs
        .map((item) => item.data())
        .sort((a, b) => (a.joinedAt?.seconds ?? 0) - (b.joinedAt?.seconds ?? 0));

      renderPlayers();
      renderGame();
    }
  );

  stopPrivateListener = onSnapshot(
    doc(db, "rooms", currentRoomCode, "privateRolls", auth.currentUser.uid),
    (snapshot) => {
      privateRoll = snapshot.exists() ? snapshot.data() : null;
      renderGame();
    }
  );
}

function renderPlayers() {
  playerCount.textContent = `${players.length}/8`;
  startOnlineGameButton.disabled = players.length < 2;
  playersList.innerHTML = "";
  scoreList.innerHTML = "";

  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "playerRow";

    const name = document.createElement("span");
    name.className = "playerName";
    name.textContent = player.name;

    const meta = document.createElement("span");
    meta.className = "playerMeta";
    meta.textContent = `${"❤️".repeat(Math.max(0, player.lives))}${player.uid === auth.currentUser?.uid ? " · Du" : ""}`;

    row.append(name, meta);
    playersList.appendChild(row);
    scoreList.appendChild(row.cloneNode(true));
  });
}

async function startGame() {
  if (!isHost || players.length < 2) return;

  const batch = writeBatch(db);
  players.forEach((player) => {
    batch.update(doc(db, "rooms", currentRoomCode, "players", player.uid), { lives: 3 });
  });

  batch.update(doc(db, "rooms", currentRoomCode), {
    status: "playing",
    phase: "waiting_roll",
    currentPlayerUid: players[0].uid,
    roundStarterUid: players[0].uid,
    lastClaim: "",
    lastClaimerUid: null,
    lastRollOwnerUid: null,
    challengerUid: null,
    revealedRoll: null,
    roundLoserUid: null,
    winnerUid: null,
    version: (roomState?.version ?? 0) + 1
  });

  await batch.commit();
}

function hideGamePanels() {
  rollPanel.classList.add("hidden");
  decisionPanel.classList.add("hidden");
  waitingPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  winnerPanel.classList.add("hidden");
}

function renderGame() {
  if (!roomState || roomState.status === "lobby") return;

  hideGamePanels();

  const me = auth.currentUser?.uid;
  const current = playerByUid(roomState.currentPlayerUid);
  turnPlayerText.textContent = current ? `${current.name} ist am Zug` : "Spiel wird vorbereitet";
  phaseText.textContent = "";

  if (roomState.phase === "waiting_roll") {
    gameStatusTitle.textContent = "Würfeln";
    phaseText.textContent = roomState.currentPlayerUid === me ? "Du bist dran." : "Warte auf den aktuellen Spieler.";

    if (roomState.currentPlayerUid === me) {
      rollPanel.classList.remove("hidden");
      rollButton.classList.remove("hidden");
      claimArea.classList.add("hidden");

      if (privateRoll?.version === roomState.version) {
        showPrivateRoll();
      } else {
        diceArea.classList.add("hidden");
        realRollText.classList.add("hidden");
      }
    } else {
      waitingPanel.classList.remove("hidden");
      waitingText.textContent = `${current?.name ?? "Der Spieler"} würfelt gerade …`;
    }
  }

  if (roomState.phase === "waiting_claim") {
    gameStatusTitle.textContent = "Ansage";

    if (roomState.currentPlayerUid === me) {
      rollPanel.classList.remove("hidden");
      showPrivateRoll();
      fillClaims();
      claimArea.classList.remove("hidden");
      rollButton.classList.add("hidden");
    } else {
      waitingPanel.classList.remove("hidden");
      waitingText.textContent = `${current?.name ?? "Der Spieler"} wählt eine Ansage …`;
    }
  }

  if (roomState.phase === "decision") {
    gameStatusTitle.textContent = "Glauben oder anzweifeln";
    lastClaimText.textContent = valueText(roomState.lastClaim);
    lastClaimerText.textContent = `${playerByUid(roomState.lastClaimerUid)?.name ?? "Ein Spieler"} hat angesagt.`;

    if (roomState.currentPlayerUid === me) {
      decisionPanel.classList.remove("hidden");
      believeButton.classList.toggle("hidden", roomState.lastClaim === "21");
    } else {
      waitingPanel.classList.remove("hidden");
      waitingText.textContent = `${current?.name ?? "Der Spieler"} entscheidet …`;
    }
  }

  if (roomState.phase === "reveal_requested") {
    gameStatusTitle.textContent = "Wurf wird aufgedeckt";
    waitingPanel.classList.remove("hidden");
    waitingText.textContent = "Der letzte Spieler deckt seinen Wurf auf …";
  }

  if (roomState.phase === "round_result") {
    gameStatusTitle.textContent = "Rundenergebnis";
    resultPanel.classList.remove("hidden");
    const loser = playerByUid(roomState.roundLoserUid);
    const claimWasCovered = rank(roomState.revealedRoll) >= rank(roomState.lastClaim);

    resultIcon.textContent = claimWasCovered ? "✅" : "🤥";
    resultTitle.textContent = claimWasCovered ? "Ansage war gedeckt" : "Bluff aufgeflogen";
    resultClaim.textContent = valueText(roomState.lastClaim);
    resultRoll.textContent = valueText(roomState.revealedRoll);
    resultExplanation.textContent = `${loser?.name ?? "Ein Spieler"} verliert ein Leben.`;
    nextRoundButton.classList.toggle("hidden", !isHost);
  }

  if (roomState.phase === "game_over") {
    gameStatusTitle.textContent = "Spiel beendet";
    winnerPanel.classList.remove("hidden");
    winnerText.textContent = playerByUid(roomState.winnerUid)?.name ?? "Gewinner";
    rematchButton.classList.toggle("hidden", !isHost);
  }
}

function showPrivateRoll() {
  if (!privateRoll) return;
  die1.textContent = DICE[privateRoll.die1 - 1];
  die2.textContent = DICE[privateRoll.die2 - 1];
  diceArea.classList.remove("hidden");
  realRollText.textContent = `Dein Wurf: ${valueText(privateRoll.value)}`;
  realRollText.classList.remove("hidden");
}

function fillClaims() {
  const minimumIndex = roomState.lastClaim ? rank(roomState.lastClaim) + 1 : 0;
  const available = RANKING.slice(minimumIndex);
  claimSelect.innerHTML = "";

  available.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === privateRoll?.value
      ? `${valueText(value)} – dein Wurf`
      : valueText(value);
    claimSelect.appendChild(option);
  });

  if (available.includes(privateRoll?.value)) {
    claimSelect.value = privateRoll.value;
  }
}

async function rollDice() {
  if (roomState.currentPlayerUid !== auth.currentUser.uid || roomState.phase !== "waiting_roll") return;

  rollButton.disabled = true;
  die1.classList.remove("rolling");
  die2.classList.remove("rolling");
  void die1.offsetWidth;
  die1.classList.add("rolling");
  die2.classList.add("rolling");

  const a = Math.floor(Math.random() * 6) + 1;
  const b = Math.floor(Math.random() * 6) + 1;
  const value = rollValue(a, b);

  await setDoc(doc(db, "rooms", currentRoomCode, "privateRolls", auth.currentUser.uid), {
    ownerUid: auth.currentUser.uid,
    die1: a,
    die2: b,
    value,
    version: roomState.version,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "waiting_claim",
    lastRollOwnerUid: auth.currentUser.uid
  });

  rollButton.disabled = false;
}

async function submitClaim() {
  const claim = claimSelect.value;
  if (!claim) return;

  const nextUid = nextAliveUid(auth.currentUser.uid);

  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "decision",
    lastClaim: claim,
    lastClaimerUid: auth.currentUser.uid,
    currentPlayerUid: nextUid
  });
}

async function believe() {
  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "waiting_roll",
    version: (roomState.version ?? 0) + 1
  });
}

async function challenge() {
  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "reveal_requested",
    challengerUid: auth.currentUser.uid,
    revealVersion: (roomState.version ?? 0) + 1
  });
}

async function maybeRevealRequestedRoll() {
  if (
    roomState?.phase !== "reveal_requested" ||
    roomState.lastRollOwnerUid !== auth.currentUser?.uid ||
    revealHandledForVersion === roomState.revealVersion
  ) return;

  revealHandledForVersion = roomState.revealVersion;

  const privateSnap = await getDoc(
    doc(db, "rooms", currentRoomCode, "privateRolls", auth.currentUser.uid)
  );

  if (!privateSnap.exists()) return;

  const roll = privateSnap.data();
  const claimWasCovered = rank(roll.value) >= rank(roomState.lastClaim);
  const loserUid = claimWasCovered ? roomState.challengerUid : roomState.lastClaimerUid;
  const loser = playerByUid(loserUid);
  const newLives = Math.max(0, (loser?.lives ?? 1) - 1);

  const batch = writeBatch(db);
  batch.update(doc(db, "rooms", currentRoomCode, "players", loserUid), {
    lives: newLives
  });

  const remaining = players.filter((player) => {
    if (player.uid === loserUid) return newLives > 0;
    return player.lives > 0;
  });

  if (remaining.length === 1) {
    batch.update(doc(db, "rooms", currentRoomCode), {
      phase: "game_over",
      revealedRoll: roll.value,
      roundLoserUid: loserUid,
      winnerUid: remaining[0].uid
    });
  } else {
    batch.update(doc(db, "rooms", currentRoomCode), {
      phase: "round_result",
      revealedRoll: roll.value,
      roundLoserUid: loserUid
    });
  }

  await batch.commit();
}

async function nextRound() {
  if (!isHost || roomState.phase !== "round_result") return;

  const loserStillAlive = playerByUid(roomState.roundLoserUid)?.lives > 0;
  const starterUid = loserStillAlive
    ? roomState.roundLoserUid
    : nextAliveUid(roomState.roundLoserUid);

  await updateDoc(doc(db, "rooms", currentRoomCode), {
    phase: "waiting_roll",
    currentPlayerUid: starterUid,
    roundStarterUid: starterUid,
    lastClaim: "",
    lastClaimerUid: null,
    lastRollOwnerUid: null,
    challengerUid: null,
    revealedRoll: null,
    roundLoserUid: null,
    version: (roomState.version ?? 0) + 1
  });
}

async function rematch() {
  if (!isHost) return;
  await startGame();
}

async function leaveRoom() {
  if (!currentRoomCode || !auth.currentUser) {
    showScreen("home");
    return;
  }

  try {
    await deleteDoc(doc(db, "rooms", currentRoomCode, "players", auth.currentUser.uid));
    await deleteDoc(doc(db, "rooms", currentRoomCode, "privateRolls", auth.currentUser.uid));

    if (isHost) {
      const playerDocs = await getDocs(collection(db, "rooms", currentRoomCode, "players"));
      const privateDocs = await getDocs(collection(db, "rooms", currentRoomCode, "privateRolls"));
      const batch = writeBatch(db);
      playerDocs.forEach((item) => batch.delete(item.ref));
      privateDocs.forEach((item) => batch.delete(item.ref));
      batch.delete(doc(db, "rooms", currentRoomCode));
      await batch.commit();
    }
  } catch (error) {
    console.error(error);
  } finally {
    cleanupListeners();
    currentRoomCode = "";
    roomState = null;
    players = [];
    privateRoll = null;
    showScreen("home");
  }
}

function cleanupListeners() {
  stopRoomListener?.();
  stopPlayersListener?.();
  stopPrivateListener?.();
  stopRoomListener = null;
  stopPlayersListener = null;
  stopPrivateListener = null;
}

createRoomButton.addEventListener("click", createRoom);
openJoinButton.addEventListener("click", () => {
  if (!validateName()) return;
  showScreen("join");
  roomCodeInput.focus();
});
joinRoomButton.addEventListener("click", joinRoom);
startOnlineGameButton.addEventListener("click", startGame);
rollButton.addEventListener("click", rollDice);
submitClaimButton.addEventListener("click", submitClaim);
believeButton.addEventListener("click", believe);
challengeButton.addEventListener("click", challenge);
nextRoundButton.addEventListener("click", nextRound);
rematchButton.addEventListener("click", rematch);
leaveRoomButton.addEventListener("click", leaveRoom);
leaveGameButton.addEventListener("click", leaveRoom);

document.querySelectorAll("[data-back='home']").forEach((button) => {
  button.addEventListener("click", () => showScreen("home"));
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.replace(/\D/g, "").slice(0, 6);
});

roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom();
});

openScoreButton.addEventListener("click", () => scoreDialog.showModal());
closeScoreButton.addEventListener("click", () => scoreDialog.close());
scoreDialog.addEventListener("click", (event) => {
  if (event.target === scoreDialog) scoreDialog.close();
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

window.addEventListener("beforeunload", cleanupListeners);
