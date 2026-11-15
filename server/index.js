import express from 'express';
import mongoose from 'mongoose';
import { products as seedProducts } from '../src/product-data.js';

const app = express();
const port = Number(process.env.PORT || 4000);
app.disable('x-powered-by');
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

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'demo-data' }));
app.get('/api/products', async (req, res, next) => {
  try {
    const { q = '', category, page = '1', limit = '24' } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    if (mongoose.connection.readyState !== 1) {
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
app.get('/api/products/:id', async (req, res, next) => {
  try {
    const item = mongoose.connection.readyState === 1
      ? mongoose.isValidObjectId(req.params.id) ? await Product.findById(req.params.id).lean() : null
      : seedProducts.find(p => String(p.id) === req.params.id);
    if (!item) return res.status(404).json({ error: 'Product not found' });
    res.json(item);
  } catch (error) { next(error); }
});
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'The request could not be completed' });
});

async function start() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
  } else {
    console.log('MONGODB_URI is not set; serving the included demo catalogue');
  }
  app.listen(port, () => console.log(`TechParts API listening on http://localhost:${port}`));
}
start().catch(error => { console.error('Unable to start the API:', error.message); process.exitCode = 1; });
