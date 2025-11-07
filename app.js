// ChewCheck Application JavaScript
// Handles all interactive features

let chewCount = 0;
let sessionStartTime = null;
let sessionActive = false;
let camera = null;
let stream = null;
let faceMesh = null;
let lastChewTime = 0;
let chewing = false;
const MOUTH_OPEN_THRESHOLD = 0.05;
const CHEW_COOLDOWN = 300; // ms

// DOM Elements
const nameModal = document.getElementById('nameModal');
const userNameInput = document.getElementById('userNameInput');
const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const chewCountEl = document.getElementById('chewCount');
const finalReport = document.getElementById('finalReport');
const darkModeToggle = document.getElementById('darkModeToggle');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Setup event listeners
  startBtn.addEventListener('click', startSession);
  stopBtn.addEventListener('click', stopSession);
  darkModeToggle.addEventListener('click', toggleDarkMode);
  historyBtn.addEventListener('click', showHistory);
  
  // Load dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  
  // Initialize face mesh
  initializeFaceMesh();
}

function initializeFaceMesh() {
  faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
  
  faceMesh.onResults(onFaceMeshResults);
}

function onFaceMeshResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
  
  const landmarks = results.multiFaceLandmarks[0];
  const mouthOpenRatio = getMouthOpenRatio(landmarks);
  const now = Date.now();
  
  if (mouthOpenRatio > MOUTH_OPEN_THRESHOLD && !chewing && (now - lastChewTime > CHEW_COOLDOWN)) {
    chewing = true;
  }
  
  if (mouthOpenRatio < MOUTH_OPEN_THRESHOLD && chewing) {
    chewCount++;
    chewing = false;
    lastChewTime = now;
    updateChewDisplay();
  }
}

function getMouthOpenRatio(landmarks) {
  const top = landmarks[13];
  const bottom = landmarks[14];
  const left = landmarks[78];
  const right = landmarks[308];
  
  const vertical = Math.abs(top.y - bottom.y);
  const horizontal = Math.abs(left.x - right.x);
  
  return vertical / horizontal;
}

function updateChewDisplay() {
  chewCountEl.textContent = chewCount;
  document.getElementById('liveChews').textContent = chewCount;
  
  if (sessionStartTime) {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    document.getElementById('liveTime').textContent = elapsed + 's';
    const chewsPerMin = (chewCount / elapsed) * 60;
    document.getElementById('liveChewsPerMin').textContent = chewsPerMin.toFixed(1);
    const consistency = Math.min(100, Math.round((chewCount / (elapsed / 2)) * 100));
    document.getElementById('liveConsistency').textContent = consistency + '%';
  }
}

async function startSession() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: { ideal: 30 } }
    });
    
    video.srcObject = stream;
    video.play();
    
    sessionStartTime = Date.now();
    sessionActive = true;
    chewCount = 0;
    chewing = false;
    lastChewTime = 0;
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    updateChewDisplay();
    finalReport.classList.add('hidden');
    
    const camera = new Camera(video, {
      onFrame: async () => {
        if (faceMesh) {
          await faceMesh.send({ image: video });
        }
      },
      width: 640,
      height: 480
    });
    camera.start();
    
  } catch (error) {
    console.error('Camera error:', error);
    alert('Could not access webcam. Please check permissions.');
  }
}

function stopSession() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  sessionActive = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
  const chewsPerMin = (chewCount / elapsedSec) * 60;
  const consistency = Math.min(100, Math.round((chewCount / (elapsedSec / 2)) * 100));
  
  // Update report
  document.getElementById('totalChews').textContent = chewCount;
  document.getElementById('sessionDuration').textContent = elapsedSec + 's';
  document.getElementById('chewsPerMin').textContent = chewsPerMin.toFixed(1);
  document.getElementById('consistency').textContent = consistency + '%';
  
  // Generate remark
  let remark = 'Start chewing to get feedback!';
  let remarkClass = '';
  
  if (chewCount < 5) {
    remark = '⚠️ You\'re chewing too little. Try to chew more!';
    remarkClass = 'poor';
  } else if (chewsPerMin < 20) {
    remark = '😐 Average chewing. Try to be consistent!';
    remarkClass = 'average';
  } else {
    remark = '✅ Great job! Very consistent chewing!';
    remarkClass = 'good';
  }
  
  const chewRemarkEl = document.getElementById('chewRemark');
  chewRemarkEl.textContent = remark;
  chewRemarkEl.className = 'remark ' + remarkClass;
  
  // Save session to history
  saveSessionToHistory({
    date: new Date().toLocaleString(),
    chews: chewCount,
    duration: elapsedSec,
    chewsPerMin: chewsPerMin.toFixed(1),
    consistency: consistency
  });
  
  finalReport.classList.remove('hidden');
}

function saveUserName() {
  const name = userNameInput.value.trim();
  if (name) {
    nameModal.classList.add('hidden');
    const greeting = document.querySelector('.greeting');
    greeting.textContent = `👋 Hello, ${name}! Ready to chew check?`;
    greeting.style.display = 'block';
  } else {
    alert('Please enter your name to continue.');
  }
}

function newSession() {
  chewCount = 0;
  sessionStartTime = null;
  chewing = false;
  lastChewTime = 0;
  updateChewDisplay();
  finalReport.classList.add('hidden');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  startSession();
}

function saveSession() {
  alert('Session saved! You can view it in the history.');
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
}

function showHistory() {
  const sessions = JSON.parse(localStorage.getItem('chewSessions') || '[]');
  historyList.innerHTML = '';
  
  if (sessions.length === 0) {
    historyList.innerHTML = '<p style="text-align: center; color: #999;">No sessions yet. Start chewing!</p>';
  } else {
    sessions.reverse().forEach((session, index) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <strong>Session ${index + 1}</strong> - ${session.date}<br>
        Chews: ${session.chews} | Duration: ${session.duration}s | Avg: ${session.chewsPerMin}/min | Consistency: ${session.consistency}%
      `;
      historyList.appendChild(div);
    });
  }
  
  historyModal.classList.remove('hidden');
}

function closeHistory() {
  historyModal.classList.add('hidden');
}

function saveSessionToHistory(session) {
  const sessions = JSON.parse(localStorage.getItem('chewSessions') || '[]');
  sessions.push(session);
  if (sessions.length > 10) sessions.shift();
  localStorage.setItem('chewSessions', JSON.stringify(sessions));
}

// Make functions globally available
window.saveUserName = saveUserName;
window.newSession = newSession;
window.saveSession = saveSession;
window.closeHistory = closeHistory;
