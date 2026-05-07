const http = require('http');
const path = require('path');
const { randomUUID } = require('crypto');
const { promises: fs } = require('fs');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'recipes.json');

const CATEGORY_SET = new Set(['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink']);

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const SEED_RECIPES = [
  {
    name: 'Shakshuka',
    category: 'Breakfast',
    description: 'Poached eggs in spiced tomato and pepper sauce, a classic Middle Eastern dish.',
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    difficulty: 'Easy',
    ingredients: '2 tbsp olive oil\n1 onion, diced\n3 garlic cloves\n2 cans crushed tomatoes\n1 tsp cumin\n1 tsp paprika\n4 eggs\nFresh parsley',
    instructions: 'Heat oil in a skillet\nSauté onion and garlic until soft\nAdd tomatoes and spices, simmer 15 mins\nMake wells and crack eggs in\nCover and cook 8 mins\nGarnish with parsley'
  },
  {
    name: 'Koshari',
    category: 'Dinner',
    description: "Egypt's national dish — rice, lentils, pasta with a tangy tomato sauce.",
    prepTime: 20,
    cookTime: 45,
    servings: 6,
    difficulty: 'Medium',
    ingredients: '1 cup rice\n1 cup lentils\n1 cup elbow pasta\n3 onions\n1 can tomato sauce\n4 garlic cloves\n1 tsp cumin\nOil for frying',
    instructions: 'Cook rice and lentils separately\nBoil pasta until al dente\nFry onions until crispy\nMake tomato garlic sauce\nLayer rice+lentils then pasta\nTop with sauce and crispy onions'
  },
  {
    name: 'Om Ali',
    category: 'Dessert',
    description: 'Egyptian bread pudding with nuts, coconut, and cream — a beloved classic.',
    prepTime: 15,
    cookTime: 30,
    servings: 8,
    difficulty: 'Easy',
    ingredients: '4 croissants\n2 cups milk\n1 cup heavy cream\n1/2 cup sugar\n1/2 cup mixed nuts\n1/4 cup coconut flakes\nCinnamon',
    instructions: 'Preheat oven to 180°C\nTear croissants into pieces\nMix milk cream and sugar\nLayer bread in baking dish\nPour cream mixture over\nTop with nuts and coconut\nBake 25 mins until golden'
  },
  {
    name: 'Falafel Wrap',
    category: 'Lunch',
    description: 'Crispy fried chickpea patties wrapped in flatbread with tahini and veggies.',
    prepTime: 20,
    cookTime: 15,
    servings: 4,
    difficulty: 'Medium',
    ingredients: '400g canned chickpeas\n1 onion\n3 garlic cloves\n1 tsp cumin\n1 tsp coriander\nFlat bread\nTahini\nTomatoes, lettuce',
    instructions: 'Blend chickpeas with onion and spices\nForm into small patties\nFry until golden brown\nWarm flatbreads\nAssemble with tahini and vegetables'
  }
];

function nowIso() {
  return new Date().toISOString();
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeRecipe(input, { partial = false } = {}) {
  const output = {};

  if ('name' in input || !partial) {
    const name = String(input.name || '').trim();
    if (!name) throw new HttpError(400, 'Recipe name is required.');
    output.name = name;
  }

  if ('category' in input || !partial) {
    const category = String(input.category || '').trim();
    if (!CATEGORY_SET.has(category)) throw new HttpError(400, 'A valid category is required.');
    output.category = category;
  }

  if ('description' in input || !partial) output.description = String(input.description || '').trim();
  if ('prepTime' in input || !partial) output.prepTime = toPositiveInt(input.prepTime, 0);
  if ('cookTime' in input || !partial) output.cookTime = toPositiveInt(input.cookTime, 0);
  if ('servings' in input || !partial) output.servings = Math.max(1, toPositiveInt(input.servings, 1));
  if ('difficulty' in input || !partial) output.difficulty = String(input.difficulty || 'Easy').trim() || 'Easy';
  if ('ingredients' in input || !partial) output.ingredients = String(input.ingredients || '').trim();
  if ('instructions' in input || !partial) output.instructions = String(input.instructions || '').trim();

  return output;
}

function withMeta(recipe) {
  const timestamp = nowIso();
  return {
    ...normalizeRecipe(recipe),
    _id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const seed = SEED_RECIPES.map(withMeta);
    await fs.writeFile(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

async function readRecipes() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeRecipes(recipes) {
  await fs.writeFile(DATA_FILE, JSON.stringify(recipes, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new HttpError(413, 'Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(400, 'Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  const recipes = await readRecipes();

  if (pathname === '/api/recipes' && req.method === 'GET') {
    return sendJson(res, 200, recipes);
  }

  if (pathname === '/api/recipes' && req.method === 'POST') {
    const payload = await parseJsonBody(req);
    const newRecipe = {
      ...normalizeRecipe(payload),
      _id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    recipes.push(newRecipe);
    await writeRecipes(recipes);
    return sendJson(res, 201, newRecipe);
  }

  const match = pathname.match(/^\/api\/recipes\/([^/]+)$/);
  if (!match) {
    return sendJson(res, 404, { error: 'Not found.' });
  }

  const recipeId = decodeURIComponent(match[1]);
  const index = recipes.findIndex((item) => item._id === recipeId);
  if (index === -1) {
    return sendJson(res, 404, { error: 'Recipe not found.' });
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, recipes[index]);
  }

  if (req.method === 'PUT') {
    const payload = await parseJsonBody(req);
    const updates = normalizeRecipe(payload, { partial: true });
    recipes[index] = {
      ...recipes[index],
      ...updates,
      updatedAt: nowIso()
    };
    await writeRecipes(recipes);
    return sendJson(res, 200, recipes[index]);
  }

  if (req.method === 'DELETE') {
    recipes.splice(index, 1);
    await writeRecipes(recipes);
    return sendJson(res, 204, {});
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
}

async function handleStatic(res, pathname) {
  const cleanedPath = pathname === '/' ? '/index.html' : pathname;
  const targetPath = path.resolve(ROOT_DIR, `.${cleanedPath}`);

  try {
    const [resolvedRoot, resolvedTarget] = await Promise.all([
      fs.realpath(ROOT_DIR),
      fs.realpath(targetPath)
    ]);

    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    const content = await fs.readFile(targetPath);
    res.writeHead(200, { 'Content-Type': getContentType(targetPath) });
    res.end(content);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      sendText(res, 404, 'Not found');
      return;
    }
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    await handleStatic(res, pathname);
  } catch (error) {
    const status = error instanceof HttpError ? error.statusCode : 500;
    const message = error && error.message ? error.message : 'Internal server error.';
    sendJson(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`RecipeVault backend is running on http://localhost:${PORT}`);
});
