// This script runs on the grades page and extracts grade information

// Create and insert the in-page grade display
function createInPageDisplay() {
  // Check if our display already exists
  if (document.getElementById('grade-calculator-display')) {
    return document.getElementById('grade-calculator-display');
  }
  
  // Create the container
  const container = document.createElement('div');
  container.id = 'grade-calculator-display';
  container.className = 'grade-calculator-container';
  
  // Create the header
  const header = document.createElement('div');
  header.className = 'grade-calculator-header';
  header.innerHTML = `
    <h2>Grade Calculator</h2>
    <button id="grade-calculator-refresh" class="grade-calculator-button">Refresh</button>
  `;
  container.appendChild(header);
  
  // Create the results section
  const results = document.createElement('div');
  results.className = 'grade-calculator-results';
  results.innerHTML = `
    <div class="grade-calculator-result-item">
      <h3>Current Grade</h3>
      <div id="in-page-current-grade" class="grade-calculator-grade">--</div>
    </div>
    <div class="grade-calculator-result-item">
      <h3>Highest Possible</h3>
      <div id="in-page-highest-possible" class="grade-calculator-grade">--</div>
    </div>
  `;
  container.appendChild(results);
  
  // Create the details section
  const details = document.createElement('div');
  details.className = 'grade-calculator-details';
  details.innerHTML = `
    <h3>Category Breakdown</h3>
    <div id="in-page-grade-details" class="grade-calculator-categories"></div>
  `;
  container.appendChild(details);
  
  // Add the CSS
  const style = document.createElement('style');
  style.textContent = `
    .grade-calculator-container {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background-color: #f9f9f9;
      font-family: Arial, sans-serif;
    }
    
    .grade-calculator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .grade-calculator-header h2 {
      margin: 0;
      font-size: 18px;
    }
    
    .grade-calculator-button {
      padding: 5px 10px;
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .grade-calculator-button:hover {
      background-color: #3367d6;
    }
    
    .grade-calculator-results {
      display: flex;
      justify-content: space-around;
      margin-bottom: 15px;
    }
    
    .grade-calculator-result-item {
      text-align: center;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background-color: white;
      width: 45%;
    }
    
    .grade-calculator-result-item h3 {
      margin: 0 0 5px 0;
      font-size: 14px;
    }
    
    .grade-calculator-grade {
      font-size: 24px;
      font-weight: bold;
    }
    
    .grade-calculator-details h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
    }
    
    .grade-calculator-categories {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .grade-calculator-category {
      flex: 1;
      min-width: 200px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background-color: white;
    }
    
    .grade-calculator-category-name {
      font-weight: bold;
      margin-bottom: 5px;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
    }
    
    .grade-calculator-category-grades {
      font-size: 13px;
    }
    
    .grade-calculator-current {
      color: #1a73e8;
    }
    
    .grade-calculator-possible {
      color: #188038;
    }
    
    .grade-calculator-status {
      font-size: 11px;
      font-style: italic;
      margin-top: 5px;
    }
    
    .grade-calculator-completed {
      color: #1a73e8;
    }
    
    .grade-calculator-pending {
      color: #ea4335;
    }
  `;
  document.head.appendChild(style);
  
  // Insert the container into the page
  // Find a good location - typically after the grades table
  const gradesTable = document.querySelector('table.d2l-table');
  if (gradesTable && gradesTable.parentNode) {
    gradesTable.parentNode.insertBefore(container, gradesTable.nextSibling);
  } else {
    // Fallback - insert at the top of the content area
    const contentArea = document.querySelector('#d_content_r_p') || document.body;
    contentArea.insertBefore(container, contentArea.firstChild);
  }
  
  // Add event listener for the refresh button
  document.getElementById('grade-calculator-refresh').addEventListener('click', function() {
    processGrades();
  });
  
  return container;
}

function extractGrades() {
  const categories = [];
  const assignments = [];
  const rows = document.querySelectorAll('table.d2l-table tr');
  
  let currentCategory = null;
  
  rows.forEach(row => {
    // Skip header rows
    if (row.classList.contains('d_gh') || !row.querySelector('th')) return;
    
    // Check if this is a category row or an assignment row
    const isCategory = row.classList.contains('d_ggl1');
    
    if (isCategory) {
      // Extract category name and weight
      const categoryName = row.querySelector('th label')?.textContent.trim();
      const weightText = row.querySelector('td label')?.textContent.trim();
      
      if (categoryName && weightText) {
        const weightMatch = weightText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/);
        if (weightMatch) {
          currentCategory = {
            id: categories.length,
            type: 'category',
            name: categoryName,
            achieved: parseFloat(weightMatch[1]),
            total: parseFloat(weightMatch[2]),
            assignments: []
          };
          categories.push(currentCategory);
        }
      }
    } else if (currentCategory) {
      // Extract assignment details
      const assignmentName = row.querySelector('th label')?.textContent.trim();
      const pointsCell = row.querySelectorAll('td')[1];
      const weightCell = row.querySelectorAll('td')[2];
      
      if (assignmentName && pointsCell && weightCell) {
        const pointsText = pointsCell.textContent.trim();
        const weightText = weightCell.textContent.trim();
        
        const pointsMatch = pointsText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/);
        const weightMatch = weightText.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/);
        
        // Check if this item is dropped
        const isDropped = pointsCell.textContent.includes('Dropped!');
        
        if (pointsMatch && weightMatch) {
          const assignment = {
            id: assignments.length,
            type: 'assignment',
            categoryId: currentCategory.id,
            name: assignmentName,
            points: {
              achieved: parseFloat(pointsMatch[1]),
              total: parseFloat(pointsMatch[2])
            },
            weight: {
              achieved: parseFloat(weightMatch[1]),
              total: parseFloat(weightMatch[2])
            },
            isDropped: isDropped,
            isCompleted: parseFloat(pointsMatch[1]) > 0 || isDropped
          };
          
          assignments.push(assignment);
          currentCategory.assignments.push(assignment);
        }
      }
    }
  });
  
  return { categories, assignments };
}

// Calculate averages with properly fixed highest possible calculation
function calculateAverages(data) {
  const { categories, assignments } = data;
  
  // Calculate current grade
  let totalWeight = 0;
  let achievedWeight = 0;
  
  categories.forEach(category => {
    totalWeight += category.total;
    achievedWeight += category.achieved;
  });
  
  const currentGrade = totalWeight > 0 ? (achievedWeight / totalWeight) * 100 : 0;
  
  // Calculate highest possible grade
  let highestPossibleTotal = 0;
  
  // Process each category for highest possible grade
  const categoriesWithHighest = categories.map(category => {
    // Get all non-dropped assignments for this category
    const activeAssignments = category.assignments.filter(a => !a.isDropped);
    
    let categoryHighestPossible = 0;
    let categoryIsFullyCompleted = true;
    
    // If there are no assignments or all are dropped, use the category total
    if (activeAssignments.length === 0) {
      categoryHighestPossible = category.total;
    } else {
      // Calculate completed and remaining weights
      let completedWeight = 0;
      let remainingWeight = 0;
      
      activeAssignments.forEach(assignment => {
        if (assignment.isCompleted) {
          completedWeight += assignment.weight.achieved;
        } else {
          categoryIsFullyCompleted = false;
          remainingWeight += assignment.weight.total;
        }
      });
      
      // Highest possible = completed weight + remaining weight (assuming 100% on remaining)
      categoryHighestPossible = completedWeight + remainingWeight;
      
      // Cap at the category total
      categoryHighestPossible = Math.min(categoryHighestPossible, category.total);
    }
    
    highestPossibleTotal += categoryHighestPossible;
    
    return {
      ...category,
      isFullyCompleted: categoryIsFullyCompleted,
      highestPossible: categoryHighestPossible
    };
  });
  
  const highestPossible = totalWeight > 0 ? (highestPossibleTotal / totalWeight) * 100 : 0;
  
  return {
    currentGrade: currentGrade,
    highestPossible: highestPossible,
    details: categoriesWithHighest
  };
}

// Update the in-page display with grade data
function updateInPageDisplay(gradeData) {
  // Update the grade values
  document.getElementById('in-page-current-grade').textContent = 
    gradeData.currentGrade.toFixed(2) + '%';
  document.getElementById('in-page-highest-possible').textContent = 
    gradeData.highestPossible.toFixed(2) + '%';
  
  // Update the category details
  const detailsContainer = document.getElementById('in-page-grade-details');
  detailsContainer.innerHTML = '';
  
  gradeData.details.forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'grade-calculator-category';
    
    const currentPercent = ((category.achieved/category.total)*100).toFixed(1);
    const highestPercent = ((category.highestPossible/category.total)*100).toFixed(1);
    
    const statusText = category.isFullyCompleted ? 
      "All assignments completed" : 
      "Some assignments pending";
    
    categoryEl.innerHTML = `
      <div class="grade-calculator-category-name">${category.name}</div>
      <div class="grade-calculator-category-grades">
        <div class="grade-calculator-current">Current: ${category.achieved}/${category.total} (${currentPercent}%)</div>
        <div class="grade-calculator-possible">Highest: ${category.highestPossible}/${category.total} (${highestPercent}%)</div>
        <div class="grade-calculator-status ${category.isFullyCompleted ? 'grade-calculator-completed' : 'grade-calculator-pending'}">${statusText}</div>
      </div>
    `;
    
    detailsContainer.appendChild(categoryEl);
  });
}

// Run when the page loads
function processGrades() {
  const data = extractGrades();
  const averages = calculateAverages(data);
  
  // Create or update the in-page display
  createInPageDisplay();
  updateInPageDisplay(averages);
  
  // Store the results for the popup
  chrome.storage.local.set({ gradeData: averages });
}

// Run when page loads
window.addEventListener('load', function() {
  // Wait a bit to ensure the page is fully loaded
  setTimeout(processGrades, 500);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getGrades") {
    processGrades();
    sendResponse({success: true});
  }
});
