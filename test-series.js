async function fetchAndRenderQuestions(streamName) {
  // Loading state show karein
  const container = document.getElementById('question-container');
  if(container) container.innerHTML = "<p>Loading daily fresh questions...</p>";

  try {
    const response = await fetch(`/api/generate-questions?stream=${encodeURIComponent(streamName)}`);
    const result = await response.json();

    if (result.success && result.data[streamName]) {
      const questions = result.data[streamName];
      renderUI(questions);
    } else {
      if(container) container.innerHTML = "<p>Failed to load questions. Please try again.</p>";
    }
  } catch (error) {
    console.error("Error fetching questions:", error);
  }
}

function renderUI(questions) {
  const container = document.getElementById('question-container');
  if (!container) return;

  container.innerHTML = questions.map((q, index) => `
    <div class="question-card" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
      <h4>Q${index + 1}: ${q.question}</h4>
      <ul style="list-style-type: none; padding: 0;">
        ${q.options.map((opt, i) => `
          <li><label><input type="radio" name="q_${q.id || index}" value="${i}"> ${opt}</label></li>
        `).join('')}
      </ul>
      <p style="font-size: 0.9em; color: #666; margin-top: 8px;">💡 <strong>Memory Trick:</strong> ${q.trick}</p>
    </div>
  `).join('');
}