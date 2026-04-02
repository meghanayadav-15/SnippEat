import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function Home() {
  const [user, setUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [stage, setStage] = useState('');
  const [tab, setTab] = useState('ingredients');
  const [checks, setChecks] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); loadRecipes(); }
    });
    supabase.auth.onAuthStateChange((_, session) => {
      if (session) { setUser(session.user); loadRecipes(); }
      else setUser(null);
    });
  }, []);

  async function loadRecipes() {
    const { data } = await supabase.from('recipes').select('*').order('clipped_at', { ascending: false });
    if (data) setRecipes(data);
  }

  async function handleAuth() {
    setAuthError('');
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    else if (isSignUp) setAuthError('Check your email to confirm!');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRecipes([]);
  }

  function detectType(s) {
    if (/youtube\.com|youtu\.be/i.test(s)) return 'youtube';
    if (/^https?:\/\//i.test(s)) return 'url';
    if (s.length > 80) return 'text';
    return 'unknown';
  }

  async function clipRecipe() {
    if (!input.trim()) return;
    setLoading(true);
    const type = detectType(input);
    let userContent = '';
    if (type === 'youtube') {
      const m = input.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
      userContent = `YouTube recipe: ${input} ID: ${m?.[1]}. Extract recipe set sourceType youtube.`;
    } else if (type === 'url') {
      setStage('Fetching page...');
      let page = '';
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(input)}`);
        const json = await res.json();
        page = (json.contents || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
      } catch { page = `URL: ${input}`; }
      userContent = `Extract recipe from: ${input}\n\n${page}`;
    } else {
      userContent = `Extract and structure this recipe:\n\n${input}`;
    }
    setStage('AI is reading...');
    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userContent }),
      });
      const recipe = await res.json();
      if (recipe.error) throw new Error(recipe.error);
      const { data } = await supabase.from('recipes').insert([{
        user_id: user.id,
        title: recipe.title, cuisine: recipe.cuisine, meal_type: recipe.mealType,
        diet: recipe.diet, difficulty: recipe.difficulty,
        prep_time: recipe.prepTime, cook_time: recipe.cookTime, total_time: recipe.totalTime,
        servings: recipe.servings, calories: recipe.calories, image: recipe.image,
        tags: recipe.tags, ingredients: recipe.ingredients, steps: recipe.steps,
        nutrition: recipe.nutrition, editor_note: recipe.editorNote,
        source_url: recipe.sourceUrl, source_type: recipe.sourceType,
        clipped_at: new Date().toISOString(),
      }]).select();
      if (data) { setRecipes(p => [data[0], ...p]); setSelected(norm(data[0])); setInput(''); }
    } catch(e) { alert('Could not clip. Try pasting the recipe text directly!'); }
    setLoading(false); setStage('');
  }

  function norm(r) {
    return { ...r, mealType: r.meal_type, prepTime: r.prep_time, cookTime: r.cook_time,
      totalTime: r.total_time, editorNote: r.editor_note, sourceUrl: r.source_url,
      sourceType: r.source_type, clippedAt: r.clipped_at };
  }

  const COLORS = { Italian:'#e8401c', Japanese:'#2563eb', Indian:'#f5a800', Thai:'#2d7a4f', Chinese:'#e8401c', French:'#7c3aed', Default:'#6b4f2a' };
  const cc = (c) => COLORS[c] || COLORS.Default;

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.title?.toLowerCase().includes(q)) && (filter === 'All' || r.source_type === filter);
  });

  if (!user) return (
    <div style={{ minHeight:'100vh', background:'#fffbf5', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'sans-serif' }}>
      <div style={{ maxWidth:400, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>✂️</div>
        <h1 style={{ fontSize:32, fontWeight:900, marginBottom:8 }}>Snipp<span style={{color:'#e8401c'}}>Eat</span></h1>
        <p style={{ color:'#a0896a', marginBottom:32 }}>Clip any recipe from the web. Saved forever.</p>
        <div style={{ background:'#fff', borderRadius:20, padding:24, border:'2px solid #ede4d4' }}>
          <h3 style={{ marginBottom:16 }}>{isSignUp ? 'Create account' : 'Sign in'}</h3>
          {authError && <p style={{ color:'#e8401c', fontSize:13, marginBottom:10 }}>{authError}</p>}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email"
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'2px solid #ede4d4', marginBottom:10, fontSize:14, boxSizing:'border-box', outline:'none' }}/>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'2px solid #ede4d4', marginBottom:14, fontSize:14, boxSizing:'border-box', outline:'none' }}/>
          <button onClick={handleAuth} style={{ width:'100%', padding:'13px', borderRadius:12, background:'#e8401c', border:'none', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', marginBottom:10 }}>
            {isSignUp ? 'Sign Up →' : 'Sign In →'}
          </button>
          <p style={{ fontSize:13, color:'#a0896a' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <span onClick={()=>setIsSignUp(!isSignUp)} style={{ color:'#e8401c', cursor:'pointer', fontWeight:800 }}>
              {isSignUp ? 'Sign in' : 'Sign up free'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );

  if (selected) {
    const r = selected;
    const color = cc(r.cuisine);
    return (
      <div style={{ fontFamily:'sans-serif', maxWidth:660, margin:'0 auto', padding:'20px 20px 60px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <button onClick={()=>{setSelected(null);setChecks({});setTab('ingredients');}} style={{ padding:'8px 14px', borderRadius:10, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontWeight:800 }}>← Library</button>
          {r.sourceUrl && (
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
              style={{ padding:'8px 14px', borderRadius:10, background:'#eff6ff', border:'2px solid #93c5fd', color:'#2563eb', textDecoration:'none', fontWeight:800, fontSize:13 }}>
              🔗 View Original
            </a>
          )}
        </div>
        <div style={{ background:color+'15', borderRadius:24, padding:'28px 24px', textAlign:'center', marginBottom:16, border:`2px solid ${color}25`, position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:5, background:color, borderRadius:'24px 24px 0 0' }}/>
          <div style={{ fontSize:72, marginBottom:12 }}>{r.image||'🍽️'}</div>
          <h1 style={{ fontSize:24, fontWeight:900, marginBottom:12 }}>{r.title}</h1>
          <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap', marginBottom:10 }}>
            {[r.cuisine, r.mealType, r.diet!=='None'&&r.diet, r.difficulty].filter(Boolean).map(t=>(
              <span key={t} style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:800, background:color+'18', color, border:`1.5px solid ${color}30` }}>{t}</span>
            ))}
          </div>
          {r.editorNote && <div style={{ background:'#fff', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#6b4f2a', fontStyle:'italic', marginTop:10, border:'1.5px solid #ede4d4' }}>💡 {r.editorNote}</div>}
        </div>
        <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', overflow:'hidden' }}>
          <div style={{ display:'flex', background:'#fff8ee', borderBottom:'2px solid #ede4d4', padding:'6px 6px 0' }}>
            {['ingredients','steps','nutrition'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'10px 0', background:tab===t?'#fff':'transparent', border:'none', cursor:'pointer', fontSize:13, fontWeight:900, color:tab===t?'#e8401c':'#a0896a', borderRadius:'10px 10px 0 0', textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
          <div style={{ padding:'18px 20px' }}>
            {tab==='ingredients' && (r.ingredients||[]).map((ing,i)=>(
              <div key={i} onClick={()=>setChecks(p=>({...p,[i]:!p[i]}))} style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 0', borderBottom:i<r.ingredients.length-1?'1.5px solid #ede4d4':'none', cursor:'pointer' }}>
                <div style={{ width:20, height:20, borderRadius:6, border:`2.5px solid ${checks[i]?'#2d7a4f':'#ede4d4'}`, background:checks[i]?'#2d7a4f':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {checks[i]&&<span style={{ color:'#fff', fontSize:10, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontSize:14, color:checks[i]?'#a0896a':'#1a1008', textDecoration:checks[i]?'line-through':'none' }}>{ing}</span>
              </div>
            ))}
            {tab==='steps' && (r.steps||[]).map((s,i)=>(
              <div key={i} style={{ display:'flex', gap:12, marginBottom:14 }}>
                <div style={{ minWidth:28, height:28, borderRadius:9, background:'#e8401c', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff', flexShrink:0 }}>{i+1}</div>
                <p style={{ margin:0, fontSize:14, color:'#6b4f2a', lineHeight:1.8 }}>{s}</p>
              </div>
            ))}
            {tab==='nutrition' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                {Object.entries(r.nutrition||{}).map(([k,v],i)=>{
                  const cols=['#e8401c','#2d7a4f','#f5a800','#2563eb'];
                  return <div key={k} style={{ background:cols[i%4]+'12', borderRadius:14, padding:'14px 16px' }}>
                    <div style={{ fontSize:20, fontWeight:900 }}>{v}</div>
                    <div style={{ fontSize:11, color:'#a0896a', textTransform:'capitalize', marginTop:2 }}>{k}</div>
                  </div>;
                })}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop:16, padding:'12px 16px', borderRadius:14, background:'#fff8ee', border:'2px solid #ede4d4', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, color:'#a0896a', fontWeight:700 }}>
          <span>📎 {new Date(r.clippedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
          <button onClick={async()=>{ if(confirm('Remove?')){ await supabase.from('recipes').delete().eq('id',r.id); setRecipes(p=>p.filter(x=>x.id!==r.id)); setSelected(null); }}} style={{ background:'#fef2f2', border:'2px solid #fca5a5', borderRadius:9, padding:'5px 12px', cursor:'pointer', color:'#e8401c', fontWeight:800, fontSize:12 }}>🗑 Remove</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:'sans-serif', background:'#fffbf5', minHeight:'100vh' }}>
      <nav style={{ background:'#fff', borderBottom:'2px solid #ede4d4', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <span style={{ fontSize:20, fontWeight:900 }}>✂️ Snipp<span style={{color:'#e8401c'}}>Eat</span></span>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {recipes.length>0 && <span style={{ background:'#fef0ec', color:'#e8401c', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:900 }}>{recipes.length} saved 🍴</span>}
          <button onClick={signOut} style={{ background:'#fff8ee', border:'2px solid #ede4d4', borderRadius:9, padding:'5px 10px', cursor:'pointer', fontSize:12, color:'#a0896a', fontWeight:800 }}>Sign out</button>
        </div>
      </nav>
      <div style={{ maxWidth:920, margin:'0 auto', padding:'24px 20px' }}>
        <div style={{ background:'#fff', borderRadius:24, border:'2px solid #ede4d4', overflow:'hidden', marginBottom:28 }}>
          <div style={{ height:6, background:'linear-gradient(90deg,#e8401c,#f5a800,#2d7a4f,#2563eb)' }}/>
          <div style={{ padding:'22px 24px' }}>
            <h2 style={{ fontSize:20, fontWeight:900, marginBottom:4 }}>✂️ Clip a Recipe</h2>
            <p style={{ color:'#a0896a', fontSize:13, marginBottom:14 }}>Paste a URL, YouTube link, or recipe text</p>
            <textarea value={input} onChange={e=>setInput(e.target.value)} rows={4}
              placeholder={"https://www.seriouseats.com/...\nhttps://youtube.com/watch?v=...\nor paste the full recipe text here"}
              style={{ width:'100%', padding:'13px 15px', borderRadius:14, background:'#fff8ee', border:'2px solid #ede4d4', color:'#1a1008', fontSize:14, lineHeight:1.7, resize:'none', outline:'none', boxSizing:'border-box', fontFamily:'sans-serif' }}/>
            <button onClick={clipRecipe} disabled={loading||!input.trim()}
              style={{ marginTop:12, width:'100%', padding:'14px', borderRadius:14, border:'none', cursor:loading?'wait':'pointer', fontSize:15, fontWeight:900, background:loading?'#fff8ee':'#e8401c', color:loading?'#a0896a':'#fff', opacity:!input.trim()?0.5:1 }}>
              {loading ? `⏳ ${stage||'Clipping...'}` : '✂️ Clip this Recipe'}
            </button>
          </div>
        </div>
        <h2 style={{ fontSize:20, fontWeight:900, marginBottom:16 }}>My Library 📚</h2>
        {recipes.length>0 && (
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..."
              style={{ flex:1, minWidth:160, padding:'9px 12px', borderRadius:12, border:'2px solid #ede4d4', background:'#fff', fontSize:13, outline:'none' }}/>
            {['All','website','youtube','text'].map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{ padding:'8px 14px', borderRadius:10, border:'2px solid #ede4d4', cursor:'pointer', fontSize:12, fontWeight:800, background:filter===s?'#e8401c':'#fff', color:filter===s?'#fff':'#a0896a' }}>
                {{All:'All',website:'🌐',youtube:'▶️',text:'📋'}[s]}
              </button>
            ))}
          </div>
        )}
        {recipes.length===0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px' }}>
            <div style={{ fontSize:64, marginBottom:14 }}>📂</div>
            <h3 style={{ fontSize:20, fontWeight:900, marginBottom:8 }}>Nothing here yet!</h3>
            <p style={{ color:'#a0896a', fontSize:14 }}>Paste a recipe URL or text above to get started 👆</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
            {filtered.map(r => {
              const nr = norm(r);
              const color = cc(nr.cuisine);
              return (
                <div key={r.id} onClick={()=>setSelected(nr)} style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', overflow:'hidden', cursor:'pointer', transition:'all 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <div style={{ height:100, display:'flex', alignItems:'center', justifyContent:'center', fontSize:48, background:color+'12', position:'relative' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:color }}/>
                    {nr.image||'🍽️'}
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <h3 style={{ fontSize:14, fontWeight:800, margin:'0 0 7px', lineHeight:1.3 }}>{nr.title}</h3>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

