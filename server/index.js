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
  } else if (origin && (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin') || req.path.startsWith('/api/products') || req.path.startsWith('/api/orders'))) {
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
  description: { type: String, default: '', maxlength: 4000 },
  price: { type: Number, required: true, min: 0 },
  old: { type: Number, min: 0 },
  stock: { type: Number, min: 0, default: 0 },
  rating: { type: String, default: '0' },
  reviews: { type: Number, default: 0 },
  badge: { type: String, default: '' },
  image: { type: String, default: '' },
  color: { type: String, default: 'blue' },
}, { timestamps: true, versionKey: false });
productSchema.index({ name: 'text', model: 'text', category: 'text' });
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const productCategories = new Set(['Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage', 'Power', 'Cases', 'Cooling', 'Monitors', 'Peripherals', 'Accessories']);
const productColors = new Set(['lavender', 'mint', 'peach', 'blue']);
const defaultProductDescription = 'Demo catalogue product. Confirm specifications and availability before purchase.';

function productJson(product) {
  const record = typeof product.toObject === 'function' ? product.toObject() : product;
  return { ...record, id: String(record.id || record._id) };
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
  const description = String(body?.description || '').trim();
  const regularPrice = Number(body?.regularPrice);
  const discountPercent = Number(body?.discountPercent || 0);
  const stock = Number(body?.stock);
  const image = String(body?.image || 'photo-1591488320449-011701bb6704').trim();
  const color = String(body?.color || 'blue');
  if (name.length < 2 || name.length > 120) return { error: 'Product name must be between 2 and 120 characters.' };
  if (model.length > 180) return { error: 'Product model details must be 180 characters or less.' };
  if (!productCategories.has(category)) return { error: 'Choose a valid product category.' };
  if (!Number.isFinite(regularPrice) || regularPrice < 1 || regularPrice > 100000000) return { error: 'Enter a valid price greater than zero.' };
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 90) return { error: 'Discount must be between 0 and 90 percent.' };
  if (!Number.isInteger(stock) || stock < 0 || stock > 10000000) return { error: 'Stock must be a whole number between 0 and 10,000,000.' };
  if (description.length > 4000) return { error: 'Description must be 4,000 characters or less.' };
  if (image.length > 120) return { error: 'Image identifier must be 120 characters or less.' };
  if (!productColors.has(color)) return { error: 'Choose a valid product color.' };
  const price = Math.round(regularPrice * (1 - discountPercent / 100));
  return { value: { name, model, category, description, price, old: discountPercent ? regularPrice : undefined, stock, image, color } };
}

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
      reserved.push({ _id: product._id, quantity });
      orderItems.push({ productId: String(product.id || product._id), name: product.name, model: product.model, category: product.category, image: product.image, price: product.price, quantity });
    }

    const order = await Order.create({
      number: `TP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      customer: req.account._id, customerName: req.account.name, customerEmail: req.account.email,
      items: orderItems, total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      delivery: delivery.value, paymentMethod: req.body.paymentMethod, status: 'Placed', paymentStatus: 'pending', stockReserved: true,
    });
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
        { $set: { status: 'Cancelled', stockReserved: false } }, { new: true },
      );
      if (!cancelled) return res.status(409).json({ error: 'This order has already changed. Refresh and try again.' });
      for (const item of cancelled.items) {
        const product = await findProductById(item.productId);
        if (product) await Product.updateOne({ _id: product._id }, { $inc: { stock: item.quantity } });
      }
      return res.json({ order: publicOrder(cancelled) });
    }
    if (status !== undefined) order.status = status;
    if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
    await order.save();
    res.json({ order: publicOrder(order) });
  } catch (error) { next(error); }
});

app.get('/api/admin/summary', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (_req, res, next) => {
  try {
    const [customers, inventory, orders] = await Promise.all([
      Account.countDocuments({ role: 'customer' }),
      Product.find({}, { price: 1, stock: 1 }).lean(),
      Order.find({}, { status: 1, total: 1, paymentStatus: 1 }).lean(),
    ]);
    const stockCounts = inventory.reduce((summary, product) => {
      const stock = Math.max(0, Number(product.stock) || 0);
      summary.inventoryValue += (Number(product.price) || 0) * stock;
      if (stock === 0) summary.outOfStock += 1;
      else {
        summary.inStock += 1;
        if (stock <= 5) summary.lowStock += 1;
      }
      return summary;
    }, { inStock: 0, lowStock: 0, outOfStock: 0, inventoryValue: 0 });
    res.json({ customers, products: inventory.length, orders: orders.length, pendingOrders: orders.filter(order => ['Placed', 'Processing'].includes(order.status)).length, paidRevenue: orders.filter(order => order.paymentStatus === 'paid').reduce((sum, order) => sum + order.total, 0), ...stockCounts });
  } catch (error) { next(error); }
});

app.get('/api/admin/products', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (_req, res, next) => {
  try {
    const products = await Product.find({}).sort({ category: 1, name: 1 }).lean();
    res.json({ items: products.map(productJson) });
  } catch (error) { next(error); }
});
app.post('/api/admin/products', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const parsed = parseProductInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const product = await Product.create({ id: randomUUID(), ...parsed.value });
    res.status(201).json({ product: productJson(product) });
  } catch (error) { next(error); }
});
app.put('/api/admin/products/:id', requireAuth, requirePasswordChangeComplete, requireRole('admin'), async (req, res, next) => {
  try {
    const parsed = parseProductInput(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    Object.assign(product, parsed.value);
    await product.save();
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

async function seedCatalogue() {
  if (await Product.exists({})) return;
  await Product.insertMany(seedProducts.map(product => ({
    ...product,
    id: String(product.id),
    description: defaultProductDescription,
    stock: 0,
  })));
  console.log(`Loaded ${seedProducts.length} starter catalogue items; set real prices and stock from the admin page.`);
}

async function start() {
  if (sameSite === 'none' && !secureCookie) throw new Error('SameSite=None cookies require COOKIE_SECURE=true.');
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Account.init(), Session.init(), Product.init(), Order.init()]);
    await seedCatalogue();
    await seedAdminAccount();
    console.log('Connected to MongoDB; account sessions enabled');
  } else {
    console.warn('MONGODB_URI is not set; account signup/login is disabled until a database is connected.');
  }
  app.listen(port, () => console.log(`TechParts API listening on http://localhost:${port}`));
}
start().catch(error => { console.error('Unable to start the API:', error.message); process.exitCode = 1; });
