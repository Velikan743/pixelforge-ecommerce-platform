import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Cpu, Gamepad2, Headphones, Heart, Menu, Moon, Monitor, PackageCheck, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Truck, X, Zap } from 'lucide-react';
import { products } from './product-data.js';
import './styles.css';

const categories = [
  { name: 'Graphics Cards', short: 'GPUs', icon: Gamepad2 },
  { name: 'Processors', short: 'Processors', icon: Cpu },
  { name: 'Memory', short: 'Memory', icon: Zap },
  { name: 'Monitors', short: 'Monitors', icon: Monitor },
  { name: 'Peripherals', short: 'Peripherals', icon: Headphones },
];
const money = n => '₹' + n.toLocaleString('en-IN');
const photo = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=720&q=82`;

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('techparts-theme') === 'dark');
  const [active, setActive] = useState('All components');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Featured');
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('techparts-cart') || '[]'));
  const [wishlist, setWishlist] = useState(() => JSON.parse(localStorage.getItem('techparts-wishlist') || '[]'));
  const [orders, setOrders] = useState(() => JSON.parse(localStorage.getItem('techparts-orders') || '[]'));
  const [compare, setCompare] = useState([]);
  const [details, setDetails] = useState(null);
  const [showWishlist, setShowWishlist] = useState(false);
  const [catalog, setCatalog] = useState(products);
  const [drawer, setDrawer] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [ordersPage, setOrdersPage] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products?limit=100', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.items?.length) setCatalog(data.items); })
      .catch(error => { if (error.name !== 'AbortError') console.info('Using the local demo catalogue.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => { localStorage.setItem('techparts-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('techparts-wishlist', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem('techparts-orders', JSON.stringify(orders)); }, [orders]);

  const visibleProducts = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = catalog.filter(p => (active === 'All components' || p.category === active) && (!q || `${p.name} ${p.model} ${p.category}`.toLowerCase().includes(q)));
    return sort === 'Price: low to high' ? [...list].sort((a,b)=>a.price-b.price) : sort === 'Price: high to low' ? [...list].sort((a,b)=>b.price-a.price) : list;
  }, [active, catalog, query, sort]);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

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
  function placeOrder(delivery) {
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
  }

  return <div className={dark ? 'app dark' : 'app'}>
    <div className="announcement"><span><Sparkles size={13}/> THE COMPONENTS YOU WANT, AT PRICES YOU’LL LOVE</span><a href="#products">See what’s new <ArrowRight size={13}/></a></div>
    <header className="header">
      <a className="brand" href="#home" aria-label="TechParts home"><span className="brand-mark"><Zap size={20} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a>
      <nav className={mobileMenu ? 'nav open' : 'nav'}><a className="nav-active" href="#products" onClick={()=>{setOrdersPage(false);setCheckout(false);setBuilder(false);setMobileMenu(false)}}>Shop</a><a href="#categories" onClick={()=>setMobileMenu(false)}>Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true);setOrdersPage(false);setMobileMenu(false)}}>PC Builder <span className="new-pill">NEW</span></a><a href="#orders" onClick={e=>{e.preventDefault();setOrdersPage(true);setBuilder(false);setCheckout(false);setMobileMenu(false)}}>Orders</a></nav>
      <div className="header-actions"><label className="search-box"><Search size={17}/><input aria-label="Search products" placeholder="Search components..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><button className="icon-button theme-button" aria-label="Toggle theme" onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="wishlist-header" onClick={()=>setShowWishlist(true)} aria-label={`Wishlist, ${wishlist.length} products`}><Heart size={18}/><span>Saved</span>{wishlist.length>0&&<b>{wishlist.length}</b>}</button><button className="bag-button" onClick={()=>setDrawer(true)} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19}/><span>Bag</span><b>{cartCount}</b></button><button className="icon-button menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button></div>
    </header>
    <main>
      {builder ? <Builder onBack={()=>setBuilder(false)} onAdd={addToCart}/> : checkout==='form' ? <CheckoutPage items={cart} total={cartTotal} onBack={()=>setCheckout(false)} onPlace={placeOrder}/> : checkout==='confirmed' ? <OrderConfirmation order={placedOrder} onShop={()=>{setCheckout(false);setOrdersPage(false)}} onOrders={()=>{setCheckout(false);setOrdersPage(true)}}/> : ordersPage ? <OrdersPage orders={orders} onShop={()=>setOrdersPage(false)}/> : <>
        <section className="hero" id="home">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/>THE NEXT LEVEL STARTS HERE</div><h1>Your setup.<br/>Your <em>story.</em></h1><p>Thoughtful gear for the way you play, create, and work. Find your next favorite piece.</p><div className="hero-buttons"><a className="button-primary" href="#products">Explore components <ArrowRight size={16}/></a><button className="button-text" onClick={()=>setBuilder(true)}>Build your PC <ArrowUpRight size={15}/></button></div><div className="hero-proof"><div className="avatars"><span>R</span><span>A</span><span>K</span><span>+</span></div><div><strong>Loved by 12,000+ builders</strong><small>★★★★★ <span>4.9 / 5 average rating</span></small></div></div></div>
          <div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"/><div className="hero-product"><img src={photo('photo-1587202372775-e229f172b9d7')} alt="High-performance graphics card"/><span className="floating-tag tag-top"><span className="tag-dot"/>NEW DROP <strong>RTX 50 SERIES</strong></span><span className="floating-tag tag-bottom"><span className="tag-icon"><Zap size={17}/></span><span>Built for more<small>Make every frame count</small></span><ArrowUpRight size={17}/></span></div><div className="hero-scribble">MAKE<br/>IT YOURS<span>↗</span></div><span className="hero-index">01 / 04</span></div>
        </section>
        <section className="trust-strip" aria-label="Shopping benefits"><div><Truck/><span><b>Free delivery</b><small>on orders over ₹2,000</small></span></div><div><ShieldCheck/><span><b>Genuine gear</b><small>100% authorized products</small></span></div><div><PackageCheck/><span><b>Easy returns</b><small>7-day return window</small></span></div><div><Heart/><span><b>Here to help</b><small>Real humans, always</small></span></div></section>
        <section className="categories-section section" id="categories"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>FIND YOUR THING</div><h2>Browse by <em>category.</em></h2></div><a className="subtle-link" href="#products">All categories <ArrowRight size={15}/></a></div><div className="category-grid">{categories.map(({name,short,icon:Icon},index)=>{const count=catalog.filter(product=>product.category===name).length;return <button key={name} className={`category-card cat-${index}`} onClick={()=>{setActive(name);document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}><span className="category-icon"><Icon size={22}/></span><span className="category-copy"><b>{short}</b><small>{count} {count===1?'product':'products'}</small></span><ArrowUpRight className="category-arrow" size={17}/><span className="category-art">{index===0?'RTX':index===1?'Ryzen':index===2?'DDR5':index===3?'240Hz':'PRO'}</span></button>})}</div></section>
        <section className="products-section section" id="products"><div className="section-heading product-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>GOOD GEAR, GREAT DAYS</div><h2>Made for your <em>next.</em></h2><p>A few community favorites to get you started.</p></div><a className="subtle-link desktop-link" href="#products">Explore the shop <ArrowRight size={15}/></a></div>
          <div className="product-toolbar"><div className="filter-tabs"><button className={active==='All components'?'selected':''} onClick={()=>setActive('All components')}>Everything <span>{catalog.length}</span></button>{['Graphics Cards','Processors','Memory','Storage'].map(c=><button key={c} className={active===c?'selected':''} onClick={()=>setActive(c)}>{c}</button>)}</div><label className="sort-control"><SlidersHorizontal size={15}/><span>Sort:</span><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products"><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option></select><ChevronDown size={14}/></label></div>
          {visibleProducts.length ? <div className="product-grid">{visibleProducts.map(p=><ProductCard key={p.id} product={p} onAdd={addToCart} onDetails={setDetails} onWishlist={toggleWishlist} onCompare={toggleCompare} saved={wishlist.some(item=>item.id===p.id)} compared={compare.some(item=>item.id===p.id)}/>)}</div> : <div className="empty-state"><Search/><b>No components found</b><span>Try another search or browse everything.</span><button onClick={()=>{setQuery('');setActive('All components')}}>Clear filters</button></div>}
          <a className="mobile-all subtle-link" href="#products">Explore the shop <ArrowRight size={15}/></a>
        </section>
        <section className="builder-banner section" id="builder"><div className="builder-graphic"><div className="builder-ring"/><div className="builder-chip"><Cpu size={48}/><span>AM5</span></div><div className="builder-node node-one">GPU <b>✓</b></div><div className="builder-node node-two">RAM <b>✓</b></div><div className="builder-node node-three">CPU <b>✓</b></div><div className="builder-mini">BUILD<br/>01</div></div><div className="builder-copy"><div className="eyebrow"><span className="eyebrow-line"/>A LITTLE HELP, A LOT OF POWER</div><h2>Big ideas.<br/><em>Zero guesswork.</em></h2><p>Build your dream setup with our step-by-step PC Builder. We’ll check every part for compatibility along the way.</p><div className="builder-features"><span><Check size={15}/> Smart compatibility checks</span><span><Check size={15}/> Live build total</span></div><button className="button-primary" onClick={()=>setBuilder(true)}>Start your build <ArrowRight size={16}/></button><div className="builder-note"><Sparkles size={13}/> Even beginners build like pros.</div></div></section>
        <section className="newsletter"><div className="newsletter-mark"><Zap size={24}/></div><div><div className="eyebrow">THE GOOD STUFF, OCCASIONALLY</div><h2>First dibs. <em>No noise.</em></h2><p>New arrivals, builder tips, and the occasional very good deal.</p></div><form className="newsletter-form" onSubmit={e=>{e.preventDefault();setToast('You’re on the list. Welcome aboard!');setTimeout(()=>setToast(''),2500);e.target.reset()}}><input type="email" required placeholder="Your email address" aria-label="Your email address"/><button type="submit" aria-label="Subscribe"><ArrowRight size={18}/></button><small>No spam. Unsubscribe any time.</small></form><div className="newsletter-star">✳</div></section>
      </>}
    </main>
    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Zap size={19} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a><p>Good gear makes good things happen.</p><div className="footer-links"><a href="#products">Shop</a><a href="#categories">Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true)}}>PC Builder</a><a href="mailto:hello@techparts.in">Contact</a></div><span className="copyright">© 2025 TechParts India</span></footer>
    {drawer && <><button className="drawer-scrim" aria-label="Close bag" onClick={()=>setDrawer(false)}/><aside className="cart-drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR GOOD FINDS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={()=>setDrawer(false)} aria-label="Close"><X/></button></div>{cart.length ? <><div className="cart-items">{cart.map(item=><div className="cart-row" key={item.id}><img src={photo(item.image)} alt=""/><div className="cart-info"><b>{item.name}</b><small>{item.model}</small><div className="quantity"><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:Math.max(1,i.qty-1)}:i))}>−</button><span>{item.qty}</span><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i))}>+</button><button className="remove" onClick={()=>setCart(c=>c.filter(i=>i.id!==item.id))}>Remove</button></div></div><strong>{money(item.price*item.qty)}</strong></div>)}</div><div className="drawer-bottom"><div className="free-shipping"><Truck size={16}/>{cartTotal>=2000?'Your delivery is on us!':'Add '+money(2000-cartTotal)+' for free delivery'}</div><div className="subtotal"><span>Subtotal</span><b>{money(cartTotal)}</b></div><small>Shipping and applicable taxes are confirmed by the store.</small><button className="button-primary checkout" onClick={()=>{setDrawer(false);setCheckout('form')}}>Continue to checkout <ArrowRight size={16}/></button></div></> : <div className="cart-empty"><span className="cart-empty-icon"><ShoppingBag/></span><h3>A little room for good stuff.</h3><p>Your bag is waiting for something brilliant.</p><button className="button-primary" onClick={()=>setDrawer(false)}>Explore components <ArrowRight size={16}/></button></div>}</aside></>}
    {details && !details.compareView && <ProductDetails product={details} onClose={()=>setDetails(null)} onAdd={addToCart} saved={wishlist.some(item=>item.id===details.id)} onWishlist={()=>toggleWishlist(details)}/>}
    {showWishlist && <CollectionDialog title="Your saved gear" eyebrow="THE SHORTLIST" products={wishlist} empty="Nothing saved just yet." onClose={()=>setShowWishlist(false)} onAdd={addToCart} onRemove={toggleWishlist} onOpen={product=>{setShowWishlist(false);setDetails(product)}}/>}
    {compare.length>0 && <div className="compare-bar"><span><b>{compare.length}</b> of 3 products selected</span><button className="button-primary" onClick={()=>setDetails({compareView:true})}>Compare now <ArrowRight size={15}/></button><button className="compare-clear" onClick={()=>setCompare([])}>Clear</button></div>}
    {details?.compareView && <CompareDialog products={compare} onClose={()=>setDetails(null)} onAdd={addToCart}/>}
    {toast && <div className="toast"><span><Check size={15}/></span>{toast}</div>}
  </div>;
}

function ProductCard({product:p,onAdd,onDetails,onWishlist,onCompare,saved,compared}) {
  return <article className="product-card"><div className={`product-image ${p.color}`}><img src={photo(p.image)} alt={p.name} loading="lazy"/><span className="image-shade"/>{p.badge&&<span className="product-badge">{p.badge}</span>}<button className={saved?'wishlist liked':'wishlist'} onClick={()=>onWishlist(p)} aria-label={saved?'Remove from wishlist':'Add to wishlist'}><Heart size={16} fill={saved?'currentColor':'none'}/></button><button className="quick-add" onClick={()=>onAdd(p)}><span>Quick add</span><span className="quick-add-icon"><ShoppingBag size={15}/></span></button></div><div className="product-info"><div className="product-model">{p.category} <span>·</span> {p.model.split('·')[0]}</div><button className="product-title" onClick={()=>onDetails(p)}>{p.name}</button><div className="rating"><span>★</span> {p.rating} <small>({p.reviews})</small></div><div className="price-row"><b>{money(p.price)}</b><del>{money(p.old)}</del><span className="discount">{Math.round((1-p.price/p.old)*100)}% off</span></div><button className={compared?'compare-product selected':'compare-product'} onClick={()=>onCompare(p)}>{compared?<Check size={12}/>:<SlidersHorizontal size={12}/>} {compared?'Added to compare':'Compare'}</button></div></article>;
}

function ProductDetails({product:p,onClose,onAdd,saved,onWishlist}) {
  useEffect(()=>{function onKey(e){if(e.key==='Escape')onClose()}window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="product-modal" role="dialog" aria-modal="true" aria-label={`${p.name} details`}><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button><div className={`detail-image ${p.color}`}><img src={photo(p.image)} alt={p.name}/>{p.badge&&<span className="product-badge">{p.badge}</span>}</div><div className="detail-copy"><span className="eyebrow"><span className="eyebrow-line"/>{p.category.toUpperCase()}</span><h2>{p.name}</h2><p className="detail-model">{p.model}</p><div className="rating"><span>★</span> {p.rating} <small>({p.reviews} reviews)</small></div><div className="detail-price"><b>{money(p.price)}</b><del>{money(p.old)}</del><span className="discount">{Math.round((1-p.price/p.old)*100)}% off</span></div><p className="detail-description">A community favorite, selected for dependable everyday performance and backed by our genuine product guarantee.</p><div className="detail-points"><span><Check size={14}/> Authorized product</span><span><Truck size={14}/> Free delivery over ₹2,000</span><span><ShieldCheck size={14}/> 7-day easy returns</span></div><div className="detail-actions"><button className="button-primary" onClick={()=>onAdd(p)}>Add to bag <ShoppingBag size={15}/></button><button className={saved?'detail-save saved':'detail-save'} onClick={onWishlist}><Heart size={16} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save for later'}</button></div><small className="demo-note">Demo catalogue item · final specs and availability to be confirmed</small></div></section></div>;
}

function CollectionDialog({title,eyebrow,products:items,empty,onClose,onAdd,onRemove,onOpen}) {
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="collection-modal" role="dialog" aria-modal="true" aria-label={title}><div className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title} <span>({items.length})</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div>{items.length?<div className="collection-list">{items.map(p=><div className="collection-row" key={p.id}><button className="collection-open" onClick={()=>onOpen(p)}><img src={photo(p.image)} alt=""/><span><b>{p.name}</b><small>{p.model}</small></span></button><b>{money(p.price)}</b><button className="icon-button" onClick={()=>onRemove(p)} aria-label={`Remove ${p.name}`}><X size={16}/></button><button className="button-primary mini-add" onClick={()=>onAdd(p)}>Add</button></div>)}</div>:<div className="cart-empty"><span className="cart-empty-icon"><Heart/></span><h3>{empty}</h3><p>Tap the heart on a product to keep it close.</p><button className="button-primary" onClick={onClose}>Keep browsing <ArrowRight size={16}/></button></div>}</section></div>;
}

function CompareDialog({products:items,onClose,onAdd}) {
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="compare-modal" role="dialog" aria-modal="true" aria-label="Compare components"><div className="drawer-head"><div><span className="eyebrow">SIDE BY SIDE</span><h2>Find your fit <span>({items.length})</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div><div className="compare-table" style={{'--compare-columns':items.length}}><div className="compare-label"></div>{items.map(p=><div className="compare-item" key={p.id}><img src={photo(p.image)} alt=""/><b>{p.name}</b><small>{p.model}</small><strong>{money(p.price)}</strong><button className="button-primary" onClick={()=>onAdd(p)}>Add to bag</button></div>)}<div className="compare-label">Category</div>{items.map(p=><div className="compare-value" key={p.id}>{p.category}</div>)}<div className="compare-label">Customer rating</div>{items.map(p=><div className="compare-value" key={p.id}><span className="star">★</span> {p.rating} ({p.reviews})</div>)}<div className="compare-label">Price</div>{items.map(p=><div className="compare-value" key={p.id}>{money(p.price)}</div>)}<div className="compare-label">Availability</div>{items.map(p=><div className="compare-value available" key={p.id}><Check size={13}/> Demo listing</div>)}</div><p className="demo-note">Comparison uses the available demo catalogue fields. Confirm product specifications before purchase.</p></section></div>;
}

function CheckoutPage({items,total,onBack,onPlace}) {
  const [payment,setPayment]=useState('upi');
  return <section className="checkout-page">
    <button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to your bag</button>
    <div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>JUST ONE MORE THING</div><h1>Delivery <em>details.</em></h1><p>This is a preview checkout. Nothing is charged or sent to a store.</p></div>
    <div className="checkout-layout"><form className="checkout-form" onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget).entries());onPlace({...values,payment})}}>
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
  return <section className="orders-page"><button className="back-link" onClick={onShop}><ChevronLeft size={16}/> Back to shop</button><div className="checkout-title"><div className="eyebrow"><span className="eyebrow-line"/>YOUR RECENT ACTIVITY</div><h1>Order <em>history.</em></h1><p>Preview orders saved in this browser. Sign-in and live tracking are not connected yet.</p></div>{orders.length?<div className="orders-list">{orders.map(order=><article className="order-card" key={order.number}><div className="order-card-head"><span><small>PREVIEW REFERENCE</small><b>{order.number}</b></span><span className="order-status"><span/> {order.status}</span></div><div className="order-card-items">{order.items.map(item=><div key={item.id}><img src={photo(item.image)} alt=""/><span><b>{item.name}</b><small>Qty {item.qty}</small></span></div>)}</div><div className="order-card-foot"><span>{new Date(order.createdAt).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'})}</span><b>{money(order.total)}</b></div></article>)}</div>:<div className="empty-state"><PackageCheck size={24}/><b>No orders yet</b><span>When you create an order preview, it will appear here.</span><button onClick={onShop}>Browse components</button></div>}<p className="storage-note">Order summaries stay in this browser only. Delivery details are not saved in order history.</p></section>;
}

function Builder({onBack,onAdd}) {
  const parts=[{category:'Processor',item:products[1]},{category:'Graphics Card',item:products[0]},{category:'Memory',item:products[2]},{category:'Storage',item:products[3]}];
  return <section className="builder-page"><button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to shop</button><div className="builder-page-head"><div className="eyebrow"><span className="eyebrow-line"/>YOUR BUILD, YOUR RULES</div><h1>Let’s build something <em>brilliant.</em></h1><p>Start with the essentials. Every component below is checked to work together.</p></div><div className="build-progress"><span className="progress-dot done"><Check size={12}/></span><span className="progress-line active"/><span className="progress-dot done">2</span><span className="progress-line"/><span className="progress-dot">3</span><span className="progress-line"/><span className="progress-dot">4</span><span className="progress-line"/><span className="progress-dot">5</span><div><b>4 of 5 parts selected</b><small>Looking good so far</small></div></div><div className="build-layout"><div className="build-list">{parts.map(({category,item},i)=><div className="build-row" key={category}><span className="build-number">0{i+1}</span><div className="build-part-icon"><Cpu size={18}/></div><div className="build-part"><b>{category}</b><small>{item.name} · {item.model}</small></div><span className="compatible"><Check size={13}/> Compatible</span><b className="build-price">{money(item.price)}</b><button className="icon-button" aria-label={`Remove ${category}`}><X size={16}/></button></div>)}<button className="add-part"><span>+</span> Add a case, power supply, or cooling</button></div><aside className="build-summary"><span className="eyebrow">YOUR BUILD</span><h3>It’s coming together.</h3><div className="summary-line"><span>4 components</span><b>{money(products[1].price+products[0].price+products[2].price+products[3].price)}</b></div><div className="summary-compat"><span><Check size={15}/></span><div><b>All parts play nicely</b><small>Our compatibility check found no issues.</small></div></div><button className="button-primary" onClick={()=>{parts.forEach(x=>onAdd(x.item));onBack()}}>Add build to bag <ArrowRight size={16}/></button><small className="summary-note"><ShieldCheck size={13}/> Free compatibility check included</small></aside></div></section>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
