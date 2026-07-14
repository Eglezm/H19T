import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove, get } from "firebase/database";

// ─── FIREBASE ──────────────────────────────────────
// Usa el mismo proyecto de Firebase que H19 Golf (misma cuenta), pero TODOS
// los datos de H19T viven en nodos propios y separados ("h19tDirectorio",
// "torneos", "torneoHistorial", "codigos") — no comparte jugadores, handicaps
// ni nada con H19 Golf. Si prefieres un proyecto de Firebase 100% distinto,
// solo reemplaza este objeto con el config de tu propio proyecto.
const firebaseConfig = {
  apiKey: "AIzaSyAsWuJRelERz7W2QG3-DPaOprKKT0TJBA4",
  authDomain: "h19golf-4624f.firebaseapp.com",
  databaseURL: "https://h19golf-4624f-default-rtdb.firebaseio.com",
  projectId: "h19golf-4624f",
  storageBucket: "h19golf-4624f.firebasestorage.app",
  messagingSenderId: "476582553669",
  appId: "1:476582553669:web:b01cbb904a8a9a4f1e1b2c"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const ADMIN_PIN = "1919";

const CAMPOS = {
  huerta:    { nombre: "Club de Golf La Huerta",         pares: [4,3,3,3,3,4,3,3,3,4,3,3,3,3,4,3,3,3], nueveHoyos: true },
  lavista:   { nombre: "La Vista Country Club",          pares: [4,3,4,5,4,4,3,4,5,5,4,3,4,4,5,4,3,4] },
  campestre: { nombre: "Club Campestre de Puebla",       pares: [4,3,5,4,4,4,4,3,5,4,4,5,3,4,5,4,3,4] },
  soltepec:  { nombre: "Club de Golf Hacienda Soltepec", pares: [4,4,5,3,5,3,4,4,3,4,4,5,3,5,3,4,4,3] },
  otro:      { nombre: "Otro campo",                     pares: null },
};

const MODALIDADES = {
  individual: { label: "Individual",  size: 1, corto: "IND" },
  pareja:     { label: "Pareja",      size: 2, corto: "2SOME" },
  threesome:  { label: "Threesome",   size: 3, corto: "3SOME" },
  foursome:   { label: "Foursome",    size: 4, corto: "4SOME" },
  fivesome:   { label: "Fivesome",    size: 5, corto: "5SOME" },
};

const D = {
  bg: "#F5F0E8", surface: "#FFFFFF", card: "#FFFFFF", border: "#DDD5C0",
  gold: "#9A6F00", goldLight: "#C49A00", goldDim: "#FDF3D0",
  text: "#1A1A1A", textSub: "#6B6150", textDim: "#B0A690",
  green: "#1B5E20", greenBg: "#E8F5E9", red: "#B71C1C", redBg: "#FFEBEE",
  success: "#2E7D32", danger: "#C62828",
};

const COLORS = [
  {bg:"#D6E4F7",fg:"#1A4A8A"},{bg:"#D4EDD8",fg:"#1A5C24"},
  {bg:"#F7E6D4",fg:"#8A3A0A"},{bg:"#F7D4E6",fg:"#8A0A40"},
  {bg:"#E4D4F7",fg:"#4A1A8A"},{bg:"#F7D4F0",fg:"#8A1A7A"},
  {bg:"#D4F0E8",fg:"#0A5A3A"},{bg:"#F7EDD4",fg:"#7A5000"},
  {bg:"#D4D8F7",fg:"#1A1A8A"},{bg:"#F7D8D4",fg:"#8A1A14"},
];

const col = (id) => {
  let n = typeof id === "number" ? id : String(id).split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  return COLORS[Math.abs(n) % COLORS.length];
};

function getBadge(s, par) {
  if (s === null || s === undefined || !par) return null;
  const d = s - par;
  if (d <= -2) return { label:"Eagle",  bg:"#D6E4F7", fg:"#1A4A8A" };
  if (d === -1) return { label:"Birdie", bg:"#D4EDD8", fg:"#1A5C24" };
  if (d === 0)  return { label:"Par",    bg:"#EEE8DC", fg:"#6B6150" };
  if (d === 1)  return { label:"Bogey",  bg:"#FFF0D4", fg:"#8A4A00" };
  if (d === 2)  return { label:"Doble",  bg:"#FFE0D4", fg:"#8A2A00" };
  return { label:"+"+d, bg:"#FFDBDB", fg:"#C62828" };
}

function teeColor(campo, holeIndex) {
  const c = CAMPOS[campo];
  if (!c || !c.nueveHoyos) return null;
  return holeIndex < 9 ? "Blancas" : "Azules";
}
function teeStyle(tee) {
  if (tee === "Blancas") return { bg:"#F1F1EC", fg:"#6B6150", border:"#D8D5C8" };
  if (tee === "Azules") return { bg:"#DCEEFB", fg:"#15628C", border:"#B9DDF2" };
  return null;
}
function genCodigo(usados) {
  let c;
  do { c = Math.random().toString(36).substring(2,7).toUpperCase(); } while (usados.has(c));
  return c;
}

// Nombre de la unidad + nombres de los jugadores (si es un equipo de 2+)
function nombreConJugadores(unidad) {
  if (!unidad) return "";
  if (!unidad.jugadores || unidad.jugadores.length <= 1) return unidad.nombre;
  return `${unidad.nombre} (${unidad.jugadores.map(j => j.name).join(", ")})`;
}

// Calcula el HC aplicado de una unidad competidora (jugador o equipo)
function calcHcAplicado(jugadores, hcPercent) {
  const hcs = jugadores.map(j => j.hc || 0);
  const avg = hcs.reduce((a,b) => a+b, 0) / hcs.length;
  return Math.round(avg * (hcPercent/100));
}

// Construye la cadena de marcaje: cada unidad anota a la siguiente, en círculo
function buildChain(ids) {
  const n = ids.length;
  const chain = {};
  ids.forEach((id, i) => {
    chain[id] = { marcaA: ids[(i+1)%n], marcadoPor: ids[(i-1+n)%n] };
  });
  return chain;
}

function calcTotales(unidad, pares) {
  const scores = unidad.scores || [];
  let jugados = 0, brutoReal = 0, parJugado = 0;
  pares.forEach((par, i) => {
    if (scores[i] !== null && scores[i] !== undefined) {
      jugados++;
      brutoReal += scores[i];
      parJugado += par;
    }
  });
  const hcAplicado = unidad.hcAplicado || 0;
  const neto = brutoReal - hcAplicado;
  const vsPar = brutoReal - parJugado;       // cómo van contra par, sin considerar HP
  const vsParHc = vsPar - hcAplicado;        // lo mismo, restando el HP
  return { jugados, brutoReal, hcAplicado, neto, parJugado, vsPar, vsParHc };
}

function fmtVsPar(n) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}
function colorVsPar(n) {
  return n < 0 ? D.success : n > 0 ? D.danger : D.textSub;
}

function leaderboard(torneo) {
  if (!torneo || !torneo.unidades || !torneo.pares) return [];
  return Object.values(torneo.unidades)
    .map(u => ({ ...u, ...calcTotales(u, torneo.pares) }))
    .sort((a,b) => a.neto - b.neto);
}

// ─── UI PRIMITIVAS (mismo lenguaje visual que H19 Golf) ──
function Avatar({ name, id, size = 32 }) {
  const c = col(id);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:c.bg, color:c.fg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.34, fontWeight:700, flexShrink:0, border:`1px solid ${c.fg}33` }}>
      {name.substring(0,2).toUpperCase()}
    </div>
  );
}

function Card({ children, style = {}, className }) {
  return (
    <div className={className} style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:16, padding:16, marginBottom:12, ...style }}>
      {children}
    </div>
  );
}

function SLabel({ children, style = {} }) {
  return <div style={{ fontSize:10, fontWeight:700, color:D.gold, textTransform:"uppercase", letterSpacing:2, marginBottom:10, ...style }}>{children}</div>;
}

function Btn({ children, onClick, disabled, outline, danger, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width:"100%", padding:14, border:outline ? `1px solid ${danger?D.danger:D.gold}` : "none", borderRadius:12, fontSize:15, fontWeight:700, cursor:disabled?"default":"pointer", marginTop:6, background:outline ? "transparent" : danger ? D.danger : `linear-gradient(135deg,${D.gold},${D.goldLight})`, color:outline ? (danger?D.danger:D.gold) : "#FFFFFF", opacity:disabled?0.4:1, ...style }}>
      {children}
    </button>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{ flex:"1 1 auto", padding:"9px 4px", border:`1px solid ${active===t.key?D.gold:D.border}`, borderRadius:10, background:active===t.key?D.goldDim:D.surface, color:active===t.key?D.gold:D.textSub, fontSize:11, fontWeight:700, cursor:"pointer" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Pill({ active, danger, onClick, children }) {
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", border:`1px solid ${active?D.gold:danger?D.danger:D.border}`, borderRadius:20, background:active?D.goldDim:"transparent", color:active?D.gold:danger?D.danger:D.textSub, fontSize:13, fontWeight:600, cursor:"pointer", userSelect:"none" }}>
      {children}
    </div>
  );
}

const appStyle = { fontSize:14, fontFamily:"-apple-system,sans-serif", color:D.text, background:D.bg, minHeight:"100vh", maxWidth:420, margin:"0 auto" };

function Spinner({ label }) {
  return (
    <div style={{ ...appStyle, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:32 }}>⛳</div>
      <div style={{ color:D.gold, fontWeight:700 }}>{label}</div>
    </div>
  );
}

// ─── TARJETA DE POSICIONES (reutilizable) ─────────
function TablaPosiciones({ torneo, highlightId, big }) {
  const rows = leaderboard(torneo);
  const fs = big ? { name:22, sub:14, total:34, small:13, avatar:46, pos:34 } : { name:13, sub:10, total:17, small:9, avatar:30, pos:24 };
  return (
    <Card style={big ? { padding:24 } : {}}>
      <SLabel style={big ? { fontSize:16 } : {}}>🏆 Posiciones</SLabel>
      {rows.map((u, pos) => (
        <div key={u.id} style={{ display:"flex", alignItems:"center", gap:big?16:10, padding:big?"16px 0":"10px 0", borderBottom:pos<rows.length-1?`1px solid ${D.border}`:"none", background:u.id===highlightId?D.goldDim+"55":"transparent" }}>
          <div style={{ width:fs.pos, height:fs.pos, borderRadius:"50%", background:pos===0?D.goldDim:D.surface, border:`1px solid ${pos===0?D.gold:D.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:fs.small+2, fontWeight:900, color:pos===0?D.gold:D.textSub, flexShrink:0 }}>{pos+1}</div>
          <Avatar name={u.nombre} id={u.id} size={fs.avatar} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:fs.name, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.nombre} {u.hoyoSalida!=null && <span style={{ fontSize:fs.small, color:D.gold, fontWeight:600 }}>· salió hoyo {u.hoyoSalida+1}</span>}</div>
            <div style={{ fontSize:fs.sub, color:D.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {u.jugadores && u.jugadores.length>1 ? u.jugadores.map(j=>j.name).join(", ") : ""} {u.jugadores && u.jugadores.length>1 ? "· " : ""}{u.jugados}/{torneo.pares.length} hoyos
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:fs.sub+6, fontWeight:900, color:colorVsPar(u.vsPar) }}>{fmtVsPar(u.vsPar)}</div>
            <div style={{ fontSize:fs.sub, color:D.textSub, whiteSpace:"nowrap" }}>{u.brutoReal} − {u.hcAplicado}</div>
            <div style={{ fontSize:fs.total, fontWeight:900, color:pos===0?D.gold:D.text }}>{u.neto}</div>
            <div style={{ fontSize:fs.small, color:D.textSub }}>total</div>
          </div>
        </div>
      ))}
      {rows.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
    </Card>
  );
}

function TarjetaHoyoPorHoyo({ torneo, big }) {
  const rows = leaderboard(torneo);
  const pares = torneo.pares;
  const fs = big ? 15 : 11;
  return (
    <Card style={big ? { padding:24 } : {}}>
      <SLabel style={big ? { fontSize:16 } : {}}>🏌️ Tarjeta hoyo por hoyo <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>· ★ = hoyo de salida</span></SLabel>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:fs, minWidth:pares.length*(big?46:32)+(big?140:90) }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", padding:big?"8px 10px":"4px 6px", color:D.textSub, position:"sticky", left:0, background:D.surface }}>Unidad</th>
              {pares.map((par, h) => {
                const ts = teeStyle(teeColor(torneo.campo, h));
                return <th key={h} style={{ padding:big?"8px 6px":"4px 4px", color:D.textDim, fontWeight:600, minWidth:big?42:28, background:ts?ts.bg:"transparent" }}>{h+1}</th>;
              })}
              <th style={{ padding:big?"8px 10px":"4px 6px", color:D.gold, fontWeight:700 }}>Total</th>
              <th style={{ padding:big?"8px 10px":"4px 6px", color:D.gold, fontWeight:700, borderLeft:`1px solid ${D.border}` }}>vs Par</th>
              <th style={{ padding:big?"8px 10px":"4px 6px", color:D.gold, fontWeight:700 }}>vs Par −HP</th>
            </tr>
            <tr>
              <td style={{ padding:big?"4px 10px":"2px 6px", color:D.textDim, fontSize:fs-1, position:"sticky", left:0, background:D.surface }}>Par</td>
              {pares.map((par, h) => {
                const ts = teeStyle(teeColor(torneo.campo, h));
                return <td key={h} style={{ textAlign:"center", padding:big?"4px 6px":"2px 4px", color:ts?ts.fg:D.textDim, fontSize:fs-1, background:ts?ts.bg:"transparent" }}>{par}</td>;
              })}
              <td style={{ textAlign:"center", padding:big?"4px 10px":"2px 6px", color:D.textDim, fontSize:fs-1, fontWeight:700 }}>{pares.reduce((a,b)=>a+b,0)}</td>
              <td style={{ borderLeft:`1px solid ${D.border}` }}></td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} style={{ borderTop:`1px solid ${D.border}` }}>
                <td style={{ padding:big?"8px 10px":"5px 6px", fontWeight:600, position:"sticky", left:0, background:D.surface, whiteSpace:"nowrap" }}>
                  <div>{u.nombre}</div>
                  <div style={{ fontSize:big?12:9, color:D.textDim, fontWeight:400 }}>{u.brutoReal} − {u.hcAplicado}{u.hoyoSalida!=null?` · ★H${u.hoyoSalida+1}`:""}</div>
                </td>
                {pares.map((par, h) => {
                  const s = (u.scores||[])[h];
                  const b = getBadge(s, par);
                  const esSalida = u.hoyoSalida === h;
                  return (
                    <td key={h} style={{ textAlign:"center", padding:big?"8px 4px":"5px 2px", position:"relative", outline:esSalida?`2px solid ${D.gold}`:"none", outlineOffset:-2 }}>
                      {esSalida && <span style={{ position:"absolute", top:1, right:2, fontSize:big?10:7, color:D.gold }}>★</span>}
                      <span style={{ display:"inline-block", minWidth:big?26:18, padding:big?"3px 5px":"1px 3px", borderRadius:5, fontWeight:700, fontSize:fs, background:b?b.bg:"transparent", color:b?b.fg:D.text }}>{s ?? "—"}</span>
                    </td>
                  );
                })}
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontWeight:900, color:D.gold }}>{u.brutoReal}</td>
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontWeight:900, color:colorVsPar(u.vsPar), borderLeft:`1px solid ${D.border}` }}>{fmtVsPar(u.vsPar)}</td>
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontWeight:900, color:colorVsPar(u.vsParHc) }}>{fmtVsPar(u.vsParHc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {CAMPOS[torneo.campo]?.nueveHoyos && pares.length===18 && (
        <div style={{ display:"flex", gap:14, justifyContent:"center", marginTop:10, fontSize:big?13:10, color:D.textSub }}>
          <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:2, background:teeStyle("Blancas").bg, border:`1px solid ${teeStyle("Blancas").border}`, marginRight:4 }} />Hoyos 1–9: Tee Blancas</span>
          <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:2, background:teeStyle("Azules").bg, border:`1px solid ${teeStyle("Azules").border}`, marginRight:4 }} />Hoyos 10–18: Tee Azules</span>
        </div>
      )}
    </Card>
  );
}

// ─── VISTA ESPECTADOR (público, solo lectura) ─────
function SpectatorTorneoView({ torneoId }) {
  const [torneo, setTorneo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    const r = ref(db, `torneos/${torneoId}`);
    const unsub = onValue(r, snap => { setTorneo(snap.exists() ? snap.val() : null); setLoading(false); });
    return () => unsub();
  }, [torneoId]);

  if (loading) return <Spinner label="Conectando..." />;
  if (!torneo) return <Spinner label="Torneo no encontrado" />;

  const campoNombre = CAMPOS[torneo.campo]?.nombre || torneo.campo;
  const modLabel = MODALIDADES[torneo.modalidad]?.label || torneo.modalidad;
  const tvStyle = { fontSize:14, fontFamily:"-apple-system,sans-serif", color:D.text, background:D.bg, minHeight:"100vh", width:"100%", margin:"0 auto" };

  return (
    <div style={tvMode ? tvStyle : appStyle}>
      <div style={{ background:D.surface, borderBottom:`1px solid ${D.border}`, padding:tvMode?"32px 24px 24px":"20px 16px 14px", textAlign:"center", position:"relative" }}>
        <button onClick={() => setTvMode(v=>!v)} style={{ position:"absolute", top:tvMode?24:14, right:tvMode?24:14, padding:tvMode?"10px 18px":"6px 12px", border:`1px solid ${D.gold}`, borderRadius:20, background:D.goldDim, color:D.gold, fontSize:tvMode?14:11, fontWeight:700, cursor:"pointer" }}>
          {tvMode ? "✕ Salir de pantalla completa" : "🖥️ Modo pantalla completa"}
        </button>
        <div style={{ fontSize:tvMode?54:30, fontWeight:900, color:D.gold }}>H19T</div>
        <div style={{ fontSize:tvMode?26:13, fontWeight:700, marginTop:4 }}>{torneo.nombre}</div>
        <div style={{ fontSize:tvMode?16:11, color:D.textSub, letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>{campoNombre} · {modLabel} · HC {torneo.hcPercent}%</div>
        <div style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:6, padding:tvMode?"6px 18px":"4px 12px", background:torneo.status==="finalizada"?D.greenBg:D.goldDim, border:`1px solid ${torneo.status==="finalizada"?D.success:D.gold}`, borderRadius:20 }}>
          <div style={{ width:tvMode?9:6, height:tvMode?9:6, borderRadius:"50%", background:torneo.status==="finalizada"?D.success:D.gold }} />
          <span style={{ fontSize:tvMode?15:11, fontWeight:700, color:torneo.status==="finalizada"?D.success:D.gold }}>{torneo.status==="finalizada" ? "Torneo finalizado" : "En vivo"}</span>
        </div>
      </div>
      <div style={tvMode ? { padding:"24px", maxWidth:1400, margin:"0 auto", display:"grid", gridTemplateColumns: torneo.pares?.length ? "1fr" : "1fr", gap:20 } : { padding:"12px 12px 32px" }}>
        <TablaPosiciones torneo={torneo} big={tvMode} />
        <TarjetaHoyoPorHoyo torneo={torneo} big={tvMode} />
        {!tvMode && <div style={{ textAlign:"center", fontSize:11, color:D.textDim, marginTop:8 }}>Vista de solo lectura · Actualización automática</div>}
      </div>
    </div>
  );
}

// ─── VISTA DE EQUIPO (acceso por código) ──────────
function TeamPlayView({ codigo, onExit }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [torneoId, setTorneoId] = useState(null);
  const [unidadId, setUnidadId] = useState(null);
  const [torneo, setTorneo] = useState(null);
  const [posInOrder, setPosInOrder] = useState(0);
  const [tab, setTab] = useState("marcar");

  useEffect(() => {
    const r = ref(db, `codigos/${codigo}`);
    get(r).then(snap => {
      if (snap.exists()) { const v = snap.val(); setTorneoId(v.torneoId); setUnidadId(v.unidadId); }
      else { setError("Código no encontrado. Verifica con el organizador."); setLoading(false); }
    }).catch(() => { setError("No se pudo verificar el código."); setLoading(false); });
  }, [codigo]);

  useEffect(() => {
    if (!torneoId) return;
    const r = ref(db, `torneos/${torneoId}`);
    const unsub = onValue(r, snap => { setTorneo(snap.exists() ? snap.val() : null); setLoading(false); });
    return () => unsub();
  }, [torneoId]);

  if (loading) return <Spinner label="Conectando..." />;
  if (error) return (
    <div style={{ ...appStyle, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, padding:24, textAlign:"center" }}>
      <div style={{ fontSize:32 }}>🚫</div>
      <div style={{ color:D.danger, fontWeight:700 }}>{error}</div>
      <button onClick={onExit} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}>← Volver</button>
    </div>
  );
  if (!torneo || !torneo.unidades || !torneo.unidades[unidadId]) return <Spinner label="Torneo no encontrado" />;

  const miUnidad = torneo.unidades[unidadId];
  const marcoA = torneo.unidades[miUnidad.marcaA];        // la unidad a la que YO le anoto
  const meMarca = torneo.unidades[miUnidad.marcadoPor];    // la unidad que ME anota a mí
  const pares = torneo.pares;
  // El orden de juego empieza en el hoyo de salida de la unidad y da la vuelta circularmente
  const startIdx = miUnidad.hoyoSalida ?? 0;
  const holeOrder = pares.map((_, i) => (startIdx + i) % pares.length);
  const hole = holeOrder[posInOrder] ?? startIdx;
  const par = pares[hole];
  const tee = teeColor(torneo.campo, hole);
  const teeSt = teeStyle(tee);
  const campoNombre = CAMPOS[torneo.campo]?.nombre || torneo.campo;

  const setScore = (delta) => {
    if (!marcoA) return;
    const current = marcoA.scores?.[hole] ?? par;
    const val = Math.max(1, current + delta);
    set(ref(db, `torneos/${torneoId}/unidades/${miUnidad.marcaA}/scores/${hole}`), val);
  };

  // Si el hoyo actual se quedó sin capturar (el jugador hizo par y no tocó + / −),
  // guarda el par de campo como su score antes de navegar a otro hoyo o pestaña.
  const commitParSiFalta = () => {
    if (!marcoA) return;
    const current = marcoA.scores?.[hole];
    if (current === null || current === undefined) {
      set(ref(db, `torneos/${torneoId}/unidades/${miUnidad.marcaA}/scores/${hole}`), par);
    }
  };
  const irAHoyo = (nuevaPos) => { commitParSiFalta(); setPosInOrder(nuevaPos); };
  const cambiarTab = (k) => { commitParSiFalta(); setTab(k); };

  const miScore = (miUnidad.scores || [])[hole];
  const suScore = (marcoA?.scores || [])[hole];

  return (
    <div style={appStyle}>
      <div style={{ background:D.surface, borderBottom:`1px solid ${D.border}`, padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:22, fontWeight:900, color:D.gold }}>H19T</div>
          <button onClick={onExit} style={{ fontSize:11, color:D.textSub, background:"none", border:`1px solid ${D.border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>Salir</button>
        </div>
        <div style={{ fontSize:12, color:D.textSub, marginTop:2 }}>{torneo.nombre} · {campoNombre}</div>
      </div>

      <div style={{ padding:"12px 12px 4px" }}>
        <Card style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, color:D.textSub, letterSpacing:1, textTransform:"uppercase" }}>Tu unidad</div>
          <div style={{ fontSize:18, fontWeight:900, color:D.gold }}>{miUnidad.nombre}</div>
          {miUnidad.jugadores && miUnidad.jugadores.length>1 && <div style={{ fontSize:11, color:D.textSub }}>{miUnidad.jugadores.map(j=>j.name).join(", ")}</div>}
          <div style={{ fontSize:11, color:D.textSub, marginTop:2 }}>Hoyo de salida {miUnidad.hoyoSalida+1} · HC aplicado {miUnidad.hcAplicado}</div>
        </Card>
      </div>

      {torneo.status === "finalizada" ? (
        <div style={{ padding:"0 12px 32px" }}>
          <div style={{ textAlign:"center", padding:"8px 0 16px", color:D.success, fontWeight:700 }}>🏁 El torneo ha finalizado</div>
          <TablaPosiciones torneo={torneo} highlightId={unidadId} />
          <TarjetaHoyoPorHoyo torneo={torneo} />
        </div>
      ) : (
        <div style={{ padding:"0 12px 32px" }}>
          <TabBar tabs={[{key:"marcar",label:"✏️ Anotar"},{key:"mio",label:"👀 Mi score"},{key:"pos",label:"🏆 Posiciones"},{key:"tabla",label:"📋 Tarjeta"}]} active={tab} onChange={cambiarTab} />

          {tab === "marcar" && marcoA && (
            <Card>
              <SLabel>Anotas para: {nombreConJugadores(marcoA)}</SLabel>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:10 }}>
                <button onClick={() => irAHoyo(Math.max(0,posInOrder-1))} disabled={posInOrder===0} style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${D.border}`,background:"transparent",color:D.text,cursor:"pointer",fontSize:18,opacity:posInOrder===0?0.3:1 }}>‹</button>
                <div style={{ textAlign:"center", minWidth:100 }}>
                  <div style={{ fontSize:20, fontWeight:900 }}>Hoyo {hole+1}</div>
                  <div style={{ fontSize:12, color:D.gold, fontWeight:700 }}>PAR {par}</div>
                  <div style={{ fontSize:10, color:D.textDim, marginTop:2 }}>{posInOrder+1}/{pares.length} de la ronda</div>
                  {teeSt && <div style={{ display:"inline-block", marginTop:4, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, background:teeSt.bg, color:teeSt.fg, border:`1px solid ${teeSt.border}` }}>⛳ Tee {tee}</div>}
                </div>
                <button onClick={() => irAHoyo(Math.min(pares.length-1,posInOrder+1))} disabled={posInOrder===pares.length-1} style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:18,opacity:posInOrder===pares.length-1?0.3:1 }}>›</button>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20 }}>
                <button onClick={() => setScore(-1)} style={{ width:52,height:52,borderRadius:"50%",border:`1px solid ${D.border}`,background:D.surface,color:D.text,cursor:"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                <div style={{ width:60, textAlign:"center", fontSize:38, fontWeight:900 }}>{suScore ?? par}</div>
                <button onClick={() => setScore(1)} style={{ width:52,height:52,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
              </div>
              <div style={{ textAlign:"center", fontSize:11, color:D.textDim, marginTop:10 }}>{suScore===null||suScore===undefined ? "Aún no capturado (por defecto: par)" : "Capturado ✓"}</div>
            </Card>
          )}
          {tab === "marcar" && !marcoA && (
            <Card><div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no se te asignó una unidad para anotar.</div></Card>
          )}

          {tab === "mio" && (
            <Card>
              <SLabel>Tu score {meMarca ? `· anotado por ${nombreConJugadores(meMarca)}` : ""}</SLabel>
              <div style={{ textAlign:"center", padding:"8px 0" }}>
                <div style={{ fontSize:12, color:D.textSub }}>Hoyo {hole+1} · PAR {par}</div>
                {teeSt && <div style={{ display:"inline-block", marginTop:4, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, background:teeSt.bg, color:teeSt.fg, border:`1px solid ${teeSt.border}` }}>⛳ Tee {tee}</div>}
                <div style={{ fontSize:44, fontWeight:900, color:D.gold, margin:"8px 0" }}>{miScore ?? "—"}</div>
                <div style={{ fontSize:11, color:D.textDim }}>Solo lectura — lo anota {meMarca?.nombre || "tu equipo compañero"}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:8 }}>
                <button onClick={() => setPosInOrder(p => Math.max(0,p-1))} disabled={posInOrder===0} style={{ padding:"6px 14px", border:`1px solid ${D.border}`, borderRadius:20, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer", opacity:posInOrder===0?0.3:1 }}>‹ Anterior</button>
                <button onClick={() => setPosInOrder(p => Math.min(pares.length-1,p+1))} disabled={posInOrder===pares.length-1} style={{ padding:"6px 14px", border:`1px solid ${D.border}`, borderRadius:20, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer", opacity:posInOrder===pares.length-1?0.3:1 }}>Siguiente ›</button>
              </div>
            </Card>
          )}

          {tab === "pos" && <TablaPosiciones torneo={torneo} highlightId={unidadId} />}
          {tab === "tabla" && <TarjetaHoyoPorHoyo torneo={torneo} />}
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL (routing) ──────────────────────
export default function H19T() {
  const [mode, setMode] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [torneoInput, setTorneoInput] = useState("");
  const [activeCodigo, setActiveCodigo] = useState(null);
  const [activeTorneoId, setActiveTorneoId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eq = params.get("equipo");
    const tr = params.get("torneo");
    if (eq) { setActiveCodigo(eq.toUpperCase()); setMode("team"); }
    else if (tr) { setActiveTorneoId(tr); setMode("spectator"); }
    else setMode("home");
  }, []);

  if (mode === null) return <Spinner label="Cargando H19T..." />;
  if (mode === "team" && activeCodigo) return <TeamPlayView codigo={activeCodigo} onExit={() => { setMode("home"); window.history.replaceState({},"",window.location.pathname); }} />;
  if (mode === "spectator" && activeTorneoId) return <SpectatorTorneoView torneoId={activeTorneoId} />;

  if (mode === "home") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:16 }}>
        <div style={{ fontSize:64, fontWeight:900, letterSpacing:-3, color:D.gold, textAlign:"center" }}>H19T</div>
        <div style={{ fontSize:12, color:D.textSub, letterSpacing:3, textTransform:"uppercase", marginBottom:16 }}>Club de Golf</div>
        <Btn onClick={() => setMode("pin")}>🏌️ Entrar como Admin</Btn>
        <Btn outline onClick={() => setMode("codigo-input")}>🃏 Tengo un código de equipo</Btn>
        <Btn outline onClick={() => setMode("torneo-input")}>👀 Ver torneo en vivo</Btn>
      </div>
    );
  }

  if (mode === "pin") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontSize:36, fontWeight:900, color:D.gold, textAlign:"center" }}>H19T</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:8 }}>Ingresa tu PIN de administrador</div>
        <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" maxLength={6}
          style={{ width:"100%", padding:14, border:`1px solid ${pinError?D.danger:D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:22, textAlign:"center", letterSpacing:8, fontWeight:700 }} />
        {pinError && <div style={{ color:D.danger, fontSize:13 }}>PIN incorrecto</div>}
        <Btn onClick={() => { if (pinInput===ADMIN_PIN) { setMode("admin"); setPinError(false); } else setPinError(true); }}>Entrar</Btn>
        <button onClick={() => { setMode("home"); setPinInput(""); setPinError(false); }} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}>← Volver</button>
      </div>
    );
  }

  if (mode === "codigo-input") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontSize:36, fontWeight:900, color:D.gold }}>H19T</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:8, textAlign:"center" }}>Ingresa el código de tu equipo</div>
        <input value={codigoInput} onChange={e => setCodigoInput(e.target.value.toUpperCase())} placeholder="Código" maxLength={8}
          style={{ width:"100%", padding:14, border:`1px solid ${D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:20, textAlign:"center", letterSpacing:4, fontWeight:700 }} />
        <Btn onClick={() => { if (codigoInput.trim()) { const c = codigoInput.trim(); window.history.replaceState({},"",`${window.location.pathname}?equipo=${c}`); setActiveCodigo(c); setMode("team"); } }}>Entrar</Btn>
        <button onClick={() => setMode("home")} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}>← Volver</button>
      </div>
    );
  }

  if (mode === "torneo-input") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontSize:36, fontWeight:900, color:D.gold }}>H19T</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:8, textAlign:"center" }}>Ingresa el código del torneo</div>
        <input value={torneoInput} onChange={e => setTorneoInput(e.target.value.toUpperCase())} placeholder="Código de torneo" maxLength={8}
          style={{ width:"100%", padding:14, border:`1px solid ${D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:20, textAlign:"center", letterSpacing:4, fontWeight:700 }} />
        <Btn onClick={() => { if (torneoInput.trim()) { const t = torneoInput.trim(); window.history.replaceState({},"",`${window.location.pathname}?torneo=${t}`); setActiveTorneoId(t); setMode("spectator"); } }}>Ver torneo</Btn>
        <button onClick={() => setMode("home")} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}>← Volver</button>
      </div>
    );
  }

  if (mode === "admin") return <AdminTorneoApp onExit={() => setMode("home")} />;

  return null;
}

// ─── ADMIN APP ─────────────────────────────────────
function AdminTorneoApp({ onExit }) {
  const [screen, setScreen] = useState("dir");

  // Directorio compartido (mismo que H19 Golf)
  const [dir, setDir] = useState([]);
  const [nid, setNid] = useState(6);
  const [newName, setNewName] = useState("");
  const [newHC, setNewHC] = useState("");
  const [editingHC, setEditingHC] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Torneo activo en construcción / en curso
  const [torneoId, setTorneoId] = useState(null);
  const [torneo, setTorneo] = useState(null);
  const [nombreTorneo, setNombreTorneo] = useState("");
  const [campo, setCampo] = useState("huerta");
  const [nHoles, setNHoles] = useState(18);
  const [modalidad, setModalidad] = useState("individual");
  const [hcPercent, setHcPercent] = useState(80);

  // Constructor de unidades
  const [selJugadores, setSelJugadores] = useState(new Set());
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [editandoUnidadId, setEditandoUnidadId] = useState(null);
  const [editSelJugadores, setEditSelJugadores] = useState(new Set());
  const [editNombre, setEditNombre] = useState("");
  const [confirmDisolver, setConfirmDisolver] = useState(null);
  const [guardadoOk, setGuardadoOk] = useState("");

  // Constructor de grupos de salida
  const [hoyoSel, setHoyoSel] = useState(1);
  const [capturaUnidadId, setCapturaUnidadId] = useState(null);
  const [selUnidades, setSelUnidades] = useState([]); // orden importa (cadena)

  const [codigosUsados, setCodigosUsados] = useState(new Set());
  const [historial, setHistorial] = useState([]);
  const [expandedHist, setExpandedHist] = useState(null);
  const [shareMsg, setShareMsg] = useState("");
  const [listaTorneos, setListaTorneos] = useState([]);

  useEffect(() => {
    const dirRef = ref(db, "h19tDirectorio");
    const unsub = onValue(dirRef, snap => {
      if (snap.exists()) { const data = snap.val(); setDir(data.players || []); setNid(data.nextId || 1); }
      else {
        set(ref(db, "h19tDirectorio"), { nextId:1, players:[] });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const cRef = ref(db, "codigos");
    const unsub = onValue(cRef, snap => setCodigosUsados(new Set(snap.exists() ? Object.keys(snap.val()) : [])));
    return () => unsub();
  }, []);

  useEffect(() => {
    const hRef = ref(db, "torneoHistorial");
    const unsub = onValue(hRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setHistorial(Object.entries(data).map(([id,r]) => ({id,...r})).sort((a,b) => (b.fechaTs||0)-(a.fechaTs||0)));
      } else setHistorial([]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const tRef = ref(db, "torneos");
    const unsub = onValue(tRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setListaTorneos(Object.entries(data).filter(([,t]) => t.status !== "finalizada").map(([id,t]) => ({id,...t})));
      } else setListaTorneos([]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!torneoId) return;
    const r = ref(db, `torneos/${torneoId}`);
    const unsub = onValue(r, snap => setTorneo(snap.exists() ? snap.val() : null));
    return () => unsub();
  }, [torneoId]);

  const saveDir = (newPlayers, newNidVal) => set(ref(db, "h19tDirectorio"), { players:newPlayers, nextId:newNidVal||nid });
  const addPlayer = () => {
    const name = newName.trim(); if (!name) return;
    const hc = Math.max(0, parseInt(newHC)||0);
    saveDir([...dir, {id:nid, name, hc}], nid+1); setNid(nid+1); setNewName(""); setNewHC("");
  };
  const removePlayer = (id) => saveDir(dir.filter(p=>p.id!==id));

  const tamañoModalidad = MODALIDADES[modalidad].size;

  const crearTorneo = () => {
    const bp = CAMPOS[campo].pares || Array(18).fill(4);
    const pares = bp.slice(0, nHoles);
    const tid = Math.random().toString(36).substring(2,8).toUpperCase();
    const nuevo = {
      nombre: nombreTorneo.trim() || `Torneo ${new Date().toLocaleDateString('es-MX')}`,
      campo, nHoles, pares, modalidad, hcPercent,
      status: "armado", createdAt: Date.now(), updatedAt: Date.now(),
      unidades: {},
    };
    set(ref(db, `torneos/${tid}`), nuevo);
    setTorneoId(tid); setTorneo(nuevo);
    setScreen("unidades");
  };

  const abrirTorneoExistente = (t) => { setTorneoId(t.id); setScreen(t.status === "armado" ? "unidades" : "live"); };

  const toggleJugadorSel = (id) => {
    const s = new Set(selJugadores);
    s.has(id) ? s.delete(id) : s.add(id);
    if (s.size > tamañoModalidad) return; // no exceder tamaño de modalidad
    setSelJugadores(s);
  };

  const crearUnidad = () => {
    if (!torneo || selJugadores.size !== tamañoModalidad) return;
    const jugadores = dir.filter(p => selJugadores.has(p.id)).map(p => ({ id:p.id, name:p.name, hc:p.hc }));
    const hcAplicado = calcHcAplicado(jugadores, torneo.hcPercent);
    const existentes = Object.keys(torneo.unidades||{}).length;
    const uid = `U${existentes+1}`;
    const nombre = tamañoModalidad===1 ? jugadores[0].name : (nombreEquipo.trim() || `Equipo ${existentes+1}`);
    const unidad = { id:uid, nombre, jugadores, hcAplicado, hoyoSalida:null, grupoId:null, marcaA:null, marcadoPor:null, codigo:null, scores:Array(torneo.nHoles).fill(null) };
    set(ref(db, `torneos/${torneoId}/unidades/${uid}`), unidad);
    setSelJugadores(new Set()); setNombreEquipo("");
  };

  const eliminarUnidad = (uid) => remove(ref(db, `torneos/${torneoId}/unidades/${uid}`));

  const iniciarEdicionUnidad = (u) => {
    setEditandoUnidadId(u.id);
    setEditSelJugadores(new Set(u.jugadores.map(j=>j.id)));
    setEditNombre(u.nombre);
  };
  const cancelarEdicionUnidad = () => { setEditandoUnidadId(null); setEditSelJugadores(new Set()); setEditNombre(""); };
  const guardarEdicionUnidad = () => {
    if (!torneo || !editandoUnidadId) return;
    const jugadores = dir.filter(p => editSelJugadores.has(p.id)).map(p => ({ id:p.id, name:p.name, hc:p.hc }));
    if (jugadores.length !== tamañoModalidad) return;
    const hcAplicado = calcHcAplicado(jugadores, torneo.hcPercent);
    const nombre = tamañoModalidad===1 ? jugadores[0].name : (editNombre.trim() || torneo.unidades[editandoUnidadId].nombre);
    Promise.all([
      set(ref(db, `torneos/${torneoId}/unidades/${editandoUnidadId}/jugadores`), jugadores),
      set(ref(db, `torneos/${torneoId}/unidades/${editandoUnidadId}/hcAplicado`), hcAplicado),
      set(ref(db, `torneos/${torneoId}/unidades/${editandoUnidadId}/nombre`), nombre),
    ]).then(() => { setGuardadoOk("✓ Cambios guardados"); setTimeout(()=>setGuardadoOk(""), 2000); });
    cancelarEdicionUnidad();
  };

  // Deshace un grupo de salida completo, regresando sus unidades a "sin grupo" para poder reasignarlas
  const disolverGrupo = (us) => {
    const updates = {};
    us.forEach(u => {
      updates[`torneos/${torneoId}/unidades/${u.id}/grupoId`] = null;
      updates[`torneos/${torneoId}/unidades/${u.id}/hoyoSalida`] = null;
      updates[`torneos/${torneoId}/unidades/${u.id}/marcaA`] = null;
      updates[`torneos/${torneoId}/unidades/${u.id}/marcadoPor`] = null;
    });
    Promise.all(Object.entries(updates).map(([path,val]) => set(ref(db, path), val)));
    setConfirmDisolver(null);
  };

  const toggleUnidadGrupo = (uid) => {
    setSelUnidades(prev => prev.includes(uid) ? prev.filter(x=>x!==uid) : (prev.length>=4 ? prev : [...prev, uid]));
  };

  const crearGrupo = () => {
    if (!torneo || selUnidades.length < 2) return;
    const chain = buildChain(selUnidades);
    const grupoId = `G${Date.now()}`;
    const usados = new Set(codigosUsados);
    const updates = {};
    selUnidades.forEach(uid => {
      const yaTieneCodigo = torneo.unidades[uid]?.codigo;
      const codigo = yaTieneCodigo || genCodigo(usados); usados.add(codigo);
      updates[`torneos/${torneoId}/unidades/${uid}/hoyoSalida`] = hoyoSel - 1;
      updates[`torneos/${torneoId}/unidades/${uid}/grupoId`] = grupoId;
      updates[`torneos/${torneoId}/unidades/${uid}/marcaA`] = chain[uid].marcaA;
      updates[`torneos/${torneoId}/unidades/${uid}/marcadoPor`] = chain[uid].marcadoPor;
      updates[`torneos/${torneoId}/unidades/${uid}/codigo`] = codigo;
      updates[`codigos/${codigo}`] = { torneoId, unidadId: uid };
    });
    Promise.all(Object.entries(updates).map(([path,val]) => set(ref(db, path), val)));
    setSelUnidades([]);
    // Avanza automáticamente al siguiente hoyo libre, para no repetir por accidente
    if (torneo.pares) {
      const usadosHoyos = new Set(Object.values(torneo.unidades||{}).filter(u=>u.grupoId).map(u=>u.hoyoSalida));
      usadosHoyos.add(hoyoSel - 1);
      let siguiente = null;
      for (let i=0; i<torneo.pares.length; i++) { if (!usadosHoyos.has(i)) { siguiente = i+1; break; } }
      if (siguiente) setHoyoSel(siguiente);
    }
  };

  // Corrige el hoyo de salida de un grupo ya creado (por si se asignó mal)
  const cambiarHoyoGrupo = (unidadesDelGrupo, nuevoHoyo) => {
    const updates = {};
    unidadesDelGrupo.forEach(u => { updates[`torneos/${torneoId}/unidades/${u.id}/hoyoSalida`] = nuevoHoyo - 1; });
    Promise.all(Object.entries(updates).map(([path,val]) => set(ref(db, path), val)));
  };

  const iniciarTorneo = () => { set(ref(db, `torneos/${torneoId}/status`), "en_juego"); };

  // El admin puede corregir/capturar el score de CUALQUIER unidad, en cualquier hoyo
  const ajustarScoreAdmin = (uid, holeIdx, delta) => {
    if (!torneo) return;
    const u = torneo.unidades[uid];
    const par = torneo.pares[holeIdx];
    const current = u.scores?.[holeIdx] ?? par;
    const val = Math.max(1, current + delta);
    set(ref(db, `torneos/${torneoId}/unidades/${uid}/scores/${holeIdx}`), val);
  };
  const borrarScoreAdmin = (uid, holeIdx) => {
    set(ref(db, `torneos/${torneoId}/unidades/${uid}/scores/${holeIdx}`), null);
  };

  const finalizarTorneo = () => {
    if (!torneo) return;
    const rows = leaderboard(torneo);
    const fecha = new Date();
    const fechaStr = `${fecha.getDate().toString().padStart(2,'0')}/${(fecha.getMonth()+1).toString().padStart(2,'0')}`;
    const histData = {
      nombre: torneo.nombre, campo: torneo.campo, nHoles: torneo.nHoles, modalidad: torneo.modalidad,
      hcPercent: torneo.hcPercent, fechaTs: Date.now(), fecha: fechaStr,
      pares: torneo.pares,
      ganador: rows[0]?.nombre || "—", netoGanador: rows[0]?.neto ?? null,
      unidades: rows.map(u => ({ id:u.id, nombre:u.nombre, jugadores:u.jugadores, hcAplicado:u.hcAplicado, neto:u.neto, brutoReal:u.brutoReal, scores:u.scores })),
    };
    set(ref(db, `torneoHistorial/${torneoId}`), histData);
    set(ref(db, `torneos/${torneoId}/status`), "finalizada");
    setScreen("resultados");
  };

  const shareTorneo = () => {
    const url = `${window.location.origin}${window.location.pathname}?torneo=${torneoId}`;
    if (navigator.clipboard) { navigator.clipboard.writeText(url); setShareMsg("¡Link copiado!"); setTimeout(()=>setShareMsg(""),2500); }
  };

  const compartirCodigoIndividual = (u) => {
    const url = `${window.location.origin}${window.location.pathname}?equipo=${u.codigo}`;
    const lines = [
      `⛳ *H19T — ${torneo.nombre}*`,
      `Hola equipo *${u.nombre}* 👋`,
      `Integrantes: ${u.jugadores.map(j=>j.name).join(", ")}`,
      `Salen del hoyo *${u.hoyoSalida+1}*`,
      ``,
      `Su código de acceso es: *${u.codigo}*`,
      `Entren directo aquí: ${url}`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
  };

  const appSt = { fontSize:14, fontFamily:"-apple-system,sans-serif", color:D.text, background:D.bg, minHeight:"100vh", maxWidth:420, margin:"0 auto", paddingBottom:32 };
  const tog = (a) => ({ flex:1, padding:9, border:`1px solid ${a?D.gold:D.border}`, borderRadius:10, background:a?D.goldDim:"transparent", color:a?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer" });

  const Header = ({ title }) => (
    <div style={{ background:D.surface, borderBottom:`1px solid ${D.border}`, padding:"20px 16px 14px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:24, fontWeight:900, color:D.gold }}>H19T</div>
        <button onClick={onExit} style={{ fontSize:12, color:D.textSub, background:"none", border:`1px solid ${D.border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>Salir</button>
      </div>
      {title && <div style={{ fontSize:11, color:D.textSub, letterSpacing:2, textTransform:"uppercase", marginTop:2 }}>{title}</div>}
    </div>
  );

  const mainTabs = [{key:"dir",label:"👥 Jugadores"},{key:"nuevo",label:"🆕 Nuevo torneo"},{key:"hist",label:"📋 Historial"}];

  // ── DIRECTORIO ──
  if (screen==="dir") return (
    <div style={appSt}>
      <Header title="Admin" />
      <div style={{ padding:"12px 12px" }}>
        <TabBar tabs={mainTabs} active="dir" onChange={k => setScreen(k)} />
        {listaTorneos.length > 0 && (
          <Card>
            <SLabel>⛳ Torneos en curso</SLabel>
            {listaTorneos.map(t => (
              <div key={t.id} onClick={() => abrirTorneoExistente(t)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${D.border}`, cursor:"pointer" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{t.nombre}</div>
                  <div style={{ fontSize:11, color:D.textSub }}>{CAMPOS[t.campo]?.nombre} · {MODALIDADES[t.modalidad]?.label} · {t.status}</div>
                </div>
                <div style={{ fontSize:16, color:D.gold }}>›</div>
              </div>
            ))}
          </Card>
        )}
        <Card>
          <SLabel>Miembros del grupo</SLabel>
          {dir.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:24, fontSize:13 }}>No hay jugadores aún</div>}
          {dir.map((p, idx) => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:idx<dir.length-1?`1px solid ${D.border}`:"none" }}>
              <Avatar name={p.name} id={p.id} size={36} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{p.name}</div>
                {editingHC===p.id ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                    <span style={{ fontSize:11, color:D.gold }}>HC</span>
                    <input type="number" min="0" max="54" defaultValue={p.hc} autoFocus
                      onBlur={e => { const v=Math.max(0,parseInt(e.target.value)||0); saveDir(dir.map(d=>d.id===p.id?{...d,hc:v}:d)); setEditingHC(null); }}
                      style={{ width:56, padding:"4px 8px", border:`1px solid ${D.gold}`, borderRadius:8, background:D.surface, color:D.gold, fontSize:13, fontWeight:700, textAlign:"center" }} />
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:D.gold, marginTop:1, cursor:"pointer" }} onClick={() => setEditingHC(p.id)}>Handicap {p.hc} <span style={{ color:D.textDim, fontSize:10 }}>· toca para editar</span></div>
                )}
              </div>
              {confirmDelete===p.id ? (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <button onClick={() => { removePlayer(p.id); setConfirmDelete(null); }} style={{ padding:"5px 10px", border:`1px solid ${D.danger}`, borderRadius:8, background:D.redBg, color:D.danger, fontSize:11, fontWeight:700, cursor:"pointer" }}>Sí</button>
                  <button onClick={() => setConfirmDelete(null)} style={{ padding:"5px 10px", border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:11, cursor:"pointer" }}>No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(p.id)} style={{ padding:"5px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}>✕</button>
              )}
            </div>
          ))}
        </Card>
        <Card>
          <SLabel>Agregar jugador</SLabel>
          <div style={{ display:"flex", gap:8 }}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nombre" style={{ flex:1, padding:"10px 12px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:14 }} />
            <input value={newHC} onChange={e=>setNewHC(e.target.value)} type="number" min="0" max="54" placeholder="HC" style={{ width:56, padding:"10px 8px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:14, textAlign:"center" }} />
            <button onClick={addPlayer} style={{ padding:"10px 14px", border:`1px solid ${D.gold}`, borderRadius:10, background:D.goldDim, color:D.gold, fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Agregar</button>
          </div>
        </Card>
        <Btn onClick={() => setScreen("nuevo")}>⛳ Crear nuevo torneo</Btn>
      </div>
    </div>
  );

  // ── NUEVO TORNEO (config) ──
  if (screen==="nuevo") return (
    <div style={appSt}>
      <Header title="Nuevo torneo" />
      <div style={{ padding:"12px 12px" }}>
        <TabBar tabs={mainTabs} active="nuevo" onChange={k => setScreen(k)} />
        <Card>
          <SLabel>Nombre del torneo</SLabel>
          <input value={nombreTorneo} onChange={e=>setNombreTorneo(e.target.value)} placeholder={`Torneo ${new Date().toLocaleDateString('es-MX')}`}
            style={{ width:"100%", padding:"10px 12px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:14, boxSizing:"border-box" }} />
        </Card>
        <Card>
          <SLabel>Campo</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Object.entries(CAMPOS).map(([key,c]) => (
              <button key={key} onClick={() => setCampo(key)} style={{ width:"100%", padding:"10px 14px", border:`1px solid ${campo===key?D.gold:D.border}`, borderRadius:10, background:campo===key?D.goldDim:"transparent", color:campo===key?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer", textAlign:"left" }}>
                {campo===key?"✓ ":""}{c.nombre}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SLabel>Hoyos</SLabel>
          <div style={{ display:"flex", gap:8 }}>
            {[9,18].map(h => <button key={h} onClick={() => setNHoles(h)} style={tog(nHoles===h)}>{h} hoyos</button>)}
          </div>
        </Card>
        <Card>
          <SLabel>Modalidad</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Object.entries(MODALIDADES).map(([key,m]) => (
              <button key={key} onClick={() => setModalidad(key)} style={{ width:"100%", padding:"10px 14px", border:`1px solid ${modalidad===key?D.gold:D.border}`, borderRadius:10, background:modalidad===key?D.goldDim:"transparent", color:modalidad===key?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer", textAlign:"left" }}>
                {modalidad===key?"✓ ":""}{m.label} {m.size>1?`(${m.size} jugadores, scramble)`:"(1 jugador)"}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SLabel>% de Handicap aplicado</SLabel>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => setHcPercent(Math.max(0,hcPercent-5))} style={{ width:34,height:34,borderRadius:"50%",border:`1px solid ${D.border}`,background:"transparent",color:D.text,cursor:"pointer",fontSize:18 }}>−</button>
            <div style={{ flex:1, textAlign:"center", fontSize:20, fontWeight:900, color:D.gold }}>{hcPercent}%</div>
            <button onClick={() => setHcPercent(Math.min(150,hcPercent+5))} style={{ width:34,height:34,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:18 }}>+</button>
          </div>
          <div style={{ fontSize:11, color:D.textSub, marginTop:8 }}>
            {modalidad==="individual" ? "Se aplica a cada jugador: HC × %" : "Se aplica al promedio de HC del equipo: (suma HC / integrantes) × %"}
          </div>
        </Card>
        <Btn onClick={crearTorneo}>Crear torneo y armar unidades</Btn>
        <Btn outline onClick={() => setScreen("dir")} style={{ marginTop:8 }}>← Volver</Btn>
      </div>
    </div>
  );

  // ── UNIDADES (equipos/jugadores competidores) ──
  if (screen==="unidades" && torneo) {
    const asignados = new Set(Object.values(torneo.unidades||{}).flatMap(u => u.jugadores.map(j=>j.id)));
    const disponibles = dir.filter(p => !asignados.has(p.id));
    const unidadesList = Object.values(torneo.unidades||{});
    const asignadosOtros = new Set(Object.values(torneo.unidades||{}).filter(u=>u.id!==editandoUnidadId).flatMap(u => u.jugadores.map(j=>j.id)));
    const disponiblesEdit = dir.filter(p => !asignadosOtros.has(p.id));
    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"captura",label:"✏️ Capturar"},{key:"imprimir",label:"🖨️ Imprimir"},{key:"live",label:"🏆 En vivo"}]} active="unidades" onChange={setScreen} />
          <Card>
            <SLabel>{MODALIDADES[torneo.modalidad].label} · {torneo.nHoles} hoyos · HC {torneo.hcPercent}%</SLabel>
            <div style={{ fontSize:12, color:D.textSub }}>Selecciona {tamañoModalidad} jugador{tamañoModalidad>1?"es":""} para formar {tamañoModalidad>1?"un equipo":"una unidad individual"}.</div>
          </Card>
          <Card>
            <SLabel>Jugadores disponibles ({disponibles.length})</SLabel>
            {disponibles.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Todos los jugadores del directorio ya están asignados</div>}
            {disponibles.map((p, idx) => (
              <div key={p.id} onClick={() => toggleJugadorSel(p.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:idx<disponibles.length-1?`1px solid ${D.border}`:"none", cursor:"pointer" }}>
                <div style={{ width:20,height:20,borderRadius:5,border:`2px solid ${selJugadores.has(p.id)?D.gold:D.border}`,background:selJugadores.has(p.id)?D.goldDim:"transparent",color:D.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700 }}>{selJugadores.has(p.id)?"✓":""}</div>
                <Avatar name={p.name} id={p.id} size={28} />
                <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:11, color:D.gold }}>HC {p.hc}</div>
              </div>
            ))}
          </Card>
          {tamañoModalidad>1 && (
            <Card>
              <SLabel>Nombre del equipo (opcional)</SLabel>
              <input value={nombreEquipo} onChange={e=>setNombreEquipo(e.target.value)} placeholder={`Equipo ${unidadesList.length+1}`}
                style={{ width:"100%", padding:"10px 12px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:14, boxSizing:"border-box" }} />
            </Card>
          )}
          <Btn onClick={crearUnidad} disabled={selJugadores.size!==tamañoModalidad}>
            {selJugadores.size}/{tamañoModalidad} seleccionados — Crear unidad
          </Btn>

          <Card style={{ marginTop:16 }}>
            <SLabel>Unidades creadas ({unidadesList.length})</SLabel>
            {guardadoOk && <div style={{ textAlign:"center", color:D.success, fontSize:12, fontWeight:600, marginBottom:8 }}>{guardadoOk}</div>}
            {unidadesList.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
            {unidadesList.map((u, idx) => (
              <div key={u.id} style={{ padding:"9px 0", borderBottom:idx<unidadesList.length-1?`1px solid ${D.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Avatar name={u.nombre} id={u.id} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{u.nombre}</div>
                    <div style={{ fontSize:10, color:D.textSub }}>{u.jugadores.map(j=>j.name).join(", ")} · HC aplicado {u.hcAplicado}</div>
                  </div>
                  {u.grupoId && <div style={{ fontSize:10, color:D.success, fontWeight:700 }}>Hoyo {u.hoyoSalida+1} ✓</div>}
                  <button onClick={() => editandoUnidadId===u.id ? cancelarEdicionUnidad() : iniciarEdicionUnidad(u)} style={{ padding:"4px 8px", border:`1px solid ${editandoUnidadId===u.id?D.gold:D.border}`, borderRadius:8, background:editandoUnidadId===u.id?D.goldDim:"transparent", color:editandoUnidadId===u.id?D.gold:D.textSub, fontSize:11, cursor:"pointer" }}>{editandoUnidadId===u.id?"✕":"Editar"}</button>
                  {!u.grupoId && <button onClick={() => eliminarUnidad(u.id)} style={{ padding:"4px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}>🗑</button>}
                </div>

                {editandoUnidadId===u.id && (
                  <div style={{ marginTop:10, padding:12, background:D.bg, borderRadius:10 }}>
                    {tamañoModalidad>1 && (
                      <input value={editNombre} onChange={e=>setEditNombre(e.target.value)} placeholder="Nombre del equipo"
                        style={{ width:"100%", padding:"8px 10px", border:`1px solid ${D.border}`, borderRadius:8, background:D.surface, color:D.text, fontSize:13, boxSizing:"border-box", marginBottom:10 }} />
                    )}
                    <div style={{ fontSize:11, color:D.textSub, marginBottom:8 }}>Selecciona {tamañoModalidad} jugador{tamañoModalidad>1?"es":""} ({editSelJugadores.size}/{tamañoModalidad})</div>
                    {disponiblesEdit.map((p, i) => (
                      <div key={p.id} onClick={() => { const s=new Set(editSelJugadores); if (s.has(p.id)) s.delete(p.id); else { if (s.size>=tamañoModalidad) return; s.add(p.id); } setEditSelJugadores(s); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:i<disponiblesEdit.length-1?`1px solid ${D.border}`:"none", cursor:"pointer" }}>
                        <div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${editSelJugadores.has(p.id)?D.gold:D.border}`,background:editSelJugadores.has(p.id)?D.goldDim:"transparent",color:D.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700 }}>{editSelJugadores.has(p.id)?"✓":""}</div>
                        <Avatar name={p.name} id={p.id} size={24} />
                        <div style={{ flex:1, fontSize:12, fontWeight:600 }}>{p.name}</div>
                        <div style={{ fontSize:10, color:D.gold }}>HC {p.hc}</div>
                      </div>
                    ))}
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <button onClick={guardarEdicionUnidad} disabled={editSelJugadores.size!==tamañoModalidad} style={{ flex:1, padding:8, border:"none", borderRadius:8, background:editSelJugadores.size!==tamañoModalidad?D.border:D.gold, color:"#fff", fontSize:12, fontWeight:700, cursor:editSelJugadores.size!==tamañoModalidad?"default":"pointer" }}>Guardar cambios</button>
                      <button onClick={cancelarEdicionUnidad} style={{ flex:1, padding:8, border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer" }}>Cancelar</button>
                    </div>
                    {u.grupoId && <div style={{ fontSize:10, color:D.textDim, marginTop:8 }}>Esta unidad ya está en un grupo de salida — cambiar sus integrantes no afecta su hoyo ni su código.</div>}
                  </div>
                )}
              </div>
            ))}
          </Card>
          <Btn outline onClick={() => setScreen("grupos")}>Siguiente: grupos de salida →</Btn>
        </div>
      </div>
    );
  }

  // ── GRUPOS DE SALIDA Y CÓDIGOS ──
  if (screen==="grupos" && torneo) {
    const unidadesList = Object.values(torneo.unidades||{});
    const sinGrupo = unidadesList.filter(u => !u.grupoId);
    const gruposMap = {};
    unidadesList.filter(u=>u.grupoId).forEach(u => { (gruposMap[u.grupoId] = gruposMap[u.grupoId]||[]).push(u); });
    const todasAsignadas = sinGrupo.length===0 && unidadesList.length>0;
    const hoyosUsados = new Set(unidadesList.filter(u=>u.grupoId).map(u=>u.hoyoSalida+1));

    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"captura",label:"✏️ Capturar"},{key:"imprimir",label:"🖨️ Imprimir"},{key:"live",label:"🏆 En vivo"}]} active="grupos" onChange={setScreen} />

          {sinGrupo.length>0 && (
            <Card>
              <SLabel>Armar grupo de salida</SLabel>
              <div style={{ fontSize:12, color:D.textSub, marginBottom:10 }}>Selecciona de 2 a 4 unidades (el orden en que las toques define la cadena de marcaje: la 1ª anota a la 2ª, la 2ª a la 3ª... y la última anota a la 1ª).</div>
              <div style={{ marginBottom:10 }}>
                <span style={{ fontSize:12, color:D.textSub, marginRight:8 }}>Hoyo de salida</span>
                <select value={hoyoSel} onChange={e=>setHoyoSel(parseInt(e.target.value))} style={{ padding:"6px 10px", border:`1px solid ${hoyosUsados.has(hoyoSel)?D.danger:D.border}`, borderRadius:8, background:D.surface, color:D.text, fontSize:13 }}>
                  {torneo.pares.map((_,i) => <option key={i} value={i+1}>Hoyo {i+1}{hoyosUsados.has(i+1)?" (ya ocupado)":""}</option>)}
                </select>
                {hoyosUsados.has(hoyoSel) && <div style={{ fontSize:11, color:D.danger, marginTop:6 }}>⚠️ Ya hay un grupo saliendo del hoyo {hoyoSel}. Verifica que sea correcto antes de continuar.</div>}
              </div>
              {sinGrupo.map((u, idx) => {
                const pos = selUnidades.indexOf(u.id);
                return (
                  <div key={u.id} onClick={() => toggleUnidadGrupo(u.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:idx<sinGrupo.length-1?`1px solid ${D.border}`:"none", cursor:"pointer" }}>
                    <div style={{ width:22,height:22,borderRadius:"50%",border:`2px solid ${pos>=0?D.gold:D.border}`,background:pos>=0?D.goldDim:"transparent",color:D.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900 }}>{pos>=0?pos+1:""}</div>
                    <Avatar name={u.nombre} id={u.id} size={26} />
                    <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{u.nombre}</div>
                  </div>
                );
              })}
              <Btn onClick={crearGrupo} disabled={selUnidades.length<2}>Crear grupo ({selUnidades.length} unidades) →</Btn>
            </Card>
          )}

          <Card>
            <SLabel>Grupos armados</SLabel>
            {Object.keys(gruposMap).length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay grupos</div>}
            {Object.entries(gruposMap).map(([gid, us]) => (
              <div key={gid} style={{ padding:"10px 0", borderBottom:`1px solid ${D.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:11, color:D.gold, fontWeight:700 }}>Hoyo de salida:</span>
                  <select value={us[0].hoyoSalida+1} onChange={e=>cambiarHoyoGrupo(us, parseInt(e.target.value))} style={{ padding:"3px 8px", border:`1px solid ${D.border}`, borderRadius:8, background:D.surface, color:D.gold, fontSize:12, fontWeight:700 }}>
                    {torneo.pares.map((_,i) => <option key={i} value={i+1}>Hoyo {i+1}</option>)}
                  </select>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6 }}>
                  {us.map((u,i) => (
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ padding:"4px 10px", background:D.goldDim, border:`1px solid ${D.gold}33`, borderRadius:14, fontSize:12, fontWeight:600 }}>{u.nombre}</div>
                      {i<us.length-1 && <span style={{ color:D.textDim }}>→</span>}
                    </div>
                  ))}
                  <span style={{ color:D.textDim }}>→ ({us[0].nombre})</span>
                </div>
                <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:6 }}>
                  {us.map(u => (
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:11, color:D.textSub, flex:1 }}>{u.nombre}: código <b style={{ color:D.gold }}>{u.codigo}</b></div>
                      <button onClick={() => compartirCodigoIndividual(u)} style={{ padding:"4px 10px", border:"none", borderRadius:8, background:"#25D366", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>💬 Enviar</button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:8 }}>
                  {confirmDisolver===gid ? (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11, color:D.danger, flex:1 }}>¿Deshacer este grupo? Las unidades vuelven a "sin grupo" para reasignarlas.</span>
                      <button onClick={() => disolverGrupo(us)} style={{ padding:"5px 10px", border:`1px solid ${D.danger}`, borderRadius:8, background:D.redBg, color:D.danger, fontSize:11, fontWeight:700, cursor:"pointer" }}>Sí</button>
                      <button onClick={() => setConfirmDisolver(null)} style={{ padding:"5px 10px", border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:11, cursor:"pointer" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDisolver(gid)} style={{ padding:"5px 10px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}>↩ Deshacer grupo (mover equipos)</button>
                  )}
                </div>
              </div>
            ))}
          </Card>

          {torneo.status !== "en_juego" && torneo.status !== "finalizada" && (
            <Btn onClick={iniciarTorneo} disabled={!todasAsignadas}>{todasAsignadas ? "🚩 Iniciar torneo" : `Faltan ${sinGrupo.length} unidades por agrupar`}</Btn>
          )}
          {torneo.status === "en_juego" && (
            <div style={{ padding:"10px 12px", background:D.greenBg, border:`1px solid ${D.success}`, borderRadius:10, color:D.success, fontSize:12, fontWeight:600, textAlign:"center", marginBottom:10 }}>✓ Torneo en curso — los equipos ya pueden anotar</div>
          )}
        </div>
      </div>
    );
  }

  // ── LISTA IMPRIMIBLE DE EQUIPOS Y CÓDIGOS ──
  if (screen==="imprimir" && torneo) {
    const unidadesList = Object.values(torneo.unidades||{}).slice().sort((a,b) => {
      const ha = a.hoyoSalida ?? 999, hb = b.hoyoSalida ?? 999;
      return ha - hb || a.nombre.localeCompare(b.nombre);
    });
    return (
      <div style={appSt}>
        <style>{`@media print { .no-print { display:none !important; } .print-card { border:1px solid #ccc !important; box-shadow:none !important; } }`}</style>
        <div className="no-print">
          <Header title={torneo.nombre} />
        </div>
        <div style={{ padding:"12px 12px" }} className="no-print">
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"captura",label:"✏️ Capturar"},{key:"imprimir",label:"🖨️ Imprimir"},{key:"live",label:"🏆 En vivo"}]} active="imprimir" onChange={setScreen} />
          <button onClick={() => window.print()} style={{ width:"100%", padding:"12px", border:"none", borderRadius:12, background:`linear-gradient(135deg,${D.gold},${D.goldLight})`, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>🖨️ Imprimir esta lista</button>
        </div>
        <div style={{ padding:"0 12px 32px" }}>
          <Card className="print-card">
            <SLabel>Equipos, jugadores y códigos — {torneo.nombre}</SLabel>
            {unidadesList.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
            {unidadesList.map((u, idx) => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:idx<unidadesList.length-1?`1px solid ${D.border}`:"none" }}>
                <div style={{ width:56, fontSize:11, color:D.textSub, fontWeight:700 }}>{u.hoyoSalida!=null ? `Hoyo ${u.hoyoSalida+1}` : "Sin hoyo"}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{u.nombre}</div>
                  <div style={{ fontSize:11, color:D.textSub }}>{u.jugadores.map(j=>j.name).join(", ")}</div>
                </div>
                <div style={{ fontSize:16, fontWeight:900, color:D.gold, letterSpacing:1 }}>{u.codigo || "— sin código —"}</div>
              </div>
            ))}
          </Card>
          <div style={{ fontSize:11, color:D.textDim, textAlign:"center" }} className="no-print">Cada equipo debe usar únicamente su propio código para evitar que anoten scores que no les corresponden.</div>
        </div>
      </div>
    );
  }
  if ((screen==="live" || screen==="resultados") && torneo) {
    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"captura",label:"✏️ Capturar"},{key:"imprimir",label:"🖨️ Imprimir"},{key:"live",label:"🏆 En vivo"}]} active="live" onChange={setScreen} />
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <button onClick={shareTorneo} style={{ flex:1, padding:"10px", border:`1px solid ${D.gold}`, borderRadius:12, background:D.goldDim, color:D.gold, fontSize:12, fontWeight:700, cursor:"pointer" }}>📤 Compartir link espectador</button>
          </div>
          {shareMsg && <div style={{ textAlign:"center", color:D.success, fontSize:12, marginBottom:8 }}>{shareMsg}</div>}
          <div style={{ textAlign:"center", fontSize:11, color:D.textSub, marginBottom:10 }}>Código de torneo: <b style={{ color:D.gold }}>{torneoId}</b></div>
          <TablaPosiciones torneo={torneo} />
          <TarjetaHoyoPorHoyo torneo={torneo} />
          {torneo.status !== "finalizada" ? (
            <Btn danger onClick={finalizarTorneo}>🏁 Finalizar torneo</Btn>
          ) : (
            <div style={{ textAlign:"center", padding:12, color:D.success, fontWeight:700 }}>🏆 Torneo finalizado</div>
          )}
        </div>
      </div>
    );
  }

  // ── CAPTURA / CORRECCIÓN DE SCORES (admin) ──
  if (screen==="captura" && torneo) {
    const unidadesList = Object.values(torneo.unidades||{});
    const u = capturaUnidadId ? torneo.unidades[capturaUnidadId] : null;
    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"captura",label:"✏️ Capturar"},{key:"imprimir",label:"🖨️ Imprimir"},{key:"live",label:"🏆 En vivo"}]} active="captura" onChange={setScreen} />
          <Card>
            <SLabel>Elige la unidad a capturar o corregir</SLabel>
            <div style={{ fontSize:12, color:D.textSub, marginBottom:10 }}>Como admin puedes anotar o corregir el score de cualquier equipo, sin necesitar su código — útil para errores o para ayudar con la captura.</div>
            <select value={capturaUnidadId||""} onChange={e=>setCapturaUnidadId(e.target.value||null)} style={{ width:"100%", padding:"10px 12px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:14 }}>
              <option value="">— Selecciona una unidad —</option>
              {unidadesList.map(un => <option key={un.id} value={un.id}>{un.nombre}{un.jugadores?.length>1?` (${un.jugadores.map(j=>j.name).join(", ")})`:""}</option>)}
            </select>
          </Card>

          {u && (
            <Card>
              <SLabel>{u.nombre} — hoyo por hoyo</SLabel>
              {torneo.pares.map((_, i) => (u.hoyoSalida??0) + i).map(h0 => h0 % torneo.pares.length).map(h => {
                const par = torneo.pares[h];
                const s = u.scores?.[h];
                const b = getBadge(s, par);
                const tee = teeColor(torneo.campo, h);
                const ts = teeStyle(tee);
                return (
                  <div key={h} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:h<torneo.pares.length-1?`1px solid ${D.border}`:"none" }}>
                    <div style={{ width:50 }}>
                      <div style={{ fontSize:12, fontWeight:700 }}>Hoyo {h+1}</div>
                      <div style={{ fontSize:10, color:D.textSub }}>Par {par}</div>
                    </div>
                    {ts && <span style={{ fontSize:8, padding:"2px 5px", borderRadius:6, fontWeight:700, background:ts.bg, color:ts.fg, border:`1px solid ${ts.border}` }}>{tee}</span>}
                    {b && <span style={{ fontSize:9, padding:"2px 6px", borderRadius:8, fontWeight:700, background:b.bg, color:b.fg }}>{b.label}</span>}
                    <div style={{ flex:1 }} />
                    <button onClick={() => ajustarScoreAdmin(u.id, h, -1)} style={{ width:30,height:30,borderRadius:"50%",border:`1px solid ${D.border}`,background:D.surface,color:D.text,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                    <div style={{ width:28, textAlign:"center", fontSize:16, fontWeight:900 }}>{s ?? "—"}</div>
                    <button onClick={() => ajustarScoreAdmin(u.id, h, 1)} style={{ width:30,height:30,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
                    {s !== null && s !== undefined && (
                      <button onClick={() => borrarScoreAdmin(u.id, h)} style={{ padding:"5px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}>✕</button>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize:11, color:D.textDim, marginTop:10, textAlign:"center" }}>Los cambios se guardan al instante y se reflejan en vivo para todos.</div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── HISTORIAL ──
  if (screen==="hist") return (
    <div style={appSt}>
      <Header title="Historial de torneos" />
      <div style={{ padding:"12px 12px" }}>
        <TabBar tabs={mainTabs} active="hist" onChange={setScreen} />
        <Card>
          <SLabel>Torneos jugados</SLabel>
          {historial.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:24, fontSize:13 }}>No hay torneos guardados aún</div>}
          {historial.map((r, idx) => {
            const isOpen = expandedHist === r.id;
            return (
              <div key={r.id} style={{ padding:"12px 0", borderBottom:idx<historial.length-1?`1px solid ${D.border}`:"none" }}>
                <div onClick={() => setExpandedHist(isOpen?null:r.id)} style={{ cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{r.nombre}</div>
                    <div style={{ fontSize:11, color:D.textSub }}>{r.fecha}</div>
                  </div>
                  <div style={{ fontSize:12, color:D.textSub, marginBottom:6 }}>{CAMPOS[r.campo]?.nombre} · {MODALIDADES[r.modalidad]?.label} · HC {r.hcPercent}%</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontSize:12, background:D.goldDim, color:D.gold, padding:"2px 10px", borderRadius:10, fontWeight:700 }}>🏆 {r.ganador} ({r.netoGanador} neto)</div>
                    <div style={{ fontSize:11, color:D.textSub }}>{isOpen?"▲":"▼"}</div>
                  </div>
                </div>
                {isOpen && r.unidades && (
                  <div style={{ marginTop:10, background:D.bg, borderRadius:10, padding:10 }}>
                    {r.unidades.slice().sort((a,b)=>a.neto-b.neto).map((u,pos) => (
                      <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:pos<r.unidades.length-1?`1px solid ${D.border}`:"none" }}>
                        <div style={{ width:18, fontSize:11, fontWeight:900, color:pos===0?D.gold:D.textSub }}>{pos+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{u.nombre}</div>
                          <div style={{ fontSize:10, color:D.textSub }}>{u.jugadores.map(j=>j.name).join(", ")}</div>
                        </div>
                        <div style={{ fontSize:13, fontWeight:900, color:D.gold }}>{u.neto}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );

  return null;
}
