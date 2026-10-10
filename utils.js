// 1. Daily Login Streak Tracker
function checkAndUpdateStreak() {
    const lastLogin = localStorage.getItem('edupro_last_login');
    let streak = parseInt(localStorage.getItem('edupro_streak') || '0');
    const today = new Date().toDateString();

    if (lastLogin !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastLogin === yesterday.toDateString()) {
            streak += 1; // Streak chalu hai
        } else if (lastLogin) {
            streak = 1; // Streak toot gayi, reset to 1
        } else {
            streak = 1; // Pehla din
        }
        localStorage.setItem('edupro_last_login', today);
        localStorage.setItem('edupro_streak', streak);
    }
    
    // UI par streak dikhane ke liye element update karein agar maujood ho
    const streakElement = document.getElementById('user-streak-counter');
    if (streakElement) {
        streakElement.innerText = `🔥 ${streak} Day Streak`;
    }
}

// 2. Test State Auto-Save (Anti-Loss Mechanism)
function saveTestProgress(testId, currentQuestionIndex, selectedAnswers, timeLeft) {
    const testState = {
        questionIndex: currentQuestionIndex,
        answers: selectedAnswers,
        timeRemaining: timeLeft,
        timestamp: Date.now()
    };
    localStorage.setItem(`test_draft_${testId}`, JSON.stringify(testState));
}

function loadTestProgress(testId) {
    const saved = localStorage.getItem(`test_draft_${testId}`);
    if (saved) {
        return JSON.parse(saved);
    }
    return null;
}