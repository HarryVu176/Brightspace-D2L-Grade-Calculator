// ================================================================
// Brightspace - D2L Grade Calculator (API version)
// Replaces DOM scraping with LE API calls and category-based math
// ================================================================

// ---------- UI creation (unchanged from your original) ----------
function createInPageDisplay() {
  if (document.getElementById('grade-calculator-display')) {
    return document.getElementById('grade-calculator-display');
  }
  const container = document.createElement('div');
  container.id = 'grade-calculator-display';
  container.className = 'grade-calculator-container';

  const header = document.createElement('div');
  header.className = 'grade-calculator-header';
  header.innerHTML = `
    <h2>Grade Calculator</h2>
    <button id="grade-calculator-refresh" class="grade-calculator-button">Refresh</button>
  `;
  container.appendChild(header);

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

  const details = document.createElement('div');
  details.className = 'grade-calculator-details';
  details.innerHTML = `
    <h3>Category Breakdown</h3>
    <div id="in-page-grade-details" class="grade-calculator-categories"></div>
  `;
  container.appendChild(details);

  const style = document.createElement('style');
  style.textContent = `
    .grade-calculator-container{margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:5px;background:#f9f9f9;font-family:Arial,sans-serif}
    .grade-calculator-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #ddd}
    .grade-calculator-header h2{margin:0;font-size:18px}
    .grade-calculator-button{padding:5px 10px;background:#4285f4;color:#fff;border:none;border-radius:4px;cursor:pointer}
    .grade-calculator-button:hover{background:#3367d6}
    .grade-calculator-results{display:flex;justify-content:space-around;margin-bottom:15px}
    .grade-calculator-result-item{text-align:center;padding:10px;border:1px solid #ddd;border-radius:5px;background:#fff;width:45%}
    .grade-calculator-result-item h3{margin:0 0 5px 0;font-size:14px}
    .grade-calculator-grade{font-size:24px;font-weight:bold}
    .grade-calculator-details h3{margin:0 0 10px 0;font-size:16px}
    .grade-calculator-categories{display:flex;flex-wrap:wrap;gap:10px}
    .grade-calculator-category{flex:1;min-width:200px;padding:10px;border:1px solid #ddd;border-radius:5px;background:#fff}
    .grade-calculator-category-name{font-weight:bold;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #eee}
    .grade-calculator-category-grades{font-size:13px}
    .grade-calculator-current{color:#1a73e8}
    .grade-calculator-possible{color:#188038}
    .grade-calculator-status{font-size:11px;font-style:italic;margin-top:5px}
    .grade-calculator-completed{color:#1a73e8}
    .grade-calculator-pending{color:#ea4335}
  `;
  document.head.appendChild(style);

  const gradesTable = document.querySelector('table.d2l-table');
  if (gradesTable && gradesTable.parentNode) {
    gradesTable.parentNode.insertBefore(container, gradesTable.nextSibling);
  } else {
    const contentArea = document.querySelector('#d_content_r_p') || document.body;
    contentArea.insertBefore(container, contentArea.firstChild);
  }

  document.getElementById('grade-calculator-refresh').addEventListener('click', () => {
    processGrades();
  });

  return container;
}

// ---------- Helpers to call Brightspace LE API ----------
// ---------- FIXED: getOrgUnitId supports ?ou=... ----------
const api = (() => {
  const getOrgUnitId = () => {
    // 1) query param ?ou=123456 (your Fanshawe URL shape)
    const qsOu = new URLSearchParams(location.search).get('ou');
    if (qsOu && /^\d+$/.test(qsOu)) return qsOu;

    // 2) common path shapes
    const p = window.location.pathname;
    let m =
      p.match(/\/d2l\/home\/(\d+)/) ||
      p.match(/\/d2l\/le\/content\/(\d+)\//) ||
      p.match(/\/d2l\/lms\/grades\/[^/]+\/(\d+)/);
    if (m) return m[1];

    // 3) last-ditch: scan anchors
    for (const a of document.querySelectorAll('a[href*="/d2l/home/"],a[href*="/d2l/le/content/"],a[href*="ou="]')) {
      const href = a.getAttribute('href') || '';
      const m2 = href.match(/[\?&]ou=(\d+)/) ||
                 href.match(/\/d2l\/home\/(\d+)/) ||
                 href.match(/\/d2l\/le\/content\/(\d+)\//);
      if (m2) return m2[1];
    }
    return null;
  };

  // ---------- FIXED: robust version discovery with fallbacks ----------
  const getLatestLeVersion = async () => {
    // Helper to pick highest numeric { Version } from an array
    const pickHighest = (arr) => {
      return arr
        .map(v => {
          const ver = typeof v === 'string' ? v
                   : (v?.Version ?? v?.version ?? v?.VER ?? null);
          const num = parseFloat(ver);
          return Number.isFinite(num) ? { ver: String(ver), num } : null;
        })
        .filter(Boolean)
        .sort((a,b) => b.num - a.num)[0]?.ver || null;
    };

    // Try /le/versions/
    try {
      const r = await fetch('/d2l/api/le/versions/', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) {
          const v = pickHighest(data);
          if (v) return v;
        }
      }
    } catch {}

    // Try generic /versions/ then find the LE product
    try {
      const r = await fetch('/d2l/api/versions/', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (r.ok) {
        const data = await r.json();
        // Accept either an array of product blocks or an object keyed by product
        const products = Array.isArray(data) ? data
                        : (data?.Products || data?.products || Object.values(data || {}));
        if (Array.isArray(products)) {
          // try to find LE by common keys
          const le = products.find(p =>
            /^(le|learning\s*environment)$/i.test(p?.ProductCode || p?.productCode || p?.Name || '')
          ) || products.find(p => /grade|le/i.test(JSON.stringify(p)));
          const highest = le && (pickHighest(le.SupportedVersions || le.supportedVersions || le.Versions || []));
          if (highest) return highest;
        }
      }
    } catch {}

    // Probe a short descending list until one responds 200 on a harmless call
    const candidates = ['1.90','1.89','1.88','1.87','1.86','1.85','1.84','1.83','1.82','1.81','1.80'];
    for (const v of candidates) {
      try {
        // ping a cheap endpoint most tenants allow (grades values often 200/403; 403 still proves version exists)
        const test = await fetch(`/d2l/api/le/${v}/schema`, { credentials: 'include' });
        if (test.ok || test.status === 403 || test.status === 401 || test.status === 404) {
          // Version exists on server (endpoint presence/permission varies)
          return v;
        }
      } catch {}
    }
    // Absolute last resort: a widely deployed version
    return '1.87';
  };

  // ---------- unchanged: fetch grade values ----------
  const getMyGradeValues = async (ver, orgUnitId) => {
    const url = `/d2l/api/le/${ver}/${orgUnitId}/grades/values/myGradeValues/`;
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`myGradeValues fetch failed: ${r.status}`);
    return r.json();
  };

  const getFinalMyGradeValue = async (ver, orgUnitId) => {
    const url = `/d2l/api/le/${ver}/${orgUnitId}/grades/final/values/myGradeValue`;
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    return r.json();
  };

  return { getOrgUnitId, getLatestLeVersion, getMyGradeValues, getFinalMyGradeValue };
})();


// ---------- Transform API -> categories only (type 9) ----------
function toCategoryModel(gradesJson) {
  // Keep only categories
  const cats = gradesJson.filter(g => g.GradeObjectType === 9);

  // Build UI-friendly objects
  const categories = cats
    .map(c => {
      const name = c.GradeObjectName || 'Category';
      const achieved = Number(c.WeightedNumerator) || 0;
      const total = Number(c.WeightedDenominator) || 0;
      const isFullyCompleted = total > 0 && achieved >= total - 1e-6;
      // Highest possible for a category (assuming 100% on remainder) is its total weight
      const highestPossible = total;

      return {
        id: String(c.GradeObjectIdentifier ?? name),
        type: 'category',
        name,
        achieved,
        total,
        highestPossible,
        isFullyCompleted,
        assignments: [] // we’re category-only per your request
      };
    })
    // filter out degenerate categories with no weight
    .filter(c => c.total > 0);

  return categories;
}

// ---------- Compute current + highest using categories ----------
function calculateFromCategories(categories) {
  const totalWeight = categories.reduce((s, c) => s + c.total, 0);
  const earnedWeight = categories.reduce((s, c) => s + Math.min(c.achieved, c.total), 0);

  const currentGrade = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;

  // "Highest Possible" = assume 100% on remaining within the shown categories.
  // That caps to category totals, so sum(highestPossible) == totalWeight.
  const highestPossible = totalWeight > 0 ? (totalWeight / totalWeight) * 100 : 0; // i.e., 100% if you ace the rest

  return { currentGrade, highestPossible };
}

// ---------- Update UI ----------
function updateInPageDisplay(gradeData) {
  document.getElementById('in-page-current-grade').textContent =
    gradeData.currentGrade.toFixed(2) + '%';
  document.getElementById('in-page-highest-possible').textContent =
    gradeData.highestPossible.toFixed(2) + '%';

  const detailsContainer = document.getElementById('in-page-grade-details');
  detailsContainer.innerHTML = '';

  gradeData.details.forEach(category => {
    const el = document.createElement('div');
    el.className = 'grade-calculator-category';

    const currentPercent = category.total > 0
      ? ((category.achieved / category.total) * 100).toFixed(1)
      : '0.0';
    const highestPercent = category.total > 0
      ? ((category.highestPossible / category.total) * 100).toFixed(1)
      : '0.0';

    const statusText = category.isFullyCompleted
      ? 'All assignments completed'
      : 'Some assignments pending';

    el.innerHTML = `
      <div class="grade-calculator-category-name">${category.name}</div>
      <div class="grade-calculator-category-grades">
        <div class="grade-calculator-current">Current: ${category.achieved}/${category.total} (${currentPercent}%)</div>
        <div class="grade-calculator-possible">Highest: ${category.highestPossible}/${category.total} (${highestPercent}%)</div>
        <div class="grade-calculator-status ${category.isFullyCompleted ? 'grade-calculator-completed' : 'grade-calculator-pending'}">${statusText}</div>
      </div>
    `;
    detailsContainer.appendChild(el);
  });
}

// ---------- Orchestrate ----------
async function processGrades() {
  try {
    createInPageDisplay();

    // Detect org unit & version
    const orgUnitId = api.getOrgUnitId();
    if (!orgUnitId) throw new Error('Could not determine orgUnitId from URL.');

    const ver = await api.getLatestLeVersion();

    // Pull grades
    const [values, finalMaybe] = await Promise.all([
      api.getMyGradeValues(ver, orgUnitId),
      api.getFinalMyGradeValue(ver, orgUnitId) // may be null/403
    ]);

    // Build categories only
    const categories = toCategoryModel(values);
    const { currentGrade, highestPossible } = calculateFromCategories(categories);

    const result = {
      currentGrade,
      highestPossible,
      details: categories,
      meta: {
        orgUnitId,
        apiVersion: ver,
        // If final grade endpoint is available, expose it for debugging/compare
        finalDisplayedGrade: finalMaybe?.DisplayedGrade ?? null
      }
    };

    updateInPageDisplay(result);

    // Persist for popup
    chrome.storage.local.set({ gradeData: result });
  } catch (err) {
    // Show something helpful in-page instead of failing silently
    console.warn('[Grade Calculator] Error:', err);
    createInPageDisplay();
    document.getElementById('in-page-current-grade').textContent = '—';
    document.getElementById('in-page-highest-possible').textContent = '—';

    const detailsContainer = document.getElementById('in-page-grade-details');
    detailsContainer.innerHTML = `
      <div class="grade-calculator-category">
        <div class="grade-calculator-category-name">Could not load via API</div>
        <div class="grade-calculator-category-grades">
          <div class="grade-calculator-status grade-calculator-pending">
            ${err?.message || 'Unknown error'}<br/>
            • Make sure you’re inside a course (URL contains <code>/d2l/home/{orgUnitId}</code>).<br/>
            • Your institution may restrict the LE API (403).<br/>
            • Try reloading the Grades page and click Refresh.
          </div>
        </div>
      </div>
    `;
    chrome.storage.local.set({ gradeData: null });
  }
}

// ---------- Boot ----------
window.addEventListener('load', () => {
  setTimeout(processGrades, 500);
});

// From popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getGrades') {
    processGrades().finally(() => sendResponse({ success: true }));
    return true; // keep message channel open for async
  }
});
