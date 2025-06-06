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

// Global variables
let allFixtures = [];
let allPlayers = []; // Store all players from Firestore
let currentCarouselPage = 0;
const matchesPerPage = 10; // Display 10 matches per carousel view

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

// --- Authentication Functions ---
auth.onAuthStateChanged((user) => {
  if (user) {
    userStatusSpan.textContent = `Logged in as: ${user.displayName}`;
    authButton.textContent = "Sign Out";
    adminPanel.style.display = "block"; // Show admin panel
    fetchAndPopulateFixturesForAdmin(); // Populate dropdown for score updates
  } else {
    userStatusSpan.textContent = "Not logged in";
    authButton.textContent = "Sign in with Google";
    adminPanel.style.display = "none"; // Hide admin panel
    selectFixtureDropdown.innerHTML =
      '<option value="">-- Select a match --</option>'; // Clear dropdown
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
        console.log("User signed in:", result.user.displayName);
      })
      .catch((error) => {
        console.error("Sign in error:", error);
        alert(`Sign in failed: ${error.message}`);
      });
  }
});

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
function renderFixturesCarousel() {
  const carousel = document.getElementById("fixture-carousel");
  carousel.innerHTML = ""; // Clear existing fixtures

  const startIndex = currentCarouselPage * matchesPerPage;
  const endIndex = Math.min(startIndex + matchesPerPage, allFixtures.length);

  const fixturesToShow = allFixtures.slice(startIndex, endIndex);

  // This transform is now for visual effect only, not for content slicing directly
  // If you want a smooth sliding animation, we'd need to change renderFixturesCarousel
  // to render all fixtures and then use transform to shift them.
  // For now, it will simply swap the content for the current page.
  carousel.style.transform = `translateX(-${startIndex * (250 + 20)}px)`; // (Card width + margin)

  // Handle case where no fixtures are available or current page becomes invalid
  if (fixturesToShow.length === 0 && allFixtures.length > 0) {
    if (currentCarouselPage > 0) {
      currentCarouselPage--;
      renderFixturesCarousel();
      return;
    }
  }

  fixturesToShow.forEach((fixture) => {
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
    carousel.appendChild(fixtureCard);
  });
}

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
