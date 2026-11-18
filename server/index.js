import express from 'express';
import mongoose from 'mongoose';
import { promisify } from 'node:util';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { products as seedProducts } from '../src/product-data.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === 'production';
const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'techparts_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const allowedOrigins = new Set((process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(value => value.trim()).filter(Boolean));
const sameSite = (process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')).toLowerCase();
const secureCookie = isProduction || process.env.COOKIE_SECURE === 'true';

app.disable('x-powered-by');
app.set('trust proxy', isProduction ? 1 : false);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } else if (origin && (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin') || req.path.startsWith('/api/products'))) {
    return res.status(403).json({ error: 'This site is not allowed to use the account service.' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  next();
});
app.use(express.json({ limit: '32kb' }));

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  model: { type: String, default: '' },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },
  old: { type: Number, min: 0 },
  rating: { type: String, default: '0' },
  reviews: { type: Number, default: 0 },
  badge: { type: String, default: '' },
  image: { type: String, default: '' },
  color: { type: String, default: 'blue' },
}, { timestamps: true, versionKey: false });
productSchema.index({ name: 'text', model: 'text', category: 'text' });
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', required: true },
  mustChangePassword: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });
const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, versionKey: false });
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function readCookie(req, name) {
  const prefix = `${name}=`;
  const pair = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : null;
}
function setSessionCookie(res, token) {
  const sameSiteValue = sameSite[0].toUpperCase() + sameSite.slice(1);
  const securePart = secureCookie ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSiteValue}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${securePart}`);
}
function clearSessionCookie(res) {
  const sameSiteValue = sameSite[0].toUpperCase() + sameSite.slice(1);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSiteValue}; Max-Age=0${secureCookie ? '; Secure' : ''}`);
}
function publicAccount(account) {
  return { id: String(account._id), name: account.name, email: account.email, role: account.role, mustChangePassword: Boolean(account.mustChangePassword) };
}

async function requireAuth(req, res, next) {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token || token.length > 256) return res.status(401).json({ error: 'Please sign in to continue.' });
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).populate('account');
    if (!session?.account) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    }
    req.account = session.account;
    req.sessionId = session._id;
    next();
  } catch (error) { next(error); }
}
function requireRole(role) {
  return (req, res, next) => req.account?.role === role
    ? next()
    : res.status(403).json({ error: 'You do not have permission to access this page.' });
}
function requirePasswordChangeComplete(req, res, next) {
  return req.account?.mustChangePassword
    ? res.status(428).json({ error: 'Change the starter admin password before continuing.' })
    : next();
}
async function createSession(account, res) {
  const token = randomBytes(32).toString('base64url');
  await Session.create({ tokenHash: hashToken(token), account: account._id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  setSessionCookie(res, token);
}

// Small per-process throttle for account creation and password guessing.
const authAttempts = new Map();
function limitAuthAttempts(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const record = authAttempts.get(key);
  if (!record || now - record.startedAt > 15 * 60 * 1000) {
    authAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  record.count += 1;
  if (record.count > 12) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
  next();
}
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, value] of authAttempts) if (value.startedAt < cutoff) authAttempts.delete(key);
}, 15 * 60 * 1000).unref();

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'demo-data' }));

app.post('/api/auth/signup', limitAuthAttempts, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Account service is not configured. Connect the database and try again.' });
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter a name between 2 and 80 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const account = await Account.create({ name, email, passwordHash: await hashPassword(password), role: 'customer' });
    await createSession(account, res);
    res.status(201).json({ account: publicAccount(account) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An account already exists for this email. Sign in instead.' });
    next(error);
  }
});

app.post('/api/auth/login', limitAuthAttempts, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Account service is not configured. Connect the database and try again.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const account = await Account.findOne({ email }).select('+passwordHash');
    if (!account || !(await verifyPassword(password, account.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await createSession(account, res);
    res.json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ account: publicAccount(req.account) }));
app.post('/api/auth/password', limitAuthAttempts, requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 12 || newPassword.length > 128) return res.status(400).json({ error: 'Choose a new password between 12 and 128 characters.' });
    const account = await Account.findById(req.account._id).select('+passwordHash');
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) return res.status(401).json({ error: 'Current password is incorrect.' });
    account.passwordHash = await hashPassword(newPassword);
    account.mustChangePassword = false;
    await account.save();
    await Session.deleteMany({ account: account._id, _id: { $ne: req.sessionId } });
    res.json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    await Session.deleteOne({ _id: req.sessionId });
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/admin/summary', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (_req, res, next) => {
  try {
    const [customers, productCount] = await Promise.all([
      Account.countDocuments({ role: 'customer' }),
      mongoose.connection.readyState === 1 ? Product.countDocuments() : Promise.resolve(seedProducts.length),
    ]);
    res.json({ customers, products: productCount || seedProducts.length });
  } catch (error) { next(error); }
});

app.get('/api/products', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const { q = '', category, page = '1', limit = '24' } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const databaseHasProducts = mongoose.connection.readyState === 1 && await Product.exists({});
    if (!databaseHasProducts) {
      const needle = String(q).trim().toLowerCase();
      const matching = seedProducts.filter(p => (!category || p.category === category) && (!needle || `${p.name} ${p.model} ${p.category}`.toLowerCase().includes(needle)));
      return res.json({ items: matching.slice((safePage - 1) * safeLimit, safePage * safeLimit), total: matching.length, page: safePage, pages: Math.ceil(matching.length / safeLimit) });
    }
    const filter = {};
    if (category) filter.category = String(category);
    if (q) filter.$text = { $search: String(q).slice(0, 80) };
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1, _id: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: safePage, pages: Math.ceil(total / safeLimit) });
  } catch (error) { next(error); }
});
app.get('/api/products/:id', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const databaseHasProducts = mongoose.connection.readyState === 1 && await Product.exists({});
    const item = databaseHasProducts
      ? mongoose.isValidObjectId(req.params.id) ? await Product.findById(req.params.id).lean() : null
      : seedProducts.find(p => String(p.id) === req.params.id);
    if (!item) return res.status(404).json({ error: 'Product not found' });
    res.json(item);
  } catch (error) { next(error); }
});

if (isProduction) {
  const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(frontendDirectory, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(resolve(frontendDirectory, 'index.html'), error => { if (error) next(error); });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'The request could not be completed' });
});

async function seedAdminAccount() {
  const email = String(process.env.ADMIN_EMAIL || 'admin1@gmail.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (!isProduction ? 'admin111' : '');
  if (!password || password.length < 8 || password.length > 128) throw new Error('Set ADMIN_PASSWORD to provision the initial admin account (8–128 characters).');
  const existing = await Account.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.passwordHash = await hashPassword(password);
      existing.mustChangePassword = true;
      await existing.save();
    }
    return;
  }
  await Account.create({ name: 'TechParts Admin', email, passwordHash: await hashPassword(password), role: 'admin', mustChangePassword: true });
  console.log(`Provisioned initial admin account: ${email}`);
}

async function start() {
  if (sameSite === 'none' && !secureCookie) throw new Error('SameSite=None cookies require COOKIE_SECURE=true.');
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Account.init(), Session.init()]);
    await seedAdminAccount();
    console.log('Connected to MongoDB; account sessions enabled');
  } else {
    console.warn('MONGODB_URI is not set; account signup/login is disabled until a database is connected.');
  }
  app.listen(port, () => console.log(`TechParts API listening on http://localhost:${port}`));
}
start().catch(error => { console.error('Unable to start the API:', error.message); process.exitCode = 1; });
