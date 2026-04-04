import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function Home() {
  const [user, setUser] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
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
  const [sourceFilter, setSourceFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [managingCats, setManagingCats] = useState(false);
  const [newCat, setNewCat] = useState({ name:'', emoji:'🏷', color:'#e8401c' });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStage, setVoiceStage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); loadRecipes(); loadCategories(); }
    });
    supabase.auth.onAuthStateChange((_, session) => {
      if (session) { setUser(session.user); loadRecipes(); loadCategories(); }
      else setUser(null);
    });
  }, []);

  async function loadRecipes() {
    const { data } = await supabase.from('recipes').select('*').order('clipped_at', { ascending: false });
    if (data) setRecipes(data);
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('created_at');
    if (data) setCategories(data);
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
    setRecipes([]); setCategories([]);
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
        body: JSON.stringify({ userContent, originalUrl: input.trim() }),
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
        is_favourite: false, category_ids: [],
        clipped_at: new Date().toISOString(),
      }]).select();
      if (data) { setRecipes(p => [data[0], ...p]); setSelected(norm(data[0])); setInput(''); }
    } catch(e) { alert('Could not clip. Try pasting the recipe text directly!'); }
    setLoading(false); setStage('');
  }

  async function createManualRecipe() {
    setShowAddMenu(false);
    const { data } = await supabase.from('recipes').insert([{
      user_id: user.id,
      title: 'My Recipe',
      image: '🍽️',
      ingredients: [],
      steps: [],
      tags: [],
      category_ids: [],
      is_favourite: false,
      source_type: 'text',
      clipped_at: new Date().toISOString(),
    }]).select();
    if (data) {
      const nr = norm(data[0]);
      setRecipes(p => [data[0], ...p]);
      setSelected(nr);
      startEdit(nr);
    }
  }

  async function startVoiceEntry() {
    setShowAddMenu(false);
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice entry is not supported in this browser. Please try Chrome!');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    let transcript = '';
    setListening(true);
    setVoiceStage('🎤 Listening... speak your recipe now');
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript + ' ';
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceStage('');
      alert('Could not hear you. Please try again!');
    };
    recognition.onend = async () => {
      setListening(false);
      if (!transcript.trim()) { setVoiceStage(''); return; }
      setVoiceStage('🤖 AI is reading your recipe...');
      try {
        const res = await fetch('/api/clip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userContent: `Extract and structure this spoken recipe:\n\n${transcript}`, originalUrl: '' }),
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
          source_url: '', source_type: 'text',
          is_favourite: false, category_ids: [],
          clipped_at: new Date().toISOString(),
        }]).select();
        if (data) {
          const nr = norm(data[0]);
          setRecipes(p => [data[0], ...p]);
          setSelected(nr);
          startEdit(nr);
        }
      } catch(e) {
        alert('Could not extract recipe from voice. Please try again!');
      }
      setVoiceStage('');
    };
    window._activeRecognition = recognition;
    recognition.start();
  }

  function norm(r) {
    return { ...r, mealType: r.meal_type, prepTime: r.prep_time, cookTime: r.cook_time,
      totalTime: r.total_time, editorNote: r.editor_note, sourceUrl: r.source_url,
      sourceType: r.source_type, clippedAt: r.clipped_at,
      isFavourite: r.is_favourite, categoryIds: r.category_ids || [] };
  }

  async function toggleFavourite(e, recipe) {
    e.stopPropagation();
    const newVal = !recipe.is_favourite;
    await supabase.from('recipes').update({ is_favourite: newVal }).eq('id', recipe.id);
    setRecipes(p => p.map(r => r.id === recipe.id ? { ...r, is_favourite: newVal } : r));
    if (selected?.id === recipe.id) setSelected(p => ({ ...p, isFavourite: newVal }));
  }

  function startEdit(r) {
    setEditForm({
      title: r.title || '',
      image: r.image || '🍽️',
      editorNote: r.editorNote || '',
      ingredients: (r.ingredients || []).join('\n'),
      steps: (r.steps || []).join('\n'),
      tags: (r.tags || []).join(', '),
      categoryIds: r.categoryIds || [],
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    const updated = {
      title: editForm.title,
      image: editForm.image,
      editor_note: editForm.editorNote,
      ingredients: editForm.ingredients.split('\n').map(s => s.trim()).filter(Boolean),
      steps: editForm.steps.split('\n').map(s => s.trim()).filter(Boolean),
      tags: editForm.tags.split(',').map(s => s.trim()).filter(Boolean),
      category_ids: editForm.categoryIds,
    };
    const { data } = await supabase.from('recipes').update(updated).eq('id', selected.id).select();
    if (data) {
      setRecipes(p => p.map(r => r.id === selected.id ? data[0] : r));
      setSelected(norm(data[0]));
    }
    setSaving(false);
    setEditing(false);
  }

  async function addCategory() {
    if (!newCat.name.trim()) return;
    const { data } = await supabase.from('categories').insert([{
      user_id: user.id, name: newCat.name, emoji: newCat.emoji, color: newCat.color
    }]).select();
    if (data) { setCategories(p => [...p, data[0]]); setNewCat({ name:'', emoji:'🏷', color:'#e8401c' }); }
  }

  async function deleteCategory(id) {
    await supabase.from('categories').delete().eq('id', id);
    setCategories(p => p.filter(c => c.id !== id));
  }

  function toggleCatOnRecipe(catId) {
    setEditForm(p => ({
      ...p,
      categoryIds: p.categoryIds.includes(catId)
        ? p.categoryIds.filter(id => id !== catId)
        : [...p.categoryIds, catId]
    }));
  }

  function getCardColor(recipe) {
    if (recipe.category_ids?.length > 0) {
      const cat = categories.find(c => c.id === recipe.category_ids[0]);
      if (cat) return cat.color;
    }
    return '#e8d5b0';
  }

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title?.toLowerCase().includes(q);
    const matchSource = sourceFilter === 'All' || r.source_type === sourceFilter;
    const matchCat = catFilter === 'All'
      ? true
      : catFilter === 'favourites'
      ? r.is_favourite
      : (r.category_ids || []).includes(catFilter);
    return matchSearch && matchSource && matchCat;
  });

  if (!user) return (
    <div style={{ minHeight:'100vh', background:'#fffbf5', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Nunito, sans-serif', position:'relative', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;700;800;900&display=swap');
        @keyframes floatUp {
          0%   { transform: translateY(0px)   rotate(var(--r)); }
          50%  { transform: translateY(-16px) rotate(calc(var(--r) + 4deg)); }
          100% { transform: translateY(0px)   rotate(var(--r)); }
        }
        .lsticker {
          position: fixed;
          opacity: 0.15;
          user-select: none;
          pointer-events: none;
          animation: floatUp var(--dur) ease-in-out infinite;
          animation-delay: var(--delay);
        }
      `}</style>
      {[
        { s:'🍕', top:'4%',  left:'2%',   dur:'4.2s', delay:'0s',   size:32 },
        { s:'🌿', top:'22%', left:'1%',   dur:'5.1s', delay:'0.5s', size:28 },
        { s:'🧁', top:'45%', left:'2%',   dur:'3.8s', delay:'1s',   size:30 },
        { s:'🥐', top:'68%', left:'1%',   dur:'4.7s', delay:'1.5s', size:28 },
        { s:'🍜', top:'85%', left:'3%',   dur:'5.5s', delay:'0.3s', size:30 },
        { s:'🍋', top:'8%',  left:'14%',  dur:'4.4s', delay:'0.8s', size:26 },
        { s:'🥑', top:'30%', left:'12%',  dur:'5.8s', delay:'0.2s', size:28 },
        { s:'🫐', top:'55%', left:'13%',  dur:'4.1s', delay:'1.2s', size:26 },
        { s:'🍰', top:'78%', left:'11%',  dur:'5.3s', delay:'0.6s', size:28 },
        { s:'🍓', top:'5%',  left:'86%',  dur:'4.6s', delay:'0.4s', size:30 },
        { s:'🥦', top:'25%', left:'88%',  dur:'5.2s', delay:'1.1s', size:26 },
        { s:'🍄', top:'48%', left:'87%',  dur:'3.9s', delay:'0.7s', size:28 },
        { s:'🌽', top:'70%', left:'89%',  dur:'4.8s', delay:'1.3s', size:26 },
        { s:'🍇', top:'88%', left:'86%',  dur:'5.6s', delay:'0.9s', size:28 },
        { s:'🌶', top:'4%',  left:'95%',  dur:'4.3s', delay:'0.2s', size:28 },
        { s:'🧄', top:'28%', left:'94%',  dur:'5.0s', delay:'0.8s', size:26 },
        { s:'🥕', top:'52%', left:'95%',  dur:'4.5s', delay:'1.4s', size:28 },
        { s:'🫙', top:'75%', left:'94%',  dur:'5.7s', delay:'0.5s', size:26 },
        { s:'🍵', top:'92%', left:'95%',  dur:'4.2s', delay:'1.0s', size:28 },
      ].map((st, i) => (
        <div key={i} className="lsticker" style={{
          top: st.top, left: st.left,
          fontSize: st.size,
          '--dur': st.dur,
          '--delay': st.delay,
          '--r': `${(i % 2 === 0 ? 1 : -1) * (5 + (i % 4) * 3)}deg`,
        }}>{st.s}</div>
      ))}
      <div style={{ maxWidth:400, width:'100%', textAlign:'center', position:'relative', zIndex:1 }}>
        <div style={{ fontFamily:'Caveat, cursive', fontSize:48, marginBottom:8 }}>📌Snipp<span style={{color:'#e8401c'}}>Eat</span>🍴</div>
        <p style={{ color:'#a0896a', marginBottom:32, fontSize:15 }}>Your cozy recipe collection, forever yours.</p>
        <div style={{ background:'#fff', borderRadius:24, padding:28, border:'2px solid #ede4d4' }}>
          <h3 style={{ marginBottom:16, fontFamily:'Caveat, cursive', fontSize:22, fontWeight:700 }}>{isSignUp ? 'Create your recipe book' : 'Welcome back'}</h3>
          {authError && <p style={{ color:'#e8401c', fontSize:13, marginBottom:10 }}>{authError}</p>}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email"
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'2px solid #ede4d4', marginBottom:10, fontSize:14, boxSizing:'border-box', outline:'none', fontFamily:'Nunito, sans-serif' }}/>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'2px solid #ede4d4', marginBottom:14, fontSize:14, boxSizing:'border-box', outline:'none', fontFamily:'Nunito, sans-serif' }}/>
          <button onClick={handleAuth} style={{ width:'100%', padding:'13px', borderRadius:12, background:'#e8401c', border:'none', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', marginBottom:10, fontFamily:'Nunito, sans-serif' }}>
            {isSignUp ? 'Start My Recipe Book →' : 'Sign In →'}
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

  if (managingCats) return (
    <div style={{ fontFamily:'Nunito, sans-serif', maxWidth:660, margin:'0 auto', padding:'20px 20px 60px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;700;800;900&display=swap');`}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h2 style={{ fontFamily:'Caveat, cursive', fontSize:28, fontWeight:700, margin:0 }}>🏷 My Categories</h2>
        <button onClick={()=>setManagingCats(false)} style={{ padding:'8px 14px', borderRadius:10, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontWeight:800 }}>← Back</button>
      </div>
      <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', padding:'20px', marginBottom:16 }}>
        <p style={{ fontSize:12, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Create New Category</p>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input value={newCat.emoji} onChange={e=>setNewCat(p=>({...p,emoji:e.target.value}))}
            style={{ width:52, padding:'10px', borderRadius:10, border:'2px solid #ede4d4', fontSize:22, textAlign:'center', outline:'none' }}/>
          <input value={newCat.name} onChange={e=>setNewCat(p=>({...p,name:e.target.value}))}
            placeholder="Category name"
            style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:14, outline:'none', fontFamily:'Nunito, sans-serif' }}/>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14 }}>
          <span style={{ fontSize:13, color:'#a0896a', fontWeight:700 }}>Colour:</span>
          {['#e8401c','#f5a800','#2d7a4f','#2563eb','#7c3aed','#ec4899','#0891b2'].map(c=>(
            <div key={c} onClick={()=>setNewCat(p=>({...p,color:c}))}
              style={{ width:28, height:28, borderRadius:99, background:c, cursor:'pointer', border: newCat.color===c ? '3px solid #1a1008' : '3px solid transparent' }}/>
          ))}
          <input type="text" value={newCat.color} onChange={e=>setNewCat(p=>({...p,color:e.target.value}))}
            placeholder="#hex"
            style={{ width:72, padding:'6px 8px', borderRadius:8, border:'2px solid #ede4d4', fontSize:12, outline:'none', fontFamily:'Nunito, sans-serif' }}/>
        </div>
        <button onClick={addCategory}
          style={{ width:'100%', padding:'12px', borderRadius:12, background:'#e8401c', border:'none', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'Nunito, sans-serif' }}>
          + Add Category
        </button>
      </div>
      {categories.length === 0 ? (
        <p style={{ textAlign:'center', color:'#a0896a', padding:24 }}>No categories yet. Create one above!</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {categories.map(c=>(
            <div key={c.id} style={{ background:'#fff', borderRadius:14, border:'2px solid #ede4d4', padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:14, height:14, borderRadius:99, background:c.color, flexShrink:0 }}/>
              <span style={{ fontSize:20 }}>{c.emoji}</span>
              <span style={{ fontWeight:800, flex:1 }}>{c.name}</span>
              <button onClick={()=>deleteCategory(c.id)}
                style={{ background:'#fef2f2', border:'2px solid #fca5a5', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'#e8401c', fontWeight:800, fontSize:12 }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (selected) {
    const r = selected;
    const cardColor = getCardColor(r);

    if (editing) return (
      <div style={{ fontFamily:'Nunito, sans-serif', maxWidth:660, margin:'0 auto', padding:'20px 20px 60px' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;700;800;900&display=swap');`}</style>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <button onClick={()=>setEditing(false)} style={{ padding:'8px 14px', borderRadius:10, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontWeight:800 }}>✕ Cancel</button>
          <button onClick={saveEdit} disabled={saving} style={{ padding:'8px 20px', borderRadius:10, background:'#e8401c', border:'none', color:'#fff', cursor:'pointer', fontWeight:800 }}>
            {saving ? 'Saving...' : '✓ Save'}
          </button>
        </div>
        <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', padding:'20px', marginBottom:14 }}>
          <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Emoji</label>
          <input value={editForm.image} onChange={e=>setEditForm(p=>({...p,image:e.target.value}))}
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:32, textAlign:'center', outline:'none', boxSizing:'border-box', marginBottom:10 }}/>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
            {['🍕','🌮','🍜','🍝','🥘','🍛','🍲','🥗','🍱','🥙','🫔','🍣','🥟','🧆','🍳','🥞','🧇','🥓','🍗','🥩','🍖','🌯','🥪','🧀','🥚','🍙','🍚','🍢','🍡','🧁','🎂','🍰','🍩','🍪','🍫','🍬','🍭','🍮','🍨','🍦','🥧','🍧','🥤','🍵','☕','🫖','🧃','🥛','🍺','🍷','🥂','🍾','🥑','🍅','🥦','🥕','🌽','🧄','🧅','🍄','🫑','🥒','🍆','🌶','🫛','🥜','🫘','🍞','🥐','🥖','🫓','🥨','🥯','🧈'].map(em=>(
              <div key={em} onClick={()=>setEditForm(p=>({...p,image:em}))}
                style={{ width:36, height:36, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, cursor:'pointer', background: editForm.image===em ? '#fef0ec' : '#fff8ee', border: editForm.image===em ? '2px solid #e8401c' : '2px solid #ede4d4', transition:'transform 0.1s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'}
                onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                {em}
              </div>
            ))}
          </div>
          <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Title</label>
          <input value={editForm.title} onChange={e=>setEditForm(p=>({...p,title:e.target.value}))}
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:15, fontWeight:700, outline:'none', boxSizing:'border-box', marginBottom:16, fontFamily:'Nunito, sans-serif' }}/>
          <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Tags (comma separated)</label>
          <input value={editForm.tags} onChange={e=>setEditForm(p=>({...p,tags:e.target.value}))}
            placeholder="e.g. Spicy, Quick, Comfort Food"
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:16, fontFamily:'Nunito, sans-serif' }}/>
          <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Note</label>
          <input value={editForm.editorNote} onChange={e=>setEditForm(p=>({...p,editorNote:e.target.value}))}
            placeholder="A tip or note about this recipe"
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:16, fontFamily:'Nunito, sans-serif' }}/>
          {categories.length > 0 && (
            <>
              <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:8 }}>Categories</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {categories.map(c=>{
                  const active = editForm.categoryIds.includes(c.id);
                  return (
                    <div key={c.id} onClick={()=>toggleCatOnRecipe(c.id)}
                      style={{ padding:'6px 12px', borderRadius:99, cursor:'pointer', fontSize:13, fontWeight:800,
                        background: active ? c.color : '#fff8ee',
                        color: active ? '#fff' : '#6b4f2a',
                        border: `2px solid ${active ? c.color : '#ede4d4'}` }}>
                      {c.emoji} {c.name}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', padding:'20px', marginBottom:14 }}>
          <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Ingredients (one per line)</label>
          <textarea value={editForm.ingredients} onChange={e=>setEditForm(p=>({...p,ingredients:e.target.value}))} rows={8}
            placeholder="200g flour&#10;2 eggs&#10;1 cup milk"
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:14, lineHeight:1.7, resize:'vertical', outline:'none', boxSizing:'border-box', fontFamily:'Nunito, sans-serif' }}/>
        </div>
        <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', padding:'20px' }}>
          <label style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6 }}>Steps (one per line)</label>
          <textarea value={editForm.steps} onChange={e=>setEditForm(p=>({...p,steps:e.target.value}))} rows={8}
            placeholder="Mix the flour and eggs.&#10;Add milk gradually.&#10;Cook on medium heat."
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'2px solid #ede4d4', fontSize:14, lineHeight:1.7, resize:'vertical', outline:'none', boxSizing:'border-box', fontFamily:'Nunito, sans-serif' }}/>
        </div>
      </div>
    );

    return (
      <div style={{ fontFamily:'Nunito, sans-serif', maxWidth:660, margin:'0 auto', padding:'20px 20px 60px' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;700;800;900&display=swap');`}</style>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <button onClick={()=>{setSelected(null);setChecks({});setTab('ingredients');setEditing(false);}} style={{ padding:'8px 14px', borderRadius:10, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontWeight:800 }}>← Library</button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={(e)=>toggleFavourite(e, r)} style={{ padding:'8px 14px', borderRadius:10, background: r.isFavourite ? '#fef9c3' : '#fff8ee', border: r.isFavourite ? '2px solid #fbbf24' : '2px solid #ede4d4', cursor:'pointer', fontSize:16 }}>
              {r.isFavourite ? '⭐' : '☆'}
            </button>
            <button onClick={()=>startEdit(r)} style={{ padding:'8px 14px', borderRadius:10, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontWeight:800, fontSize:13 }}>✏️ Edit</button>
            {r.sourceUrl && (
              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding:'8px 14px', borderRadius:10, background:'#eff6ff', border:'2px solid #93c5fd', color:'#2563eb', textDecoration:'none', fontWeight:800, fontSize:13 }}>
                🔗 View Original
              </a>
            )}
          </div>
        </div>
        <div style={{ background:cardColor+'20', borderRadius:24, padding:'28px 24px', textAlign:'center', marginBottom:16, border:`2px solid ${cardColor}40`, position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:5, background:cardColor, borderRadius:'24px 24px 0 0' }}/>
          <div style={{ fontSize:72, marginBottom:12 }}>{r.image||'🍽️'}</div>
          <h1 style={{ fontFamily:'Caveat, cursive', fontSize:32, fontWeight:700, marginBottom:12, color:'#1a1008' }}>{r.title}</h1>
          <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap', marginBottom:10 }}>
            {(r.tags||[]).filter(t=>t && t!=='Unknown' && t!=='None').map(t=>(
              <span key={t} style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:800, background:cardColor+'30', color:'#6b4f2a', border:`1.5px solid ${cardColor}50` }}>{t}</span>
            ))}
            {(r.categoryIds||[]).map(cid=>{
              const cat = categories.find(c=>c.id===cid);
              if (!cat) return null;
              return <span key={cid} style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:800, background:cat.color, color:'#fff' }}>{cat.emoji} {cat.name}</span>;
            })}
          </div>
          {r.editorNote && <div style={{ background:'#fff', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#6b4f2a', fontStyle:'italic', marginTop:10, border:'1.5px solid #ede4d4' }}>💡 {r.editorNote}</div>}
        </div>
        <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', overflow:'hidden' }}>
          <div style={{ display:'flex', background:'#fff8ee', borderBottom:'2px solid #ede4d4', padding:'6px 6px 0' }}>
            {['ingredients','steps'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'10px 0', background:tab===t?'#fff':'transparent', border:'none', cursor:'pointer', fontSize:13, fontWeight:900, color:tab===t?'#e8401c':'#a0896a', borderRadius:'10px 10px 0 0', textTransform:'capitalize', fontFamily:'Nunito, sans-serif' }}>{t}</button>
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
    <div style={{ fontFamily:'Nunito, sans-serif', background:'#fffbf5', minHeight:'100vh', position:'relative', overflow:'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;700;800;900&display=swap');`}</style>

      {[{s:'🍕',top:'12%',right:'1%',rot:'10deg'},{s:'🧁',top:'50%',right:'0%',rot:'-8deg'},{s:'🥕',top:'75%',right:'1%',rot:'5deg'},{s:'🍜',top:'30%',left:'0%',rot:'-10deg'}].map((st,i)=>(
        <div key={i} style={{ position:'fixed', top:st.top, left:st.left, right:st.right, fontSize:32, opacity:0.1, transform:`rotate(${st.rot})`, userSelect:'none', pointerEvents:'none', zIndex:0 }}>{st.s}</div>
      ))}

      {/* VOICE LISTENING OVERLAY */}
      {listening && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:24, padding:'40px 32px', textAlign:'center', maxWidth:360, width:'90%' }}>
            <div style={{ fontSize:64, marginBottom:16, animation:'pulse 1s infinite' }}>🎤</div>
            <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }`}</style>
            <h3 style={{ fontFamily:'Caveat, cursive', fontSize:24, fontWeight:700, marginBottom:8, color:'#1a1008' }}>Listening...</h3>
            <p style={{ color:'#a0896a', fontSize:14, marginBottom:24 }}>Speak your recipe clearly. I'll stop after 30 seconds.</p>
            <p style={{ fontSize:13, color:'#6b4f2a', fontWeight:700, marginBottom:20 }}>{voiceStage}</p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>{ try{ window._activeRecognition.stop(); }catch(e){} setListening(false); setVoiceStage(''); }}
                style={{ padding:'10px 20px', borderRadius:12, background:'#fef2f2', border:'2px solid #fca5a5', color:'#e8401c', fontWeight:800, cursor:'pointer', fontFamily:'Nunito, sans-serif' }}>
                ✕ Cancel
              </button>
              <button onClick={()=>{ try{ window._activeRecognition.stop(); }catch(e){} }}
                style={{ padding:'10px 20px', borderRadius:12, background:'#fff8ee', border:'2px solid #ede4d4', color:'#6b4f2a', fontWeight:800, cursor:'pointer', fontFamily:'Nunito, sans-serif' }}>
                ✓ Done
              </button>
              <button onClick={()=>{
                try{ window._activeRecognition.stop(); }catch(e){}
                setTimeout(()=>{ startVoiceEntry(); }, 500);
              }}
                style={{ padding:'10px 20px', borderRadius:12, background:'#eff6ff', border:'2px solid #93c5fd', color:'#2563eb', fontWeight:800, cursor:'pointer', fontFamily:'Nunito, sans-serif' }}>
                🔄 Redo
              </button>
            </div>
        </div>
        </div>
      )}

      {voiceStage && !listening && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:24, padding:'40px 32px', textAlign:'center', maxWidth:360, width:'90%' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🤖</div>
            <p style={{ fontSize:15, color:'#6b4f2a', fontWeight:700 }}>{voiceStage}</p>
          </div>
        </div>
      )}

      <nav style={{ background:'rgba(255,251,245,0.95)', backdropFilter:'blur(8px)', borderBottom:'2px solid #ede4d4', padding:'0 20px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <span style={{ fontFamily:'Caveat, cursive', fontSize:26, fontWeight:700, color:'#1a1008' }}>📌Snipp<span style={{color:'#e8401c'}}>Eat</span>🍴</span>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {recipes.length>0 && <span style={{ background:'#fef0ec', color:'#e8401c', borderRadius:99, padding:'3px 10px', fontSize:12, fontWeight:900 }}>{recipes.length} saved 🍴</span>}
          <button onClick={signOut} style={{ background:'#fff8ee', border:'2px solid #ede4d4', borderRadius:9, padding:'5px 10px', cursor:'pointer', fontSize:12, color:'#a0896a', fontWeight:800, fontFamily:'Nunito, sans-serif' }}>Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth:920, margin:'0 auto', padding:'24px 20px', position:'relative', zIndex:1 }}>

        {/* CLIP BOX */}
        <div style={{ background:'#fff', borderRadius:24, border:'2px solid #ede4d4', overflow:'hidden', marginBottom:16 }}>
          <div style={{ height:6, background:'linear-gradient(90deg,#e8401c,#f5a800,#2d7a4f,#2563eb)' }}/>
          <div style={{ padding:'22px 24px' }}>
            <h2 style={{ fontFamily:'Caveat, cursive', fontSize:24, fontWeight:700, marginBottom:4, color:'#1a1008' }}>✂️ Clip a Recipe</h2>
            <p style={{ color:'#a0896a', fontSize:13, marginBottom:14 }}>Paste a URL, YouTube link, or recipe text</p>
            <textarea value={input} onChange={e=>setInput(e.target.value)} rows={4}
              placeholder={"https://www.seriouseats.com/...\nhttps://youtube.com/watch?v=...\nor paste the full recipe text here"}
              style={{ width:'100%', padding:'13px 15px', borderRadius:14, background:'#fff8ee', border:'2px solid #ede4d4', color:'#1a1008', fontSize:14, lineHeight:1.7, resize:'none', outline:'none', boxSizing:'border-box', fontFamily:'Nunito, sans-serif' }}/>
            <button onClick={clipRecipe} disabled={loading||!input.trim()}
              style={{ marginTop:12, width:'100%', padding:'14px', borderRadius:14, border:'none', cursor:loading?'wait':'pointer', fontSize:15, fontWeight:900, background:loading?'#fff8ee':'#e8401c', color:loading?'#a0896a':'#fff', opacity:!input.trim()?0.5:1, fontFamily:'Nunito, sans-serif' }}>
              {loading ? `⏳ ${stage||'Clipping...'}` : '✂️ Clip this Recipe'}
            </button>
          </div>
        </div>

        {/* ADD MANUALLY — 3 OPTIONS */}
        {!showAddMenu ? (
          <button onClick={()=>setShowAddMenu(true)}
            style={{ width:'100%', padding:'13px', borderRadius:14, border:'2px dashed #ede4d4', background:'#fff8ee', color:'#6b4f2a', fontSize:14, fontWeight:800, cursor:'pointer', marginBottom:28, fontFamily:'Nunito, sans-serif' }}>
            ✏️ Add Recipe Manually
          </button>
        ) : (
          <div style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', padding:'20px', marginBottom:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <p style={{ fontFamily:'Caveat, cursive', fontSize:18, fontWeight:700, margin:0, color:'#1a1008' }}>How would you like to add?</p>
              <button onClick={()=>setShowAddMenu(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#a0896a' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <button onClick={createManualRecipe}
                style={{ padding:'16px 12px', borderRadius:14, border:'2px solid #ede4d4', background:'#fff8ee', cursor:'pointer', textAlign:'center', fontFamily:'Nunito, sans-serif' }}>
                <div style={{ fontSize:28, marginBottom:6 }}>✏️</div>
                <div style={{ fontWeight:800, fontSize:13, color:'#1a1008', marginBottom:2 }}>Text</div>
                <div style={{ fontSize:11, color:'#a0896a' }}>Type it in</div>
              </button>
              <button onClick={startVoiceEntry}
                style={{ padding:'16px 12px', borderRadius:14, border:'2px solid #ede4d4', background:'#fff8ee', cursor:'pointer', textAlign:'center', fontFamily:'Nunito, sans-serif' }}>
                <div style={{ fontSize:28, marginBottom:6 }}>🎤</div>
                <div style={{ fontWeight:800, fontSize:13, color:'#1a1008', marginBottom:2 }}>Voice</div>
                <div style={{ fontSize:11, color:'#a0896a' }}>Speak it out</div>
              </button>
              <button onClick={()=>alert('Photo entry coming soon! 📷')}
                style={{ padding:'16px 12px', borderRadius:14, border:'2px dashed #ede4d4', background:'#fffbf5', cursor:'pointer', textAlign:'center', fontFamily:'Nunito, sans-serif', opacity:0.7 }}>
                <div style={{ fontSize:28, marginBottom:6 }}>📷</div>
                <div style={{ fontWeight:800, fontSize:13, color:'#1a1008', marginBottom:2 }}>Photo</div>
                <div style={{ fontSize:11, color:'#a0896a' }}>Coming soon</div>
              </button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ fontFamily:'Caveat, cursive', fontSize:28, fontWeight:700, margin:0, color:'#1a1008' }}>My Library 📚</h2>
          <button onClick={()=>setManagingCats(true)} style={{ padding:'7px 14px', borderRadius:10, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontSize:12, fontWeight:800, color:'#6b4f2a', fontFamily:'Nunito, sans-serif' }}>🏷 Categories</button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..."
            style={{ flex:1, minWidth:160, padding:'9px 12px', borderRadius:12, border:'2px solid #ede4d4', background:'#fff', fontSize:13, outline:'none', fontFamily:'Nunito, sans-serif' }}/>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase' }}>Source:</span>
          {[['All','All'],['website','🌐 Web'],['youtube','▶️ YouTube'],['text','📋 Manual']].map(([val,label])=>(
            <button key={val} onClick={()=>setSourceFilter(val)} style={{ padding:'7px 14px', borderRadius:10, border:'2px solid #ede4d4', cursor:'pointer', fontSize:12, fontWeight:800, background:sourceFilter===val?'#e8401c':'#fff', color:sourceFilter===val?'#fff':'#a0896a', fontFamily:'Nunito, sans-serif' }}>{label}</button>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#a0896a', fontWeight:800, textTransform:'uppercase' }}>Filter:</span>
          <button onClick={()=>setCatFilter('All')} style={{ padding:'7px 14px', borderRadius:10, border:'2px solid #ede4d4', cursor:'pointer', fontSize:12, fontWeight:800, background:catFilter==='All'?'#e8401c':'#fff', color:catFilter==='All'?'#fff':'#a0896a', fontFamily:'Nunito, sans-serif' }}>All</button>
          <button onClick={()=>setCatFilter('favourites')} style={{ padding:'7px 14px', borderRadius:10, border:'2px solid #ede4d4', cursor:'pointer', fontSize:12, fontWeight:800, background:catFilter==='favourites'?'#fbbf24':'#fff', color:catFilter==='favourites'?'#fff':'#a0896a', fontFamily:'Nunito, sans-serif' }}>⭐ Favourites</button>
          {categories.map(c=>(
            <button key={c.id} onClick={()=>setCatFilter(c.id)} style={{ padding:'7px 14px', borderRadius:10, border:`2px solid ${catFilter===c.id ? c.color : '#ede4d4'}`, cursor:'pointer', fontSize:12, fontWeight:800, background:catFilter===c.id?c.color:'#fff', color:catFilter===c.id?'#fff':'#6b4f2a', fontFamily:'Nunito, sans-serif' }}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        {filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px' }}>
            <div style={{ fontSize:64, marginBottom:14 }}>📂</div>
            <h3 style={{ fontFamily:'Caveat, cursive', fontSize:24, fontWeight:700, marginBottom:8, color:'#1a1008' }}>Nothing here yet!</h3>
            <p style={{ color:'#a0896a', fontSize:14 }}>Paste a recipe URL or text above to get started 👆</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
            {filtered.map(r => {
              const nr = norm(r);
              const cardCol = getCardColor(r);
              return (
                <div key={r.id} onClick={()=>setSelected(nr)} style={{ background:'#fff', borderRadius:20, border:'2px solid #ede4d4', overflow:'hidden', cursor:'pointer', transition:'all 0.2s', position:'relative' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  <div style={{ height:100, display:'flex', alignItems:'center', justifyContent:'center', fontSize:48, background:cardCol+'18', position:'relative' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:cardCol }}/>
                    {nr.image||'🍽️'}
                    <button onClick={(e)=>toggleFavourite(e,r)}
                      style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.9)', border:'none', borderRadius:99, width:28, height:28, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {r.is_favourite ? '⭐' : '☆'}
                    </button>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <h3 style={{ fontFamily:'Caveat, cursive', fontSize:17, fontWeight:700, margin:'0 0 4px', lineHeight:1.3, color:'#1a1008' }}>{nr.title}</h3>
                    {(nr.categoryIds||[]).length > 0 && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                        {nr.categoryIds.map(cid=>{
                          const cat = categories.find(c=>c.id===cid);
                          if (!cat) return null;
                          return <span key={cid} style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:99, background:cat.color, color:'#fff', fontFamily:'Nunito, sans-serif' }}>{cat.emoji} {cat.name}</span>;
                        })}
                      </div>
                    )}
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
