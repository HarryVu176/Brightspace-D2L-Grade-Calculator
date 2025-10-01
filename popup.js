document.addEventListener('DOMContentLoaded', function() {
  // Load grade data from storage
  loadGradeData();
  
  // Set up refresh button
  document.getElementById('refresh-btn').addEventListener('click', refreshGrades);
});

function loadGradeData() {
  chrome.storage.local.get('gradeData', function(data) {
    if (data.gradeData) {
      displayGrades(data.gradeData);
    } else {
      displayNoData();
    }
  });
}

function displayGrades(gradeData) {
  const { totals, details } = gradeData;
  const current = totals?.currentPoints ?? 0;
  const highest = totals?.highestPossiblePoints ?? 0;
  const max = totals?.totalMaxPoints ?? 0;

  // Display absolute points: X/Y (no %)
  document.getElementById('current-grade').textContent =
    `${current.toFixed(2)}/${max.toFixed(2)}`;
  document.getElementById('highest-possible').textContent =
    `${highest.toFixed(2)}/${max.toFixed(2)}`;
  
  // Display the breakdown
  const detailsContainer = document.getElementById('grade-details');
  detailsContainer.innerHTML = '';
  
  // Explanation
  const explanationEl = document.createElement('div');
  explanationEl.className = 'explanation';
  explanationEl.innerHTML = `
    <p>Current: Sum of points earned on graded items so far.</p>
    <p>Highest Possible: Assumes full points on remaining ungraded items; points already lost on graded items cannot be recovered.</p>
  `;
  detailsContainer.appendChild(explanationEl);
  
  // Overall summary as X/Y
  const summaryEl = document.createElement('div');
  summaryEl.className = 'summary';
  summaryEl.innerHTML = `
    <div class="summary-title">Overall Summary</div>
    <div class="summary-row">
      <span>Current:</span>
      <span class="value">${current.toFixed(2)}/${max.toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>Highest Possible:</span>
      <span class="value">${highest.toFixed(2)}/${max.toFixed(2)}</span>
    </div>
  `;
  detailsContainer.appendChild(summaryEl);
  
  // Category details (X/Y)
  (details || []).forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'category';
    
    const statusText = category.isFullyCompleted ?
      "All assignments completed" :
      "Some assignments pending";
    
    categoryEl.innerHTML = `
      <div class="category-name">${category.name}</div>
      <div class="category-grades">
        <div class="current">Current: ${Number(category.achieved ?? 0).toFixed(2)}/${Number(category.total ?? 0).toFixed(2)}</div>
        <div class="possible">Highest: ${Number(category.highestPossible ?? 0).toFixed(2)}/${Number(category.total ?? 0).toFixed(2)}</div>
        <div class="status ${category.isFullyCompleted ? 'completed' : 'pending'}">${statusText}</div>
      </div>
    `;
    
    // Assignment details if available
    if (category.assignments && category.assignments.length > 0) {
      const assignmentsEl = document.createElement('div');
      assignmentsEl.className = 'assignments';
      
      category.assignments.forEach(assignment => {
        if (assignment.isDropped) return; // Skip dropped assignments
        
        const a = assignment.points || { achieved: 0, total: 0 };
        const assignmentEl = document.createElement('div');
        assignmentEl.className = `assignment ${assignment.isCompleted ? 'completed' : 'pending'}`;
        
        assignmentEl.innerHTML = `
          <div class="assignment-name">${assignment.name}</div>
          <div class="assignment-score">
            ${Number(a.achieved ?? 0).toFixed(2)}/${Number(a.total ?? 0).toFixed(2)}
          </div>
        `;
        
        assignmentsEl.appendChild(assignmentEl);
      });
      
      categoryEl.appendChild(assignmentsEl);
    }
    
    detailsContainer.appendChild(categoryEl);
  });
}

function displayNoData() {
  document.getElementById('current-grade').textContent = 'No data';
  document.getElementById('highest-possible').textContent = 'No data';
  document.getElementById('grade-details').innerHTML = 
    '<p>Please navigate to your grades page and click refresh.</p>';
}

function refreshGrades() {
  // Send message to content script to refresh grades
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "getGrades"}, function(response) {
      if (response && response.success) {
        loadGradeData();
      } else {
        displayNoData();
      }
    });
  });
}
