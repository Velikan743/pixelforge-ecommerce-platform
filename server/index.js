import express from 'express';
import mongoose from 'mongoose';
import { promisify } from 'node:util';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } else if (origin && (req.path.startsWith('/api/auth') || req.path.startsWith('/api/account') || req.path.startsWith('/api/admin') || req.path.startsWith('/api/products') || req.path.startsWith('/api/orders') || req.path.startsWith('/api/builds') || req.path.startsWith('/api/categories') || req.path.startsWith('/api/brands'))) {
    return res.status(403).json({ error: 'This site is not allowed to use the account service.' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  next();
});
app.use(express.json({ limit: '32kb' }));

const productSchema = new mongoose.Schema({
  id: { type: String, index: true },
  name: { type: String, required: true, trim: true },
  model: { type: String, default: '' },
  category: { type: String, required: true, index: true },
  brand: { type: String, default: '', index: true },
  sku: { type: String, default: '', trim: true, maxlength: 64 },
  specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  warranty: { type: String, default: '', trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 4000 },
  price: { type: Number, required: true, min: 0 },
  old: { type: Number, min: 0 },
  stock: { type: Number, min: 0, default: 0 },
  lowStockThreshold: { type: Number, min: 0, max: 1000000, default: 5 },
  rating: { type: String, default: '0' },
  reviews: { type: Number, default: 0 },
  badge: { type: String, default: '' },
  image: { type: String, default: '' },
  color: { type: String, default: 'blue' },
}, { timestamps: true, versionKey: false });
productSchema.index({ name: 'text', model: 'text', category: 'text' });
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const productCategories = new Set(['Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage', 'Power', 'Cases', 'Cooling', 'Monitors', 'Peripherals', 'Accessories']);
const productBrands = new Set();
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  parent: { type: String, default: '', trim: true, maxlength: 80 },
  displayOrder: { type: Number, default: 0, min: 0, max: 10000 },
  active: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  website: { type: String, default: '', trim: true, maxlength: 200 },
  active: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
const productColors = new Set(['lavender', 'mint', 'peach', 'blue']);
const defaultProductDescription = 'Demo catalogue product. Confirm specifications and availability before purchase.';

function productJson(product) {
  const record = typeof product.toObject === 'function' ? product.toObject() : product;
  return { ...record, specifications: record.specifications instanceof Map ? Object.fromEntries(record.specifications) : record.specifications || {}, id: String(record.id || record._id) };
}
async function findProductById(id) {
  const byPublicId = await Product.findOne({ id: String(id) });
  if (byPublicId) return byPublicId;
  return mongoose.isValidObjectId(id) ? Product.findById(id) : null;
}
function parseProductInput(body) {
  const name = String(body?.name || '').trim();
  const model = String(body?.model || '').trim();
  const category = String(body?.category || '');
  const brand = String(body?.brand || '').trim();
  const sku = String(body?.sku || '').trim().toUpperCase();
  const description = String(body?.description || '').trim();
  const warranty = String(body?.warranty || '').trim();
  let specifications = body?.specifications || {};
  if (typeof specifications === 'string') {
    try { specifications = specifications.trim() ? JSON.parse(specifications) : {}; }
    catch { return { error: 'Specifications must be valid JSON.' }; }
  }
  const regularPrice = Number(body?.regularPrice);
  const discountPercent = Number(body?.discountPercent || 0);
  const stock = Number(body?.stock);
  const lowStockThreshold = Number(body?.lowStockThreshold ?? 5);
  const image = String(body?.image || 'photo-1591488320449-011701bb6704').trim();
  const color = String(body?.color || 'blue');
  if (name.length < 2 || name.length > 120) return { error: 'Product name must be between 2 and 120 characters.' };
  if (model.length > 180) return { error: 'Product model details must be 180 characters or less.' };
  if (!productCategories.has(category)) return { error: 'Choose an active product category.' };
  if (brand && !productBrands.has(brand)) return { error: 'Choose an active brand.' };
  if (sku.length > 64 || (sku && !/^[A-Z0-9._-]+$/.test(sku))) return { error: 'SKU may contain letters, numbers, dots, underscores, and hyphens.' };
  if (!specifications || typeof specifications !== 'object' || Array.isArray(specifications) || Object.keys(specifications).length > 50) return { error: 'Specifications must be an object with up to 50 fields.' };
  const normalizedSpecifications = {};
  for (const [key, rawValue] of Object.entries(specifications)) {
    const cleanKey = key.trim();
    const cleanValue = String(rawValue ?? '').trim();
    if (!cleanKey || cleanKey.length > 60 || cleanValue.length > 240) return { error: 'Each specification name must be 1–60 characters and its value 240 characters or less.' };
    normalizedSpecifications[cleanKey] = cleanValue;
  }
  if (!Number.isFinite(regularPrice) || regularPrice < 1 || regularPrice > 100000000) return { error: 'Enter a valid price greater than zero.' };
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 90) return { error: 'Discount must be between 0 and 90 percent.' };
  if (!Number.isInteger(stock) || stock < 0 || stock > 10000000) return { error: 'Stock must be a whole number between 0 and 10,000,000.' };
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 1000000) return { error: 'Low-stock threshold must be a whole number between 0 and 1,000,000.' };
  if (description.length > 4000) return { error: 'Description must be 4,000 characters or less.' };
  if (warranty.length > 120) return { error: 'Warranty details must be 120 characters or less.' };
  if (image.length > 120) return { error: 'Image identifier must be 120 characters or less.' };
  if (!productColors.has(color)) return { error: 'Choose a valid product color.' };
  const price = Math.round(regularPrice * (1 - discountPercent / 100));
  return { value: { name, model, category, brand, sku, specifications: normalizedSpecifications, warranty, description, price, old: discountPercent ? regularPrice : undefined, stock, lowStockThreshold, image, color } };
}

const addressSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 40 },
  recipient: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  pincode: { type: String, required: true, trim: true, maxlength: 6 },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });
const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  mobile: { type: String, default: '', trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer', required: true },
  status: { type: String, enum: ['active', 'blocked'], default: 'active', index: true },
  addresses: { type: [addressSchema], default: [] },
  mustChangePassword: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });
const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, versionKey: false });
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  model: { type: String, default: '' },
  category: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });
const orderSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  items: { type: [orderItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  delivery: {
    name: { type: String, required: true }, email: { type: String, required: true },
    phone: { type: String, required: true }, address: { type: String, required: true },
    city: { type: String, required: true }, state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  paymentMethod: { type: String, enum: ['upi', 'cod'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  status: { type: String, enum: ['Placed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'], default: 'Placed' },
  stockReserved: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
const savedBuildSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  products: { type: [String], required: true, validate: values => values.length > 0 && values.length <= 8 },
}, { timestamps: true, versionKey: false });
const SavedBuild = mongoose.models.SavedBuild || mongoose.model('SavedBuild', savedBuildSchema);
const inventoryMovementSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true }, productName: { type: String, required: true }, sku: { type: String, default: '' },
  change: { type: Number, required: true }, previousStock: { type: Number, required: true }, newStock: { type: Number, required: true },
  reason: { type: String, required: true, maxlength: 180 }, actor: { type: String, default: '' },
}, { timestamps: true, versionKey: false });
inventoryMovementSchema.index({ createdAt: -1 });
const InventoryMovement = mongoose.models.InventoryMovement || mongoose.model('InventoryMovement', inventoryMovementSchema);
async function writeInventoryMovement(product,{change,previousStock,newStock,reason,actor=''}) {
  return InventoryMovement.create({productId:String(product.id||product._id),productName:product.name,sku:product.sku||'',change,previousStock,newStock,reason,actor});
}

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
  return { id: String(account._id), name: account.name, email: account.email, mobile: account.mobile || '', role: account.role, status: account.status || 'active', addresses: (account.addresses || []).map(address => ({ id: String(address._id), label: address.label, recipient: address.recipient, phone: address.phone, address: address.address, city: address.city, state: address.state, pincode: address.pincode, isDefault: Boolean(address.isDefault) })), mustChangePassword: Boolean(account.mustChangePassword) };
}

async function requireAuth(req, res, next) {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token || token.length > 256) return res.status(401).json({ error: 'Please sign in to continue.' });
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).populate('account');
    if (!session?.account || session.account.status === 'blocked') {
      clearSessionCookie(res);
      return res.status(session?.account?.status === 'blocked' ? 403 : 401).json({ error: session?.account?.status === 'blocked' ? 'This account is currently blocked. Contact store support.' : 'Your session expired. Please sign in again.' });
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
    const mobile = String(req.body?.mobile || '').trim();
    const password = String(req.body?.password || '');
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter a name between 2 and 80 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!/^[0-9+() -]{8,30}$/.test(mobile)) return res.status(400).json({ error: 'Enter a valid mobile number.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const account = await Account.create({ name, email, mobile, passwordHash: await hashPassword(password), role: 'customer' });
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
    if (account.status === 'blocked') return res.status(403).json({ error: 'This account is currently blocked. Contact store support.' });
    await createSession(account, res);
    res.json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ account: publicAccount(req.account) }));
app.get('/api/account', requireAuth, requirePasswordChangeComplete, (req, res) => res.json({ account: publicAccount(req.account) }));
app.put('/api/account/profile', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const mobile = String(req.body?.mobile || '').trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    if (!/^[0-9+() -]{8,30}$/.test(mobile)) return res.status(400).json({ error: 'Enter a valid mobile number.' });
    const account = await Account.findByIdAndUpdate(req.account._id, { $set: { name, mobile } }, { new: true, runValidators: true });
    res.json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});
function parseAddress(body) {
  const fields = ['label', 'recipient', 'phone', 'address', 'city', 'state', 'pincode'];
  const value = Object.fromEntries(fields.map(field => [field, String(body?.[field] || '').trim()]));
  const limits = { label: 40, recipient: 100, phone: 30, address: 240, city: 100, state: 100, pincode: 6 };
  if (fields.some(field => !value[field] || value[field].length > limits[field])) return { error: 'Complete each address field using the allowed length.' };
  if (!/^[0-9+() -]{8,30}$/.test(value.phone)) return { error: 'Enter a valid phone number.' };
  if (!/^[0-9]{6}$/.test(value.pincode)) return { error: 'Enter a valid six-digit PIN code.' };
  return { value: { ...value, isDefault: Boolean(body?.isDefault) } };
}
app.post('/api/account/addresses', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const parsed = parseAddress(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const account = await Account.findById(req.account._id);
    if (account.addresses.length >= 10) return res.status(400).json({ error: 'You can save up to 10 addresses.' });
    if (!account.addresses.length || parsed.value.isDefault) account.addresses.forEach(address => { address.isDefault = false; });
    account.addresses.push({ ...parsed.value, isDefault: !account.addresses.length || parsed.value.isDefault });
    await account.save();
    res.status(201).json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});
app.put('/api/account/addresses/:addressId', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const parsed = parseAddress(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const account = await Account.findById(req.account._id);
    const address = account.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    if (parsed.value.isDefault) account.addresses.forEach(item => { item.isDefault = false; });
    Object.assign(address, parsed.value);
    await account.save();
    res.json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});
app.delete('/api/account/addresses/:addressId', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const account = await Account.findById(req.account._id);
    const address = account.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ error: 'Address not found.' });
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && account.addresses.length) account.addresses[0].isDefault = true;
    await account.save();
    res.json({ account: publicAccount(account) });
  } catch (error) { next(error); }
});
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

function publicOrder(order) {
  const record = typeof order.toObject === 'function' ? order.toObject() : order;
  return { ...record, id: String(record._id), customerId: String(record.customer) };
}
function validateDelivery(body) {
  const fields = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode'];
  const delivery = Object.fromEntries(fields.map(field => [field, String(body?.[field] || '').trim()]));
  const maxLengths = { name: 100, email: 254, phone: 30, address: 240, city: 100, state: 100, pincode: 6 };
  if (fields.some(field => !delivery[field] || delivery[field].length > maxLengths[field])) return { error: 'Complete each delivery field using the allowed length.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery.email)) return { error: 'Enter a valid delivery email.' };
  if (!/^[0-9]{6}$/.test(delivery.pincode)) return { error: 'Enter a valid six-digit PIN code.' };
  if (!/^[0-9+() -]{8,30}$/.test(delivery.phone)) return { error: 'Enter a valid phone number.' };
  return { value: delivery };
}

app.get('/api/builds', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const builds=await SavedBuild.find({customer:req.account._id}).sort({updatedAt:-1}).lean();
    res.json({items:builds.map(build=>({...build,id:String(build._id),products:build.products||[]}))});
  } catch(error){next(error);}
});
app.post('/api/builds', requireAuth, requirePasswordChangeComplete, async (req,res,next)=>{
  try {
    if(req.account.role!=='customer')return res.status(403).json({error:'Customer accounts are required to save PC builds.'});
    const name=String(req.body?.name||'').trim();
    const ids=Array.isArray(req.body?.products)?req.body.products.map(id=>String(id).trim()):[];
    if(name.length<2||name.length>60)return res.status(400).json({error:'Build name must contain 2 to 60 characters.'});
    if(!ids.length||ids.length>8||new Set(ids).size!==ids.length)return res.status(400).json({error:'Select one unique product for each of up to eight build slots.'});
    const categories=new Set();
    for(const id of ids){const product=await findProductById(id);if(!product)return res.status(400).json({error:'A selected product is no longer in the catalogue.'});if(categories.has(product.category))return res.status(400).json({error:'A build can only contain one product per component category.'});categories.add(product.category);}
    const build=await SavedBuild.create({customer:req.account._id,name,products:ids});
    res.status(201).json({build:{id:String(build._id),name:build.name,products:build.products,createdAt:build.createdAt,updatedAt:build.updatedAt}});
  } catch(error){next(error);}
});
app.delete('/api/builds/:id',requireAuth,requirePasswordChangeComplete,async(req,res,next)=>{
  try {const build=await SavedBuild.findOneAndDelete({_id:req.params.id,customer:req.account._id});if(!build)return res.status(404).json({error:'Saved build not found.'});res.json({ok:true,id:String(build._id)});}
  catch(error){next(error);}
});
app.get('/api/orders', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.account._id }).sort({ createdAt: -1 }).lean();
    res.json({ items: orders.map(publicOrder) });
  } catch (error) { next(error); }
});
app.post('/api/orders', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  const reserved = [];
  try {
    if (req.account.role !== 'customer') return res.status(403).json({ error: 'Customer accounts are required to place orders.' });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Orders require a connected database.' });
    const delivery = validateDelivery(req.body?.delivery);
    if (delivery.error) return res.status(400).json({ error: delivery.error });
    if (!['upi', 'cod'].includes(req.body?.paymentMethod)) return res.status(400).json({ error: 'Choose an available payment method.' });
    if (!Array.isArray(req.body?.items) || req.body.items.length < 1 || req.body.items.length > 50) return res.status(400).json({ error: 'Your order must contain between 1 and 50 products.' });

    const quantities = new Map();
    for (const item of req.body.items) {
      const id = String(item?.id || '').trim();
      const quantity = Number(item?.quantity);
      const expectedPrice = Number(item?.expectedPrice);
      if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isFinite(expectedPrice) || expectedPrice < 0) return res.status(400).json({ error: 'Each product must have a valid quantity and price.' });
      const entry = quantities.get(id) || { quantity: 0, expectedPrice };
      if (entry.expectedPrice !== expectedPrice) return res.status(400).json({ error: 'A product has conflicting prices in your bag.' });
      entry.quantity += quantity;
      quantities.set(id, entry);
    }
    if ([...quantities.values()].some(entry => entry.quantity > 20)) return res.status(400).json({ error: 'A product quantity cannot exceed 20.' });

    const orderItems = [];
    for (const [id, { quantity, expectedPrice }] of quantities) {
      const product = await findProductById(id);
      if (!product) {
        for (const prior of reserved) await Product.updateOne({ _id: prior._id }, { $inc: { stock: prior.quantity } });
        return res.status(409).json({ error: 'A product in your bag is no longer available. Refresh the catalogue and try again.' });
      }
      if (Number(product.price) !== expectedPrice) {
        for (const prior of reserved) await Product.updateOne({ _id: prior._id }, { $inc: { stock: prior.quantity } });
        return res.status(409).json({ error: `${product.name}'s price changed to ₹${Number(product.price).toLocaleString('en-IN')}. Refresh the catalogue and review your bag.` });
      }
      const reservedProduct = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true },
      );
      if (!reservedProduct) {
        for (const prior of reserved) await Product.updateOne({ _id: prior._id }, { $inc: { stock: prior.quantity } });
        return res.status(409).json({ error: `${product.name} does not have enough stock for this quantity.` });
      }
      reserved.push({ _id: product._id, quantity, product:reservedProduct, previousStock:Number(product.stock)||0, newStock:Number(reservedProduct.stock)||0 });
      orderItems.push({ productId: String(product.id || product._id), name: product.name, model: product.model, category: product.category, image: product.image, price: product.price, quantity });
    }

    const order = await Order.create({
      number: `TP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      customer: req.account._id, customerName: req.account.name, customerEmail: req.account.email,
      items: orderItems, total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      delivery: delivery.value, paymentMethod: req.body.paymentMethod, status: 'Placed', paymentStatus: 'pending', stockReserved: true,
    });
    await Promise.all(reserved.map(item=>writeInventoryMovement(item.product,{change:-item.quantity,previousStock:item.previousStock,newStock:item.newStock,reason:`Stock reserved for ${order.number}`,actor:req.account.email}).catch(error=>console.error('Could not record stock reservation:',error.message))));
    res.status(201).json({ order: publicOrder(order) });
  } catch (error) {
    for (const prior of reserved) await Product.updateOne({ _id: prior._id }, { $inc: { stock: prior.quantity } }).catch(() => {});
    next(error);
  }
});

app.get('/api/admin/orders', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (_req, res, next) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ items: orders.map(publicOrder) });
  } catch (error) { next(error); }
});
app.patch('/api/admin/orders/:id', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const statusTransitions = {
      Placed: ['Processing', 'Cancelled'], Processing: ['Packed', 'Cancelled'], Packed: ['Shipped', 'Cancelled'],
      Shipped: ['Out for Delivery'], 'Out for Delivery': ['Delivered'],
    };
    const status = req.body?.status === undefined ? undefined : String(req.body.status);
    const paymentStatus = req.body?.paymentStatus === undefined ? undefined : String(req.body.paymentStatus);
    if (status !== undefined && !Object.values(statusTransitions).flat().includes(status)) return res.status(400).json({ error: 'Choose a valid next order status.' });
    if (paymentStatus !== undefined && !['pending', 'paid', 'refunded'].includes(paymentStatus)) return res.status(400).json({ error: 'Choose a valid payment status.' });
    if (status === undefined && paymentStatus === undefined) return res.status(400).json({ error: 'Choose an order or payment update.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (status !== undefined && !(statusTransitions[order.status] || []).includes(status)) return res.status(409).json({ error: `Order status cannot move from ${order.status} to ${status}.` });
    if (paymentStatus !== undefined) {
      if (order.status === 'Cancelled') return res.status(409).json({ error: 'Cancelled orders cannot receive payment updates.' });
      const paymentTransitions = { pending: ['paid'], paid: ['refunded'], refunded: [] };
      if (paymentStatus !== order.paymentStatus && !(paymentTransitions[order.paymentStatus] || []).includes(paymentStatus)) return res.status(409).json({ error: `Payment status cannot move from ${order.paymentStatus} to ${paymentStatus}.` });
    }
    if (status === 'Cancelled' && order.paymentStatus === 'paid' && paymentStatus !== 'refunded') return res.status(409).json({ error: 'Record the refund before cancelling a paid order.' });
    if (status === 'Cancelled' && order.stockReserved) {
      const cancelled = await Order.findOneAndUpdate(
        { _id: order._id, status: { $nin: ['Cancelled', 'Delivered'] }, stockReserved: true },
        { $set: { status: 'Cancelled', stockReserved: false, ...(paymentStatus!==undefined?{paymentStatus}:{}) } }, { new: true },
      );
      if (!cancelled) return res.status(409).json({ error: 'This order has already changed. Refresh and try again.' });
      for (const item of cancelled.items) {
        const product = await findProductById(item.productId);
        if (product) {const previousStock=Number(product.stock)||0;const updated=await Product.findOneAndUpdate({_id:product._id},{$inc:{stock:item.quantity}},{new:true});if(updated)await writeInventoryMovement(updated,{change:item.quantity,previousStock,newStock:Number(updated.stock)||0,reason:`Stock released after ${cancelled.number} cancellation`,actor:req.account.email});}
      }
      return res.json({ order: publicOrder(cancelled) });
    }
    if (status !== undefined) order.status = status;
    if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
    await order.save();
    res.json({ order: publicOrder(order) });
  } catch (error) { next(error); }
});
app.get('/api/admin/customers', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 80);
    const filter = { role: 'customer' };
    if (search) filter.$or = [
      { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { mobile: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ];
    const customers = await Account.find(filter, { name: 1, email: 1, mobile: 1, status: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(200).lean();
    const ids = customers.map(customer => customer._id);
    const orderCounts = await Order.aggregate([{ $match: { customer: { $in: ids } } }, { $group: { _id: '$customer', count: { $sum: 1 } } }]);
    const countByCustomer = new Map(orderCounts.map(item => [String(item._id), item.count]));
    res.json({ items: customers.map(customer => ({ id: String(customer._id), name: customer.name, email: customer.email, mobile: customer.mobile || '', status: customer.status || 'active', createdAt: customer.createdAt, orderCount: countByCustomer.get(String(customer._id)) || 0 })) });
  } catch (error) { next(error); }
});
app.patch('/api/admin/customers/:id', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const status = String(req.body?.status || '');
    if (!['active', 'blocked'].includes(status)) return res.status(400).json({ error: 'Choose active or blocked for the customer account.' });
    const customer = await Account.findOneAndUpdate({ _id: req.params.id, role: 'customer' }, { $set: { status } }, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ error: 'Customer account not found.' });
    if (status === 'blocked') await Session.deleteMany({ account: customer._id });
    res.json({ customer: { id: String(customer._id), name: customer.name, email: customer.email, status: customer.status } });
  } catch (error) { next(error); }
});

app.get('/api/admin/summary', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (_req, res, next) => {
  try {
    const [customers, blockedCustomers, inventory, orders] = await Promise.all([
      Account.countDocuments({ role: 'customer', status: 'active' }),
      Account.countDocuments({ role: 'customer', status: 'blocked' }),
      Product.find({}, { price: 1, stock: 1, lowStockThreshold: 1 }).lean(),
      Order.find({}, { status: 1, total: 1, paymentStatus: 1, items: 1, stockReserved: 1 }).lean(),
    ]);
    const reservedByProduct=new Map();for(const order of orders)if(order.stockReserved)for(const item of order.items||[])reservedByProduct.set(item.productId,(reservedByProduct.get(item.productId)||0)+Number(item.quantity||0));
    const stockCounts = inventory.reduce((summary, product) => {
      const stock = Math.max(0, Number(product.stock) || 0);
      const reserved=reservedByProduct.get(String(product.id||product._id))||0;
      summary.inventoryValue += (Number(product.price) || 0) * (stock+reserved);
      if (stock === 0) summary.outOfStock += 1;
      else {
        summary.inStock += 1;
        if (stock <= Number(product.lowStockThreshold ?? 5)) summary.lowStock += 1;
      }
      return summary;
    }, { inStock: 0, lowStock: 0, outOfStock: 0, inventoryValue: 0 });
    res.json({ customers, blockedCustomers, products: inventory.length, orders: orders.length, pendingOrders: orders.filter(order => ['Placed', 'Processing'].includes(order.status)).length, paidRevenue: orders.filter(order => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0), ...stockCounts });
  } catch (error) { next(error); }
});

app.get('/api/admin/products', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (_req, res, next) => {
  try {
    const products = await Product.find({}).sort({ category: 1, name: 1 }).lean();
    res.json({ items: products.map(productJson) });
  } catch (error) { next(error); }
});
function parseCategoryInput(body) {
  const name=String(body?.name || '').trim();
  const description=String(body?.description || '').trim();
  const parent=String(body?.parent || '').trim();
  const displayOrder=Number(body?.displayOrder || 0);
  if(name.length<2||name.length>80)return{error:'Category name must be between 2 and 80 characters.'};
  if(description.length>500||parent.length>80)return{error:'Category description or parent is too long.'};
  if(!Number.isInteger(displayOrder)||displayOrder<0||displayOrder>10000)return{error:'Display order must be a whole number from 0 to 10,000.'};
  return{value:{name,description,parent,displayOrder,active:body?.active===undefined?true:Boolean(body.active)}};
}
function parseBrandInput(body) {
  const name=String(body?.name || '').trim();
  const description=String(body?.description || '').trim();
  const website=String(body?.website || '').trim();
  if(name.length<2||name.length>80)return{error:'Brand name must be between 2 and 80 characters.'};
  if(description.length>500||website.length>200)return{error:'Brand description or website is too long.'};
  if(website&&!/^https?:\/\//i.test(website))return{error:'Website must start with http:// or https://.'};
  return{value:{name,description,website,active:body?.active===undefined?true:Boolean(body.active)}};
}
function categoryJson(category) { return { id:String(category._id),name:category.name,description:category.description,parent:category.parent,displayOrder:category.displayOrder,active:category.active }; }
function brandJson(brand) { return { id:String(brand._id),name:brand.name,description:brand.description,website:brand.website,active:brand.active }; }
app.get('/api/categories', async (_req,res,next)=>{
  try { const categoriesList=await Category.find({active:true}).sort({displayOrder:1,name:1}).lean(); res.json({items:categoriesList.map(categoryJson)}); }
  catch(error){next(error);}
});
app.get('/api/brands', async (_req,res,next)=>{
  try { const brandsList=await Brand.find({active:true}).sort({name:1}).lean(); res.json({items:brandsList.map(brandJson)}); }
  catch(error){next(error);}
});
app.get('/api/admin/categories',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(_req,res,next)=>{
  try { const items=await Category.find({}).sort({displayOrder:1,name:1}).lean(); res.json({items:items.map(categoryJson)}); }
  catch(error){next(error);}
});
app.post('/api/admin/categories',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const parsed=parseCategoryInput(req.body); if(parsed.error)return res.status(400).json({error:parsed.error});
    if(parsed.value.parent&&!await Category.exists({name:parsed.value.parent,active:true}))return res.status(400).json({error:'Choose an existing active parent category.'});
    const category=await Category.create(parsed.value); if(category.active)productCategories.add(category.name);
    res.status(201).json({category:categoryJson(category)});
  } catch(error){if(error?.code===11000)return res.status(409).json({error:'A category with that name already exists.'});next(error);}
});
app.put('/api/admin/categories/:id',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const parsed=parseCategoryInput(req.body); if(parsed.error)return res.status(400).json({error:parsed.error});
    if(parsed.value.parent&&!await Category.exists({name:parsed.value.parent,active:true,_id:{$ne:req.params.id}}))return res.status(400).json({error:'Choose an existing active parent category.'});
    const category=await Category.findById(req.params.id); if(!category)return res.status(404).json({error:'Category not found.'});
    const previousName=category.name;
    if(category.active&&!parsed.value.active&&await Product.exists({category:previousName}))return res.status(409).json({error:'Move the products to another category before disabling this one.'});
    Object.assign(category,parsed.value); await category.save();
    if(previousName!==category.name){await Product.updateMany({category:previousName},{$set:{category:category.name}});await Category.updateMany({parent:previousName},{$set:{parent:category.name}});}
    if(category.active)productCategories.add(category.name); else productCategories.delete(category.name);
    if(previousName!==category.name)productCategories.delete(previousName);
    res.json({category:categoryJson(category)});
  } catch(error){if(error?.code===11000)return res.status(409).json({error:'A category with that name already exists.'});next(error);}
});
app.delete('/api/admin/categories/:id',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const category=await Category.findById(req.params.id); if(!category)return res.status(404).json({error:'Category not found.'});
    if(await Product.exists({category:category.name}))return res.status(409).json({error:'Move or remove products from this category before deleting it.'});
    if(await Category.exists({parent:category.name}))return res.status(409).json({error:'Remove or reassign its subcategories first.'});
    await category.deleteOne(); productCategories.delete(category.name); res.json({ok:true,id:String(category._id)});
  } catch(error){next(error);}
});
app.get('/api/admin/brands',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(_req,res,next)=>{
  try { const items=await Brand.find({}).sort({name:1}).lean(); res.json({items:items.map(brandJson)}); }
  catch(error){next(error);}
});
app.post('/api/admin/brands',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const parsed=parseBrandInput(req.body); if(parsed.error)return res.status(400).json({error:parsed.error});
    const brand=await Brand.create(parsed.value); if(brand.active)productBrands.add(brand.name); res.status(201).json({brand:brandJson(brand)});
  } catch(error){if(error?.code===11000)return res.status(409).json({error:'A brand with that name already exists.'});next(error);}
});
app.put('/api/admin/brands/:id',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const parsed=parseBrandInput(req.body); if(parsed.error)return res.status(400).json({error:parsed.error});
    const brand=await Brand.findById(req.params.id); if(!brand)return res.status(404).json({error:'Brand not found.'});
    const previousName=brand.name;
    if(brand.active&&!parsed.value.active&&await Product.exists({brand:previousName}))return res.status(409).json({error:'Update the products using this brand before disabling it.'});
    Object.assign(brand,parsed.value); await brand.save();
    if(previousName!==brand.name)await Product.updateMany({brand:previousName},{$set:{brand:brand.name}});
    if(brand.active)productBrands.add(brand.name); else productBrands.delete(brand.name);
    if(previousName!==brand.name)productBrands.delete(previousName);
    res.json({brand:brandJson(brand)});
  } catch(error){if(error?.code===11000)return res.status(409).json({error:'A brand with that name already exists.'});next(error);}
});
app.delete('/api/admin/brands/:id',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const brand=await Brand.findById(req.params.id); if(!brand)return res.status(404).json({error:'Brand not found.'});
    if(await Product.exists({brand:brand.name}))return res.status(409).json({error:'Update products using this brand before deleting it.'});
    await brand.deleteOne(); productBrands.delete(brand.name); res.json({ok:true,id:String(brand._id)});
  } catch(error){next(error);}
});
app.get('/api/admin/inventory',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(_req,res,next)=>{
  try {
    const [products,movements,openOrders]=await Promise.all([Product.find({}).sort({category:1,sku:1,name:1}).lean(),InventoryMovement.find({}).sort({createdAt:-1}).limit(150).lean(),Order.find({stockReserved:true},{items:1}).lean()]);
    const reserved=new Map();for(const order of openOrders)for(const item of order.items)reserved.set(item.productId,(reserved.get(item.productId)||0)+Number(item.quantity||0));
    res.json({items:products.map(product=>({...productJson(product),reservedStock:reserved.get(String(product.id||product._id))||0})),movements:movements.map(movement=>({...movement,id:String(movement._id)}))});
  } catch(error){next(error);}
});
app.get('/api/admin/reports',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const period=String(req.query.period||'30d');const end=new Date();let start=new Date(end);let bucketCount;let bucketMode;
    if(period==='7d'){start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-6);bucketCount=7;bucketMode='day';}
    else if(period==='12m'){start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-11,1));bucketCount=12;bucketMode='month';}
    else if(period==='year'){start=new Date(Date.UTC(end.getUTCFullYear(),0,1));bucketCount=end.getUTCMonth()+1;bucketMode='month';}
    else {start.setUTCHours(0,0,0,0);start.setUTCDate(start.getUTCDate()-29);bucketCount=30;bucketMode='day';}
    const paidCondition={$eq:['$paymentStatus','paid']};
    const [aggregated]=await Order.aggregate([{$match:{createdAt:{$gte:start,$lte:end}}},{$facet:{
      totals:[{$group:{_id:null,orders:{$sum:1},paidOrders:{$sum:{$cond:[paidCondition,1,0]}},paidRevenue:{$sum:{$cond:[paidCondition,'$total',0]}},refunds:{$sum:{$cond:[{$eq:['$paymentStatus','refunded']},'$total',0]}},refundedOrders:{$sum:{$cond:[{$eq:['$paymentStatus','refunded']},1,0]}}}}],
      trend:[{$group:{_id:{$dateToString:{format:bucketMode==='month'?'%Y-%m':'%Y-%m-%d',date:'$createdAt',timezone:'UTC'}},orders:{$sum:1},revenue:{$sum:{$cond:[paidCondition,'$total',0]}}}}],
      categories:[{$match:{paymentStatus:'paid'}},{$unwind:'$items'},{$group:{_id:{$ifNull:['$items.category','Uncategorized']},revenue:{$sum:{$multiply:[{$ifNull:['$items.price',0]},{$ifNull:['$items.quantity',0]}]}}}},{$sort:{revenue:-1}},{$limit:8}],
      topProducts:[{$match:{paymentStatus:'paid'}},{$unwind:'$items'},{$group:{_id:'$items.name',units:{$sum:{$ifNull:['$items.quantity',0]}},revenue:{$sum:{$multiply:[{$ifNull:['$items.price',0]},{$ifNull:['$items.quantity',0]}]}}}},{$sort:{revenue:-1}},{$limit:10}],
      units:[{$match:{paymentStatus:'paid'}},{$unwind:'$items'},{$group:{_id:null,units:{$sum:{$ifNull:['$items.quantity',0]}}}}],
    }}]);
    const makeKey=date=>bucketMode==='month'?`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`:date.toISOString().slice(0,10);
    const trend=[];const cursor=new Date(start);
    for(let index=0;index<bucketCount;index++){const label=bucketMode==='month'?cursor.toLocaleDateString('en-IN',{month:'short',timeZone:'UTC'}):cursor.toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'UTC'});trend.push({key:makeKey(cursor),label,revenue:0,orders:0});if(bucketMode==='month')cursor.setUTCMonth(cursor.getUTCMonth()+1);else cursor.setUTCDate(cursor.getUTCDate()+1);}
    const report=aggregated||{};const totals=report.totals?.[0]||{};const trendByKey=new Map((report.trend||[]).map(item=>[item._id,item]));
    for(const bucket of trend){const saved=trendByKey.get(bucket.key);if(saved){bucket.orders=saved.orders;bucket.revenue=saved.revenue;}}
    const paidRevenue=Number(totals.paidRevenue)||0;const paidOrders=Number(totals.paidOrders)||0;
    res.json({period,start,end,totals:{orders:Number(totals.orders)||0,paidOrders,paidRevenue,averageOrderValue:paidOrders?paidRevenue/paidOrders:0,refunds:Number(totals.refunds)||0,refundedOrders:Number(totals.refundedOrders)||0,units:Number(report.units?.[0]?.units)||0},trend:trend.map(({key,...item})=>item),categories:(report.categories||[]).map(item=>({name:item._id,revenue:item.revenue})),topProducts:(report.topProducts||[]).map(item=>({name:item._id,units:item.units,revenue:item.revenue}))});
  } catch(error){next(error);}
});
app.patch('/api/admin/products/:id/stock',requireAuth,requirePasswordChangeComplete,requireRole('admin'),async(req,res,next)=>{
  try {
    const delta=Number(req.body?.delta);const reason=String(req.body?.reason||'').trim();
    if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>10000000)return res.status(400).json({error:'Enter a non-zero whole-number stock adjustment.'});
    if(reason.length<4||reason.length>180)return res.status(400).json({error:'Add a reason between 4 and 180 characters.'});
    const product=await findProductById(req.params.id);if(!product)return res.status(404).json({error:'Product not found.'});
    const previousStock=Math.max(0,Number(product.stock)||0);const newStock=previousStock+delta;
    if(newStock<0||newStock>10000000)return res.status(409).json({error:'Adjustment would put stock outside the allowed range.'});
    const updated=await Product.findOneAndUpdate({_id:product._id,stock:previousStock},{$set:{stock:newStock}},{new:true});
    if(!updated)return res.status(409).json({error:'Stock changed since you opened this adjustment. Refresh and try again.'});
    try {await writeInventoryMovement(updated,{change:delta,previousStock,newStock,reason,actor:req.account.email});}
    catch(error){await Product.findOneAndUpdate({_id:updated._id,stock:newStock},{$set:{stock:previousStock}});throw error;}
    res.json({product:productJson(updated)});
  } catch(error){next(error);}
});
app.post('/api/admin/products', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const parsed = parseProductInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const product = await Product.create({ id: randomUUID(), ...parsed.value });
    if(product.stock>0)await writeInventoryMovement(product,{change:product.stock,previousStock:0,newStock:product.stock,reason:'Opening inventory',actor:req.account.email});
    res.status(201).json({ product: productJson(product) });
  } catch (error) { next(error); }
});
app.put('/api/admin/products/:id', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const parsed = parseProductInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const previousStock=Math.max(0,Number(product.stock)||0);
    Object.assign(product, parsed.value);
    await product.save();
    if(previousStock!==product.stock)await writeInventoryMovement(product,{change:product.stock-previousStock,previousStock,newStock:product.stock,reason:'Stock changed in product editor',actor:req.account.email});
    res.json({ product: productJson(product) });
  } catch (error) { next(error); }
});
app.delete('/api/admin/products/:id', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const productId = String(product.id || product._id);
    if (await Order.exists({ 'items.productId': productId, stockReserved: true })) return res.status(409).json({ error: 'This product is reserved by an open order. Cancel or complete that order before deleting the product.' });
    await product.deleteOne();
    res.json({ ok: true, id: productId });
  } catch (error) { next(error); }
});

app.get('/api/products', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const { q = '', category, brand, minPrice, maxPrice, inStock, sort = 'featured', page = '1', limit = '24' } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const databaseHasProducts = mongoose.connection.readyState === 1 && await Product.exists({});
    if (!databaseHasProducts) {
      const needle = String(q).trim().toLowerCase();
      const matching = seedProducts.filter(p => {
        const price=Number(p.price)||0;
        return (!category || p.category === category) && (!brand || inferBrand(p)===brand) && (!needle || `${p.name} ${p.model} ${inferBrand(p)} ${p.category}`.toLowerCase().includes(needle)) && (minPrice===undefined || price>=Number(minPrice)) && (maxPrice===undefined || price<=Number(maxPrice)) && (inStock!=='true'||Number(p.stock)>0);
      });
      return res.json({ items: matching.slice((safePage - 1) * safeLimit, safePage * safeLimit), total: matching.length, page: safePage, pages: Math.ceil(matching.length / safeLimit) });
    }
    const filter = {};
    if (category) filter.category = String(category);
    if (brand) filter.brand = String(brand);
    if (minPrice !== undefined || maxPrice !== undefined) filter.price = { ...(minPrice !== undefined ? { $gte: Math.max(0, Number(minPrice)||0) } : {}), ...(maxPrice !== undefined ? { $lte: Math.max(0, Number(maxPrice)||0) } : {}) };
    if (inStock === 'true') filter.stock = { $gt: 0 };
    if (q) filter.$text = { $search: String(q).slice(0, 80) };
    const sortOptions = { featured: { badge: -1, _id: 1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 }, popularity: { reviews: -1, rating: -1 }, rating: { rating: -1, reviews: -1 }, discount: { old: -1, price: 1 } };
    const [items, total] = await Promise.all([
      Product.find(filter).sort(sortOptions[String(sort)] || sortOptions.featured).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ items: items.map(productJson), total, page: safePage, pages: Math.ceil(total / safeLimit) });
  } catch (error) { next(error); }
});
app.get('/api/products/:id', requireAuth, requirePasswordChangeComplete, async (req, res, next) => {
  try {
    const databaseHasProducts = mongoose.connection.readyState === 1 && await Product.exists({});
    const item = databaseHasProducts
      ? await findProductById(req.params.id)
      : seedProducts.find(p => String(p.id) === req.params.id);
    if (!item) return res.status(404).json({ error: 'Product not found' });
    res.json(productJson(item));
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

const brandCandidates = ['Cable Matters','Cooler Master','Fractal Design','Lian Li','PowerColor','TeamGroup','ViewSonic','be quiet!','Thermaltake','DeepCool','Logitech','Keychron','Corsair','Gigabyte','Sapphire','Ergotron','Crucial','Kingston','HyperX','Noctua','Arctic','Sabrent','Seagate','Anker','Razer','Zotac','Lenovo','NVIDIA','Intel','AMD','MSI','ASUS','Dell','HP','AOC','Acer','BenQ','NZXT','LG','WD'];
function inferBrand(product) {
  const source=`${product.name} ${product.model}`.toLowerCase();
  return brandCandidates.find(brand=>source.includes(brand.toLowerCase())) || '';
}
async function seedTaxonomy() {
  const categoryNames=[...productCategories];
  await Promise.all(categoryNames.map((name,displayOrder)=>Category.updateOne({name},{$setOnInsert:{name,description:`Browse ${name.toLowerCase()} and compatible PC components.`,displayOrder,active:true}},{upsert:true})));
  const brands=new Set(seedProducts.map(inferBrand).filter(Boolean));
  await Promise.all([...brands].map(name=>Brand.updateOne({name},{$setOnInsert:{name,description:'Brand represented in the TechParts catalogue.',active:true}},{upsert:true})));
  productCategories.clear();
  for(const category of await Category.find({active:true},{name:1}).lean())productCategories.add(category.name);
  productBrands.clear();
  for(const brand of await Brand.find({active:true},{name:1}).lean())productBrands.add(brand.name);
  const existingProducts=await Product.find({}).select('id name model brand sku specifications');
  for(const product of existingProducts){
    let changed=false;
    if(!product.brand){product.brand=inferBrand(product);changed=true;}
    if(!product.sku){product.sku=`TP-${String(product.id || product._id).replace(/[^A-Za-z0-9]/g,'').slice(-16).toUpperCase()}`;changed=true;}
    if(!product.specifications){product.specifications={};changed=true;}
    if(changed)await product.save();
  }
}

async function seedCatalogue() {
  if (await Product.exists({})) return;
  await Product.insertMany(seedProducts.map(product => ({
    ...product,
    id: String(product.id),
    brand: inferBrand(product),
    sku: `TP-${String(product.id).padStart(5,'0')}`,
    specifications: {},
    description: defaultProductDescription,
    stock: 0,
  })));
  console.log(`Loaded ${seedProducts.length} starter catalogue items; set real prices and stock from the admin page.`);
}

async function start() {
  if (sameSite === 'none' && !secureCookie) throw new Error('SameSite=None cookies require COOKIE_SECURE=true.');
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Account.init(), Session.init(), Product.init(), Order.init(), Category.init(), Brand.init(), SavedBuild.init(), InventoryMovement.init()]);
    await seedTaxonomy();
    await seedCatalogue();
    await seedAdminAccount();
    console.log('Connected to MongoDB; account sessions enabled');
  } else {
    console.warn('MONGODB_URI is not set; account signup/login is disabled until a database is connected.');
  }
  app.listen(port, () => console.log(`TechParts API listening on http://localhost:${port}`));
}
start().catch(error => { console.error('Unable to start the API:', error.message); process.exitCode = 1; });
