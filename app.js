// ============================================================
// NoSQL Document Store Simulation
// In a real app: MongoDB Atlas + Node.js/Express backend
// Each document maps to a MongoDB document in a collection
// ============================================================
const DB = {
  collection: "recipes",
  documents: [],
  opLog: [],
  opCount: 0,

  generateId() {
    // Simulates MongoDB ObjectId generation
    return 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  log(operation, data) {
    const entry = `db.${this.collection}.${operation}(${JSON.stringify(data)})`;
    this.opLog.unshift(entry);
    this.opCount++;
  },

  // CREATE — db.recipes.insertOne(doc)
  insertOne(doc) {
    const newDoc = {
      ...doc,
      _id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.documents.push(newDoc);
    this.log('insertOne', { name: doc.name, category: doc.category });
    return newDoc;
  },

  // READ — db.recipes.find(query)
  find(query = {}) {
    this.log('find', query);
    return this.documents.filter(doc =>
      Object.entries(query).every(([k, v]) => doc[k] === v)
    );
  },

  // READ — db.recipes.findOne({ _id })
  findById(id) {
    return this.documents.find(d => d._id === id);
  },

  // UPDATE — db.recipes.updateOne({ _id }, { $set: updates })
  updateOne(id, updates) {
    const idx = this.documents.findIndex(d => d._id === id);
    if (idx === -1) return null;
    this.documents[idx] = {
      ...this.documents[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.log('updateOne', { _id: id, $set: { name: updates.name } });
    return this.documents[idx];
  },

  // DELETE — db.recipes.deleteOne({ _id })
  deleteOne(id) {
    const idx = this.documents.findIndex(d => d._id === id);
    if (idx === -1) return false;
    this.documents.splice(idx, 1);
    this.log('deleteOne', { _id: id });
    return true;
  }
};

// ============================================================
// Category Config — colors & emojis per category
// ============================================================
const CATEGORY_CONFIG = {
  Breakfast: { color: '#BA7517', bg: '#FAEEDA', emoji: '🍳' },
  Lunch:     { color: '#185FA5', bg: '#E6F1FB', emoji: '🥗' },
  Dinner:    { color: '#3B6D11', bg: '#EAF3DE', emoji: '🍽️' },
  Dessert:   { color: '#993556', bg: '#FBEAF0', emoji: '🍰' },
  Snack:     { color: '#534AB7', bg: '#EEEDFE', emoji: '🫙' },
  Drink:     { color: '#0F6E56', bg: '#E1F5EE', emoji: '🥤' },
};

// ============================================================
// Seed Data — preloaded sample recipes
// ============================================================
const SEEDS = [
  {
    name: "Shakshuka",
    category: "Breakfast",
    description: "Poached eggs in spiced tomato and pepper sauce, a classic Middle Eastern dish.",
    prepTime: 10, cookTime: 25, servings: 4, difficulty: "Easy",
    ingredients: "2 tbsp olive oil\n1 onion, diced\n3 garlic cloves\n2 cans crushed tomatoes\n1 tsp cumin\n1 tsp paprika\n4 eggs\nFresh parsley",
    instructions: "Heat oil in a skillet\nSauté onion and garlic until soft\nAdd tomatoes and spices, simmer 15 mins\nMake wells and crack eggs in\nCover and cook 8 mins\nGarnish with parsley"
  },
  {
    name: "Koshari",
    category: "Dinner",
    description: "Egypt's national dish — rice, lentils, pasta with a tangy tomato sauce.",
    prepTime: 20, cookTime: 45, servings: 6, difficulty: "Medium",
    ingredients: "1 cup rice\n1 cup lentils\n1 cup elbow pasta\n3 onions\n1 can tomato sauce\n4 garlic cloves\n1 tsp cumin\nOil for frying",
    instructions: "Cook rice and lentils separately\nBoil pasta until al dente\nFry onions until crispy\nMake tomato garlic sauce\nLayer rice+lentils then pasta\nTop with sauce and crispy onions"
  },
  {
    name: "Om Ali",
    category: "Dessert",
    description: "Egyptian bread pudding with nuts, coconut, and cream — a beloved classic.",
    prepTime: 15, cookTime: 30, servings: 8, difficulty: "Easy",
    ingredients: "4 croissants\n2 cups milk\n1 cup heavy cream\n1/2 cup sugar\n1/2 cup mixed nuts\n1/4 cup coconut flakes\nCinnamon",
    instructions: "Preheat oven to 180°C\nTear croissants into pieces\nMix milk cream and sugar\nLayer bread in baking dish\nPour cream mixture over\nTop with nuts and coconut\nBake 25 mins until golden"
  },
  {
    name: "Falafel Wrap",
    category: "Lunch",
    description: "Crispy fried chickpea patties wrapped in flatbread with tahini and veggies.",
    prepTime: 20, cookTime: 15, servings: 4, difficulty: "Medium",
    ingredients: "400g canned chickpeas\n1 onion\n3 garlic cloves\n1 tsp cumin\n1 tsp coriander\nFlat bread\nTahini\nTomatoes, lettuce",
    instructions: "Blend chickpeas with onion and spices\nForm into small patties\nFry until golden brown\nWarm flatbreads\nAssemble with tahini and vegetables"
  }
];

function seedDB() {
  SEEDS.forEach(s => DB.insertOne(s));
}

// ============================================================
// Render State
// ============================================================
let currentFilter = '';
let currentSearch = '';
let currentSort = 'newest';

function renderStats(docs) {
  const total = DB.documents.length;
  const cats = [...new Set(DB.documents.map(d => d.category))].length;
  const shown = docs.length;
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-chip"><strong>${total}</strong> total recipes</div>
    <div class="stat-chip"><strong>${cats}</strong> categories</div>
    <div class="stat-chip">Showing <strong>${shown}</strong> results</div>
    <div class="stat-chip">Collection: <strong>recipes</strong></div>
  `;
}

function filterRecipes() {
  currentSearch = document.getElementById('search-input').value.toLowerCase();
  currentFilter = document.getElementById('category-filter').value;
  currentSort = document.getElementById('sort-filter').value;
  renderGrid();
}

function renderGrid() {
  let docs = [...DB.documents];

  if (currentFilter) docs = docs.filter(d => d.category === currentFilter);
  if (currentSearch) docs = docs.filter(d =>
    d.name.toLowerCase().includes(currentSearch) ||
    d.description.toLowerCase().includes(currentSearch) ||
    (d.ingredients || '').toLowerCase().includes(currentSearch)
  );

  if (currentSort === 'newest') docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (currentSort === 'oldest') docs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  else if (currentSort === 'az') docs.sort((a, b) => a.name.localeCompare(b.name));
  else if (currentSort === 'time') docs.sort((a, b) => (a.cookTime + a.prepTime) - (b.cookTime + b.prepTime));

  renderStats(docs);

  const grid = document.getElementById('recipes-grid');
  if (docs.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <h3>No recipes found</h3>
        <p>Try a different search or add a new recipe.</p>
      </div>`;
    return;
  }

  grid.innerHTML = docs.map(doc => {
    const cfg = CATEGORY_CONFIG[doc.category] || { color: '#7A7568', bg: '#F2EFE8', emoji: '🍴' };
    const totalTime = (parseInt(doc.prepTime) || 0) + (parseInt(doc.cookTime) || 0);
    return `
      <div class="recipe-card" onclick="viewRecipe('${doc._id}')">
        <div class="card-thumb" style="background:${cfg.bg}">${cfg.emoji}</div>
        <div class="card-body">
          <div class="card-category" style="color:${cfg.color}">${doc.category}</div>
          <div class="card-title">${esc(doc.name)}</div>
          <div class="card-desc">${esc(doc.description || '')}</div>
          <div class="card-meta">
            <span>⏱ ${totalTime} min</span>
            <span>👤 ${doc.servings || '—'} servings</span>
            <span>📊 ${doc.difficulty || 'Easy'}</span>
          </div>
        </div>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="btn-sm btn-view"   onclick="viewRecipe('${doc._id}')">View</button>
          <button class="btn-sm btn-edit"   onclick="openEditModal('${doc._id}')">Edit</button>
          <button class="btn-sm btn-delete" onclick="confirmDelete('${doc._id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// Escape HTML to prevent XSS
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// CRUD: CREATE
// ============================================================
function openAddModal() {
  document.getElementById('form-modal-title').textContent = 'Add New Recipe';
  document.getElementById('edit-id').value = '';
  ['name', 'desc', 'prep', 'cook', 'servings', 'ingredients', 'instructions'].forEach(f => {
    document.getElementById('f-' + f).value = '';
  });
  document.getElementById('f-category').value = '';
  document.getElementById('f-difficulty').value = 'Easy';
  openModal('form-modal');
}

// ============================================================
// CRUD: UPDATE
// ============================================================
function openEditModal(id) {
  const doc = DB.findById(id);
  if (!doc) return;
  document.getElementById('form-modal-title').textContent = 'Edit Recipe';
  document.getElementById('edit-id').value = id;
  document.getElementById('f-name').value        = doc.name || '';
  document.getElementById('f-desc').value        = doc.description || '';
  document.getElementById('f-category').value    = doc.category || '';
  document.getElementById('f-prep').value        = doc.prepTime || '';
  document.getElementById('f-cook').value        = doc.cookTime || '';
  document.getElementById('f-servings').value    = doc.servings || '';
  document.getElementById('f-difficulty').value  = doc.difficulty || 'Easy';
  document.getElementById('f-ingredients').value = doc.ingredients || '';
  document.getElementById('f-instructions').value = doc.instructions || '';
  openModal('form-modal');
}

function saveRecipe() {
  const name     = document.getElementById('f-name').value.trim();
  const category = document.getElementById('f-category').value;
  if (!name)     { showToast('Please enter a recipe name.', 'error'); return; }
  if (!category) { showToast('Please select a category.', 'error'); return; }

  const data = {
    name,
    category,
    description:  document.getElementById('f-desc').value.trim(),
    prepTime:     parseInt(document.getElementById('f-prep').value) || 0,
    cookTime:     parseInt(document.getElementById('f-cook').value) || 0,
    servings:     parseInt(document.getElementById('f-servings').value) || 1,
    difficulty:   document.getElementById('f-difficulty').value,
    ingredients:  document.getElementById('f-ingredients').value.trim(),
    instructions: document.getElementById('f-instructions').value.trim(),
  };

  const editId = document.getElementById('edit-id').value;
  if (editId) {
    DB.updateOne(editId, data);
    showToast('Recipe updated successfully!', 'success');
  } else {
    DB.insertOne(data);
    showToast('Recipe added to collection!', 'success');
  }
  closeModal('form-modal');
  renderGrid();
}

// ============================================================
// CRUD: READ (view single)
// ============================================================
function viewRecipe(id) {
  const doc = DB.findById(id);
  if (!doc) return;
  DB.log('findOne', { _id: id });

  const cfg = CATEGORY_CONFIG[doc.category] || { color: '#7A7568', bg: '#F2EFE8', emoji: '🍴' };
  const totalTime = (parseInt(doc.prepTime) || 0) + (parseInt(doc.cookTime) || 0);

  const ingredients = (doc.ingredients || '').split('\n').filter(Boolean)
    .map(i => `<li>${esc(i)}</li>`).join('');
  const steps = (doc.instructions || '').split('\n').filter(Boolean)
    .map(s => `<li>${esc(s)}</li>`).join('');

  document.getElementById('view-body').innerHTML = `
    <div class="view-emoji">${cfg.emoji}</div>
    <div style="text-align:center; margin-bottom:0.5rem;">
      <span class="view-category-tag" style="background:${cfg.bg}; color:${cfg.color}">${doc.category}</span>
    </div>
    <h2 class="view-title" style="text-align:center">${esc(doc.name)}</h2>
    <div class="view-meta" style="justify-content:center">
      <span>⏱ ${totalTime} min total</span>
      <span>👤 ${doc.servings} servings</span>
      <span>📊 ${doc.difficulty}</span>
    </div>
    ${doc.description ? `<p class="view-desc">${esc(doc.description)}</p>` : ''}
    ${ingredients ? `<div class="view-section-title">Ingredients</div><ul class="ingredients-list">${ingredients}</ul>` : ''}
    ${steps ? `<div class="view-section-title">Instructions</div><ol class="steps-list">${steps}</ol>` : ''}
  `;
  openModal('view-modal');
}

// ============================================================
// CRUD: DELETE
// ============================================================
let pendingDeleteId = null;
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-delete-btn').onclick = () => {
    DB.deleteOne(pendingDeleteId);
    closeModal('confirm-modal');
    renderGrid();
    showToast('Recipe deleted.', 'info');
  };
  openModal('confirm-modal');
}

// ============================================================
// Modal Helpers
// ============================================================
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

// ============================================================
// Toast Notifications
// ============================================================
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================================
// App Init
// ============================================================
seedDB();
renderGrid();