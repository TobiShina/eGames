// 1. Firebase Configuration (Replace with your actual Firebase config)
const firebaseConfig = {
  apiKey: "AIzaSyB-pqHj-YGCBpviro3NHQipop-nurT38lw",
  authDomain: "egamesleague.firebaseapp.com",
  projectId: "egamesleague",
  storageBucket: "egamesleague.firebasestorage.app",
  messagingSenderId: "90928301454",
  appId: "1:90928301454:web:33a5670e0c132a4a44d0df",
  measurementId: "G-DSBY12JLX8",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Global variables
let allFixtures = [];
let allPlayers = []; // Store all players from Firestore
let currentCarouselPage = 0;
const matchesPerPage = 3; // Adjust this number based on how many cards fit in your view (e.g., 3 or 4)
const CARD_WIDTH = 250; // Must match .fixture-card min-width in CSS
const CARD_MARGIN_RIGHT = 20; // Must match .fixture-card margin-right in CSS
const totalCardWidth = CARD_WIDTH + CARD_MARGIN_RIGHT; // Total space each card occupies
let currentLoggedInUser = null; // To store logged in user's data for likes/comments

// --- DOM Elements ---
const authButton = document.getElementById("auth-button");
const userStatusSpan = document.getElementById("user-status");
const adminPanel = document.getElementById("admin-panel");
const selectFixtureDropdown = document.getElementById("select-fixture");
const adminPlayer1ScoreInput = document.getElementById("admin-player1-score");
const adminPlayer2ScoreInput = document.getElementById("admin-player2-score");
const updateScoreBtn = document.getElementById("update-score-btn");
const scoreUpdateStatus = document.getElementById("score-update-status");

const addFixtureBtn = document.getElementById("add-fixture-btn");
const player1NameInput = document.getElementById("player1-name");
const player2NameInput = document.getElementById("player2-name");
const fixtureDateInput = document.getElementById("fixture-date");
const matchdayInput = document.getElementById("matchday");

// Admin Fixture Controls
const generateFixturesBtn = document.getElementById("generate-fixtures-btn");
const deleteAllFixturesBtn = document.getElementById("delete-all-fixtures-btn");
const startFixtureDateInput = document.getElementById("start-fixture-date");
const fixtureStatus = document.getElementById("fixture-status");

// --- DOM Elements (NEW Blog Related) ---
const leagueBtn = document.getElementById("league-btn");
const blogBtn = document.getElementById("blog-btn");
const leagueContent = document.getElementById("league-content");
const blogSection = document.getElementById("blog-section");
const adminBlogPanel = document.getElementById("admin-blog-panel");
const blogTitleInput = document.getElementById("blog-title");
const blogImageInput = document.getElementById("blog-image");
const imagePreview = document.getElementById("image-preview");
const blogContentInput = document.getElementById("blog-content");
const postBlogBtn = document.getElementById("post-blog-btn");
const blogStatus = document.getElementById("blog-status");
const blogPostsContainer = document.getElementById("blog-posts-container");

// Modal Elements
const blogPostModal = document.getElementById("blog-post-modal");
const modalCloseButton = blogPostModal.querySelector(".close-button");
const modalBlogTitle = document.getElementById("modal-blog-title");
const modalBlogTimestamp = document.getElementById("modal-blog-timestamp");
const modalBlogImage = document.getElementById("modal-blog-image");
const modalBlogContent = document.getElementById("modal-blog-content");
const shareBlogBtn = document.getElementById("share-blog-btn");
const likeBlogBtn = document.getElementById("like-blog-btn");
const likeCountSpan = document.getElementById("like-count");
const commentsList = document.getElementById("comments-list");
const commentInput = document.getElementById("comment-input");
const commentWordCount = document.getElementById("comment-word-count");
const postCommentBtn = document.getElementById("post-comment-btn");
const commentStatus = document.getElementById("comment-status");

let currentOpenedBlogPostId = null; // To keep track of which blog post is open in the modal

// --- NEW: Function to render Live Broadcast section ---
function renderLiveBroadcast(players) {
  const liveStreamsList = document.getElementById("live-streams-list");
  liveStreamsList.innerHTML = ""; // Clear existing list

  // Sort players alphabetically by name for consistent display
  players.sort((a, b) => a.name.localeCompare(b.name));

  players.forEach((player) => {
    if (player.twitchUrl) {
      // Only show players who have a Twitch URL
      const streamItem = document.createElement("div");
      streamItem.classList.add("live-stream-item");

      streamItem.innerHTML = `
                <a href="${player.twitchUrl}" target="_blank" rel="noopener noreferrer">${player.name}</a>
                <i class="fas fa-tv"></i>
            `;
      liveStreamsList.appendChild(streamItem);
    }
  });
  // If no players have twitch URLs, display a message
  if (liveStreamsList.children.length === 0) {
    liveStreamsList.innerHTML = `<p style="text-align: center; color: #6c757d;">No live streams available yet. Admins can add Twitch URLs to player profiles.</p>`;
  }
}

// --- Authentication Functions ---
auth.onAuthStateChanged((user) => {
  currentLoggedInUser = user; // Store the user object globally
  if (user) {
    userStatusSpan.textContent = `Logged in as: ${
      user.displayName || user.email
    }`;
    authButton.textContent = "Sign Out";
    // Check if admin and show panels
    checkAdminStatusAndShowPanels();
  } else {
    userStatusSpan.textContent = "Not logged in";
    authButton.textContent = "Sign in with Google";
    adminPanel.style.display = "none";
    adminBlogPanel.style.display = "none"; // Hide admin blog panel
    selectFixtureDropdown.innerHTML =
      '<option value="">-- Select a match --</option>';
  }
});

authButton.addEventListener("click", () => {
  if (auth.currentUser) {
    // Sign out
    auth
      .signOut()
      .then(() => {
        console.log("User signed out.");
      })
      .catch((error) => {
        console.error("Sign out error:", error);
      });
  } else {
    // Sign in with Google
    const provider = new firebase.auth.GoogleAuthProvider();
    auth
      .signInWithPopup(provider)
      .then((result) => {
        console.log(
          "User signed in:",
          result.user.displayName || result.user.email
        );
        // checkAdminStatusAndShowPanels() will be called by onAuthStateChanged
      })
      .catch((error) => {
        console.error("Sign in error:", error);
        alert(`Sign in failed: ${error.message}`);
      });
  }
});

// Helper to check admin status (from rules, not just auth state)
async function checkAdminStatus() {
  if (!currentLoggedInUser) return false;
  try {
    // Attempt to read from the 'admins' collection for the current user's UID
    const adminDoc = await db
      .collection("admins")
      .doc(currentLoggedInUser.uid)
      .get();
    return adminDoc.exists;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

async function checkAdminStatusAndShowPanels() {
  const isAdmin = await checkAdminStatus();
  if (isAdmin) {
    adminPanel.style.display = "block";
    adminBlogPanel.style.display = "block";
    fetchAndPopulateFixturesForAdmin();
  } else {
    adminPanel.style.display = "none";
    adminBlogPanel.style.display = "none";
  }
}

// --- Helper Functions ---

function getOutcomeIconClass(score1, score2, isPlayer1) {
  if (score1 === null || score2 === null) {
    return ""; // No icon if score not entered yet
  }
  if (score1 > score2) {
    // Player 1 won
    return isPlayer1 ? "win" : "loss";
  } else if (score1 < score2) {
    // Player 2 won
    return isPlayer1 ? "loss" : "win";
  } else {
    // Draw
    return "draw";
  }
}

function formatDateTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "N/A"; // Handle cases where timestamp might be invalid
  }
  const date = timestamp.toDate(); // Convert Firestore Timestamp to Date object
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return date.toLocaleString("en-US", options);
}

function formatBlogTimestamp(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "N/A";
  }
  const date = timestamp.toDate();
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return date.toLocaleString("en-US", options);
}

// --- NEW: Full Recalculation of Player Stats ---
async function recalculateAllPlayerStats() {
  console.log("Recalculating all player stats...");
  const playersRef = db.collection("players");
  const fixturesRef = db.collection("fixtures");

  try {
    // 1. Fetch all players
    const playersSnapshot = await playersRef.get();
    const playersData = {};
    playersSnapshot.forEach((doc) => {
      playersData[doc.id] = {
        P: 0,
        W: 0,
        D: 0,
        L: 0,
        GF: 0,
        GA: 0,
        GD: 0,
        PTS: 0,
        formHistory: [],
      };
    });

    // 2. Fetch all played fixtures, ordered by date to build form correctly
    const fixturesSnapshot = await fixturesRef
      .where("played", "==", true)
      .orderBy("date", "asc")
      .get();

    // 3. Process each played fixture to build up stats
    fixturesSnapshot.forEach((doc) => {
      const fixture = doc.data();
      const p1Name = fixture.player1;
      const p2Name = fixture.player2;
      const p1Score = fixture.player1Score;
      const p2Score = fixture.player2Score;

      if (p1Name && playersData[p1Name] && p2Name && playersData[p2Name]) {
        // Update P for both
        playersData[p1Name].P++;
        playersData[p2Name].P++;

        // Update GF and GA
        playersData[p1Name].GF += p1Score;
        playersData[p1Name].GA += p2Score;
        playersData[p2Name].GF += p2Score;
        playersData[p2Name].GA += p1Score;

        // Update W, D, L, PTS, and form history
        if (p1Score > p2Score) {
          // Player 1 won
          playersData[p1Name].W++;
          playersData[p1Name].PTS += 3;
          playersData[p1Name].formHistory.push("W");

          playersData[p2Name].L++;
          playersData[p2Name].formHistory.push("L");
        } else if (p1Score < p2Score) {
          // Player 2 won
          playersData[p1Name].L++;
          playersData[p1Name].formHistory.push("L");

          playersData[p2Name].W++;
          playersData[p2Name].PTS += 3;
          playersData[p2Name].formHistory.push("W");
        } else {
          // Draw
          playersData[p1Name].D++;
          playersData[p1Name].PTS += 1;
          playersData[p1Name].formHistory.push("D");

          playersData[p2Name].D++;
          playersData[p2Name].PTS += 1;
          playersData[p2Name].formHistory.push("D");
        }
      }
    });

    // 4. Prepare batch updates for players collection
    const batch = db.batch();
    const batchSize = 400; // Firestore batch write limit is 500. Use a safe number.
    let updatesCount = 0;

    for (const playerId in playersData) {
      if (playersData.hasOwnProperty(playerId)) {
        const player = playersData[playerId];
        const playerRef = playersRef.doc(playerId);

        // Calculate GD and final form (last 5 games)
        player.GD = player.GF - player.GA;
        player.form = player.formHistory.slice(-5); // Get last 5 outcomes

        const updatePayload = {
          P: player.P,
          W: player.W,
          D: player.D,
          L: player.L,
          GF: player.GF,
          GA: player.GA,
          GD: player.GD,
          PTS: player.PTS,
          form: player.form,
        };
        batch.update(playerRef, updatePayload); // Use .update() because documents exist

        updatesCount++;
        // Commit batch if it reaches size limit
        if (updatesCount % batchSize === 0) {
          await batch.commit();
          batch = db.batch(); // Start a new batch
        }
      }
    }
    // Commit any remaining operations in the last batch
    if (updatesCount % batchSize !== 0 || updatesCount === 0) {
      await batch.commit();
    }

    console.log(
      "Player stats recalculation complete. Updated",
      updatesCount,
      "players."
    );
    return true;
  } catch (error) {
    console.error("Error recalculating player stats:", error);
    return false;
  }
}

// --- Admin Panel Functions ---

// Function to populate fixtures dropdown for score updates
async function fetchAndPopulateFixturesForAdmin() {
  if (!auth.currentUser) return; // Only if admin is logged in
  selectFixtureDropdown.innerHTML =
    '<option value="">-- Select a match --</option>'; // Clear existing options

  try {
    const snapshot = await db
      .collection("fixtures")
      .orderBy("date", "asc")
      .get();
    snapshot.forEach((doc) => {
      const fixture = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      const scoreDisplay = fixture.played
        ? `(${fixture.player1Score}-${fixture.player2Score})`
        : "";
      option.textContent = `${fixture.player1} vs ${
        fixture.player2
      } ${scoreDisplay} (${formatDateTime(fixture.date)})`;
      if (fixture.played) {
        option.style.fontStyle = "italic";
        option.style.color = "#777";
      }
      selectFixtureDropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching fixtures for admin dropdown:", error);
  }
}

// Admin: Add new fixture (manual - use a script for bulk)
addFixtureBtn.addEventListener("click", async () => {
  if (!auth.currentUser) {
    alert("Please sign in as admin to add fixtures.");
    return;
  }

  const player1 = player1NameInput.value.trim();
  const player2 = player2NameInput.value.trim();
  const fixtureDate = fixtureDateInput.value;
  const matchday = parseInt(matchdayInput.value);

  if (!player1 || !player2 || !fixtureDate || isNaN(matchday)) {
    alert("Please fill in all fixture details.");
    return;
  }
  if (player1 === player2) {
    alert("Players cannot play against themselves.");
    return;
  }

  try {
    // Basic check if players exist in players collection
    const player1Doc = await db.collection("players").doc(player1).get();
    const player2Doc = await db.collection("players").doc(player2).get();
    if (!player1Doc.exists) {
      alert(
        `Player "${player1}" not found in the "players" collection. Please create them first.`
      );
      return;
    }
    if (!player2Doc.exists) {
      alert(
        `Player "${player2}" not found in the "players" collection. Please create them first.`
      );
      return;
    }

    await db.collection("fixtures").add({
      player1: player1,
      player2: player2,
      date: firebase.firestore.Timestamp.fromDate(new Date(fixtureDate)),
      player1Score: null,
      player2Score: null,
      played: false,
      matchday: matchday,
    });
    alert("Fixture added successfully!");
    player1NameInput.value = "";
    player2NameInput.value = "";
    fixtureDateInput.value = "";
    fetchAndPopulateFixturesForAdmin(); // Refresh admin dropdown
    // No need to recalculate stats here, as new fixtures are unplayed
  } catch (error) {
    console.error("Error adding fixture:", error);
    alert("Error adding fixture: " + error.message);
  }
});

// Admin: Update score for a selected fixture (NOW TRIGGERS FULL RECALCULATION)
updateScoreBtn.addEventListener("click", async () => {
  if (!auth.currentUser) {
    alert("Please sign in as admin to update scores.");
    return;
  }

  const fixtureId = selectFixtureDropdown.value;
  const player1Score = parseInt(adminPlayer1ScoreInput.value);
  const player2Score = parseInt(adminPlayer2ScoreInput.value);

  if (!fixtureId) {
    alert("Please select a match to update.");
    return;
  }
  if (
    isNaN(player1Score) ||
    isNaN(player2Score) ||
    player1Score < 0 ||
    player2Score < 0
  ) {
    alert("Please enter valid scores (non-negative numbers).");
    return;
  }

  const fixtureRef = db.collection("fixtures").doc(fixtureId);
  scoreUpdateStatus.textContent = ""; // Clear previous status

  updateScoreBtn.disabled = true; // Disable button during operation
  scoreUpdateStatus.style.color = "blue";
  scoreUpdateStatus.textContent = "Updating score and recalculating stats...";

  try {
    await fixtureRef.update({
      player1Score: player1Score,
      player2Score: player2Score,
      played: true,
    });

    // --- NEW: Trigger full recalculation after fixture update ---
    const recalculationSuccess = await recalculateAllPlayerStats();

    if (recalculationSuccess) {
      scoreUpdateStatus.textContent = `Score updated and stats refreshed!`;
      scoreUpdateStatus.style.color = "green";
    } else {
      scoreUpdateStatus.textContent = `Score updated, but stat recalculation failed. Check console.`;
      scoreUpdateStatus.style.color = "orange";
    }

    fetchAndPopulateFixturesForAdmin(); // Refresh admin dropdown
  } catch (error) {
    console.error("Error updating score:", error);
    scoreUpdateStatus.textContent = "Error updating score: " + error.message;
    scoreUpdateStatus.style.color = "red";
  } finally {
    updateScoreBtn.disabled = false; // Re-enable button
  }
});

// --- Auto-Populate Fixtures (Admin) ---

generateFixturesBtn.addEventListener("click", async () => {
  if (!auth.currentUser) {
    alert("Please sign in as admin to generate fixtures.");
    return;
  }
  if (allPlayers.length !== 20) {
    alert(
      `You need exactly 20 players in the 'players' collection to generate a full schedule. Found: ${allPlayers.length}.`
    );
    return;
  }

  if (
    !confirm(
      "Are you sure you want to generate a new full fixture schedule (380 games)? This will ADD to any existing fixtures."
    )
  ) {
    return;
  }

  generateFixturesBtn.disabled = true;
  deleteAllFixturesBtn.disabled = true;
  fixtureStatus.style.color = "blue";
  fixtureStatus.textContent = "Generating fixtures...";

  const startDateStr = startFixtureDateInput.value;
  if (!startDateStr) {
    alert("Please select a start date for the season.");
    generateFixturesBtn.disabled = false;
    deleteAllFixturesBtn.disabled = false;
    fixtureStatus.textContent = "";
    return;
  }
  let currentMatchDate = new Date(startDateStr + "T15:00:00"); // Default to 3 PM on selected date

  const playersNames = allPlayers.map((p) => p.id); // Use player IDs (which are names)
  const generatedFixtures = [];
  const numPlayers = playersNames.length;
  const rounds = numPlayers - 1; // 19 rounds for a single round-robin

  // --- Circle Method for Double Round-Robin (380 matches) ---
  // This is a slightly adjusted circle method to ensure all home/away matches are generated systematically.
  // It will iterate 2 * (N-1) times for N teams.

  const tempPlayers = [...playersNames]; // Copy to manipulate
  const playerA = tempPlayers.shift(); // Fix the first player

  for (let i = 0; i < rounds; i++) {
    // For each of the 19 "matchdays" for single round robin
    let matchday = i + 1;

    // First, handle the fixed player vs. the current rotating player at the top
    const playerB = tempPlayers[0];
    // Leg 1 (e.g., A vs B)
    generatedFixtures.push({
      player1: playerA,
      player2: playerB,
      matchday: matchday,
      date: new Date(currentMatchDate),
    });
    // Leg 2 (B vs A) - will be assigned a later date
    generatedFixtures.push({
      player1: playerB,
      player2: playerA,
      matchday: matchday + rounds, // Matchday for second leg, e.g., Matchday 1+19=20
      date: new Date(
        currentMatchDate.getTime() + 7 * 24 * 60 * 60 * 1000 * rounds
      ), // Weeks later
    });

    // Then, pair the remaining players in pairs
    const half = tempPlayers.length / 2;
    for (let j = 1; j < half; j++) {
      const p1 = tempPlayers[j];
      const p2 = tempPlayers[tempPlayers.length - j];
      // Leg 1 (e.g., P1 vs P2)
      generatedFixtures.push({
        player1: p1,
        player2: p2,
        matchday: matchday,
        date: new Date(currentMatchDate),
      });
      // Leg 2 (P2 vs P1)
      generatedFixtures.push({
        player1: p2,
        player2: p1,
        matchday: matchday + rounds,
        date: new Date(
          currentMatchDate.getTime() + 7 * 24 * 60 * 60 * 1000 * rounds
        ),
      });
    }

    // Rotate players (all except the fixed one)
    tempPlayers.push(tempPlayers.shift()); // Move first rotating player to end

    // Advance date for the next matchday
    currentMatchDate.setDate(currentMatchDate.getDate() + 7); // Advance by 1 week for next matchday
    fixtureStatus.textContent = `Generating fixtures... Matchday ${matchday}/${rounds} processed.`;
  }

  // Sort generated fixtures by date to ensure proper carousel ordering
  generatedFixtures.sort((a, b) => a.date.getTime() - b.date.getTime());

  fixtureStatus.textContent = `Generated ${generatedFixtures.length} matches. Uploading to Firestore...`;
  fixtureStatus.style.color = "blue";

  try {
    const batchSize = 400; // Firestore batch write limit is 500. Use a safe number.
    for (let i = 0; i < generatedFixtures.length; i += batchSize) {
      const batch = db.batch();
      const chunk = generatedFixtures.slice(i, i + batchSize);
      chunk.forEach((fixture) => {
        const docRef = db.collection("fixtures").doc(); // Auto-generate ID
        batch.set(docRef, {
          player1: fixture.player1,
          player2: fixture.player2,
          date: firebase.firestore.Timestamp.fromDate(fixture.date),
          player1Score: null,
          player2Score: null,
          played: false,
          matchday: fixture.matchday,
        });
      });
      await batch.commit();
      fixtureStatus.textContent = `Uploading fixtures... Batch ${
        Math.floor(i / batchSize) + 1
      }/${Math.ceil(generatedFixtures.length / batchSize)} committed.`;
    }
    fixtureStatus.textContent = `Successfully generated and uploaded ${generatedFixtures.length} fixtures!`;
    fixtureStatus.style.color = "green";
    fetchAndPopulateFixturesForAdmin(); // Refresh admin dropdown
    // No need to recalculate stats here, as new fixtures are unplayed
  } catch (error) {
    console.error("Error uploading fixtures:", error);
    fixtureStatus.textContent = "Error uploading fixtures: " + error.message;
    fixtureStatus.style.color = "red";
  } finally {
    generateFixturesBtn.disabled = false;
    deleteAllFixturesBtn.disabled = false;
  }
});

// --- Delete All Fixtures (Admin) ---
deleteAllFixturesBtn.addEventListener("click", async () => {
  if (!auth.currentUser) {
    alert("Please sign in as admin to delete fixtures.");
    return;
  }
  if (
    !confirm(
      "Are you sure you want to DELETE ALL FIXTURES AND RESET ALL PLAYER STATS? This action cannot be undone."
    )
  ) {
    return;
  }

  deleteAllFixturesBtn.disabled = true;
  generateFixturesBtn.disabled = true;
  fixtureStatus.style.color = "red";
  fixtureStatus.textContent =
    "Deleting all fixtures and resetting player stats...";

  try {
    const snapshot = await db.collection("fixtures").get();
    const deleteBatchSize = 400; // Max batch size for deletes
    let deletedCount = 0;

    // Delete fixtures in batches
    for (let i = 0; i < snapshot.docs.length; i += deleteBatchSize) {
      const batch = db.batch();
      const chunk = snapshot.docs.slice(i, i + deleteBatchSize);
      chunk.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      deletedCount += chunk.length;
      fixtureStatus.textContent = `Deleting fixtures... ${deletedCount}/${snapshot.docs.length} deleted.`;
    }

    // Reset all player stats after deleting fixtures
    const playersSnapshot = await db.collection("players").get();
    const resetBatch = db.batch();
    let resetCount = 0;
    playersSnapshot.forEach((doc) => {
      const playerRef = doc.ref;
      resetBatch.update(playerRef, {
        P: 0,
        W: 0,
        D: 0,
        L: 0,
        GF: 0,
        GA: 0,
        GD: 0,
        PTS: 0,
        form: [],
      });
      resetCount++;
    });
    await resetBatch.commit();

    fixtureStatus.textContent = `Successfully deleted ${deletedCount} fixtures and reset ${resetCount} player stats!`;
    fixtureStatus.style.color = "green";
    fetchAndPopulateFixturesForAdmin(); // Refresh admin dropdown (it will be empty)
  } catch (error) {
    console.error("Error deleting fixtures or resetting stats:", error);
    fixtureStatus.textContent =
      "Error deleting fixtures or resetting stats: " + error.message;
    fixtureStatus.style.color = "red";
  } finally {
    deleteAllFixturesBtn.disabled = false;
    generateFixturesBtn.disabled = false;
  }
});

// --- Main Data Fetching and Display Functions (Public View) ---

// 2. Fetch and Display League Table
function renderLeagueTable(players) {
  const tableBody = document.querySelector("#league-table tbody");
  tableBody.innerHTML = ""; // Clear existing rows

  // Sort players: 1. by Points (desc), 2. by Goal Difference (desc)
  players.sort((a, b) => {
    if (b.PTS !== a.PTS) {
      return b.PTS - a.PTS;
    }
    return b.GD - a.GD; // If points are same, use Goal Difference
  });

  players.forEach((player, index) => {
    const row = tableBody.insertRow();
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td>${player.P}</td>
            <td>${player.W}</td>
            <td>${player.D}</td>
            <td>${player.L}</td>
            <td>${player.GD}</td>
            <td>${player.PTS}</td>
        `;
  });
}

// 3. Fetch and Display Fixture Schedule (Carousel)
function renderFixturesCarousel(initialRender = false) {
  const carouselTrack = document.getElementById("fixture-carousel-track");
  if (!carouselTrack) {
    console.error("Carousel track element not found!");
    return;
  }
  // Only re-populate the track with all fixtures if it's the initial render
  // or if the content count doesn't match (e.g., fixtures added/deleted)
  if (initialRender || carouselTrack.children.length !== allFixtures.length) {
    carouselTrack.innerHTML = ""; // Clear existing cards

    allFixtures.forEach((fixture) => {
      const fixtureCard = document.createElement("div");
      fixtureCard.classList.add("fixture-card");

      // Determine outcome icons for player1 and player2
      const player1IconClass = getOutcomeIconClass(
        fixture.player1Score,
        fixture.player2Score,
        true
      );
      const player2IconClass = getOutcomeIconClass(
        fixture.player1Score,
        fixture.player2Score,
        false
      );

      fixtureCard.innerHTML = `
                <p class="date-time">${formatDateTime(fixture.date)}</p>
                <p>
                    <span class="player-name">${fixture.player1}</span>
                    <span class="score">${
                      fixture.player1Score !== null ? fixture.player1Score : "-"
                    }</span>
                    <span class="status-icon ${player1IconClass}"></span>
                </p>
                <p>vs</p>
                <p>
                    <span class="player-name">${fixture.player2}</span>
                    <span class="score">${
                      fixture.player2Score !== null ? fixture.player2Score : "-"
                    }</span>
                    <span class="status-icon ${player2IconClass}"></span>
                </p>
                <p class="matchday">Matchday: ${fixture.matchday || "N/A"}</p>
            `;
      carouselTrack.appendChild(fixtureCard);
    });
  }

  // Calculate the maximum number of pages
  const maxPages = Math.ceil(allFixtures.length / matchesPerPage);

  // Adjust currentCarouselPage if it goes out of bounds (e.g., after deleting fixtures)
  if (currentCarouselPage >= maxPages && maxPages > 0) {
    currentCarouselPage = maxPages - 1;
  } else if (maxPages === 0) {
    // No fixtures at all
    currentCarouselPage = 0;
  }

  // Calculate the transform value to shift the carousel track
  // This creates the smooth sliding effect
  const offset = -currentCarouselPage * matchesPerPage * totalCardWidth;
  carouselTrack.style.transform = `translateX(${offset}px)`;
}

// --- NEW: Blog Section Functions ---

// Main navigation function
function showSection(sectionId) {
  const sections = document.querySelectorAll(".content-section");
  sections.forEach((section) => {
    section.classList.remove("active-content");
    section.style.display = "none"; // Ensure it's truly hidden
  });
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active-content");
    targetSection.style.display = "block"; // Or 'flex' if you use flex container
  }

  // Update active button
  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active-nav-btn"));
  if (sectionId === "league-content") {
    leagueBtn.classList.add("active-nav-btn");
  } else if (sectionId === "blog-section") {
    blogBtn.classList.add("active-nav-btn");
  }
}

// Render blog posts list
function renderBlogPosts(blogPosts) {
  blogPostsContainer.innerHTML = ""; // Clear existing posts

  if (blogPosts.length === 0) {
    blogPostsContainer.innerHTML = `<p style="text-align: center; color: #6c757d;">No blog posts published yet.</p>`;
    return;
  }

  // Sort by timestamp, latest first
  blogPosts.sort(
    (a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime()
  );

  blogPosts.forEach((post) => {
    const postCard = document.createElement("div");
    postCard.classList.add("blog-post-card");
    postCard.dataset.postId = post.id; // Store Firestore document ID

    postCard.innerHTML = `
            ${
              post.imageUrl
                ? `<img src="${post.imageUrl}" alt="${post.title}">`
                : ""
            }
            <div class="blog-post-card-content">
                <h3>${post.title}</h3>
                <p class="timestamp">By ${
                  post.authorEmail || "Admin"
                } on ${formatBlogTimestamp(post.timestamp)}</p>
                <p>${post.content.substring(0, 150)}...</p>
            </div>
        `;
    postCard.addEventListener("click", () => openBlogPostModal(post));
    blogPostsContainer.appendChild(postCard);
  });
}

// Open individual blog post modal
async function openBlogPostModal(post) {
  currentOpenedBlogPostId = post.id; // Set current post ID for comments/likes
  modalBlogTitle.textContent = post.title;
  modalBlogTimestamp.textContent = `By ${
    post.authorEmail || "Admin"
  } on ${formatBlogTimestamp(post.timestamp)}`;
  modalBlogImage.src =
    post.imageUrl || "https://placehold.co/800x400/cccccc/333333?text=No+Image";
  modalBlogImage.style.display = post.imageUrl ? "block" : "none";
  modalBlogContent.textContent = post.content; // Use textContent to preserve line breaks from textarea

  // Like button state
  if (
    currentLoggedInUser &&
    post.likes &&
    post.likes.includes(currentLoggedInUser.uid)
  ) {
    likeBlogBtn.classList.add("liked");
    likeBlogBtn.innerHTML = `<i class="fas fa-heart"></i> <span id="like-count">${post.likes.length}</span> Likes`;
  } else {
    likeBlogBtn.classList.remove("liked");
    likeBlogBtn.innerHTML = `<i class="far fa-heart"></i> <span id="like-count">${
      post.likes ? post.likes.length : 0
    }</span> Likes`;
  }

  // Reset comment form
  commentInput.value = "";
  commentWordCount.textContent = "0/30 words";
  commentStatus.textContent = "";
  postCommentBtn.disabled = false;

  // Load comments for this post
  renderComments(post.id);

  blogPostModal.style.display = "block";
}

// Close modal
modalCloseButton.addEventListener("click", () => {
  blogPostModal.style.display = "none";
  currentOpenedBlogPostId = null;
});

// Close modal if click outside content
window.addEventListener("click", (event) => {
  if (event.target === blogPostModal) {
    blogPostModal.style.display = "none";
    currentOpenedBlogPostId = null;
  }
});

// Share functionality
shareBlogBtn.addEventListener("click", async () => {
  const post = allBlogPosts.find((p) => p.id === currentOpenedBlogPostId);
  if (!post) return;

  const shareUrl =
    window.location.origin + window.location.pathname + `?blogPost=${post.id}`; // Example share URL
  const shareData = {
    title: post.title,
    text: post.content.substring(0, 100) + "...",
    url: shareUrl,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      console.log("Blog post shared successfully");
    } catch (error) {
      console.error("Error sharing:", error);
      // Fallback for desktop: copy to clipboard
      fallbackCopyToClipboard(shareUrl);
    }
  } else {
    // Fallback for browsers without Web Share API
    fallbackCopyToClipboard(shareUrl);
  }
});

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed"; // Avoid scrolling to bottom
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const successful = document.execCommand("copy");
    const msg = successful
      ? "Link copied to clipboard!"
      : "Failed to copy link.";
    alert(msg);
  } catch (err) {
    console.error("Fallback: Oops, unable to copy", err);
    alert("Could not copy link to clipboard.");
  } finally {
    document.body.removeChild(textarea);
  }
}

// Like functionality
likeBlogBtn.addEventListener("click", async () => {
  if (!currentLoggedInUser) {
    alert("Please sign in to like this post.");
    return;
  }
  if (!currentOpenedBlogPostId) return;

  const blogPostRef = db.collection("blogPosts").doc(currentOpenedBlogPostId);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(blogPostRef);
      if (!doc.exists) {
        console.error("Blog post not found!");
        return;
      }

      const currentLikes = doc.data().likes || [];
      const userUid = currentLoggedInUser.uid;
      let newLikes = [...currentLikes];

      if (newLikes.includes(userUid)) {
        // User already liked, so unlike
        newLikes = newLikes.filter((uid) => uid !== userUid);
      } else {
        // User hasn't liked, so like
        newLikes.push(userUid);
      }
      transaction.update(blogPostRef, { likes: newLikes });
    });
    // UI will update automatically via onSnapshot listener
  } catch (error) {
    console.error("Error liking/unliking post:", error);
    alert("Failed to update like status. Please try again.");
  }
});

// Comment functionality
commentInput.addEventListener("input", () => {
  const text = commentInput.value.trim();
  const words = text.split(/\s+/).filter((word) => word.length > 0); // Split by whitespace, filter empty strings
  const wordCount = words.length;
  commentWordCount.textContent = `${wordCount}/30 words`;

  if (wordCount > 30) {
    commentWordCount.style.color = "red";
    postCommentBtn.disabled = true;
  } else {
    commentWordCount.style.color = "#777";
    postCommentBtn.disabled = false;
  }
  // Also consider character limit for display purposes if words are very long
  if (text.length > 180) {
    // MaxLength is 180 chars, equivalent to roughly 30 words * 6 chars/word
    commentInput.value = text.substring(0, 180); // Truncate if exceeds
  }
});

postCommentBtn.addEventListener("click", async () => {
  if (!currentLoggedInUser) {
    alert("Please sign in to leave a comment.");
    return;
  }
  if (!currentOpenedBlogPostId) return;

  const commentText = commentInput.value.trim();
  const words = commentText.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    commentStatus.textContent = "Comment cannot be empty.";
    commentStatus.style.color = "red";
    return;
  }
  if (words.length > 30) {
    commentStatus.textContent = "Comment exceeds 30 words.";
    commentStatus.style.color = "red";
    return;
  }

  postCommentBtn.disabled = true;
  commentStatus.textContent = "Posting comment...";
  commentStatus.style.color = "blue";

  try {
    await db
      .collection("blogPosts")
      .doc(currentOpenedBlogPostId)
      .collection("comments")
      .add({
        commentText: commentText,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userUid: currentLoggedInUser.uid, // Store UID, but display is anonymous
      });
    commentInput.value = ""; // Clear input
    commentWordCount.textContent = "0/30 words";
    commentStatus.textContent = "Comment posted!";
    commentStatus.style.color = "green";
    // Comments will auto-refresh via onSnapshot
  } catch (error) {
    console.error("Error posting comment:", error);
    commentStatus.textContent = "Failed to post comment. " + error.message;
    commentStatus.style.color = "red";
  } finally {
    postCommentBtn.disabled = false;
  }
});

// Render comments for a specific post
function renderComments(postId) {
  commentsList.innerHTML =
    '<p style="text-align: center; color: #6c757d;">Loading comments...</p>';

  db.collection("blogPosts")
    .doc(postId)
    .collection("comments")
    .orderBy("timestamp", "asc")
    .onSnapshot(
      (snapshot) => {
        commentsList.innerHTML = ""; // Clear existing comments
        if (snapshot.empty) {
          commentsList.innerHTML =
            '<p style="text-align: center; color: #6c757d;">No comments yet. Be the first to comment!</p>';
          return;
        }
        snapshot.forEach((doc) => {
          const comment = doc.data();
          const commentItem = document.createElement("div");
          commentItem.classList.add("comment-item");
          // Display comments anonymously
          commentItem.innerHTML = `
                    <p>${comment.commentText}</p>
                    <p class="comment-timestamp">${
                      comment.timestamp
                        ? formatDateTime(comment.timestamp)
                        : "Just now"
                    }</p>
                `;
          commentsList.appendChild(commentItem);
        });
        commentsList.scrollTop = commentsList.scrollHeight; // Scroll to bottom
      },
      (error) => {
        console.error("Error fetching comments:", error);
        commentsList.innerHTML = `<p style="text-align: center; color: red;">Error loading comments.</p>`;
      }
    );
}

// --- Admin Blog Post Creation ---

blogImageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    imagePreview.src = "";
    imagePreview.style.display = "none";
  }
});

postBlogBtn.addEventListener("click", async () => {
  if (!currentLoggedInUser) {
    alert("Please sign in as admin to post a blog.");
    return;
  }

  const title = blogTitleInput.value.trim();
  const content = blogContentInput.value.trim();
  const imageFile = blogImageInput.files[0];

  if (!title || !content) {
    alert("Please fill in both title and content.");
    return;
  }

  postBlogBtn.disabled = true;
  blogStatus.style.color = "blue";
  blogStatus.textContent = "Posting blog...";

  let imageUrl = "";
  try {
    if (imageFile) {
      blogStatus.textContent = "Uploading image...";
      const storageRef = storage.ref(
        `blog_images/${Date.now()}_${imageFile.name}`
      );
      const snapshot = await storageRef.put(imageFile);
      imageUrl = await snapshot.ref.getDownloadURL();
      blogStatus.textContent = "Image uploaded. Saving post...";
    }

    await db.collection("blogPosts").add({
      title: title,
      content: content,
      imageUrl: imageUrl,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      authorUid: currentLoggedInUser.uid,
      authorEmail: currentLoggedInUser.email,
      likes: [], // Initialize with empty likes array
    });

    blogStatus.textContent = "Blog post published successfully!";
    blogStatus.style.color = "green";
    blogTitleInput.value = "";
    blogContentInput.value = "";
    blogImageInput.value = ""; // Clear file input
    imagePreview.src = "";
    imagePreview.style.display = "none";
  } catch (error) {
    console.error("Error posting blog:", error);
    blogStatus.textContent = "Error posting blog: " + error.message;
    blogStatus.style.color = "red";
  } finally {
    postBlogBtn.disabled = false;
  }
});

// --- Initial Load & Real-time Listeners (MODIFIED for Blog) ---
let allBlogPosts = []; // Global array to hold all blog posts

document.addEventListener("DOMContentLoaded", () => {
  // Initial section display
  showSection("league-content");

  // Header nav button listeners
  leagueBtn.addEventListener("click", () => showSection("league-content"));
  blogBtn.addEventListener("click", () => showSection("blog-section"));

  // Set default date for fixture generation to tomorrow (or today if for testing)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0); // Set to 3 PM
  startFixtureDateInput.value = tomorrow.toISOString().split("T")[0];

  // Listen for real-time updates to players collection
  db.collection("players").onSnapshot(
    (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() });
      });
      allPlayers = players;
      renderLeagueTable(players);
      renderPlayerForm(players);
      renderLiveBroadcast(players);
    },
    (error) => {
      console.error("Error fetching players:", error);
    }
  );

  // Listen for real-time updates to fixtures collection
  db.collection("fixtures")
    .orderBy("date", "asc")
    .onSnapshot(
      (snapshot) => {
        allFixtures = [];
        snapshot.forEach((doc) => {
          allFixtures.push({ id: doc.id, ...doc.data() });
        });

        let firstUpcomingIndex = allFixtures.findIndex((f) => !f.played);
        if (firstUpcomingIndex === -1) {
          currentCarouselPage = Math.floor(
            (allFixtures.length - 1) / matchesPerPage
          );
          if (currentCarouselPage < 0) currentCarouselPage = 0;
        } else {
          currentCarouselPage = Math.floor(firstUpcomingIndex / matchesPerPage);
        }

        renderFixturesCarousel(true);
        if (auth.currentUser) {
          fetchAndPopulateFixturesForAdmin();
        }
      },
      (error) => {
        console.error("Error fetching fixtures:", error);
      }
    );

  // Listen for real-time updates to blogPosts collection (NEW)
  db.collection("blogPosts")
    .orderBy("timestamp", "desc")
    .onSnapshot(
      (snapshot) => {
        allBlogPosts = []; // Clear global array
        snapshot.forEach((doc) => {
          allBlogPosts.push({ id: doc.id, ...doc.data() });
        });
        renderBlogPosts(allBlogPosts);

        // If a modal is open for a post that just got updated (e.g., liked), re-render it
        if (currentOpenedBlogPostId) {
          const updatedPost = allBlogPosts.find(
            (p) => p.id === currentOpenedBlogPostId
          );
          if (updatedPost) {
            // Keep the modal open, just update its content
            modalBlogTitle.textContent = updatedPost.title;
            modalBlogTimestamp.textContent = `By ${
              updatedPost.authorEmail || "Admin"
            } on ${formatBlogTimestamp(updatedPost.timestamp)}`;
            modalBlogImage.src =
              updatedPost.imageUrl ||
              "https://placehold.co/800x400/cccccc/333333?text=No+Image";
            modalBlogImage.style.display = updatedPost.imageUrl
              ? "block"
              : "none";
            modalBlogContent.textContent = updatedPost.content;

            if (
              currentLoggedInUser &&
              updatedPost.likes &&
              updatedPost.likes.includes(currentLoggedInUser.uid)
            ) {
              likeBlogBtn.classList.add("liked");
              likeBlogBtn.innerHTML = `<i class="fas fa-heart"></i> <span id="like-count">${updatedPost.likes.length}</span> Likes`;
            } else {
              likeBlogBtn.classList.remove("liked");
              likeBlogBtn.innerHTML = `<i class="far fa-heart"></i> <span id="like-count">${
                updatedPost.likes ? updatedPost.likes.length : 0
              }</span> Likes`;
            }
          }
        }
      },
      (error) => {
        console.error("Error fetching blog posts:", error);
        blogPostsContainer.innerHTML = `<p style="text-align: center; color: red;">Error loading blog posts.</p>`;
      }
    );

  // Carousel navigation - these now just update the page and re-apply transform
  document.getElementById("prev-fixtures").addEventListener("click", () => {
    if (currentCarouselPage > 0) {
      currentCarouselPage--;
      renderFixturesCarousel(); // No 'true' needed, just move existing content
    }
  });

  document.getElementById("next-fixtures").addEventListener("click", () => {
    const maxPages = Math.ceil(allFixtures.length / matchesPerPage);
    if (currentCarouselPage < maxPages - 1) {
      currentCarouselPage++;
      renderFixturesCarousel(); // No 'true' needed, just move existing content
    }
  });
});

// 4. Fetch and Display Player Form
function renderPlayerForm(players) {
  const playerFormList = document.getElementById("player-form-list");
  playerFormList.innerHTML = ""; // Clear existing player forms

  players.forEach((player) => {
    const playerFormItem = document.createElement("div");
    playerFormItem.classList.add("player-form-item");

    const formIconsHtml = (player.form || [])
      .map((outcome) => {
        let className = "";
        if (outcome === "W") className = "win";
        else if (outcome === "L") className = "loss";
        else if (outcome === "D") className = "draw";
        return `<span class="status-icon ${className}"></span>`;
      })
      .join("");

    playerFormItem.innerHTML = `
            <strong>${player.name}</strong>
            <div class="form-icons">
                ${formIconsHtml}
            </div>
        `;
    playerFormList.appendChild(playerFormItem);
  });
}

// --- Initial Load & Real-time Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  // Set default date for fixture generation to tomorrow (or today if for testing)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  startFixtureDateInput.value = tomorrow.toISOString().split("T")[0];

  // Listen for real-time updates to players collection
  db.collection("players").onSnapshot(
    (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() });
      });
      allPlayers = players; // Store for admin use (e.g., player existence check)
      renderLeagueTable(players);
      renderPlayerForm(players);
    },
    (error) => {
      console.error("Error fetching players:", error);
    }
  );

  // Listen for real-time updates to fixtures collection
  db.collection("fixtures")
    .orderBy("date", "asc")
    .onSnapshot(
      (snapshot) => {
        allFixtures = [];
        snapshot.forEach((doc) => {
          allFixtures.push({ id: doc.id, ...doc.data() });
        });

        // Determine current carousel page to show upcoming matches first
        let firstUpcomingIndex = allFixtures.findIndex((f) => !f.played);
        if (firstUpcomingIndex === -1) {
          // All matches played, go to last page
          currentCarouselPage = Math.floor(
            (allFixtures.length - 1) / matchesPerPage
          );
          if (currentCarouselPage < 0) currentCarouselPage = 0; // Handle case with no fixtures
        } else {
          // Set carousel page to show the first upcoming match at the start of a 10-match block
          currentCarouselPage = Math.floor(firstUpcomingIndex / matchesPerPage);
        }

        renderFixturesCarousel();
        // If admin is logged in, refresh the dropdown
        if (auth.currentUser) {
          fetchAndPopulateFixturesForAdmin();
        }
      },
      (error) => {
        console.error("Error fetching fixtures:", error);
      }
    );

  // Carousel navigation
  document.getElementById("prev-fixtures").addEventListener("click", () => {
    if (currentCarouselPage > 0) {
      currentCarouselPage--;
      renderFixturesCarousel();
    }
  });

  document.getElementById("next-fixtures").addEventListener("click", () => {
    const maxPages = Math.ceil(allFixtures.length / matchesPerPage);
    if (currentCarouselPage < maxPages - 1) {
      currentCarouselPage++;
      renderFixturesCarousel();
    }
  });
});
