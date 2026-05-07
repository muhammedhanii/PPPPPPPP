const API = {
  async request(path, options = {}) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (!response.ok) {
      let message = 'Request failed.';
      try {
        const data = await response.json();
        if (data && data.error) message = data.error;
      } catch {
        // Ignore parse errors and keep fallback message
      }
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  },

  listRecipes() {
    return this.request('/api/recipes');
  },

  createRecipe(recipe) {
    return this.request('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe)
    });
  },

  updateRecipe(id, recipe) {
    return this.request(`/api/recipes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(recipe)
    });
  },

  deleteRecipe(id) {
    return this.request(`/api/recipes/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
};

const state = {
  recipes: []
};

const CATEGORY_CONFIG = {
  Breakfast: { color: '#BA7517', bg: '#FAEEDA', emoji: '🍳' },
  Lunch: { color: '#185FA5', bg: '#E6F1FB', emoji: '🥗' },
  Dinner: { color: '#3B6D11', bg: '#EAF3DE', emoji: '🍽️' },
  Dessert: { color: '#993556', bg: '#FBEAF0', emoji: '🍰' },
  Snack: { color: '#534AB7', bg: '#EEEDFE', emoji: '🫙' },
  Drink: { color: '#0F6E56', bg: '#E1F5EE', emoji: '🥤' }
};

let currentFilter = '';
let currentSearch = '';
let currentSort = 'newest';

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderStats(docs) {
  const total = state.recipes.length;
  const cats = [...new Set(state.recipes.map((d) => d.category))].length;
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
  let docs = [...state.recipes];

  if (currentFilter) docs = docs.filter((d) => d.category === currentFilter);
  if (currentSearch) {
    docs = docs.filter((d) =>
      d.name.toLowerCase().includes(currentSearch) ||
      (d.description || '').toLowerCase().includes(currentSearch) ||
      (d.ingredients || '').toLowerCase().includes(currentSearch)
    );
  }

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

  grid.innerHTML = docs.map((doc) => {
    const cfg = CATEGORY_CONFIG[doc.category] || { color: '#7A7568', bg: '#F2EFE8', emoji: '🍴' };
    const totalTime = (parseInt(doc.prepTime, 10) || 0) + (parseInt(doc.cookTime, 10) || 0);
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
          <button class="btn-sm btn-view" onclick="viewRecipe('${doc._id}')">View</button>
          <button class="btn-sm btn-edit" onclick="openEditModal('${doc._id}')">Edit</button>
          <button class="btn-sm btn-delete" onclick="confirmDelete('${doc._id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function openAddModal() {
  document.getElementById('form-modal-title').textContent = 'Add New Recipe';
  document.getElementById('edit-id').value = '';
  ['name', 'desc', 'prep', 'cook', 'servings', 'ingredients', 'instructions'].forEach((f) => {
    document.getElementById(`f-${f}`).value = '';
  });
  document.getElementById('f-category').value = '';
  document.getElementById('f-difficulty').value = 'Easy';
  openModal('form-modal');
}

function openEditModal(id) {
  const doc = state.recipes.find((d) => d._id === id);
  if (!doc) return;

  document.getElementById('form-modal-title').textContent = 'Edit Recipe';
  document.getElementById('edit-id').value = id;
  document.getElementById('f-name').value = doc.name || '';
  document.getElementById('f-desc').value = doc.description || '';
  document.getElementById('f-category').value = doc.category || '';
  document.getElementById('f-prep').value = doc.prepTime || '';
  document.getElementById('f-cook').value = doc.cookTime || '';
  document.getElementById('f-servings').value = doc.servings || '';
  document.getElementById('f-difficulty').value = doc.difficulty || 'Easy';
  document.getElementById('f-ingredients').value = doc.ingredients || '';
  document.getElementById('f-instructions').value = doc.instructions || '';
  openModal('form-modal');
}

async function saveRecipe() {
  const name = document.getElementById('f-name').value.trim();
  const category = document.getElementById('f-category').value;
  if (!name) {
    showToast('Please enter a recipe name.', 'error');
    return;
  }
  if (!category) {
    showToast('Please select a category.', 'error');
    return;
  }

  const data = {
    name,
    category,
    description: document.getElementById('f-desc').value.trim(),
    prepTime: parseInt(document.getElementById('f-prep').value, 10) || 0,
    cookTime: parseInt(document.getElementById('f-cook').value, 10) || 0,
    servings: parseInt(document.getElementById('f-servings').value, 10) || 1,
    difficulty: document.getElementById('f-difficulty').value,
    ingredients: document.getElementById('f-ingredients').value.trim(),
    instructions: document.getElementById('f-instructions').value.trim()
  };

  try {
    const editId = document.getElementById('edit-id').value;
    if (editId) {
      await API.updateRecipe(editId, data);
      showToast('Recipe updated successfully!', 'success');
    } else {
      await API.createRecipe(data);
      showToast('Recipe added to collection!', 'success');
    }
    closeModal('form-modal');
    await refreshRecipes();
    renderGrid();
  } catch (error) {
    showToast(error.message || 'Failed to save recipe.', 'error');
  }
}

function viewRecipe(id) {
  const doc = state.recipes.find((d) => d._id === id);
  if (!doc) return;

  const cfg = CATEGORY_CONFIG[doc.category] || { color: '#7A7568', bg: '#F2EFE8', emoji: '🍴' };
  const totalTime = (parseInt(doc.prepTime, 10) || 0) + (parseInt(doc.cookTime, 10) || 0);

  const ingredients = (doc.ingredients || '')
    .split('\n')
    .filter(Boolean)
    .map((i) => `<li>${esc(i)}</li>`)
    .join('');

  const steps = (doc.instructions || '')
    .split('\n')
    .filter(Boolean)
    .map((s) => `<li>${esc(s)}</li>`)
    .join('');

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

let pendingDeleteId = null;
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-delete-btn').onclick = async () => {
    try {
      await API.deleteRecipe(pendingDeleteId);
      closeModal('confirm-modal');
      await refreshRecipes();
      renderGrid();
      showToast('Recipe deleted.', 'info');
    } catch (error) {
      showToast(error.message || 'Failed to delete recipe.', 'error');
    }
  };
  openModal('confirm-modal');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

async function refreshRecipes() {
  state.recipes = await API.listRecipes();
}

async function initializeApp() {
  try {
    await refreshRecipes();
    renderGrid();
  } catch (error) {
    showToast(error.message || 'Failed to load recipes.', 'error');
  }
}

initializeApp();
