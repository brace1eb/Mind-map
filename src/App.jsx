import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS     = ["#FBBF24","#34D399","#60A5FA","#F87171","#A78BFA","#FB923C","#38BDF8","#4ADE80"];
const INK_COLORS = ["#111111","#2563EB","#16A34A","#DC2626","#9333EA","#EA580C","#0891B2","#DB2777"];
const SHAPES     = ["circle","square","sticky"];
const GRID       = 40;
const STORAGE_KEY= "mindmap_v6";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dist2 = (a,b) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2);
const midXY = (t1,t2) => ({x:(t1.clientX+t2.clientX)/2, y:(t1.clientY+t2.clientY)/2});
const mkId  = () => "n"+Date.now()+Math.random().toString(36).slice(2,6);

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = {
  blank:     { name:"Blank",          emoji:"✦", nodes:[], edges:[] },
  marketing: { name:"Marketing Plan", emoji:"📣",
    nodes:[
      {id:"center",label:"Campaign",  x:500,y:340,color:"#FBBF24",isCenter:true, shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n1",label:"Social Media",  x:260,y:180,color:"#34D399",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n2",label:"Budget",        x:740,y:180,color:"#60A5FA",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n3",label:"Content",       x:200,y:380,color:"#F87171",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n4",label:"Analytics",     x:800,y:380,color:"#A78BFA",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n5",label:"Launch Date",   x:380,y:520,color:"#FB923C",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n6",label:"Team",          x:620,y:520,color:"#38BDF8",shape:"circle",size:1,checklist:[],dueDate:""},
    ],
    edges:["n1","n2","n3","n4","n5","n6"].map(id=>({id:"e-center-"+id,from:"center",to:id,color:"#FBBF24"}))
  },
  project: { name:"Project Brief", emoji:"📋",
    nodes:[
      {id:"center",label:"Project",    x:500,y:340,color:"#60A5FA",isCenter:true,shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n1",label:"Goals",          x:280,y:190,color:"#4ADE80",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n2",label:"Timeline",       x:720,y:190,color:"#FBBF24",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n3",label:"Resources",      x:210,y:390,color:"#FB923C",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n4",label:"Risks",          x:790,y:390,color:"#F87171",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n5",label:"Deliverables",   x:500,y:530,color:"#A78BFA",shape:"circle",size:1,checklist:[],dueDate:""},
    ],
    edges:["n1","n2","n3","n4","n5"].map(id=>({id:"e-center-"+id,from:"center",to:id,color:"#60A5FA"}))
  },
  weekly: { name:"Weekly Goals", emoji:"📅",
    nodes:[
      {id:"center",label:"This Week",x:500,y:340,color:"#34D399",isCenter:true,shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n1",label:"Monday",   x:270,y:190,color:"#FBBF24",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n2",label:"Tuesday",  x:500,y:150,color:"#60A5FA",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n3",label:"Wednesday",x:730,y:190,color:"#F87171",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n4",label:"Thursday", x:780,y:390,color:"#A78BFA",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n5",label:"Friday",   x:600,y:510,color:"#FB923C",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n6",label:"Weekend",  x:350,y:510,color:"#38BDF8",shape:"circle",size:1,checklist:[],dueDate:""},
      {id:"n7",label:"Priorities",x:200,y:390,color:"#4ADE80",shape:"circle",size:1,checklist:[],dueDate:""},
    ],
    edges:["n1","n2","n3","n4","n5","n6","n7"].map(id=>({id:"e-center-"+id,from:"center",to:id,color:"#34D399"}))
  },
};

// ─── Storage ──────────────────────────────────────────────────────────────────
function loadMaps() {
  try { const r=localStorage.getItem(STORAGE_KEY); if(r) return JSON.parse(r); } catch {}
  return null;
}
function saveMaps(maps,activeId) {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({maps,activeId})); } catch {}
}
function mkMapFromTemplate(key,name) {
  const tpl=TEMPLATES[key]||TEMPLATES.blank;
  const nodes=tpl.nodes.map(n=>({...n}));
  const edges=(tpl.edges||[]).map(e=>({...e}));
  if(!nodes.find(n=>n.isCenter))
    nodes.unshift({id:"center",label:"Your Idea",x:500,y:340,color:"#FBBF24",isCenter:true,shape:"circle",size:1,checklist:[],dueDate:""});
  return {id:mkId(),name:name||tpl.name,emoji:tpl.emoji,nodes,edges,strokes:[]};
}
function defaultMaps(){ return [mkMapFromTemplate("blank","My First Map")]; }

// ─── Ink canvas ───────────────────────────────────────────────────────────────
function InkCanvas({strokes,transform}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current; if(!c) return;
    const ctx=c.getContext("2d");
    const W=c.width, H=c.height;
    ctx.clearRect(0,0,W,H);
    const {scale,x:tx,y:ty}=transform;
    strokes.forEach(s=>{
      if(!s.points||s.points.length<1) return;
      ctx.strokeStyle=s.color||"#111";
      ctx.lineCap="round"; ctx.lineJoin="round";
      const toS=p=>({x:p.x*scale+tx, y:p.y*scale+ty});
      if(s.points.length===1){
        // single dot
        const p=toS(s.points[0]);
        ctx.beginPath();
        ctx.arc(p.x,p.y,(s.size||3)*0.5,0,Math.PI*2);
        ctx.fillStyle=s.color||"#111";
        ctx.fill();
        return;
      }
      let prev=toS(s.points[0]);
      ctx.beginPath(); ctx.moveTo(prev.x,prev.y);
      for(let i=1;i<s.points.length;i++){
        const curr=toS(s.points[i]);
        const mx=(prev.x+curr.x)/2, my=(prev.y+curr.y)/2;
        ctx.lineWidth=Math.max(0.5,(s.size||3)*(0.4+(s.points[i].p||0.5)*0.8)*Math.min(1.5,scale));
        ctx.quadraticCurveTo(prev.x,prev.y,mx,my);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx,my);
        prev=curr;
      }
      ctx.lineTo(prev.x,prev.y); ctx.stroke();
    });
  },[strokes,transform]);

  return <canvas ref={ref} width={window.innerWidth} height={window.innerHeight}
    style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:3}}/>;
}

// ─── Checklist Modal ──────────────────────────────────────────────────────────
function ChecklistModal({node,onClose,onSave}){
  const [items,setItems]=useState(node.checklist||[]);
  const [newItem,setNewItem]=useState("");
  const add=()=>{ if(newItem.trim()){setItems(p=>[...p,{id:Date.now(),text:newItem.trim(),checked:false}]);setNewItem("");} };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(240,240,245,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,backdropFilter:"blur(8px)"}}>
      <div style={{background:"#fff",border:`2px solid ${node.color}`,borderRadius:18,padding:24,width:"min(360px,90vw)",maxHeight:"78vh",display:"flex",flexDirection:"column",gap:12,boxShadow:"0 16px 50px rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{margin:0,color:node.color,fontSize:20,fontWeight:600}}>✓ {node.label}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#bbb",fontSize:22,cursor:"pointer",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {items.map(it=>(
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:9,background:"rgba(0,0,0,0.03)",borderRadius:10,padding:"10px 12px"}}>
              <input type="checkbox" checked={it.checked} onChange={()=>setItems(p=>p.map(i=>i.id===it.id?{...i,checked:!i.checked}:i))}
                style={{width:20,height:20,cursor:"pointer",accentColor:node.color,flexShrink:0}}/>
              <span style={{flex:1,color:it.checked?"#ccc":"#222",textDecoration:it.checked?"line-through":"none",fontSize:16}}>{it.text}</span>
              <button onClick={()=>setItems(p=>p.filter(i=>i.id!==it.id))}
                style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:18,minWidth:36,minHeight:36,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          ))}
          {!items.length&&<p style={{color:"#ccc",textAlign:"center",fontSize:15,padding:"12px 0"}}>No items yet!</p>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add item..."
            style={{flex:1,background:"rgba(0,0,0,0.03)",border:"1px solid #ddd",borderRadius:10,padding:"10px 13px",color:"#222",fontSize:16,outline:"none"}}/>
          <button onClick={add} style={{background:node.color,border:"none",borderRadius:10,padding:"10px 16px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:20,minWidth:48,minHeight:48}}>+</button>
        </div>
        <button onClick={()=>onSave(items)} style={{background:node.color,border:"none",borderRadius:12,padding:"12px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:17,minHeight:48}}>Save</button>
      </div>
    </div>
  );
}

// ─── Action Sheet ─────────────────────────────────────────────────────────────
function ActionSheet({node,onClose,onDelete,onAddChild,onShapeChange,onSizeChange,onChecklist,onLinkStart}){
  // close on backdrop tap
  return (
    <div style={{position:"fixed",inset:0,zIndex:3000}} onPointerDown={onClose}>
      <div onPointerDown={e=>e.stopPropagation()}
        style={{position:"absolute",bottom:0,left:0,right:0,background:"#f9f9f9",borderRadius:"20px 20px 0 0",padding:"12px 0 40px",boxShadow:"0 -4px 30px rgba(0,0,0,0.15)"}}>
        <div style={{width:40,height:4,background:"#ddd",borderRadius:2,margin:"0 auto 12px"}}/>
        <div style={{padding:"0 8px 10px",color:"#aaa",fontSize:12,letterSpacing:1,textAlign:"center",textTransform:"uppercase"}}>{node.label}</div>
        <SheetBtn icon="＋" label="Add child node"   color="#34D399" onClick={()=>{onAddChild(node.id);onClose();}}/>
        {!node.isCenter&&<>
          <SheetBtn icon="☑" label="Edit checklist"  color="#60A5FA" onClick={()=>{onChecklist(node.id);onClose();}}/>
          <SheetBtn icon="⊕" label="Draw connection" color="#A78BFA" onClick={()=>{onLinkStart(node.id);onClose();}}/>
        </>}
        <div style={{margin:"8px 16px 3px",fontSize:12,color:"#bbb",letterSpacing:1,textTransform:"uppercase"}}>Shape</div>
        <div style={{display:"flex",gap:10,padding:"4px 16px 10px"}}>
          {SHAPES.map(s=>(
            <button key={s} onPointerDown={()=>{onShapeChange(node.id,s);onClose();}}
              style={{flex:1,background:node.shape===s?node.color+"22":"#fff",border:`1.5px solid ${node.shape===s?node.color:"#ddd"}`,borderRadius:10,padding:"10px 0",color:node.shape===s?node.color:"#999",fontSize:20,cursor:"pointer",minHeight:48}}>
              {s==="circle"?"●":s==="square"?"■":"📝"}
            </button>
          ))}
        </div>
        <div style={{margin:"4px 16px 3px",fontSize:12,color:"#bbb",letterSpacing:1,textTransform:"uppercase"}}>Size</div>
        <div style={{display:"flex",gap:10,padding:"4px 16px 10px"}}>
          {[{v:0.75,l:"S"},{v:1,l:"M"},{v:1.35,l:"L"}].map(({v,l})=>(
            <button key={l} onPointerDown={()=>{onSizeChange(node.id,v);onClose();}}
              style={{flex:1,background:node.size===v?node.color+"22":"#fff",border:`1.5px solid ${node.size===v?node.color:"#ddd"}`,borderRadius:10,padding:"10px 0",color:node.size===v?node.color:"#777",fontSize:16,fontWeight:700,cursor:"pointer",minHeight:48}}>
              {l}
            </button>
          ))}
        </div>
        {!node.isCenter&&<><div style={{height:1,background:"#eee",margin:"4px 16px"}}/>
          <SheetBtn icon="🗑" label="Delete node" color="#F87171" onClick={()=>{onDelete(node.id);onClose();}}/></>}
      </div>
    </div>
  );
}
function SheetBtn({icon,label,color,onClick}){
  return (
    <button onPointerDown={onClick}
      style={{display:"flex",alignItems:"center",gap:14,width:"100%",background:"none",border:"none",padding:"13px 20px",cursor:"pointer",textAlign:"left",minHeight:52}}>
      <span style={{fontSize:20,width:28,textAlign:"center"}}>{icon}</span>
      <span style={{color:color||"#333",fontSize:17,fontWeight:500}}>{label}</span>
    </button>
  );
}

// ─── Node ─────────────────────────────────────────────────────────────────────
function MNode({node,transform,onLabel,onChecklist,onDrag,onColor,onActionSheet,onLinkStart,onLinkEnd,linkingFrom,snapToGrid,drawMode}){
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(node.label);
  const longTimer =useRef(null);
  const dragActive=useRef(false);
  const startPt   =useRef(null);
  const startWorld=useRef(null);

  const finish=()=>{ setEditing(false); onLabel(node.id,draft||node.label); };
  const checked=(node.checklist||[]).filter(i=>i.checked).length;
  const total  =(node.checklist||[]).length;
  const sz=node.size||1;
  const W=Math.round((node.isCenter?130:108)*sz);
  const H=Math.round((node.isCenter?130:96)*sz);
  const isSticky=(node.shape==="sticky");
  const br=node.shape==="circle"?"50%":node.shape==="square"?"12px":"10px";
  const sx=node.x*transform.scale+transform.x;
  const sy=node.y*transform.scale+transform.y;

  // passive display in draw mode
  if(drawMode) return (
    <div style={{position:"absolute",left:sx-W*transform.scale/2,top:sy-H*transform.scale/2,
      width:W*transform.scale,height:isSticky?(H+20)*transform.scale:H*transform.scale,
      borderRadius:br,background:"#fff",border:`2px solid ${node.color}`,
      boxShadow:`0 2px 10px ${node.color}33`,pointerEvents:"none",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      userSelect:"none",zIndex:node.isCenter?10:5}}>
      {isSticky&&<div style={{width:"100%",height:14*transform.scale,background:node.color+"55",borderRadius:"10px 10px 0 0",flexShrink:0}}/>}
      <span style={{color:"#111",fontSize:(node.isCenter?16:13)*transform.scale,textAlign:"center",padding:"0 8px",lineHeight:1.3,wordBreak:"break-word",maxWidth:"90%"}}>{node.label}</span>
      {total>0&&<div style={{marginTop:3,background:node.color,borderRadius:20,padding:`${2*transform.scale}px ${7*transform.scale}px`,color:"#fff",fontSize:10*transform.scale,fontWeight:700}}>{checked}/{total}</div>}
    </div>
  );

  const handlePointerDown=e=>{
    if(editing) return;
    if(linkingFrom!==null){ onLinkEnd(node.id); return; }
    if(e.button!==undefined&&e.button!==0) return;
    e.stopPropagation();
    dragActive.current=false;
    startPt.current={x:e.clientX,y:e.clientY};
    startWorld.current={x:node.x,y:node.y};

    longTimer.current=setTimeout(()=>{
      if(!dragActive.current) onActionSheet({x:e.clientX,y:e.clientY},node);
    },550);

    const onMove=me=>{
      if(!startPt.current) return;
      const dx=me.clientX-startPt.current.x, dy=me.clientY-startPt.current.y;
      if(!dragActive.current&&Math.sqrt(dx*dx+dy*dy)>6){
        dragActive.current=true;
        clearTimeout(longTimer.current);
      }
      if(dragActive.current){
        let nx=startWorld.current.x+dx/transform.scale;
        let ny=startWorld.current.y+dy/transform.scale;
        if(snapToGrid){nx=Math.round(nx/GRID)*GRID;ny=Math.round(ny/GRID)*GRID;}
        onDrag(node.id,nx,ny);
      }
    };
    const onUp=()=>{
      clearTimeout(longTimer.current);
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",onUp);
      if(!dragActive.current) setTimeout(()=>{setEditing(true);setDraft(node.label);},60);
      startPt.current=null;
    };
    window.addEventListener("pointermove",onMove,{passive:true});
    window.addEventListener("pointerup",onUp);
  };

  return (
    <div onPointerDown={handlePointerDown}
      onContextMenu={e=>{e.preventDefault();e.stopPropagation();onActionSheet({x:e.clientX,y:e.clientY},node);}}
      style={{position:"absolute",left:sx-W*transform.scale/2,top:sy-H*transform.scale/2,
        width:W*transform.scale,height:isSticky?(H+20)*transform.scale:H*transform.scale,
        borderRadius:br,background:"#fff",border:`2px solid ${node.color}`,
        boxShadow:node.isCenter?`0 2px 16px ${node.color}55`:`0 2px 10px ${node.color}33`,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        cursor:editing?"text":linkingFrom!==null?"crosshair":"grab",
        userSelect:"none",touchAction:"none",zIndex:node.isCenter?10:5,
        outline:linkingFrom===node.id?`2px dashed ${node.color}`:"none"}}>
      {isSticky&&<div style={{width:"100%",height:14*transform.scale,background:node.color+"55",borderRadius:"10px 10px 0 0",flexShrink:0}}/>}
      {editing?(
        <>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();finish();}}}
            autoFocus style={{width:"80%",background:"transparent",border:"none",outline:"none",color:"#111",
              fontSize:(node.isCenter?16:13)*transform.scale,textAlign:"center",resize:"none",overflow:"hidden",lineHeight:1.3}} rows={2}/>
          {/* Floating Done button — sits above the iPad keyboard */}
          <div onPointerDown={e=>{e.stopPropagation();finish();}}
            style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",
              background:node.color,borderRadius:24,padding:"12px 40px",
              color:"#fff",fontSize:17,fontWeight:700,zIndex:9999,
              boxShadow:"0 4px 20px rgba(0,0,0,0.2)",cursor:"pointer",touchAction:"none"}}>
            Done
          </div>
        </>
      ):(
        <span style={{color:"#111",fontSize:(node.isCenter?16:13)*transform.scale,textAlign:"center",
          padding:"0 8px",lineHeight:1.3,wordBreak:"break-word",maxWidth:"90%",pointerEvents:"none"}}>{node.label}</span>
      )}
      {node.dueDate&&<div style={{color:node.color,fontSize:10*transform.scale,marginTop:2,opacity:0.85,pointerEvents:"none"}}>📅 {node.dueDate}</div>}
      {!node.isCenter&&(
        <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onChecklist(node.id)}
          style={{marginTop:3,background:total>0?node.color:"rgba(0,0,0,0.07)",border:"none",borderRadius:20,
            padding:`${Math.max(2,2*transform.scale)}px ${Math.max(7,7*transform.scale)}px`,
            color:total>0?"#fff":"#888",fontSize:Math.max(10,10*transform.scale),cursor:"pointer",fontWeight:700,minHeight:24}}>
          {total>0?`✓ ${checked}/${total}`:"☑"}
        </button>
      )}
      {/* colour swatches */}
      <div style={{position:"absolute",bottom:Math.max(4,5*transform.scale),right:Math.max(4,6*transform.scale),display:"flex",gap:3}}>
        {COLORS.slice(0,4).map(c=>(
          <div key={c} onPointerDown={e=>{e.stopPropagation();onColor(node.id,c);}}
            style={{width:Math.max(8,7*transform.scale),height:Math.max(8,7*transform.scale),borderRadius:"50%",
              background:c,cursor:"pointer",opacity:node.color===c?1:0.3,border:node.color===c?"1.5px solid #fff":"none"}}/>
        ))}
      </div>
      {/* link handle */}
      <div onPointerDown={e=>{e.stopPropagation();onLinkStart(node.id);}}
        style={{position:"absolute",top:-10*transform.scale,right:-10*transform.scale,
          width:Math.max(24,16*transform.scale),height:Math.max(24,16*transform.scale),
          borderRadius:"50%",background:node.color,border:"2px solid #fff",cursor:"crosshair",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:Math.max(10,9*transform.scale),color:"#fff",fontWeight:700,
          boxShadow:"0 1px 4px rgba(0,0,0,0.2)",touchAction:"none",zIndex:20}}>⊕</div>
    </div>
  );
}

// ─── SVG Lines ────────────────────────────────────────────────────────────────
function Lines({nodes,edges,transform}){
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:2}}>
      <defs>{edges.map(e=>(
        <marker key={e.id} id={`a${e.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={e.color+"99"}/>
        </marker>
      ))}</defs>
      {edges.map(e=>{
        const f=nodes.find(n=>n.id===e.from),t=nodes.find(n=>n.id===e.to);
        if(!f||!t) return null;
        const {scale,x:tx,y:ty}=transform;
        const fx=f.x*scale+tx, fy=f.y*scale+ty;
        const ex=t.x*scale+tx, ey=t.y*scale+ty;
        const dx=ex-fx,dy=ey-fy,d=Math.sqrt(dx*dx+dy*dy)||1;
        const ux=dx/d,uy=dy/d;
        const r1=(f.isCenter?65:52)*(f.size||1)*scale;
        const r2=52*(t.size||1)*scale;
        return <line key={e.id} x1={fx+ux*r1} y1={fy+uy*r1} x2={ex-ux*r2} y2={ey-uy*r2}
          stroke={e.color+"66"} strokeWidth={1.5} strokeDasharray="5,4" markerEnd={`url(#a${e.id})`}/>;
      })}
    </svg>
  );
}

// ─── Maps Home ────────────────────────────────────────────────────────────────
function MapsHome({maps,activeId,onSelect,onNew,onDelete,onClose}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(240,240,245,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,backdropFilter:"blur(10px)"}}>
      <div style={{background:"#fff",border:"1px solid #e8e8e8",borderRadius:20,padding:24,width:"min(520px,94vw)",maxHeight:"85vh",display:"flex",flexDirection:"column",gap:16,boxShadow:"0 16px 50px rgba(0,0,0,0.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h2 style={{margin:0,fontSize:22,fontWeight:700}}>✦ My Maps</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#bbb",fontSize:22,cursor:"pointer",minWidth:44,minHeight:44}}>✕</button>
        </div>
        <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
          {maps.map(m=>(
            <div key={m.id} onClick={()=>onSelect(m.id)}
              style={{display:"flex",alignItems:"center",gap:12,background:m.id===activeId?"#f0f7ff":"#fafafa",
                border:`1.5px solid ${m.id===activeId?"#60A5FA":"#eee"}`,borderRadius:12,padding:"13px 16px",cursor:"pointer"}}>
              <span style={{fontSize:24}}>{m.emoji||"✦"}</span>
              <div style={{flex:1}}>
                <div style={{color:"#222",fontSize:17,fontWeight:500}}>{m.name}</div>
                <div style={{color:"#bbb",fontSize:12,marginTop:2}}>{(m.nodes||[]).length} nodes · {(m.strokes||[]).length} strokes</div>
              </div>
              {m.id===activeId&&<span style={{color:"#60A5FA",fontSize:12,fontWeight:600}}>active</span>}
              {maps.length>1&&(
                <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete(m.id);}}
                  style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:18,minWidth:40,minHeight:40}}>🗑</button>
              )}
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid #f0f0f0",paddingTop:14}}>
          <p style={{color:"#bbb",fontSize:13,margin:"0 0 10px"}}>Start from a template:</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {Object.entries(TEMPLATES).map(([key,t])=>(
              <button key={key} onClick={()=>onNew(key)}
                style={{background:"#f5f5f5",border:"1px solid #e8e8e8",borderRadius:10,padding:"9px 14px",
                  color:"#555",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6,minHeight:44}}>
                <span>{t.emoji}</span>{t.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  // BUG FIX: use lazy initialiser so loadMaps() only runs once
  const [maps,     setMaps]    =useState(()=>{ const s=loadMaps(); return s?.maps||defaultMaps(); });
  const [activeId, setActiveId]=useState(()=>{ const s=loadMaps(); return s?.activeId||s?.maps?.[0]?.id||null; });
  const [showHome, setShowHome]=useState(false);
  const [checklistTarget,setChecklistTarget]=useState(null);
  const [actionSheet,    setActionSheet]    =useState(null);
  const [toast,    setToast]   =useState(null);
  const [snapGrid, setSnapGrid]=useState(false);
  const [linkingFrom,setLinkingFrom]=useState(null);
  const [transform,setTransform]=useState({x:0,y:0,scale:1});
  const [drawMode, setDrawMode]=useState(false);
  const [inkColor, setInkColor]=useState("#111111");
  const [inkSize,  setInkSize] =useState(3);
  const [isErasing,setIsErasing]=useState(false);

  const canvasRef     =useRef(null);
  const panState      =useRef(null);
  const pinchState    =useRef(null);
  const currentStroke =useRef(null);
  const activePointers=useRef(new Map());
  // BUG FIX: keep transform in a ref so touch handlers always read the latest value
  const transformRef  =useRef(transform);
  const drawModeRef   =useRef(drawMode);
  const inkColorRef   =useRef(inkColor);
  const inkSizeRef    =useRef(inkSize);
  const isErasingRef  =useRef(isErasing);

  useEffect(()=>{ transformRef.current=transform; },[transform]);
  useEffect(()=>{ drawModeRef.current=drawMode; },[drawMode]);
  useEffect(()=>{ inkColorRef.current=inkColor; },[inkColor]);
  useEffect(()=>{ inkSizeRef.current=inkSize; },[inkSize]);
  useEffect(()=>{ isErasingRef.current=isErasing; },[isErasing]);

  const active =maps.find(m=>m.id===activeId)||maps[0];
  const nodes  =active?.nodes||[];
  const edges  =active?.edges||[];
  const strokes=active?.strokes||[];

  useEffect(()=>{ saveMaps(maps,activeId); },[maps,activeId]);

  const showToast=msg=>{ setToast(msg); setTimeout(()=>setToast(null),2000); };
  const updateMap=useCallback(fn=>setMaps(ms=>ms.map(m=>m.id===activeId?fn(m):m)),[activeId]);
  const setNodes =useCallback(cb=>updateMap(m=>({...m,nodes:typeof cb==="function"?cb(m.nodes):cb})),[updateMap]);
  const setEdges =useCallback(cb=>updateMap(m=>({...m,edges:typeof cb==="function"?cb(m.edges):cb})),[updateMap]);
  const setStrokes=useCallback(cb=>updateMap(m=>({...m,strokes:typeof cb==="function"?cb(m.strokes||[]):cb})),[updateMap]);

  const updateLabel=(id,label)=>setNodes(ns=>ns.map(n=>n.id===id?{...n,label}:n));
  const updateColor=(id,color)=>{ setNodes(ns=>ns.map(n=>n.id===id?{...n,color}:n)); setEdges(es=>es.map(e=>e.to===id?{...e,color}:e)); };
  const updatePos  =(id,x,y)  =>setNodes(ns=>ns.map(n=>n.id===id?{...n,x,y}:n));
  const updateShape=(id,shape)=>setNodes(ns=>ns.map(n=>n.id===id?{...n,shape}:n));
  const updateSize =(id,size) =>setNodes(ns=>ns.map(n=>n.id===id?{...n,size}:n));

  const addNode=useCallback(parentId=>{
    setMaps(ms=>{
      const map=ms.find(m=>m.id===activeId)||ms[0];
      if(!map) return ms;
      const nodes=map.nodes||[];
      const parent=nodes.find(n=>n.id===parentId)||nodes.find(n=>n.isCenter);
      if(!parent) return ms;
      const angle=Math.random()*Math.PI*2, r=190+Math.random()*50;
      const newId=mkId(), color=COLORS[nodes.length%COLORS.length];
      const x=parent.x+Math.cos(angle)*r, y=parent.y+Math.sin(angle)*r;
      const newNode={id:newId,label:"New Idea",x,y,color,shape:"circle",size:1,checklist:[],dueDate:""};
      const newEdge={id:"e-"+parentId+"-"+newId,from:parentId,to:newId,color};
      return ms.map(m=>m.id===(map.id)?{...m,nodes:[...nodes,newNode],edges:[...(m.edges||[]),newEdge]}:m);
    });
  },[activeId]);

  const deleteNode=useCallback(id=>{
    setMaps(ms=>ms.map(m=>{
      if(m.id!==activeId) return m;
      const edges=m.edges||[];
      const toDelete=new Set([id]); let changed=true;
      while(changed){changed=false;edges.forEach(e=>{if(toDelete.has(e.from)&&!toDelete.has(e.to)){toDelete.add(e.to);changed=true;}});}
      return {...m,nodes:(m.nodes||[]).filter(n=>!toDelete.has(n.id)),edges:edges.filter(e=>!toDelete.has(e.from)&&!toDelete.has(e.to))};
    }));
    showToast("Deleted");
  },[activeId]);

  const saveChecklist=(id,items)=>{ setNodes(ns=>ns.map(n=>n.id===id?{...n,checklist:items}:n)); setChecklistTarget(null); };
  const handleLinkStart=id=>setLinkingFrom(id);
  const handleLinkEnd  =useCallback(id=>{
    setLinkingFrom(prev=>{
      if(prev&&prev!==id){
        setMaps(ms=>ms.map(m=>{
          if(m.id!==activeId) return m;
          const already=(m.edges||[]).find(e=>(e.from===prev&&e.to===id)||(e.from===id&&e.to===prev));
          if(already) return m;
          const fromNode=(m.nodes||[]).find(n=>n.id===prev);
          return {...m,edges:[...(m.edges||[]),{id:"e-"+prev+"-"+id+"-"+Date.now(),from:prev,to:id,color:fromNode?.color||"#888"}]};
        }));
      }
      return null;
    });
  },[activeId]);

  // ── Unified draw handler (attached imperatively to avoid stale closures) ──
  const screenToWorld=useCallback((x,y)=>{
    const tr=transformRef.current;
    return {x:(x-tr.x)/tr.scale, y:(y-tr.y)/tr.scale};
  },[]);

  useEffect(()=>{
    const el=canvasRef.current; if(!el) return;
    const rect=()=>el.getBoundingClientRect();

    // ── pointer draw ──
    const onPtrDown=e=>{
      if(!drawModeRef.current) return;
      activePointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.current.size>=2){ currentStroke.current=null; return; }
      try { e.target.setPointerCapture(e.pointerId); } catch{}
      const pt=screenToWorld(e.clientX,e.clientY);
      const pressure=e.pressure>0?e.pressure:0.5;
      if(isErasingRef.current){
        const er=20/transformRef.current.scale;
        setStrokes(ss=>ss.filter(s=>!s.points.some(p=>dist2(p,pt)<er)));
        currentStroke.current={erase:true};
      } else {
        currentStroke.current={id:mkId(),color:inkColorRef.current,size:inkSizeRef.current,points:[{...pt,p:pressure}]};
      }
    };
    const onPtrMove=e=>{
      if(!drawModeRef.current) return;
      activePointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.current.size>=2){ currentStroke.current=null; return; }
      if(!currentStroke.current) return;
      const pt=screenToWorld(e.clientX,e.clientY);
      const pressure=e.pressure>0?e.pressure:0.5;
      if(currentStroke.current.erase){
        const er=20/transformRef.current.scale;
        setStrokes(ss=>ss.filter(s=>!s.points.some(p=>dist2(p,pt)<er)));
      } else {
        currentStroke.current.points.push({...pt,p:pressure});
        const snap={...currentStroke.current,points:[...currentStroke.current.points]};
        setStrokes(ss=>{
          const idx=ss.findIndex(s=>s.id===snap.id);
          if(idx===-1) return [...ss,snap];
          const next=[...ss]; next[idx]=snap; return next;
        });
      }
    };
    const onPtrUp=e=>{
      activePointers.current.delete(e.pointerId);
      if(!drawModeRef.current||!currentStroke.current) return;
      if(!currentStroke.current.erase&&currentStroke.current.points?.length>0){
        const snap={...currentStroke.current,points:[...currentStroke.current.points]};
        setStrokes(ss=>{
          const idx=ss.findIndex(s=>s.id===snap.id);
          if(idx===-1) return [...ss,snap];
          const next=[...ss]; next[idx]=snap; return next;
        });
      }
      currentStroke.current=null;
    };

    // ── touch pan / pinch ──
    const onTouchStart=e=>{
      if(e.touches.length===1){
        const t=e.touches[0], tr=transformRef.current;
        panState.current={sx:t.clientX,sy:t.clientY,tx:tr.x,ty:tr.y};
        pinchState.current=null;
      } else if(e.touches.length===2){
        panState.current=null;
        const [t1,t2]=e.touches, tr=transformRef.current;
        pinchState.current={dist:dist2({x:t1.clientX,y:t1.clientY},{x:t2.clientX,y:t2.clientY}),scale:tr.scale,tx:tr.x,ty:tr.y};
      }
    };
    const onTouchMove=e=>{
      e.preventDefault();
      if(e.touches.length===1&&panState.current){
        const t=e.touches[0],p=panState.current;
        setTransform(tr=>({...tr,x:p.tx+(t.clientX-p.sx),y:p.ty+(t.clientY-p.sy)}));
      } else if(e.touches.length===2&&pinchState.current){
        const [t1,t2]=e.touches,p=pinchState.current;
        const nd=dist2({x:t1.clientX,y:t1.clientY},{x:t2.clientX,y:t2.clientY});
        const ns=Math.min(3,Math.max(0.2,p.scale*(nd/(p.dist||1))));
        const mid=midXY(t1,t2),r=rect();
        const mx=mid.x-r.left,my=mid.y-r.top;
        setTransform({scale:ns,x:mx-(mx-p.tx)*ns/p.scale,y:my-(my-p.ty)*ns/p.scale});
      }
    };
    const onTouchEnd=e=>{
      if(e.touches.length===0){panState.current=null;pinchState.current=null;}
      else if(e.touches.length===1){pinchState.current=null;
        // restart pan from new single touch after pinch
        const t=e.touches[0],tr=transformRef.current;
        panState.current={sx:t.clientX,sy:t.clientY,tx:tr.x,ty:tr.y};
      }
    };
    const onWheel=e=>{
      e.preventDefault();
      const f=e.deltaY<0?1.1:0.91, r=rect();
      setTransform(t=>{const ns=Math.min(3,Math.max(0.2,t.scale*f));return{scale:ns,x:(e.clientX-r.left)-(e.clientX-r.left-t.x)*ns/t.scale,y:(e.clientY-r.top)-(e.clientY-r.top-t.y)*ns/t.scale};});
    };

    el.addEventListener("pointerdown", onPtrDown,  {passive:true});
    el.addEventListener("pointermove", onPtrMove,  {passive:true});
    el.addEventListener("pointerup",   onPtrUp,    {passive:true});
    el.addEventListener("pointercancel",onPtrUp,   {passive:true});
    el.addEventListener("touchstart",  onTouchStart,{passive:true});
    el.addEventListener("touchmove",   onTouchMove, {passive:false});
    el.addEventListener("touchend",    onTouchEnd,  {passive:true});
    el.addEventListener("wheel",       onWheel,     {passive:false});
    return()=>{
      el.removeEventListener("pointerdown", onPtrDown);
      el.removeEventListener("pointermove", onPtrMove);
      el.removeEventListener("pointerup",   onPtrUp);
      el.removeEventListener("pointercancel",onPtrUp);
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("wheel",       onWheel);
    };
  // mount once; all state read via refs
  },[screenToWorld,setStrokes]);

  const createMap=key=>{ const m=mkMapFromTemplate(key||"blank");setMaps(ms=>[...ms,m]);setActiveId(m.id);setTransform({x:0,y:0,scale:1});setShowHome(false);showToast(`Created "${m.name}"`); };
  const selectMap=id=>{ setActiveId(id);setTransform({x:0,y:0,scale:1});setShowHome(false); };
  const deleteMap=id=>{ if(maps.length<=1){showToast("Can't delete last map");return;} setMaps(ms=>ms.filter(m=>m.id!==id));if(activeId===id)setActiveId(maps.find(m=>m.id!==id)?.id); };
  const undoStroke=()=>setStrokes(ss=>ss.slice(0,-1));
  const clearInk  =()=>{ setStrokes([]); showToast("Ink cleared"); };
  const resetView =()=>setTransform({x:0,y:0,scale:1});

  const exportImage=useCallback(()=>{
    const W=1400,H=900,cv=document.createElement("canvas"); cv.width=W;cv.height=H;
    const cx=cv.getContext("2d");
    cx.fillStyle="#fff";cx.fillRect(0,0,W,H);
    strokes.forEach(s=>{
      if(!s.points||!s.points.length) return;
      cx.strokeStyle=s.color||"#111";cx.lineCap="round";cx.lineJoin="round";
      if(s.points.length===1){cx.beginPath();cx.arc(s.points[0].x,s.points[0].y,(s.size||3)*0.5,0,Math.PI*2);cx.fillStyle=s.color||"#111";cx.fill();return;}
      let prev=s.points[0]; cx.beginPath();cx.moveTo(prev.x,prev.y);
      for(let i=1;i<s.points.length;i++){
        const curr=s.points[i];
        cx.lineWidth=Math.max(0.5,(s.size||3)*(0.4+(curr.p||0.5)*0.8));
        cx.quadraticCurveTo(prev.x,prev.y,(prev.x+curr.x)/2,(prev.y+curr.y)/2);
        cx.stroke();cx.beginPath();cx.moveTo((prev.x+curr.x)/2,(prev.y+curr.y)/2);prev=curr;
      }
      cx.stroke();
    });
    edges.forEach(e=>{
      const f=nodes.find(n=>n.id===e.from),t=nodes.find(n=>n.id===e.to);if(!f||!t) return;
      const dx=t.x-f.x,dy=t.y-f.y,d=Math.sqrt(dx*dx+dy*dy)||1,ux=dx/d,uy=dy/d;
      cx.beginPath();cx.strokeStyle=e.color+"66";cx.lineWidth=1.5;cx.setLineDash([5,4]);
      cx.moveTo(f.x+ux*67,f.y+uy*67);cx.lineTo(t.x-ux*55,t.y-uy*55);cx.stroke();cx.setLineDash([]);
    });
    nodes.forEach(n=>{
      const r=(n.isCenter?67:55)*(n.size||1);
      cx.beginPath();cx.arc(n.x,n.y,r,0,Math.PI*2);cx.fillStyle="#fff";cx.fill();cx.strokeStyle=n.color;cx.lineWidth=2.5;cx.stroke();
      cx.fillStyle="#111";cx.font=`${n.isCenter?18:15}px system-ui,sans-serif`;cx.textAlign="center";cx.textBaseline="middle";cx.fillText(n.label,n.x,n.y);
    });
    const a=document.createElement("a");a.download=`${active?.name||"mindmap"}.png`;a.href=cv.toDataURL();a.click();
    showToast("Exported!");
  },[nodes,edges,strokes,active]);

  const targetNode=checklistTarget?nodes.find(n=>n.id===checklistTarget):null;
  const centerNode=nodes.find(n=>n.isCenter);

  return (
    <div style={{width:"100vw",height:"100vh",background:"#fff",overflow:"hidden",position:"relative",WebkitUserSelect:"none",userSelect:"none"}}>

      {/* Toolbar */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"linear-gradient(to bottom,#fffffff5,transparent)",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setShowHome(true)}
            style={{background:"rgba(0,0,0,0.04)",border:"1px solid #e0e0e0",borderRadius:10,padding:"8px 13px",color:"#555",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6,minHeight:44}}>
            ☰ <span style={{maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{active?.emoji} {active?.name}</span>
          </button>
          <div style={{display:"flex",background:"#f0f0f0",borderRadius:10,padding:3,gap:2}}>
            <MBtn active={!drawMode}           onClick={()=>{setDrawMode(false);}}>✋</MBtn>
            <MBtn active={drawMode&&!isErasing} onClick={()=>{setDrawMode(true);setIsErasing(false);}}>✏️</MBtn>
            <MBtn active={drawMode&&isErasing}  onClick={()=>{setDrawMode(true);setIsErasing(true);}}>⬜</MBtn>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
          {drawMode&&!isErasing&&(
            <div style={{display:"flex",gap:4,alignItems:"center",background:"#f9f9f9",border:"1px solid #eee",borderRadius:10,padding:"6px 10px"}}>
              {INK_COLORS.map(c=>(
                <div key={c} onClick={()=>setInkColor(c)}
                  style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",
                    border:inkColor===c?"2.5px solid #333":"2px solid transparent",boxSizing:"border-box"}}/>
              ))}
              <div style={{width:1,height:20,background:"#e0e0e0",margin:"0 4px"}}/>
              {[2,4,7].map(s=>(
                <div key={s} onClick={()=>setInkSize(s)}
                  style={{width:Math.max(20,s*3+8),height:Math.max(20,s*3+8),borderRadius:"50%",background:inkColor,
                    cursor:"pointer",opacity:inkSize===s?1:0.3,border:inkSize===s?"2px solid #333":"2px solid transparent",boxSizing:"border-box"}}/>
              ))}
            </div>
          )}
          {drawMode&&<Btn color="#F87171" onClick={undoStroke}>↩</Btn>}
          {drawMode&&<Btn color="#888"    onClick={clearInk}>Clear</Btn>}
          {!drawMode&&<Btn color="#34D399" onClick={()=>addNode(centerNode?.id||"center")}>+ Node</Btn>}
          {!drawMode&&<Btn color="#FBBF24" onClick={()=>setSnapGrid(s=>!s)} active={snapGrid}>⊞</Btn>}
          <Btn color="#60A5FA" onClick={resetView}>⟳</Btn>
          <Btn color="#A78BFA" onClick={exportImage}>↓</Btn>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",touchAction:"none",cursor:drawMode?(isErasing?"cell":"crosshair"):"default"}}>
        {snapGrid?(
          <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}}>
            <defs><pattern id="grid" width={GRID*transform.scale} height={GRID*transform.scale}
              x={transform.x%(GRID*transform.scale)} y={transform.y%(GRID*transform.scale)} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID*transform.scale} 0 L 0 0 0 ${GRID*transform.scale}`} fill="none" stroke="#00000010" strokeWidth="0.5"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        ):(
          <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:"radial-gradient(circle,#00000012 1px,transparent 1px)",backgroundSize:"32px 32px"}}/>
        )}

        <InkCanvas strokes={strokes} transform={transform}/>
        <Lines nodes={nodes} edges={edges} transform={transform}/>

        {nodes.map(n=>(
          <MNode key={n.id} node={n} transform={transform} drawMode={drawMode}
            onLabel={updateLabel} onChecklist={setChecklistTarget} onDrag={updatePos} onColor={updateColor}
            onActionSheet={(pt,node)=>setActionSheet({pt,node})}
            onLinkStart={handleLinkStart} onLinkEnd={handleLinkEnd}
            linkingFrom={linkingFrom} snapToGrid={snapGrid}/>
        ))}

        {drawMode&&(
          <div style={{position:"fixed",bottom:60,left:"50%",transform:"translateX(-50%)",background:"#fff",
            border:"1px solid #ddd",borderRadius:20,padding:"8px 20px",color:"#888",fontSize:13,
            zIndex:300,pointerEvents:"none",boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}>
            {isErasing?"Eraser — draw over strokes to erase":"Finger or Pencil to draw · 2 fingers to pan & zoom · ✋ to move nodes"}
          </div>
        )}
        {linkingFrom&&!drawMode&&(
          <div style={{position:"fixed",bottom:60,left:"50%",transform:"translateX(-50%)",background:"#fff",
            border:"1px solid #60A5FA88",borderRadius:20,padding:"9px 22px",color:"#60A5FA",fontSize:14,
            zIndex:200,pointerEvents:"none",boxShadow:"0 2px 12px rgba(0,0,0,0.1)"}}>
            Tap another node to connect · tap canvas to cancel
          </div>
        )}
      </div>

      {actionSheet&&<ActionSheet node={actionSheet.node} onClose={()=>setActionSheet(null)}
        onDelete={deleteNode} onAddChild={addNode} onShapeChange={updateShape} onSizeChange={updateSize}
        onChecklist={setChecklistTarget} onLinkStart={handleLinkStart}/>}
      {targetNode&&<ChecklistModal node={targetNode} onClose={()=>setChecklistTarget(null)} onSave={items=>saveChecklist(targetNode.id,items)}/>}
      {showHome&&<MapsHome maps={maps} activeId={activeId} onSelect={selectMap} onNew={createMap} onDelete={deleteMap} onClose={()=>setShowHome(false)}/>}
      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#fff",border:"1px solid #ddd",borderRadius:20,padding:"8px 22px",color:"#555",fontSize:14,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",pointerEvents:"none"}}>{toast}</div>}
      <div style={{position:"absolute",bottom:12,right:16,color:"#ccc",fontSize:11}}>{Math.round(transform.scale*100)}% · auto-saved</div>
    </div>
  );
}

function Btn({color,onClick,children,active}){
  return <button onClick={onClick} style={{background:active?color+"22":"#fff",border:`1.5px solid ${active?color:color+"66"}`,borderRadius:10,padding:"8px 14px",color,fontSize:14,cursor:"pointer",minHeight:44,minWidth:44,fontWeight:500,flexShrink:0}}>{children}</button>;
}
function MBtn({active,onClick,children}){
  return <button onClick={onClick} style={{background:active?"#fff":"transparent",border:"none",borderRadius:8,padding:"6px 10px",fontSize:18,cursor:"pointer",minWidth:40,minHeight:36,boxShadow:active?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>{children}</button>;
}
