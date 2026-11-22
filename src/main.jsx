import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Cpu, Eye, EyeOff, Gamepad2, Headphones, Heart, LayoutGrid, List, LockKeyhole, Mail, Menu, Moon, Monitor, PackageCheck, Pencil, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Trash2, Truck, UserRound, X, Zap } from 'lucide-react';
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
  const [brandFilter,setBrandFilter]=useState('All brands');
  const [minPrice,setMinPrice]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [availableOnly,setAvailableOnly]=useState(false);
  const [specFilters,setSpecFilters]=useState({});
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(12);
  const [viewMode,setViewMode]=useState('grid');
  const [cart, setCart] = useState([]);
  const [couponCodeInput,setCouponCodeInput]=useState('');
  const [appliedCoupon,setAppliedCoupon]=useState(null);
  const [couponFeedback,setCouponFeedback]=useState('');
  const [couponApplying,setCouponApplying]=useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [compare, setCompare] = useState([]);
  const [details, setDetails] = useState(null);
  const [showWishlist, setShowWishlist] = useState(false);
  const [catalog, setCatalog] = useState(products);
  const [storeCategories,setStoreCategories]=useState(categories);
  const [storeBrands,setStoreBrands]=useState([]);
  const [catalogVersion,setCatalogVersion]=useState(0);
  const [drawer, setDrawer] = useState(false);
  const [builder, setBuilder] = useState(() => new URLSearchParams(window.location.search).has('build'));
  const [checkout, setCheckout] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [ordersPage, setOrdersPage] = useState(false);
  const [adminPage, setAdminPage] = useState(false);
  const [profilePage, setProfilePage] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(()=>{if(appliedCoupon){setAppliedCoupon(null);setCouponFeedback('Your bag changed. Reapply the code to refresh the discount.');}},[cart]);

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
      setCheckout(false); setOrdersPage(false); setAdminPage(false); setProfilePage(false);
    };
    window.addEventListener('techparts:session-expired', expireSession);
    return () => window.removeEventListener('techparts:session-expired', expireSession);
  }, []);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.account) return;
    const prefix = `techparts:${auth.account.id}:`;
    setCart(loadSavedProducts(`${prefix}cart`));
    setWishlist(loadSavedProducts(`${prefix}wishlist`));
    setStorageReady(true);
  }, [auth.status, auth.account?.id]);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.account) return;
    if (auth.account.role !== 'customer') { setOrders([]); return; }
    const controller = new AbortController();
    apiRequest('/api/orders', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setOrders(data.items || []); })
      .catch(error => { if (error.name !== 'AbortError') console.info('Could not load saved orders.'); });
    return () => controller.abort();
  }, [auth.status, auth.account?.id, auth.account?.role]);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    const controller = new AbortController();
    apiRequest('/api/products?limit=100', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.items?.length) setCatalog(data.items); })
      .catch(error => { if (error.name !== 'AbortError') console.info('Using the local demo catalogue.'); });
    return () => controller.abort();
  }, [auth.status,catalogVersion]);

  useEffect(()=>{
    if(auth.status!=='authenticated')return;
    const controller=new AbortController();
    Promise.all([apiRequest('/api/categories',{signal:controller.signal}),apiRequest('/api/brands',{signal:controller.signal})])
      .then(async([categoryResponse,brandResponse])=>{
        const categoryData=categoryResponse.ok?await categoryResponse.json():null;
        const brandData=brandResponse.ok?await brandResponse.json():null;
        if(categoryData?.items)setStoreCategories(categoryData.items.map(item=>({...item,short:categories.find(category=>category.name===item.name)?.short||item.name,icon:categories.find(category=>category.name===item.name)?.icon||PackageCheck})));
        if(brandData?.items)setStoreBrands(brandData.items);
      }).catch(error=>{if(error.name!=='AbortError')console.info('Using the built-in category list.');});
    return()=>controller.abort();
  },[auth.status,catalogVersion]);

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

  function handleAuthenticated(account) {
    setStorageReady(false);
    setAuth({ status: 'authenticated', account, message: '' });
    setAdminPage(account.role === 'admin');
  }
  async function signOut() {
    try { await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* Clear this browser view even if the server is unavailable. */ }
    setAuth({ status: 'unauthenticated', account: null, message: '' });
    setStorageReady(false); setCart([]); setWishlist([]); setOrders([]);
    setCheckout(false); setOrdersPage(false); setAdminPage(false); setProfilePage(false);
  }
  async function beginCheckout() {
    if (!cart.length) return;
    setCheckoutError('');
    try {
      const response = await apiRequest('/api/auth/me');
      if (response.status === 401) { window.dispatchEvent(new Event('techparts:session-expired')); return; }
      if (response.ok) { setDrawer(false); setCheckout('form'); }
      else setToast('Checkout is unavailable right now. Please try again.');
    } catch { setToast('Cannot verify your session. Please try again.'); }
    window.setTimeout(() => setToast(''), 2500);
  }
  async function applyCoupon(event){
    event?.preventDefault();if(!cart.length)return;setCouponApplying(true);setCouponFeedback('');
    try{const response=await apiRequest('/api/coupons/validate',{method:'POST',body:JSON.stringify({code:couponCodeInput,items:cart.map(item=>({id:item.id,quantity:item.qty}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not apply this coupon.');setAppliedCoupon({code:data.code,discount:Number(data.discount)||0});setCouponCodeInput(data.code);setCouponFeedback(`${data.code} applied · you save ${money(data.discount)}.`);}
    catch(error){setAppliedCoupon(null);setCouponFeedback(error.message||'Could not apply this coupon.');}
    finally{setCouponApplying(false);}
  }
  function returnToStore() { setAdminPage(false);setCatalogVersion(version=>version+1); }

  const visibleProducts = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = catalog.filter(p => (active === 'All components' || p.category === active) && (!q || `${p.name} ${p.model} ${p.brand || ''} ${p.sku || ''} ${p.category} ${Object.values(p.specifications || {}).join(' ')}`.toLowerCase().includes(q)) && (brandFilter==='All brands'||p.brand===brandFilter) && (minPrice===''||Number(p.price)>=Number(minPrice)) && (maxPrice===''||Number(p.price)<=Number(maxPrice)) && (!availableOnly||Number(p.stock)>0) && Object.entries(specFilters).every(([key,value])=>!value||String(p.specifications?.[key]||'')===value));
    const sortFunctions={
      'Price: low to high':(a,b)=>a.price-b.price,
      'Price: high to low':(a,b)=>b.price-a.price,
      'Newest':(a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0),
      'Popularity':(a,b)=>(b.reviews||0)-(a.reviews||0),
      'Rating':(a,b)=>Number(b.rating||0)-Number(a.rating||0),
      'Discount':(a,b)=>((Number(b.old)||Number(b.price))-Number(b.price))-((Number(a.old)||Number(a.price))-Number(a.price)),
    };
    return sortFunctions[sort]?[...list].sort(sortFunctions[sort]):list;
  }, [active, availableOnly, brandFilter, catalog, maxPrice, minPrice, query, sort, specFilters]);
  const specificationFacets=useMemo(()=>{
    if(active==='All components')return [];
    const facetMap=new Map();
    for(const product of catalog.filter(item=>item.category===active))for(const [key,raw] of Object.entries(product.specifications||{})){const value=String(raw||'').trim();if(value){if(!facetMap.has(key))facetMap.set(key,new Set());facetMap.get(key).add(value);}}
    return [...facetMap].filter(([,values])=>values.size>1).slice(0,4).map(([key,values])=>({key,values:[...values].sort((a,b)=>a.localeCompare(b))}));
  },[active,catalog]);
  const pageCount=Math.max(1,Math.ceil(visibleProducts.length/pageSize));
  const pageProducts=visibleProducts.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>{setPage(1);},[active,brandFilter,minPrice,maxPrice,availableOnly,sort,query,specFilters,pageSize]);
  useEffect(()=>{setSpecFilters({});},[active]);
  const searchSuggestions=useMemo(()=>[...new Set(catalog.flatMap(product=>[product.name,product.model,product.brand,product.sku,product.category,...Object.values(product.specifications||{})].filter(Boolean).map(String)))].filter(value=>!query||value.toLowerCase().includes(query.toLowerCase().trim())).slice(0,18),[catalog,query]);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const couponDiscount=Math.min(cartTotal,Number(appliedCoupon?.discount)||0);

  if (auth.status === 'loading') return <div className={dark ? 'app dark' : 'app'}><div className="auth-loading"><span className="auth-loading-mark"><Zap size={20} fill="currentColor"/></span><b>Checking your session…</b></div></div>;
  if (auth.status !== 'authenticated') return <div className={dark ? 'app dark' : 'app'}><AuthGate initialMessage={auth.message} onAuthenticated={handleAuthenticated}/></div>;
  if (auth.account.mustChangePassword) return <div className={dark ? 'app dark' : 'app'}><PasswordSetup account={auth.account} onComplete={handleAuthenticated} onSignOut={signOut}/></div>;

  function addToCart(product) {
    const currentQuantity = cart.find(item => item.id === product.id)?.qty || 0;
    if (currentQuantity >= 20) {
      setToast('You can add up to 20 units of one product');
      window.setTimeout(() => setToast(''), 2200);
      return;
    }
    if (product.stock !== undefined && currentQuantity >= Number(product.stock)) {
      setToast('There are no more units available for this product');
      window.setTimeout(() => setToast(''), 2200);
      return;
    }
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
    const existing=compare.some(item=>item.id===product.id);
    if(!existing&&compare.length&&compare[0].category!==product.category){setToast('Choose products from the same category to compare their specifications.');window.setTimeout(()=>setToast(''),2600);return;}
    setCompare(current => current.some(item => item.id === product.id)
      ? current.filter(item => item.id !== product.id)
      : current.length < 4 ? [...current, product] : current);
    if (!existing && compare.length >= 4) {
      setToast('Compare up to 4 products at a time');
      window.setTimeout(() => setToast(''), 2200);
    }
  }
  async function placeOrder(delivery) {
    try {
      setCheckoutError('');
      const response = await apiRequest('/api/orders', { method: 'POST', body: JSON.stringify({ items: cart.map(item => ({ id: item.id, quantity: item.qty, expectedPrice: item.price })), delivery, paymentMethod: delivery.payment, couponCode:appliedCoupon?.code||'' }) });
      const data = await response.json();
      if (!response.ok) { setCheckoutError(data.error || 'Could not place this order.'); return false; }
      const order = data.order;
      setOrders(current => [order, ...current]);
      setPlacedOrder(order);
      setCart([]);
      setAppliedCoupon(null);
      setCheckout('confirmed');
      setCatalog(current => current.map(product => {
        const line = order.items.find(item => item.productId === product.id);
        return line ? { ...product, stock: Math.max(0, Number(product.stock || 0) - line.quantity) } : product;
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    } catch {
      setCheckoutError('Cannot reach the order service. Check the API and database setup, then try again.');
      return false;
    }
  }

  return <div className={dark ? 'app dark' : 'app'}>
    <div className="announcement"><span><Sparkles size={13}/> THE COMPONENTS YOU WANT, AT PRICES YOU’LL LOVE</span><a href="#products">See what’s new <ArrowRight size={13}/></a></div>
    <header className="header">
      <a className="brand" href="#home" aria-label="TechParts home"><span className="brand-mark"><Zap size={20} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a>
      <nav className={mobileMenu ? 'nav open' : 'nav'}><a className="nav-active" href="#products" onClick={()=>{setAdminPage(false);setOrdersPage(false);setProfilePage(false);setCheckout(false);setBuilder(false);setMobileMenu(false)}}>Shop</a><a href="#categories" onClick={()=>{setAdminPage(false);setProfilePage(false);setMobileMenu(false)}}>Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true);setAdminPage(false);setProfilePage(false);setOrdersPage(false);setMobileMenu(false)}}>PC Builder <span className="new-pill">NEW</span></a><a href="#orders" onClick={e=>{e.preventDefault();setOrdersPage(true);setProfilePage(false);setAdminPage(false);setBuilder(false);setCheckout(false);setMobileMenu(false)}}>Orders</a><a href="#profile" onClick={e=>{e.preventDefault();setProfilePage(true);setAdminPage(false);setBuilder(false);setOrdersPage(false);setCheckout(false);setMobileMenu(false)}}>My account</a>{auth.account.role === 'admin' && <a href="#admin" onClick={e=>{e.preventDefault();setAdminPage(true);setProfilePage(false);setBuilder(false);setOrdersPage(false);setCheckout(false);setMobileMenu(false)}}>Admin</a>}<button className="nav-signout" onClick={signOut}>Sign out</button></nav>
      <div className="header-actions"><label className="search-box"><Search size={17}/><input list="catalog-search-suggestions" aria-label="Search products" placeholder="Search components..." value={query} onChange={e=>setQuery(e.target.value)}/><datalist id="catalog-search-suggestions">{searchSuggestions.map((suggestion,index)=><option key={`${suggestion}-${index}`} value={suggestion}/>)}</datalist><kbd>⌘ K</kbd></label><span className="account-chip" title={auth.account.email}><UserRound size={15}/><span>{auth.account.name}</span>{auth.account.role === 'admin' && <b>ADMIN</b>}</span><button className="signout-button" onClick={signOut}>Sign out</button><button className="icon-button theme-button" aria-label="Toggle theme" onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="wishlist-header" onClick={()=>setShowWishlist(true)} aria-label={`Wishlist, ${wishlist.length} products`}><Heart size={18}/><span>Saved</span>{wishlist.length>0&&<b>{wishlist.length}</b>}</button><button className="bag-button" onClick={()=>setDrawer(true)} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19}/><span>Bag</span><b>{cartCount}</b></button><button className="icon-button menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button></div>
    </header>
    <main>
      {adminPage && auth.account.role === 'admin' ? <AdminPage account={auth.account} categoryOptions={storeCategories} brandOptions={storeBrands} onShop={returnToStore}/> : profilePage ? <ProfilePage account={auth.account} onAccountUpdate={account=>setAuth(current=>({...current,account}))} onShop={()=>setProfilePage(false)}/> : builder ? <Builder catalogue={catalog} onBack={()=>setBuilder(false)} onAdd={addToCart} account={auth.account}/> : checkout==='form' ? <CheckoutPage account={auth.account} items={cart} subtotal={cartTotal} discount={couponDiscount} couponCode={appliedCoupon?.code||''} total={cartTotal-couponDiscount} error={checkoutError} onBack={()=>setCheckout(false)} onPlace={placeOrder}/> : checkout==='confirmed' ? <OrderConfirmation order={placedOrder} onShop={()=>{setCheckout(false);setOrdersPage(false)}} onOrders={()=>{setCheckout(false);setOrdersPage(true)}}/> : ordersPage ? <OrdersPage orders={orders} onShop={()=>setOrdersPage(false)}/> : <>
        <section className="hero" id="home">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/>THE NEXT LEVEL STARTS HERE</div><h1>Your setup.<br/>Your <em>story.</em></h1><p>Thoughtful gear for the way you play, create, and work. Find your next favorite piece.</p><div className="hero-buttons"><a className="button-primary" href="#products">Explore components <ArrowRight size={16}/></a><button className="button-text" onClick={()=>setBuilder(true)}>Build your PC <ArrowUpRight size={15}/></button></div><div className="hero-proof"><div className="avatars"><span>R</span><span>A</span><span>K</span><span>+</span></div><div><strong>Loved by 12,000+ builders</strong><small>★★★★★ <span>4.9 / 5 average rating</span></small></div></div></div>
          <div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"/><div className="hero-product"><img src={photo('photo-1587202372775-e229f172b9d7')} alt="High-performance graphics card"/><span className="floating-tag tag-top"><span className="tag-dot"/>NEW DROP <strong>RTX 50 SERIES</strong></span><span className="floating-tag tag-bottom"><span className="tag-icon"><Zap size={17}/></span><span>Built for more<small>Make every frame count</small></span><ArrowUpRight size={17}/></span></div><div className="hero-scribble">MAKE<br/>IT YOURS<span>↗</span></div><span className="hero-index">01 / 04</span></div>
        </section>
        <section className="trust-strip" aria-label="Shopping benefits"><div><Truck/><span><b>Free delivery</b><small>on orders over ₹2,000</small></span></div><div><ShieldCheck/><span><b>Genuine gear</b><small>100% authorized products</small></span></div><div><PackageCheck/><span><b>Easy returns</b><small>7-day return window</small></span></div><div><Heart/><span><b>Here to help</b><small>Real humans, always</small></span></div></section>
        <section className="categories-section section" id="categories"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>FIND YOUR THING</div><h2>Browse by <em>category.</em></h2></div><a className="subtle-link" href="#products">All categories <ArrowRight size={15}/></a></div><div className="category-grid">{storeCategories.map(({name,short,icon:Icon},index)=>{const count=catalog.filter(product=>product.category===name).length;const art={'Graphics Cards':'RTX',Processors:'CPU',Motherboards:'AM5',Memory:'DDR5',Storage:'NVMe',Power:'WATT',Cases:'ATX',Cooling:'°C',Monitors:'QHD',Peripherals:'PRO',Accessories:'GEAR'}[name];return <button key={name} className={`category-card cat-${index}`} onClick={()=>{setActive(name);document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}><span className="category-icon"><Icon size={22}/></span><span className="category-copy"><b>{short}</b><small>{count} {count===1?'product':'products'}</small></span><ArrowUpRight className="category-arrow" size={17}/><span className="category-art">{art}</span></button>})}</div></section>
        <section className="products-section section" id="products"><div className="section-heading product-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>GOOD GEAR, GREAT DAYS</div><h2>Made for your <em>next.</em></h2><p>A few community favorites to get you started.</p><small className="catalog-disclaimer">Demo catalogue · listed prices, availability, and ratings need verification before sale.</small></div><a className="subtle-link desktop-link" href="#products">Explore the shop <ArrowRight size={15}/></a></div>
          <div className="product-toolbar"><div className="filter-tabs"><button className={active==='All components'?'selected':''} onClick={()=>setActive('All components')}>Everything <span>{catalog.length}</span></button>{storeCategories.map(({name,short})=><button key={name} className={active===name?'selected':''} onClick={()=>setActive(name)}>{short||name}</button>)}</div><label className="sort-control"><SlidersHorizontal size={15}/><span>Sort:</span><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products"><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option><option>Newest</option><option>Popularity</option><option>Rating</option><option>Discount</option></select><ChevronDown size={14}/></label></div>
          <div className="catalog-filters"><label>Brand<select value={brandFilter} onChange={event=>setBrandFilter(event.target.value)}><option>All brands</option>{storeBrands.map(brand=><option key={brand.id||brand.name} value={brand.name}>{brand.name}</option>)}</select></label><label>Min price<input inputMode="numeric" type="number" min="0" value={minPrice} onChange={event=>setMinPrice(event.target.value)} placeholder="₹ 0"/></label><label>Max price<input inputMode="numeric" type="number" min="0" value={maxPrice} onChange={event=>setMaxPrice(event.target.value)} placeholder="No limit"/></label><label className="availability-filter"><input type="checkbox" checked={availableOnly} onChange={event=>setAvailableOnly(event.target.checked)}/> In stock only</label>{specificationFacets.map(facet=><label key={facet.key}>{facet.key}<select value={specFilters[facet.key]||''} onChange={event=>setSpecFilters(current=>({...current,[facet.key]:event.target.value}))}><option value="">Any</option>{facet.values.map(value=><option key={value}>{value}</option>)}</select></label>)}<button className="button-text" onClick={()=>{setBrandFilter('All brands');setMinPrice('');setMaxPrice('');setAvailableOnly(false);setSpecFilters({});setActive('All components')}}>Clear filters</button><span className="filter-result-count">{visibleProducts.length} products</span></div>
          <div className="catalog-view-tools"><div className="catalog-view-switch" aria-label="Product layout"><button className={viewMode==='grid'?'selected':''} onClick={()=>setViewMode('grid')} aria-label="Grid view" title="Grid view"><LayoutGrid size={15}/></button><button className={viewMode==='list'?'selected':''} onClick={()=>setViewMode('list')} aria-label="List view" title="List view"><List size={15}/></button></div><label>Show<select value={pageSize} onChange={event=>setPageSize(Number(event.target.value))}><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option></select> per page</label><span>Showing {visibleProducts.length?((page-1)*pageSize)+1:0}–{Math.min(page*pageSize,visibleProducts.length)} of {visibleProducts.length}</span></div>
          {visibleProducts.length ? <div className={`product-grid${viewMode==='list'?' list-view':''}`}>{pageProducts.map(p=><ProductCard key={p.id} product={p} onAdd={addToCart} onDetails={setDetails} onWishlist={toggleWishlist} onCompare={toggleCompare} saved={wishlist.some(item=>item.id===p.id)} compared={compare.some(item=>item.id===p.id)}/>)}</div> : <div className="empty-state"><Search/><b>No components found</b><span>Try another search or browse everything.</span><button onClick={()=>{setQuery('');setActive('All components');setBrandFilter('All brands');setMinPrice('');setMaxPrice('');setAvailableOnly(false);setSpecFilters({})}}>Clear filters</button></div>}
          {visibleProducts.length>pageSize&&<nav className="catalog-pagination" aria-label="Product pages"><button disabled={page<=1} onClick={()=>setPage(current=>Math.max(1,current-1))}><ChevronLeft size={14}/> Previous</button><span>Page {page} of {pageCount}</span><button disabled={page>=pageCount} onClick={()=>setPage(current=>Math.min(pageCount,current+1))}>Next <ChevronRight size={14}/></button></nav>}
          <a className="mobile-all subtle-link" href="#products">Explore the shop <ArrowRight size={15}/></a>
        </section>
        <section className="builder-banner section" id="builder"><div className="builder-graphic"><div className="builder-ring"/><div className="builder-chip"><Cpu size={48}/><span>AM5</span></div><div className="builder-node node-one">GPU <b>✓</b></div><div className="builder-node node-two">RAM <b>✓</b></div><div className="builder-node node-three">CPU <b>✓</b></div><div className="builder-mini">BUILD<br/>01</div></div><div className="builder-copy"><div className="eyebrow"><span className="eyebrow-line"/>A LITTLE HELP, A LOT OF POWER</div><h2>Big ideas.<br/><em>Zero guesswork.</em></h2><p>Build your dream setup with our step-by-step PC Builder. We’ll check every part for compatibility along the way.</p><div className="builder-features"><span><Check size={15}/> Smart compatibility checks</span><span><Check size={15}/> Live build total</span></div><button className="button-primary" onClick={()=>setBuilder(true)}>Start your build <ArrowRight size={16}/></button><div className="builder-note"><Sparkles size={13}/> Even beginners build like pros.</div></div></section>
        <section className="newsletter"><div className="newsletter-mark"><Zap size={24}/></div><div><div className="eyebrow">THE GOOD STUFF, OCCASIONALLY</div><h2>First dibs. <em>No noise.</em></h2><p>New arrivals, builder tips, and the occasional very good deal.</p></div><form className="newsletter-form" onSubmit={e=>{e.preventDefault();setToast('You’re on the list. Welcome aboard!');setTimeout(()=>setToast(''),2500);e.target.reset()}}><input type="email" required placeholder="Your email address" aria-label="Your email address"/><button type="submit" aria-label="Subscribe"><ArrowRight size={18}/></button><small>No spam. Unsubscribe any time.</small></form><div className="newsletter-star">✳</div></section>
      </>}
    </main>
    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Zap size={19} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a><p>Good gear makes good things happen.</p><div className="footer-links"><a href="#products">Shop</a><a href="#categories">Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true)}}>PC Builder</a><a href="mailto:hello@techparts.in">Contact</a></div><span className="copyright">© 2025 TechParts India</span></footer>
    {drawer && <><button className="drawer-scrim" aria-label="Close bag" onClick={()=>setDrawer(false)}/><aside className="cart-drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR GOOD FINDS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={()=>setDrawer(false)} aria-label="Close"><X/></button></div>{cart.length ? <><div className="cart-items">{cart.map(item=><div className="cart-row" key={item.id}><img src={photo(item.image)} alt=""/><div className="cart-info"><b>{item.name}</b><small>{item.model}</small><div className="quantity"><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:Math.max(1,i.qty-1)}:i))}>−</button><span>{item.qty}</span><button disabled={item.qty >= 20 || (item.stock !== undefined && item.qty >= item.stock)} onClick={()=>addToCart(item)}>+</button><button className="remove" onClick={()=>setCart(c=>c.filter(i=>i.id!==item.id))}>Remove</button></div></div><strong>{money(item.price*item.qty)}</strong></div>)}</div><div className="drawer-bottom"><div className="free-shipping"><Truck size={16}/>{cartTotal-couponDiscount>=2000?'Your delivery is on us!':'Add '+money(Math.max(0,2000-cartTotal+couponDiscount))+' for free delivery'}</div><form className="coupon-entry" onSubmit={applyCoupon}><label>Coupon code<input value={couponCodeInput} onChange={event=>setCouponCodeInput(event.target.value.toUpperCase())} maxLength="32" placeholder="Enter code" aria-label="Coupon code"/></label><button className="button-primary" disabled={couponApplying||!couponCodeInput.trim()}>{couponApplying?'Checking…':'Apply'}</button></form>{couponFeedback&&<p className={appliedCoupon?'coupon-feedback success':'coupon-feedback'} role="status">{couponFeedback}</p>}<div className="subtotal"><span>Items subtotal</span><b>{money(cartTotal)}</b></div>{appliedCoupon&&<div className="coupon-savings"><span>{appliedCoupon.code} discount</span><b>−{money(couponDiscount)}</b></div>}<div className="subtotal discounted-subtotal"><span>Discounted total</span><b>{money(cartTotal-couponDiscount)}</b></div><small>Shipping and applicable taxes are confirmed by the store.</small><button className="button-primary checkout" onClick={beginCheckout}>Continue to checkout <ArrowRight size={16}/></button></div></> : <div className="cart-empty"><span className="cart-empty-icon"><ShoppingBag/></span><h3>A little room for good stuff.</h3><p>Your bag is waiting for something brilliant.</p><button className="button-primary" onClick={()=>setDrawer(false)}>Explore components <ArrowRight size={16}/></button></div>}</aside></>}
    {details && !details.compareView && <ProductDetails product={details} account={auth.account} onClose={()=>setDetails(null)} onAdd={addToCart} onCompare={toggleCompare} compared={compare.some(item=>item.id===details.id)} saved={wishlist.some(item=>item.id===details.id)} onWishlist={()=>toggleWishlist(details)}/>}
    {showWishlist && <CollectionDialog title="Your saved gear" eyebrow="THE SHORTLIST" products={wishlist} empty="Nothing saved just yet." onClose={()=>setShowWishlist(false)} onAdd={addToCart} onRemove={toggleWishlist} onOpen={product=>{setShowWishlist(false);setDetails(product)}}/>}
    {compare.length>0 && <div className="compare-bar"><span><b>{compare.length}</b> of 4 products selected · {compare[0]?.category}</span><button className="button-primary" onClick={()=>setDetails({compareView:true})}>Compare now <ArrowRight size={15}/></button><button className="compare-clear" onClick={()=>setCompare([])}>Clear</button></div>}
    {details?.compareView && <CompareDialog products={compare} catalogue={catalog} onCompare={toggleCompare} onClose={()=>setDetails(null)} onAdd={addToCart}/>}
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
    if (mode === 'signup') { payload.name = form.get('name'); payload.mobile = form.get('mobile'); }
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
          {mode === 'signup' && <label>Mobile number<span className="auth-input"><UserRound size={17}/><input name="mobile" type="tel" autoComplete="tel" required pattern="[0-9+() -]{8,30}" placeholder="+91 98765 43210"/></span></label>}
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

function ProfilePage({account,onAccountUpdate,onShop}) {
  const [name,setName]=useState(account.name || '');
  const [mobile,setMobile]=useState(account.mobile || '');
  const [addresses,setAddresses]=useState(account.addresses || []);
  const [editing,setEditing]=useState(undefined);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    const controller=new AbortController();
    apiRequest('/api/account',{signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>{
      if(!data?.account)return;
      setName(data.account.name);setMobile(data.account.mobile || '');setAddresses(data.account.addresses || []);onAccountUpdate(data.account);
    }).catch(requestError=>{if(requestError.name!=='AbortError')setError('Could not load your account details.');});
    return()=>controller.abort();
  },[]);

  function applyAccount(account) {
    setName(account.name);setMobile(account.mobile || '');setAddresses(account.addresses || []);onAccountUpdate(account);
  }
  async function saveProfile(event) {
    event.preventDefault();setSaving(true);setError('');
    try {
      const response=await apiRequest('/api/account/profile',{method:'PUT',body:JSON.stringify({name,mobile})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not save your profile.');
      applyAccount(data.account);
    } catch(saveError) { setError(saveError.message || 'Could not save your profile.'); }
    finally { setSaving(false); }
  }
  async function saveAddress(event) {
    event.preventDefault();setSaving(true);setError('');
    const form=event.currentTarget;
    const values=Object.fromEntries(new FormData(form).entries());
    values.isDefault=new FormData(form).has('isDefault');
    try {
      const path=editing?.id?`/api/account/addresses/${encodeURIComponent(editing.id)}`:'/api/account/addresses';
      const response=await apiRequest(path,{method:editing?.id?'PUT':'POST',body:JSON.stringify(values)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not save this address.');
      applyAccount(data.account);setEditing(undefined);
    } catch(saveError) { setError(saveError.message || 'Could not save this address.'); }
    finally { setSaving(false); }
  }
  async function deleteAddress(address) {
    if(!window.confirm(`Remove the ${address.label} address?`))return;
    setError('');
    try {
      const response=await apiRequest(`/api/account/addresses/${encodeURIComponent(address.id)}`,{method:'DELETE'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not remove this address.');
      applyAccount(data.account);
    } catch(deleteError) { setError(deleteError.message || 'Could not remove this address.'); }
  }

  return <section className="profile-page">
    <button className="back-link" onClick={onShop}><ChevronLeft size={16}/> Back to shop</button>
    <div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>YOUR ACCOUNT</div><h1>Personal <em>details.</em></h1><p>Manage your contact information and saved delivery addresses.</p></div>
    {error&&<div className="admin-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
    <div className="profile-layout"><section className="profile-card"><div className="profile-card-title"><span className="brand-mark"><UserRound size={18}/></span><div><h2>Profile</h2><small>{account.role === 'admin' ? 'Administrator' : 'Customer'} account</small></div></div><form className="profile-form" onSubmit={saveProfile}><label>Full name<input value={name} onChange={event=>setName(event.target.value)} required minLength="2" maxLength="80"/></label><label>Email address<input value={account.email} disabled readOnly/></label><label>Mobile number<input type="tel" value={mobile} onChange={event=>setMobile(event.target.value)} required pattern="[0-9+() -]{8,30}" maxLength="30"/></label><button className="button-primary" disabled={saving}>{saving?'Saving…':'Save profile'} <Check size={15}/></button></form></section>
      <section className="profile-card"><div className="profile-card-title"><span className="brand-mark"><Truck size={18}/></span><div><h2>Delivery addresses</h2><small>{addresses.length} of 10 saved</small></div><button className="button-primary admin-add-button" onClick={()=>setEditing({})}><Plus size={15}/> Add address</button></div>
        {addresses.length?<div className="saved-address-list">{addresses.map(address=><article className="saved-address" key={address.id}><div><span><b>{address.label}</b>{address.isDefault&&<small className="default-address-tag">DEFAULT</small>}</span><p>{address.recipient} · {address.phone}<br/>{address.address}<br/>{address.city}, {address.state} {address.pincode}</p></div><div className="admin-row-actions"><button onClick={()=>setEditing(address)} aria-label={`Edit ${address.label}`}><Pencil size={14}/></button><button className="danger-action" onClick={()=>deleteAddress(address)} aria-label={`Delete ${address.label}`}><Trash2 size={14}/></button></div></article>)}</div>:<p className="admin-empty-note">Save a delivery address for faster checkout.</p>}
        {editing!==undefined&&<form className="address-editor" key={editing.id || 'new-address'} onSubmit={saveAddress}><div className="address-editor-title"><b>{editing.id?'Edit address':'New address'}</b><button type="button" onClick={()=>setEditing(undefined)} aria-label="Close address form"><X size={16}/></button></div><div className="profile-form address-form"><label>Label<input name="label" defaultValue={editing.label || ''} required maxLength="40" placeholder="Home, Work…"/></label><label>Recipient name<input name="recipient" defaultValue={editing.recipient || name} required maxLength="100"/></label><label>Phone<input name="phone" type="tel" defaultValue={editing.phone || mobile} required pattern="[0-9+() -]{8,30}" maxLength="30"/></label><label className="profile-field-wide">House / street<input name="address" defaultValue={editing.address || ''} required maxLength="240"/></label><label>City<input name="city" defaultValue={editing.city || ''} required maxLength="100"/></label><label>State<input name="state" defaultValue={editing.state || ''} required maxLength="100"/></label><label>PIN code<input name="pincode" inputMode="numeric" defaultValue={editing.pincode || ''} required pattern="[0-9]{6}" maxLength="6"/></label><label className="profile-default-check"><input type="checkbox" name="isDefault" defaultChecked={editing.isDefault || !addresses.length}/> Set as default address</label><button className="button-primary" disabled={saving}>{saving?'Saving…':'Save address'} <Check size={15}/></button></div></form>}
      </section></div>
  </section>;
}

function AdminPage({ account, categoryOptions, brandOptions, onShop }) {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categoryRecords, setCategoryRecords] = useState([]);
  const [brandRecords, setBrandRecords] = useState([]);
  const [couponRecords,setCouponRecords]=useState([]);
  const [reviewRecords,setReviewRecords]=useState([]);
  const [inventoryMovements,setInventoryMovements]=useState([]);
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
      const [summaryResponse, productsResponse, ordersResponse, customersResponse, categoriesResponse, brandsResponse, inventoryResponse, couponsResponse, reviewsResponse] = await Promise.all([
        apiRequest('/api/admin/summary'), apiRequest('/api/admin/products'), apiRequest('/api/admin/orders'), apiRequest('/api/admin/customers'), apiRequest('/api/admin/categories'), apiRequest('/api/admin/brands'), apiRequest('/api/admin/inventory'), apiRequest('/api/admin/coupons'), apiRequest('/api/admin/reviews'),
      ]);
      const [summaryData, productsData, ordersData, customersData, categoriesData, brandsData, inventoryData, couponsData, reviewsData] = await Promise.all([summaryResponse.json(), productsResponse.json(), ordersResponse.json(), customersResponse.json(), categoriesResponse.json(), brandsResponse.json(), inventoryResponse.json(), couponsResponse.json(), reviewsResponse.json()]);
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Could not load dashboard indicators.');
      if (!productsResponse.ok) throw new Error(productsData.error || 'Could not load products.');
      if (!ordersResponse.ok) throw new Error(ordersData.error || 'Could not load orders.');
      if (!customersResponse.ok) throw new Error(customersData.error || 'Could not load customers.');
      if (!categoriesResponse.ok) throw new Error(categoriesData.error || 'Could not load categories.');
      if (!brandsResponse.ok) throw new Error(brandsData.error || 'Could not load brands.');
      if (!inventoryResponse.ok) throw new Error(inventoryData.error || 'Could not load inventory history.');
      if (!couponsResponse.ok) throw new Error(couponsData.error || 'Could not load coupons.');
      if (!reviewsResponse.ok) throw new Error(reviewsData.error || 'Could not load reviews.');
      setSummary(summaryData); setItems(inventoryData.items || productsData.items || []); setOrders(ordersData.items || []); setCustomers(customersData.items || []); setCategoryRecords(categoriesData.items || []); setBrandRecords(brandsData.items || []); setInventoryMovements(inventoryData.movements||[]);setCouponRecords(couponsData.items||[]);setReviewRecords(reviewsData.items||[]);
    } catch (requestError) { setError(requestError.message || 'Could not reach the admin service.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const filtered = items.filter(product => {
    const matchesQuery = `${product.name} ${product.model} ${product.brand || ''} ${product.category}`.toLowerCase().includes(query.trim().toLowerCase());
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
  async function adjustStock(product,adjustment){
    setError('');
    try{const response=await apiRequest(`/api/admin/products/${encodeURIComponent(product.id)}/stock`,{method:'PATCH',body:JSON.stringify(adjustment)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not adjust stock.');await refresh();return true;}
    catch(adjustError){setError(adjustError.message||'Could not adjust stock.');return false;}
  }
  async function updateOrder(order, status) {
    setError('');
    try {
      const response = await apiRequest(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: 'PATCH', body: JSON.stringify(status) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update the order.');
      await refresh();
    } catch (updateError) { setError(updateError.message || 'Could not update the order.'); }
  }
  async function updateCustomer(customer, status) {
    setError('');
    try {
      const response=await apiRequest(`/api/admin/customers/${encodeURIComponent(customer.id)}`,{method:'PATCH',body:JSON.stringify({status})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not update this account.');
      await refresh();
    } catch(updateError) { setError(updateError.message || 'Could not update this account.'); }
  }
  async function saveCoupon(coupon){setError('');try{const response=await apiRequest(`/api/admin/coupons${coupon.id?`/${encodeURIComponent(coupon.id)}`:''}`,{method:coupon.id?'PUT':'POST',body:JSON.stringify(coupon)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save this coupon.');await refresh();return true;}catch(saveError){setError(saveError.message||'Could not save this coupon.');return false;}}
  async function deleteCoupon(coupon){if(!window.confirm(`Delete coupon ${coupon.code}?`))return;setError('');try{const response=await apiRequest(`/api/admin/coupons/${encodeURIComponent(coupon.id)}`,{method:'DELETE'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not delete this coupon.');await refresh();}catch(deleteError){setError(deleteError.message||'Could not delete this coupon.');}}
  async function moderateReview(review,status){setError('');try{const response=await apiRequest(`/api/admin/reviews/${encodeURIComponent(review.id)}`,{method:'PATCH',body:JSON.stringify({status})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not update the review.');await refresh();}catch(updateError){setError(updateError.message||'Could not update the review.');}}
  async function saveTaxonomy(kind,item) {
    setError('');
    try {
      const path=`/api/admin/${kind}${item.id?`/${encodeURIComponent(item.id)}`:''}`;
      const response=await apiRequest(path,{method:item.id?'PUT':'POST',body:JSON.stringify(item)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not save this record.');
      await refresh();
      return true;
    } catch(saveError) { setError(saveError.message || 'Could not save this record.'); return false; }
  }
  async function deleteTaxonomy(kind,item) {
    if(!window.confirm(`Delete ${item.name}?`))return;
    setError('');
    try {
      const response=await apiRequest(`/api/admin/${kind}/${encodeURIComponent(item.id)}`,{method:'DELETE'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Could not delete this record.');
      await refresh();
    } catch(deleteError) { setError(deleteError.message || 'Could not delete this record.'); }
  }

  return <section className="admin-page">
    <div className="admin-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>TECHPARTS ADMIN</div><h1>Admin <em>workspace.</em></h1><p>Signed in as {account.email}</p></div><button className="button-text admin-store-link" onClick={onShop}>View storefront <ArrowUpRight size={15}/></button></div>
    <div className="admin-tabs" role="tablist" aria-label="Admin sections"><button className={section === 'overview' ? 'selected' : ''} onClick={() => setSection('overview')}>Overview</button><button className={section === 'products' ? 'selected' : ''} onClick={() => setSection('products')}>Product management <span>{items.length}</span></button><button className={section === 'inventory' ? 'selected' : ''} onClick={() => setSection('inventory')}>Inventory</button><button className={section === 'orders' ? 'selected' : ''} onClick={() => setSection('orders')}>Orders <span>{orders.length}</span></button><button className={section === 'customers' ? 'selected' : ''} onClick={() => setSection('customers')}>Customers <span>{customers.length}</span></button><button className={section === 'promotions' ? 'selected' : ''} onClick={() => setSection('promotions')}>Promotions</button><button className={section === 'reviews' ? 'selected' : ''} onClick={() => setSection('reviews')}>Reviews <span>{reviewRecords.filter(item=>item.status==='pending').length}</span></button><button className={section === 'reports' ? 'selected' : ''} onClick={() => setSection('reports')}>Reports</button><button className={section === 'taxonomy' ? 'selected' : ''} onClick={() => setSection('taxonomy')}>Categories & brands</button></div>
    {error && <div className="admin-error" role="alert"><AlertTriangle size={15}/>{error}<button onClick={() => setError('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    {loading && !summary ? <div className="admin-loading">Loading your dashboard…</div> : section === 'overview' ? <>
      <div className="admin-kpi-grid">
        <AdminKpi label="Catalogue products" value={summary?.products ?? '—'} detail="Items listed in the store"/>
        <AdminKpi label="In stock" value={summary?.inStock ?? '—'} detail="Products with available units"/>
        <AdminKpi label="Low stock" value={summary?.lowStock ?? '—'} detail="At or below product thresholds" tone="warning"/>
        <AdminKpi label="Out of stock" value={summary?.outOfStock ?? '—'} detail="Needs an inventory update" tone="muted"/>
        <AdminKpi label="Inventory value" value={summary ? money(summary.inventoryValue) : '—'} detail="Current price × units in stock"/>
        <AdminKpi label="Customer accounts" value={summary?.customers ?? '—'} detail="Active registered customers"/>
        <AdminKpi label="Blocked accounts" value={summary?.blockedCustomers ?? '—'} detail="Cannot start a new session" tone="muted"/>
        <AdminKpi label="Orders" value={summary?.orders ?? '—'} detail="All customer orders"/>
        <AdminKpi label="Awaiting fulfilment" value={summary?.pendingOrders ?? '—'} detail="Placed or processing" tone="warning"/>
        <AdminKpi label="Recorded paid total" value={summary ? money(summary.paidRevenue) : '—'} detail="Manual payment records only"/>
      </div>
      <div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">INVENTORY CHECK</span><h2>Needs attention</h2></div><button className="text-action" onClick={() => setSection('inventory')}>Manage inventory <ArrowRight size={14}/></button></div>{items.filter(product => Number(product.stock) <= Number(product.lowStockThreshold??5)).slice(0, 6).length ? <div className="attention-list">{items.filter(product => Number(product.stock) <= Number(product.lowStockThreshold??5)).slice(0, 6).map(product => <div key={product.id}><span><b>{product.name}</b><small>{product.category} · alert at {product.lowStockThreshold??5}</small></span><strong className={Number(product.stock) === 0 ? 'stock-out' : 'stock-low'}>{Number(product.stock) === 0 ? 'Out of stock' : `${product.stock} left`}</strong></div>)}</div> : <p className="admin-empty-note">No products are below their low-stock thresholds.</p>}</section><section className="admin-panel admin-preview-panel"><span className="admin-preview-icon"><ShieldCheck size={18}/></span><span className="eyebrow">STORE REPORTING</span><h2>Orders and revenue</h2><p>{summary?.orders || 0} persisted order records. Order totals are not counted as revenue until an admin records payment; no payment gateway is connected.</p><button className="text-action" onClick={() => setSection('orders')}>Review orders <ArrowRight size={14}/></button></section></div>
    </> : section === 'products' ? <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">CATALOGUE</span><h2>Product management <span>({filtered.length})</span></h2></div><button className="button-primary admin-add-button" onClick={() => setEditor(null)}><Plus size={16}/> Add product</button></div><div className="admin-product-filters"><label className="search-box"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products…" aria-label="Search products"/></label><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by category"><option>All categories</option>{categoryOptions.map(item => <option key={item.id}>{item.name}</option>)}</select></div>{filtered.length ? <div className="admin-table-scroll"><table className="admin-product-table"><thead><tr><th>Product</th><th>Brand</th><th>Category</th><th>SKU</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{filtered.map(product => <tr key={product.id}><td><span className="admin-product-name"><b>{product.name}</b><small>{product.model}</small></span></td><td>{product.brand || '—'}</td><td>{product.category}</td><td>{product.sku || '—'}</td><td><b>{money(product.price)}</b>{product.old > product.price && <small className="admin-discount-tag">{Math.round((1-product.price/product.old)*100)}% off</small>}</td><td><span className={`admin-stock-pill ${product.stock > (product.lowStockThreshold??5) ? 'stock-good' : product.stock > 0 ? 'stock-low-bg' : 'stock-zero'}`}>{product.stock ?? 0} units</span></td><td><span className="admin-row-actions"><button onClick={() => setEditor(product)} aria-label={`Edit ${product.name}`} title="Edit product"><Pencil size={15}/></button><button className="danger-action" onClick={() => deleteProduct(product)} aria-label={`Delete ${product.name}`} title="Delete product"><Trash2 size={15}/></button></span></td></tr>)}</tbody></table></div> : <div className="admin-empty-note">No products match this search.</div>}</section> : section === 'inventory' ? <AdminInventory items={items} movements={inventoryMovements} onAdjust={adjustStock}/> : section === 'orders' ? <AdminOrders orders={orders} onStatusChange={updateOrder}/> : section === 'customers' ? <AdminCustomers customers={customers} onStatusChange={updateCustomer}/> : section === 'promotions' ? <CouponManager coupons={couponRecords} categories={categoryOptions} onSave={saveCoupon} onDelete={deleteCoupon}/> : section === 'reviews' ? <AdminReviews reviews={reviewRecords} onModerate={moderateReview}/> : section === 'reports' ? <AdminReports/> : <TaxonomyManager categories={categoryRecords} brands={brandRecords} onSave={saveTaxonomy} onDelete={deleteTaxonomy}/>}
    {editor !== undefined && <ProductEditor product={editor} categories={categoryOptions} brands={brandOptions} saving={saving} onClose={() => setEditor(undefined)} onSave={saveProduct}/>}
  </section>;
}

function AdminReports() {
  const [period,setPeriod]=useState('30d');
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{let current=true;setLoading(true);setError('');apiRequest(`/api/admin/reports?period=${period}`).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load reports.');if(current)setReport(data);}).catch(requestError=>{if(current)setError(requestError.message||'Could not load reports.');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[period]);
  function exportCsv(){if(!report)return;const escape=value=>`"${String(value??'').replaceAll('"','""')}"`;const rows=[['Period',period],[],['Summary','Value'],['Recorded paid revenue',report.totals.paidRevenue],['Paid orders',report.totals.paidOrders],['All orders',report.totals.orders],['Average paid order value',report.totals.averageOrderValue],['Recorded refunds',report.totals.refunds],['Refunded orders',report.totals.refundedOrders],['Units sold',report.totals.units],[],['Trend date','Orders','Recorded paid revenue'],...report.trend.map(item=>[item.label,item.orders,item.revenue]),[],['Category','Recorded paid revenue'],...report.categories.map(item=>[item.name,item.revenue]),[],['Product','Units sold','Recorded paid revenue'],...report.topProducts.map(item=>[item.name,item.units,item.revenue])];const csv=rows.map(row=>row.map(escape).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`techparts-report-${period}.csv`;link.click();URL.revokeObjectURL(url);}
  const maximum=Math.max(1,...(report?.trend||[]).map(item=>item.revenue));
  return <section className="admin-reports"><div className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">STORE PERFORMANCE</span><h2>Sales reports</h2></div><div className="report-actions"><label>Period<select value={period} onChange={event=>setPeriod(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="12m">Last 12 months</option><option value="year">This year</option></select></label><button className="button-primary admin-add-button" onClick={exportCsv} disabled={!report}>Export CSV</button></div></div>{loading?<div className="admin-loading">Preparing your report…</div>:error?<div className="admin-error" role="alert">{error}</div>:report&&<><p className="storage-note">Revenue includes orders marked paid by an administrator. Refund values are manually recorded; they are not reconciled with a payment provider.</p><div className="report-kpis"><AdminKpi label="Recorded paid revenue" value={money(report.totals.paidRevenue)} detail={`${report.totals.paidOrders} paid orders`}/><AdminKpi label="All orders" value={report.totals.orders} detail="Orders created in this period"/><AdminKpi label="Average paid order" value={money(Math.round(report.totals.averageOrderValue))} detail="Paid revenue ÷ paid orders"/><AdminKpi label="Recorded refunds" value={money(report.totals.refunds)} detail={`${report.totals.refundedOrders} orders marked refunded`} tone="muted"/></div><section className="report-panel"><div className="admin-panel-head"><div><span className="eyebrow">REVENUE TREND</span><h2>Paid sales by {period==='12m'||period==='year'?'month':'day'}</h2></div></div><div className="sales-chart" role="img" aria-label="Recorded paid revenue chart">{report.trend.map(item=><div className="sales-chart-column" key={item.label} title={`${item.label}: ${money(item.revenue)} · ${item.orders} orders`}><b>{item.revenue?money(item.revenue):''}</b><span style={{height:`${Math.max(3,item.revenue/maximum*100)}%`}}/><small>{item.label}</small></div>)}</div></section><div className="report-lists"><section className="report-panel"><div className="admin-panel-head"><div><span className="eyebrow">CATEGORY SALES</span><h2>Recorded revenue</h2></div></div>{report.categories.length?<div className="report-rank-list">{report.categories.slice(0,8).map(item=><div key={item.name}><span>{item.name}</span><b>{money(item.revenue)}</b><i style={{width:`${item.revenue/Math.max(1,report.categories[0].revenue)*100}%`}}/></div>)}</div>:<p className="admin-empty-note">No paid category sales in this period.</p>}</section><section className="report-panel"><div className="admin-panel-head"><div><span className="eyebrow">TOP PRODUCTS</span><h2>By paid revenue</h2></div></div>{report.topProducts.length?<div className="report-rank-list">{report.topProducts.slice(0,8).map((item,index)=><div key={item.name}><span><small>{String(index+1).padStart(2,'0')}</small> {item.name}<small> · {item.units} units</small></span><b>{money(item.revenue)}</b><i style={{width:`${item.revenue/Math.max(1,report.topProducts[0].revenue)*100}%`}}/></div>)}</div>:<p className="admin-empty-note">No paid product sales in this period.</p>}</section></div></>}</div></section>;
}

function AdminInventory({items,movements,onAdjust}) {
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState(null);
  const [submitting,setSubmitting]=useState(false);
  const filtered=items.filter(product=>`${product.name} ${product.brand||''} ${product.model||''} ${product.sku||''} ${product.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  async function submit(event){event.preventDefault();const formElement=event.currentTarget;setSubmitting(true);const form=new FormData(formElement);const ok=await onAdjust(selected,{delta:Number(form.get('delta')),reason:String(form.get('reason')||'')});setSubmitting(false);if(ok){setSelected(null);formElement.reset();}}
  return <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">STOCK CONTROL</span><h2>Inventory management <span>({items.length})</span></h2></div></div><p className="storage-note">Record stock increases and reductions with a reason. New stock cannot exceed one million units per adjustment; each manual update is timestamped.</p><div className="admin-product-filters"><label className="search-box"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, SKU, or category…" aria-label="Search inventory"/></label></div>{selected&&<form className="inventory-adjust-form" onSubmit={submit}><div><span className="eyebrow">ADJUST STOCK</span><b>{selected.name} · {selected.sku||'No SKU'}</b><small>Current quantity: {selected.stock??0}</small></div><label>Change by<input name="delta" type="number" required min={-(Number(selected.stock)||0)} max="10000000" step="1" defaultValue="1"/></label><label>Reason<input name="reason" required minLength="4" maxLength="180" placeholder="Restock delivery, correction…"/></label><button className="button-primary" disabled={submitting}>{submitting?'Saving…':'Record adjustment'} <Check size={14}/></button><button type="button" className="button-text" onClick={()=>setSelected(null)}>Cancel</button></form>}{filtered.length?<div className="admin-table-scroll"><table className="admin-product-table inventory-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Available</th><th>Reserved</th><th>Alert threshold</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map(product=>{const stock=Number(product.stock)||0;const threshold=Number(product.lowStockThreshold??5);return <tr key={product.id}><td><span className="admin-product-name"><b>{product.name}</b><small>{product.brand||product.model}</small></span></td><td>{product.sku||'—'}</td><td>{product.category}</td><td><b>{stock}</b></td><td>{product.reservedStock||0}</td><td>{threshold}</td><td><span className={`admin-stock-pill ${stock===0?'stock-zero':stock<=threshold?'stock-low-bg':'stock-good'}`}>{stock===0?'Out of stock':stock<=threshold?'Low stock':'Healthy'}</span></td><td><button className="button-text" onClick={()=>setSelected(product)}>Adjust</button></td></tr>})}</tbody></table></div>:<div className="admin-empty-note">No inventory items match the search.</div>}<section className="inventory-history"><div className="admin-products-heading"><div><span className="eyebrow">CHANGE LOG</span><h2>Recent stock movements</h2></div></div>{movements.length?<div className="admin-table-scroll"><table className="admin-product-table"><thead><tr><th>Time</th><th>Product / SKU</th><th>Change</th><th>Before → after</th><th>Reason</th><th>Updated by</th></tr></thead><tbody>{movements.map(movement=><tr key={movement.id}><td>{new Date(movement.createdAt).toLocaleString('en-IN')}</td><td><span className="admin-product-name"><b>{movement.productName}</b><small>{movement.sku||'No SKU'}</small></span></td><td className={movement.change>0?'inventory-increase':'inventory-decrease'}>{movement.change>0?'+':''}{movement.change}</td><td>{movement.previousStock} → {movement.newStock}</td><td>{movement.reason}</td><td>{movement.actor||'System'}</td></tr>)}</tbody></table></div>:<p className="admin-empty-note">No manual stock adjustments have been recorded yet.</p>}</section></section>;
}

function AdminCustomers({customers,onStatusChange}) {
  const [query,setQuery]=useState('');
  const filtered=customers.filter(customer=>`${customer.name} ${customer.email} ${customer.mobile}`.toLowerCase().includes(query.trim().toLowerCase()));
  function changeStatus(customer,status) {
    if(status==='blocked'&&!window.confirm(`Block ${customer.name}? They will be signed out and unable to sign in until reactivated.`))return;
    onStatusChange(customer,status);
  }
  return <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">CUSTOMER ACCOUNTS</span><h2>Customer management <span>({filtered.length})</span></h2></div></div><div className="admin-product-filters"><label className="search-box"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search name, email, or mobile…" aria-label="Search customer accounts"/></label></div>{filtered.length?<div className="admin-table-scroll"><table className="admin-product-table admin-customers-table"><thead><tr><th>Customer</th><th>Mobile</th><th>Orders</th><th>Joined</th><th>Account status</th></tr></thead><tbody>{filtered.map(customer=><tr key={customer.id}><td><span className="admin-product-name"><b>{customer.name}</b><small>{customer.email}</small></span></td><td>{customer.mobile || '—'}</td><td>{customer.orderCount}</td><td>{new Date(customer.createdAt).toLocaleDateString('en-IN')}</td><td><select aria-label={`Change status for ${customer.name}`} value={customer.status} onChange={event=>changeStatus(customer,event.target.value)}><option value="active">Active</option><option value="blocked">Blocked</option></select></td></tr>)}</tbody></table></div>:<div className="admin-empty-note">No customer accounts match this search.</div>}<p className="storage-note">Blocking deletes active sessions and prevents the customer from signing in. It does not delete account or order records.</p></section>;
}

function TaxonomyManager({categories:categoryItems,brands:brandItems,onSave,onDelete}) {
  const [kind,setKind]=useState('categories');
  const [editor,setEditor]=useState(undefined);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const rows=kind==='categories'?categoryItems:brandItems;
  async function submit(event) {
    event.preventDefault();setSaving(true);setError('');
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    payload.active=form.has('active');
    if(kind==='categories')payload.displayOrder=Number(payload.displayOrder || 0);
    try { if(await onSave(kind,editor?.id?{...payload,id:editor.id}:payload))setEditor(undefined); }
    catch(saveError) { setError(saveError.message || 'Could not save this record.'); }
    finally { setSaving(false); }
  }
  return <section className="taxonomy-layout"><div className="admin-tabs taxonomy-tabs"><button className={kind==='categories'?'selected':''} onClick={()=>{setKind('categories');setEditor(undefined)}}>Categories <span>{categoryItems.length}</span></button><button className={kind==='brands'?'selected':''} onClick={()=>{setKind('brands');setEditor(undefined)}}>Brands <span>{brandItems.length}</span></button></div><section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">STORE CATALOGUE</span><h2>{kind==='categories'?'Category management':'Brand management'} <span>({rows.length})</span></h2></div><button className="button-primary admin-add-button" onClick={()=>setEditor({})}><Plus size={15}/> Add {kind==='categories'?'category':'brand'}</button></div>{error&&<div className="admin-error" role="alert">{error}</div>}{editor!==undefined&&<form className="taxonomy-editor" key={`${kind}-${editor.id||'new'}`} onSubmit={submit}><div className="taxonomy-form-grid"><label>Name<input name="name" required minLength="2" maxLength="80" defaultValue={editor.name||''}/></label>{kind==='categories'?<><label>Parent category<select name="parent" defaultValue={editor.parent||''}><option value="">Top-level category</option>{categoryItems.filter(item=>item.active&&item.id!==editor.id).map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Display order<input name="displayOrder" type="number" min="0" max="10000" step="1" defaultValue={editor.displayOrder??0}/></label></>:<label>Website<input name="website" type="url" maxLength="200" defaultValue={editor.website||''} placeholder="https://brand.example"/></label>}<label className="taxonomy-wide">Description<textarea name="description" rows="3" maxLength="500" defaultValue={editor.description||''}/></label><label className="profile-default-check taxonomy-wide"><input type="checkbox" name="active" defaultChecked={editor.active!==false}/> Active in storefront</label></div><div className="admin-editor-actions"><button type="button" className="button-text" onClick={()=>setEditor(undefined)}>Cancel</button><button className="button-primary" disabled={saving}>{saving?'Saving…':editor.id?'Save changes':'Add'} <Check size={15}/></button></div></form>}{rows.length?<div className="taxonomy-list">{rows.map(item=><article className="taxonomy-row" key={item.id}><div><b>{item.name}</b><small>{kind==='categories'?(item.parent?`Subcategory of ${item.parent}`:'Top-level category'):item.website||'Brand record'}</small><p>{item.description||'No description'}</p></div><span className={`admin-stock-pill ${item.active?'stock-good':'stock-zero'}`}>{item.active?'Active':'Disabled'}</span><div className="admin-row-actions"><button onClick={()=>setEditor(item)} aria-label={`Edit ${item.name}`}><Pencil size={14}/></button><button className="danger-action" onClick={()=>onDelete(kind,item)} aria-label={`Delete ${item.name}`}><Trash2 size={14}/></button></div></article>)}</div>:<div className="admin-empty-note">No {kind} have been added.</div>}</section></section>;
}

function AdminReviews({reviews,onModerate}) {
  const pending=reviews.filter(item=>item.status==='pending');
  return <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">CUSTOMER FEEDBACK</span><h2>Review moderation <span>({pending.length} pending)</span></h2></div></div>{reviews.length?<div className="review-admin-list">{reviews.map(review=><article className="review-admin-card" key={review.id}><div className="review-admin-title"><div><b>{review.productName}</b><span>{review.customerName} · {review.customerEmail||'customer'} · {'★'.repeat(review.rating)}</span></div><span className={`admin-stock-pill ${review.status==='approved'?'stock-good':review.status==='pending'?'stock-low-bg':'stock-zero'}`}>{review.status}</span></div><h3>{review.title}</h3><p>{review.body}</p><small>{new Date(review.createdAt).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'})} · Delivered purchase verified</small>{review.status==='pending'&&<div className="admin-row-actions"><button onClick={()=>onModerate(review,'approved')}>Approve</button><button className="danger-action" onClick={()=>onModerate(review,'rejected')}>Reject</button></div>}</article>)}</div>:<div className="admin-empty-note">No customer reviews have been submitted.</div>}</section>;
}

function CouponManager({coupons,categories,onSave,onDelete}) {
  const [editor,setEditor]=useState(null);
  const [saving,setSaving]=useState(false);
  const now=new Date();const future=new Date(now.getTime()+30*24*60*60*1000);
  const localDate=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  async function submit(event){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const startsAt=new Date(data.get('startsAt'));const endsAt=new Date(data.get('endsAt'));if(Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime()))return;const coupon={code:String(data.get('code')||'').toUpperCase(),discountType:data.get('discountType'),value:Number(data.get('value')),minSubtotal:Number(data.get('minSubtotal')||0),maxDiscount:Number(data.get('maxDiscount')||0),usageLimit:Number(data.get('usageLimit')||0),startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),categories:data.getAll('categories'),active:data.has('active'),...(editor?.id?{id:editor.id}:{})};setSaving(true);const ok=await onSave(coupon);setSaving(false);if(ok)setEditor(null);}
  const currentActive=coupon=>coupon.active&&new Date(coupon.startsAt)<=now&&new Date(coupon.endsAt)>=now&&(!coupon.usageLimit||coupon.usedCount<coupon.usageLimit);
  return <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">PROMOTION RULES</span><h2>Coupon codes <span>({coupons.length})</span></h2></div><button className="button-primary admin-add-button" onClick={()=>setEditor({})}><Plus size={15}/> Create coupon</button></div><p className="storage-note">Codes are checked against current product prices at checkout. Usage limit 0 means unlimited; category selection left blank applies the code to the whole cart.</p>{editor&&<form className="coupon-admin-editor" onSubmit={submit}><div className="coupon-admin-grid"><label>Code<input name="code" required minLength="3" maxLength="32" pattern="[A-Za-z0-9_-]+" defaultValue={editor.code||''} placeholder="BUILD10"/></label><label>Discount type<select name="discountType" defaultValue={editor.discountType||'percent'}><option value="percent">Percent off</option><option value="fixed">Fixed ₹ amount</option></select></label><label>Discount value<input name="value" type="number" required min="1" max="100000000" step="1" defaultValue={editor.value??10}/></label><label>Minimum cart value (₹)<input name="minSubtotal" type="number" min="0" step="1" defaultValue={editor.minSubtotal??0}/></label><label>Maximum discount (₹)<input name="maxDiscount" type="number" min="0" step="1" defaultValue={editor.maxDiscount??0}/></label><label>Total uses (0 = unlimited)<input name="usageLimit" type="number" min="0" step="1" defaultValue={editor.usageLimit??0}/></label><label>Starts at<input name="startsAt" type="datetime-local" required defaultValue={localDate(editor.startsAt||now)}/></label><label>Ends at<input name="endsAt" type="datetime-local" required defaultValue={localDate(editor.endsAt||future)}/></label><fieldset className="coupon-categories"><legend>Eligible categories · blank means all</legend>{categories.map(category=><label key={category.id}><input type="checkbox" name="categories" value={category.name} defaultChecked={editor.categories?.includes(category.name)}/>{category.name}</label>)}</fieldset><label className="profile-default-check coupon-active"><input type="checkbox" name="active" defaultChecked={editor.active!==false}/> Active</label></div><div className="admin-editor-actions"><button type="button" className="button-text" onClick={()=>setEditor(null)}>Cancel</button><button className="button-primary" disabled={saving}>{saving?'Saving…':editor.id?'Save changes':'Create code'} <Check size={14}/></button></div></form>}{coupons.length?<div className="coupon-admin-list">{coupons.map(coupon=><article className="coupon-admin-row" key={coupon.id}><div><b>{coupon.code}</b><small>{coupon.discountType==='percent'?`${coupon.value}% off`:`${money(coupon.value)} off`} · {coupon.minSubtotal?`min. ${money(coupon.minSubtotal)}`:'no minimum'}{coupon.maxDiscount?` · cap ${money(coupon.maxDiscount)}`:''}</small><small>{coupon.categories?.length?coupon.categories.join(', '):'All categories'} · {coupon.usageLimit?`${coupon.usedCount}/${coupon.usageLimit} uses`:`${coupon.usedCount} uses · unlimited`}</small><small>{new Date(coupon.startsAt).toLocaleString('en-IN')} – {new Date(coupon.endsAt).toLocaleString('en-IN')}</small></div><span className={`admin-stock-pill ${currentActive(coupon)?'stock-good':'stock-zero'}`}>{currentActive(coupon)?'Active':coupon.active?'Scheduled / used up':'Disabled'}</span><div className="admin-row-actions"><button onClick={()=>setEditor(coupon)} aria-label={`Edit coupon ${coupon.code}`}><Pencil size={14}/></button><button className="danger-action" onClick={()=>onDelete(coupon)} aria-label={`Delete coupon ${coupon.code}`}><Trash2 size={14}/></button></div></article>)}</div>:<div className="admin-empty-note">No coupons yet. Create a code to offer a cart discount.</div>}</section>;
}

function AdminOrders({orders,onStatusChange}) {
  const statusTransitions = { Placed: ['Processing', 'Cancelled'], Processing: ['Packed', 'Cancelled'], Packed: ['Shipped', 'Cancelled'], Shipped: ['Out for Delivery'], 'Out for Delivery': ['Delivered'] };
  const paymentTransitions = { pending: ['paid'], paid: ['refunded'], refunded: [] };
  return <section className="admin-products-panel"><div className="admin-products-heading"><div><span className="eyebrow">FULFILMENT</span><h2>Order management <span>({orders.length})</span></h2></div></div>{orders.length ? <div className="admin-table-scroll"><table className="admin-product-table admin-orders-table"><thead><tr><th>Order / customer</th><th>Items</th><th>Total</th><th>Order status</th><th>Payment</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><span className="admin-product-name"><b>{order.number}</b><small>{order.customerName} · {order.customerEmail}</small><small>{new Date(order.createdAt).toLocaleDateString('en-IN')}</small></span></td><td>{order.items.map(item=>`${item.name} ×${item.quantity}`).join(', ')}</td><td><b>{money(order.total)}</b></td><td><select aria-label={`Update status for ${order.number}`} value={order.status} disabled={!statusTransitions[order.status]} onChange={event=>onStatusChange(order,{status:event.target.value})}>{[order.status,...(statusTransitions[order.status] || [])].map(status=><option key={status}>{status}</option>)}</select></td><td><select aria-label={`Update payment for ${order.number}`} value={order.paymentStatus} disabled={order.status==='Cancelled'||order.paymentStatus==='refunded'} onChange={event=>onStatusChange(order,{paymentStatus:event.target.value})}>{[order.paymentStatus,...(paymentTransitions[order.paymentStatus] || [])].map(status=><option key={status} value={status}>{status}</option>)}</select><small className="payment-method-label">{order.paymentMethod.toUpperCase()}</small></td></tr>)}</tbody></table></div> : <div className="admin-empty-note">No customer orders yet.</div>}<p className="storage-note">Payment status changes are manual records; no payment gateway is connected.</p></section>;
}

function AdminKpi({label,value,detail,tone=''}) {
  return <article className={`admin-kpi ${tone}`}><span>{label}</span><b>{value}</b><small>{detail}</small></article>;
}

function ProductEditor({product,categories:categoryList,brands:brandList,saving,onClose,onSave}) {
  const isEditing = Boolean(product?.id);
  const regularPrice = isEditing && product.old > product.price ? product.old : product?.price ?? '';
  const discount = isEditing && product.old > product.price ? Math.round((1-product.price/product.old)*100) : 0;
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSave({ ...values, regularPrice: Number(values.regularPrice), discountPercent: Number(values.discountPercent || 0), stock: Number(values.stock) });
  }
  return <div className="admin-modal-layer" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-editor" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit product' : 'Add product'}><header className="admin-editor-head"><div><span className="eyebrow">{isEditing ? 'UPDATE CATALOGUE' : 'NEW CATALOGUE ITEM'}</span><h2>{isEditing ? 'Edit product' : 'Add product'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close editor"><X size={19}/></button></header><form className="admin-editor-form" onSubmit={submit}><label className="admin-field-wide">Product name<input name="name" required minLength="2" maxLength="120" defaultValue={product?.name || ''} placeholder="Product name"/></label><label className="admin-field-wide">Model / short specs<input name="model" maxLength="180" defaultValue={product?.model || ''} placeholder="Brand · key specifications"/></label><label>Brand<select name="brand" defaultValue={product?.brand || ""}><option value="">Choose a brand</option>{brandList.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>SKU<input name="sku" maxLength="64" defaultValue={product?.sku || ""} placeholder="TP-00001"/></label><label>Category<select name="category" defaultValue={product?.category || categoryList[0]?.name || ""}>{categoryList.map(item => <option key={item.id}>{item.name}</option>)}</select></label><label>Available units<input name="stock" type="number" required min="0" step="1" defaultValue={product?.stock ?? 0}/></label><label>Low-stock alert<input name="lowStockThreshold" type="number" required min="0" step="1" defaultValue={product?.lowStockThreshold??5}/></label><label>Regular price (₹)<input name="regularPrice" type="number" required min="1" step="1" defaultValue={regularPrice}/></label><label>Discount (%)<input name="discountPercent" type="number" min="0" max="90" step="1" defaultValue={discount}/></label><label>Warranty details<input name="warranty" maxLength="120" defaultValue={product?.warranty||''} placeholder="e.g. 3 years limited"/></label><label className="admin-field-wide">Description<textarea name="description" maxLength="4000" rows="4" defaultValue={product?.description || ''} placeholder="Product details shown to customers"/></label><label className="admin-field-wide">Technical specifications (JSON)<textarea name="specifications" maxLength="12000" rows="5" defaultValue={JSON.stringify(product?.specifications || {}, null, 2)} placeholder="Example: socket AM5, cores 8"/></label><label>Image ID<input name="image" maxLength="120" defaultValue={product?.image || 'photo-1591488320449-011701bb6704'} placeholder="photo-…"/></label><label>Image tint<select name="color" defaultValue={product?.color || 'blue'}><option value="blue">Blue</option><option value="lavender">Lavender</option><option value="mint">Mint</option><option value="peach">Peach</option></select></label><div className="admin-editor-actions"><button type="button" className="button-text" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add product'} <ArrowRight size={15}/></button></div></form></section></div>;
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

function ProductDetails({product:p,account,onClose,onAdd,onCompare,compared,saved,onWishlist}) {
  useEffect(()=>{function onKey(e){if(e.key==='Escape')onClose()}window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  const outOfStock = p.stock !== undefined && Number(p.stock) <= 0;
  const discounted = Number(p.old) > Number(p.price);
  const specifications=Object.entries(p.specifications||{});
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="product-modal" role="dialog" aria-modal="true" aria-label={`${p.name} details`}><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button><div className={`detail-image ${p.color}`}><img src={photo(p.image)} alt={p.name}/>{p.badge&&<span className="product-badge">{p.badge}</span>}</div><div className="detail-copy"><span className="eyebrow"><span className="eyebrow-line"/>{p.category.toUpperCase()}</span><h2>{p.name}</h2><p className="detail-model">{[p.brand,p.model,p.sku&&`SKU ${p.sku}`].filter(Boolean).join(' · ')}</p><Rating product={p}/>{p.stock!==undefined&&<small className={outOfStock?'product-stock-note stock-out':'product-stock-note'}>{outOfStock?'Out of stock':`${p.stock} in stock`}</small>}<div className="detail-price"><b>{money(p.price)}</b>{discounted&&<><del>{money(p.old)}</del><span className="discount">{Math.round((1-p.price/p.old)*100)}% off</span></>}</div><p className="detail-description">{p.description || 'A community favorite, selected for dependable everyday performance. Confirm specifications and availability before purchase.'}</p><div className="detail-specs"><h3>Product information</h3>{p.warranty&&<div><b>Warranty</b><span>{p.warranty}</span></div>}{specifications.length?specifications.map(([key,value])=><div key={key}><b>{key}</b><span>{value}</span></div>):<p>Technical specifications have not been provided for this listing.</p>}</div><div className="detail-actions"><button className="button-primary" onClick={()=>onAdd(p)} disabled={outOfStock}>{outOfStock?'Out of stock':'Add to bag'} {!outOfStock&&<ShoppingBag size={15}/>}</button><button className={saved?'detail-save saved':'detail-save'} onClick={onWishlist}><Heart size={16} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save for later'}</button><button className={compared?'detail-save saved':'detail-save'} onClick={()=>onCompare(p)}><SlidersHorizontal size={15}/>{compared?'Compared':'Compare'}</button></div><ProductReviews product={p} account={account}/><small className="demo-note">Demo catalogue item · verify specifications, warranty, price and availability before purchase</small></div></section></div>;
}

function ProductReviews({product,account}) {
  const [data,setData]=useState({items:[],mine:null,canReview:false});const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
  async function load(){try{const response=await apiRequest(`/api/products/${encodeURIComponent(product.id)}/reviews`);const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not load reviews.');setData(payload);}catch(loadError){setError(loadError.message||'Could not load reviews.');}finally{setLoading(false);}}
  useEffect(()=>{setLoading(true);load();},[product.id]);
  async function submit(event){event.preventDefault();setSaving(true);setError('');const form=new FormData(event.currentTarget);try{const response=await apiRequest(`/api/products/${encodeURIComponent(product.id)}/reviews`,{method:'POST',body:JSON.stringify({rating:Number(form.get('rating')),title:String(form.get('title')),body:String(form.get('body'))})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not submit review.');setData(current=>({...current,canReview:false,mine:{...payload.review,title:String(form.get('title')),body:String(form.get('body')),rating:Number(form.get('rating'))}}));event.currentTarget.reset();}catch(saveError){setError(saveError.message||'Could not submit review.');}finally{setSaving(false);}}
  return <section className="product-reviews"><div className="product-reviews-head"><h3>Customer reviews</h3><span>{product.reviews||0} approved</span></div>{loading?<p className="review-empty">Loading reviews…</p>:data.items.length?data.items.map(review=><article className="review-item" key={review.id}><div><b>{review.title}</b><span>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)} <small>{review.customerName} · verified purchase</small></span></div><p>{review.body}</p></article>):<p className="review-empty">No approved reviews yet.</p>}{data.mine&&<p className="review-status">Your review is {data.mine.status}{data.mine.status==='pending'?' and is waiting for admin approval.':data.mine.status==='rejected'?' and was not approved for display.':'.'}</p>}{data.canReview&&account?.role==='customer'&&<form className="review-form" onSubmit={submit}><b>Share your experience</b><label>Rating<select name="rating" defaultValue="5"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label><label>Title<input name="title" minLength="3" maxLength="100" required placeholder="Summarize your review"/></label><label>Your review<textarea name="body" minLength="10" maxLength="1500" required rows="3" placeholder="What should other customers know?"/></label><button className="button-primary" disabled={saving}>{saving?'Submitting…':'Submit review'}</button></form>}{error&&<p className="review-status" role="alert">{error}</p>}</section>;
}

function CollectionDialog({title,eyebrow,products:items,empty,onClose,onAdd,onRemove,onOpen}) {
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="collection-modal" role="dialog" aria-modal="true" aria-label={title}><div className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title} <span>({items.length})</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>{items.length?<div className="collection-list">{items.map(p=><div className="collection-row" key={p.id}><button className="collection-open" onClick={()=>onOpen(p)}><img src={photo(p.image)} alt=""/><span><b>{p.name}</b><small>{p.model}</small></span></button><b>{money(p.price)}</b><button className="icon-button" onClick={()=>onRemove(p)} aria-label={`Remove ${p.name}`}><X size={16}/></button><button className="button-primary mini-add" onClick={()=>onAdd(p)}>Add</button></div>)}</div>:<div className="cart-empty"><span className="cart-empty-icon"><Heart/></span><h3>{empty}</h3><p>Tap the heart on a product to keep it close.</p><button className="button-primary" onClick={onClose}>Keep browsing <ArrowRight size={16}/></button></div>}</section></div>;
}

function CompareDialog({products:items,catalogue,onCompare,onClose,onAdd}) {
  const [candidate,setCandidate]=useState('');
  const category=items[0]?.category;
  const candidates=catalogue.filter(product=>product.category===category&&!items.some(item=>item.id===product.id));
  const specificationNames=[...new Set(items.flatMap(item=>Object.keys(item.specifications||{})))].sort((a,b)=>a.localeCompare(b));
  function removeCompared(item){onCompare(item);if(items.length===1)onClose();}
  const rows=[['Brand',item=>item.brand||'Not provided'],['Model',item=>item.model||'Not provided'],['Category',item=>item.category],['Warranty',item=>item.warranty||'Not provided'],['Customer rating',item=>item.reviews>0?`${item.rating} / 5 (${item.reviews})`:'No reviews yet'],['Price',item=>money(item.price)]];
  specificationNames.forEach(name=>rows.push([name,item=>item.specifications?.[name]||'Not provided']));
  rows.push(['Availability',item=>item.stock===undefined?'Not provided':Number(item.stock)>0?`${item.stock} in stock`:'Out of stock']);
  const lowestPrice=items.length?Math.min(...items.map(item=>Number(item.price)||Infinity)):Infinity;
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="compare-modal" role="dialog" aria-modal="true" aria-label="Compare components"><div className="drawer-head"><div><span className="eyebrow">SIDE BY SIDE · {category||'PRODUCTS'}</span><h2>Find your fit <span>({items.length}/4)</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>{items.length<4&&candidates.length>0&&<form className="compare-add-row" onSubmit={event=>{event.preventDefault();const item=candidates.find(product=>String(product.id)===candidate);if(item){onCompare(item);setCandidate('')}}}><label>Add another {category?.toLowerCase()}<select value={candidate} onChange={event=>setCandidate(event.target.value)} required><option value="">Choose a product</option>{candidates.map(product=><option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}</select></label><button className="button-primary" disabled={!candidate}>Add to comparison <Plus size={14}/></button></form>}<div className="compare-table" style={{'--compare-columns':items.length}}><div className="compare-label"></div>{items.map(p=><div className="compare-item" key={p.id}><button className="compare-remove" onClick={()=>removeCompared(p)} aria-label={`Remove ${p.name} from comparison`}>Remove <X size={12}/></button><img src={photo(p.image)} alt=""/><b>{p.name}</b><small>{p.model}</small><strong>{money(p.price)}</strong>{p.price===lowestPrice&&<span className="compare-lowest">Lowest price</span>}<button className="button-primary" onClick={()=>onAdd(p)} disabled={p.stock!==undefined&&Number(p.stock)<=0}>{p.stock!==undefined&&Number(p.stock)<=0?'Out of stock':'Add to bag'}</button></div>)}{rows.map(([label,value])=>{const values=items.map(value);const different=new Set(values).size>1;return <React.Fragment key={label}><div className="compare-label">{label}</div>{items.map((item,index)=><div className={`compare-value${different?' compare-different':''}${label==='Price'&&Number(item.price)===lowestPrice?' compare-low-price':''}`} key={item.id}>{values[index]}</div>)}</React.Fragment>})}</div><p className="demo-note">Only recorded specifications are compared. “Not provided” means the catalogue needs more data; check manufacturer information before purchase.</p></section></div>;
}

function CheckoutPage({account,items,subtotal,discount,couponCode,total,error,onBack,onPlace}) {
  const [payment,setPayment]=useState('upi');
  const [submitting,setSubmitting]=useState(false);
  const addresses=account.addresses || [];
  const initialAddress=addresses.find(address=>address.isDefault) || addresses[0];
  const [selectedAddressId,setSelectedAddressId]=useState(initialAddress?.id || '');
  const selectedAddress=addresses.find(address=>address.id===selectedAddressId);
  async function submitOrder(event) {
    event.preventDefault();
    if (submitting) return;
    const values=Object.fromEntries(new FormData(event.currentTarget).entries());
    setSubmitting(true);
    try { await onPlace({...values,payment}); }
    finally { setSubmitting(false); }
  }
  return <section className="checkout-page">
    <button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to your bag</button>
    <div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>JUST ONE MORE THING</div><h1>Delivery <em>details.</em></h1><p>Your order will be saved to your account. Online payment and shipping labels are not connected yet.</p></div>
    <div className="checkout-layout"><form className="checkout-form" key={selectedAddressId} onSubmit={submitOrder}>
      <div className="checkout-section-head"><span>01</span><div><b>Who’s receiving it?</b><small>These details will be saved with your order.</small></div></div>
      {addresses.length>0&&<label className="saved-address-select">Use a saved address<select value={selectedAddressId} onChange={event=>setSelectedAddressId(event.target.value)}><option value="">Enter a new address</option>{addresses.map(address=><option key={address.id} value={address.id}>{address.label} · {address.city}</option>)}</select></label>}
      <div className="form-grid"><label>Full name<input name="name" autoComplete="name" required minLength="2" defaultValue={selectedAddress?.recipient || account.name || ''} placeholder="Your name"/></label><label>Email address<input name="email" type="email" autoComplete="email" required defaultValue={account.email || ''} placeholder="you@example.com"/></label><label>Mobile number<input name="phone" type="tel" autoComplete="tel" required pattern="[0-9+() -]{8,30}" defaultValue={selectedAddress?.phone || account.mobile || ''} placeholder="+91 98765 43210"/></label><label>PIN code<input name="pincode" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{6}" maxLength="6" defaultValue={selectedAddress?.pincode || ''} placeholder="6-digit PIN code"/></label><label className="form-wide">Street address<input name="address" autoComplete="street-address" required minLength="5" defaultValue={selectedAddress?.address || ''} placeholder="House number and street"/></label><label>City<input name="city" autoComplete="address-level2" required defaultValue={selectedAddress?.city || ''} placeholder="City"/></label><label>State<input name="state" autoComplete="address-level1" required defaultValue={selectedAddress?.state || ''} placeholder="State"/></label></div>
      <div className="checkout-section-head payment-head"><span>02</span><div><b>Payment preference</b><small>This records your preference; no payment is collected.</small></div></div>
      <div className="payment-options"><label className={payment==='upi'?'payment-option active':'payment-option'}><input type="radio" name="payment" value="upi" checked={payment==='upi'} onChange={()=>setPayment('upi')}/><span className="radio-dot"/><span><b>UPI</b><small>Payment pending · gateway not connected</small></span></label><label className={payment==='cod'?'payment-option active':'payment-option'}><input type="radio" name="payment" value="cod" checked={payment==='cod'} onChange={()=>setPayment('cod')}/><span className="radio-dot"/><span><b>Cash on delivery</b><small>Payment preference only</small></span></label></div>
      {error&&<p className="checkout-error" role="alert">{error}</p>}<button className="button-primary submit-order" type="submit" disabled={submitting}>{submitting?'Placing order…':'Place order'} {!submitting&&<ArrowRight size={16}/>}</button>
    </form><aside className="checkout-summary"><span className="eyebrow">ORDER SUMMARY</span><h2>Looking good.</h2><div className="checkout-items">{items.map(item=><div className="checkout-item" key={item.id}><img src={photo(item.image)} alt=""/><span><b>{item.name}</b><small>Qty {item.qty}</small></span><strong>{money(item.price*item.qty)}</strong></div>)}</div><div className="checkout-total"><span>Items subtotal</span><b>{money(subtotal)}</b></div>{discount>0&&<div className="checkout-total coupon-savings"><span>{couponCode} discount</span><b>−{money(discount)}</b></div>}<div className="checkout-total"><span>Total after discount</span><b>{money(total)}</b></div><p className="preview-warning"><ShieldCheck size={15}/> Stock is rechecked and reserved when placing the order. Payment, tax, and delivery charges are not connected.</p></aside></div>
  </section>;
}

function OrderConfirmation({order,onShop,onOrders}) {
  return <section className="order-confirmation"><div className="confirmation-mark"><Check size={30}/></div><span className="eyebrow">ORDER SAVED TO YOUR ACCOUNT</span><h1>Your order is <em>placed.</em></h1><p className="confirmation-text">Payment is pending. This project does not yet collect payment or arrange delivery; the order is available to the store admin for review.</p><div className="confirmation-card"><div><span>Order reference</span><b>{order?.number}</b></div>{order?.couponCode&&<div><span>Coupon savings · {order.couponCode}</span><b>−{money(order?.discount||0)}</b></div>}<div><span>Order total</span><b>{money(order?.total||0)}</b></div><div><span>Order / payment status</span><b>{order?.status} · {order?.paymentStatus || 'pending'}</b></div><div><span>Delivery address</span><b>{order?.delivery?.address}</b><small>{order?.delivery?.city}, {order?.delivery?.state} {order?.delivery?.pincode}</small></div></div><div className="confirmation-actions"><button className="button-primary" onClick={onOrders}>View my orders <ArrowRight size={16}/></button><button className="button-text" onClick={onShop}>Continue browsing</button></div></section>;
}

function OrdersPage({orders,onShop}) {
  return <section className="orders-page"><button className="back-link" onClick={onShop}><ChevronLeft size={16}/> Back to shop</button><div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>YOUR RECENT ACTIVITY</div><h1>Order <em>history.</em></h1><p>Orders placed from this account, with current status and payment state.</p></div>{orders.length?<div className="orders-list">{orders.map(order=><article className="order-card" key={order.number}><div className="order-card-head"><span><small>ORDER REFERENCE</small><b>{order.number}</b></span><span className="order-status"><span/> {order.status} · {order.paymentStatus || 'pending'}</span></div><div className="order-card-items">{order.items.map(item=><div key={item.productId || item.id}><img src={photo(item.image)} alt=""/><span><b>{item.name}</b><small>Qty {item.quantity ?? item.qty}</small></span></div>)}</div><div className="order-card-foot"><span>{new Date(order.createdAt).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'})}</span><b>{money(order.total)}</b></div></article>)}</div>:<div className="empty-state"><PackageCheck size={24}/><b>No orders yet</b><span>Your submitted orders will appear here.</span><button onClick={onShop}>Browse components</button></div>}<p className="storage-note">Order records are stored with your account. Payment processing and delivery tracking are not connected yet.</p></section>;
}

function Builder({catalogue,onBack,onAdd,account}) {
  const slots=[{key:'cpu',label:'Processor',category:'Processors'},{key:'gpu',label:'Graphics card',category:'Graphics Cards'},{key:'motherboard',label:'Motherboard',category:'Motherboards'},{key:'memory',label:'Memory',category:'Memory'},{key:'storage',label:'Storage',category:'Storage'},{key:'power',label:'Power supply',category:'Power'},{key:'case',label:'PC case',category:'Cases'},{key:'cooling',label:'CPU cooling',category:'Cooling'}];
  const [selection,setSelection]=useState({});
  const [savedBuilds,setSavedBuilds]=useState([]);
  const [buildName,setBuildName]=useState('');
  const [message,setMessage]=useState('');
  const [shareUrl,setShareUrl]=useState('');
  const [loadingSaved,setLoadingSaved]=useState(true);
  const selected=slots.map(slot=>({slot,item:catalogue.find(product=>String(product.id)===String(selection[slot.key]))})).filter(row=>row.item);
  const total=selected.reduce((sum,row)=>sum+Number(row.item.price||0),0);
  const fullBuild=selected.length===slots.length;
  const hasUnavailable=selected.some(({item})=>item.stock!==undefined&&Number(item.stock)<=0);
  useEffect(()=>{
    const shared=new URLSearchParams(window.location.search).get('build');
    if(shared){const ids=new Set(shared.split(',').map(value=>value.trim()));const next={};for(const product of catalogue){if(ids.has(String(product.id))){const slot=slots.find(item=>item.category===product.category);if(slot)next[slot.key]=String(product.id);}}setSelection(next);}
  },[catalogue]);
  useEffect(()=>{
    let current=true;
    apiRequest('/api/builds').then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load your saved builds.');if(current)setSavedBuilds(data.items||[]);}).catch(error=>{if(current)setMessage(error.message||'Saved builds need the account service.');}).finally(()=>{if(current)setLoadingSaved(false);});
    return()=>{current=false;};
  },[]);
  const compatibility=useMemo(()=>{
    const selectedProducts=Object.fromEntries(selected.map(({slot,item})=>[slot.key,item]));
    const getSpec=(item,...keys)=>{for(const key of keys){const found=Object.entries(item?.specifications||{}).find(([name])=>name.toLowerCase()===key.toLowerCase());if(found?.[1])return String(found[1]);}return '';};
    const socket=item=>getSpec(item,'socket','cpuSocket','socketType')||`${item?.name||''} ${item?.model||''}`.match(/AM\s?\d+|LGA\s?\d+/i)?.[0]||'';
    const memoryType=item=>getSpec(item,'memoryType','memory','ramType')||`${item?.name||''} ${item?.model||''}`.match(/DDR[45]/i)?.[0]||'';
    const checks=[];
    const cpuSocket=socket(selectedProducts.cpu),boardSocket=socket(selectedProducts.motherboard);
    if(selectedProducts.cpu&&selectedProducts.motherboard)checks.push({label:'CPU socket and motherboard',state:cpuSocket&&boardSocket?(cpuSocket.replace(/\s/g,'').toUpperCase()===boardSocket.replace(/\s/g,'').toUpperCase()?'compatible':'incompatible'):'review',detail:cpuSocket&&boardSocket?`${cpuSocket} CPU · ${boardSocket} board`:'Socket details are incomplete; confirm both manufacturers’ specifications.'});
    const ramType=memoryType(selectedProducts.memory),boardRam=memoryType(selectedProducts.motherboard);
    if(selectedProducts.memory&&selectedProducts.motherboard)checks.push({label:'Memory and motherboard',state:ramType&&boardRam?(ramType.toUpperCase()===boardRam.toUpperCase()?'compatible':'incompatible'):'review',detail:ramType&&boardRam?`${ramType} memory · ${boardRam} board`:'Memory generation is not fully specified; confirm board support.'});
    const gpuLength=Number(getSpec(selectedProducts.gpu,'lengthMm','gpuLengthMm'));
    const caseClearance=Number(getSpec(selectedProducts.case,'maxGpuLengthMm','gpuClearanceMm'));
    if(selectedProducts.gpu&&selectedProducts.case)checks.push({label:'Graphics card and case clearance',state:gpuLength&&caseClearance?(gpuLength<=caseClearance?'compatible':'incompatible'):'review',detail:gpuLength&&caseClearance?`${gpuLength} mm card · ${caseClearance} mm case clearance`:'Physical dimensions are not recorded for both parts; measure before purchase.'});
    const gpuPower=Number(getSpec(selectedProducts.gpu,'recommendedPsuW','recommendedPowerW'));
    const psuPower=Number(getSpec(selectedProducts.power,'wattage','powerW'));
    if(selectedProducts.gpu&&selectedProducts.power)checks.push({label:'Power supply capacity',state:gpuPower&&psuPower?(psuPower>=gpuPower?'compatible':'incompatible'):'review',detail:gpuPower&&psuPower?`${psuPower} W PSU · ${gpuPower} W minimum recommendation`:'Power requirements are incomplete; verify total system demand.'});
    return checks;
  },[selection,catalogue]);
  const incompatible=compatibility.some(check=>check.state==='incompatible');
  const needsReview=compatibility.some(check=>check.state==='review')||!fullBuild;
  async function saveBuild(event){
    event.preventDefault();setMessage('');
    try{const response=await apiRequest('/api/builds',{method:'POST',body:JSON.stringify({name:buildName,products:selected.map(row=>String(row.item.id))})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save this build.');setSavedBuilds(current=>[data.build,...current]);setBuildName('');setMessage('Build saved to your account.');}
    catch(error){setMessage(error.message||'Could not save this build.');}
  }
  async function removeSaved(id){try{const response=await apiRequest(`/api/builds/${encodeURIComponent(id)}`,{method:'DELETE'});if(!response.ok)throw new Error('Could not remove this saved build.');setSavedBuilds(current=>current.filter(build=>build.id!==id));}catch(error){setMessage(error.message);}}
  function loadBuild(build){const next={};for(const id of build.products||[]){const item=catalogue.find(product=>String(product.id)===String(id));const slot=slots.find(value=>value.category===item?.category);if(item&&slot)next[slot.key]=String(item.id);}setSelection(next);window.scrollTo({top:0,behavior:'smooth'});}
  async function shareBuild(){const ids=selected.map(row=>String(row.item.id));if(!ids.length)return;const link=`${window.location.origin}${window.location.pathname}?build=${encodeURIComponent(ids.join(','))}`;setShareUrl(link);try{await navigator.clipboard.writeText(link);setMessage('Share link copied. Anyone opening it will see this build in the builder.');}catch{setMessage('Share link is ready below; copy it to share this build.');}}
  return <section className="builder-page"><button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to shop</button><div className="builder-page-head"><div className="eyebrow"><span className="eyebrow-line"/>YOUR BUILD, YOUR RULES</div><h1>Let’s build something <em>brilliant.</em></h1><p>Select parts from the live catalogue. Compatibility checks only use specifications the store has actually recorded.</p></div><div className="build-progress"><span className={`progress-dot ${selected.length?'done':''}`}>{selected.length}</span><span className="progress-line active"/><span className={`progress-dot ${fullBuild?'done':''}`}>{fullBuild?<Check size={12}/>:slots.length}</span><div><b>{selected.length} of {slots.length} parts selected</b><small>{fullBuild?'All required slots selected':'Choose a product for each component slot'}</small></div></div><div className="build-layout"><div className="build-list">{slots.map((slot,index)=>{const item=catalogue.find(product=>String(product.id)===String(selection[slot.key]));const options=catalogue.filter(product=>product.category===slot.category);return <div className="build-row builder-slot" key={slot.key}><span className="build-number">{String(index+1).padStart(2,'0')}</span><div className="build-part-icon"><Cpu size={18}/></div><div className="build-part"><b>{slot.label}</b><select value={selection[slot.key]||''} onChange={event=>setSelection(current=>({...current,[slot.key]:event.target.value}))}><option value="">Choose {slot.label.toLowerCase()}</option>{options.map(product=><option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}</select>{item&&<small>{[item.brand,item.model,item.specifications&&Object.values(item.specifications).slice(0,3).join(' · ')].filter(Boolean).join(' · ')}</small>}</div>{item&&<><span className={`compatible ${item.stock===undefined?'needs-review':Number(item.stock)>0?'':'incompatible'}`}>{item.stock===undefined?'Stock unknown':Number(item.stock)>0?'In stock':'Out of stock'}</span><b className="build-price">{money(item.price)}</b><button className="icon-button" onClick={()=>setSelection(current=>({...current,[slot.key]:''}))} aria-label={`Remove ${slot.label}`}><X size={16}/></button></>}</div>})}</div><aside className="build-summary"><span className="eyebrow">YOUR BUILD</span><h3>{fullBuild?'Build overview':'Choose your components'}</h3><div className="summary-line"><span>{selected.length} selected items</span><b>{money(total)}</b></div><div className={`summary-compat ${incompatible?'incompatible':needsReview?'needs-review':''}`}><span>{incompatible?'!':needsReview?'?':<Check size={15}/>}</span><div><b>{incompatible?'Incompatibility found':needsReview?'Needs specification review':'Required checks pass'}</b><small>{compatibility.length?compatibility.map(check=>`${check.label}: ${check.state==='compatible'?'compatible':check.state==='incompatible'?'conflict':'review needed'}`).join(' · '):'Select a CPU and motherboard to begin checks.'}</small></div></div>{compatibility.map(check=><div key={check.label} className={`builder-check ${check.state}`}><b>{check.label}</b><small>{check.detail}</small></div>)}{hasUnavailable&&<p className="builder-warning">One or more selected parts are out of stock. Update inventory before adding this build.</p>}<button className="button-primary" disabled={!fullBuild||hasUnavailable} onClick={()=>{selected.forEach(row=>onAdd(row.item));onBack()}}>Add selected build to bag <ArrowRight size={16}/></button><small className="summary-note"><ShieldCheck size={13}/> Stock and prices are checked again at checkout.</small><form className="save-build-form" onSubmit={saveBuild}><label>Save build to {account.name.split(' ')[0]}'s account<input required minLength="2" maxLength="60" value={buildName} onChange={event=>setBuildName(event.target.value)} placeholder="Name this build"/></label><button className="button-text" disabled={!selected.length}>Save build</button></form><button className="button-text share-build-button" disabled={!selected.length} onClick={shareBuild}>Copy share link <ArrowUpRight size={14}/></button>{shareUrl&&<input className="share-build-url" readOnly value={shareUrl} onFocus={event=>event.target.select()} aria-label="Shareable build URL"/>}{message&&<p className="builder-message" role="status">{message}</p>}</aside></div><section className="saved-builds"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Saved builds</h2></div>{loadingSaved?<p>Loading saved builds…</p>:savedBuilds.length?savedBuilds.map(build=><article className="saved-build-row" key={build.id}><div><b>{build.name}</b><small>{(build.products||[]).length} saved parts · {new Date(build.updatedAt||build.createdAt).toLocaleDateString('en-IN')}</small></div><div><button className="button-text" onClick={()=>loadBuild(build)}>Load</button><button className="button-text" onClick={()=>removeSaved(build.id)}>Delete</button></div></article>):<p>No saved builds yet. Choose some parts and save a named configuration.</p>}</section></section>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
