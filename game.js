// Game State
let gameData = null;
let gameState = {
    timeRemaining: 1200, // 20 minutes in seconds
    discoveredTraits: new Set(),
    viewedContent: new Set(),
    currentQuestions: [],
    availableResponses: {},
    timerInterval: null,
    debriefAnswers: [],
    synergyScore: 0
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadGameData();
    setupEventListeners();
});

async function loadGameData() {
    try {
        const response = await fetch('data.json');
        gameData = await response.json();
        initializeQuestions();
    } catch (error) {
        console.error('Error loading game data:', error);
    }
}

function initializeQuestions() {
    gameState.currentQuestions = [...gameData.intro_questions];
    gameState.currentQuestions.forEach(q => {
        gameState.availableResponses[q.id] = [...q.responses];
    });
}

function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', showContextScreen);
    document.getElementById('start-round1-btn').addEventListener('click', startRoundOne);
    document.getElementById('replay-btn').addEventListener('click', resetGame);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showContextScreen() {
    showScreen('context-screen');
}

function startRoundOne() {
    showScreen('round1-screen');
    renderTraits();
    displayQuestionOptions();
    startTimer();
}

function renderTraits() {
    const container = document.getElementById('traits-container');
    container.innerHTML = '';
    
    gameData.traits.forEach(trait => {
        const icon = document.createElement('div');
        icon.className = 'trait-icon';
        icon.id = `trait-${trait.id}`;
        icon.innerHTML = trait.icon;
        icon.title = trait.name;
        container.appendChild(icon);
    });
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    
    gameState.timerInterval = setInterval(() => {
        gameState.timeRemaining--;
        
        const minutes = Math.floor(gameState.timeRemaining / 60);
        const seconds = gameState.timeRemaining % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Visual warnings
        if (gameState.timeRemaining <= 60) {
            timerEl.classList.add('critical');
        } else if (gameState.timeRemaining <= 180) {
            timerEl.classList.add('warning');
        }
        
        if (gameState.timeRemaining <= 0) {
            endRoundOne();
        }
    }, 1000);
}

function displayQuestionOptions() {
    const optionsArea = document.getElementById('options-area');
    optionsArea.innerHTML = '';
    
    gameState.currentQuestions.forEach(question => {
        const hasResponses = gameState.availableResponses[question.id].length > 0;
        
        const btn = document.createElement('button');
        btn.className = `option-btn ${!hasResponses ? 'disabled' : ''}`;
        btn.textContent = question.text;
        btn.disabled = !hasResponses;
        
        if (hasResponses) {
            btn.addEventListener('click', () => selectQuestion(question));
        }
        
        optionsArea.appendChild(btn);
    });
}

function selectQuestion(question) {
    const availableResponses = gameState.availableResponses[question.id];
    if (availableResponses.length === 0) return;
    
    // Pick random response
    const randomIndex = Math.floor(Math.random() * availableResponses.length);
    const response = availableResponses[randomIndex];
    
    // Remove this response from pool
    gameState.availableResponses[question.id].splice(randomIndex, 1);
    
    // Display response
    displayResponse(response);
    
    // Mark as viewed
    gameState.viewedContent.add(response.id);
    
    // Check for trait discovery
    if (response.trait) {
        discoverTrait(response.trait);
    }
    
    // Update timer if cost
    if (response.time_cost > 0) {
        gameState.timeRemaining -= (response.time_cost * 60);
    }
}

function displayResponse(response) {
    const conversationArea = document.getElementById('conversation-area');
    
    // Clear previous and show new response
    conversationArea.innerHTML = '';
    
    const box = document.createElement('div');
    box.className = `response-box ${response.edge_color}`;
    
    const text = document.createElement('p');
    text.className = 'response-text';
    text.textContent = response.text;
    
    box.appendChild(text);
    conversationArea.appendChild(box);
    
    // If trait discovered, make it pulse intensely
    if (response.trait && !gameState.discoveredTraits.has(response.trait)) {
        setTimeout(() => box.classList.add('intense'), 100);
    }
    
    // Display follow-up options
    if (response.follow_ups && response.follow_ups.length > 0) {
        displayFollowUpOptions(response.follow_ups);
    } else {
        displayQuestionOptions();
    }
}

function displayFollowUpOptions(followUps) {
    const optionsArea = document.getElementById('options-area');
    optionsArea.innerHTML = '';
    
    followUps.forEach(followUp => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${followUp.prompt} (-${followUp.time_cost} min)`;
        btn.addEventListener('click', () => selectFollowUp(followUp));
        optionsArea.appendChild(btn);
    });
    
    // Add "Change topic" option
    const changeBtn = document.createElement('button');
    changeBtn.className = 'option-btn';
    changeBtn.textContent = 'Change topic (-1 min)';
    changeBtn.addEventListener('click', () => {
        gameState.timeRemaining -= 60;
        displayQuestionOptions();
    });
    optionsArea.appendChild(changeBtn);
}

function selectFollowUp(followUp) {
    // Mark as viewed
    gameState.viewedContent.add(followUp.id);
    
    // Display follow-up response
    displayResponse(followUp);
    
    // Check for trait discovery
    if (followUp.trait) {
        discoverTrait(followUp.trait);
    }
    
    // Update timer
    if (followUp.time_cost > 0) {
        gameState.timeRemaining -= (followUp.time_cost * 60);
    }
}

function discoverTrait(traitId) {
    if (gameState.discoveredTraits.has(traitId)) return;
    
    gameState.discoveredTraits.add(traitId);
    
    const icon = document.getElementById(`trait-${traitId}`);
    if (icon) {
        icon.classList.add('discovered');
    }
}

function endRoundOne() {
    clearInterval(gameState.timerInterval);
    startRoundTwo();
}

function startRoundTwo() {
    showScreen('round2-screen');
    
    // Combine core questions + random extras
    const coreQuestions = [...gameData.debrief_questions];
    const extraPool = [...gameData.extra_debrief_pool];
    
    // Shuffle and pick 5 extras
    for (let i = extraPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [extraPool[i], extraPool[j]] = [extraPool[j], extraPool[i]];
    }
    const selectedExtras = extraPool.slice(0, 5);
    
    const allQuestions = [...coreQuestions, ...selectedExtras];
    
    const container = document.getElementById('debrief-questions');
    container.innerHTML = '';
    
    allQuestions.forEach((question, index) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'debrief-question';
        
        const qText = document.createElement('p');
        qText.className = 'question-text';
        qText.textContent = `${index + 1}. ${question.text}`;
        qDiv.appendChild(qText);
        
        const answersDiv = document.createElement('div');
        answersDiv.className = 'answer-options';
        
        question.answers.forEach((answer, ansIndex) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.textContent = answer;
            btn.addEventListener('click', () => selectAnswer(question, ansIndex, btn, answersDiv));
            answersDiv.appendChild(btn);
        });
        
        qDiv.appendChild(answersDiv);
        container.appendChild(qDiv);
    });
}

function selectAnswer(question, selectedIndex, btn, answersDiv) {
    // Check if requirements were met
    const requirementsMet = question.requires.some(reqId => gameState.viewedContent.has(reqId));
    
    let isCorrect = false;
    
    if (!requirementsMet) {
        // If requirements not met, only "We didn't discuss that" is correct
        isCorrect = question.answers[selectedIndex] === "We didn't discuss that";
    } else {
        // Requirements met, check correct answer
        isCorrect = selectedIndex === question.correct;
    }
    
    // Disable all buttons in this question
    Array.from(answersDiv.children).forEach(b => {
        b.disabled = true;
        b.style.cursor = 'default';
    });
    
    // Mark selected answer
    btn.classList.add('selected');
    
    // Show correct/incorrect
    setTimeout(() => {
        if (isCorrect) {
            btn.classList.add('correct');
            gameState.synergyScore += 10;
        } else {
            btn.classList.add('incorrect');
            // Highlight correct answer
            const correctBtn = answersDiv.children[requirementsMet ? question.correct : question.answers.indexOf("We didn't discuss that")];
            if (correctBtn) correctBtn.classList.add('correct');
        }
        
        checkDebriefComplete();
    }, 300);
}

function checkDebriefComplete() {
    const allAnswered = Array.from(document.querySelectorAll('.answer-btn')).every(btn => btn.disabled);
    
    if (allAnswered) {
        const scoreEl = document.getElementById('debrief-score');
        scoreEl.textContent = `Synergy Score: ${gameState.synergyScore} points`;
        scoreEl.classList.remove('hidden');
        
        const finishBtn = document.getElementById('finish-btn');
        finishBtn.classList.remove('hidden');
        finishBtn.addEventListener('click', showFinalScreen);
    }
}

function showFinalScreen() {
    showScreen('final-screen');
    
    const metricsDiv = document.getElementById('final-metrics');
    metricsDiv.innerHTML = `
        <div class="metric-box">
            <span class="metric-value">${gameState.discoveredTraits.size}/6</span>
            <span class="metric-label">Core Traits Discovered</span>
        </div>
        <div class="metric-box">
            <span class="metric-value">${gameState.synergyScore}</span>
            <span class="metric-label">Synergy Score</span>
        </div>
    `;
}

function resetGame() {
    // Reset state
    gameState = {
        timeRemaining: 1200,
        discoveredTraits: new Set(),
        viewedContent: new Set(),
        currentQuestions: [],
        availableResponses: {},
        timerInterval: null,
        debriefAnswers: [],
        synergyScore: 0
    };
    
    initializeQuestions();
    showScreen('landing-screen');
}
