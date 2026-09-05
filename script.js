// Guess the Person - Multiplayer Leaderboard
// this code was made by Injeti Roni Atchut of class X B

// ADD YOUR SUPABASE DETAILS HERE
const SUPABASE_URL = "https://uyvgkughmyofknhmuckh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-PnsghRQz6LtKCBTm1OpHA_Pm4xGSQv";

const ADMIN_FUNCTION_URL =
    `${SUPABASE_URL}/functions/v1/admin-control`;

let gameClaimToken = null;

const MAX_ROUNDS = 10;

let people = [];
let currentPerson = null;
let score = 0;
let questionNumber = 0;
let usedPeople = [];
let playerName = "";

// =========================
// HIDDEN TOTAL GAME STOPWATCH
// =========================

let gameStartTime = null;
let gameElapsedSeconds = 0;

// =========================
// BACKGROUND MUSIC
// =========================

const backgroundMusic = new Audio("music/background.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.35;

let musicMuted = false;

// =========================
// QUESTION TIMER
// =========================

let timeLeft = 15;
let timerInterval = null;
const QUESTION_TIME = 15;

// =========================
// DOM ELEMENTS
// =========================

const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const leaderboardScreen = document.getElementById("leaderboard-screen");

const nameInput = document.getElementById("player-name");
const startButton = document.getElementById("start-button");
const playStatusMessage = document.getElementById("play-status-message");

// =========================
// START SCREEN LEADERBOARD BUTTON
// =========================

const viewLeaderboardButton = document.createElement("button");

viewLeaderboardButton.id = "view-leaderboard-button";
viewLeaderboardButton.textContent = "Leaderboard";

startButton.parentElement.appendChild(viewLeaderboardButton);

// =========================
// ADMIN PANEL BUTTON
// =========================

const adminPanelButton = document.createElement("button");
adminPanelButton.id = "admin-panel-button";
adminPanelButton.textContent = "Admin Panel";

startButton.parentElement.appendChild(adminPanelButton);

adminPanelButton.addEventListener("click", () => {
    window.location.href = "admin.html";
});

// =========================
// VIEW LEADERBOARD
// =========================

viewLeaderboardButton.addEventListener("click", async () => {
    startScreen.style.display = "none";
    quizScreen.style.display = "none";
    leaderboardScreen.style.display = "block";

    finalScoreElement.textContent = "";
    leaderboardLoading.textContent = "Loading leaderboard...";

    await loadLeaderboard();
});

// =========================
// PLAY AGAIN BUTTON
// =========================

const playAgainButton = document.getElementById("play-again-button");

// =========================
// QUIZ ELEMENTS
// =========================

const imageElement = document.getElementById("person-image");
const optionsElement = document.getElementById("options");
const resultElement = document.getElementById("result");
const nextButton = document.getElementById("next-button");
const scoreElement = document.getElementById("score");
const questionNumberElement = document.getElementById("question-number");

// =========================
// FIXED HUD: TIMER + SCORE
// =========================

const gameHud = document.createElement("div");
gameHud.id = "game-hud";
document.body.appendChild(gameHud);

const timerElement = document.createElement("div");
timerElement.id = "timer";
timerElement.innerHTML =
    `<span class="timer-text">00:${String(QUESTION_TIME).padStart(2, "0")}</span>`;

gameHud.appendChild(timerElement);

if (scoreElement) {
    gameHud.appendChild(scoreElement);
}

const timerTextElement = timerElement.querySelector(".timer-text");

function updateTimerVisual() {
    const progress = Math.max(0, Math.min(1, timeLeft / QUESTION_TIME));

    timerElement.style.setProperty("--timer-progress", progress);

    timerTextElement.textContent =
        `00:${String(Math.max(0, timeLeft)).padStart(2, "0")}`;
}

const finalScoreElement = document.getElementById("final-score");
const leaderboardElement = document.getElementById("leaderboard");
const leaderboardLoading = document.getElementById("leaderboard-loading");

// =========================
// MUSIC MUTE BUTTON
// =========================

const muteButton = document.createElement("button");

muteButton.id = "mute-button";
muteButton.textContent = "🔊";
muteButton.title = "Mute music";

document.body.appendChild(muteButton);

muteButton.addEventListener("click", () => {
    musicMuted = !musicMuted;

    if (musicMuted) {
        backgroundMusic.pause();
        muteButton.textContent = "🔇";
        muteButton.title = "Unmute music";
    } else {
        backgroundMusic.play().catch(error => {
            console.log("Music could not play:", error);
        });

        muteButton.textContent = "🔊";
        muteButton.title = "Mute music";
    }
});

// =========================
// SHUFFLE
// =========================

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

let statusCheckTimer = null;

// ============================================================
// BROWSER-WIDE PLAY LOCK
// Once anyone plays on this browser, nobody else can play.
// ============================================================

const LOCAL_PLAY_LOCK_KEY = "guess-person-browser-played";

function hasLocalPlayLock() {
    return localStorage.getItem(LOCAL_PLAY_LOCK_KEY) === "true";
}

function setLocalPlayLock() {
    localStorage.setItem(LOCAL_PLAY_LOCK_KEY, "true");
}

function clearLocalPlayLock() {
    localStorage.removeItem(LOCAL_PLAY_LOCK_KEY);
}

// =========================
// NAME INPUT / PLAY STATUS
// =========================

nameInput.addEventListener("input", () => {
    const name = nameInput.value.trim();
    const valid = name.length > 0;

    startButton.disabled = !valid;
    startButton.classList.toggle("enabled", valid);

    playStatusMessage.textContent = "";
    playStatusMessage.className = "play-status-message";

    clearTimeout(statusCheckTimer);

    if (!valid) return;

    // Local browser lock gives an immediate safety block.
    if (hasLocalPlayLock()) {
        startButton.disabled = true;
        startButton.classList.remove("enabled");

        playStatusMessage.textContent =
            "This browser has already been used to play. Ask the admin to allow a replay.";

        playStatusMessage.className =
            "play-status-message already-played";
    }

    statusCheckTimer = setTimeout(async () => {
        const status = await callAdminFunction({
            action: "player-status",
            name: name
        });

        if (!status.ok) return;

        // Admin exception overrides local lock.
        if (status.replay_exception === true) {
            clearLocalPlayLock();

            startButton.disabled = false;
            startButton.classList.add("enabled");

            playStatusMessage.textContent = "You can play.";
            playStatusMessage.className =
                "play-status-message can-play";

            return;
        }
    }, 350);
});

// =========================
// ENTER KEY
// =========================

nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !startButton.disabled) {
        startGame();
    }
});

startButton.addEventListener("click", startGame);

// =========================
// LOAD PEOPLE
// =========================

async function loadPeople() {
    try {
        const response = await fetch("people.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        people = await response.json();

        if (people.length < 4) {
            alert("You need at least 4 images in the images folder.");
            return;
        }

    } catch (error) {
        console.error(error);

        alert(
            "Could not load people.json. Run generate.py first and upload people.json."
        );
    }
}

// =========================
// SUPABASE FUNCTION
// =========================

async function callAdminFunction(payload, token = null) {
    try {
        const headers = {
            "Content-Type": "application/json"
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(ADMIN_FUNCTION_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }

        return data;

    } catch (error) {
        console.error("Supabase function error:", error);

        return {
            ok: false,
            error: error.message
        };
    }
}

// =========================
// CLAIM GAME
// =========================

async function claimGame(name) {
    return await callAdminFunction({
        action: "claim-game",
        name
    });
}

// =========================
// START GAME
// =========================

async function startGame() {
    playerName = nameInput.value.trim();

    if (!playerName) return;

    startButton.disabled = true;
    playStatusMessage.textContent = "Checking play status...";

    // Check local browser lock first.
    if (hasLocalPlayLock()) {

        const localStatus = await callAdminFunction({
            action: "player-status",
            name: playerName
        });

        if (!localStatus.ok) {
            startButton.disabled = true;
            startButton.classList.remove("enabled");

            playStatusMessage.textContent =
                "Could not check play status. Please try again.";

            playStatusMessage.className =
                "play-status-message already-played";

            return;
        }

        // ONLY an explicit admin replay exception can remove
        // the local browser lock.
        if (localStatus.replay_exception === true) {

            clearLocalPlayLock();

        } else {

            startButton.disabled = true;
            startButton.classList.remove("enabled");

            playStatusMessage.textContent =
                "This browser has already been used to play. Ask the admin to allow a replay.";

            playStatusMessage.className =
                "play-status-message already-played";

            return;
        }
    }

    // Server remains the final authority.
    const claim = await claimGame(playerName);

    if (!claim.ok) {
        startButton.disabled = false;
        startButton.classList.add("enabled");

        playStatusMessage.textContent =
            claim.error ||
            "Could not contact the play-status service.";

        playStatusMessage.className =
            "play-status-message already-played";

        return;
    }

    if (!claim.allowed) {
        startButton.disabled = true;
        startButton.classList.remove("enabled");

        playStatusMessage.textContent =
            "This name has already played. Ask the admin to allow a replay.";

        playStatusMessage.className =
            "play-status-message already-played";

        return;
    }

    gameClaimToken = claim.token;

    // Lock this browser immediately.
    setLocalPlayLock();

    // =========================
    // START HIDDEN STOPWATCH
    // =========================

    gameStartTime = Date.now();
    gameElapsedSeconds = 0;

    playStatusMessage.textContent = "";

    // =========================
    // START MUSIC
    // =========================

    if (!musicMuted) {
        backgroundMusic.currentTime = 0;

        backgroundMusic.play().catch(error => {
            console.log("Music could not play:", error);
        });
    }

    // =========================
    // RESET GAME
    // =========================

    score = 0;
    questionNumber = 0;
    usedPeople = [];

    scoreElement.textContent = "0";

    startScreen.style.display = "none";
    leaderboardScreen.style.display = "none";
    quizScreen.style.display = "block";

    nextQuestion();
}

// =========================
// GET RANDOM PERSON
// =========================

function getRandomPerson() {
    if (usedPeople.length === people.length) {
        usedPeople = [];
    }

    const available = people.filter(
        person => !usedPeople.includes(person.name)
    );

    const person =
        available[Math.floor(Math.random() * available.length)];

    usedPeople.push(person.name);

    return person;
}

// =========================
// STOP QUESTION TIMER
// =========================

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// =========================
// START QUESTION TIMER
// =========================

function startTimer() {
    stopTimer();

    timeLeft = QUESTION_TIME;
    updateTimerVisual();

    timerElement.classList.remove("timer-danger");

    nextButton.style.display = "none";

    timerInterval = setInterval(() => {

        timeLeft--;

        timerTextElement.textContent =
            `00:${String(timeLeft).padStart(2, "0")}`;

        // =========================
        // DANGER MODE
        // =========================

        if (timeLeft < 4 && timeLeft > 0) {
            timerElement.classList.add("timer-danger");
        } else {
            timerElement.classList.remove("timer-danger");
        }

        // =========================
        // TIME'S UP
        // =========================

        if (timeLeft <= 0) {
            stopTimer();

            timerElement.classList.remove("timer-danger");

            const buttons =
                document.querySelectorAll(".option-button");

            buttons.forEach(button => {
                button.disabled = true;
            });

            resultElement.textContent = "Time's up!";
            resultElement.style.color = "#ea4335";

            // Show correct answer
            buttons.forEach(button => {
                if (button.textContent === currentPerson.name) {
                    button.classList.add("correct");
                }
            });

            // =========================
            // 5 SECOND COUNTDOWN
            // =========================

            if (questionNumber < MAX_ROUNDS) {

                nextButton.style.display = "inline-block";
                nextButton.disabled = false;

                let skipTime = 5;

                timerTextElement.textContent =
                    `00:${String(skipTime).padStart(2, "0")}`;

                timerInterval = setInterval(() => {

                    skipTime--;

                    timerTextElement.textContent =
                        `00:${String(skipTime).padStart(2, "0")}`;

                    if (skipTime <= 0) {
                        stopTimer();

                        nextButton.style.display = "none";

                        nextQuestion();
                    }

                }, 1000);

            } else {

                // =========================
                // FINAL QUESTION
                // =========================

                let skipTime = 5;

                timerTextElement.textContent =
                    `00:${String(skipTime).padStart(2, "0")}`;

                timerInterval = setInterval(() => {

                    skipTime--;

                    timerTextElement.textContent =
                        `00:${String(skipTime).padStart(2, "0")}`;

                    if (skipTime <= 0) {
                        stopTimer();

                        finishGame();
                    }

                }, 1000);
            }
        }

    }, 1000);
}

// =========================
// NEXT QUESTION
// =========================

function nextQuestion() {

    if (questionNumber >= MAX_ROUNDS) {
        finishGame();
        return;
    }

    resultElement.textContent = "";
    nextButton.style.display = "none";
    optionsElement.innerHTML = "";

    questionNumber++;

    questionNumberElement.textContent =
        `${questionNumber} / ${MAX_ROUNDS}`;

    currentPerson = getRandomPerson();

    imageElement.src = currentPerson.image;

    let choices = [currentPerson];

    let incorrect = people.filter(
        person => person.name !== currentPerson.name
    );

    shuffle(incorrect);

    choices.push(...incorrect.slice(0, 3));

    shuffle(choices);

    choices.forEach(person => {

        const button = document.createElement("button");

        button.classList.add("option-button");

        button.textContent = person.name;

        button.addEventListener("click", () => {
            checkAnswer(button, person);
        });

        optionsElement.appendChild(button);
    });

    startTimer();
}

// =========================
// CHECK ANSWER
// =========================

function checkAnswer(selectedButton, selectedPerson) {

    stopTimer();

    const buttons =
        document.querySelectorAll(".option-button");

    buttons.forEach(button => {
        button.disabled = true;
    });

    if (selectedPerson.name === currentPerson.name) {

        selectedButton.classList.add("correct");

        resultElement.textContent = "Correct! 🎉";
        resultElement.style.color = "#35a853";

        score++;

        scoreElement.textContent = score;

    } else {

        selectedButton.classList.add("wrong");

        resultElement.textContent =
            "Wrong! The answer was " +
            currentPerson.name;

        resultElement.style.color = "#ea4335";

        buttons.forEach(button => {

            if (button.textContent === currentPerson.name) {
                button.classList.add("correct");
            }

        });
    }

    if (questionNumber < MAX_ROUNDS) {

        nextButton.style.display = "inline-block";

    } else {

        resultElement.textContent +=
            ` Final score: ${score}/${MAX_ROUNDS}`;

        setTimeout(finishGame, 900);
    }
}

// =========================
// SUPABASE CONFIG
// =========================

function supabaseConfigured() {
    return SUPABASE_URL &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_URL.includes("YOUR_SUPABASE") &&
        !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
}

// =========================
// SUPABASE HEADERS
// =========================

function supabaseHeaders() {
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
    };
}

// =========================
// FINISH GAME
// =========================

async function finishGame() {

    stopTimer();

    // =========================
    // CALCULATE TOTAL GAME TIME
    // =========================

    if (gameStartTime !== null) {

        gameElapsedSeconds = Math.max(
            0,
            Math.round(
                (Date.now() - gameStartTime) / 1000
            )
        );

        gameStartTime = null;
    }

    // Remember completed game locally.
        setLocalPlayLock();

    // =========================
    // STOP MUSIC
    // =========================

    if (!backgroundMusic.paused) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }

    // =========================
    // FORMAT TIME
    // =========================

    const minutes =
        Math.floor(gameElapsedSeconds / 60);

    const seconds =
        String(gameElapsedSeconds % 60).padStart(2, "0");

    const formattedGameTime =
        `${minutes}:${seconds}`;

    // =========================
    // SHOW FINAL SCORE
    // =========================

    quizScreen.style.display = "none";
    leaderboardScreen.style.display = "block";

    finalScoreElement.textContent =
        `${playerName}, you scored ${score}/${MAX_ROUNDS} in ${formattedGameTime}!`;

    leaderboardLoading.style.display = "block";

    leaderboardElement.innerHTML = "";

    // =========================
    // SAVE SCORE
    // =========================

    await saveScore();

    // =========================
    // LOAD LEADERBOARD
    // =========================

    await loadLeaderboard();
}

// =========================
// SAVE SCORE
// =========================

async function saveScore() {

    if (!supabaseConfigured()) {

        leaderboardLoading.textContent =
            "Leaderboard is not connected yet. Add your Supabase details in script.js.";

        return;
    }

    try {

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/leaderboard`,
            {
                method: "POST",

                headers: supabaseHeaders(),

                body: JSON.stringify({
                    name: playerName,
                    score: score,
                    time_seconds: gameElapsedSeconds
                })
            }
        );

        if (!response.ok) {
            throw new Error(await response.text());
        }

    } catch (error) {

        console.error(
            "Could not save score:",
            error
        );

        leaderboardLoading.textContent =
            "Could not save your score. Check your Supabase setup.";
    }
}

// =========================
// LOAD LEADERBOARD
// =========================
// ORDER:
// 1. HIGHEST SCORE
// 2. FASTEST TIME
// 3. ALPHABETICAL NAME
// =========================

async function loadLeaderboard() {

    if (!supabaseConfigured()) return;

    try {

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/leaderboard?select=id,name,score,time_seconds,created_at&order=time_seconds.asc.nullslast,score.desc,name.asc&limit=100`,
            {
                method: "GET",
                headers: supabaseHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const rows = await response.json();

        leaderboardElement.innerHTML = "";

        rows.forEach((row, index) => {
            row.rank = index + 1;
        });

        // =========================
        // TOP 10
        // =========================

        rows.slice(0, 10).forEach(row => {

            appendLeaderboardRow(
                row,
                row.name === playerName
            );

        });

        // =========================
        // PERSONAL ROW IF OUTSIDE TOP 10
        // =========================

        const personalRow =
            rows.find(row => row.name === playerName);

        if (
            personalRow &&
            personalRow.rank > 10
        ) {

            const divider =
                document.createElement("li");

            divider.className =
                "leaderboard-divider";

            divider.textContent =
                "Your rank";

            leaderboardElement.appendChild(divider);

            appendLeaderboardRow(
                personalRow,
                true
            );
        }

        leaderboardLoading.style.display =
            "none";

    } catch (error) {

        console.error(
            "Could not load leaderboard:",
            error
        );

        leaderboardLoading.textContent =
            "Could not load the leaderboard. Check your Supabase setup.";
    }
}

// =========================
// FORMAT LEADERBOARD TIME
// =========================

function formatLeaderboardTime(seconds) {

    const totalSeconds = Number(seconds);

    if (!Number.isFinite(totalSeconds)) {
        return "--:--";
    }

    const minutes =
        Math.floor(totalSeconds / 60);

    const remainingSeconds =
        totalSeconds % 60;

    return `${minutes}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
}

// =========================
// ADD LEADERBOARD ROW
// =========================

function appendLeaderboardRow(
    row,
    isCurrentPlayer = false
) {

    const item =
        document.createElement("li");

    item.className =
        "leaderboard-row";

    if (isCurrentPlayer) {
        item.classList.add("current-player");
    }

    // =========================
    // RANK
    // =========================

    const rank =
        document.createElement("span");

    rank.className =
        "leaderboard-rank";

    if (row.rank <= 3) {

        const rankImage =
            document.createElement("img");

        rankImage.src =
            `rank-images/rank${row.rank}.png`;

        rankImage.alt =
            `Rank ${row.rank}`;

        rankImage.className =
            `rank-image rank-image-${row.rank}`;

        rank.appendChild(rankImage);

    } else {

        rank.textContent =
            `${row.rank}.`;
    }

    // =========================
    // NAME
    // =========================

    const name =
        document.createElement("span");

    name.className =
        "leaderboard-name";

    name.textContent =
        row.name;

    // =========================
    // SCORE
    // =========================

    const points =
        document.createElement("strong");

    points.className =
        "leaderboard-score";

    points.textContent =
        `${row.score}/${MAX_ROUNDS}`;

    // =========================
    // TIME
    // =========================

    const time =
        document.createElement("span");

    time.className =
        "leaderboard-time";

    time.textContent =
        formatLeaderboardTime(
            row.time_seconds
        );

    // Keep the time on the right.
    time.style.marginLeft = "auto";
    time.style.fontWeight = "700";
    time.style.opacity = "0.8";

    // =========================
    // ADD EVERYTHING
    // =========================

    item.append(
        rank,
        name,
        points,
        time
    );

    leaderboardElement.appendChild(item);
}

// =========================
// NEXT BUTTON
// =========================

nextButton.addEventListener("click", () => {

    // Cancel countdown.
    stopTimer();

    // Hide Next Question.
    nextButton.style.display = "none";

    // Go to next question.
    nextQuestion();
});

// =========================
// PLAY AGAIN
// =========================

playAgainButton.addEventListener(
    "click",
    async () => {

        leaderboardScreen.style.display = "none";
        quizScreen.style.display = "none";
        startScreen.style.display = "block";

        const name =
            nameInput.value.trim();

        if (!name) {

            startButton.disabled = true;

            startButton.classList.remove(
                "enabled"
            );

            return;
        }

        // =========================
        // CHECK SERVER
        // =========================

        const status =
            await callAdminFunction({
                action: "player-status",
                name
            });

        if (!status.ok) {

            startButton.disabled = true;

            startButton.classList.remove(
                "enabled"
            );

            playStatusMessage.textContent =
                "Could not check your play status.";

            playStatusMessage.className =
                "play-status-message already-played";

            return;
        }

        // =========================
        // EXCEPTION
        // =========================

        if (
            status.replay_exception === true
        ) {

            clearLocalPlayLock();

            startButton.disabled = false;

            startButton.classList.add(
                "enabled"
            );

            playStatusMessage.textContent =
                "You can play.";

            playStatusMessage.className =
                "play-status-message can-play";

            return;
        }

        // =========================
        // ALREADY PLAYED
        // =========================

        startButton.disabled = true;

        startButton.classList.remove(
            "enabled"
        );

        playStatusMessage.textContent =
            "This name has already played. Ask the admin to allow a replay.";

        playStatusMessage.className =
            "play-status-message already-played";
    }
);

// =========================
// LOAD PEOPLE
// =========================

loadPeople();

// =========================
// CREDITS
// =========================

// this code was made by Injeti Roni Atchut of class X B
// this code was made by Injeti Roni Atchut of class X B
// this code was made by Injeti Roni Atchut of class X B