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
  // Display the averages
  document.getElementById('current-grade').textContent = 
    gradeData.currentGrade.toFixed(2) + '%';
  document.getElementById('highest-possible').textContent = 
    gradeData.highestPossible.toFixed(2) + '%';
  
  // Display the breakdown
  const detailsContainer = document.getElementById('grade-details');
  detailsContainer.innerHTML = '';
  
  // Add explanation text
  const explanationEl = document.createElement('div');
  explanationEl.className = 'explanation';
  explanationEl.innerHTML = `
    <p>Current: Your current grade based on completed assignments.</p>
    <p>Highest Possible: Assumes you'll get 100% on all remaining assignments. We deemed assignment you got ZERO as remaining.</p>
  `;
  detailsContainer.appendChild(explanationEl);
  
  // Add total summary
  const summaryEl = document.createElement('div');
  summaryEl.className = 'summary';
  summaryEl.innerHTML = `
    <div class="summary-title">Overall Summary</div>
    <div class="summary-row">
      <span>Current Grade:</span>
      <span class="value">${gradeData.currentGrade.toFixed(2)}%</span>
    </div>
    <div class="summary-row">
      <span>Highest Possible:</span>
      <span class="value">${gradeData.highestPossible.toFixed(2)}%</span>
    </div>
  `;
  detailsContainer.appendChild(summaryEl);
  
  // Add category details
  gradeData.details.forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'category';
    
    const currentPercent = ((category.achieved/category.total)*100).toFixed(1);
    const highestPercent = ((category.highestPossible/category.total)*100).toFixed(1);
    
    const statusText = category.isFullyCompleted ? 
      "All assignments completed" : 
      "Some assignments pending";
    
    categoryEl.innerHTML = `
      <div class="category-name">${category.name}</div>
      <div class="category-grades">
        <div class="current">Current: ${category.achieved}/${category.total} (${currentPercent}%)</div>
        <div class="possible">Highest: ${category.highestPossible}/${category.total} (${highestPercent}%)</div>
        <div class="status ${category.isFullyCompleted ? 'completed' : 'pending'}">${statusText}</div>
      </div>
    `;
    
    // Add assignment details if available
    if (category.assignments && category.assignments.length > 0) {
      const assignmentsEl = document.createElement('div');
      assignmentsEl.className = 'assignments';
      
      category.assignments.forEach(assignment => {
        if (assignment.isDropped) return; // Skip dropped assignments
        
        const assignmentEl = document.createElement('div');
        assignmentEl.className = `assignment ${assignment.isCompleted ? 'completed' : 'pending'}`;
        
        const pointsPercent = (assignment.points.total > 0) ? 
          ((assignment.points.achieved / assignment.points.total) * 100).toFixed(1) + '%' : 
          'N/A';
        
        assignmentEl.innerHTML = `
          <div class="assignment-name">${assignment.name}</div>
          <div class="assignment-score">
            ${assignment.points.achieved}/${assignment.points.total} (${pointsPercent})
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
