// Public View JavaScript (public.js)

// 1. Firebase Configuration (Replace with your actual Firebase config)
const firebaseConfig = {
    apiKey: "AIzaSyB-pqHj-YGCBpviro3NHQipop-nurT38lw",
    authDomain: "egamesleague.firebaseapp.com",
    projectId: "egamesleague",
    // storageBucket: "YOUR_STORAGE_BUCKET", // Storage not needed in public view
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
const COUNTRY_FLAGS = {
    'Algeria': '🇩🇿', 'Angola': '🇦🇴', 'Benin': '🇧🇯', 'Botswana': '🇧🇼',
    'Burkina Faso': '🇧🇫', 'Burundi': '🇧🇮', 'Cameroon': '🇨🇲', 'Cape Verde': '🇨🇻',
    'Central African Republic': '🇨🇫', 'Chad': '🇹🇩', 'Comoros': '🇰🇲', 'Congo': '🇨🇬',
    'Ivory Coast': '🇨🇮', 'Djibouti': '🇩🇯', 'Egypt': '🇪🇬', 'Equatorial Guinea': '🇬🇶',
    'Eritrea': '🇪🇷', 'Eswatini': '🇸🇿', 'Ethiopia': '🇪🇹', 'Gabon': '🇬🇦',
    'Gambia': '🇬🇲', 'Ghana': '🇬🇭', 'Guinea': '🇬🇳', 'Guinea-Bissau': '🇬🇼',
    'Kenya': '🇰🇪', 'Lesotho': '🇱🇸', 'Liberia': '🇱🇷', 'Libya': '🇱🇾',
    'Madagascar': '🇲🇬', 'Malawi': '🇲🇼', 'Mali': '🇲🇱', 'Mauritania': '🇲🇷',
    'Mauritius': '🇲🇺', 'Morocco': '🇲🇦', 'Mozambique': '🇲🇿', 'Namibia': '🇳🇦',
    'Niger': '🇳🇪', 'Nigeria': '🇳🇬', 'Rwanda': '🇷🇼', 'Sao Tome and Principe': '🇸🇹',
    'Senegal': '🇸🇳', 'Seychelles': '🇸🇨', 'Sierra Leone': '🇸🇱', 'Somalia': '🇸🇴',
    'South Africa': '🇿🇦', 'South Sudan': '🇸🇸', 'Sudan': '🇸🇩', 'Tanzania': '🇹🇿',
    'Togo': '🇹🇬', 'Tunisia': '🇹🇳', 'Uganda': '🇺🇬', 'Zambia': '🇿🇲', 'Zimbabwe': '🇿🇼'
};
const DEFAULT_FLAG = '🌍';
let currentLoggedInUser = null;

// --- DOM Elements ---
const authButton = document.getElementById('auth-button');
const userStatusSpan = document.getElementById('user-status');
const scoreDateFilter = document.getElementById('score-date-filter');
const liveScoresContainer = document.getElementById('live-scores-container');
const liveStreamsList = document.getElementById('live-streams-list');

// --- Helper Functions ---

function formatDateTime(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') { return 'N/A'; }
    const date = timestamp.toDate();
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString('en-US', options);
}

function getCountryFlag(countryName) {
    return COUNTRY_FLAGS[countryName] || DEFAULT_FLAG;
}

// --- Authentication ---

auth.onAuthStateChanged(user => {
    currentLoggedInUser = user;
    if (user) {
        userStatusSpan.textContent = `Signed in as: ${user.displayName || user.email}`;
        authButton.textContent = 'Sign Out';
    } else {
        userStatusSpan.textContent = 'Not signed in';
        authButton.textContent = 'Sign in with Google to Post';
    }
    // Re-render scores to enable/disable comment functionality
    renderLiveScores();
});

authButton.addEventListener('click', () => {
    if (auth.currentUser) {
        auth.signOut().then(() => { console.log('User signed out.'); currentLoggedInUser = null; }).catch((error) => { console.error('Sign out error:', error); });
    } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).then(() => { /* handled by onAuthStateChanged */ }).catch((error) => { alert(`Sign in failed: ${error.message}`); });
    }
});

// --- Live Broadcast (Streams) ---

function renderLiveBroadcast(players) {
    liveStreamsList.innerHTML = '';
    // Filter out players without Twitch URL and sort
    const streamablePlayers = players.filter(p => p.twitchUrl).sort((a, b) => a.name.localeCompare(b.name));

    streamablePlayers.forEach(player => {
        const streamItem = document.createElement('div');
        streamItem.classList.add('live-stream-item');
        streamItem.innerHTML = `<a href="${player.twitchUrl}" target="_blank" rel="noopener noreferrer">${player.name}</a><i class="fas fa-tv"></i>`;
        liveStreamsList.appendChild(streamItem);
    });
    if (liveStreamsList.children.length === 0) {
        liveStreamsList.innerHTML = `<p style="text-align: center; color: #6c757d;">No live streams available yet.</p>`;
    }
}

// --- Live Scores and Comments ---

async function renderComments(matchId) {
    const commentsContainer = document.querySelector(`.comment-content[data-match-id="${matchId}"]`);
    const toggleButton = document.querySelector(`.comment-section-toggle[data-match-id="${matchId}"]`);
    if (!commentsContainer) return;

    const commentsList = commentsContainer.querySelector('.comments-list');
    const commentCountSpan = toggleButton.querySelector('.comment-count-number');
    const commentForm = commentsContainer.querySelector('.comment-post-form');
    const commentInput = commentsContainer.querySelector('textarea');
    const postBtn = commentsContainer.querySelector('.comment-post-btn');
    const authMessage = commentsContainer.querySelector('.comment-auth-message');

    commentsList.innerHTML = `<p style="text-align: center; color: #6c757d;">Loading comments...</p>`;

    // Set up form status
    if (currentLoggedInUser) {
        if (authMessage) authMessage.remove();
        commentForm.style.display = 'block';
    } else {
        commentForm.style.display = 'none';
        if (!authMessage) {
            const msg = document.createElement('p');
            msg.className = 'comment-auth-message';
            msg.style.color = 'orange';
            msg.textContent = 'Please sign in with Google above to post a comment.';
            commentsList.before(msg);
        }
    }

    // Set up real-time listener for comments
    db.collection('esportsMatches').doc(matchId).collection('comments').orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            let totalComments = snapshot.size;
            commentsList.innerHTML = '';

            if (snapshot.empty) {
                commentsList.innerHTML = `<p style="text-align: center; color: #6c757d;">No comments yet. Be the first!</p>`;
            } else {
                snapshot.forEach(doc => {
                    const comment = { id: doc.id, ...doc.data() };
                    const isLiked = currentLoggedInUser && comment.likes && comment.likes.includes(currentLoggedInUser.uid);
                    const likeIconClass = isLiked ? 'fas' : 'far';
                    const likeCount = comment.likes ? comment.likes.length : 0;

                    const commentItem = document.createElement('div');
                    commentItem.className = 'comment-item';
                    commentItem.innerHTML = `
                        <div class="comment-header">
                            <div><span class="comment-author">${comment.authorName}</span></div>
                            <span class="comment-time">${comment.timestamp ? formatDateTime(comment.timestamp) : 'Just now'}</span>
                        </div>
                        <p class="comment-text">${comment.commentText}</p>
                        <div class="comment-actions">
                            <button class="like-button" data-comment-id="${doc.id}" ${!currentLoggedInUser ? 'disabled' : ''}>
                                <i class="${likeIconClass} fa-heart"></i>
                                <span>${likeCount}</span>
                            </button>
                        </div>
                    `;
                    commentsList.appendChild(commentItem);

                    // Attach like listener
                    commentItem.querySelector('.like-button').addEventListener('click', () => toggleLike(matchId, doc.id));
                });
            }
            commentCountSpan.textContent = totalComments;
        });

    // Attach post comment listener once
    if (!commentForm.dataset.listenerAttached) {
        postBtn.addEventListener('click', () => postComment(matchId, commentInput, postBtn));
        commentForm.dataset.listenerAttached = 'true';
    }
}

// Comment Posting Logic
async function postComment(matchId, commentInput, postBtn) {
    if (!currentLoggedInUser) return; // Should be disabled by UI, but good check

    const commentText = commentInput.value.trim();
    if (commentText.length === 0) return;

    postBtn.disabled = true;

    try {
        await db.collection('esportsMatches').doc(matchId).collection('comments').add({
            commentText: commentText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            authorName: currentLoggedInUser.displayName || currentLoggedInUser.email,
            authorUid: currentLoggedInUser.uid,
            likes: [],
        });
        commentInput.value = '';
    } catch (error) {
        console.error("Error posting comment:", error);
        alert('Failed to post comment. Please try again.');
    } finally {
        postBtn.disabled = false;
    }
}

// Like/Unlike Logic
async function toggleLike(matchId, commentId) {
    if (!currentLoggedInUser) return;

    const commentRef = db.collection('esportsMatches').doc(matchId).collection('comments').doc(commentId);
    const userUid = currentLoggedInUser.uid;

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(commentRef);
            if (!doc.exists) return;

            const currentLikes = doc.data().likes || [];
            let newLikes = [...currentLikes];

            if (newLikes.includes(userUid)) {
                // Unlike: remove UID
                newLikes = newLikes.filter(uid => uid !== userUid);
            } else {
                // Like: add UID
                newLikes.push(userUid);
            }
            transaction.update(commentRef, { likes: newLikes });
        });
    } catch (error) {
        console.error("Error liking/unliking comment:", error);
    }
}

// Toggling Collapsible Section
function toggleCommentSection(matchId) {
    const content = document.querySelector(`.comment-content[data-match-id="${matchId}"]`);
    if (!content) return;

    if (content.classList.contains('active')) {
        content.classList.remove('active');
    } else {
        // Load comments before expanding if not yet loaded (initial load handled by renderLiveScores)
        renderComments(matchId);
        content.classList.add('active');
    }
}

// Main Scores Renderer (Modified to include comment structure)
async function renderLiveScores() {
    const filterDateStr = scoreDateFilter.value;
    if (!filterDateStr) {
        liveScoresContainer.innerHTML = `<p style="text-align: center; color: #6c757d;">Select a date to view scheduled matches.</p>`;
        return;
    }

    const startOfDay = firebase.firestore.Timestamp.fromDate(new Date(filterDateStr + 'T00:00:00'));
    const endOfDay = firebase.firestore.Timestamp.fromDate(new Date(filterDateStr + 'T23:59:59'));

    liveScoresContainer.innerHTML = `<p style="text-align: center; color: blue;">Loading matches for ${filterDateStr}...</p>`;

    try {
        // Fetch matches
        const snapshot = await db.collection('esportsMatches')
            .where('date', '>=', startOfDay)
            .where('date', '<=', endOfDay)
            .orderBy('date', 'asc')
            .get();

        if (snapshot.empty) {
            liveScoresContainer.innerHTML = `<p style="text-align: center; color: #6c757d;">No matches scheduled for this date.</p>`;
            return;
        }

        // Grouping
        const groupedMatches = {};
        snapshot.forEach(doc => {
            const match = { id: doc.id, ...doc.data() };
            const country = match.country || 'Unknown';
            const tournament = match.tournamentName || 'General';

            if (!groupedMatches[country]) groupedMatches[country] = {};
            if (!groupedMatches[country][tournament]) groupedMatches[country][tournament] = [];
            groupedMatches[country][tournament].push(match);
        });

        // Rendering
        let html = '';
        const countries = Object.keys(groupedMatches).sort();

        countries.forEach(country => {
            html += `<div class="country-block">`;
            html += `<div class="country-header"><span class="flag">${getCountryFlag(country)}</span>${country}</div>`;

            const tournaments = Object.keys(groupedMatches[country]);
            tournaments.forEach(tournament => {
                html += `<div class="tournament-block">`;
                html += `<div class="tournament-header">${tournament}</div>`;

                groupedMatches[country][tournament].forEach(match => {
                    const statusText = match.status === 'upcoming' ? formatDateTime(match.date).split(', ')[1] : match.status.toUpperCase();
                    const score = match.score1 !== null ? `${match.score1} - ${match.score2}` : 'vs';
                    const liveIndicator = match.isLive ? `<div class="live-indicator blinking"></div>` : `<div class="live-indicator" style="background-color: transparent;"></div>`;

                    html += `
                        <div class="match-wrapper">
                            <div class="match-item">
                                ${liveIndicator}
                                <div class="match-teams">${match.team1} vs ${match.team2}</div>
                                <div class="match-score">${score}</div>
                                <div class="match-time">${statusText}</div>
                            </div>

                            <button class="comment-section-toggle" data-match-id="${match.id}">
                                <span class="comment-toggle-text">
                                    <i class="fas fa-comment"></i>
                                    Comments (<span class="comment-count-number">...</span>)
                                </span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            
                            <div class="comment-content" data-match-id="${match.id}">
                                <div class="comments-list"></div>
                                <div class="comment-post-form">
                                    <textarea placeholder="Post a comment..."></textarea>
                                    <button class="comment-post-btn">Post</button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`; // End tournament-block
            });
            html += `</div>`; // End country-block
        });

        liveScoresContainer.innerHTML = html;

        // Attach listeners for toggling comments
        document.querySelectorAll('.comment-section-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const matchId = e.currentTarget.dataset.matchId;
                toggleCommentSection(matchId);
            });
            // Initial call to render comments and get the count
            renderComments(btn.dataset.matchId);
        });

    } catch (error) {
        console.error("Error rendering live scores:", error);
        liveScoresContainer.innerHTML = `<p style="text-align: center; color: red;">Error loading scores: ${error.message}</p>`;
    }
}

// --- Initial Load ---

document.addEventListener('DOMContentLoaded', () => {
    // Set default filter date to today
    scoreDateFilter.valueAsDate = new Date();
    scoreDateFilter.addEventListener('change', renderLiveScores);

    // Initial load of streams and scores
    db.collection('players').get().then(snapshot => {
        const players = [];
        snapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
        renderLiveBroadcast(players);
    });

    renderLiveScores();
});