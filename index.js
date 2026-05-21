import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORIES = {
  work:     { label: "工作",   color: "#4f8ef7", icon: "💼" },
  family:   { label: "家庭",   color: "#f97066", icon: "🏠" },
  routine:  { label: "例行",   color: "#4fc18e", icon: "🔄" },
  personal: { label: "個人",   color: "#c97ef9", icon: "⭐" },
};

const DAYS_ZH   = ["日","一","二","三","四","五","六"];
const MONTHS_ZH = ["一","二","三","四","五","六","七","八","九","十","十一","十二"];

const STATUS = {
  pending: { label: "待執行", color: "#f59e0b", icon: "⏳" },
  done:    { label: "已完成", color: "#4fc18e", icon: "✅" },
  skipped: { label: "未執行", color: "#f97066", icon: "❌" },
  partial: { label: "部分完成", color: "#c97ef9", icon: "🔶" },
};

const SEED_EVENTS = [
  { id:1, title:"強迫自己 11 點熄燈睡覺",       date:"2026-05-21", time:"23:00", endTime:"23:15", category:"routine",  status:"pending", note:"每晚強迫配合熄燈，準時就寢",         repeat:"daily"  },
  { id:2, title:"睡前閱讀 30min + 聖訓 15min",  date:"2026-05-21", time:"22:00", endTime:"22:45", category:"personal", status:"pending", note:"每晚看書半小時，聖訓 15 分鐘",       repeat:"daily"  },
  { id:3, title:"早起 6 點 — 超慢跑／冥想（輪流）", date:"2026-05-21", time:"06:00", endTime:"06:45", category:"routine",  status:"pending", note:"每早 6 點起床，超慢跑與冥想輪流進行", repeat:"daily"  },
  { id:4, title:"健身房 / 跑步機",              date:"2026-05-21", time:"19:45", endTime:"20:45", category:"routine",  status:"pending", note:"每週去健身房或跑步機（週一、三、五）",  repeat:"weekly" },
  { id:5, title:"午間伸展 10min",              date:"2026-05-21", time:"12:30", endTime:"12:40", category:"routine",  status:"pending", note:"每天中午伸展 10 分鐘，活動筋骨",      repeat:"daily"  },
];

let _nextId = 200;
function newId() { return ++_nextId; }

function fmt(d)          { return d.toISOString().slice(0,10); }
function today()         { return fmt(new Date()); }
function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function firstWeekday(y,m){ return new Date(y,m,1).getDay(); }

// ── localStorage helpers ───────────────────────────────────────────────────
const LS_KEY = "myCalendarEvents_v1";
function loadEvents() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch(_) {}
  return SEED_EVENTS;
}
function saveEvents(evs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(evs)); } catch(_) {}
}

// ── Voice / AI Modal ───────────────────────────────────────────────────────
function VoiceModal({ onClose, onConfirm }) {
  const [transcript, setTranscript] = useState("");
  const [manual, setManual]         = useState("");
  const [listening, setListening]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [parsed, setParsed]         = useState(null);
  const [mode, setMode]             = useState("plan"); // plan | record
  const recRef = useRef(null);

  const startListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("瀏覽器不支援語音辨識，請手動輸入"); return; }
    const r = new SR();
    r.lang = "zh-TW"; r.continuous = false; r.interimResults = false;
    r.onresult = e => setTranscript(e.results[0][0].transcript);
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
  };
  const stopListen = () => { recRef.current?.stop(); setListening(false); };

  const analyze = async () => {
    const text = transcript || manual;
    if (!text.trim()) return;
    setLoading(true);
    const sys = `你是行事曆助理，從口語描述提取活動資訊。今天是 ${today()}。
回傳純 JSON，欄位：title, date(YYYY-MM-DD), time(HH:MM), endTime(HH:MM),
category("work"|"family"|"routine"|"personal"), status("pending"|"done"|"skipped"|"partial"), note, repeat("none"|"daily"|"weekly"|"monthly")。
不要任何說明或 markdown。`;
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:500,
          system: sys, messages:[{role:"user",content:text}] })
      });
      const data = await res.json();
      const raw  = data.content?.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
      setParsed(JSON.parse(raw));
    } catch(e) { alert("AI 解析失敗，請手動填寫"); }
    setLoading(false);
  };

  const inp = { background:"#1a1e28", border:"1px solid #2a2f3d", borderRadius:8,
    color:"#e8eaf0", padding:"8px 12px", fontSize:14, width:"100%", boxSizing:"border-box" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#12151c",border:"1px solid #2a2f3d",borderRadius:"20px 20px 0 0",
        padding:"24px 20px 40px",width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{margin:0,color:"#e8eaf0",fontSize:17}}>🎙️ AI 語音輸入</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
        </div>

        {/* Mode */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["plan","📅 安排活動"],["record","📋 記錄執行"]].map(([v,l])=>(
            <button key={v} onClick={()=>setMode(v)} style={{flex:1,padding:"9px 0",borderRadius:10,
              border:"1px solid", cursor:"pointer", fontSize:13, fontWeight:600,
              background:mode===v?"#4f8ef7":"transparent", borderColor:mode===v?"#4f8ef7":"#2a2f3d",
              color:mode===v?"#fff":"#888"}}>{l}</button>
          ))}
        </div>

        <p style={{color:"#666",fontSize:13,marginBottom:14}}>
          {mode==="plan"
            ? "說出活動，例如：「明天下午3點和客戶開會」"
            : "描述執行情況，例如：「今天晨跑完成了，跑了30分鐘」"}
        </p>

        {/* Mic */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <button onClick={listening?stopListen:startListen} style={{
            width:70,height:70,borderRadius:"50%",border:"none",cursor:"pointer",fontSize:26,
            background:listening?"radial-gradient(circle,#f97066,#c0392b)":"radial-gradient(circle,#4f8ef7,#1a3a8a)",
            boxShadow:listening?"0 0 0 10px rgba(249,112,102,.2)":"0 0 0 4px rgba(79,142,247,.2)"
          }}>{listening?"⏹":"🎙️"}</button>
        </div>

        <textarea value={transcript||manual} onChange={e=>{setTranscript("");setManual(e.target.value);}}
          placeholder="語音結果會顯示在此，或直接手動輸入..."
          style={{...inp,minHeight:72,resize:"vertical",fontFamily:"inherit",marginBottom:10}}/>

        <button onClick={analyze} disabled={loading||(!transcript&&!manual)} style={{
          width:"100%",padding:12,borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,
          background:loading?"#2a2f3d":"linear-gradient(135deg,#4f8ef7,#7c5cfc)",color:"#fff",
          opacity:(!transcript&&!manual)?0.5:1}}>
          {loading?"🤖 AI 分析中...":"✨ AI 智能解析"}
        </button>

        {parsed && (
          <div style={{marginTop:16,background:"#1a1e28",borderRadius:14,padding:16,border:"1px solid #2a2f3d"}}>
            <p style={{color:"#4fc18e",fontWeight:700,marginBottom:12,fontSize:14}}>✅ 解析結果（可修改後確認）</p>
            {[["標題","title","text"],["日期","date","date"],["開始","time","time"],["結束","endTime","time"]].map(([l,k,t])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{color:"#888",fontSize:12,width:36,flexShrink:0}}>{l}</span>
                <input type={t} value={parsed[k]||""} onChange={e=>setParsed({...parsed,[k]:e.target.value})} style={inp}/>
              </div>
            ))}
            {[["分類","category",Object.entries(CATEGORIES).map(([k,v])=>({v:k,l:`${v.icon} ${v.label}`}))],
              ["狀態","status",Object.entries(STATUS).map(([k,v])=>({v:k,l:`${v.icon} ${v.label}`}))],
              ["重複","repeat",[{v:"none",l:"不重複"},{v:"daily",l:"每天"},{v:"weekly",l:"每週"},{v:"monthly",l:"每月"}]]
            ].map(([l,k,opts])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{color:"#888",fontSize:12,width:36,flexShrink:0}}>{l}</span>
                <select value={parsed[k]||""} onChange={e=>setParsed({...parsed,[k]:e.target.value})}
                  style={{...inp,flex:1}}>
                  {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:14}}>
              <span style={{color:"#888",fontSize:12,width:36,paddingTop:8,flexShrink:0}}>備註</span>
              <textarea value={parsed.note||""} onChange={e=>setParsed({...parsed,note:e.target.value})}
                style={{...inp,minHeight:50,resize:"vertical",flex:1}}/>
            </div>
            <button onClick={()=>onConfirm(parsed)} style={{
              width:"100%",padding:12,borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,
              background:"linear-gradient(135deg,#4fc18e,#1a8a5a)",color:"#fff"}}>✅ 確認新增</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Event Detail Modal ─────────────────────────────────────────────────────
function EventModal({ event, onClose, onSave, onDelete }) {
  const [ev, setEv] = useState({...event});
  const cat = CATEGORIES[ev.category] || CATEGORIES.personal;
  const inp = { background:"#1a1e28", border:"1px solid #2a2f3d", borderRadius:8,
    color:"#e8eaf0", padding:"8px 12px", fontSize:14, width:"100%", boxSizing:"border-box" };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9998}}>
      <div style={{background:"#12151c",border:`1px solid ${cat.color}44`,borderRadius:"20px 20px 0 0",
        padding:"24px 20px 40px",width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{margin:0,color:"#e8eaf0",fontSize:17}}>{cat.icon} 活動詳情</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
        </div>

        {[["標題","title","text"],["日期","date","date"],["開始","time","time"],["結束","endTime","time"]].map(([l,k,t])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{color:"#888",fontSize:12,width:36,flexShrink:0}}>{l}</span>
            <input type={t} value={ev[k]||""} onChange={e=>setEv({...ev,[k]:e.target.value})} style={inp}/>
          </div>
        ))}

        {[["分類","category",Object.entries(CATEGORIES).map(([k,v])=>({v:k,l:`${v.icon} ${v.label}`}))],
          ["狀態","status",Object.entries(STATUS).map(([k,v])=>({v:k,l:`${v.icon} ${v.label}`}))],
          ["重複","repeat",[{v:"none",l:"不重複"},{v:"daily",l:"每天"},{v:"weekly",l:"每週"},{v:"monthly",l:"每月"}]]
        ].map(([l,k,opts])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{color:"#888",fontSize:12,width:36,flexShrink:0}}>{l}</span>
            <select value={ev[k]||""} onChange={e=>setEv({...ev,[k]:e.target.value})} style={{...inp,flex:1}}>
              {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}

        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:14}}>
          <span style={{color:"#888",fontSize:12,width:36,paddingTop:8,flexShrink:0}}>備註</span>
          <textarea value={ev.note||""} onChange={e=>setEv({...ev,note:e.target.value})}
            style={{...inp,minHeight:60,resize:"vertical"}}/>
        </div>

        {/* Quick status */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
          {Object.entries(STATUS).map(([k,v])=>(
            <button key={k} onClick={()=>setEv({...ev,status:k})} style={{
              padding:"8px 0",borderRadius:8,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,
              background:ev.status===k?v.color+"33":"transparent",
              borderColor:ev.status===k?v.color:"#2a2f3d",
              color:ev.status===k?v.color:"#888"}}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>onDelete(ev.id)} style={{
            flex:1,padding:"12px 0",borderRadius:10,border:"1px solid #f9706644",
            background:"transparent",color:"#f97066",cursor:"pointer",fontSize:14,fontWeight:600}}>🗑 刪除</button>
          <button onClick={()=>onSave(ev)} style={{
            flex:2,padding:"12px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,
            background:"linear-gradient(135deg,#4f8ef7,#7c5cfc)",color:"#fff"}}>💾 儲存</button>
        </div>
      </div>
    </div>
  );
}

// ── Event Card ─────────────────────────────────────────────────────────────
function EventCard({ event: e, onClick, onStatus }) {
  const cat = CATEGORIES[e.category] || CATEGORIES.personal;
  const st  = STATUS[e.status] || STATUS.pending;
  return (
    <div onClick={onClick} style={{
      background:"#12151c", borderRadius:12, padding:"12px 14px", marginBottom:8,
      border:`1px solid ${cat.color}22`, borderLeft:`3px solid ${cat.color}`,
      display:"flex", alignItems:"center", gap:12, cursor:"pointer",
      opacity: e.status==="skipped" ? 0.55 : 1 }}>
      <div style={{fontSize:20}}>{cat.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:14,fontWeight:600,
          color:e.status==="done"?"#556":"#e8eaf0",
          textDecoration:e.status==="done"?"line-through":"none",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</p>
        <p style={{margin:"3px 0 0",fontSize:11,color:"#556"}}>
          {e.time}{e.endTime?` – ${e.endTime}`:""} · {cat.label}
          {e.repeat && e.repeat!=="none" ? " · 🔄" : ""}
        </p>
        {e.note && <p style={{margin:"3px 0 0",fontSize:11,color:"#667",fontStyle:"italic",
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📝 {e.note}</p>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
        <span style={{fontSize:10,color:st.color,background:st.color+"22",borderRadius:6,
          padding:"3px 7px",fontWeight:700,whiteSpace:"nowrap"}}>{st.icon} {st.label}</span>
        <div style={{display:"flex",gap:4}} onClick={ev2=>ev2.stopPropagation()}>
          {["done","skipped"].map(s=>(
            <button key={s} onClick={()=>onStatus(e.id,s)} style={{
              fontSize:14,background:"transparent",border:"none",cursor:"pointer",padding:2,
              opacity:e.status===s?1:0.3}}>{STATUS[s].icon}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function App() {
  const now  = new Date();
  const [events, setEvents]         = useState(loadEvents);
  const [year,   setYear]           = useState(now.getFullYear());
  const [month,  setMonth]          = useState(now.getMonth());
  const [selDate,setSelDate]        = useState(today());
  const [view,   setView]           = useState("month"); // month | list
  const [filterCat,   setFilterCat] = useState("all");
  const [filterStatus,setFilterStatus] = useState("all");
  const [voiceOpen,   setVoiceOpen] = useState(false);
  const [detailEv,    setDetailEv]  = useState(null);
  const [sideOpen,    setSideOpen]  = useState(false);

  // persist
  useEffect(() => { saveEvents(events); }, [events]);

  const eventsForDate = useCallback((dateStr) => {
    return events.filter(e => {
      if (filterCat    !== "all" && e.category !== filterCat)    return false;
      if (filterStatus !== "all" && e.status   !== filterStatus) return false;
      if (e.date === dateStr) return true;
      const base = new Date(e.date); const tgt = new Date(dateStr);
      if (tgt < base) return false;
      if (e.repeat === "daily")   return true;
      if (e.repeat === "weekly")  return base.getDay()   === tgt.getDay();
      if (e.repeat === "monthly") return base.getDate()  === tgt.getDate();
      return false;
    }).sort((a,b) => (a.time||"").localeCompare(b.time||""));
  }, [events, filterCat, filterStatus]);

  const addEvent = (parsed) => {
    const ev = { id:newId(), title:parsed.title||"新活動", date:parsed.date||today(),
      time:parsed.time||"09:00", endTime:parsed.endTime||"10:00",
      category:parsed.category||"personal", status:parsed.status||"pending",
      note:parsed.note||"", repeat:parsed.repeat||"none" };
    setEvents(p => [...p, ev]);
    setVoiceOpen(false);
  };

  const saveEvent  = (ev) => { setEvents(p => p.map(e => e.id===ev.id ? ev : e)); setDetailEv(null); };
  const delEvent   = (id) => { setEvents(p => p.filter(e => e.id!==id)); setDetailEv(null); };
  const setStatus  = (id,st) => setEvents(p => p.map(e => e.id===id ? {...e,status:st} : e));

  const prevMonth = () => { if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };

  const cells   = Array(firstWeekday(year,month)).fill(null).concat(Array.from({length:daysInMonth(year,month)},(_,i)=>i+1));
  const todayEvs = eventsForDate(today());
  const todayDone = todayEvs.filter(e=>e.status==="done").length;

  const thisMonthEvs = events.filter(e=>{ const d=new Date(e.date); return d.getFullYear()===year&&d.getMonth()===month; });
  const rate = thisMonthEvs.length ? Math.round(thisMonthEvs.filter(e=>e.status==="done").length/thisMonthEvs.length*100) : 0;

  return (
    <div style={{minHeight:"100vh",minHeight:"100dvh",background:"#0c0e14",color:"#e8eaf0",
      fontFamily:"'PingFang TC','Noto Sans TC',sans-serif",display:"flex",flexDirection:"column",
      maxWidth:600,margin:"0 auto"}}>

      {/* Header */}
      <header style={{background:"#12151c",borderBottom:"1px solid #1e2235",padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setSideOpen(true)} style={{background:"none",border:"none",color:"#888",fontSize:20,cursor:"pointer",padding:4}}>☰</button>
          <div>
            <h1 style={{margin:0,fontSize:17,fontWeight:800,
              background:"linear-gradient(135deg,#4f8ef7,#7c5cfc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              ✦ 我的行事曆
            </h1>
            <p style={{margin:0,fontSize:10,color:"#445"}}>今日完成 {todayDone}/{todayEvs.length} · 本月執行率 {rate}%</p>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {["month","list"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{
              padding:"6px 12px",borderRadius:8,border:"1px solid",cursor:"pointer",fontSize:12,fontWeight:600,
              background:view===v?"#4f8ef722":"transparent",
              borderColor:view===v?"#4f8ef7":"#2a2f3d",
              color:view===v?"#4f8ef7":"#888"}}>
              {v==="month"?"月曆":"清單"}
            </button>
          ))}
          <button onClick={()=>setVoiceOpen(true)} style={{
            padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
            background:"linear-gradient(135deg,#4f8ef7,#7c5cfc)",color:"#fff"}}>
            🎙️
          </button>
        </div>
      </header>

      {/* Sidebar drawer */}
      {sideOpen && (
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
          <div style={{background:"#0e1018",width:220,padding:20,overflowY:"auto",borderRight:"1px solid #1e2235"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span style={{color:"#e8eaf0",fontWeight:700}}>篩選 & 統計</span>
              <button onClick={()=>setSideOpen(false)} style={{background:"none",border:"none",color:"#888",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            {/* Stats */}
            <div style={{background:"#1a2a4a",borderRadius:12,padding:14,marginBottom:16,border:"1px solid #2a3a5a"}}>
              <p style={{margin:"0 0 4px",fontSize:11,color:"#4f8ef7",fontWeight:700}}>本月執行率</p>
              <p style={{margin:0,fontSize:26,fontWeight:800,color:"#4f8ef7"}}>{rate}%</p>
              <div style={{height:4,background:"#2a2f3d",borderRadius:4,marginTop:8}}>
                <div style={{height:4,width:`${rate}%`,background:"linear-gradient(90deg,#4f8ef7,#7c5cfc)",borderRadius:4}}/>
              </div>
            </div>
            <p style={{fontSize:11,color:"#556",fontWeight:700,marginBottom:8}}>分類</p>
            {[["all","全部","🗂","#888"],...Object.entries(CATEGORIES).map(([k,v])=>[k,v.label,v.icon,v.color])].map(([k,l,ic,c])=>(
              <button key={k} onClick={()=>{setFilterCat(k);setSideOpen(false);}} style={{
                width:"100%",padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",
                textAlign:"left",marginBottom:4,fontSize:13,display:"flex",alignItems:"center",gap:8,
                background:filterCat===k?c+"22":"transparent",color:filterCat===k?c:"#888",fontWeight:filterCat===k?700:400}}>
                {ic} {l}
              </button>
            ))}
            <p style={{fontSize:11,color:"#556",fontWeight:700,margin:"12px 0 8px"}}>狀態</p>
            {[["all","全部","📋","#888"],...Object.entries(STATUS).map(([k,v])=>[k,v.label,v.icon,v.color])].map(([k,l,ic,c])=>(
              <button key={k} onClick={()=>{setFilterStatus(k);setSideOpen(false);}} style={{
                width:"100%",padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",
                textAlign:"left",marginBottom:4,fontSize:13,display:"flex",alignItems:"center",gap:8,
                background:filterStatus===k?c+"22":"transparent",color:filterStatus===k?c:"#888",fontWeight:filterStatus===k?700:400}}>
                {ic} {l}
              </button>
            ))}
          </div>
          <div style={{flex:1,background:"rgba(0,0,0,.5)"}} onClick={()=>setSideOpen(false)}/>
        </div>
      )}

      {/* Body */}
      <main style={{flex:1,overflowY:"auto",padding:12}}>
        {view==="month" && (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <button onClick={prevMonth} style={{background:"#1a1e28",border:"1px solid #2a2f3d",borderRadius:8,color:"#888",padding:"7px 14px",cursor:"pointer",fontSize:16}}>‹</button>
              <h2 style={{margin:0,fontSize:17,color:"#e8eaf0"}}>{year} 年 {MONTHS_ZH[month]} 月</h2>
              <button onClick={nextMonth} style={{background:"#1a1e28",border:"1px solid #2a2f3d",borderRadius:8,color:"#888",padding:"7px 14px",cursor:"pointer",fontSize:16}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"#1e2235",borderRadius:12,overflow:"hidden",border:"1px solid #1e2235"}}>
              {DAYS_ZH.map(d=>(
                <div key={d} style={{background:"#12151c",padding:"8px 0",textAlign:"center",fontSize:11,color:"#556",fontWeight:700}}>{d}</div>
              ))}
              {cells.map((day,i)=>{
                if(!day) return <div key={`e${i}`} style={{background:"#0e1018",minHeight:70}}/>;
                const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const devs = eventsForDate(ds);
                const isToday = ds===today();
                const isSel   = ds===selDate;
                return (
                  <div key={day} onClick={()=>setSelDate(ds)} style={{
                    background:isSel?"#1a2a4a":"#12151c",minHeight:70,padding:"6px 4px",cursor:"pointer",
                    borderTop:isToday?"2px solid #4f8ef7":"none"}}>
                    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                      width:22,height:22,borderRadius:"50%",fontSize:12,fontWeight:isToday?800:400,
                      background:isToday?"#4f8ef7":"transparent",
                      color:isToday?"#fff":isSel?"#4f8ef7":"#aab"}}>{day}</span>
                    <div style={{marginTop:2,display:"flex",flexDirection:"column",gap:1}}>
                      {devs.slice(0,2).map(e=>(
                        <div key={e.id} onClick={ev2=>{ev2.stopPropagation();setDetailEv(e);}} style={{
                          fontSize:9,borderRadius:3,padding:"1px 4px",
                          background:CATEGORIES[e.category]?.color+"33",
                          color:CATEGORIES[e.category]?.color,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",
                          textDecoration:e.status==="done"?"line-through":"none"}}>
                          {STATUS[e.status]?.icon} {e.title}
                        </div>
                      ))}
                      {devs.length>2 && <span style={{fontSize:8,color:"#556"}}>+{devs.length-2}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day panel */}
            <div style={{marginTop:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <h3 style={{margin:0,fontSize:14,color:"#aab"}}>{selDate} 的活動</h3>
                <button onClick={()=>{
                  const ev={id:newId(),title:"新活動",date:selDate,time:"09:00",endTime:"10:00",category:"personal",status:"pending",note:"",repeat:"none"};
                  setEvents(p=>[...p,ev]); setDetailEv(ev);
                }} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#4f8ef722",color:"#4f8ef7",cursor:"pointer",fontSize:12,fontWeight:700}}>+ 新增</button>
              </div>
              {eventsForDate(selDate).length===0
                ? <div style={{textAlign:"center",padding:"24px 0",color:"#334",fontSize:13}}>這天還沒有活動</div>
                : eventsForDate(selDate).map(e=><EventCard key={e.id} event={e} onClick={()=>setDetailEv(e)} onStatus={setStatus}/>)
              }
            </div>
          </>
        )}

        {view==="list" && (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={prevMonth} style={{background:"#1a1e28",border:"1px solid #2a2f3d",borderRadius:8,color:"#888",padding:"6px 12px",cursor:"pointer"}}>‹</button>
                <h2 style={{margin:0,fontSize:16,color:"#e8eaf0"}}>{year}/{MONTHS_ZH[month]} 月</h2>
                <button onClick={nextMonth} style={{background:"#1a1e28",border:"1px solid #2a2f3d",borderRadius:8,color:"#888",padding:"6px 12px",cursor:"pointer"}}>›</button>
              </div>
              <button onClick={()=>{
                const ev={id:newId(),title:"新活動",date:today(),time:"09:00",endTime:"10:00",category:"personal",status:"pending",note:"",repeat:"none"};
                setEvents(p=>[...p,ev]); setDetailEv(ev);
              }} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#4f8ef722",color:"#4f8ef7",cursor:"pointer",fontSize:13,fontWeight:700}}>+ 新增</button>
            </div>
            {Array.from({length:daysInMonth(year,month)},(_,i)=>{
              const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;
              const devs = eventsForDate(ds);
              if(!devs.length) return null;
              const isToday = ds===today();
              return (
                <div key={ds} style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                      background:isToday?"#4f8ef7":"#1a1e28",fontSize:12,fontWeight:700,color:isToday?"#fff":"#aab",flexShrink:0}}>{i+1}</div>
                    <span style={{fontSize:11,color:"#556",fontWeight:700}}>
                      {DAYS_ZH[new Date(ds).getDay()]} {isToday?"· 今天":""}
                    </span>
                    <div style={{flex:1,height:1,background:"#1e2235"}}/>
                  </div>
                  {devs.map(e=><EventCard key={e.id} event={e} onClick={()=>setDetailEv(e)} onStatus={setStatus}/>)}
                </div>
              );
            })}
          </>
        )}
      </main>

      {/* FAB */}
      <button onClick={()=>setVoiceOpen(true)} style={{
        position:"fixed",bottom:28,right:20,width:56,height:56,borderRadius:"50%",
        border:"none",cursor:"pointer",fontSize:22,
        background:"linear-gradient(135deg,#4f8ef7,#7c5cfc)",color:"#fff",
        boxShadow:"0 6px 24px rgba(79,142,247,.5)",zIndex:50}}>
        🎙️
      </button>

      {voiceOpen && <VoiceModal onClose={()=>setVoiceOpen(false)} onConfirm={addEvent}/>}
      {detailEv  && <EventModal event={detailEv} onClose={()=>setDetailEv(null)} onSave={saveEvent} onDelete={delEvent}/>}
    </div>
  );
}
