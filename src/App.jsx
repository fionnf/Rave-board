import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isReady } from './supabase.js'

// ── LOCAL STORAGE (personal vibe only) ───────────────────────────────────
const lsGet = (k, d=null) => { try { const v=localStorage.getItem(k); return v!==null?JSON.parse(v):d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k,JSON.stringify(v)) } catch {} }

// ── VIBE ──────────────────────────────────────────────────────────────────
const VSTOPS=['#3300ff','#0088ff','#00ffaa','#ffcc00','#ff0066']
const VWORDS=['LOST','DRIFTING','FEELING IT','PEAK','TRANSCENDED']
const VGLYPH=['◌','◎','◉','⦿','✦']
const QR_HEX=['3300ff','0088ff','00ffaa','ffcc00','ff0066']
function hex2rgb(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}}
function lerpC(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return`rgb(${Math.round(A.r+(B.r-A.r)*t)},${Math.round(A.g+(B.g-A.g)*t)},${Math.round(A.b+(B.b-A.b)*t)})`}
function vibeColor(v){const idx=(v/100)*(VSTOPS.length-1),lo=Math.floor(idx),hi=Math.min(Math.ceil(idx),VSTOPS.length-1);return lo===hi?VSTOPS[lo]:lerpC(VSTOPS[lo],VSTOPS[hi],idx-lo)}
function vibeWord(v){return VWORDS[Math.round((v/100)*(VWORDS.length-1))]}
function vibeGlyph(v){return VGLYPH[Math.round((v/100)*(VGLYPH.length-1))]}
function qrHex(v){return QR_HEX[Math.round((v/100)*(QR_HEX.length-1))]}

// ── ORGANIC ───────────────────────────────────────────────────────────────
function hashFrac(str,seed=0){let h=(seed+1)*997;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))&0x7fffffff;return h/0x7fffffff}
const cardHue=id=>Math.round(hashFrac(id,50)*360)
const cardSat=id=>65+Math.round(hashFrac(id,60)*20)
const cardAccent=id=>`hsl(${cardHue(id)},${cardSat(id)}%,65%)`
const cardBg=id=>`hsl(${cardHue(id)},${cardSat(id)*.55}%,5%)`
const cardGlow=(id,s)=>{const h=cardHue(id),sat=cardSat(id),a=s?'.38':'.2',b=s?'.16':'.08';return`0 0 22px hsl(${h},${sat}%,55%,${a}),0 0 50px hsl(${h},${sat}%,50%,${b}),inset 0 0 16px hsl(${h},${sat}%,50%,.05)`}
function organicRadius(id){const v=i=>25+Math.round(hashFrac(id,i*7)*42);return`${v(0)}% ${v(1)}% ${v(2)}% ${v(3)}% / ${v(4)}% ${v(5)}% ${v(6)}% ${v(7)}%`}
const cardTilt=id=>(hashFrac(id,100)-.5)*8
const cardSkewX=id=>(hashFrac(id,200)-.5)*3.5
const cardBreathDur=id=>5+hashFrac(id,300)*6
const cardBreathDel=id=>-(hashFrac(id,400)*7)

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function seedWave(id,n=30){return Array.from({length:n},(_,i)=>{const s=(id.charCodeAt(i%id.length)*17+i*31)%100;return 12+s*.72})}

const MCOLORS=['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6fcf','#c77dff','#ff9f43','#00d2d3']
const memberColor=idx=>MCOLORS[idx%MCOLORS.length]
const initials=name=>name.trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()

// DB row → app memory shape
const dbToMem=r=>({id:r.id,type:r.type,caption:r.caption,title:r.title,artist:r.artist,vibe:r.vibe_note,text:r.text_content,tag:r.tag,memberId:r.member_id,imageData:r.image_url,audioData:r.audio_url,createdAt:r.created_at})

// ── LONG PRESS ────────────────────────────────────────────────────────────
function useLongPress(cb,ms=480){
  const t=useRef(null)
  const start=useCallback(()=>{t.current=setTimeout(()=>{navigator.vibrate?.(40);cb()},ms)},[cb,ms])
  const cancel=useCallback(()=>clearTimeout(t.current),[])
  return{onTouchStart:start,onTouchEnd:cancel,onTouchMove:cancel,onMouseDown:start,onMouseUp:cancel,onMouseLeave:cancel}
}

// ── INSTALL BANNER ────────────────────────────────────────────────────────
function InstallBanner(){
  const[show,setShow]=useState(false)
  useEffect(()=>{
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone
    if(ios&&!standalone&&!lsGet('install_dismissed'))setShow(true)
  },[])
  if(!show)return null
  return(
    <div className="install-banner" style={{position:'sticky',top:0,zIndex:1000,background:'#0e0e18',borderBottom:'1px solid #ff006633',padding:'10px 16px',display:'flex',alignItems:'center',gap:10}}>
      <span style={{fontSize:18}}>📲</span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:11,color:'#ff0066',letterSpacing:'.08em'}}>ADD TO HOME SCREEN</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#444',marginTop:2}}>Tap <span style={{color:'#888'}}>Share</span> → <span style={{color:'#888'}}>Add to Home Screen</span></div>
      </div>
      <button onClick={()=>{lsSet('install_dismissed',true);setShow(false)}} style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:16,padding:4}}>✕</button>
    </div>
  )
}

// ── SETUP SCREEN ──────────────────────────────────────────────────────────
function SetupScreen(){
  const vc='#ff0066'
  return(
    <div style={{minHeight:'100vh',background:'#020204',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:20}}>
      <div style={{fontSize:40}}>⚡</div>
      <h1 style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:20,color:vc,letterSpacing:'.08em',textAlign:'center'}}>SUPABASE SETUP NEEDED</h1>
      <div style={{background:'#0e0e18',border:`1px solid ${vc}33`,borderRadius:8,padding:'20px 22px',maxWidth:360,width:'100%',display:'flex',flexDirection:'column',gap:12}}>
        {[
          ['1','Go to supabase.com → new project'],
          ['2','SQL Editor → paste supabase-setup.sql → Run'],
          ['3','Settings → API → copy URL + anon key'],
          ['4','Vercel → project → Settings → Env Vars:'],
        ].map(([n,t])=>(
          <div key={n} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:`${vc}22`,border:`1px solid ${vc}55`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:10,color:vc,flexShrink:0}}>{n}</div>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:'#888',lineHeight:1.6}}>{t}</span>
          </div>
        ))}
        <div style={{background:'#141420',borderRadius:4,padding:'10px 12px',fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'#555',lineHeight:1.8}}>
          VITE_SUPABASE_URL = https://xxx.supabase.co<br/>
          VITE_SUPABASE_ANON_KEY = eyJ...
        </div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#444',textAlign:'center'}}>then redeploy on Vercel</div>
      </div>
    </div>
  )
}

// ── BACKGROUND ────────────────────────────────────────────────────────────
function BgBlobs(){
  return(
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
      {[{hue:280,l:'5%',t:'8%',w:'75vw',h:'55vh',dur:14},{hue:185,l:'55%',t:'42%',w:'58vw',h:'48vh',dur:20},{hue:330,l:'18%',t:'62%',w:'52vw',h:'44vh',dur:16},{hue:52,l:'68%',t:'4%',w:'42vw',h:'38vh',dur:22},{hue:145,l:'-6%',t:'78%',w:'48vw',h:'42vh',dur:18}].map((b,i)=>(
        <div key={i} style={{position:'absolute',left:b.l,top:b.t,width:b.w,height:b.h,background:`radial-gradient(ellipse,hsl(${b.hue},80%,48%) 0%,transparent 68%)`,opacity:.042,filter:'blur(35px)',borderRadius:'50%',animation:`drift${i} ${b.dur}s infinite alternate ease-in-out`}}/>
      ))}
    </div>
  )
}

function VibeDot({vibe=50}){const c=vibeColor(vibe);return<div style={{width:9,height:9,borderRadius:'50%',background:c,border:'1.5px solid #020204',boxShadow:`0 0 ${vibe>70?8:4}px ${c}`,flexShrink:0,animation:vibe>70?'dotPulse 1.6s infinite ease-in-out':'none'}}/>}

function VibePopover({member,vibe,onChange,onClose}){
  const c=vibeColor(vibe)
  return(
    <div className="pov" style={{position:'absolute',top:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',zIndex:300,background:'#0a0a14',border:`1px solid ${c}55`,borderRadius:10,padding:'12px 14px 10px',width:170,boxShadow:`0 8px 30px rgba(0,0,0,.7),0 0 20px ${c}22`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:c,letterSpacing:'.1em'}}>{vibeGlyph(vibe)} {vibeWord(vibe)}</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:11}}>✕</button>
      </div>
      <div style={{position:'relative',height:16,display:'flex',alignItems:'center',marginBottom:6}}>
        <div style={{position:'absolute',inset:'auto 0',height:2,background:`linear-gradient(to right,${VSTOPS.join(',')})`,borderRadius:1,pointerEvents:'none'}}/>
        <style>{`#vp-${member.id}::-webkit-slider-thumb{background:${c};width:13px;height:13px;border-radius:50%;border:2px solid #020204;box-shadow:0 0 8px ${c}99;-webkit-appearance:none;margin-top:-5.5px;}`}</style>
        <input id={`vp-${member.id}`} type="range" min={0} max={100} value={vibe} onChange={e=>onChange(+e.target.value)} style={{position:'relative',zIndex:1,width:'100%'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between'}}>
        {['L','D','F','P','T'].map((l,i)=><span key={i} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:'#1a1a28'}}>{l}</span>)}
      </div>
      <div style={{position:'absolute',top:-5,left:'50%',transform:'translateX(-50%)',width:8,height:8,background:'#0a0a14',border:`1px solid ${c}55`,borderRight:'none',borderBottom:'none',rotate:'45deg'}}/>
    </div>
  )
}

function QRModal({vc,vibe,onClose}){
  const url=window.location.href,color=qrHex(vibe)
  const qrSrc=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=020204&color=${color}&data=${encodeURIComponent(url)}`
  const[copied,setCopied]=useState(false)
  const copy=()=>navigator.clipboard?.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="pop" style={{background:'#08080f',border:`1px solid ${vc}44`,borderRadius:16,padding:'28px 24px 24px',maxWidth:300,width:'100%',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
        <div style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:14,color:vc,letterSpacing:'.12em',textAlign:'center',textShadow:`0 0 12px ${vc}66`}}>SHARE THIS BOARD</div>
        <div style={{fontSize:10,fontFamily:"'Share Tech Mono',monospace",color:'#2a2a3a',letterSpacing:'.08em',textAlign:'center'}}>SCAN TO OPEN & JOIN</div>
        <div style={{padding:3,background:'#020204',border:`1px solid ${vc}33`,borderRadius:4}}>
          <img src={qrSrc} alt="QR" width={220} height={220} style={{display:'block'}} onError={e=>e.target.style.display='none'}/>
        </div>
        <div style={{width:'100%',background:'#0e0e18',border:'1px solid #1e1e2a',padding:'8px 10px',display:'flex',alignItems:'center',gap:8,borderRadius:4}}>
          <span style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#444',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{url}</span>
          <button onClick={copy} style={{background:copied?`${vc}22`:'transparent',border:`1px solid ${copied?vc:'#2a2a3a'}`,color:copied?vc:'#444',fontFamily:"'Share Tech Mono',monospace",fontSize:9,padding:'4px 8px',cursor:'pointer',borderRadius:3,flexShrink:0}}>{copied?'COPIED':'COPY'}</button>
        </div>
        <button onClick={onClose} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#2a2a3a',background:'none',border:'none',cursor:'pointer'}}>CLOSE</button>
      </div>
    </div>
  )
}

function Avatar({member,size=28,selected,onClick,showName,vibeVal=50}){
  const c=member.color,r=i=>35+Math.round(hashFrac(member.id,i)*28)
  const br=`${r(5)}% ${r(15)}% ${r(25)}% ${r(35)}% / ${r(45)}% ${r(55)}% ${r(65)}% ${r(75)}%`
  return(
    <div onClick={onClick} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:onClick?'pointer':'default'}}>
      <div style={{position:'relative'}}>
        <div style={{width:size,height:size,borderRadius:br,background:`${c}22`,border:`1.5px solid ${selected?c:c+'55'}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:size*.38,color:c,boxShadow:selected?`0 0 12px ${c}77`:'none',transition:'all .2s',flexShrink:0}}>{initials(member.name)}</div>
        <div style={{position:'absolute',bottom:-1,right:-1}}><VibeDot vibe={vibeVal}/></div>
      </div>
      {showName&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:selected?c:'#333',letterSpacing:'.06em',maxWidth:50,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'}}>{member.name.toUpperCase()}</span>}
    </div>
  )
}

function MemberBadge({member,vibeVal=50}){
  if(!member)return null
  return(
    <div style={{display:'inline-flex',alignItems:'center',gap:5,background:`${member.color}18`,border:`1px solid ${member.color}44`,padding:'2px 8px 2px 4px',borderRadius:20,marginTop:7}}>
      <VibeDot vibe={vibeVal}/>
      <div style={{width:12,height:12,borderRadius:'50%',background:member.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:6,fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,color:'#000',flexShrink:0}}>{initials(member.name)}</div>
      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:member.color,letterSpacing:'.08em'}}>{member.name.toUpperCase()}</span>
    </div>
  )
}

function MemberPicker({members,memberVibes,selected,onChange}){
  if(!members.length)return null
  return(
    <div>
      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:'#252535',letterSpacing:'.14em',marginBottom:8}}>WHO'S ADDING THIS?</div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{members.map(m=><Avatar key={m.id} member={m} size={36} selected={selected===m.id} onClick={()=>onChange(selected===m.id?null:m.id)} showName vibeVal={memberVibes[m.id]??50}/>)}</div>
    </div>
  )
}

function CrewRow({members,memberVibes,onVibeChange,onAdd,onRemove,onShowQR}){
  const[adding,setAdding]=useState(false);const[val,setVal]=useState('');const[editingVibe,setEditingVibe]=useState(null);const rowRef=useRef()
  const submit=()=>{const n=val.trim();if(n){onAdd(n);setVal('');setAdding(false)}}
  useEffect(()=>{const h=e=>{if(rowRef.current&&!rowRef.current.contains(e.target))setEditingVibe(null)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[])
  return(
    <div ref={rowRef} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0 12px',overflowX:'auto',scrollbarWidth:'none'}}>
      {members.map(m=>(
        <div key={m.id} className="pop" style={{position:'relative',flexShrink:0}}>
          <Avatar member={m} size={34} showName vibeVal={memberVibes[m.id]??50} onClick={()=>setEditingVibe(editingVibe===m.id?null:m.id)}/>
          <button onClick={e=>{e.stopPropagation();onRemove(m.id)}} style={{position:'absolute',top:-4,right:-4,width:14,height:14,borderRadius:'50%',background:'#1a1a22',border:`1px solid ${m.color}55`,color:'#555',fontSize:7,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>✕</button>
          {editingVibe===m.id&&<VibePopover member={m} vibe={memberVibes[m.id]??50} onChange={v=>onVibeChange(m.id,v)} onClose={()=>setEditingVibe(null)}/>}
        </div>
      ))}
      {adding?(
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <input type="text" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit();if(e.key==='Escape'){setAdding(false);setVal('')}}} placeholder="name..." autoFocus style={{width:88,padding:'5px 8px',fontSize:11}}/>
          <button onClick={submit} style={{background:'var(--vc)',border:'none',color:'#000',padding:'5px 9px',cursor:'pointer',fontFamily:"'Share Tech Mono',monospace",fontSize:9,borderRadius:3}}>ADD</button>
          <button onClick={()=>{setAdding(false);setVal('')}} style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:12}}>✕</button>
        </div>
      ):(
        <button onClick={()=>setAdding(true)} style={{flexShrink:0,width:32,height:32,borderRadius:'50%',background:'transparent',border:'1.5px dashed #252535',color:'#252535',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--vc)';e.currentTarget.style.color='var(--vc)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#252535';e.currentTarget.style.color='#252535'}}>+</button>
      )}
      <button onClick={onShowQR} style={{flexShrink:0,width:32,height:32,borderRadius:'50%',background:'transparent',border:'1.5px solid #1a1a28',color:'#252535',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,transition:'all .2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--vc)';e.currentTarget.style.color='var(--vc)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#1a1a28';e.currentTarget.style.color='#252535'}}>▦</button>
    </div>
  )
}

function EmotionSlider({vibe,onChange}){
  const vc=vibeColor(vibe)
  useEffect(()=>{document.documentElement.style.setProperty('--vc',vc)},[vc])
  return(
    <div style={{padding:'10px 0 8px',borderBottom:'1px solid #0f0f1a'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:'#252535',letterSpacing:'.18em'}}>MY VIBE</span>
        <span style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:13,color:vc,letterSpacing:'.08em',textShadow:`0 0 12px ${vc}88`}}>{vibeGlyph(vibe)} {vibeWord(vibe)}</span>
      </div>
      <div style={{position:'relative',height:20,display:'flex',alignItems:'center'}}>
        <div style={{position:'absolute',inset:'auto 0',height:3,background:`linear-gradient(to right,${VSTOPS.join(',')})`,pointerEvents:'none'}}/>
        <style>{`#es::-webkit-slider-thumb{background:${vc};width:16px;height:16px;border-radius:50%;border:2px solid #020204;box-shadow:0 0 10px ${vc}99;-webkit-appearance:none;margin-top:-6.5px;}#es::-moz-range-thumb{background:${vc};width:14px;height:14px;border-radius:50%;border:2px solid #020204;box-shadow:0 0 10px ${vc}99;}`}</style>
        <input id="es" type="range" min={0} max={100} value={vibe} onChange={e=>onChange(+e.target.value)} style={{position:'relative',zIndex:1}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        {VWORDS.map(w=><span key={w} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:6,color:'#1a1a28'}}>{w}</span>)}
      </div>
    </div>
  )
}

function DeleteOverlay({onConfirm,onCancel}){
  return(
    <div style={{position:'absolute',inset:0,background:'rgba(2,2,4,.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,zIndex:20,backdropFilter:'blur(4px)'}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:13,color:'#dde',letterSpacing:'.1em'}}>DELETE THIS?</div>
      <div style={{display:'flex',gap:10}}>
        <button onClick={onConfirm} style={{background:'#ff002288',border:'1px solid #ff0022',color:'#ff6666',padding:'8px 20px',fontFamily:"'Share Tech Mono',monospace",fontSize:11,cursor:'pointer',borderRadius:4}}>DELETE</button>
        <button onClick={onCancel} style={{background:'transparent',border:'1px solid #2a2a3a',color:'#555',padding:'8px 20px',fontFamily:"'Share Tech Mono',monospace",fontSize:11,cursor:'pointer',borderRadius:4}}>KEEP</button>
      </div>
    </div>
  )
}

function OrgCard({id,children,onClick,extraPad,onDelete,isDeleting}){
  const[hov,setHov]=useState(false);const[confirm,setConfirm]=useState(false)
  const ac=cardAccent(id);const lp=useLongPress(()=>setConfirm(true))
  return(
    <div className={`mem-w${isDeleting?' deleting':''}`} style={{padding:extraPad||'8px 6px',breakInside:'avoid'}}>
      <div style={{animation:isDeleting?'none':`breathe ${cardBreathDur(id)}s ${cardBreathDel(id)}s infinite ease-in-out`}}>
        <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} {...lp}
          style={{transform:`rotate(${cardTilt(id)}deg) skewX(${cardSkewX(id)}deg)`,borderRadius:organicRadius(id),background:cardBg(id),boxShadow:cardGlow(id,hov||confirm),overflow:'hidden',transition:'box-shadow .3s,filter .2s',filter:hov?'brightness(1.18) saturate(1.25)':'none',cursor:onClick?'pointer':'default',position:'relative',userSelect:'none',WebkitUserSelect:'none'}}>
          {children}
          <button onClick={e=>{e.stopPropagation();setConfirm(true)}} style={{position:'absolute',top:8,right:8,width:24,height:24,borderRadius:'50%',background:'rgba(2,2,4,.7)',border:`1px solid ${ac}44`,color:'#666',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',zIndex:5,backdropFilter:'blur(4px)',transition:'all .2s'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='#ff002288';e.currentTarget.style.color='#ff6666'}} onMouseLeave={e=>{e.currentTarget.style.borderColor=`${ac}44`;e.currentTarget.style.color='#666'}}>✕</button>
          {confirm&&<DeleteOverlay onConfirm={()=>{setConfirm(false);onDelete()}} onCancel={()=>setConfirm(false)}/>}
        </div>
      </div>
    </div>
  )
}

function PhotoCard({mem,onDel,onOpen,member,memberVibes,isDeleting}){
  const ac=cardAccent(mem.id)
  return(
    <OrgCard id={mem.id} onClick={()=>onOpen(mem)} extraPad="10px 7px" onDelete={onDel} isDeleting={isDeleting}>
      <div style={{position:'relative'}}>
        {mem.imageData?<img src={mem.imageData} alt="" style={{width:'100%',aspectRatio:'4/3',objectFit:'cover',display:'block'}}/>:<div style={{width:'100%',aspectRatio:'4/3',background:'#111'}}/>}
        <div style={{position:'absolute',inset:0,background:`linear-gradient(to top,${cardBg(mem.id)}ee 0%,transparent 52%)`,pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'10px 12px 10px'}}>
          {mem.caption&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#ddd',lineHeight:1.5,letterSpacing:'.03em',marginBottom:4}}>{mem.caption}</div>}
          <MemberBadge member={member} vibeVal={memberVibes?.[member?.id]??50}/>
        </div>
        <div style={{position:'absolute',top:8,left:8,width:8,height:8,borderTop:`1.5px solid ${ac}`,borderLeft:`1.5px solid ${ac}`,opacity:.9}}/>
      </div>
    </OrgCard>
  )
}

function TrackCard({mem,onDel,member,memberVibes,isDeleting}){
  const ac=cardAccent(mem.id);const h=cardHue(mem.id),s=cardSat(mem.id)
  const wave=seedWave(mem.id);const mx=Math.max(...wave)
  return(
    <OrgCard id={mem.id} onDelete={onDel} isDeleting={isDeleting}>
      <div style={{padding:'15px 14px 13px'}}>
        <div style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:12,color:ac,letterSpacing:'.06em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textShadow:`0 0 12px ${ac}66`,paddingRight:28}}>{mem.title||'VOICE NOTE'}</div>
        {mem.artist&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#555',marginTop:2}}>{mem.artist}</div>}
        <div style={{display:'flex',alignItems:'flex-end',gap:1.5,height:32,margin:'10px 0 9px'}}>
          {wave.map((hh,i)=>{const hShift=(h+i*(240/wave.length))%360;return<div key={i} style={{flex:1,background:`hsl(${hShift},${s}%,62%)`,opacity:.1+.85*(hh/mx),height:`${(hh/mx)*100}%`,minHeight:2,borderRadius:'2px 2px 0 0'}}/>})}
        </div>
        {mem.audioData&&<audio controls src={mem.audioData} style={{width:'100%',height:22}}/>}
        {mem.vibe&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#3a3a4a',marginTop:8,fontStyle:'italic'}}>"{mem.vibe}"</div>}
        <MemberBadge member={member} vibeVal={memberVibes?.[member?.id]??50}/>
      </div>
    </OrgCard>
  )
}

function NoteCard({mem,onDel,member,memberVibes,isDeleting}){
  const ac=cardAccent(mem.id);const h=cardHue(mem.id),s=cardSat(mem.id)
  return(
    <OrgCard id={mem.id} onDelete={onDel} isDeleting={isDeleting}>
      <div style={{padding:'14px 14px 12px'}}>
        <div style={{display:'flex',gap:3,marginBottom:9}}>{[0,60,120,180].map(shift=><div key={shift} style={{width:4,height:4,borderRadius:'50%',background:`hsl(${(h+shift)%360},${s}%,62%)`,boxShadow:`0 0 5px hsl(${(h+shift)%360},${s}%,62%)`}}/>)}</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:'#999',lineHeight:1.88,whiteSpace:'pre-wrap',paddingRight:20}}>{mem.text}</div>
        {mem.tag&&<div style={{marginTop:8,fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:ac,letterSpacing:'.1em'}}>{mem.tag}</div>}
        <MemberBadge member={member} vibeVal={memberVibes?.[member?.id]??50}/>
      </div>
    </OrgCard>
  )
}

function AddPhoto({onAdd,onClose,vc,members,memberVibes}){
  const[img,setImg]=useState(null);const[cap,setCap]=useState('');const[who,setWho]=useState(null);const ref=useRef()
  const pick=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),MAX=900;let w=im.width,hh=im.height;if(w>MAX){hh=hh*MAX/w;w=MAX;}c.width=w;c.height=hh;c.getContext('2d').drawImage(im,0,0,w,hh);setImg(c.toDataURL('image/jpeg',.78));};im.src=ev.target.result;};r.readAsDataURL(file);}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div onClick={()=>ref.current.click()} style={{border:`1px dashed ${img?'#1e1e2a':vc}`,aspectRatio:'4/3',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',background:'#090912',borderRadius:8}}>
        {img?<img src={img} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{textAlign:'center',color:'#2a2a3a'}}><div style={{fontSize:26,marginBottom:8}}>📷</div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,letterSpacing:'.12em'}}>TAP TO UPLOAD</div></div>}
      </div>
      <input type="file" ref={ref} accept="image/*" onChange={pick}/>
      <input type="text" placeholder="caption..." value={cap} onChange={e=>setCap(e.target.value)}/>
      <MemberPicker members={members} memberVibes={memberVibes} selected={who} onChange={setWho}/>
      <Btn vc={vc} onClick={()=>{if(img||cap)onAdd({type:'photo',imageData:img,caption:cap,memberId:who})}}>ADD PHOTO</Btn>
      <Cancel onClick={onClose}/>
    </div>
  )
}

function AddTrack({onAdd,onClose,vc,members,memberVibes}){
  const[st,setSt]=useState('idle');const[audio,setAudio]=useState(null);const[bars,setBars]=useState(Array(22).fill(8));const[dur,setDur]=useState(0)
  const[title,setTitle]=useState('');const[artist,setArtist]=useState('');const[busy,setBusy]=useState(false);const[suggs,setSuggs]=useState(null);const[who,setWho]=useState(null)
  const mr=useRef(null),an=useRef(null),ch=useRef([]),fr=useRef(null),ti=useRef(null),t0=useRef(0)
  const startRec=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const ctx=new(window.AudioContext||window.webkitAudioContext)();const src=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=64;src.connect(analyser);an.current={analyser,ctx};const draw=()=>{const d=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(d);setBars([...d.slice(0,22)]);fr.current=requestAnimationFrame(draw);};fr.current=requestAnimationFrame(draw);const mime=MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'';const rec=new MediaRecorder(stream,mime?{mimeType:mime}:{});ch.current=[];rec.ondataavailable=e=>{if(e.data.size>0)ch.current.push(e.data);};rec.onstop=()=>{cancelAnimationFrame(fr.current);an.current?.ctx.close();an.current=null;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(ch.current);const r=new FileReader();r.onload=()=>{setAudio(r.result);setSt('done');};r.readAsDataURL(blob);};rec.start(80);mr.current=rec;t0.current=Date.now();ti.current=setInterval(()=>setDur(Math.floor((Date.now()-t0.current)/1000)),400);setSt('rec');}catch{alert('Microphone access denied');}}
  const stopRec=()=>{mr.current?.stop();clearInterval(ti.current);}
  const identify=async()=>{setBusy(true);try{const res=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini',max_tokens:700,system:'Rave/club music expert. Respond ONLY valid JSON no backticks: {"suggestions":[{"title":"...","artist":"...","genre":"...","confidence":"high|medium|low"}]}. 1-3 suggestions.',messages:[{role:'user',content:`Voice note at rave. Title: "${title||'?'}" Artist: "${artist||'?'}". Suggest what this might be.`}]})});const d=await res.json();const raw=d.content?.find(b=>b.type==='text')?.text??'{}';setSuggs(JSON.parse(raw.replace(/```json|```/g,'').trim()).suggestions??[]);}catch{setSuggs([{title:"Couldn't identify",artist:'Save manually',genre:'',confidence:'low'}]);}setBusy(false);}
  const save=(s=null)=>onAdd({type:'track',title:s?.title||title||'Voice Note',artist:s?.artist||artist,vibe:s?`${s.genre||''} • ${s.confidence} confidence`.trim():'',audioData:audio,memberId:who})
  const mx=Math.max(...bars,1);const mm=String(Math.floor(dur/60)).padStart(2,'0'),ss=String(dur%60).padStart(2,'0')
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:'#06060d',border:`1px solid ${st==='rec'?vc:'#141420'}`,padding:'18px 14px',display:'flex',flexDirection:'column',alignItems:'center',gap:12,borderRadius:12,transition:'border-color .3s'}}>
        {st!=='idle'&&<div style={{display:'flex',alignItems:'flex-end',gap:2,height:50,width:'100%'}}>{bars.map((bh,i)=>{const hShift=(260+i*15)%360;return<div key={i} style={{flex:1,background:`hsl(${hShift},80%,60%)`,opacity:st==='rec'?.15+.8*(bh/mx):.15,height:`${st==='rec'?(bh/mx)*100:35}%`,minHeight:2,transition:st==='rec'?'height .07s':'none',borderRadius:'2px 2px 0 0'}}/>})}</div>}
        {st==='rec'&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:vc,letterSpacing:'.22em',display:'flex',alignItems:'center',gap:6}}><span style={{width:7,height:7,borderRadius:'50%',background:vc,display:'inline-block'}}/>REC {mm}:{ss}</div>}
        {st==='done'&&audio&&<audio controls src={audio} style={{width:'100%'}}/>}
        {st==='idle'&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#252535',letterSpacing:'.12em',textAlign:'center',lineHeight:1.8}}>TAP 🎙️ TO CAPTURE<br/>A TRACK MOMENT</div>}
        {st!=='done'&&<button className={st==='rec'?'rng':''} onClick={st==='idle'?startRec:stopRec} style={{width:58,height:58,borderRadius:'50%',background:st==='rec'?vc:'#111118',border:`2px solid ${vc}`,cursor:'pointer',fontSize:st==='rec'?20:26,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:st==='rec'?`0 0 22px ${vc}55`:'none',transition:'all .2s'}}>{st==='rec'?'⬛':'🎙️'}</button>}
      </div>
      {st==='done'&&<>
        <input type="text" placeholder="track title (if known)..." value={title} onChange={e=>setTitle(e.target.value)}/>
        <input type="text" placeholder="artist (if known)..." value={artist} onChange={e=>setArtist(e.target.value)}/>
        <button onClick={identify} disabled={busy} style={{background:'#0b0b16',border:`1px solid ${vc}44`,color:busy?'#2a2a3a':vc,padding:'10px',fontFamily:"'Share Tech Mono',monospace",fontSize:10,cursor:busy?'default':'pointer',letterSpacing:'.12em',width:'100%',borderRadius:4}}>{busy?'IDENTIFYING...':'🔮 AI IDENTIFY TRACK'}</button>
        {suggs&&<div style={{display:'flex',flexDirection:'column',gap:7}}><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:'#252535',letterSpacing:'.1em'}}>//  TAP TO SAVE</div>{suggs.map((s,i)=><div key={i} onClick={()=>save(s)} style={{background:'#0a0a14',border:`1px solid ${vc}33`,padding:'11px',cursor:'pointer',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.background='#101020'} onMouseLeave={e=>e.currentTarget.style.background='#0a0a14'}><div style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:12,color:vc}}>{s.title}</div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#555',marginTop:2}}>{s.artist}{s.genre&&` · ${s.genre}`}</div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:s.confidence==='high'?vc:'#2a2a3a',marginTop:4}}>{s.confidence?.toUpperCase()} CONFIDENCE</div></div>)}</div>}
        <MemberPicker members={members} memberVibes={memberVibes} selected={who} onChange={setWho}/>
        <Btn vc={vc} onClick={()=>save()}>SAVE TRACK</Btn>
        <button onClick={()=>{setSt('idle');setAudio(null);setBars(Array(22).fill(8));setSuggs(null);setDur(0)}} style={{background:'none',border:'1px solid #1a1a24',color:'#3a3a4a',padding:'9px',fontFamily:"'Share Tech Mono',monospace",fontSize:9,cursor:'pointer',width:'100%',borderRadius:4}}>RE-RECORD</button>
      </>}
      <Cancel onClick={onClose}/>
    </div>
  )
}

function AddNote({onAdd,onClose,vc,members,memberVibes}){
  const[txt,setTxt]=useState('');const[tag,setTag]=useState('');const[who,setWho]=useState(null)
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <textarea placeholder="what do you remember..." value={txt} onChange={e=>setTxt(e.target.value)} rows={5} autoFocus/>
      <input type="text" placeholder="#tag e.g. #fabric #3am" value={tag} onChange={e=>setTag(e.target.value)}/>
      <MemberPicker members={members} memberVibes={memberVibes} selected={who} onChange={setWho}/>
      <Btn vc={vc} onClick={()=>{if(txt.trim())onAdd({type:'note',text:txt,tag,memberId:who})}}>SAVE NOTE</Btn>
      <Cancel onClick={onClose}/>
    </div>
  )
}

function Btn({children,onClick,vc}){return<button onClick={onClick} style={{background:vc,color:'#000',border:'none',padding:'13px',fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:13,cursor:'pointer',letterSpacing:'.1em',width:'100%',borderRadius:6}} onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.15)'} onMouseLeave={e=>e.currentTarget.style.filter='none'}>{children}</button>}
function Cancel({onClick}){return<button onClick={onClick} style={{background:'none',border:'none',color:'#2a2a3a',fontFamily:"'Share Tech Mono',monospace",fontSize:9,cursor:'pointer',letterSpacing:'.12em'}}>CANCEL</button>}
function Sheet({title,vc,onClose,children}){
  const r1=30+hashFrac(vc,0)*20,r2=30+hashFrac(vc,10)*20
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:500,display:'flex',alignItems:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="sht" style={{background:'#06060e',borderTop:`1px solid ${vc}55`,borderRadius:`${r1}px ${r2}px 0 0`,width:'100%',maxWidth:500,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',padding:'20px 18px 52px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:14,color:vc,letterSpacing:'.14em'}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:15}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}


// ── SYNC BADGE ───────────────────────────────────────────────────────────
function SyncBadge({sbOk,uploading,isReady}){
  let dot,label,color,pulse
  if(uploading){dot='◉';label='SYNCING';color='#ffcc00';pulse=true}
  else if(sbOk){dot='◉';label='LIVE';color='#00ffaa';pulse=false}
  else if(isReady){dot='◎';label='SETUP';color='#ff6600';pulse=false}
  else{dot='◌';label='LOCAL';color='#333';pulse=false}
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px',background:`${color}15`,border:`1px solid ${color}44`,borderRadius:20}}>
      <div style={{fontSize:7,color,animation:pulse?'dotPulse 1s infinite ease-in-out':'none',lineHeight:1}}>{dot}</div>
      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color,letterSpacing:'.1em'}}>{label}</span>
    </div>
  )
}

// ── SQL SETUP BANNER ─────────────────────────────────────────────────────
const SETUP_SQL=`create table if not exists board_settings(id text primary key default 'main',name text default 'CREW BOARD',updated_at timestamptz default now());
insert into board_settings(id,name)values('main','CREW BOARD')on conflict do nothing;
create table if not exists members(id text primary key,name text not null,color text not null,created_at timestamptz default now());
create table if not exists member_vibes(member_id text primary key,vibe integer default 50,updated_at timestamptz default now());
create table if not exists memories(id text primary key,type text not null,caption text,title text,artist text,vibe_note text,text_content text,tag text,member_id text,image_url text,audio_url text,created_at timestamptz default now());
alter table board_settings enable row level security;
alter table members enable row level security;
alter table member_vibes enable row level security;
alter table memories enable row level security;
create policy "all" on board_settings for all using(true)with check(true);
create policy "all" on members for all using(true)with check(true);
create policy "all" on member_vibes for all using(true)with check(true);
create policy "all" on memories for all using(true)with check(true);
insert into storage.buckets(id,name,public)values('memories','memories',true)on conflict do nothing;
create policy "pub" on storage.objects for all using(bucket_id='memories')with check(bucket_id='memories');`

function SQLBanner({onDismiss}){
  const[copied,setCopied]=useState(false)
  const copy=()=>{ navigator.clipboard?.writeText(SETUP_SQL).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),3000) }) }
  return(
    <div style={{background:'#0e0e18',border:'1px solid #ff006655',margin:'10px 12px',borderRadius:8,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:12,color:'#ff0066',letterSpacing:'.08em'}}>⚡ ONE-TIME SETUP NEEDED</div>
        <button onClick={onDismiss} style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:14}}>✕</button>
      </div>
      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'#555',lineHeight:1.7}}>
        Go to <span style={{color:'#888'}}>supabase.com → your project → SQL Editor</span>, paste the SQL below and click Run.
      </div>
      <button onClick={copy} style={{background:copied?'#00ffaa22':'#ff006622',border:`1px solid ${copied?'#00ffaa55':'#ff006655'}`,color:copied?'#00ffaa':'#ff6666',padding:'10px',fontFamily:"'Share Tech Mono',monospace",fontSize:11,cursor:'pointer',borderRadius:4,letterSpacing:'.1em',transition:'all .2s'}}>
        {copied?'✓ SQL COPIED — NOW PASTE IN SUPABASE':'📋 COPY SETUP SQL'}
      </button>
    </div>
  )
}

// ── MAIN BOARD ────────────────────────────────────────────────────────────
function BoardApp(){
  const[mems,setMems]=useState([])
  const[members,setMembers]=useState([])
  const[memberVibes,setMemberVibes]=useState({})
  const[loading,setLoading]=useState(true)
  const[uploading,setUploading]=useState(false)
  const[modal,setModal]=useState(null)
  const[box,setBox]=useState(null)
  const[name,setName]=useState('CREW BOARD')
  const[editN,setEditN]=useState(false)
  const[nVal,setNVal]=useState('CREW BOARD')
  const[vibe,setVibe]=useState(lsGet('rv_vibe',50))
  const[showQR,setShowQR]=useState(false)
  const[deletingIds,setDeletingIds]=useState(new Set())
  const[sbOk,setSbOk]=useState(false)
  const[needsSQL,setNeedsSQL]=useState(false)
  const uploadingRef=useRef(false)
  const vc=vibeColor(vibe)

  const lsSaveMems=ms=>lsSet('rv_mems',ms.map(({imageData,audioData,...r})=>r))

  const loadLocal=()=>{
    const n=lsGet('rv_name');if(n)setName(n)
    setMembers(lsGet('rv_members',[]))
    setMemberVibes(lsGet('rv_mvibes',{}))
    const ms=lsGet('rv_mems',[])
    setMems(ms.map(m=>{
      if(m.type==='photo'){const d=lsGet(`rv_ph_${m.id}`);if(d)m.imageData=d}
      if(m.type==='track'){const d=lsGet(`rv_au_${m.id}`);if(d)m.audioData=d}
      return m
    }))
    setLoading(false)
  }

  const syncFromSB=async()=>{
    if(uploadingRef.current)return
    try{
      const[{data:bs},{data:mb},{data:mv},{data:me}]=await Promise.all([
        supabase.from('board_settings').select('name').eq('id','main').maybeSingle(),
        supabase.from('members').select('*').order('created_at'),
        supabase.from('member_vibes').select('*'),
        supabase.from('memories').select('*').order('created_at',{ascending:false}),
      ])
      if(bs?.name)setName(bs.name)
      if(mb)setMembers(mb)
      if(mv)setMemberVibes(Object.fromEntries(mv.map(v=>[v.member_id,v.vibe])))
      if(me)setMems(me.map(dbToMem))
      setLoading(false)
    }catch(e){console.warn('sync error',e)}
  }

  useEffect(()=>{
    if(!isReady){loadLocal();return}
    // Check if tables exist
    supabase.from('members').select('count',{count:'exact',head:true})
      .then(async({error})=>{
        if(error){setNeedsSQL(true);loadLocal();return}
        setSbOk(true)
        await syncFromSB()
        // Poll every 3 seconds for cross-device sync
        const iv=setInterval(syncFromSB,3000)
        return iv
      })
      .then(iv=>{if(iv)return()=>clearInterval(iv)})
      .catch(()=>loadLocal())
  },[])

  const addMem=async(d)=>{
    setModal(null)
    const id=uid()
    // Show immediately
    const m={...d,id,createdAt:Date.now()}
    if(m.imageData)lsSet(`rv_ph_${id}`,m.imageData)
    if(m.audioData)lsSet(`rv_au_${id}`,m.audioData)
    const next=[m,...mems];setMems(next);lsSaveMems(next)
    // Sync to Supabase if ready
    if(sbOk){
      uploadingRef.current=true;setUploading(true)
      let image_url=null,audio_url=null
      try{
        if(d.imageData){const blob=await fetch(d.imageData).then(r=>r.blob());await supabase.storage.from('memories').upload(`photos/${id}.jpg`,blob,{contentType:'image/jpeg',upsert:true});image_url=supabase.storage.from('memories').getPublicUrl(`photos/${id}.jpg`).data.publicUrl}
        if(d.audioData){const blob=await fetch(d.audioData).then(r=>r.blob());await supabase.storage.from('memories').upload(`audio/${id}`,blob,{upsert:true});audio_url=supabase.storage.from('memories').getPublicUrl(`audio/${id}`).data.publicUrl}
        await supabase.from('memories').insert({id,type:d.type,caption:d.caption||null,title:d.title||null,artist:d.artist||null,vibe_note:d.vibe||null,text_content:d.text||null,tag:d.tag||null,member_id:d.memberId||null,image_url,audio_url})
      }catch(e){console.warn('upload failed',e)}
      uploadingRef.current=false;setUploading(false)
    }
  }

  const delMem=id=>{
    setDeletingIds(p=>new Set([...p,id]))
    setTimeout(()=>{
      setMems(p=>p.filter(m=>m.id!==id))
      lsSet('rv_mems',(lsGet('rv_mems',[])).filter(m=>m.id!==id))
      localStorage.removeItem(`rv_ph_${id}`);localStorage.removeItem(`rv_au_${id}`)
      setDeletingIds(p=>{const s=new Set(p);s.delete(id);return s})
      if(sbOk){
        supabase.from('memories').delete().eq('id',id).catch(()=>{})
        supabase.storage.from('memories').remove([`photos/${id}.jpg`,`audio/${id}`]).catch(()=>{})
      }
    },380)
  }

  const addMember=n=>{
    const m={id:uid(),name:n,color:memberColor(members.length)}
    const next=[...members,m];setMembers(next);lsSet('rv_members',next)
    if(sbOk)supabase.from('members').insert(m).catch(()=>{})
  }
  const removeMember=id=>{
    const next=members.filter(m=>m.id!==id);setMembers(next);lsSet('rv_members',next)
    if(sbOk)supabase.from('members').delete().eq('id',id).catch(()=>{})
  }
  const handleVibeChange=(mid,val)=>{
    setMemberVibes(p=>({...p,[mid]:val}));lsSet('rv_mvibes',{...memberVibes,[mid]:val})
    if(sbOk)supabase.from('member_vibes').upsert({member_id:mid,vibe:val,updated_at:new Date().toISOString()}).catch(()=>{})
  }
  const saveName=v=>{
    setName(v);setNVal(v);setEditN(false);lsSet('rv_name',v)
    if(sbOk)supabase.from('board_settings').upsert({id:'main',name:v,updated_at:new Date().toISOString()}).catch(()=>{})
  }
  const saveVibe=v=>{setVibe(v);lsSet('rv_vibe',v)}
  const getMember=id=>members.find(m=>m.id===id)
  const col1=mems.filter((_,i)=>i%2===0),col2=mems.filter((_,i)=>i%2===1)
  const renderCard=m=>{
    const member=getMember(m.memberId),isDeleting=deletingIds.has(m.id)
    if(m.type==='photo')return<PhotoCard key={m.id} mem={m} onDel={()=>delMem(m.id)} onOpen={setBox} member={member} memberVibes={memberVibes} isDeleting={isDeleting}/>
    if(m.type==='track')return<TrackCard key={m.id} mem={m} onDel={()=>delMem(m.id)} member={member} memberVibes={memberVibes} isDeleting={isDeleting}/>
    return<NoteCard key={m.id} mem={m} onDel={()=>delMem(m.id)} member={member} memberVibes={memberVibes} isDeleting={isDeleting}/>
  }

  return(
    <div style={{minHeight:'100vh',background:'#020204',color:'#dde',paddingBottom:90,position:'relative'}}>
      <BgBlobs/>
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:2,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.06) 2px,rgba(0,0,0,.06) 4px)'}}/>
      <div style={{position:'fixed',top:0,left:0,right:0,height:1,background:vc,boxShadow:`0 0 ${14+vibe*.4}px ${vc}`,pointerEvents:'none',zIndex:999,opacity:.7,transition:'background .4s,box-shadow .4s'}}/>

      {/* Uploading overlay */}
      {uploading&&<div style={{position:'fixed',inset:0,background:'rgba(2,2,4,.7)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14,backdropFilter:'blur(6px)'}}>
        <div style={{width:40,height:40,borderRadius:'50%',border:`2px solid ${vc}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite'}}/>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:vc,letterSpacing:'.16em'}}>UPLOADING...</div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>}

      <InstallBanner/>
      {needsSQL&&<SQLBanner onDismiss={()=>setNeedsSQL(false)}/>}
      <header style={{padding:'16px 18px 0',position:'sticky',top:0,background:'#020204cc',backdropFilter:'blur(14px)',zIndex:200}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',paddingBottom:10}}>
          {editN?(
            <div style={{display:'flex',gap:8,alignItems:'center',flex:1}}>
              <input type="text" value={nVal} onChange={e=>setNVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveName(nVal);if(e.key==='Escape')setEditN(false)}} autoFocus style={{flex:1,fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:22,background:'transparent',borderBottom:`2px solid ${vc}`,borderTop:'none',borderLeft:'none',borderRight:'none',borderRadius:0,color:vc,padding:'3px 0'}}/>
              <button onClick={()=>saveName(nVal)} style={{background:vc,border:'none',color:'#000',padding:'6px 11px',cursor:'pointer',fontFamily:"'Share Tech Mono',monospace",fontSize:9,borderRadius:4}}>SAVE</button>
            </div>
          ):(
            <>
              <h1 className="tg" onClick={()=>setEditN(true)} style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:'clamp(20px,5.5vw,32px)',color:vc,letterSpacing:'-.01em',cursor:'pointer',userSelect:'none',textShadow:`0 0 18px ${vc}55`,transition:'color .4s,text-shadow .4s'}}>{name}</h1>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{display:'flex',gap:7,fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:'#1e1e2a',letterSpacing:'.1em'}}>
                  {[['photo','IMG'],['track','AUD'],['note','TXT']].map(([t,l])=><span key={t}>{l}&nbsp;{mems.filter(m=>m.type===t).length}</span>)}
                </div>
                <SyncBadge sbOk={sbOk} uploading={uploading} isReady={isReady}/>
              </div>
            </>
          )}
        </div>
        <CrewRow members={members} memberVibes={memberVibes} onVibeChange={handleVibeChange} onAdd={addMember} onRemove={removeMember} onShowQR={()=>setShowQR(true)}/>
        <EmotionSlider vibe={vibe} onChange={saveVibe}/>
      </header>

      <main style={{padding:'6px 8px',position:'relative',zIndex:1}}>
        {loading?(<div style={{textAlign:'center',padding:'80px 0',fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#111',letterSpacing:'.2em'}}>LOADING...</div>)
        :mems.length===0?(<div style={{textAlign:'center',padding:'80px 20px'}}><div style={{fontSize:38,marginBottom:12}}>🌀</div><p style={{fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:14,color:'#1a1a22',letterSpacing:'.1em'}}>BOARD EMPTY</p><p style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'#111',marginTop:8,lineHeight:1.9,letterSpacing:'.06em'}}>ADD CREW ABOVE<br/>THEN CAPTURE BELOW</p></div>)
        :(<div style={{display:'flex',gap:0,alignItems:'flex-start'}}><div style={{flex:1,minWidth:0}}>{col1.map(renderCard)}</div><div style={{flex:1,minWidth:0,marginTop:28}}>{col2.map(renderCard)}</div></div>)}
      </main>

      <div style={{position:'fixed',bottom:0,left:0,right:0,display:'flex',borderTop:`1px solid ${vc}22`,zIndex:300,background:'#020204'}}>
        {[['photo','📷','PHOTO'],['track','🎙️','TRACK'],['note','✏️','NOTE']].map(([type,icon,label])=>(
          <button key={type} onClick={()=>setModal(modal===type?null:type)} style={{flex:1,padding:'13px 0 17px',background:modal===type?`${vc}14`:'transparent',border:'none',cursor:'pointer',fontFamily:"'Chakra Petch',sans-serif",fontWeight:700,fontSize:9,letterSpacing:'.12em',color:modal===type?vc:'#272737',display:'flex',flexDirection:'column',alignItems:'center',gap:4,transition:'all .2s'}} onMouseEnter={e=>e.currentTarget.style.color=vc} onMouseLeave={e=>{if(modal!==type)e.currentTarget.style.color='#272737'}}>
            <span style={{fontSize:21}}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {modal==='photo'&&<Sheet title="// PHOTO" vc={vc} onClose={()=>setModal(null)}><AddPhoto onAdd={addMem} onClose={()=>setModal(null)} vc={vc} members={members} memberVibes={memberVibes}/></Sheet>}
      {modal==='track'&&<Sheet title="// VOICE TRACK" vc={vc} onClose={()=>setModal(null)}><AddTrack onAdd={addMem} onClose={()=>setModal(null)} vc={vc} members={members} memberVibes={memberVibes}/></Sheet>}
      {modal==='note'&&<Sheet title="// NOTE" vc={vc} onClose={()=>setModal(null)}><AddNote onAdd={addMem} onClose={()=>setModal(null)} vc={vc} members={members} memberVibes={memberVibes}/></Sheet>}
      {showQR&&<QRModal vc={vc} vibe={vibe} onClose={()=>setShowQR(false)}/>}
      {box&&(<div onClick={()=>setBox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.97)',zIndex:600,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:20}}><img src={box.imageData} alt="" style={{maxWidth:'100%',maxHeight:'80vh',objectFit:'contain',borderRadius:organicRadius(box.id),boxShadow:cardGlow(box.id,true)}}/>{box.caption&&<p style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'#555',letterSpacing:'.06em'}}>{box.caption}</p>}{getMember(box.memberId)&&<MemberBadge member={getMember(box.memberId)} vibeVal={memberVibes[box.memberId]??50}/>}<p style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:'#1a1a22',letterSpacing:'.16em'}}>TAP TO CLOSE</p></div>)}
    </div>
  )
}

export default function RaveBoard(){
  return<BoardApp/>
}
