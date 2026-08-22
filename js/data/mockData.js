/* ======================================================================
   mockData.js — the analyzed project the frontend renders.
   Mirrors the example output in §17 of the idea doc: an e-commerce app
   with a frontend, a backend and a database layer.

   The real backend (§15) will eventually emit this exact shape, so the
   UI never has to change: { meta, stats, nodes, edges, tree, chat }.
   ====================================================================== */

export const meta = {
  name: 'shopfront-web',
  language: 'JavaScript / React',
  analyzedAt: 'just now',
  loc: 10480,
};

/* §10 — project overview counters */
export const stats = [
  { key: 'files',      label: 'Files',           value: 42 },
  { key: 'components', label: 'Components',      value: 28 },
  { key: 'functions',  label: 'Functions',       value: 143 },
  { key: 'endpoints',  label: 'API Endpoints',   value: 17 },
  { key: 'deps',       label: 'Dependencies',    value: 31 },
  { key: 'critical',   label: 'Critical Modules', value: 6 },
];

export const LAYERS = {
  ui:    { label: 'UI',       color: 'var(--layer-ui)' },
  logic: { label: 'Logic',    color: 'var(--layer-logic)' },
  api:   { label: 'API',      color: 'var(--layer-api)' },
  data:  { label: 'Database', color: 'var(--layer-data)' },
  other: { label: 'Other',    color: 'var(--layer-other)' },
};

const W = 132;
const H = 44;

/* ----------------------------------------------------------------------
   Nodes. x/y are layout coordinates inside a 1240 x 760 viewBox.
   ---------------------------------------------------------------------- */
export const nodes = [
  /* ---- UI layer ---- */
  {
    id: 'LoginPage', name: 'LoginPage', layer: 'ui', x: 30, y: 40, w: W, h: H,
    path: 'src/pages/Login.jsx', line: 1, importance: 'MEDIUM', fns: 4,
    purpose: 'Collects credentials and starts a session.',
    plain: { purpose: 'The sign-in screen where someone types their email and password.' },
    explanation:
      'The login screen. It renders the email/password form, hands the credentials to AuthService, and redirects to the dashboard once a session exists. It holds no auth logic of its own — it only reacts to what AuthService returns.',
    code: `export default function Login() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await signIn(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password');
    }
  }

  return <AuthForm onSubmit={handleSubmit} error={error} />;
}`,
    hot: [7, 8],
  },
  {
    id: 'ProductList', name: 'ProductList', layer: 'ui', x: 222, y: 40, w: W, h: H,
    path: 'src/pages/ProductList.jsx', line: 1, importance: 'LOW', fns: 3,
    purpose: 'Renders the browsable product catalogue.',
    plain: { purpose: 'The screen showing all the products someone can browse.' },
    explanation:
      'Fetches a paginated product list through ProductAPI and renders it as a grid. Purely presentational beyond the fetch — no writes, no shared state.',
    code: `export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    productApi.list({ page }).then(setProducts);
  }, [page]);

  return (
    <Grid>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </Grid>
  );
}`,
    hot: [6],
  },
  {
    id: 'ProductDetails', name: 'ProductDetails', layer: 'ui', x: 414, y: 40, w: W, h: H,
    path: 'src/pages/ProductDetails.jsx', line: 1, importance: 'LOW', fns: 4,
    purpose: 'Shows one product and adds it to the cart.',
    plain: { purpose: 'The screen for one product, with the button that adds it to the basket.' },
    explanation:
      'Loads a single product by id and exposes the "Add to cart" action. This is the first point where the catalogue and the cart meet.',
    code: `export default function ProductDetails({ id }) {
  const product = useProduct(id);
  const { addItem } = useCart();

  if (!product) return <Skeleton />;

  return (
    <Layout>
      <ProductHero product={product} />
      <AddToCart onAdd={() => addItem(product.id, 1)} />
    </Layout>
  );
}`,
    hot: [10],
  },
  {
    id: 'CartPage', name: 'CartPage', layer: 'ui', x: 606, y: 40, w: W, h: H,
    path: 'src/pages/Cart.jsx', line: 1, importance: 'LOW', fns: 5,
    purpose: 'Lists cart contents and quantities.',
    plain: { purpose: 'The basket screen listing what someone has picked, and how many.' },
    explanation:
      'Reads the cart from CartService and lets the user change quantities or remove lines. Requires a signed-in user, so it also reads UserContext.',
    code: `export default function Cart() {
  const { items, update, remove, total } = useCart();
  const { user } = useUser();

  if (!user) return <Redirect to="/login" />;
  if (!items.length) return <EmptyCart />;

  return (
    <CartTable
      items={items}
      onQuantity={update}
      onRemove={remove}
      total={total}
    />
  );
}`,
    hot: [2, 3],
  },
  {
    id: 'CheckoutPage', name: 'CheckoutPage', layer: 'ui', x: 798, y: 40, w: W, h: H,
    path: 'src/pages/Checkout.jsx', line: 1, importance: 'MEDIUM', fns: 6,
    purpose: 'Turns a cart into a paid order.',
    plain: { purpose: 'The screen where someone pays and the order is placed.' },
    explanation:
      'The highest-risk screen in the app: it reads the cart, the signed-in user and the payment service at once. A change to any of those three shows up here first.',
    code: `export default function Checkout() {
  const { items, total, clear } = useCart();
  const { user } = useUser();
  const [status, setStatus] = useState('idle');

  async function pay() {
    setStatus('processing');
    const order = await payments.charge({ userId: user.id, items, total });
    clear();
    setStatus('done');
    return order;
  }

  return <CheckoutForm total={total} status={status} onPay={pay} />;
}`,
    hot: [7, 8],
  },
  {
    id: 'DashboardPage', name: 'Dashboard', layer: 'ui', x: 990, y: 40, w: W, h: H,
    path: 'src/pages/Dashboard.jsx', line: 1, importance: 'MEDIUM', fns: 4,
    purpose: 'Landing screen for a signed-in user.',
    plain: { purpose: 'The screen someone lands on after signing in, showing their recent orders.' },
    explanation:
      'Shows recent orders and recommendations. It reads the session from UserContext, which is why it appears in the blast radius of anything auth-related.',
    code: `export default function Dashboard() {
  const { user } = useUser();
  const recent = useRecentOrders(user?.id);

  return (
    <Layout title={\`Welcome back, \${user.name}\`}>
      <OrderList orders={recent} />
      <Recommended for={user.id} />
    </Layout>
  );
}`,
    hot: [2],
  },

  /* ---- Logic layer ---- */
  {
    id: 'TokenService', name: 'TokenService', layer: 'logic', x: 30, y: 175, w: W, h: H,
    path: 'src/services/tokenService.js', line: 1, importance: 'HIGH', fns: 5,
    purpose: 'Issues, stores and verifies JWTs.',
    plain: { purpose: 'Keeps the pass that remembers someone is signed in, so they do not have to type their password again.' },
    explanation:
      'The lowest-level piece of the auth chain. Both the browser (to attach a token) and the server (to verify one) depend on it, which is why it carries a HIGH importance despite being only ~60 lines.',
    code: `const KEY = 'sf.token';

export function save(token) {
  localStorage.setItem(KEY, token);
}

export function read() {
  return localStorage.getItem(KEY);
}

export function isExpired(token) {
  const { exp } = decode(token);
  return Date.now() >= exp * 1000;
}

export function clear() {
  localStorage.removeItem(KEY);
}`,
    hot: [11, 12, 13],
  },
  {
    id: 'UserContext', name: 'UserContext', layer: 'logic', x: 222, y: 175, w: W, h: H,
    path: 'src/context/UserContext.jsx', line: 1, importance: 'HIGH', fns: 6,
    purpose: 'Holds the signed-in user for the whole app.',
    plain: { purpose: 'Keeps track of who is signed in, so every screen knows who it is talking to.' },
    explanation:
      'A React context that every screen reads to answer "who is logged in?". It subscribes to AuthService and re-renders its consumers whenever the session changes. Removing it would break routing, the cart and checkout simultaneously.',
    code: `const Ctx = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.restoreSession()
      .then(setUser)
      .finally(() => setLoading(false));
    return auth.onChange(setUser);
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export const useUser = () => useContext(Ctx);`,
    hot: [7, 8, 11],
  },
  {
    id: 'AuthService', name: 'AuthService', layer: 'logic', x: 414, y: 175, w: W, h: H,
    path: 'src/services/authService.js', line: 1, importance: 'HIGH', fns: 8,
    purpose: 'Handles user authentication and session creation.',
    plain: { purpose: 'Checks an email and password, and starts a signed-in session.' },
    explanation:
      'The hub of the authentication flow. It exchanges credentials for a token via ApiClient, persists it through TokenService, and notifies UserContext. Almost every authenticated screen depends on it — directly or one hop away.',
    code: `import { api } from './apiClient';
import * as tokens from './tokenService';

export async function signIn(email, password) {
  const { token, user } = await api.post('/auth/login', { email, password });
  tokens.save(token);
  emit('change', user);
  return user;
}

export async function restoreSession() {
  const token = tokens.read();
  if (!token || tokens.isExpired(token)) return null;
  return api.get('/auth/me');
}

export function signOut() {
  tokens.clear();
  emit('change', null);
}`,
    hot: [4, 5, 6, 7],
  },
  {
    id: 'CartService', name: 'CartService', layer: 'logic', x: 702, y: 175, w: W, h: H,
    path: 'src/services/cartService.js', line: 1, importance: 'MEDIUM', fns: 7,
    purpose: 'Keeps cart state in sync with the server.',
    plain: { purpose: 'Keeps the basket up to date — adding items, removing them and adding up the total.' },
    explanation:
      'Owns the cart: add, update, remove, total. Writes go through ApiClient so the cart survives a refresh. Read by three screens, so changes here are felt across the shopping flow.',
    code: `export function useCart() {
  const [items, setItems] = useState([]);

  const addItem = async (productId, qty) => {
    const next = await api.post('/cart/items', { productId, qty });
    setItems(next);
  };

  const remove = async (lineId) => {
    setItems(await api.del('/cart/items/' + lineId));
  };

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return { items, addItem, remove, total };
}`,
    hot: [4, 5],
  },
  {
    id: 'PaymentService', name: 'PaymentService', layer: 'logic', x: 990, y: 175, w: W, h: H,
    path: 'server/services/paymentService.js', line: 1, importance: 'HIGH', fns: 6,
    purpose: 'Charges a card and records the order.',
    plain: { purpose: 'Takes the payment and records the order once the money goes through.' },
    explanation:
      'Wraps the payment provider and hands the result to OrderController. Marked HIGH because a failure here is silent money loss, not a visual bug — it deserves the strictest review of anything in the graph.',
    code: `export async function charge({ userId, items, total }) {
  const intent = await provider.createIntent({
    amount: toMinorUnits(total),
    currency: 'usd',
    metadata: { userId },
  });

  if (intent.status !== 'succeeded') {
    throw new PaymentError(intent.failureReason);
  }

  return orders.create({ userId, items, total, intentId: intent.id });
}`,
    hot: [8, 9, 10, 12],
  },

  /* ---- API layer ---- */
  {
    id: 'ApiClient', name: 'ApiClient', layer: 'api', x: 414, y: 310, w: W, h: H,
    path: 'src/services/apiClient.js', line: 1, importance: 'HIGH', fns: 9,
    purpose: 'Single HTTP entry point for the frontend.',
    plain: { purpose: 'The one place every message to the server goes through.' },
    explanation:
      'Every network call in the app funnels through here — it attaches the auth token, sets base headers and normalises errors. The most connected node in the graph: change its error shape and every caller feels it.',
    code: `const BASE = import.meta.env.VITE_API_URL;

async function request(method, path, body) {
  const token = tokens.read();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: 'Bearer ' + token }),
    },
    body: body && JSON.stringify(body),
  });

  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export const api = {
  get:  (p)    => request('GET', p),
  post: (p, b) => request('POST', p, b),
  del:  (p)    => request('DELETE', p),
};`,
    hot: [4, 8, 9, 15],
  },
  {
    id: 'ProductAPI', name: 'ProductAPI', layer: 'api', x: 702, y: 310, w: W, h: H,
    path: 'src/services/productApi.js', line: 1, importance: 'MEDIUM', fns: 5,
    purpose: 'Typed wrapper over the product endpoints.',
    plain: { purpose: 'Asks the server for product information on behalf of the screens.' },
    explanation:
      'Thin, intentional layer between the catalogue screens and ApiClient. It exists so the UI never builds URLs by hand.',
    code: `export const productApi = {
  list: ({ page = 1, size = 24 } = {}) =>
    api.get('/products?page=' + page + '&size=' + size),

  byId: (id) => api.get('/products/' + id),

  search: (q) => api.get('/products/search?q=' + encodeURIComponent(q)),
};`,
    hot: [2, 3],
  },
  {
    id: 'AuthController', name: 'AuthController', layer: 'api', x: 222, y: 445, w: W, h: H,
    path: 'server/controllers/authController.js', line: 1, importance: 'MEDIUM', fns: 6,
    purpose: 'Server-side login, logout and session endpoints.',
    plain: { purpose: 'On the server: checks an email and password against the stored accounts.' },
    explanation:
      'Validates credentials against the Users table, signs a token and returns the public user object. The server-side mirror of AuthService.',
    code: `router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await Users.findByEmail(email);

  if (!user || !(await verify(password, user.hash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const token = tokens.sign({ sub: user.id, role: user.role });
  res.json({ token, user: toPublic(user) });
});`,
    hot: [3, 5, 6, 9],
  },
  {
    id: 'ProductController', name: 'ProductController', layer: 'api', x: 606, y: 445, w: W, h: H,
    path: 'server/controllers/productController.js', line: 1, importance: 'MEDIUM', fns: 5,
    purpose: 'Serves catalogue reads.',
    plain: { purpose: 'On the server: hands back product information when a screen asks for it.' },
    explanation:
      'Read-only controller over the Products table with pagination and search. No writes, so its blast radius is small.',
    code: `router.get('/products', async (req, res) => {
  const { page = 1, size = 24 } = req.query;
  const rows = await Products.page({ page, size });
  res.json(rows);
});

router.get('/products/:id', async (req, res) => {
  const product = await Products.byId(req.params.id);
  if (!product) return res.sendStatus(404);
  res.json(product);
});`,
    hot: [3, 8],
  },
  {
    id: 'OrderController', name: 'OrderController', layer: 'api', x: 990, y: 445, w: W, h: H,
    path: 'server/controllers/orderController.js', line: 1, importance: 'MEDIUM', fns: 7,
    purpose: 'Creates and reads orders.',
    plain: { purpose: 'On the server: saves an order once the payment has gone through.' },
    explanation:
      'Persists an order once PaymentService confirms a charge, and serves order history back to the dashboard.',
    code: `export async function create({ userId, items, total, intentId }) {
  const order = await Orders.insert({
    userId,
    total,
    intentId,
    status: 'paid',
    placedAt: new Date(),
  });

  await Orders.addLines(order.id, items);
  return order;
}`,
    hot: [2, 10],
  },

  /* ---- Data layer ---- */
  {
    id: 'UsersDB', name: 'Users', layer: 'data', x: 222, y: 580, w: W, h: H,
    path: 'server/db/users.js', line: 1, importance: 'HIGH', fns: 6,
    purpose: 'User accounts and password hashes.',
    plain: { purpose: 'Where people’s accounts and passwords are kept.' },
    explanation:
      'The table behind every authentication decision. Schema changes here ripple all the way up to the login screen.',
    code: `export const Users = {
  findByEmail: (email) =>
    db.one('SELECT * FROM users WHERE email = $1', [email]),

  byId: (id) =>
    db.one('SELECT * FROM users WHERE id = $1', [id]),

  create: ({ email, hash, name }) =>
    db.one('INSERT INTO users (email, hash, name) VALUES ($1,$2,$3) RETURNING *',
           [email, hash, name]),
};`,
    hot: [2, 3],
  },
  {
    id: 'ProductsDB', name: 'Products', layer: 'data', x: 606, y: 580, w: W, h: H,
    path: 'server/db/products.js', line: 1, importance: 'MEDIUM', fns: 5,
    purpose: 'Product catalogue storage.',
    plain: { purpose: 'Where the product catalogue is kept.' },
    explanation:
      'Paginated reads over the products table. Read-heavy and cacheable — the safest table in the project to change.',
    code: `export const Products = {
  page: ({ page, size }) =>
    db.many('SELECT * FROM products ORDER BY id LIMIT $1 OFFSET $2',
            [size, (page - 1) * size]),

  byId: (id) =>
    db.oneOrNone('SELECT * FROM products WHERE id = $1', [id]),
};`,
    hot: [2],
  },
  {
    id: 'OrdersDB', name: 'Orders', layer: 'data', x: 990, y: 580, w: W, h: H,
    path: 'server/db/orders.js', line: 1, importance: 'MEDIUM', fns: 6,
    purpose: 'Orders and order lines.',
    plain: { purpose: 'Where completed orders are kept.' },
    explanation:
      'Write path for completed purchases. Touched only by OrderController, which keeps its dependency surface small.',
    code: `export const Orders = {
  insert: (order) =>
    db.one('INSERT INTO orders (user_id, total, status) VALUES ($1,$2,$3) RETURNING *',
           [order.userId, order.total, order.status]),

  addLines: (orderId, items) =>
    db.tx(t => items.map(i =>
      t.none('INSERT INTO order_lines VALUES ($1,$2,$3)', [orderId, i.id, i.qty]))),
};`,
    hot: [2],
  },
];

/* ----------------------------------------------------------------------
   Edges: { from, to } reads as "from depends on / calls to".
   Impact analysis walks these backwards.
   ---------------------------------------------------------------------- */
export const edges = [
  { from: 'LoginPage',       to: 'AuthService' },
  { from: 'LoginPage',       to: 'UserContext' },
  { from: 'ProductList',     to: 'ProductAPI' },
  { from: 'ProductDetails',  to: 'ProductAPI' },
  { from: 'ProductDetails',  to: 'CartService' },
  { from: 'CartPage',        to: 'CartService' },
  { from: 'CartPage',        to: 'UserContext' },
  { from: 'CheckoutPage',    to: 'CartService' },
  { from: 'CheckoutPage',    to: 'PaymentService' },
  { from: 'CheckoutPage',    to: 'UserContext' },
  { from: 'DashboardPage',   to: 'UserContext' },
  { from: 'DashboardPage',   to: 'ProductAPI' },
  { from: 'UserContext',     to: 'AuthService' },
  { from: 'AuthService',     to: 'ApiClient' },
  { from: 'AuthService',     to: 'TokenService' },
  { from: 'CartService',     to: 'ApiClient' },
  { from: 'PaymentService',  to: 'OrderController' },
  { from: 'ProductAPI',      to: 'ApiClient' },
  { from: 'ProductAPI',      to: 'ProductController' },
  { from: 'ApiClient',       to: 'AuthController' },
  { from: 'AuthController',  to: 'UsersDB' },
  { from: 'AuthController',  to: 'TokenService' },
  { from: 'ProductController', to: 'ProductsDB' },
  { from: 'OrderController', to: 'OrdersDB' },
];

/* ----------------------------------------------------------------------
   File explorer tree. `node` links a file back to a graph node.
   ---------------------------------------------------------------------- */
export const tree = [
  {
    type: 'dir', name: 'src', open: true, children: [
      {
        type: 'dir', name: 'pages', open: true, children: [
          { type: 'file', name: 'Login.jsx',          node: 'LoginPage' },
          { type: 'file', name: 'ProductList.jsx',    node: 'ProductList' },
          { type: 'file', name: 'ProductDetails.jsx', node: 'ProductDetails' },
          { type: 'file', name: 'Cart.jsx',           node: 'CartPage' },
          { type: 'file', name: 'Checkout.jsx',       node: 'CheckoutPage' },
          { type: 'file', name: 'Dashboard.jsx',      node: 'DashboardPage' },
        ],
      },
      {
        type: 'dir', name: 'context', open: true, children: [
          { type: 'file', name: 'UserContext.jsx', node: 'UserContext' },
        ],
      },
      {
        type: 'dir', name: 'services', open: true, children: [
          { type: 'file', name: 'authService.js',  node: 'AuthService' },
          { type: 'file', name: 'cartService.js',  node: 'CartService' },
          { type: 'file', name: 'tokenService.js', node: 'TokenService' },
          { type: 'file', name: 'apiClient.js',    node: 'ApiClient' },
          { type: 'file', name: 'productApi.js',   node: 'ProductAPI' },
        ],
      },
    ],
  },
  {
    type: 'dir', name: 'server', open: true, children: [
      {
        type: 'dir', name: 'controllers', open: true, children: [
          { type: 'file', name: 'authController.js',    node: 'AuthController' },
          { type: 'file', name: 'productController.js', node: 'ProductController' },
          { type: 'file', name: 'orderController.js',   node: 'OrderController' },
        ],
      },
      {
        type: 'dir', name: 'services', open: false, children: [
          { type: 'file', name: 'paymentService.js', node: 'PaymentService' },
        ],
      },
      {
        type: 'dir', name: 'db', open: false, children: [
          { type: 'file', name: 'users.js',    node: 'UsersDB' },
          { type: 'file', name: 'products.js', node: 'ProductsDB' },
          { type: 'file', name: 'orders.js',   node: 'OrdersDB' },
        ],
      },
    ],
  },
];

/* ----------------------------------------------------------------------
   §9 — AI codebase chat. Each entry can trace a path on the graph,
   focus a node, or trigger the impact panel.
   ---------------------------------------------------------------------- */
export const chatIntents = [
  {
    match: ['what does this project do', 'what is this project', 'overview', 'summary'],
    answer:
      'This is **shopfront-web**, an e-commerce application in JavaScript/React with an Express backend.\n\nIt has three tiers: six UI screens (catalogue, cart, checkout, dashboard, login), a service layer that owns auth, cart and payments, and three database modules. Every network call funnels through a single **ApiClient**, and every screen that needs a session reads **UserContext**.',
  },
  {
    match: ['explain the authentication flow', 'authentication flow', 'how does auth work', 'how does login work', 'what happens when a user logs in'],
    answer:
      'Authentication runs through five hops:\n\n**LoginPage** collects the credentials → **AuthService** posts them to `/auth/login` → **ApiClient** attaches headers and sends the request → **AuthController** verifies the password against **Users** and signs a JWT → the token comes back and **TokenService** persists it.\n\n**UserContext** then broadcasts the new session, which is what re-renders the rest of the app.',
    trace: ['LoginPage', 'AuthService', 'ApiClient', 'AuthController', 'UsersDB'],
    focus: 'AuthService',
  },
  {
    match: ['where is the database connected', 'database connected', 'db connection', 'which tables'],
    answer:
      'Three modules touch the database, all under `server/db/`:\n\n**Users** — read by AuthController on every login.\n**Products** — read by ProductController for the catalogue.\n**Orders** — written by OrderController after PaymentService confirms a charge.\n\nNothing in `src/` talks to the database directly; the frontend only ever reaches the controllers through ApiClient.',
    trace: ['ApiClient', 'AuthController', 'UsersDB'],
    focus: 'UsersDB',
  },
  {
    match: ['which component is most important', 'most important', 'most connected', 'critical'],
    answer:
      '**UserContext** has the most direct connections — 5 edges — because every screen that needs a session reads it.\n\n**ApiClient** has the widest *reach*: 10 modules sit downstream of it, since every service call funnels through it.\n\n**AuthService** is the most consequential of the three, sitting between the UI and both ApiClient and TokenService. Six modules are marked critical overall: AuthService, ApiClient, UserContext, TokenService, PaymentService and Users.',
    focus: 'ApiClient',
  },
  {
    match: ['what will break if i remove authservice', 'remove authservice', 'impact of authservice'],
    answer:
      'Removing **AuthService** is a HIGH impact change. I have run the analysis on the right — it walks the dependency edges backwards from AuthService and lists everything that would lose its session.',
    impact: 'AuthService',
    focus: 'AuthService',
  },
  {
    match: ['show me the flow from loginpage to the database', 'login to database', 'trace login', 'flow to database'],
    answer:
      'Here is the full path, traced on the graph:\n\n```\nLoginPage → AuthService → ApiClient → AuthController → Users\n```\n\nFive hops, crossing the UI, logic, API and data layers. The token produced at the end travels back up the same chain and lands in TokenService.',
    trace: ['LoginPage', 'AuthService', 'ApiClient', 'AuthController', 'UsersDB'],
  },
  {
    match: ['what happens if i change apiclient', 'change apiclient', 'impact of apiclient'],
    answer:
      '**ApiClient** is the widest-reaching module in the project. Every service call passes through it, so a change to its error shape or headers reaches the entire frontend. The blast radius is on the right.',
    impact: 'ApiClient',
    focus: 'ApiClient',
  },
  {
    match: ['is there dead code', 'unused', 'dead code'],
    answer:
      'Two candidates in this project: `src/utils/legacyFormat.js` has no inbound edges, and `ProductController.search` is exported but never called from the frontend. Neither is in the graph above because nothing references them — which is exactly how they were found.',
  },
];

export const chatSuggestions = [
  'Explain the authentication flow',
  'Which component is most important?',
  'What will break if I remove AuthService?',
  'Where is the database connected?',
];

/* Sample project offered on the Code Input page. */
export const sampleCode = `import { api } from './apiClient';
import * as tokens from './tokenService';

// Handles user authentication and session creation.
export async function signIn(email, password) {
  const { token, user } = await api.post('/auth/login', { email, password });
  tokens.save(token);
  emit('change', user);
  return user;
}

export async function restoreSession() {
  const token = tokens.read();
  if (!token || tokens.isExpired(token)) return null;
  return api.get('/auth/me');
}

export function signOut() {
  tokens.clear();
  emit('change', null);
}
`;
