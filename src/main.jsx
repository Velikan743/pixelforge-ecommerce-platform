import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Cpu, Gamepad2, Headphones, Heart, Menu, Moon, Monitor, PackageCheck, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Truck, X, Zap } from 'lucide-react';
import { products } from './product-data.js';
import './styles.css';

const categories = [
  { name: 'Graphics Cards', short: 'GPUs', icon: Gamepad2, count: '42 products' },
  { name: 'Processors', short: 'Processors', icon: Cpu, count: '36 products' },
  { name: 'Memory', short: 'Memory', icon: Zap, count: '28 products' },
  { name: 'Monitors', short: 'Monitors', icon: Monitor, count: '19 products' },
  { name: 'Peripherals', short: 'Peripherals', icon: Headphones, count: '54 products' },
];
const money = n => '₹' + n.toLocaleString('en-IN');
const photo = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=720&q=82`;

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('techparts-theme') === 'dark');
  const [active, setActive] = useState('All components');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Featured');
  const [cart, setCart] = useState([]);
  const [catalog, setCatalog] = useState(products);
  const [drawer, setDrawer] = useState(false);
  const [builder, setBuilder] = useState(false);
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

  return <div className={dark ? 'app dark' : 'app'}>
    <div className="announcement"><span><Sparkles size={13}/> THE COMPONENTS YOU WANT, AT PRICES YOU’LL LOVE</span><a href="#products">See what’s new <ArrowRight size={13}/></a></div>
    <header className="header">
      <a className="brand" href="#home" aria-label="TechParts home"><span className="brand-mark"><Zap size={20} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a>
      <nav className={mobileMenu ? 'nav open' : 'nav'}><a className="nav-active" href="#products" onClick={()=>setMobileMenu(false)}>Shop</a><a href="#categories" onClick={()=>setMobileMenu(false)}>Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true);setMobileMenu(false)}}>PC Builder <span className="new-pill">NEW</span></a><a href="#deals" onClick={()=>setMobileMenu(false)}>Deals</a></nav>
      <div className="header-actions"><label className="search-box"><Search size={17}/><input aria-label="Search products" placeholder="Search components..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><button className="icon-button theme-button" aria-label="Toggle theme" onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="bag-button" onClick={()=>setDrawer(true)} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={19}/><span>Bag</span><b>{cartCount}</b></button><button className="icon-button menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button></div>
    </header>
    <main>
      {builder ? <Builder onBack={()=>setBuilder(false)} onAdd={addToCart}/> : <>
        <section className="hero" id="home">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/>THE NEXT LEVEL STARTS HERE</div><h1>Your setup.<br/>Your <em>story.</em></h1><p>Thoughtful gear for the way you play, create, and work. Find your next favorite piece.</p><div className="hero-buttons"><a className="button-primary" href="#products">Explore components <ArrowRight size={16}/></a><button className="button-text" onClick={()=>setBuilder(true)}>Build your PC <ArrowUpRight size={15}/></button></div><div className="hero-proof"><div className="avatars"><span>R</span><span>A</span><span>K</span><span>+</span></div><div><strong>Loved by 12,000+ builders</strong><small>★★★★★ <span>4.9 / 5 average rating</span></small></div></div></div>
          <div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-glow"/><div className="hero-product"><img src={photo('photo-1587202372775-e229f172b9d7')} alt="High-performance graphics card"/><span className="floating-tag tag-top"><span className="tag-dot"/>NEW DROP <strong>RTX 50 SERIES</strong></span><span className="floating-tag tag-bottom"><span className="tag-icon"><Zap size={17}/></span><span>Built for more<small>Make every frame count</small></span><ArrowUpRight size={17}/></span></div><div className="hero-scribble">MAKE<br/>IT YOURS<span>↗</span></div><span className="hero-index">01 / 04</span></div>
        </section>
        <section className="trust-strip" aria-label="Shopping benefits"><div><Truck/><span><b>Free delivery</b><small>on orders over ₹2,000</small></span></div><div><ShieldCheck/><span><b>Genuine gear</b><small>100% authorized products</small></span></div><div><PackageCheck/><span><b>Easy returns</b><small>7-day return window</small></span></div><div><Heart/><span><b>Here to help</b><small>Real humans, always</small></span></div></section>
        <section className="categories-section section" id="categories"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>FIND YOUR THING</div><h2>Browse by <em>category.</em></h2></div><a className="subtle-link" href="#products">All categories <ArrowRight size={15}/></a></div><div className="category-grid">{categories.map(({name,short,icon:Icon,count},index)=><button key={name} className={`category-card cat-${index}`} onClick={()=>{setActive(name);document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}><span className="category-icon"><Icon size={22}/></span><span className="category-copy"><b>{short}</b><small>{count}</small></span><ArrowUpRight className="category-arrow" size={17}/><span className="category-art">{index===0?'RTX':index===1?'Ryzen':index===2?'DDR5':index===3?'240Hz':'PRO'}</span></button>)}</div></section>
        <section className="products-section section" id="products"><div className="section-heading product-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>GOOD GEAR, GREAT DAYS</div><h2>Made for your <em>next.</em></h2><p>A few community favorites to get you started.</p></div><a className="subtle-link desktop-link" href="#products">Explore the shop <ArrowRight size={15}/></a></div>
          <div className="product-toolbar"><div className="filter-tabs"><button className={active==='All components'?'selected':''} onClick={()=>setActive('All components')}>Everything <span>08</span></button>{['Graphics Cards','Processors','Memory','Storage'].map(c=><button key={c} className={active===c?'selected':''} onClick={()=>setActive(c)}>{c}</button>)}</div><label className="sort-control"><SlidersHorizontal size={15}/><span>Sort:</span><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort products"><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option></select><ChevronDown size={14}/></label></div>
          {visibleProducts.length ? <div className="product-grid">{visibleProducts.map(p=><ProductCard key={p.id} product={p} onAdd={addToCart}/>)}</div> : <div className="empty-state"><Search/><b>No components found</b><span>Try another search or browse everything.</span><button onClick={()=>{setQuery('');setActive('All components')}}>Clear filters</button></div>}
          <a className="mobile-all subtle-link" href="#products">Explore the shop <ArrowRight size={15}/></a>
        </section>
        <section className="builder-banner section" id="builder"><div className="builder-graphic"><div className="builder-ring"/><div className="builder-chip"><Cpu size={48}/><span>AM5</span></div><div className="builder-node node-one">GPU <b>✓</b></div><div className="builder-node node-two">RAM <b>✓</b></div><div className="builder-node node-three">CPU <b>✓</b></div><div className="builder-mini">BUILD<br/>01</div></div><div className="builder-copy"><div className="eyebrow"><span className="eyebrow-line"/>A LITTLE HELP, A LOT OF POWER</div><h2>Big ideas.<br/><em>Zero guesswork.</em></h2><p>Build your dream setup with our step-by-step PC Builder. We’ll check every part for compatibility along the way.</p><div className="builder-features"><span><Check size={15}/> Smart compatibility checks</span><span><Check size={15}/> Live build total</span></div><button className="button-primary" onClick={()=>setBuilder(true)}>Start your build <ArrowRight size={16}/></button><div className="builder-note"><Sparkles size={13}/> Even beginners build like pros.</div></div></section>
        <section className="newsletter"><div className="newsletter-mark"><Zap size={24}/></div><div><div className="eyebrow">THE GOOD STUFF, OCCASIONALLY</div><h2>First dibs. <em>No noise.</em></h2><p>New arrivals, builder tips, and the occasional very good deal.</p></div><form className="newsletter-form" onSubmit={e=>{e.preventDefault();setToast('You’re on the list. Welcome aboard!');setTimeout(()=>setToast(''),2500);e.target.reset()}}><input type="email" required placeholder="Your email address" aria-label="Your email address"/><button type="submit" aria-label="Subscribe"><ArrowRight size={18}/></button><small>No spam. Unsubscribe any time.</small></form><div className="newsletter-star">✳</div></section>
      </>}
    </main>
    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><Zap size={19} fill="currentColor"/></span><span>tech<span>parts</span><small>BUILD BETTER</small></span></a><p>Good gear makes good things happen.</p><div className="footer-links"><a href="#products">Shop</a><a href="#categories">Categories</a><a href="#builder" onClick={e=>{e.preventDefault();setBuilder(true)}}>PC Builder</a><a href="mailto:hello@techparts.in">Contact</a></div><span className="copyright">© 2025 TechParts India</span></footer>
    {drawer && <><button className="drawer-scrim" aria-label="Close bag" onClick={()=>setDrawer(false)}/><aside className="cart-drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR GOOD FINDS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={()=>setDrawer(false)} aria-label="Close"><X/></button></div>{cart.length ? <><div className="cart-items">{cart.map(item=><div className="cart-row" key={item.id}><img src={photo(item.image)} alt=""/><div className="cart-info"><b>{item.name}</b><small>{item.model}</small><div className="quantity"><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:Math.max(1,i.qty-1)}:i))}>−</button><span>{item.qty}</span><button onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i))}>+</button><button className="remove" onClick={()=>setCart(c=>c.filter(i=>i.id!==item.id))}>Remove</button></div></div><strong>{money(item.price*item.qty)}</strong></div>)}</div><div className="drawer-bottom"><div className="free-shipping"><Truck size={16}/>{cartTotal>=2000?'Your delivery is on us!':'Add '+money(2000-cartTotal)+' for free delivery'}</div><div className="subtotal"><span>Subtotal</span><b>{money(cartTotal)}</b></div><small>Taxes included. Shipping calculated at checkout.</small><button className="button-primary checkout" onClick={()=>setToast('Checkout is coming soon')}>Continue to checkout <ArrowRight size={16}/></button></div></> : <div className="cart-empty"><span className="cart-empty-icon"><ShoppingBag/></span><h3>A little room for good stuff.</h3><p>Your bag is waiting for something brilliant.</p><button className="button-primary" onClick={()=>setDrawer(false)}>Explore components <ArrowRight size={16}/></button></div>}</aside></>}
    {toast && <div className="toast"><span><Check size={15}/></span>{toast}</div>}
  </div>;
}

function ProductCard({product:p,onAdd}) {
  const [liked,setLiked]=useState(false);
  return <article className="product-card"><div className={`product-image ${p.color}`}><img src={photo(p.image)} alt={p.name} loading="lazy"/><span className="image-shade"/>{p.badge&&<span className="product-badge">{p.badge}</span>}<button className={liked?'wishlist liked':'wishlist'} onClick={()=>setLiked(!liked)} aria-label={liked?'Remove from wishlist':'Add to wishlist'}><Heart size={16} fill={liked?'currentColor':'none'}/></button><button className="quick-add" onClick={()=>onAdd(p)}><span>Quick add</span><span className="quick-add-icon"><ShoppingBag size={15}/></span></button></div><div className="product-info"><div className="product-model">{p.category} <span>·</span> {p.model.split('·')[0]}</div><h3>{p.name}</h3><div className="rating"><span>★</span> {p.rating} <small>({p.reviews})</small></div><div className="price-row"><b>{money(p.price)}</b><del>{money(p.old)}</del><span className="discount">{Math.round((1-p.price/p.old)*100)}% off</span></div></div></article>;
}

function Builder({onBack,onAdd}) {
  const parts=[{category:'Processor',item:products[1]},{category:'Graphics Card',item:products[0]},{category:'Memory',item:products[2]},{category:'Storage',item:products[3]}];
  return <section className="builder-page"><button className="back-link" onClick={onBack}><ChevronLeft size={16}/> Back to shop</button><div className="builder-page-head"><div className="eyebrow"><span className="eyebrow-line"/>YOUR BUILD, YOUR RULES</div><h1>Let’s build something <em>brilliant.</em></h1><p>Start with the essentials. Every component below is checked to work together.</p></div><div className="build-progress"><span className="progress-dot done"><Check size={12}/></span><span className="progress-line active"/><span className="progress-dot done">2</span><span className="progress-line"/><span className="progress-dot">3</span><span className="progress-line"/><span className="progress-dot">4</span><span className="progress-line"/><span className="progress-dot">5</span><div><b>4 of 5 parts selected</b><small>Looking good so far</small></div></div><div className="build-layout"><div className="build-list">{parts.map(({category,item},i)=><div className="build-row" key={category}><span className="build-number">0{i+1}</span><div className="build-part-icon"><Cpu size={18}/></div><div className="build-part"><b>{category}</b><small>{item.name} · {item.model}</small></div><span className="compatible"><Check size={13}/> Compatible</span><b className="build-price">{money(item.price)}</b><button className="icon-button" aria-label={`Remove ${category}`}><X size={16}/></button></div>)}<button className="add-part"><span>+</span> Add a case, power supply, or cooling</button></div><aside className="build-summary"><span className="eyebrow">YOUR BUILD</span><h3>It’s coming together.</h3><div className="summary-line"><span>4 components</span><b>{money(products[1].price+products[0].price+products[2].price+products[3].price)}</b></div><div className="summary-compat"><span><Check size={15}/></span><div><b>All parts play nicely</b><small>Our compatibility check found no issues.</small></div></div><button className="button-primary" onClick={()=>{parts.forEach(x=>onAdd(x.item));onBack()}}>Add build to bag <ArrowRight size={16}/></button><small className="summary-note"><ShieldCheck size={13}/> Free compatibility check included</small></aside></div></section>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
