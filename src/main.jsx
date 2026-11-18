import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Cpu, Eye, EyeOff, Gamepad2, Headphones, Heart, LockKeyhole, Mail, Menu, Moon, Monitor, PackageCheck, Pencil, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Trash2, Truck, UserRound, X, Zap } from 'lucide-react';
import { products } from './product-data.js';
import './styles.css';

const categories = [
  { name: 'Graphics Cards', short: 'GPUs', icon: Gamepad2 },
  { name: 'Processors', short: 'Processors', icon: Cpu },
  { name: 'Motherboards', short: 'Motherboards', icon: Cpu },
  { name: 'Memory', short: 'Memory', icon: Zap },
  { name: 'Storage', short: 'Storage', icon: PackageCheck },
  { name: 'Power', short: 'Power supplies', icon: Zap },
  { name: 'Cases', short: 'PC cases', icon: PackageCheck },
  { name: 'Cooling', short: 'Cooling', icon: Sparkles },
  { name: 'Monitors', short: 'Monitors', icon: Monitor },
  { name: 'Peripherals', short: 'Peripherals', icon: Headphones },
  { name: 'Accessories', short: 'Accessories', icon: ShieldCheck },
];
const money = n => '₹' + n.toLocaleString('en-IN');
const photo = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=720&q=82`;
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const apiUrl = path => `${apiBase}${path}`;
async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (response.status === 401 && path !== '/api/auth/me' && path !== '/api/auth/login' && path !== '/api/auth/signup' && path !== '/api/auth/password') window.dispatchEvent(new Event('techparts:session-expired'));
  return response;
}
const loadSavedProducts = key => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved.filter(item => !/samsung/i.test(`${item?.name || ''} ${item?.model || ''}`)) : [];
  } catch { return []; }
};

function App() {
  const [auth, setAuth] = useState({ status: 'loading', account: null, message: '' });
  const [dark, setDark] = useState(() => localStorage.getItem('techparts-theme') === 'dark');
  const [active, setActive] = useState('All components');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Featured');
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [compare, setCompare] = useState([]);
  const [details, setDetails] = useState(null);
  const [showWishlist, setShowWishlist] = useState(false);
  const [catalog, setCatalog] = useState(products);
  const [drawer, setDrawer] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [ordersPage, setOrdersPage] = useState(false);
  const [adminPage, setAdminPage] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let activeRequest = true;
    apiRequest('/api/auth/me')
      .then(async response => {
        if (!activeRequest) return;
        if (response.ok) {
          const data = await response.json();
          setAuth({ status: 'authenticated', account: data.account, message: '' });
          setAdminPage(data.account.role === 'admin');
        } else if (response.status === 401) setAuth({ status: 'unauthenticated', account: null, message: '' });
        else setAuth({ status: 'unavailable', account: null, message: 'The account service is not ready. Check the database and API setup.' });
      })
      .catch(() => { if (activeRequest) setAuth({ status: 'unavailable', account: null, message: 'Cannot reach the account service. Configure the API URL and try again.' }); });
    return () => { activeRequest = false; };
  }, []);

  useEffect(() => {
    const expireSession = () => {
      setAuth({ status: 'unauthenticated', account: null, message: 'Your session expired. Please sign in again.' });
      setStorageReady(false); setCart([]); setWishlist([]); setOrders([]);
      setCheckout(false); setOrdersPage(false); setAdminPage(false);
    };
    window.addEventListener('techparts:session-expired', expireSession);
    return () => window.removeEventListener('techparts:session-expired', expireSession);
  }, []);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.account) return;
    const prefix = `techparts:${auth.account.id}:`;
    setCart(loadSavedProducts(`${prefix}cart`));
    setWishlist(loadSavedProducts(`${prefix}wishlist`));
    try {
      const savedOrders = JSON.parse(localStorage.getItem(`${prefix}orders`) || '[]');
      setOrders(Array.isArray(savedOrders) ? savedOrders : []);
    } catch { setOrders([]); }
    setStorageReady(true);
  }, [auth.status, auth.account?.id]);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    const controller = new AbortController();
    apiRequest('/api/products?limit=100', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.items?.length) setCatalog(data.items); })
      .catch(error => { if (error.name !== 'AbortError') console.info('Using the local demo catalogue.'); });
    return () => controller.abort();
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let current = true;
    const validateSession = () => apiRequest('/api/auth/me').then(response => {
      if (current && response.status === 401) window.dispatchEvent(new Event('techparts:session-expired'));
    }).catch(() => {});
    const onFocus = () => { if (document.visibilityState === 'visible') validateSession(); };
    const timer = window.setInterval(validateSession, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onFocus);
    return () => { current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onFocus); };
  }, [auth.status]);

  useEffect(() => { if (storageReady && auth.account) localStorage.setItem(`techparts:${auth.account.id}:cart`, JSON.stringify(cart)); }, [cart, storageReady, auth.account]);
  useEffect(() => { if (storageReady && auth.account) localStorage.setItem(`techparts:${auth.account.id}:wishlist`, JSON.stringify(wishlist)); }, [wishlist, storageReady, auth.account]);
  useEffect(() => { if (storageReady && auth.account) localStorage.setItem(`techparts:${auth.account.id}:orders`, JSON.stringify(orders)); }, [orders, storageReady, auth.account]);

  function handleAuthenticated(account) {
    setStorageReady(false);
    setAuth({ status: 'authenticated', account, message: '' });
    setAdminPage(account.role === 'admin');
  }
  async function signOut() {
    try { await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* Clear this browser view even if the server is unavailable. */ }
    setAuth({ status: 'unauthenticated', account: null, message: '' });
    setStorageReady(false); setCart([]); setWishlist([]); setOrders([]);
    setCheckout(false); setOrdersPage(false); setAdminPage(false);
  }
  async function beginCheckout() {
    try {
      const response = await apiRequest('/api/auth/me');
      if (response.status === 401) { window.dispatchEvent(new Event('techparts:session-expired')); return; }
      if (response.ok) { setDrawer(false); setCheckout('form'); }
      else setToast('Checkout is unavailable right now. Please try again.');
    } catch { setToast('Cannot verify your session. Please try again.'); }
    window.setTimeout(() => setToast(''), 2500);
  }

  const visibleProducts = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = catalog.filter(p => (active === 'All components' || p.category === active) && (!q || `${p.name} ${p.model} ${p.category}`.toLowerCase().includes(q)));
    return sort === 'Price: low to high' ? [...list].sort((a,b)=>a.price-b.price) : sort === 'Price: high to low' ? [...list].sort((a,b)=>b.price-a.price) : list;
  }, [active, catalog, query, sort]);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  if (auth.status === 'loading') return <div className={dark ? 'app dark' : 'app'}><div className="auth-loading"><span className="auth-loading-mark"><Zap size={20} fill="currentColor"/></span><b>Checking your session…</b></div></div>;
  if (auth.status !== 'authenticated') return <div className={dark ? 'app dark' : 'app'}><AuthGate initialMessage={auth.message} onAuthenticated={handleAuthenticated}/></div>;
  if (auth.account.mustChangePassword) return <div className={dark ? 'app dark' : 'app'}><PasswordSetup account={auth.account} onComplete={handleAuthenticated} onSignOut={signOut}/></div>;

  function addToCart(product) {
    setCart(current => current.some(i => i.id === product.id) ? current.map(i => i.id === product.id ? {...i, qty:i.qty+1} : i) : [...current, {...product, qty:1}]);
    setToast(`${product.name} added to your bag`);
    window.setTimeout(() => setToast(''), 2200);
  }
  function toggleTheme() {
    const next = !dark; setDark(next); localStorage.setItem('techparts-theme', next ? 'dark' : 'light');
  }
  function toggleWishlist(product) {
    setWishlist(current => current.some(item => item.id === product.id) ? current.filter(item => item.id !== product.id) : [...current, product]);
  }
  function toggleCompare(product) {
    setCompare(current => current.some(item => item.id === product.id)
      ? current.filter(item => item.id !== product.id)
      : current.length < 3 ? [...current, product] : current);
    if (!compare.some(item => item.id === product.id) && compare.length >= 3) {
      setToast('Compare up to 3 products at a time');
      window.setTimeout(() => setToast(''), 2200);
    }
  }
  async function placeOrder(delivery) {
    try {
      const sessionResponse = await apiRequest('/api/auth/me');
      if (sessionResponse.status === 401) { window.dispatchEvent(new Event('techparts:session-expired')); return false; }
      if (!sessionResponse.ok) return false;
    } catch { setToast('Cannot verify your session. Please try again.'); window.setTimeout(() => setToast(''), 2500); return false; }
    const order = {
      number: `TP-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      items: cart, total: cartTotal, delivery, status: 'Order preview', createdAt: new Date().toISOString(),
    };
    const savedSummary = { number: order.number, items: order.items, total: order.total, status: order.status, createdAt: order.createdAt };
    setOrders(current => [savedSummary, ...current]);
    setPlacedOrder(order);
    setCart([]);
    setCheckout('confirmed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  return <div className={dark ? 'app dark' : 'app'}>
    <div className="announcement"><span><Sparkles size={13}/> THE COMPONENTS YOU WANT, AT PRICES YOU’LL LOVE</span><a href="#products">See what’s new <ArrowRight size={13}/></a></div>
    <header className="header">
      <a className="brand" href="#home" aria-label="TechParts home"><span className="brand-mark"><Zap size={20} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a>
      <nav className={mobileMenu ? 'nav open' : 'nav'}><a className="nav-active" href="#products" onClick={()=>{setAdminPage(false);setOrdersPage(false);setCheckout(false);setBuilder(false);setMobileMenu(false)}}>Shop</a><a href="#categories" onClick={()=>{setAdminPage(false);setMobileMenu(false)}}>Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true);setAdminPage(false);setOrdersPage(false);setMobileMenu(false)}}>PC Builder <span className="new-pill">NEW</span></a><a href="#orders" onClick={e=>{e.preventDefault();setOrdersPage(true);setAdminPage(false);setBuilder(false);setCheckout(false);setMobileMenu(false)}}>Orders</a>{auth.account.role === 'admin' && <a href="#admin" onClick={e=>{e.preventDefault();setAdminPage(true);setBuilder(false);setOrdersPage(false);setCheckout(false);setMobileMenu(false)}}>Admin</a>}<button className="nav-signout" onClick={signOut}>Sign out</button></nav>
      <div className="header-actions"><label className="search-box"><Search size={17}/><input aria-label="Search products" placeholder="Search components..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><span className="account-chip" title={auth.account.email}><UserRound size={15}/><span>{auth.account.name}</span>{auth.account.role === 'admin' && <b>ADMIN</b>}</span><button className="signout-button" onClick={signOut}>Sign out</button><button className="icon-button theme-button" aria-label="Toggle theme" onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="wishlist-header" onClick={()=>setShowWishlist(true)} aria-label={`Wishlist, ${wishlist.length} products`}><Heart size={18}/><span>Saved</span>{wishlist.length>0&&<b>{wishlist.length}</b>}</button><button className="bag-button" onClick={()=>setDrawer(true)} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19}/><span>Bag</span><b>{cartCount}</b></button><button className="icon-button menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button></div>
    </header>
    <main>
      {adminPage && auth.account.role === 'admin' ? <AdminPage account={auth.account} onShop={()=>setAdminPage(false)}/> : builder ? <Builder onBack={()=>setBuilder(false)} onAdd={addToCart}/> : checkout==='form' ? <CheckoutPage items={cart} total={cartTotal} onBack={()=>setCheckout(false)} onPlace={placeOrder}/> : checkout==='confirmed' ? <OrderConfirmation order={placedOrder} onShop={()=>{setCheckout(false);setOrdersPage(false)}} onOrders={()=>{setCheckout(false);setOrdersPage(true)}}/> : ordersPage ? <OrdersPage orders={orders} onShop={()=>setOrdersPage(false)}/> : <>
        <section className="hero" id="home">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/>THE NEXT LEVEL STARTS HERE</div><h1>Your setup.<br/>Your <em>story.</em></h1><p>Thoughtful gear for the way you play, create, and work. Find your next favorite piece.</p><div className="hero-buttons"><a className="button-primary" href="#products">Explore components <ArrowRight size={16}/></a><button className="button-text" onClick={()=>setBuilder(true)}>Build your PC <ArrowUpRight size={15}/></button></div><div className="hero-proof"><div className="avatars"><span>R</span><span>A</span><span>K</span><span>+</span></div><div><strong>Loved by 12,000+ builders</strong><small>★★★★★ <span>4.9 / 5 average rating</span></small></div></div></div>
          <div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"/><div className="hero-product"><img src={photo('photo-1587202372775-e229f172b9d7')} alt="High-performance graphics card"/><span className="floating-tag tag-top"><span className="tag-dot"/>NEW DROP <strong>RTX 50 SERIES</strong></span><span className="floating-tag tag-bottom"><span className="tag-icon"><Zap size={17}/></span><span>Built for more<small>Make every frame count</small></span><ArrowUpRight size={17}/></span></div><div className="hero-scribble">MAKE<br/>IT YOURS<span>↗</span></div><span className="hero-index">01 / 04</span></div>
        </section>
        <section className="trust-strip" aria-label="Shopping benefits"><div><Truck/><span><b>Free delivery</b><small>on orders over ₹2,000</small></span></div><div><ShieldCheck/><span><b>Genuine gear</b><small>100% authorized products</small></span></div><div><PackageCheck/><span><b>Easy returns</b><small>7-day return window</small></span></div><div><Heart/><span><b>Here to help</b><small>Real humans, always</small></span></div></section>
        <section className="categories-section section" id="categories"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>FIND YOUR THING</div><h2>Browse by <em>category.</em></h2></div><a className="subtle-link" href="#products">All categories <ArrowRight size={15}/></a></div><div className="category-grid">{categories.map(({name,short,icon:Icon},index)=>{const count=catalog.filter(product=>product.category===name).length;const art={'Graphics Cards':'RTX',Processors:'CPU',Motherboards:'AM5',Memory:'DDR5',Storage:'NVMe',Power:'WATT',Cases:'ATX',Cooling:'°C',Monitors:'QHD',Peripherals:'PRO',Accessories:'GEAR'}[name];return <button key={name} className={`category-card cat-${index}`} onClick={()=>{setActive(name);document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}><span className="category-icon"><Icon size={22}/></span><span className="category-copy"><b>{short}</b><small>{count} {count===1?'product':'products'}</small></span><ArrowUpRight className="category-arrow" size={17}/><span className="category-art">{art}</span></button>})}</div></section>
        <section className="products-section section" id="products"><div className="section-heading product-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>GOOD GEAR, GREAT DAYS</div><h2>Made for your <em>next.</em></h2><p>A few community favorites to get you started.</p><small className="catalog-disclaimer">Demo catalogue · listed prices, availability, and ratings need verification before sale.</small></div><a className="subtle-link desktop-link" href="#products">Explore the shop <ArrowRight size={15}/></a></div>
          <div className="product-toolbar"><div className="filter-tabs"><button className={active==='All components'?'selected':''} onClick={()=>setActive('All components')}>Everything <span>{catalog.length}</span></button>{['Graphics Cards','Processors','Memory','Storage'].map(c=><button key={c} className={active===c?'selected':''} onClick={()=>setActive(c)}>{c}</button>)}</div><label className="sort-control"><SlidersHorizontal size={15}/><span>Sort:</span><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products"><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option></select><ChevronDown size={14}/></label></div>
          {visibleProducts.length ? <div className="product-grid">{visibleProducts.map(p=><ProductCard key={p.id} product={p} onAdd={addToCart} onDetails={setDetails} onWishlist={toggleWishlist} onCompare={toggleCompare} saved={wishlist.some(item=>item.id===p.id)} compared={compare.some(item=>item.id===p.id)}/>)}</div> : <div className="empty-state"><Search/><b>No components found</b><span>Try another search or browse everything.</span><button onClick={()=>{setQuery('');setActive('All components')}}>Clear filters</button></div>}
          <a className="mobile-all subtle-link" href="#products">Explore the shop <ArrowRight size={15}/></a>
        </section>
        <section className="builder-banner section" id="builder"><div className="builder-graphic"><div className="builder-ring"/><div className="builder-chip"><Cpu size={48}/><span>AM5</span></div><div className="builder-node node-one">GPU <b>✓</b></div><div className="builder-node node-two">RAM <b>✓</b></div><div className="builder-node node-three">CPU <b>✓</b></div><div className="builder-mini">BUILD<br/>01</div></div><div className="builder-copy"><div className="eyebrow"><span className="eyebrow-line"/>A LITTLE HELP, A LOT OF POWER</div><h2>Big ideas.<br/><em>Zero guesswork.</em></h2><p>Build your dream setup with our step-by-step PC Builder. We’ll check every part for compatibility along the way.</p><div className="builder-features"><span><Check size={15}/> Smart compatibility checks</span><span><Check size={15}/> Live build total</span></div><button className="button-primary" onClick={()=>setBuilder(true)}>Start your build <ArrowRight size={16}/></button><div className="builder-note"><Sparkles size={13}/> Even beginners build like pros.</div></div></section>
        <section className="newsletter"><div className="newsletter-mark"><Zap size={24}/></div><div><div className="eyebrow">THE GOOD STUFF, OCCASIONALLY</div><h2>First dibs. <em>No noise.</em></h2><p>New arrivals, builder tips, and the occasional very good deal.</p></div><form className="newsletter-form" onSubmit={e=>{e.preventDefault();setToast('You’re on the list. Welcome aboard!');setTimeout(()=>setToast(''),2500);e.target.reset()}}><input type="email" required placeholder="Your email address" aria-label="Your email address"/><button type="submit" aria-label="Subscribe"><ArrowRight size={18}/></button><small>No spam. Unsubscribe any time.</small></form><div className="newsletter-star">✳</div></section>
      </>}
    </main>
    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Zap size={19} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a><p>Good gear makes good things happen.</p><div className="footer-links"><a href="#products">Shop</a><a href="#categories">Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true)}}>PC Builder</a><a href="mailto:hello@techparts.in">Contact</a></div><span className="copyright">© 2025 TechParts India</span></footer>
    {drawer && <><button className="drawer-scrim" aria-label="Close bag" onClick={()=>setDrawer(false)}/><aside className="cart-drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR GOOD FINDS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={()=>setDrawer(false)} aria-label="Close"><X/></button></div>{cart.length ? <><div className="cart-items">{cart.map(item=><div className="cart-row" key={item.id}><img src={photo(item.image)} alt=""/><div className="cart-info"><b>{item.name}</b><small>{item.model}</small><div className="quantity"><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:Math.max(1,i.qty-1)}:i))}>−</button><span>{item.qty}</span><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i))}>+</button><button className="remove" onClick={()=>setCart(c=>c.filter(i=>i.id!==item.id))}>Remove</button></div></div><strong>{money(item.price*item.qty)}</strong></div>)}</div><div className="drawer-bottom"><div className="free-shipping"><Truck size={16}/>{cartTotal>=2000?'Your delivery is on us!':'Add '+money(2000-cartTotal)+' for free delivery'}</div><div className="subtotal"><span>Subtotal</span><b>{money(cartTotal)}</b></div><small>Shipping and applicable taxes are confirmed by the store.</small><button className="button-primary checkout" onClick={beginCheckout}>Continue to checkout <ArrowRight size={16}/></button></div></> : <div className="cart-empty"><span className="cart-empty-icon"><ShoppingBag/></span><h3>A little room for good stuff.</h3><p>Your bag is waiting for something brilliant.</p><button className="button-primary" onClick={()=>setDrawer(false)}>Explore components <ArrowRight size={16}/></button></div>}</aside></>}
    {details && !details.compareView && <ProductDetails product={details} onClose={()=>setDetails(null)} onAdd={addToCart} saved={wishlist.some(item=>item.id===details.id)} onWishlist={()=>toggleWishlist(details)}/>}
    {showWishlist && <CollectionDialog title="Your saved gear" eyebrow="THE SHORTLIST" products={wishlist} empty="Nothing saved just yet." onClose={()=>setShowWishlist(false)} onAdd={addToCart} onRemove={toggleWishlist} onOpen={product=>{setShowWishlist(false);setDetails(product)}}/>}
    {compare.length>0 && <div className="compare-bar"><span><b>{compare.length}</b> of 3 products selected</span><button className="button-primary" onClick={()=>setDetails({compareView:true})}>Compare now <ArrowRight size={15}/></button><button className="compare-clear" onClick={()=>setCompare([])}>Clear</button></div>}
    {details?.compareView && <CompareDialog products={compare} onClose={()=>setDetails(null)} onAdd={addToCart}/>}
    {toast && <div className="toast"><span><Check size={15}/></span>{toast}</div>}
  </div>;
}

function AuthGate({ onAuthenticated, initialMessage = '' }) {
  const [mode, setMode] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const payload = { email: form.get('email'), password: form.get('password') };
    if (mode === 'signup') payload.name = form.get('name');
    try {
      const response = await apiRequest(`/api/auth/${mode === 'signin' ? 'login' : 'signup'}`, { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || 'Unable to sign in. Please try again.');
      else onAuthenticated(data.account);
    } catch { setMessage('Cannot reach the account service. Check the API and database setup, then try again.'); }
    finally { setSubmitting(false); }
  }

  return <main className="auth-screen">
    <section className="auth-showcase">
      <a className="brand auth-brand" href="#welcome"><span className="brand-mark"><Zap size={20} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a>
      <div className="auth-showcase-copy"><div className="eyebrow"><span className="eyebrow-line"/>YOUR NEXT BUILD STARTS HERE</div><h1>Good gear.<br/>Great <em>ideas.</em></h1><p>Find the parts that fit your plans, your setup, and the way you like to create.</p><div className="auth-feature"><span><Check size={16}/></span><div><b>Explore the full catalogue</b><small>Browse components across every category</small></div></div><div className="auth-feature"><span><Check size={16}/></span><div><b>Plan your next build</b><small>Compare parts and try the PC builder</small></div></div></div>
      <div className="auth-art"><div className="auth-orbit auth-orbit-one"/><div className="auth-orbit auth-orbit-two"/><div className="auth-chip"><Cpu size={54}/><span>BUILD<br/>BETTER</span></div><span className="auth-art-tag">✳&nbsp; GEAR FOR WHAT’S NEXT</span></div>
      <small className="auth-copyright">© 2026 TechParts India</small>
    </section>
    <section className="auth-panel" id="welcome">
      <div className="auth-card">
        <span className="eyebrow"><span className="eyebrow-line"/>{mode === 'signin' ? 'WELCOME BACK' : 'LET’S GET STARTED'}</span>
        <h2>{mode === 'signin' ? 'Sign in to TechParts' : 'Create your account'}</h2>
        <p className="auth-intro">{mode === 'signin' ? 'Pick up where your next build begins.' : 'Save your favorites and keep your build ideas close.'}</p>
        <div className="auth-tabs" role="tablist" aria-label="Account options"><button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setMessage(''); }}>Sign in</button><button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMessage(''); }}>Create account</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <label>Your name<span className="auth-input"><UserRound size={17}/><input name="name" autoComplete="name" required minLength="2" placeholder="Chinmay Santosh"/></span></label>}
          <label>Email address<span className="auth-input"><Mail size={17}/><input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></span></label>
          <label>Password<span className="auth-input"><LockKeyhole size={17}/><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength="8" placeholder="At least 8 characters"/><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          {mode === 'signup' && <label className="auth-check"><input type="checkbox" required/><span>I understand this project preview does not process payments.</span></label>}
          <button className="button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} {!submitting && <ArrowRight size={16}/>}</button>
        </form>
        {message && <p className="auth-preview-message" role="status">{message}</p>}
        <div className="auth-demo-note"><ShieldCheck size={15}/><span>Accounts use secure server sessions. Your bag, saved items, and order previews are kept separate per account.</span></div>
      </div>
    </section>
  </main>;
}

function AdminPage({ account, onShop }) {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('overview');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [editor, setEditor] = useState(undefined);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true); setError('');
    try {
      const [summaryResponse, productsResponse] = await Promise.all([
        apiRequest('/api/admin/summary'), apiRequest('/api/admin/products'),
      ]);
      const [summaryData, productsData] = await Promise.all([summaryResponse.json(), productsResponse.json()]);
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Could not load dashboard indicators.');
      if (!productsResponse.ok) throw new Error(productsData.error || 'Could not load products.');
      setSummary(summaryData); setItems(productsData.items || []);
    } catch (requestError) { setError(requestError.message || 'Could not reach the admin service.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = items.filter(product => {
    const matchesQuery = `${product.name} ${product.model} ${product.category}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (category === 'All categories' || product.category === category);
  });

  async function saveProduct(formValue) {
    setSaving(true); setError('');
    try {
      const editing = Boolean(editor?.id);
      const path = editing ? `/api/admin/products/${encodeURIComponent(editor.id)}` : '/api/admin/products';
      const response = await apiRequest(path, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(formValue) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save the product.');
      setEditor(undefined);
      await refresh();
    } catch (saveError) { setError(saveError.message || 'Could not save the product.'); }
    finally { setSaving(false); }
  }
  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.name}” from the catalogue?`)) return;
    setError('');
    try {
      const response = await apiRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete the product.');
      await refresh();
    } catch (deleteError) { setError(deleteError.message || 'Could not delete the product.'); }
  }

  return <section className="admin-page">
    <div className="admin-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>TECHPARTS ADMIN</div><h1>Admin <em>workspace.</em></h1><p>Signed in as {account.email}</p></div><button className="button-text admin-store-link" onClick={onShop}>View storefront <ArrowUpRight size={15}/></button></div>
    <div className="admin-tabs" role="tablist" aria-label="Admin sections"><button className={section === 'overview' ? 'selected' : ''} onClick={() => setSection('overview')}>Overview</button><button className={section === 'products' ? 'selected' : ''} onClick={() => setSection('products')}>Product management <span>{items.length}</span></button></div>
    {error && <div className="admin-error" role="alert"><AlertTriangle size={15}/>{error}<button onClick={() => setError('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    {loading && !summary ? <div className="admin-loading">Loading your dashboard…</div> : section === 'overview' ? <>
      <div className="admin-kpi-grid">
        <AdminKpi label="Catalogue products" value={summary?.products ?? '—'} detail="Items listed in the store"/>
        <AdminKpi label="In stock" value={summary?.inStock ?? '—'} detail="Products with available units"/>
        <AdminKpi label="Low stock" value={summary?.lowStock ?? '—'} detail="Five units or fewer" tone="warning"/>
        <AdminKpi label="Out of stock" value={summary?.outOfStock ?? '—'} detail="Needs an inventory update" tone="muted"/>
        <AdminKpi label="Inventory value" value={summary ? money(summary.inventoryValue) : '—'} detail="Current price × units in stock"/>
        <AdminKpi label="Customer accounts" value={summary?.customers ?? '—'} detail="Registered customer accounts"/>
      </div>
      <div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">INVENTORY CHECK</span><h2>Needs attention</h2></div><button className="text-action" onClick={() => setSection('products')}>Manage products <ArrowRight size={14}/></button></div>{items.filter(product => Number(product.stock) <= 5).slice(0, 6).length ? <div className="attention-list">{items.filter(product => Number(product.stock) <= 5).slice(0, 6).map(product => <div key={product.id}><span><b>{product.name}</b><small>{product.category}</small></span><strong className={Number(product.stock) === 0 ? 'stock-out' : 'stock-low'}>{Number(product.stock) === 0 ? 'Out of stock' : `${product.stock} left`}</strong></div>)}</div> : <p className="admin-empty-note">All products have more than five units in stock.</p>}</section><section className="admin-panel admin-preview-panel"><span className="admin-preview-icon"><ShieldCheck size={18}/></span><span className="eyebrow">STORE REPORTING</span><h2>Orders and revenue</h2><p>Sales KPIs will appear here when real order and payment processing is connected. The current checkout is a preview.</p></section></div>
    </> : <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">CATALOGUE</span><h2>Product management <span>({filtered.length})</span></h2></div><button className="button-primary admin-add-button" onClick={() => setEditor(null)}><Plus size={16}/> Add product</button></div><div className="admin-product-filters"><label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products…" aria-label="Search products"/></label><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by category"><option>All categories</option>{categories.map(item => <option key={item.name}>{item.name}</option>)}</select></div>{filtered.length ? <div className="admin-table-scroll"><table className="admin-product-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{filtered.map(product => <tr key={product.id}><td><span className="admin-product-name"><b>{product.name}</b><small>{product.model}</small></span></td><td>{product.category}</td><td><b>{money(product.price)}</b>{product.old > product.price && <small className="admin-discount-tag">{Math.round((1-product.price/product.old)*100)}% off</small>}</td><td><span className={`admin-stock-pill ${product.stock > 5 ? 'stock-good' : product.stock > 0 ? 'stock-low-bg' : 'stock-zero'}`}>{product.stock ?? 0} units</span></td><td><span className="admin-row-actions"><button onClick={() => setEditor(product)} aria-label={`Edit ${product.name}`} title="Edit product"><Pencil size={15}/></button><button className="danger-action" onClick={() => deleteProduct(product)} aria-label={`Delete ${product.name}`} title="Delete product"><Trash2 size={15}/></button></span></td></tr>)}</tbody></table></div> : <div className="admin-empty-note">No products match this search.</div>}</section>}
    {editor !== undefined && <ProductEditor product={editor} saving={saving} onClose={() => setEditor(undefined)} onSave={saveProduct}/>}
  </section>;
}

function AdminKpi({label,value,detail,tone=''}) {
  return <article className={`admin-kpi ${tone}`}><span>{label}</span><b>{value}</b><small>{detail}</small></article>;
}

function ProductEditor({product,saving,onClose,onSave}) {
  const isEditing = Boolean(product?.id);
  const regularPrice = isEditing && product.old > product.price ? product.old : product?.price ?? '';
  const discount = isEditing && product.old > product.price ? Math.round((1-product.price/product.old)*100) : 0;
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSave({ ...values, regularPrice: Number(values.regularPrice), discountPercent: Number(values.discountPercent || 0), stock: Number(values.stock) });
  }
  return <div className="admin-modal-layer" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-editor" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit product' : 'Add product'}><header className="admin-editor-head"><div><span className="eyebrow">{isEditing ? 'UPDATE CATALOGUE' : 'NEW CATALOGUE ITEM'}</span><h2>{isEditing ? 'Edit product' : 'Add product'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close editor"><X size={19}/></button></header><form className="admin-editor-form" onSubmit={submit}><label className="admin-field-wide">Product name<input name="name" required minLength="2" maxLength="120" defaultValue={product?.name || ''} placeholder="Product name"/></label><label className="admin-field-wide">Model / short specs<input name="model" maxLength="180" defaultValue={product?.model || ''} placeholder="Brand · key specifications"/></label><label>Category<select name="category" defaultValue={product?.category || categories[0].name}>{categories.map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Stock units<input name="stock" type="number" required min="0" step="1" defaultValue={product?.stock ?? 0}/></label><label>Regular price (₹)<input name="regularPrice" type="number" required min="1" step="1" defaultValue={regularPrice}/></label><label>Discount (%)<input name="discountPercent" type="number" min="0" max="90" step="1" defaultValue={discount}/></label><label className="admin-field-wide">Description<textarea name="description" maxLength="4000" rows="4" defaultValue={product?.description || ''} placeholder="Product details shown to customers"/></label><label>Image ID<input name="image" maxLength="120" defaultValue={product?.image || 'photo-1591488320449-011701bb6704'} placeholder="photo-…"/></label><label>Image tint<select name="color" defaultValue={product?.color || 'blue'}><option value="blue">Blue</option><option value="lavender">Lavender</option><option value="mint">Mint</option><option value="peach">Peach</option></select></label><div className="admin-editor-actions"><button type="button" className="button-text" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add product'} <ArrowRight size={15}/></button></div></form></section></div>;
}

function PasswordSetup({ account, onComplete, onSignOut }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get('currentPassword'));
    const newPassword = String(form.get('newPassword'));
    const confirmPassword = String(form.get('confirmPassword'));
    if (newPassword !== confirmPassword) { setMessage('The new passwords do not match.'); return; }
    setSubmitting(true); setMessage('');
    try {
      const response = await apiRequest('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || 'Could not update the password.');
      else onComplete(data.account);
    } catch { setMessage('Cannot reach the account service. Try again.'); }
    finally { setSubmitting(false); }
  }
  return <main className="password-screen"><div className="password-card"><span className="brand-mark"><LockKeyhole size={20}/></span><div className="eyebrow"><span className="eyebrow-line"/>SECURE YOUR ADMIN ACCOUNT</div><h1>Choose a new <em>password.</em></h1><p>Your starter password is only for setup. Change it to a unique password before continuing.</p><form className="auth-form" onSubmit={submit}><label>Current password<span className="auth-input"><LockKeyhole size={16}/><input name="currentPassword" type="password" autoComplete="current-password" required/></span></label><label>New password<span className="auth-input"><LockKeyhole size={16}/><input name="newPassword" type="password" autoComplete="new-password" minLength="12" maxLength="128" required placeholder="At least 12 characters"/></span></label><label>Confirm new password<span className="auth-input"><LockKeyhole size={16}/><input name="confirmPassword" type="password" autoComplete="new-password" minLength="12" maxLength="128" required placeholder="Enter it again"/></span></label><button className="button-primary auth-submit" disabled={submitting}>{submitting ? 'Updating…' : 'Update password'} <ArrowRight size={16}/></button></form>{message&&<p className="auth-preview-message" role="alert">{message}</p>}<p className="password-account">Signed in as {account.email}</p><button className="auth-guest" onClick={onSignOut}>Sign out</button></div></main>;
}

function ProductCard({product:p,onAdd,onDetails,onWishlist,onCompare,saved,compared}) {
  const outOfStock = p.stock !== undefined && Number(p.stock) <= 0;
  const discounted = Number(p.old) > Number(p.price);
  return <article className="product-card"><div className={`product-image ${p.color}`}><img src={photo(p.image)} alt={p.name} loading="lazy"/><span className="image-shade"/>{p.badge&&<span className="product-badge">{p.badge}</span>}<button className={saved?'wishlist liked':'wishlist'} onClick={()=>onWishlist(p)} aria-label={saved?'Remove from wishlist':'Add to wishlist'}><Heart size={16} fill={saved?'currentColor':'none'}/></button><button className="quick-add" onClick={()=>onAdd(p)} disabled={outOfStock}><span>{outOfStock?'Out of stock':'Quick add'}</span><span className="quick-add-icon"><ShoppingBag size={15}/></span></button></div><div className="product-info"><div className="product-model">{p.category} <span>·</span> {p.model.split('·')[0]}</div><button className="product-title" onClick={()=>onDetails(p)}>{p.name}</button><Rating product={p}/>{p.stock!==undefined&&<small className={outOfStock?'product-stock-note stock-out':'product-stock-note'}>{outOfStock?'Out of stock':`${p.stock} in stock`}</small>}<div className="price-row"><b>{money(p.price)}</b>{discounted&&<><del>{money(p.old)}</del><span className="discount">{Math.round((1-p.price/p.old)*100)}% off</span></>}</div><button className={compared?'compare-product selected':'compare-product'} onClick={()=>onCompare(p)}>{compared?<Check size={12}/>:<SlidersHorizontal size={12}/>} {compared?'Added to compare':'Compare'}</button></div></article>;
}

function Rating({product:p}) {
  return p.reviews>0 ? <div className="rating"><span>★</span> {p.rating} <small>({p.reviews})</small></div> : <div className="rating no-reviews"><span>NEW</span><small>No reviews yet</small></div>;
}

function ProductDetails({product:p,onClose,onAdd,saved,onWishlist}) {
  useEffect(()=>{function onKey(e){if(e.key==='Escape')onClose()}window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  const outOfStock = p.stock !== undefined && Number(p.stock) <= 0;
  const discounted = Number(p.old) > Number(p.price);
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="product-modal" role="dialog" aria-modal="true" aria-label={`${p.name} details`}><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button><div className={`detail-image ${p.color}`}><img src={photo(p.image)} alt={p.name}/>{p.badge&&<span className="product-badge">{p.badge}</span>}</div><div className="detail-copy"><span className="eyebrow"><span className="eyebrow-line"/>{p.category.toUpperCase()}</span><h2>{p.name}</h2><p className="detail-model">{p.model}</p><Rating product={p}/>{p.stock!==undefined&&<small className={outOfStock?'product-stock-note stock-out':'product-stock-note'}>{outOfStock?'Out of stock':`${p.stock} in stock`}</small>}<div className="detail-price"><b>{money(p.price)}</b>{discounted&&<><del>{money(p.old)}</del><span className="discount">{Math.round((1-p.price/p.old)*100)}% off</span></>}</div><p className="detail-description">{p.description || 'A community favorite, selected for dependable everyday performance. Confirm specifications and availability before purchase.'}</p><div className="detail-points"><span><Check size={14}/> Product details</span><span><Truck size={14}/> Delivery details at checkout</span><span><ShieldCheck size={14}/> Store preview</span></div><div className="detail-actions"><button className="button-primary" onClick={()=>onAdd(p)} disabled={outOfStock}>{outOfStock?'Out of stock':'Add to bag'} {!outOfStock&&<ShoppingBag size={15}/>}</button><button className={saved?'detail-save saved':'detail-save'} onClick={onWishlist}><Heart size={16} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save for later'}</button></div><small className="demo-note">Demo catalogue item · final specs and availability to be confirmed</small></div></section></div>;
}

function CollectionDialog({title,eyebrow,products:items,empty,onClose,onAdd,onRemove,onOpen}) {
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="collection-modal" role="dialog" aria-modal="true" aria-label={title}><div className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title} <span>({items.length})</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>{items.length?<div className="collection-list">{items.map(p=><div className="collection-row" key={p.id}><button className="collection-open" onClick={()=>onOpen(p)}><img src={photo(p.image)} alt=""/><span><b>{p.name}</b><small>{p.model}</small></span></button><b>{money(p.price)}</b><button className="icon-button" onClick={()=>onRemove(p)} aria-label={`Remove ${p.name}`}><X size={16}/></button><button className="button-primary mini-add" onClick={()=>onAdd(p)}>Add</button></div>)}</div>:<div className="cart-empty"><span className="cart-empty-icon"><Heart/></span><h3>{empty}</h3><p>Tap the heart on a product to keep it close.</p><button className="button-primary" onClick={onClose}>Keep browsing <ArrowRight size={16}/></button></div>}</section></div>;
}

function CompareDialog({products:items,onClose,onAdd}) {
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="compare-modal" role="dialog" aria-modal="true" aria-label="Compare components"><div className="drawer-head"><div><span className="eyebrow">SIDE BY SIDE</span><h2>Find your fit <span>({items.length})</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div><div className="compare-table" style={{'--compare-columns':items.length}}><div className="compare-label"></div>{items.map(p=><div className="compare-item" key={p.id}><img src={photo(p.image)} alt=""/><b>{p.name}</b><small>{p.model}</small><strong>{money(p.price)}</strong><button className="button-primary" onClick={()=>onAdd(p)}>Add to bag</button></div>)}<div className="compare-label">Category</div>{items.map(p=><div className="compare-value" key={p.id}>{p.category}</div>)}<div className="compare-label">Customer rating</div>{items.map(p=><div className="compare-value" key={p.id}>{p.reviews>0?<><span className="star">★</span> {p.rating} ({p.reviews})</>:'No reviews yet'}</div>)}<div className="compare-label">Price</div>{items.map(p=><div className="compare-value" key={p.id}>{money(p.price)}</div>)}<div className="compare-label">Availability</div>{items.map(p=><div className="compare-value available" key={p.id}><Check size={13}/> Demo listing</div>)}</div><p className="demo-note">Comparison uses the available demo catalogue fields. Confirm product specifications before purchase.</p></section></div>;
}

function CheckoutPage({items,total,onBack,onPlace}) {
  const [payment,setPayment]=useState('upi');
  return <section className="checkout-page">
    <button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to your bag</button>
    <div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>JUST ONE MORE THING</div><h1>Delivery <em>details.</em></h1><p>This is a preview checkout. Nothing is charged or sent to a store.</p></div>
    <div className="checkout-layout"><form className="checkout-form" onSubmit={async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget).entries());await onPlace({...values,payment})}}>
      <div className="checkout-section-head"><span>01</span><div><b>Who’s receiving it?</b><small>We need these details for this preview only.</small></div></div>
      <div className="form-grid"><label>Full name<input name="name" autoComplete="name" required minLength="2" placeholder="Your name"/></label><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label><label>Mobile number<input name="phone" type="tel" autoComplete="tel" required pattern="[0-9+() -]{8,16}" placeholder="+91 98765 43210"/></label><label>PIN code<input name="pincode" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{6}" maxLength="6" placeholder="6-digit PIN code"/></label><label className="form-wide">Street address<input name="address" autoComplete="street-address" required minLength="5" placeholder="House number and street"/></label><label>City<input name="city" autoComplete="address-level2" required placeholder="City"/></label><label>State<input name="state" autoComplete="address-level1" required placeholder="State"/></label></div>
      <div className="checkout-section-head payment-head"><span>02</span><div><b>Payment preference</b><small>Selection is for demonstration only.</small></div></div>
      <div className="payment-options"><label className={payment==='upi'?'payment-option active':'payment-option'}><input type="radio" name="payment" value="upi" checked={payment==='upi'} onChange={()=>setPayment('upi')}/><span className="radio-dot"/><span><b>UPI</b><small>Preview only · no payment request</small></span></label><label className={payment==='cod'?'payment-option active':'payment-option'}><input type="radio" name="payment" value="cod" checked={payment==='cod'} onChange={()=>setPayment('cod')}/><span className="radio-dot"/><span><b>Cash on delivery</b><small>Preview only · no shipment created</small></span></label></div>
      <button className="button-primary submit-order" type="submit">Save order preview <ArrowRight size={16}/></button>
    </form><aside className="checkout-summary"><span className="eyebrow">YOUR ORDER PREVIEW</span><h2>Looking good.</h2><div className="checkout-items">{items.map(item=><div className="checkout-item" key={item.id}><img src={photo(item.image)} alt=""/><span><b>{item.name}</b><small>Qty {item.qty}</small></span><strong>{money(item.price*item.qty)}</strong></div>)}</div><div className="checkout-total"><span>Items subtotal</span><b>{money(total)}</b></div><p className="preview-warning"><ShieldCheck size={15}/> Shipping, taxes, inventory, and payment are not processed in this project preview.</p></aside></div>
  </section>;
}

function OrderConfirmation({order,onShop,onOrders}) {
  return <section className="order-confirmation"><div className="confirmation-mark"><Check size={30}/></div><span className="eyebrow">SAVED IN THIS BROWSER</span><h1>Your order <em>preview is ready.</em></h1><p className="confirmation-text">This is a local project preview only. No store received this order and no payment or delivery was arranged.</p><div className="confirmation-card"><div><span>Preview reference</span><b>{order?.number}</b></div><div><span>Items subtotal</span><b>{money(order?.total||0)}</b></div><div><span>Delivery contact</span><b>{order?.delivery?.name}</b><small>{order?.delivery?.email} · {order?.delivery?.phone}</small></div><div><span>Delivery address</span><b>{order?.delivery?.address}</b><small>{order?.delivery?.city}, {order?.delivery?.state} {order?.delivery?.pincode}</small></div></div><div className="confirmation-actions"><button className="button-primary" onClick={onOrders}>View order history <ArrowRight size={16}/></button><button className="button-text" onClick={onShop}>Continue browsing</button></div></section>;
}

function OrdersPage({orders,onShop}) {
  return <section className="orders-page"><button className="back-link" onClick={onShop}><ChevronLeft size={16}/> Back to shop</button><div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>YOUR RECENT ACTIVITY</div><h1>Order <em>history.</em></h1><p>Preview orders saved in this browser. Live order tracking is not connected yet.</p></div>{orders.length?<div className="orders-list">{orders.map(order=><article className="order-card" key={order.number}><div className="order-card-head"><span><small>PREVIEW REFERENCE</small><b>{order.number}</b></span><span className="order-status"><span/> {order.status}</span></div><div className="order-card-items">{order.items.map(item=><div key={item.id}><img src={photo(item.image)} alt=""/><span><b>{item.name}</b><small>Qty {item.qty}</small></span></div>)}</div><div className="order-card-foot"><span>{new Date(order.createdAt).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'})}</span><b>{money(order.total)}</b></div></article>)}</div>:<div className="empty-state"><PackageCheck size={24}/><b>No orders yet</b><span>When you create an order preview, it will appear here.</span><button onClick={onShop}>Browse components</button></div>}<p className="storage-note">Order summaries stay in this browser only. Delivery details are not saved in order history.</p></section>;
}

function Builder({onBack,onAdd}) {
  const parts=[{category:'Processor',item:products[1]},{category:'Graphics Card',item:products[0]},{category:'Memory',item:products[2]},{category:'Storage',item:products[3]}];
  return <section className="builder-page"><button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to shop</button><div className="builder-page-head"><div className="eyebrow"><span className="eyebrow-line"/>YOUR BUILD, YOUR RULES</div><h1>Let’s build something <em>brilliant.</em></h1><p>Start with the essentials. Every component below is checked to work together.</p></div><div className="build-progress"><span className="progress-dot done"><Check size={12}/></span><span className="progress-line active"/><span className="progress-dot done">2</span><span className="progress-line"/><span className="progress-dot">3</span><span className="progress-line"/><span className="progress-dot">4</span><span className="progress-line"/><span className="progress-dot">5</span><div><b>4 of 5 parts selected</b><small>Looking good so far</small></div></div><div className="build-layout"><div className="build-list">{parts.map(({category,item},i)=><div className="build-row" key={category}><span className="build-number">0{i+1}</span><div className="build-part-icon"><Cpu size={18}/></div><div className="build-part"><b>{category}</b><small>{item.name} · {item.model}</small></div><span className="compatible"><Check size={13}/> Compatible</span><b className="build-price">{money(item.price)}</b><button className="icon-button" aria-label={`Remove ${category}`}><X size={16}/></button></div>)}<button className="add-part"><span>+</span> Add a case, power supply, or cooling</button></div><aside className="build-summary"><span className="eyebrow">YOUR BUILD</span><h3>It’s coming together.</h3><div className="summary-line"><span>4 components</span><b>{money(products[1].price+products[0].price+products[2].price+products[3].price)}</b></div><div className="summary-compat"><span><Check size={15}/></span><div><b>All parts play nicely</b><small>Our compatibility check found no issues.</small></div></div><button className="button-primary" onClick={()=>{parts.forEach(x=>onAdd(x.item));onBack()}}>Add build to bag <ArrowRight size={16}/></button><small className="summary-note"><ShieldCheck size={13}/> Free compatibility check included</small></aside></div></section>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
