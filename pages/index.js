import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Landing() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  async function tryRecipe() {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const res = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userContent: input.trim(), originalUrl: input.trim() }),
      });
      const recipe = await res.json();
      if (recipe.error) throw new Error(recipe.error);
      setPreview(recipe);
    } catch(e) {
      setError('Could not extract recipe. Try a different URL or paste the recipe text directly.');
    }
    setLoading(false);
  }

  const stickers = ['🍕','🌮','🧁','🥑','🍜','🫙','🍳','🥕','🍝','🧄'];

  return (
    <div style={{ minHeight:'100vh', background:'#fffbf5', fontFamily:'Nunito, sans-serif', position:'relative', overflow:'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@400;700;800;900&display=swap');
        .sticker { position:fixed; fontSize:32px; opacity:0.18; pointerEvents:none; userSelect:none; zIndex:0; }
        .feat-icon:hover { transform:scale(1.1); }
        .cta-btn:hover { transform:translateY(-2px); boxShadow:'0 8px 24px #e8401c44'; }
      `}</style>

      {/* SCATTERED STICKERS */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        {[
          {s:'🍕', top:'8%', left:'3%', rot:'-12deg', size:40},
          {s:'🌮', top:'15%', right:'4%', rot:'10deg', size:34},
          {s:'🧁', top:'42%', left:'1%', rot:'-7deg', size:36},
          {s:'🥑', top:'68%', right:'2%', rot:'14deg', size:32},
          {s:'🍜', top:'78%', left:'4%', rot:'-5deg', size:38},
          {s:'🫙', top:'30%', right:'2%', rot:'8deg', size:30},
          {s:'🍳', top:'55%', left:'2%', rot:'12deg', size:34},
          {s:'🧄', top:'90%', right:'5%', rot:'-9deg', size:30},
          {s:'🍝', top:'5%', right:'10%', rot:'5deg', size:28},
          {s:'🥕', top:'85%', left:'8%', rot:'-15deg', size:32},
        ].map((st,i)=>(
          <div key={i} style={{ position:'absolute', top:st.top, left:st.left, right:st.right, fontSize:st.size, opacity:0.15, transform:`rotate(${st.rot})`, userSelect:'none' }}>{st.s}</div>
        ))}
      </div>

      {/* NAV */}
      <nav style={{ background:'rgba(255,251,245,0.95)', backdropFilter:'blur(8px)', borderBottom:'2px solid #ede4d4', padding:'0 32px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <span style={{ fontFamily:'Caveat, cursive', fontSize:28, fontWeight:700, color:'#1a1008' }}>
          📌Snipp<span style={{color:'#e8401c'}}>Eat</span>🍴
        </span>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>router.push('/app')} style={{ padding:'9px 20px', borderRadius:12, background:'#fff8ee', border:'2px solid #ede4d4', cursor:'pointer', fontSize:13, fontWeight:800, color:'#6b4f2a', fontFamily:'Nunito, sans-serif' }}>Sign In</button>
          <button onClick={()=>router.push('/app')} style={{ padding:'9px 20px', borderRadius:12, background:'#e8401c', border:'none', cursor:'pointer', fontSize:13, fontWeight:800, color:'#fff', fontFamily:'Nunito, sans-serif' }}>Sign Up Free</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'64px 32px 48px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:56, alignItems:'start', position:'relative', zIndex:1 }}>

        {/* LEFT — COPY */}
        <div>
          <div style={{ display:'inline-block', background:'#fef0ec', borderRadius:99, padding:'6px 16px', fontSize:12, fontWeight:800, color:'#e8401c', marginBottom:24, border:'1.5px solid #fca5a5' }}>
            🍴 Free Forever — No Limits
          </div>
          <h1 style={{ fontFamily:'Caveat, cursive', fontSize:56, fontWeight:700, lineHeight:1.1, marginBottom:8, color:'#1a1008' }}>
            Are Your Recipes<br/><span style={{ color:'#e8401c' }}>Everywhere?</span>
          </h1>
          <p style={{ fontSize:16, color:'#6b4f2a', lineHeight:1.75, marginBottom:8, maxWidth:420, fontWeight:700 }}>
            One cozy place to save your recipes and organise them as you want.
          </p>
          <p style={{ fontSize:15, color:'#a0896a', lineHeight:1.75, marginBottom:36, maxWidth:420 }}>
            Free forever to fuel your passion for always experimenting in the kitchen.
          </p>
          <button onClick={()=>router.push('/app')}
            style={{ padding:'16px 32px', borderRadius:16, background:'#e8401c', border:'none', cursor:'pointer', fontSize:16, fontWeight:900, color:'#fff', marginBottom:48, fontFamily:'Nunito, sans-serif', transition:'all 0.2s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}>
            Treasure Every Recipe, Forever ❤️
          </button>

          {/* FEATURES */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              ['🌐', 'Clip from any website', 'Paste a URL and we extract the full recipe instantly'],
              ['▶️', 'Save from YouTube', 'Never lose a recipe from your favourite food channels'],
              ['✏️', 'Add your own', 'Type, speak or photograph your family recipes'],
              ['📂', 'Organise your way', 'Create your own categories with custom colours'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:42, height:42, borderRadius:12, background:'#fff', border:'2px solid #ede4d4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, transition:'transform 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:'#1a1008', marginBottom:2 }}>{title}</div>
                  <div style={{ fontSize:13, color:'#a0896a', lineHeight:1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — LIVE DEMO */}
        <div style={{ position:'sticky', top:84 }}>
          <div style={{ background:'#fff', borderRadius:24, border:'2px solid #ede4d4', overflow:'hidden', boxShadow:'0 4px 24px #e8d9b840' }}>
            <div style={{ height:6, background:'linear-gradient(90deg,#e8401c,#f5a800,#2d7a4f,#2563eb)' }}/>
            <div style={{ padding:'24px' }}>
              <h3 style={{ fontFamily:'Caveat, cursive', fontSize:22, fontWeight:700, marginBottom:4, color:'#1a1008' }}>✂️ Try it right now</h3>
              <p style={{ color:'#a0896a', fontSize:13, marginBottom:14 }}>Paste any recipe URL or YouTube link below</p>
              <textarea value={input} onChange={e=>setInput(e.target.value)} rows={3}
                placeholder={"https://www.seriouseats.com/...\nhttps://youtube.com/watch?v=..."}
                style={{ width:'100%', padding:'12px 14px', borderRadius:12, background:'#fff8ee', border:'2px solid #ede4d4', color:'#1a1008', fontSize:14, lineHeight:1.6, resize:'none', outline:'none', boxSizing:'border-box', fontFamily:'Nunito, sans-serif' }}/>
              <button onClick={tryRecipe} disabled={loading||!input.trim()}
                style={{ marginTop:10, width:'100%', padding:'13px', borderRadius:12, border:'none', cursor:loading?'wait':'pointer', fontSize:14, fontWeight:900, background:loading?'#fff8ee':'#e8401c', color:loading?'#a0896a':'#fff', opacity:!input.trim()?0.5:1, fontFamily:'Nunito, sans-serif' }}>
                {loading ? '⏳ Extracting recipe...' : '✂️ Extract Recipe'}
              </button>
              {error && <p style={{ color:'#e8401c', fontSize:13, marginTop:10 }}>{error}</p>}

              {preview && (
                <div style={{ marginTop:16, borderTop:'2px solid #ede4d4', paddingTop:16 }}>
                  <div style={{ textAlign:'center', marginBottom:12 }}>
                    <div style={{ fontSize:52 }}>{preview.image||'🍽️'}</div>
                    <h3 style={{ fontFamily:'Caveat, cursive', fontSize:20, fontWeight:700, margin:'8px 0 6px', color:'#1a1008' }}>{preview.title}</h3>
                    <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
                      {(preview.tags||[]).filter(t=>t&&t!=='Unknown').slice(0,3).map(t=>(
                        <span key={t} style={{ padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:800, background:'#fef0ec', color:'#e8401c', border:'1.5px solid #fca5a5' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  {(preview.ingredients||[]).length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <p style={{ fontSize:11, fontWeight:800, color:'#a0896a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Ingredients preview</p>
                      {(preview.ingredients||[]).slice(0,4).map((ing,i)=>(
                        <div key={i} style={{ fontSize:13, color:'#6b4f2a', padding:'5px 0', borderBottom:'1px solid #ede4d4' }}>• {ing}</div>
                      ))}
                      {preview.ingredients.length > 4 && <div style={{ fontSize:12, color:'#a0896a', marginTop:4 }}>+{preview.ingredients.length - 4} more ingredients...</div>}
                    </div>
                  )}
                  <div style={{ background:'#fef0ec', borderRadius:12, padding:'12px 14px', textAlign:'center', border:'1.5px solid #fca5a5' }}>
                    <p style={{ fontSize:13, fontWeight:800, color:'#e8401c', margin:'0 0 8px' }}>Want to save this recipe?</p>
                    <button onClick={()=>router.push('/app')}
                      style={{ padding:'10px 20px', borderRadius:10, background:'#e8401c', border:'none', cursor:'pointer', fontSize:13, fontWeight:900, color:'#fff', fontFamily:'Nunito, sans-serif' }}>
                      Treasure Every Recipe, Forever ❤️
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p style={{ textAlign:'center', fontSize:12, color:'#a0896a', marginTop:12 }}>
            No account needed to try • Sign up free to save
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop:'2px solid #ede4d4', padding:'28px 32px', textAlign:'center', marginTop:40, position:'relative', zIndex:1 }}>
        <span style={{ fontFamily:'Caveat, cursive', fontSize:22, fontWeight:700, color:'#1a1008' }}>📌Snipp<span style={{color:'#e8401c'}}>Eat</span>🍴</span>
        <p style={{ fontSize:12, color:'#a0896a', marginTop:6 }}>Made with ❤️ for food lovers everywhere</p>
      </div>
    </div>
  );
}
