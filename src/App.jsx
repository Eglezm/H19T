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
  huerta:    { nombre: "Club de Golf La Huerta",         pares: [4,3,3,3,3,4,3,3,3,4,3,3,3,3,4,3,3,3] },
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
  const jugados = pares.reduce((acc, _, i) => acc + (scores[i] !== null && scores[i] !== undefined ? 1 : 0), 0);
  const brutoReal = pares.reduce((acc, _, i) => acc + (scores[i] || 0), 0);
  const hcAplicado = unidad.hcAplicado || 0;
  const neto = brutoReal - hcAplicado;
  return { jugados, brutoReal, hcAplicado, neto };
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

function Card({ children, style = {} }) {
  return (
    <div style={{ background:D.card, border:`1px solid ${D.border}`, borderRadius:16, padding:16, marginBottom:12, ...style }}>
      {children}
    </div>
  );
}

function SLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, color:D.gold, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>{children}</div>;
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
function TablaPosiciones({ torneo, highlightId }) {
  const rows = leaderboard(torneo);
  return (
    <Card>
      <SLabel>🏆 Posiciones</SLabel>
      {rows.map((u, pos) => (
        <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:pos<rows.length-1?`1px solid ${D.border}`:"none", background:u.id===highlightId?D.goldDim+"55":"transparent" }}>
          <div style={{ width:24, height:24, borderRadius:"50%", background:pos===0?D.goldDim:D.surface, border:`1px solid ${pos===0?D.gold:D.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:pos===0?D.gold:D.textSub, flexShrink:0 }}>{pos+1}</div>
          <Avatar name={u.nombre} id={u.id} size={30} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.nombre}</div>
            <div style={{ fontSize:10, color:D.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {u.jugadores && u.jugadores.length>1 ? u.jugadores.map(j=>j.name).join(", ") : ""} {u.jugadores && u.jugadores.length>1 ? "· " : ""}{u.jugados}/{torneo.pares.length} hoyos
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, color:D.textSub, whiteSpace:"nowrap" }}>{u.brutoReal} − {u.hcAplicado}</div>
            <div style={{ fontSize:17, fontWeight:900, color:pos===0?D.gold:D.text }}>{u.neto}</div>
            <div style={{ fontSize:9, color:D.textSub }}>total</div>
          </div>
        </div>
      ))}
      {rows.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
    </Card>
  );
}

function TarjetaHoyoPorHoyo({ torneo }) {
  const rows = leaderboard(torneo);
  const pares = torneo.pares;
  return (
    <Card>
      <SLabel>🏌️ Tarjeta hoyo por hoyo</SLabel>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, minWidth:pares.length*32+90 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", padding:"4px 6px", color:D.textSub, position:"sticky", left:0, background:D.surface }}>Unidad</th>
              {pares.map((par, h) => <th key={h} style={{ padding:"4px 4px", color:D.textDim, fontWeight:600, minWidth:28 }}>{h+1}</th>)}
              <th style={{ padding:"4px 6px", color:D.gold, fontWeight:700 }}>Total</th>
            </tr>
            <tr>
              <td style={{ padding:"2px 6px", color:D.textDim, fontSize:10, position:"sticky", left:0, background:D.surface }}>Par</td>
              {pares.map((par, h) => <td key={h} style={{ textAlign:"center", padding:"2px 4px", color:D.textDim, fontSize:10 }}>{par}</td>)}
              <td style={{ textAlign:"center", padding:"2px 6px", color:D.textDim, fontSize:10, fontWeight:700 }}>{pares.reduce((a,b)=>a+b,0)}</td>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} style={{ borderTop:`1px solid ${D.border}` }}>
                <td style={{ padding:"5px 6px", fontWeight:600, position:"sticky", left:0, background:D.surface, whiteSpace:"nowrap" }}>
                  <div>{u.nombre}</div>
                  <div style={{ fontSize:9, color:D.textDim, fontWeight:400 }}>{u.brutoReal} − {u.hcAplicado}</div>
                </td>
                {pares.map((par, h) => {
                  const s = (u.scores||[])[h];
                  const b = getBadge(s, par);
                  return (
                    <td key={h} style={{ textAlign:"center", padding:"5px 2px" }}>
                      <span style={{ display:"inline-block", minWidth:18, padding:"1px 3px", borderRadius:5, fontWeight:700, background:b?b.bg:"transparent", color:b?b.fg:D.text }}>{s ?? "—"}</span>
                    </td>
                  );
                })}
                <td style={{ textAlign:"center", padding:"5px 6px", fontWeight:900, color:D.gold }}>{u.neto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── VISTA ESPECTADOR (público, solo lectura) ─────
function SpectatorTorneoView({ torneoId }) {
  const [torneo, setTorneo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, `torneos/${torneoId}`);
    const unsub = onValue(r, snap => { setTorneo(snap.exists() ? snap.val() : null); setLoading(false); });
    return () => unsub();
  }, [torneoId]);

  if (loading) return <Spinner label="Conectando..." />;
  if (!torneo) return <Spinner label="Torneo no encontrado" />;

  const campoNombre = CAMPOS[torneo.campo]?.nombre || torneo.campo;
  const modLabel = MODALIDADES[torneo.modalidad]?.label || torneo.modalidad;

  return (
    <div style={appStyle}>
      <div style={{ background:D.surface, borderBottom:`1px solid ${D.border}`, padding:"20px 16px 14px", textAlign:"center" }}>
        <div style={{ fontSize:30, fontWeight:900, color:D.gold }}>H19T</div>
        <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{torneo.nombre}</div>
        <div style={{ fontSize:11, color:D.textSub, letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>{campoNombre} · {modLabel} · HC {torneo.hcPercent}%</div>
        <div style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", background:torneo.status==="finalizada"?D.greenBg:D.goldDim, border:`1px solid ${torneo.status==="finalizada"?D.success:D.gold}`, borderRadius:20 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:torneo.status==="finalizada"?D.success:D.gold }} />
          <span style={{ fontSize:11, fontWeight:700, color:torneo.status==="finalizada"?D.success:D.gold }}>{torneo.status==="finalizada" ? "Torneo finalizado" : "En vivo"}</span>
        </div>
      </div>
      <div style={{ padding:"12px 12px 32px" }}>
        <TablaPosiciones torneo={torneo} />
        <TarjetaHoyoPorHoyo torneo={torneo} />
        <div style={{ textAlign:"center", fontSize:11, color:D.textDim, marginTop:8 }}>Vista de solo lectura · Actualización automática</div>
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
  const [hole, setHole] = useState(0);
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
  const par = pares[hole];
  const campoNombre = CAMPOS[torneo.campo]?.nombre || torneo.campo;

  const setScore = (delta) => {
    if (!marcoA) return;
    const current = marcoA.scores?.[hole] ?? par;
    const val = Math.max(1, current + delta);
    set(ref(db, `torneos/${torneoId}/unidades/${miUnidad.marcaA}/scores/${hole}`), val);
  };

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
          <TabBar tabs={[{key:"marcar",label:"✏️ Anotar"},{key:"mio",label:"👀 Mi score"},{key:"pos",label:"🏆 Posiciones"},{key:"tabla",label:"📋 Tarjeta"}]} active={tab} onChange={setTab} />

          {tab === "marcar" && marcoA && (
            <Card>
              <SLabel>Anotas para: {nombreConJugadores(marcoA)}</SLabel>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:10 }}>
                <button onClick={() => setHole(h => Math.max(0,h-1))} disabled={hole===0} style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${D.border}`,background:"transparent",color:D.text,cursor:"pointer",fontSize:18,opacity:hole===0?0.3:1 }}>‹</button>
                <div style={{ textAlign:"center", minWidth:100 }}>
                  <div style={{ fontSize:20, fontWeight:900 }}>Hoyo {hole+1}</div>
                  <div style={{ fontSize:12, color:D.gold, fontWeight:700 }}>PAR {par}</div>
                </div>
                <button onClick={() => setHole(h => Math.min(pares.length-1,h+1))} disabled={hole===pares.length-1} style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:18,opacity:hole===pares.length-1?0.3:1 }}>›</button>
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
                <div style={{ fontSize:44, fontWeight:900, color:D.gold, margin:"8px 0" }}>{miScore ?? "—"}</div>
                <div style={{ fontSize:11, color:D.textDim }}>Solo lectura — lo anota {meMarca?.nombre || "tu equipo compañero"}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:8 }}>
                <button onClick={() => setHole(h => Math.max(0,h-1))} disabled={hole===0} style={{ padding:"6px 14px", border:`1px solid ${D.border}`, borderRadius:20, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer", opacity:hole===0?0.3:1 }}>‹ Anterior</button>
                <button onClick={() => setHole(h => Math.min(pares.length-1,h+1))} disabled={hole===pares.length-1} style={{ padding:"6px 14px", border:`1px solid ${D.border}`, borderRadius:20, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer", opacity:hole===pares.length-1?0.3:1 }}>Siguiente ›</button>
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

  // Constructor de grupos de salida
  const [hoyoSel, setHoyoSel] = useState(1);
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

  const abrirTorneoExistente = (t) => { setTorneoId(t.id); setScreen("unidades"); };

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
      const codigo = genCodigo(usados); usados.add(codigo);
      updates[`torneos/${torneoId}/unidades/${uid}/hoyoSalida`] = hoyoSel - 1;
      updates[`torneos/${torneoId}/unidades/${uid}/grupoId`] = grupoId;
      updates[`torneos/${torneoId}/unidades/${uid}/marcaA`] = chain[uid].marcaA;
      updates[`torneos/${torneoId}/unidades/${uid}/marcadoPor`] = chain[uid].marcadoPor;
      updates[`torneos/${torneoId}/unidades/${uid}/codigo`] = codigo;
      updates[`codigos/${codigo}`] = { torneoId, unidadId: uid };
    });
    Promise.all(Object.entries(updates).map(([path,val]) => set(ref(db, path), val)));
    setSelUnidades([]);
  };

  const iniciarTorneo = () => { set(ref(db, `torneos/${torneoId}/status`), "en_juego"); };

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

  const compartirCodigosWhatsapp = () => {
    if (!torneo) return;
    const unidades = Object.values(torneo.unidades||{}).filter(u=>u.codigo);
    const lines = [
      `⛳ *H19T — ${torneo.nombre}*`,
      `_Códigos de acceso por equipo_`, ``,
      ...unidades.map(u => `*${u.nombre}* (Hoyo ${u.hoyoSalida+1}) → Código: *${u.codigo}*`),
      ``, `Entra en: ${window.location.origin}${window.location.pathname}?equipo=TU_CODIGO`,
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
    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"live",label:"🏆 En vivo"}]} active="unidades" onChange={setScreen} />
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
            {unidadesList.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
            {unidadesList.map((u, idx) => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:idx<unidadesList.length-1?`1px solid ${D.border}`:"none" }}>
                <Avatar name={u.nombre} id={u.id} size={28} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{u.nombre}</div>
                  <div style={{ fontSize:10, color:D.textSub }}>{u.jugadores.map(j=>j.name).join(", ")} · HC aplicado {u.hcAplicado}</div>
                </div>
                {u.grupoId ? <div style={{ fontSize:10, color:D.success, fontWeight:700 }}>Hoyo {u.hoyoSalida+1} ✓</div> : <button onClick={() => eliminarUnidad(u.id)} style={{ padding:"4px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}>✕</button>}
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

    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"live",label:"🏆 En vivo"}]} active="grupos" onChange={setScreen} />

          {sinGrupo.length>0 && (
            <Card>
              <SLabel>Armar grupo de salida</SLabel>
              <div style={{ fontSize:12, color:D.textSub, marginBottom:10 }}>Selecciona de 2 a 4 unidades (el orden en que las toques define la cadena de marcaje: la 1ª anota a la 2ª, la 2ª a la 3ª... y la última anota a la 1ª).</div>
              <div style={{ marginBottom:10 }}>
                <span style={{ fontSize:12, color:D.textSub, marginRight:8 }}>Hoyo de salida</span>
                <select value={hoyoSel} onChange={e=>setHoyoSel(parseInt(e.target.value))} style={{ padding:"6px 10px", border:`1px solid ${D.border}`, borderRadius:8, background:D.surface, color:D.text, fontSize:13 }}>
                  {torneo.pares.map((_,i) => <option key={i} value={i+1}>Hoyo {i+1}</option>)}
                </select>
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
                <div style={{ fontSize:11, color:D.gold, fontWeight:700, marginBottom:6 }}>Hoyo {us[0].hoyoSalida+1}</div>
                <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6 }}>
                  {us.map((u,i) => (
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ padding:"4px 10px", background:D.goldDim, border:`1px solid ${D.gold}33`, borderRadius:14, fontSize:12, fontWeight:600 }}>{u.nombre}</div>
                      {i<us.length-1 && <span style={{ color:D.textDim }}>→</span>}
                    </div>
                  ))}
                  <span style={{ color:D.textDim }}>→ ({us[0].nombre})</span>
                </div>
                <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:6 }}>
                  {us.map(u => <div key={u.id} style={{ fontSize:10, color:D.textSub }}>{u.nombre}: código <b style={{ color:D.gold }}>{u.codigo}</b></div>)}
                </div>
              </div>
            ))}
          </Card>

          {Object.keys(gruposMap).length>0 && (
            <button onClick={compartirCodigosWhatsapp} style={{ width:"100%", padding:"12px", border:"none", borderRadius:12, background:"#25D366", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:10 }}>
              💬 Compartir todos los códigos por WhatsApp
            </button>
          )}

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

  // ── EN VIVO / RESULTADOS ──
  if ((screen==="live" || screen==="resultados") && torneo) {
    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={[{key:"unidades",label:"👤 Unidades"},{key:"grupos",label:"🔗 Grupos y códigos"},{key:"live",label:"🏆 En vivo"}]} active="live" onChange={setScreen} />
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
