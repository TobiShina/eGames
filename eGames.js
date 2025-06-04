// 1. Firebase Configuration (Replace with your actual Firebase config)
const firebaseConfig = {
  apiKey: "AIzaSyDr2Rbf9OoFvnsIokMc79bKghON1sya-Q8",
  authDomain: "egames-ff5bd.firebaseapp.com",
  databaseURL: "https://egames-ff5bd-default-rtdb.firebaseio.com",
  projectId: "egames-ff5bd",
  storageBucket: "egames-ff5bd.firebasestorage.app",
  messagingSenderId: "194726940079",
  appId: "1:194726940079:web:07dcf373dece3d42b7b35a",
  measurementId: "G-MY0VWRJ68H",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables for fixture carousel
let allFixtures = [];
let currentFixtureIndex = 0;
const matchesPerCarousel = 10; // Display 10 matches per carousel view

// --- Helper Functions ---

// Function to calculate match outcome icon class
function getOutcomeIconClass(homeScore, awayScore, isHomeTeam) {
  if (homeScore === null || awayScore === null) {
    return ""; // No icon if score not entered yet
  }
  if (homeScore > awayScore) {
    // Home team won
    return isHomeTeam ? "win" : "loss";
  } else if (homeScore < awayScore) {
    // Away team won
    return isHomeTeam ? "loss" : "win";
  } else {
    // Draw
    return "draw";
  }
}

// Function to format date and time
function formatDateTime(timestamp) {
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

// Function to update team stats based on match result
async function updateTeamStats(teamName, resultType, goalsFor, goalsAgainst) {
  const teamRef = db.collection("teams").doc(teamName);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(teamRef);
    if (!doc.exists) {
      console.error("Team not found:", teamName);
      return;
    }

    const data = doc.data();
    let P = data.P + 1;
    let W = data.W;
    let D = data.D;
    let L = data.L;
    let GF = data.GF + goalsFor;
    let GA = data.GA + goalsAgainst;
    let PTS = data.PTS;
    let form = data.form || [];

    switch (resultType) {
      case "win":
        W++;
        PTS += 3;
        form.push("W");
        break;
      case "draw":
        D++;
        PTS += 1;
        form.push("D");
        break;
      case "loss":
        L++;
        form.push("L");
        break;
    }

    // Keep only the last 5 form results
    if (form.length > 5) {
      form = form.slice(-5);
    }

    const GD = GF - GA;

    transaction.update(teamRef, { P, W, D, L, GF, GA, GD, PTS, form });
  });
}

// --- Main Data Fetching and Display Functions ---

// 2. Fetch and Display League Table
function renderLeagueTable(teams) {
  const tableBody = document.querySelector("#league-table tbody");
  tableBody.innerHTML = ""; // Clear existing rows

  // Sort teams: 1. by Points (desc), 2. by Goal Difference (desc), 3. by Goals For (desc)
  teams.sort((a, b) => {
    if (b.PTS !== a.PTS) {
      return b.PTS - a.PTS;
    }
    if (b.GD !== a.GD) {
      return b.GD - a.GD;
    }
    return b.GF - a.GF;
  });

  teams.forEach((team, index) => {
    const row = tableBody.insertRow();
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${team.name}</td>
            <td>${team.P}</td>
            <td>${team.W}</td>
            <td>${team.D}</td>
            <td>${team.L}</td>
            <td>${team.GF}</td>
            <td>${team.GA}</td>
            <td>${team.GD}</td>
            <td>${team.PTS}</td>
        `;
  });
}

// 3. Fetch and Display Fixture Schedule (Carousel)
function renderFixturesCarousel() {
  const carousel = document.getElementById("fixture-carousel");
  carousel.innerHTML = ""; // Clear existing fixtures

  const startIndex = currentFixtureIndex;
  const endIndex = Math.min(
    startIndex + matchesPerCarousel,
    allFixtures.length
  );

  // Apply transform for sliding effect
  carousel.style.transform = `translateX(-${startIndex * (250 + 20)}px)`; // 250px card width + 20px margin

  for (let i = startIndex; i < endIndex; i++) {
    const fixture = allFixtures[i];
    const fixtureCard = document.createElement("div");
    fixtureCard.classList.add("fixture-card");

    const homeIconClass = getOutcomeIconClass(
      fixture.homeScore,
      fixture.awayScore,
      true
    );
    const awayIconClass = getOutcomeIconClass(
      fixture.homeScore,
      fixture.awayScore,
      false
    );

    fixtureCard.innerHTML = `
            <p class="date-time">${formatDateTime(fixture.date)}</p>
            <p>
                <span class="team-name">${fixture.homeTeam}</span>
                <span class="score">${
                  fixture.homeScore !== null ? fixture.homeScore : "-"
                }</span>
                <span class="status-icon ${homeIconClass}"></span>
            </p>
            <p>vs</p>
            <p>
                <span class="team-name">${fixture.awayTeam}</span>
                <span class="score">${
                  fixture.awayScore !== null ? fixture.awayScore : "-"
                }</span>
                <span class="status-icon ${awayIconClass}"></span>
            </p>
            <p class="matchday">Matchday: ${fixture.matchday}</p>
        `;
    carousel.appendChild(fixtureCard);
  }
}

// 4. Fetch and Display Team Form
function renderTeamForm(teams) {
  const teamFormList = document.getElementById("team-form-list");
  teamFormList.innerHTML = ""; // Clear existing team forms

  teams.forEach((team) => {
    const teamFormItem = document.createElement("div");
    teamFormItem.classList.add("team-form-item");

    const formIconsHtml = team.form
      .map((outcome) => {
        let className = "";
        if (outcome === "W") className = "win";
        else if (outcome === "L") className = "loss";
        else if (outcome === "D") className = "draw";
        return `<span class="status-icon ${className}"></span>`;
      })
      .join("");

    teamFormItem.innerHTML = `
            <strong>${team.name}</strong>
            <div class="form-icons">
                ${formIconsHtml}
            </div>
        `;
    teamFormList.appendChild(teamFormItem);
  });
}

// --- Event Listeners and Initial Load ---

document.addEventListener("DOMContentLoaded", () => {
  // Listen for real-time updates to teams collection
  db.collection("teams").onSnapshot(
    (snapshot) => {
      const teams = [];
      snapshot.forEach((doc) => {
        teams.push({ id: doc.id, ...doc.data() });
      });
      renderLeagueTable(teams);
      renderTeamForm(teams); // Re-render team form as well
    },
    (error) => {
      console.error("Error fetching teams:", error);
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
        renderFixturesCarousel();
      },
      (error) => {
        console.error("Error fetching fixtures:", error);
      }
    );

  // Carousel navigation
  document.getElementById("prev-fixtures").addEventListener("click", () => {
    if (currentFixtureIndex > 0) {
      currentFixtureIndex = Math.max(
        0,
        currentFixtureIndex - matchesPerCarousel
      );
      renderFixturesCarousel();
    }
  });

  document.getElementById("next-fixtures").addEventListener("click", () => {
    if (currentFixtureIndex + matchesPerCarousel < allFixtures.length) {
      currentFixtureIndex = Math.min(
        allFixtures.length - matchesPerCarousel,
        currentFixtureIndex + matchesPerCarousel
      );
      renderFixturesCarousel();
    }
  });
});

// --- IMPORTANT: How to input scores and trigger updates ---
// You will manually update the 'homeScore' and 'awayScore' fields in your Firebase Firestore console.
// When you update these fields for a fixture, and set 'played' to true,
// the following logic (which you would ideally run server-side or via a Cloud Function)
// will be triggered to update the team stats.
// For this client-side example, I'll provide a simplified way to simulate this.
// In a real application, you would secure this update process significantly.

// Simplified example of how to manually trigger a match update (for demonstration only)
// In a real scenario, this would be an admin interface or a Firebase Cloud Function.
async function simulateMatchUpdate(fixtureId, homeScore, awayScore) {
  const fixtureRef = db.collection("fixtures").doc(fixtureId);
  try {
    const fixtureDoc = await fixtureRef.get();
    if (!fixtureDoc.exists) {
      console.error("Fixture not found:", fixtureId);
      return;
    }
    const fixtureData = fixtureDoc.data();

    if (fixtureData.played) {
      console.log("Fixture already played.");
      return;
    }

    const homeTeam = fixtureData.homeTeam;
    const awayTeam = fixtureData.awayTeam;

    // Update fixture in Firestore
    await fixtureRef.update({
      homeScore: homeScore,
      awayScore: awayScore,
      played: true,
    });

    // Determine outcomes
    if (homeScore > awayScore) {
      await updateTeamStats(homeTeam, "win", homeScore, awayScore);
      await updateTeamStats(awayTeam, "loss", awayScore, homeScore);
    } else if (homeScore < awayScore) {
      await updateTeamStats(homeTeam, "loss", homeScore, awayScore);
      await updateTeamStats(awayTeam, "win", awayScore, homeScore);
    } else {
      await updateTeamStats(homeTeam, "draw", homeScore, awayScore);
      await updateTeamStats(awayTeam, "draw", awayScore, homeScore);
    }
    console.log(
      `Match ${homeTeam} vs ${awayTeam} updated with score ${homeScore}-${awayScore}`
    );
  } catch (error) {
    console.error("Error updating match:", error);
  }
}

// Example usage (you would call this from your console or an admin UI):
// simulateMatchUpdate('fixture1', 2, 1); // Assuming 'fixture1' is a document ID in your fixtures collection
// Be careful with this, as it directly updates Firestore and triggers the calculation.
