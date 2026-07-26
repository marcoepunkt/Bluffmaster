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
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
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

const screens = {
  home: document.getElementById("homeScreen"),
  join: document.getElementById("joinScreen"),
  lobby: document.getElementById("lobbyScreen"),
  game: document.getElementById("gameScreen"),
  offline: document.getElementById("offlineScreen")
};

const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCodeInput");

const createRoomButton = document.getElementById("createRoomButton");
const openJoinButton = document.getElementById("openJoinButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const offlineButton = document.getElementById("offlineButton");
const startOnlineGameButton = document.getElementById("startOnlineGameButton");
const leaveRoomButton = document.getElementById("leaveRoomButton");
const backToLobbyButton = document.getElementById("backToLobbyButton");

const homeMessage = document.getElementById("homeMessage");
const joinMessage = document.getElementById("joinMessage");
const lobbyMessage = document.getElementById("lobbyMessage");

const lobbyTitle = document.getElementById("lobbyTitle");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const connectionBadge = document.getElementById("connectionBadge");
const playersList = document.getElementById("playersList");
const playerCount = document.getElementById("playerCount");
const guestWaitingText = document.getElementById("guestWaitingText");
const gameReadyText = document.getElementById("gameReadyText");

let currentUser = null;
let currentRoomCode = "";
let currentPlayerName = "";
let isHost = false;
let stopRoomListener = null;
let stopPlayersListener = null;

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMessage(element, text = "", type = "") {
  element.textContent = text;
  element.className = "message";
  if (type) {
    element.classList.add(type);
  }
}

function getPlayerName() {
  return playerNameInput.value.trim();
}

function validatePlayerName() {
  const name = getPlayerName();

  if (name.length < 2) {
    setMessage(homeMessage, "Bitte gib einen Namen mit mindestens zwei Zeichen ein.", "error");
    return null;
  }

  return name;
}

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureSignedIn() {
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return currentUser;
  }

  const result = await signInAnonymously(auth);
  currentUser = result.user;
  return currentUser;
}

async function findUnusedRoomCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeRoomCode();
    const roomSnapshot = await getDoc(doc(db, "rooms", code));

    if (!roomSnapshot.exists()) {
      return code;
    }
  }

  throw new Error("Es konnte kein freier Raumcode erstellt werden.");
}

async function createRoom() {
  const name = validatePlayerName();
  if (!name) return;

  createRoomButton.disabled = true;
  setMessage(homeMessage, "Raum wird erstellt …");

  try {
    const user = await ensureSignedIn();
    const code = await findUnusedRoomCode();

    await setDoc(doc(db, "rooms", code), {
      code,
      hostUid: user.uid,
      status: "lobby",
      maxPlayers: 8,
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "rooms", code, "players", user.uid), {
      uid: user.uid,
      name,
      lives: 3,
      joinedAt: serverTimestamp()
    });

    enterLobby({
      code,
      name,
      host: true
    });
  } catch (error) {
    console.error(error);
    setMessage(
      homeMessage,
      "Der Raum konnte nicht erstellt werden. Prüfe Firebase und deine Internetverbindung.",
      "error"
    );
  } finally {
    createRoomButton.disabled = false;
  }
}

async function joinRoom() {
  const name = getPlayerName();
  const code = roomCodeInput.value.replace(/\D/g, "").slice(0, 6);

  if (name.length < 2) {
    showScreen("home");
    setMessage(homeMessage, "Bitte gib zuerst deinen Spielernamen ein.", "error");
    return;
  }

  if (code.length !== 6) {
    setMessage(joinMessage, "Bitte gib den vollständigen sechsstelligen Raumcode ein.", "error");
    return;
  }

  joinRoomButton.disabled = true;
  setMessage(joinMessage, "Raum wird gesucht …");

  try {
    const user = await ensureSignedIn();
    const roomRef = doc(db, "rooms", code);
    const roomSnapshot = await getDoc(roomRef);

    if (!roomSnapshot.exists()) {
      setMessage(joinMessage, "Dieser Raum wurde nicht gefunden.", "error");
      return;
    }

    const roomData = roomSnapshot.data();

    if (roomData.status !== "lobby") {
      setMessage(joinMessage, "Dieses Spiel wurde bereits gestartet.", "error");
      return;
    }

    await setDoc(doc(db, "rooms", code, "players", user.uid), {
      uid: user.uid,
      name,
      lives: 3,
      joinedAt: serverTimestamp()
    });

    enterLobby({
      code,
      name,
      host: roomData.hostUid === user.uid
    });
  } catch (error) {
    console.error(error);
    setMessage(joinMessage, "Beitritt fehlgeschlagen. Bitte versuche es erneut.", "error");
  } finally {
    joinRoomButton.disabled = false;
  }
}

function enterLobby({ code, name, host }) {
  currentRoomCode = code;
  currentPlayerName = name;
  isHost = host;

  lobbyTitle.textContent = host ? "Dein Raum" : "Spielraum";
  roomCodeDisplay.textContent = code;
  startOnlineGameButton.classList.toggle("hidden", !host);
  guestWaitingText.classList.toggle("hidden", host);

  setMessage(homeMessage);
  setMessage(joinMessage);
  setMessage(lobbyMessage);

  listenToRoom();
  listenToPlayers();
  showScreen("lobby");
}

function listenToRoom() {
  stopRoomListener?.();

  const roomRef = doc(db, "rooms", currentRoomCode);

  stopRoomListener = onSnapshot(
    roomRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        setMessage(lobbyMessage, "Der Raum wurde geschlossen.", "error");
        cleanupListeners();
        showScreen("home");
        return;
      }

      connectionBadge.textContent = "Online";
      connectionBadge.classList.add("online");

      const room = snapshot.data();

      if (room.status === "playing") {
        gameReadyText.textContent =
          `Raum ${currentRoomCode}: ${currentPlayerName} ist verbunden.`;
        showScreen("game");
      }

      if (room.status === "lobby" && !screens.lobby.classList.contains("hidden")) {
        showScreen("lobby");
      }
    },
    (error) => {
      console.error(error);
      connectionBadge.textContent = "Fehler";
      connectionBadge.classList.remove("online");
      setMessage(lobbyMessage, "Die Live-Verbindung wurde unterbrochen.", "error");
    }
  );
}

function listenToPlayers() {
  stopPlayersListener?.();

  const playersRef = collection(db, "rooms", currentRoomCode, "players");

  stopPlayersListener = onSnapshot(
    playersRef,
    (snapshot) => {
      const players = snapshot.docs
        .map((playerDoc) => playerDoc.data())
        .sort((a, b) => {
          const aTime = a.joinedAt?.seconds ?? 0;
          const bTime = b.joinedAt?.seconds ?? 0;
          return aTime - bTime;
        });

      playerCount.textContent = `${players.length}/8`;
      startOnlineGameButton.disabled = players.length < 2;
      playersList.innerHTML = "";

      players.forEach((player) => {
        const row = document.createElement("div");
        row.className = "playerRow";

        const name = document.createElement("span");
        name.className = "playerName";
        name.textContent = player.name;

        const meta = document.createElement("span");
        meta.className = "playerMeta";

        if (player.uid === auth.currentUser?.uid) {
          meta.textContent = "Du";
        } else {
          meta.textContent = "Verbunden";
        }

        row.append(name, meta);
        playersList.appendChild(row);
      });
    },
    (error) => {
      console.error(error);
      setMessage(lobbyMessage, "Die Spielerliste konnte nicht geladen werden.", "error");
    }
  );
}

async function startOnlineGame() {
  if (!isHost || !currentRoomCode) return;

  startOnlineGameButton.disabled = true;

  try {
    await updateDoc(doc(db, "rooms", currentRoomCode), {
      status: "playing",
      startedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    setMessage(lobbyMessage, "Das Spiel konnte nicht gestartet werden.", "error");
    startOnlineGameButton.disabled = false;
  }
}

async function backToLobby() {
  if (!currentRoomCode) return;

  if (isHost) {
    try {
      await updateDoc(doc(db, "rooms", currentRoomCode), {
        status: "lobby"
      });
    } catch (error) {
      console.error(error);
    }
  } else {
    showScreen("lobby");
  }
}

async function leaveRoom() {
  if (!currentRoomCode || !auth.currentUser) {
    showScreen("home");
    return;
  }

  leaveRoomButton.disabled = true;

  try {
    await deleteDoc(
      doc(db, "rooms", currentRoomCode, "players", auth.currentUser.uid)
    );

    if (isHost) {
      await deleteDoc(doc(db, "rooms", currentRoomCode));
    }
  } catch (error) {
    console.error(error);
  } finally {
    cleanupListeners();
    currentRoomCode = "";
    currentPlayerName = "";
    isHost = false;
    leaveRoomButton.disabled = false;
    connectionBadge.textContent = "Verbinde …";
    connectionBadge.classList.remove("online");
    showScreen("home");
  }
}

function cleanupListeners() {
  stopRoomListener?.();
  stopPlayersListener?.();
  stopRoomListener = null;
  stopPlayersListener = null;
}

createRoomButton.addEventListener("click", createRoom);
openJoinButton.addEventListener("click", () => {
  const name = validatePlayerName();
  if (!name) return;

  setMessage(joinMessage);
  showScreen("join");
  roomCodeInput.focus();
});
joinRoomButton.addEventListener("click", joinRoom);
offlineButton.addEventListener("click", () => showScreen("offline"));
startOnlineGameButton.addEventListener("click", startOnlineGame);
leaveRoomButton.addEventListener("click", leaveRoom);
backToLobbyButton.addEventListener("click", backToLobby);

document.querySelectorAll("[data-back='home']").forEach((button) => {
  button.addEventListener("click", () => showScreen("home"));
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.replace(/\D/g, "").slice(0, 6);
});

roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinRoom();
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

window.addEventListener("beforeunload", cleanupListeners);
