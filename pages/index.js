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
    else if (isSignUp) setAuthError('✅ Check your email to confirm!');
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

  function fmt(m) {
    if (!m) return '—';
    return m >= 60 ? `${Math.floor(m/60)}h${m%60>0?' '+m%60+'m':''}` : `${m}m`;
  }

  const COLORS = { Italian:'#e8401c', Japanese:'#2563eb', Indian:'#f5a800', Thai:'#2d7a4f', Chinese:'#e8401c', French:'#7c3aed', Default:'#6b4f2a' };
  const cc = (c) => COLORS[c] || COLORS.Default;

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.title?.toLowerCase().includes(q)) && (filter === 'All' || r.source_type === filter);
  });

  if (!user) return (
    <div style={{ minHeight:'100vh', background:'#fffbf5', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'sans-serif' }}>
