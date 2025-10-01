// ================================================================
// Brightspace - D2L Grade Calculator (Rebuilt for categories + uncategorized)
// Computes current and highest-possible in absolute points (X/Y)
// - Uses LE API: categories + myGradeValues
// - getOrgUnitId preserved
// - LE version fixed via constant per user request
// ================================================================

// ---------- Config ----------
const LE_VERSION = '1.87'; // Change manually if needed

// ---------- UI creation ----------
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
      <h3>Current</h3>
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
    .grade-calculator-category{flex:1;min-width:220px;padding:10px;border:1px solid #ddd;border-radius:5px;background:#fff}
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
const api = (() => {
  const getOrgUnitId = () => {
    // 1) query param ?ou=123456
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

  const getMyGradeValues = async (orgUnitId) => {
    const url = `/d2l/api/le/${LE_VERSION}/${orgUnitId}/grades/values/myGradeValues/`;
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`myGradeValues fetch failed: ${r.status}`);
    return r.json();
  };

  const getGradeCategories = async (orgUnitId) => {
    const url = `/d2l/api/le/${LE_VERSION}/${orgUnitId}/grades/categories/`;
    const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`categories fetch failed: ${r.status}`);
    return r.json();
  };

  return { getOrgUnitId, getMyGradeValues, getGradeCategories };
})();

// ---------- Parsing helpers ----------
function parsePointsFromDisplayed(displayed) {
  if (!displayed) return { num: null, den: null };
  const s = String(displayed);
  // Try "x / y"
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      return { num, den };
    }
  }
  return { num: null, den: null };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ---------- Build unified model ----------
function buildModel(categoriesJson, valuesJson) {
  const cats = Array.isArray(categoriesJson) ? categoriesJson : [];
  const vals = Array.isArray(valuesJson) ? valuesJson : [];

  // Maps
  const categoryMap = new Map(); // id -> { id, name, exclude }
  const itemDefMap = new Map();  // itemId -> { id, name, maxPoints, categoryId, exclude }

  // Ingest categories and their grade items
  for (const c of cats) {
    const cid = String(c.Id);
    categoryMap.set(cid, {
      id: cid,
      name: c.Name || 'Category',
      exclude: c.ExcludeFromFinalGrade === true
    });
    const items = Array.isArray(c.Grades) ? c.Grades : [];
    for (const g of items) {
      const iid = String(g.Id ?? g.GradeObjectId ?? g.GradeId ?? '');
      if (!iid) continue;
      itemDefMap.set(iid, {
        id: iid,
        name: g.Name || g.ShortName || 'Grade Item',
        maxPoints: Number(g.MaxPoints),
        categoryId: cid,
        exclude: g.ExcludeFromFinalGrade === true
      });
    }
  }

  // Placeholder for uncategorized
  const UNCAT_ID = 'uncategorized';
  if (!categoryMap.has(UNCAT_ID)) {
    categoryMap.set(UNCAT_ID, { id: UNCAT_ID, name: 'Uncategorized', exclude: false });
  }

  // Seed items from definitions (ensures items without a value entry still count)
  const itemsMap = new Map(); // itemId -> item record
  for (const [iid, def] of itemDefMap) {
    const catId = def.categoryId ?? UNCAT_ID;
    const exclude = def.exclude === true || (categoryMap.get(catId)?.exclude === true);
    itemsMap.set(iid, {
      id: def.id,
      name: def.name,
      categoryId: catId,
      exclude,
      maxPoints: Number(def.maxPoints),
      isGraded: false,
      earnedPoints: 0
    });
  }

  // Merge values: ensure every value has a def with maxPoints
  for (const v of vals) {
    if (!v || v.GradeObjectType === 9) continue; // skip category rows in values
    const iid = String(v.GradeObjectIdentifier || v.GradeObjectId || '');
    if (!iid) continue;

    let def = itemDefMap.get(iid);
    if (!def) {
      // Build ad-hoc def for uncategorized
      const parsed = parsePointsFromDisplayed(v.DisplayedGrade);
      const maxFromValue =
        Number(v.PointsDenominator) ||
        Number(v.MaxPoints) ||
        (Number.isFinite(parsed.den) ? parsed.den : null) ||
        null;
      def = {
        id: iid,
        name: v.GradeObjectName || 'Grade Item',
        maxPoints: Number(maxFromValue),
        categoryId: UNCAT_ID,
        exclude: false
      };
      itemDefMap.set(iid, def);
    } else if (!(Number.isFinite(def.maxPoints) && def.maxPoints > 0)) {
      // Fill missing max from value if possible
      const parsed = parsePointsFromDisplayed(v.DisplayedGrade);
      const maxFromValue =
        Number(v.PointsDenominator) ||
        Number(v.MaxPoints) ||
        (Number.isFinite(parsed.den) ? parsed.den : null) ||
        null;
      if (Number.isFinite(maxFromValue) && maxFromValue > 0) {
        def.maxPoints = Number(maxFromValue);
      }
    }

    const catId = def.categoryId ?? UNCAT_ID;
    const exclude = def.exclude === true || (categoryMap.get(catId)?.exclude === true);

    // Earned points and grading state
    const parsed = parsePointsFromDisplayed(v.DisplayedGrade);
    const earnedRaw =
      Number(v.PointsNumerator) ??
      (Number.isFinite(parsed.num) ? parsed.num : 0);
    const maxPts = Number(def.maxPoints);
    const earned = Number.isFinite(earnedRaw) ? clamp(earnedRaw, 0, Number.isFinite(maxPts) ? maxPts : earnedRaw) : 0;

    // Per requirement: treat 0 as ungraded (so remaining can still be max)
    const isGraded = earned > 0;

    // Upsert into itemsMap
    const existing = itemsMap.get(iid);
    if (existing) {
      existing.maxPoints = Number.isFinite(maxPts) ? maxPts : existing.maxPoints;
      existing.earnedPoints = earned;
      existing.isGraded = isGraded;
      existing.exclude = exclude;
      existing.categoryId = categoryMap.has(catId) ? catId : UNCAT_ID;
      existing.name = def.name || existing.name;
    } else {
      itemsMap.set(iid, {
        id: def.id,
        name: def.name,
        categoryId: categoryMap.has(catId) ? catId : UNCAT_ID,
        exclude,
        maxPoints: Number(def.maxPoints),
        isGraded,
        earnedPoints: earned
      });
    }
  }

  // Group items by category
  const catToItems = new Map();
  for (const [cid] of categoryMap) {
    catToItems.set(cid, []);
  }
  for (const it of itemsMap.values()) {
    const cid = categoryMap.has(it.categoryId) ? it.categoryId : UNCAT_ID;
    catToItems.get(cid).push(it);
  }

  // Build category summaries
  const categories = [];
  for (const [cid, c] of categoryMap) {
    const its = catToItems.get(cid) || [];
    // Skip empty categories with no items at all
    if (its.length === 0) continue;

    const validItems = its.filter(it => Number.isFinite(it.maxPoints) && it.maxPoints > 0 && !it.exclude);
    const totalMax = validItems.reduce((s, it) => s + it.maxPoints, 0);
    const currentEarned = validItems.reduce((s, it) => {
      if (it.isGraded && Number.isFinite(it.earnedPoints)) {
        return s + clamp(it.earnedPoints, 0, it.maxPoints);
      }
      return s;
    }, 0);
    const highestPossible = validItems.reduce((s, it) => {
      if (it.isGraded && Number.isFinite(it.earnedPoints)) {
        return s + clamp(it.earnedPoints, 0, it.maxPoints);
      }
      // ungraded assumed max
      return s + it.maxPoints;
    }, 0);

    const isFullyCompleted = validItems.length > 0 && validItems.every(it => it.isGraded);

    categories.push({
      id: cid,
      type: 'category',
      name: c.name,
      achieved: currentEarned,
      total: totalMax,
      highestPossible: highestPossible,
      isFullyCompleted,
      assignments: validItems.map(it => ({
        id: it.id,
        name: it.name,
        isCompleted: it.isGraded,
        isDropped: false,
        points: { achieved: it.isGraded ? clamp(it.earnedPoints || 0, 0, it.maxPoints) : 0, total: it.maxPoints }
      }))
    });
  }

  // Overall totals
  const allValidItems = [];
  for (const cat of categories) {
    for (const a of cat.assignments) {
      allValidItems.push(a);
    }
  }
  const totalMaxPoints = allValidItems.reduce((s, a) => s + a.points.total, 0);
  const currentPoints = allValidItems.reduce((s, a) => s + a.points.achieved, 0);
  const highestPossiblePoints = categories.reduce((s, c) => s + c.highestPossible, 0);

  return {
    categories,
    totals: {
      currentPoints,
      highestPossiblePoints,
      totalMaxPoints
    }
  };
}

// ---------- Update UI ----------
function updateInPageDisplay(gradeData) {
  const { currentPoints = 0, highestPossiblePoints = 0, totalMaxPoints = 0 } = gradeData?.totals || {};
  document.getElementById('in-page-current-grade').textContent =
    `${currentPoints.toFixed(2)}/${totalMaxPoints.toFixed(2)}`;
  document.getElementById('in-page-highest-possible').textContent =
    `${highestPossiblePoints.toFixed(2)}/${totalMaxPoints.toFixed(2)}`;

  const detailsContainer = document.getElementById('in-page-grade-details');
  detailsContainer.innerHTML = '';

  (gradeData.details || []).forEach(category => {
    const el = document.createElement('div');
    el.className = 'grade-calculator-category';
    el.innerHTML = `
      <div class="grade-calculator-category-name">${category.name}</div>
      <div class="grade-calculator-category-grades">
        <div class="grade-calculator-current">Current: ${category.achieved.toFixed(2)}/${category.total.toFixed(2)}</div>
        <div class="grade-calculator-possible">Highest: ${category.highestPossible.toFixed(2)}/${category.total.toFixed(2)}</div>
        <div class="grade-calculator-status ${category.isFullyCompleted ? 'grade-calculator-completed' : 'grade-calculator-pending'}">
          ${category.isFullyCompleted ? 'All assignments completed' : 'Some assignments pending'}
        </div>
      </div>
    `;
    detailsContainer.appendChild(el);
  });
}

// ---------- Orchestrate ----------
async function processGrades() {
  try {
    createInPageDisplay();

    const orgUnitId = api.getOrgUnitId();
    if (!orgUnitId) throw new Error('Could not determine orgUnitId from URL.');

    const [values, categories] = await Promise.all([
      api.getMyGradeValues(orgUnitId),
      api.getGradeCategories(orgUnitId)
    ]);

    const model = buildModel(categories, values);
    const result = {
      details: model.categories,
      totals: model.totals,
      meta: { orgUnitId, apiVersion: LE_VERSION }
    };

    updateInPageDisplay(result);
    chrome.storage.local.set({ gradeData: result });
  } catch (err) {
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
            • Ensure you’re in a course (URL contains /d2l/home/{orgUnitId}).<br/>
            • Your institution may restrict the LE API (403).<br/>
            • Reload the Grades page and click Refresh.
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
