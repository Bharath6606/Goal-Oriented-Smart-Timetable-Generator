let subjectCount = 0, activityCount = 0, timerInterval, secondsLeft = 3600;
const colorPalette = ['#4361ee', '#f72585', '#7209b7', '#4cc9f0', '#ff9f43', '#1dd1a1', '#560bad'];
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFPUlEegG3PwBHY8TQfrMNX_rZosYlo212UG7XTGtyNxqIWywSirksSaRXdr9sONXZ/exec";

const motivationalQuotes = {
    coding: "Talk is cheap. Show me the code.",
    math: "Mathematics is the language in which God has written the universe.",
    science: "Equipped with his five senses, man explores the universe around him.",
    default: "Focus on being productive instead of busy.",
    exam: "The secret of getting ahead is getting started."
};

/** --- NEW: AUTO-RECOGNITION ENGINE --- **/
async function checkExistingUser() {
    const studentID = document.getElementById("studentID").value.trim();
    if (studentID.length < 3) return; 

    try {
        const response = await fetch(`${SCRIPT_URL}?studentID=${encodeURIComponent(studentID)}`);
        const cloudData = await response.json();

        if (cloudData && !cloudData.error) {
            localStorage.setItem(`timetable_${studentID}`, JSON.stringify(cloudData));
            localStorage.setItem("lastActiveStudent", studentID);
            
            const status = document.getElementById("idStatus");
            if(status) {
                status.style.display = "block";
                status.innerHTML = `<i class="fas fa-check-circle"></i> Profile Found! Opening your Strategy...`;
                status.className = "small mt-1 text-success fw-bold";
            }

            setTimeout(() => { window.location.href = "timetable.html"; }, 1000);
        }
    } catch (e) { console.log("New user session."); }
}

/** --- CLOUD DATA RETRIEVAL --- **/
async function loadPreviousData() {
    const studentID = document.getElementById("studentID").value.trim();
    if (!studentID || studentID === "Guest") return;
    try {
        const response = await fetch(`${SCRIPT_URL}?studentID=${encodeURIComponent(studentID)}`);
        const result = await response.json();
        if (result && !result.error) {
            if (confirm(`Welcome back ${studentID}! Load your saved timetable?`)) {
                localStorage.setItem(`timetable_${studentID}`, JSON.stringify(result));
                localStorage.setItem("lastActiveStudent", studentID);
                window.location.href = "timetable.html";
            }
        }
    } catch (e) { console.log("New student or offline."); }
}

/** --- INPUT UI ENGINE --- **/
function addSubject() {
    subjectCount++;
    const id = `subject-card-${subjectCount}`;
    const div = document.createElement("div");
    div.id = id;
    div.className = "subject-card p-3 mb-3 glass-card border-start border-4 animate-in";
    div.style.borderColor = colorPalette[subjectCount % colorPalette.length];
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-light text-dark">Subject #${subjectCount}</span>
            <button class="btn btn-outline-danger btn-xs border-0" onclick="document.getElementById('${id}').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div class="row g-2">
            <div class="col-md-5"><input type="text" class="form-control custom-input sub-name" placeholder="Subject Name"></div>
            <div class="col-md-2"><input type="number" class="form-control custom-input sub-prio" placeholder="Prio"></div>
            <div class="col-md-3"><input type="date" class="form-control custom-input sub-dead"></div>
            <div class="col-md-2">
                <select class="form-select custom-input sub-intensity"><option value="1">1x</option><option value="2">2x</option></select>
            </div>
            <div class="col-12 mt-2"><textarea class="form-control custom-input sub-syll" rows="1" placeholder="Topics (comma separated)"></textarea></div>
        </div>`;
    document.getElementById("subjectList").appendChild(div);
}

/** --- CORE STRATEGY ENGINE (WITH MERGE LOGIC) --- **/
async function generateTimetable() {
    const sid = document.getElementById("studentID").value.trim() || "Guest";
    
    // Load existing data to merge instead of replace
    let existingData = JSON.parse(localStorage.getItem(`timetable_${sid}`)) || {
        studentID: sid,
        subjects: [],
        activities: [],
        off: [],
        completedTopics: []
    };

    const data = { 
        studentID: sid, 
        start: document.getElementById("startTime").value, 
        end: document.getElementById("endTime").value, 
        lunch: document.getElementById("lunchTime").value, 
        subjects: existingData.subjects, 
        activities: [], 
        off: [], 
        completedTopics: existingData.completedTopics 
    };

    document.querySelectorAll('.subject-card').forEach((card, i) => {
        const name = card.querySelector('.sub-name').value;
        if (name) {
            const newTopics = card.querySelector('.sub-syll').value.split(',').map(t => t.trim()).filter(t => t !== "");
            const subIdx = data.subjects.findIndex(s => s.name.toLowerCase() === name.toLowerCase());

            if (subIdx > -1) {
                // Merge new topics into existing subject
                data.subjects[subIdx].topics = [...new Set([...data.subjects[subIdx].topics, ...newTopics])];
                data.subjects[subIdx].deadline = card.querySelector('.sub-dead').value;
                data.subjects[subIdx].intensity = parseInt(card.querySelector('.sub-intensity').value) || 1;
            } else {
                data.subjects.push({ 
                    name, 
                    priority: parseInt(card.querySelector('.sub-prio').value) || 1, 
                    deadline: card.querySelector('.sub-dead').value, 
                    intensity: parseInt(card.querySelector('.sub-intensity').value) || 1, 
                    topics: newTopics, 
                    color: colorPalette[(data.subjects.length) % colorPalette.length] 
                });
            }
        }
    });

    document.querySelectorAll('[id^="activity-"]').forEach(g => {
        const n = g.querySelector('.act-name').value, t = g.querySelector('.act-time').value;
        if (n && t) data.activities.push({ name: n, time: t });
    });

    ["Sat", "Sun"].forEach(day => { if(document.getElementById(`leave${day}`).checked) data.off.push(day === "Sat" ? "Saturday" : "Sunday"); });

    localStorage.setItem(`timetable_${sid}`, JSON.stringify(data));
    localStorage.setItem("lastActiveStudent", sid);
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    window.location.href = "timetable.html";
}

/** --- DASHBOARD ENGINE (WITH AUTO-DELETE) --- **/
async function displayTimetable() {
    const sid = localStorage.getItem("lastActiveStudent") || "Guest";
    let data = JSON.parse(localStorage.getItem(`timetable_${sid}`));
    if(!data) return;

    const container = document.getElementById("timetable");
    if(!container) return;
    container.innerHTML = ""; 
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let dailyBuckets = { "Monday": [], "Tuesday": [], "Wednesday": [], "Thursday": [], "Friday": [], "Saturday": [], "Sunday": [] };

    data.subjects.forEach(sub => {
        if (sub.deadline) {
            const dayOfDeadline = dayNames[new Date(sub.deadline).getDay()];
            sub.topics.forEach(t => dailyBuckets[dayOfDeadline].push({ s: sub.name, t, c: sub.color, i: sub.intensity }));
        }
    });

    const displayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    displayOrder.forEach(day => {
        const col = document.createElement("div"); col.className = "day-column";
        let html = `<div class="day-header d-flex justify-content-between align-items-center"><h6>${day}</h6><button class="btn btn-outline-danger btn-sm border-0 py-0" onclick="markSick('${day}')"><i class="fas fa-medkit"></i></button></div><div class="day-content">`;
        
        if(data.off.includes(day)){ html += `<div class="py-5 text-center text-muted small">RECOVERY OFF</div>`; }
        else {
            let curr = data.start;
            let topicsToday = dailyBuckets[day];
            while(timeToMin(curr) < timeToMin(data.end)){
                let next = add60(curr), act = data.activities.find(a => a.time === curr);
                if(curr === data.lunch) html += `<div class="time-slot lunch">Lunch Break</div>`;
                else if(act) html += `<div class="time-slot activity">${act.name}</div>`;
                else if(topicsToday.length > 0) {
                    let task = topicsToday.shift();
                    const key = `${task.s}-${task.t}`;
                    const isDone = data.completedTopics && data.completedTopics.includes(key);
                    
                    html += `<div class="time-slot" style="border-left-color: ${task.c}">
                                <span class="slot-time">${curr} - ${next}</span>
                                <div class="d-flex align-items-center">
                                    <input type="checkbox" class="form-check-input me-2" ${isDone?'checked':''} onchange="toggleTopic('${task.s}','${task.t}')">
                                    <div style="${isDone?'text-decoration:line-through;opacity:0.5':''}">
                                        <span class="slot-subject" style="color:${task.c}">${task.s}</span>
                                        <span class="slot-topic">${task.t}</span>
                                        ${isDone ? '<br><small class="text-danger" style="font-size:0.6rem">Deleting in 5m...</small>' : ''}
                                    </div>
                                </div>
                             </div>`;
                }
                curr = next;
            }
        }
        col.innerHTML = html + `</div>`; container.appendChild(col);
    });

    let total = data.subjects.reduce((a, s) => a + s.topics.length, 0);
    let done = data.completedTopics ? data.completedTopics.length : 0;
    let pct = total > 0 ? Math.round((done / total) * 100) : 0;
    
    if(document.getElementById("syllabusProgress")) document.getElementById("syllabusProgress").style.width = pct + "%";
    if(document.getElementById("progressText")) document.getElementById("progressText").innerText = `${pct}% Completion (${done}/${total})`;
    
    updateDeadlineUI(data.subjects);
    renderAnalytics(data);
}

function addActivity() {
    activityCount++;
    const id = `activity-${activityCount}`; 
    const div = document.createElement("div");
    div.id = id;
    div.className = "input-group mb-2 shadow-sm animate-in";
    div.innerHTML = `
        <span class="input-group-text bg-white"><i class="fas fa-clock text-info"></i></span>
        <input type="text" class="form-control custom-input act-name" placeholder="Activity (e.g. Gym)">
        <input type="time" class="form-control custom-input act-time">
        <button class="btn btn-outline-secondary" onclick="document.getElementById('${id}').remove()">
            <i class="fas fa-trash"></i>
        </button>`;
    document.getElementById("activityList").appendChild(div);
}

/** --- NEW: AUTO-DELETE LOGIC (5 MINS) --- **/
function toggleTopic(s, t) {
    const sid = localStorage.getItem("lastActiveStudent");
    let d = JSON.parse(localStorage.getItem(`timetable_${sid}`));
    const k = `${s}-${t}`;
    
    if(!d.completedTopics) d.completedTopics = [];
    
    if(!d.completedTopics.includes(k)) {
        d.completedTopics.push(k);
        // Sync checkmarks to cloud immediately
        fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(d) });

        // START 5 MINUTE DELETE TIMER
        setTimeout(() => {
            const freshData = JSON.parse(localStorage.getItem(`timetable_${sid}`));
            const subIdx = freshData.subjects.findIndex(sub => sub.name === s);
            if(subIdx > -1) {
                // Permanently remove topic from the subject's topics array
                freshData.subjects[subIdx].topics = freshData.subjects[subIdx].topics.filter(topic => topic !== t);
                // Remove from completedTopics tracking list
                freshData.completedTopics = freshData.completedTopics.filter(key => key !== k);
                
                localStorage.setItem(`timetable_${sid}`, JSON.stringify(freshData));
                displayTimetable();
                fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(freshData) });
            }
        }, 300000); // 5 Minutes
    } else {
        d.completedTopics = d.completedTopics.filter(x => x !== k);
    }
    
    localStorage.setItem(`timetable_${sid}`, JSON.stringify(d));
    displayTimetable();
}

/** --- UTILS --- **/
function timeToMin(t) { let [h, m] = t.split(":").map(Number); return h * 60 + m; }
function add60(t) { let [h, m] = t.split(":").map(Number); h++; return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`; }

function toggleTimer() {
    const btn = document.getElementById("startBtn");
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; btn.innerText = "Resume Session"; }
    else { btn.innerText = "Pause Session"; timerInterval = setInterval(() => { if (secondsLeft <= 0) { clearInterval(timerInterval); alert("Session done!"); resetTimer(); } else { secondsLeft--; updateTimerDisplay(); } }, 1000); }
}

function resetTimer() { clearInterval(timerInterval); timerInterval = null; secondsLeft = 3600; updateTimerDisplay(); if(document.getElementById("startBtn")) document.getElementById("startBtn").innerText = "Start Session"; }
function updateTimerDisplay() { const m = Math.floor(secondsLeft / 60), s = secondsLeft % 60; if(document.getElementById("timerDisplay")) document.getElementById("timerDisplay").innerText = `${m}:${s < 10 ? '0' + s : s}`; }

function renderAnalytics(d) {
    const canvas = document.getElementById('timeChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const hours = {}; let tot = 0; d.subjects.forEach(s => { hours[s.name] = s.topics.length; tot += s.topics.length; });
    if (window.myChart instanceof Chart) { window.myChart.destroy(); }
    window.myChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(hours), datasets: [{ data: Object.values(hours), backgroundColor: d.subjects.map(s => s.color) }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
}

function updateDeadlineUI(subjects) {
    const subName = document.getElementById("nextSubjectName");
    const countEl = document.getElementById("deadlineCountdown");
    if (!subName || !subjects || subjects.length === 0) return;
    let valid = subjects.filter(s => s.deadline).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    if (valid.length > 0) {
        let nearest = valid[0];
        let diff = new Date(nearest.deadline) - new Date();
        subName.innerText = nearest.name;
        countEl.innerText = diff > 0 ? `${Math.floor(diff / 86400000)} Days Left` : "D-DAY";
    }
}