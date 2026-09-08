import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove, get } from "firebase/database";
import {
  Target, Trophy, Check, Flag, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, User, Users,
  Printer, Link2, X, Trash2, Star, ArrowLeftRight, RefreshCw, Eye, MessageCircle,
  Monitor, Ban, Clock, Ruler, Layers, Sparkles, ClipboardList, AlertTriangle,
  Undo2, KeyRound, Tv, Share2, LogOut, Plus, Minus, MapPin, ListChecks, Medal, ListOrdered,
} from "lucide-react";

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
  bg: "#F7F6F2", surface: "#FFFFFF", card: "rgba(255,255,255,0.75)",
  border: "rgba(0,86,63,0.13)", borderGlass: "rgba(255,255,255,0.65)",
  // "gold*" es históricamente el nombre del acento principal en todo el código (botones,
  // pestañas activas, bordes seleccionados). En este diseño editorial el acento de marca
  // es el verde bosque — el dorado real queda aparte, en D.achievement, de uso mínimo.
  gold: "#00563F", goldLight: "#0E7A57", goldDim: "rgba(0,86,63,0.08)",
  achievement: "#C9A227", achievementLight: "#DCC15A", achievementDim: "rgba(201,162,39,0.12)",
  text: "#1A231D", textSub: "#6C7468", textDim: "#A6AC9C",
  success: "#0E6E4E", danger: "#A24732",
  greenBg: "rgba(14,110,78,0.10)", redBg: "rgba(162,71,50,0.10)",
};
D.bogey = "#B4863A";
D.doble = D.danger;
D.triple = "#7A2E1E";

// Serif editorial (Georgia) para nombres, títulos de torneo y números de score protagonistas.
// Sans-serif para datos secundarios, navegación y UI general.
const FONT_DISPLAY = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const SHADOW_CARD = "0 8px 32px rgba(0,40,25,0.09), inset 0 1px 0 rgba(255,255,255,0.55)";
const SHADOW_CARD_HEADER = "0 12px 40px rgba(0,40,25,0.12), inset 0 1px 0 rgba(255,255,255,0.6)";
const SHADOW_BTN = "0 6px 18px rgba(0,86,63,0.24)";
const GLASS_BLUR = "blur(12px) saturate(140%)";
const GLASS_BLUR_HEADER = "blur(16px) saturate(150%)";
const GRAD_PRIMARY = "linear-gradient(135deg, #0E7A57 0%, #00563F 100%)";
const GRAD_ACCENT  = "linear-gradient(135deg, #C9A227 0%, #DCC15A 100%)";
const GRAD_TEXT_STYLE = { background:GRAD_PRIMARY, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" };
// Borde de vidrio: solo arriba/izquierda, simulando un reflejo de luz (no uniforme en los 4 lados)
const GLASS_EDGE = { borderTop:`1px solid ${D.borderGlass}`, borderLeft:`1px solid ${D.borderGlass}`, borderRight:"none", borderBottom:"none" };

// SECCIÓN 3: avatares — solo tonos de verde bosque (sin arcoíris pastel).
// Fondo #E8F0EC con iniciales #00563F para todos; 3 variantes de verde para diferenciar equipos.
const COLORS = [
  {bg:"#E8F0EC",fg:"#00563F"},
  {bg:"#DCEBE3",fg:"#0E6E4E"},
  {bg:"#E2EDE6",fg:"#0A5940"},
];

const col = (id) => {
  let n = typeof id === "number" ? id : String(id).split("").reduce((a,c) => a + c.charCodeAt(0), 0);
  return COLORS[Math.abs(n) % COLORS.length];
};

function getBadge(s, par) {
  if (s === null || s === undefined || !par) return null;
  const d = s - par;
  if (d <= -2) return { label:"Eagle",  bg:"rgba(46,155,255,0.16)", fg:"#6FB8FF" };
  if (d === -1) return { label:"Birdie", bg:"rgba(61,220,132,0.16)", fg:D.success };
  if (d === 0)  return { label:"Par",    bg:"rgba(255,255,255,0.06)", fg:D.textSub };
  if (d === 1)  return { label:"Bogey",  bg:"rgba(255,176,32,0.16)", fg:D.bogey };
  if (d === 2)  return { label:"Doble",  bg:"rgba(255,84,112,0.16)", fg:D.doble };
  return { label:"+"+d, bg:"rgba(255,45,85,0.18)", fg:D.triple };
}

// Notación tradicional de golf para la tarjeta: par = número solo, birdie = círculo,
// eagle o mejor = doble círculo, bogey = cuadro, doble bogey = doble cuadro (rojo),
// triple bogey o peor = doble cuadro (rojo oscuro). Además: al cambiar el valor (anotación
// en vivo) hace un flash dorado que se desvanece a verde, y aparece con un leve "pop" escalonado.
function ScoreCell({ s, par, big, index = 0 }) {
  const fs = big ? 30 : 11;
  const prevRef = useRef(s);
  const mountedRef = useRef(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (mountedRef.current && prevRef.current !== s && s !== null && s !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2400);
      prevRef.current = s;
      return () => clearTimeout(t);
    }
    mountedRef.current = true;
    prevRef.current = s;
  }, [s]);

  let inner;
  if (s === null || s === undefined) inner = <span style={{ fontSize:fs, color:D.textDim }}>—</span>;
  else if (!par) inner = <span style={{ fontSize:fs, fontWeight:700 }}>{s}</span>;
  else {
    const d = s - par;
    const outer = big ? 48 : 21;
    const innerSize = outer - 6;
    const numSt = { fontSize:fs, fontWeight:700, lineHeight:1 };
    const wrapSt = (size, radius, color) => ({ display:"inline-flex", alignItems:"center", justifyContent:"center", width:size, height:size, borderRadius:radius, border:`1.4px solid ${color}` });
    if (d === 0) inner = <span style={{ ...numSt, color:D.text }}>{s}</span>;
    else if (d === -1) inner = <span style={{ ...wrapSt(outer, "50%", D.success), ...numSt, color:D.success }}>{s}</span>;
    else if (d <= -2) inner = (
      <span style={wrapSt(outer+5, "50%", D.gold)}>
        <span style={{ ...wrapSt(innerSize, "50%", D.gold), ...numSt, color:D.gold }}>{s}</span>
      </span>
    );
    else if (d === 1) inner = <span style={{ ...wrapSt(outer, 3, D.bogey), ...numSt, color:D.bogey }}>{s}</span>;
    else if (d === 2) inner = (
      <span style={wrapSt(outer+5, 4, D.doble)}>
        <span style={{ ...wrapSt(innerSize, 2, D.doble), ...numSt, color:D.doble }}>{s}</span>
      </span>
    );
    else inner = (
      <span style={wrapSt(outer+5, 4, D.triple)}>
        <span style={{ ...wrapSt(innerSize, 2, D.triple), ...numSt, color:D.triple }}>{s}</span>
      </span>
    );
  }

  return (
    <span className={`h19-pop ${flash?"h19-flash":""}`} style={{ display:"inline-flex", borderRadius:8, padding:2, animationDelay:`${Math.min(index*25,260)}ms` }}>
      {inner}
    </span>
  );
}

function teeColor(campo, holeIndex) {
  const c = CAMPOS[campo];
  if (!c || !c.nueveHoyos) return null;
  return holeIndex < 9 ? "Blancas" : "Azules";
}
function teeStyle(tee) {
  if (tee === "Blancas") return { bg:"rgba(255,255,255,0.07)", fg:D.textSub, border:"rgba(255,255,255,0.14)" };
  if (tee === "Azules") return { bg:"rgba(46,155,255,0.14)", fg:"#6FB8FF", border:"rgba(46,155,255,0.3)" };
  return null;
}
function genCodigo(usados) {
  let c;
  do { c = Math.random().toString(36).substring(2,7).toUpperCase(); } while (usados.has(c));
  return c;
}

function genPassword() {
  return Math.random().toString(36).substring(2,6).toUpperCase();
}

// Lista de "hoyos físicos" disponibles para O'Yes. En campos de 9 hoyos jugados dos
// veces, el hoyo 1 y el hoyo 10 son el mismo hoyo físico, así que se combinan en una
// sola opción para el premio (aunque se anoten por separado como Hoyo 1 y Hoyo 10).
function hoyosFisicos(torneo) {
  const esNueve = CAMPOS[torneo.campo]?.nueveHoyos && torneo.pares.length === 18;
  const n = esNueve ? 9 : torneo.pares.length;
  return Array.from({length:n}, (_,i) => i+1);
}

// El hoyo "físico" (para el premio combinado) a partir del hoyo tal como se juega en campo (1-18)
function hoyoFisicoDesdeJugado(torneo, hoyoJugado) {
  const esNueve = CAMPOS[torneo.campo]?.nueveHoyos && torneo.pares.length === 18;
  if (!esNueve) return hoyoJugado;
  return ((hoyoJugado - 1) % 9) + 1;
}

// Opciones de hoyo que ve quien anota O'Yes: en campos de 9 hoyos jugados dos veces,
// cada hoyo físico con premio genera 2 opciones (ej. Hoyo 1 y Hoyo 10), tal como
// aparecen en el campo — sin necesidad de indicar de qué tee salieron.
function opcionesHoyoOyes(torneo) {
  const esNueve = CAMPOS[torneo.campo]?.nueveHoyos && torneo.pares.length === 18;
  const holes = (torneo.oyes?.holes || []).slice().sort((a,b)=>a-b);
  if (!esNueve) return holes.map(h => ({ jugado:h, label:`Hoyo ${h}` }));
  const opts = [];
  holes.forEach(h => { opts.push({ jugado:h, label:`Hoyo ${h}` }); opts.push({ jugado:h+9, label:`Hoyo ${h+9}` }); });
  return opts.sort((a,b) => a.jugado - b.jugado);
}

// Todos los jugadores participantes en el torneo (de todas las unidades), con referencia a su unidad
function todosLosJugadores(torneo) {
  const list = [];
  Object.values(torneo.unidades||{}).forEach(u => {
    (u.jugadores||[]).forEach(j => list.push({ id:j.id, name:j.name, unidadId:u.id, unidadNombre:u.nombre }));
  });
  return list;
}

// Construye la clasificación de O'Yes: agrupa por jugador tomando su MEJOR (menor) distancia,
// ya sea global ("general") o separada por hoyo físico ("hoyo")
function clasificacionOyes(torneo) {
  const entradas = Object.values(torneo.oyesEntradas || {});
  const modo = torneo.oyes?.modo || "general";
  const mejorPorJugador = (lista) => {
    const map = {};
    lista.forEach(e => {
      const cur = map[e.jugadorId];
      if (!cur || e.cm < cur.cm) map[e.jugadorId] = e;
    });
    return Object.values(map).sort((a,b) => a.cm - b.cm || (a.ts||0) - (b.ts||0));
  };
  if (modo === "hoyo") {
    const holes = (torneo.oyes?.holes || []).slice().sort((a,b)=>a-b);
    return holes.map(h => { const propias = entradas.filter(e => e.holeFisico === h); return { hole:h, ranking: mejorPorJugador(propias), intentos: propias.length }; });
  }
  return [{ hole:null, ranking: mejorPorJugador(entradas), intentos: entradas.length }];
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

// Formatea distancias de O'Yes: SIEMPRE exactamente 2 decimales (28 → 28.00, 11.5 → 11.50)
function fmtCm(cm) {
  return (Math.round(cm * 100) / 100).toFixed(2);
}

// Formatea la hora de captura del O'Yes a partir del timestamp real guardado (nunca inventada)
function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString("es-MX", { hour:"numeric", minute:"2-digit", hour12:true });
}

// ─── DESEMPATE (Tie-Break) — lógica única y centralizada ──
// Secuencia oficial de Score: Score Final → Hoyo 10→18 → Acumulado 1-9 → Hoyo 1→9 → Empate oficial.
// No usa alfabético, ID, orden de registro ni ningún criterio aleatorio.
function compararDesempateScore(a, b, pares) {
  const n = pares.length;
  if (n >= 18) {
    // Fase 1: hoyo por hoyo, 10 → 18 (índices 9..17)
    for (let h = 9; h <= 17; h++) {
      const sa = a.scores?.[h], sb = b.scores?.[h];
      if (sa != null && sb != null && sa !== sb) return sa - sb;
    }
    // Fase 2: score acumulado de los hoyos 1-9 (índices 0..8)
    let sumA = 0, sumB = 0;
    for (let h = 0; h <= 8; h++) {
      sumA += a.scores?.[h] ?? 0;
      sumB += b.scores?.[h] ?? 0;
    }
    if (sumA !== sumB) return sumA - sumB;
    // Fase 3: hoyo por hoyo, 1 → 9
    for (let h = 0; h <= 8; h++) {
      const sa = a.scores?.[h], sb = b.scores?.[h];
      if (sa != null && sb != null && sa !== sb) return sa - sb;
    }
  } else {
    // Torneos de menos de 18 hoyos: countback directo hoyo por hoyo, 1 → N
    for (let h = 0; h < n; h++) {
      const sa = a.scores?.[h], sb = b.scores?.[h];
      if (sa != null && sb != null && sa !== sb) return sa - sb;
    }
  }
  return 0; // Empate oficial — se mantiene el empate, sin criterios adicionales
}

function leaderboard(torneo) {
  if (!torneo || !torneo.unidades || !torneo.pares) return [];
  return Object.values(torneo.unidades)
    .map(u => ({ ...u, ...calcTotales(u, torneo.pares) }))
    .sort((a,b) => a.vsParHc - b.vsParHc || compararDesempateScore(a, b, torneo.pares));
}

// Hoyo actual de una unidad: el siguiente después del último hoyo con score registrado,
// respetando su orden de salida (rotación). Si ya tiene score en todos los hoyos, null (Finalizado).
function hoyoActualDe(u, totalHoyos) {
  if (!u || !totalHoyos) return null;
  const start = u.hoyoSalida ?? 0;
  for (let i=0; i<totalHoyos; i++) {
    const h = (start+i) % totalHoyos;
    if (u.scores?.[h] === null || u.scores?.[h] === undefined) return h+1;
  }
  return null;
}

// ─── UI PRIMITIVAS (mismo lenguaje visual que H19 Golf) ──
// Número animado: hace count-up desde el valor anterior hasta el nuevo cada vez que cambia
function CountUp({ value, duration = 650, decimals = 0, style = {} }) {
  const [display, setDisplay] = useState(value || 0);
  const prevRef = useRef(value || 0);
  useEffect(() => {
    const from = prevRef.current;
    const to = value || 0;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { prevRef.current = to; setDisplay(to); }
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, duration]);
  const shown = decimals > 0 ? display.toFixed(decimals) : Math.round(display);
  return <span style={style}>{shown}</span>;
}

function Avatar({ name, id, size = 32 }) {
  const c = col(id);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:c.bg, color:c.fg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.34, fontWeight:700, flexShrink:0, boxShadow:`inset 0 0 0 1.5px ${c.fg}44` }}>
      {name.substring(0,2).toUpperCase()}
    </div>
  );
}

function Card({ children, style = {}, className, tv }) {
  const blur = tv ? "blur(8px) saturate(140%)" : GLASS_BLUR;
  const bg = tv ? "rgba(255,255,255,0.85)" : D.card;
  return (
    <div className={`h19-card card-glass ${className||""}`} style={{ background:bg, backdropFilter:blur, WebkitBackdropFilter:blur, ...GLASS_EDGE, borderRadius:16, padding:16, marginBottom:12, boxShadow:SHADOW_CARD, ...style }}>
      {children}
    </div>
  );
}

// Etiqueta de sección: mayúsculas pequeñas con letter-spacing amplio y gris, estilo editorial
function SLabel({ children, style = {} }) {
  const { fontSize, ...wrapStyle } = style;
  const fs = fontSize || 11;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.09em", ...wrapStyle }}>
      <span style={{ width:14, height:1.5, background:D.gold, flexShrink:0 }} />
      <span style={{ fontSize:fs, fontWeight:600, color:D.textSub, display:"flex", alignItems:"center", gap:6 }}>{children}</span>
    </div>
  );
}

function Btn({ children, onClick, disabled, outline, danger, style = {} }) {
  return (
    <button
      onClick={onClick} disabled={disabled} className="h19-btn"
      style={{ width:"100%", padding:14, border:outline ? `1.5px solid ${danger?D.danger:D.gold}` : "none", borderRadius:14, fontSize:15, fontWeight:700, cursor:disabled?"default":"pointer", marginTop:6, background:outline ? "transparent" : danger ? D.danger : GRAD_PRIMARY, color:outline ? (danger?D.danger:D.gold) : "#FBFAF6", opacity:disabled?0.4:1, boxShadow:(!outline && !disabled) ? SHADOW_BTN : "none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, ...style }}>
      {children}
    </button>
  );
}

function TabBar({ tabs, active, onChange }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [ind, setInd] = useState({ left:0, top:0, width:0, height:0, ready:false });

  useEffect(() => {
    const el = btnRefs.current[active];
    const container = containerRef.current;
    if (el && container) {
      const cRect = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setInd({ left:r.left-cRect.left, top:r.top-cRect.top, width:r.width, height:r.height, ready:true });
    }
  }, [active, tabs.length]);

  return (
    <div ref={containerRef} style={{ position:"relative", display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
      <div className="h19-tab-indicator" style={{ position:"absolute", left:ind.left, top:ind.top, width:ind.width, height:ind.height, borderRadius:20, background:GRAD_PRIMARY, opacity:ind.ready?1:0, zIndex:0, boxShadow:SHADOW_BTN }} />
      {tabs.map(t => (
        <button key={t.key} ref={el => btnRefs.current[t.key]=el} onClick={() => onChange(t.key)} className="h19-tab-btn" style={{ position:"relative", zIndex:1, flex:"1 1 auto", padding:"9px 6px", border:"none", borderRadius:20, background:"transparent", color:active===t.key?"#FBFAF6":D.textSub, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5, whiteSpace:"nowrap" }}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

function Pill({ active, danger, onClick, children }) {
  return (
    <div onClick={onClick} className="h19-btn" style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", border:`1.5px solid ${active?D.gold:danger?D.danger:D.border}`, borderRadius:20, background:active?D.goldDim:"transparent", color:active?D.gold:danger?D.danger:D.textSub, fontSize:13, fontWeight:600, cursor:"pointer", userSelect:"none" }}>
      {children}
    </div>
  );
}

// Barra de navegación fija al fondo de la pantalla, con el mismo indicador deslizante que TabBar
function BottomNav({ tabs, active, onChange }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [ind, setInd] = useState({ left:0, top:0, width:0, height:0, ready:false });

  useEffect(() => {
    const el = btnRefs.current[active];
    const container = containerRef.current;
    if (el && container) {
      const cRect = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setInd({ left:r.left-cRect.left, top:r.top-cRect.top, width:r.width, height:r.height, ready:true });
    }
  }, [active, tabs.length]);

  return (
    <div style={{ position:"fixed", left:0, right:0, bottom:0, zIndex:50, display:"flex", justifyContent:"center", padding:"10px 12px calc(10px + env(safe-area-inset-bottom))", pointerEvents:"none" }}>
      <div ref={containerRef} style={{ position:"relative", display:"flex", gap:4, width:"100%", maxWidth:420, background:"rgba(255,255,255,0.78)", backdropFilter:GLASS_BLUR_HEADER, WebkitBackdropFilter:GLASS_BLUR_HEADER, ...GLASS_EDGE, borderRadius:22, padding:5, boxShadow:SHADOW_CARD_HEADER, pointerEvents:"auto" }}>
        <div className="h19-tab-indicator" style={{ position:"absolute", left:ind.left, top:ind.top, width:ind.width, height:ind.height, borderRadius:18, background:GRAD_PRIMARY, opacity:ind.ready?1:0, zIndex:0, boxShadow:SHADOW_BTN }} />
        {tabs.map(t => (
          <button key={t.key} ref={el => btnRefs.current[t.key]=el} onClick={() => onChange(t.key)} className="h19-tab-btn" style={{ position:"relative", zIndex:1, flex:"1 1 auto", padding:"10px 4px", border:"none", borderRadius:18, background:"transparent", color:active===t.key?"#FBFAF6":D.textSub, fontSize:10.5, fontWeight:700, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3 }}>
          {t.icon}{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const appStyle = { fontSize:14, fontFamily:FONT_SANS, color:D.text, background:"transparent", minHeight:"100vh", maxWidth:420, margin:"0 auto" };

function Spinner({ label }) {
  return (
    <div style={{ ...appStyle, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <Flag size={32} color={D.gold} className="h19-spin" />
      <div style={{ color:D.gold, fontWeight:700 }}>{label}</div>
    </div>
  );
}

// ─── TARJETA DE POSICIONES (reutilizable) ─────────
function TablaPosiciones({ torneo, highlightId, big }) {
  const rows = leaderboard(torneo);
  const fs = big ? { name:22, sub:14, total:34, small:13, avatar:46, pos:34 } : { name:13, sub:10, total:17, small:9, avatar:30, pos:24 };
  // Leaderboard editorial: la jerarquía surge de tipografía, número y espacio — sin trofeos,
  // medallas ni esquema oro/plata/bronce. Solo el 1er lugar lleva un acento cromático de marca;
  // 2do y 3ro se mantienen neutros, distinguidos únicamente por tamaño y peso tipográfico.
  const RANK = [
    { color:"#C9A227", weight:700, num:big?46:32, label:big?13:11, name:big?24:19, nameW:800, sub:big?12:9.5, score:big?32:22, total:big?22:16, avatar:big?44:32, featured:true },
    { color:"#9AA0A6", weight:300, num:big?32:24, label:big?11:9.5, name:big?19:16, nameW:700, sub:big?11:9, score:big?22:17, total:big?17:13, avatar:big?36:28, featured:false },
    { color:"#B08D57", weight:300, num:big?28:21, label:big?10:9, name:big?17:14.5, nameW:700, sub:big?10.5:8.5, score:big?19:15, total:big?15:12, avatar:big?32:26, featured:false },
  ];
  const LABELS = ["Campeones","Subcampeones","Tercer puesto"];
  // Fondo metálico sutil por posición (oro / plata / bronce) — baja saturación, con un
  // ligero degradado para dar sensación de metal sin llamar la atención del resto de la tabla.
  const TIER_BG = [
    "linear-gradient(135deg, rgba(201,162,39,0.075), rgba(201,162,39,0.02))",
    "linear-gradient(135deg, rgba(154,160,166,0.10), rgba(154,160,166,0.03))",
    "linear-gradient(135deg, rgba(176,141,87,0.09), rgba(176,141,87,0.03))",
  ];
  const TIER_BORDER = ["#C9A227", "#9AA0A6", "#B08D57"];
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const prevRanks = useRef({});
  const orderKey = rows.map(u=>u.id).join(",");

  // Animación FLIP + franja de cambio de posición (SECCIÓN 6): cuando el orden cambia,
  // cada fila se desliza (FLIP) Y dispara la franja dorado/verde (sube) o gris (baja)
  // — ambas en el mismo paso de este efecto, no una después de la otra.
  useLayoutEffect(() => {
    const newPositions = {};
    const newRanks = {};
    rows.forEach((u, idx) => {
      const el = rowRefs.current[u.id];
      if (el) newPositions[u.id] = el.getBoundingClientRect().top;
      newRanks[u.id] = idx;
    });
    Object.keys(newPositions).forEach(id => {
      const el = rowRefs.current[id];
      const prevTop = prevPositions.current[id];
      const newTop = newPositions[id];
      const prevRank = prevRanks.current[id];
      const newRank = newRanks[id];
      const moved = el && prevTop !== undefined && Math.abs(prevTop-newTop) > 0.5;
      if (moved) {
        const delta = prevTop - newTop;
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;
        el.getBoundingClientRect();
        const subioDePosicion = prevRank !== undefined && newRank < prevRank;
        el.classList.remove("row-position-change", "row-down");
        void el.offsetWidth; // fuerza reflow para poder re-disparar la animación cada vez
        el.classList.add("row-position-change");
        if (!subioDePosicion) el.classList.add("row-down");
        requestAnimationFrame(() => {
          el.style.transition = "transform 420ms cubic-bezier(0.22,1,0.36,1)";
          el.style.transform = "translateY(0)";
        });
        setTimeout(() => { el.classList.remove("row-position-change", "row-down"); }, 950);
      }
    });
    prevPositions.current = newPositions;
    prevRanks.current = newRanks;
  }, [orderKey]);

  return (
    <Card tv={big} style={big ? { padding:24 } : {}}>
      <SLabel style={big ? { fontSize:16 } : {}}><ListOrdered size={14}/> Clasificación</SLabel>
      {rows.map((u, pos) => {
        const top3 = pos < 3;
        const r = top3 ? RANK[pos] : null;
        const isMe = u.id === highlightId;
        const hAct = hoyoActualDe(u, torneo.pares.length);
        const estadoHoyo = hAct === null ? "Finalizado" : `Jugando hoyo ${hAct}`;
        return (
          <div key={u.id} ref={el => rowRefs.current[u.id]=el}
            className="h19-champion-in" style={{
              animationDelay:`${Math.min(pos*40,400)}ms`,
              display:"flex", alignItems:"center", gap:big?16:11,
              padding: top3 ? (big?"15px 14px":"11px 10px") : (big?"14px 14px":"10px 10px"),
              borderBottom:pos<rows.length-1?`1px solid ${D.border}`:"none",
              background: top3 ? TIER_BG[pos] : (isMe ? D.goldDim+"40" : "transparent"),
              borderLeft: top3 ? `2px solid ${TIER_BORDER[pos]}` : "2px solid transparent",
              outline: (isMe && top3) ? `2px solid ${D.gold}` : "none", outlineOffset:-2,
              position:"relative",
            }}>
            <div style={{ minWidth:top3?(big?54:38):(big?26:20), textAlign:"center", flexShrink:0 }}>
              <span style={{ fontFamily:FONT_DISPLAY, fontWeight:top3?r.weight:400, fontSize:top3?r.num:(big?18:13), color:top3?r.color:D.textDim, lineHeight:1 }}>
                {top3 ? String(pos+1).padStart(2,"0") : pos+1}
              </span>
            </div>
            <Avatar name={u.nombre} id={u.id} size={top3?r.avatar:fs.avatar} />
            <div style={{ flex:1, minWidth:0 }}>
              {top3 && <div style={{ fontSize:r.label, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase", color:r.color, marginBottom:1 }}>{LABELS[pos]}</div>}
              <div style={{ fontFamily:FONT_DISPLAY, fontSize:top3?r.name:(big?20:fs.name), fontWeight:top3?r.nameW:700, color:D.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {u.nombre}
              </div>
              <div style={{ fontSize:top3?(big?15:12.5):(big?13:11), fontWeight:500, color:"#44503F", marginTop:2, lineHeight:1.5 }}>
                {u.jugadores && u.jugadores.length>1 && <span>{u.jugadores.map(j=>j.name).join(", ")}</span>}
                {u.hoyoSalida!=null && <><span style={{ color:D.textDim, margin:"0 5px" }}>•</span>Salió hoyo {u.hoyoSalida+1}</>}
                <span style={{ color:D.textDim, margin:"0 5px" }}>•</span>{torneo.pares.length - u.jugados} hoyos por jugar
                <span style={{ color:D.textDim, margin:"0 5px" }}>•</span>
                <span style={{ fontWeight:800, color: hAct===null ? D.success : D.gold }}>{estadoHoyo}</span>
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:top3?r.score:fs.sub+6, fontWeight:900, lineHeight:1, color:colorVsPar(u.vsParHc) }}>{fmtVsPar(u.vsParHc)}</div>
              <div style={{ fontSize:top3?(big?10:8):fs.sub, color:D.textDim, whiteSpace:"nowrap", marginTop:top3?3:0 }}>{u.brutoReal} − {u.hcAplicado}</div>
              <div style={{ fontFamily:FONT_DISPLAY, fontSize:top3?r.total:fs.total, fontWeight:700, color:D.text, marginTop:2 }}><CountUp value={u.neto} /></div>
              <div style={{ fontSize:top3?(big?9:7.5):fs.small, color:D.textSub, textTransform:top3?"uppercase":"none", letterSpacing:top3?"0.06em":0, fontWeight:top3?600:400 }}>Total</div>
            </div>
          </div>
        );
      })}
      {rows.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
    </Card>
  );
}

function TarjetaHoyoPorHoyo({ torneo, big }) {
  const rows = leaderboard(torneo);
  const pares = torneo.pares;
  const fs = big ? 20 : 11;
  return (
    <Card tv={big} style={big ? { padding:24 } : {}}>
      <SLabel style={big ? { fontSize:16 } : {}}><ClipboardList size={14}/> Tarjeta hoyo por hoyo <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, display:"inline-flex", alignItems:"center", gap:3 }}>· <Star size={11}/> = hoyo de salida</span></SLabel>
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
              <th style={{ padding:big?"8px 10px":"4px 6px", color:D.gold, fontWeight:700 }}>HP</th>
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
              <td></td>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} style={{ borderTop:`1px solid ${D.border}` }}>
                <td style={{ padding:big?"10px 10px":"5px 6px", fontWeight:600, position:"sticky", left:0, background:D.surface, whiteSpace:"nowrap" }}>
                  <div style={{ fontFamily:big?FONT_DISPLAY:"inherit", fontSize:big?22:"inherit" }}>{u.nombre}</div>
                  <div style={{ fontSize:big?13:9, color:D.textDim, fontWeight:400 }}>{(u.jugadores||[]).map(j=>j.name.split(" ")[0]).join(", ")}</div>
                </td>
                {pares.map((par, h) => {
                  const s = (u.scores||[])[h];
                  const esSalida = u.hoyoSalida === h;
                  return (
                    <td key={h} style={{ textAlign:"center", padding:big?"8px 4px":"5px 2px", position:"relative" }}>
                      {esSalida && <Star size={big?12:9} style={{ position:"absolute", top:1, right:2, color:D.gold }} fill={D.gold}/>}
                      <ScoreCell s={s} par={par} big={big} index={h} />
                    </td>
                  );
                })}
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontFamily:FONT_DISPLAY, fontSize:big?28:"inherit", fontWeight:700, color:D.gold }}><CountUp value={u.brutoReal} /></td>
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontSize:big?24:"inherit", fontWeight:900, color:colorVsPar(u.vsPar), borderLeft:`1px solid ${D.border}` }}>{fmtVsPar(u.vsPar)}</td>
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontWeight:700, color:D.textSub }}>{u.hcAplicado}</td>
                <td style={{ textAlign:"center", padding:big?"8px 10px":"5px 6px", fontSize:big?24:"inherit", fontWeight:900, color:colorVsPar(u.vsParHc) }}>{fmtVsPar(u.vsParHc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:big?16:10, justifyContent:"center", marginTop:12, fontSize:big?12:9, color:D.textSub }}>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}><ScoreCell s={2} par={4}/> Eagle+</span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}><ScoreCell s={3} par={4}/> Birdie</span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}><ScoreCell s={4} par={4}/> Par</span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}><ScoreCell s={5} par={4}/> Bogey</span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}><ScoreCell s={6} par={4}/> Doble bogey</span>
        <span style={{ display:"flex", alignItems:"center", gap:4 }}><ScoreCell s={7} par={4}/> Triple+</span>
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

// ─── CLASIFICACIÓN DE O'YES (reutilizable) ────────
function OyesLiveView({ torneo, big }) {
  if (!torneo.oyes || !torneo.oyes.holes || torneo.oyes.holes.length===0) {
    return (
      <Card tv={big} style={big ? { padding:24 } : {}}>
        <SLabel style={big ? { fontSize:16 } : {}}><Target size={14}/> O'Yes</SLabel>
        <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:big?15:13 }}>Este torneo aún no tiene hoyos de O'Yes configurados.</div>
      </Card>
    );
  }
  const premios = torneo.oyes.premios || 3;
  const grupos = clasificacionOyes(torneo);
  const RankList = ({ ranking, showHole }) => (
    <>
      {ranking.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:big?20:14, fontSize:big?15:13 }}>Aún no hay anotaciones</div>}
      {ranking.map((e, pos) => (
        <div key={e.jugadorId} style={{ display:"flex", alignItems:"center", gap:big?16:10, padding:big?"14px 0":"9px 0", borderBottom:pos<ranking.length-1?`1px solid ${D.border}`:"none", background:pos<premios?D.goldDim+"55":"transparent" }}>
          <div style={{ width:big?36:24, height:big?36:24, borderRadius:"50%", background:pos<premios?D.goldDim:D.surface, border:`1px solid ${pos<premios?D.gold:D.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:big?16:12, fontWeight:900, color:pos<premios?D.gold:D.textSub, flexShrink:0 }}>{pos+1}</div>
          <Avatar name={e.jugadorNombre} id={e.jugadorId} size={big?40:28} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:big?FONT_DISPLAY:"inherit", fontSize:big?22:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.jugadorNombre}</div>
            <div style={{ fontSize:big?15:12, fontWeight:500, color:"#44503F", marginTop:2 }}>
              {e.unidadNombre}
              <span style={{ color:D.textDim, margin:"0 5px" }}>•</span>Hoyo {e.holeFisico}
              {e.ts && <><span style={{ color:D.textDim, margin:"0 5px" }}>•</span>{fmtHora(e.ts)}</>}
            </div>
          </div>
          {pos<premios && <Trophy size={big?18:13} color={D.gold} style={{ marginRight:4, flexShrink:0 }}/>}
          <div style={{ fontSize:big?32:16, fontFamily:FONT_DISPLAY, fontWeight:700, color:pos<premios?D.gold:D.text, minWidth:big?150:96, textAlign:"right", fontVariantNumeric:"tabular-nums", flexShrink:0 }}><CountUp value={e.cm} decimals={2} /> <span style={{ fontSize:big?15:9, fontWeight:600, color:D.textSub, fontFamily:FONT_SANS }}>cm</span></div>
        </div>
      ))}
    </>
  );
  return (
    <>
      {grupos.map((g, gi) => (
        <Card key={gi} tv={big} style={big ? { padding:24 } : {}}>
          <SLabel style={big ? { fontSize:16 } : {}}><Target size={14}/> {g.hole ? `O'Yes — Hoyo ${g.hole}` : "O'Yes — Clasificación general"} <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>· top {premios} premiados · {g.ranking.length} jugador{g.ranking.length!==1?"es":""} ({g.intentos} anotación{g.intentos!==1?"es":""} en total)</span></SLabel>
          <RankList ranking={g.ranking} showHole={g.hole===null} />
        </Card>
      ))}
    </>
  );
}
function SpectatorTorneoView({ torneoId, vistaInicial = "todo" }) {
  const [torneo, setTorneo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tvMode, setTvMode] = useState(vistaInicial !== "todo");
  const [vista, setVista] = useState(vistaInicial); // "todo" | "tarjeta" | "posiciones" | "oyes" | "auto"
  const [autoSlide, setAutoSlide] = useState(0); // índice de vista actual en el ciclo automático

  useEffect(() => {
    const r = ref(db, `torneos/${torneoId}`);
    const unsub = onValue(r, snap => { setTorneo(snap.exists() ? snap.val() : null); setLoading(false); });
    return () => unsub();
  }, [torneoId]);

  const hayOyesFlag = torneo?.oyes?.holes?.length>0;
  const autoViews = hayOyesFlag ? ["posiciones","tarjeta","oyes"] : ["posiciones","tarjeta"];

  // Modo automático (proyección): cicla Posiciones → Tarjeta → O'Yes cada 12s, con fade+slide.
  // Corre siempre, sin pausarse por interacciones (durante un torneo hay demasiadas como para
  // que valga la pena pausar — se quedaría pausado casi todo el tiempo).
  useEffect(() => {
    if (vista !== "auto") return;
    const id = setInterval(() => setAutoSlide(s => (s+1) % autoViews.length), 12000);
    return () => clearInterval(id);
  }, [vista, autoViews.length]);

  if (loading) return <Spinner label="Conectando..." />;
  if (!torneo) return <Spinner label="Torneo no encontrado" />;

  const campoNombre = CAMPOS[torneo.campo]?.nombre || torneo.campo;
  const modLabel = MODALIDADES[torneo.modalidad]?.label || torneo.modalidad;
  const tvStyle = { fontSize:14, fontFamily:FONT_SANS, color:D.text, background:"transparent", minHeight:"100vh", width:"100%", margin:"0 auto" };
  const hayOyes = torneo.oyes?.holes?.length>0;
  const autoViewActual = autoViews[autoSlide % autoViews.length];
  const autoViewLabel = { posiciones:"Posiciones", tarjeta:"Tarjeta", oyes:"O'Yes" }[autoViewActual];
  const autoViewIcon = { posiciones:<Trophy size={13}/>, tarjeta:<ClipboardList size={13}/>, oyes:<Target size={13}/> }[autoViewActual];

  return (
    <div style={tvMode ? tvStyle : appStyle}>
      <div style={{ background:"rgba(255,255,255,0.7)", backdropFilter:GLASS_BLUR_HEADER, WebkitBackdropFilter:GLASS_BLUR_HEADER, borderBottom:`1px solid ${D.border}`, boxShadow:"0 1px 0 rgba(255,255,255,0.5) inset", padding:tvMode?"32px 24px 24px":"20px 16px 14px", textAlign:"center", position:"relative" }}>
        <div style={{ position:"absolute", top:tvMode?24:14, right:tvMode?24:14, display:"flex", gap:8 }} className="no-print">
          {tvMode && (
            <select value={vista} onChange={e=>setVista(e.target.value)} style={{ padding:"8px 14px", border:`1px solid ${D.gold}`, borderRadius:20, background:D.goldDim, color:D.gold, fontSize:13, fontWeight:700 }}>
              <option value="todo">Posiciones + Tarjeta</option>
              <option value="tarjeta">Solo Tarjeta</option>
              <option value="posiciones">Solo Posiciones</option>
              {hayOyes && <option value="oyes">Solo O'Yes</option>}
              <option value="auto">Automático (Posiciones → Tarjeta{hayOyes?" → O'Yes":""})</option>
            </select>
          )}
          <button onClick={() => setTvMode(v => { const next = !v; if (next && vista==="todo") setVista("auto"); return next; })} style={{ padding:tvMode?"10px 18px":"6px 12px", border:`1px solid ${D.gold}`, borderRadius:20, background:D.goldDim, color:D.gold, fontSize:tvMode?14:11, fontWeight:700, cursor:"pointer" }}>
            {tvMode ? <><X size={14}/> Salir de pantalla completa</> : <><Monitor size={14}/> Modo pantalla completa</>}
          </button>
        </div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:tvMode?58:32, fontWeight:700, color:D.gold, ...GRAD_TEXT_STYLE }}>H19T</div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:tvMode?38:13, fontWeight:700, marginTop:4 }}>{torneo.nombre}</div>
        <div style={{ fontSize:tvMode?16:11, color:D.textSub, letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>{campoNombre} · {modLabel} · HC {torneo.hcPercent}%</div>
        <div style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:6, padding:tvMode?"6px 18px":"4px 12px", background:torneo.status==="finalizada"?D.greenBg:D.achievementDim, border:`1px solid ${torneo.status==="finalizada"?D.success:D.achievement}`, borderRadius:20 }}>
          <div className={torneo.status==="finalizada"?"":"h19-live-dot"} style={{ width:tvMode?9:6, height:tvMode?9:6, borderRadius:"50%", background:torneo.status==="finalizada"?D.success:D.achievement }} />
          <span style={{ fontSize:tvMode?14:10, fontWeight:800, letterSpacing:"0.06em", textTransform:"uppercase", color:torneo.status==="finalizada"?D.success:D.achievement }}>{torneo.status==="finalizada" ? "Torneo finalizado" : "En vivo"}</span>
        </div>
        {vista === "auto" && (
          <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px", background:D.surface, border:`1px solid ${D.border}`, borderRadius:20 }}>
            <span style={{ fontSize:tvMode?13:10, fontWeight:700, color:D.textSub, display:"inline-flex", alignItems:"center", gap:5 }}>{autoViewIcon} Mostrando: {autoViewLabel} · cambia cada 12s</span>
          </div>
        )}
      </div>
      <div style={tvMode ? { padding:"24px", maxWidth:1400, margin:"0 auto", display:"grid", gap:20 } : { padding:"12px 12px 32px" }}>
        {vista === "auto" ? (
          <div key={autoSlide} className="h19-tab-panel">
            {autoViewActual === "posiciones" && <TablaPosiciones torneo={torneo} big={tvMode} />}
            {autoViewActual === "tarjeta" && <TarjetaHoyoPorHoyo torneo={torneo} big={tvMode} />}
            {autoViewActual === "oyes" && <OyesLiveView torneo={torneo} big={tvMode} />}
          </div>
        ) : vista === "oyes" ? (
          <OyesLiveView torneo={torneo} big={tvMode} />
        ) : (
          <>
            {vista !== "tarjeta" && <TablaPosiciones torneo={torneo} big={tvMode} />}
            {vista !== "posiciones" && <TarjetaHoyoPorHoyo torneo={torneo} big={tvMode} />}
          </>
        )}
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
      <Ban size={32} color={D.danger}/>
      <div style={{ color:D.danger, fontWeight:700 }}>{error}</div>
      <button onClick={onExit} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}><ChevronLeft size={14}/> Volver</button>
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
      <div style={{ background:"rgba(255,255,255,0.7)", backdropFilter:GLASS_BLUR_HEADER, WebkitBackdropFilter:GLASS_BLUR_HEADER, borderBottom:`1px solid ${D.border}`, boxShadow:"0 1px 0 rgba(255,255,255,0.5) inset", padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontFamily:FONT_DISPLAY, fontSize:23, fontWeight:700, color:D.gold, ...GRAD_TEXT_STYLE }}>H19T</div>
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
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"8px 0 16px", color:D.success, fontWeight:700 }}><Flag size={16}/> El torneo ha finalizado</div>
          <TablaPosiciones torneo={torneo} highlightId={unidadId} />
          <TarjetaHoyoPorHoyo torneo={torneo} />
        </div>
      ) : (
        <div style={{ padding:"0 12px 96px" }}>
          <BottomNav tabs={[{key:"marcar",icon:<Pencil size={16}/>,label:"Anotar"},{key:"mio",icon:<Eye size={16}/>,label:"Mi score"},{key:"pos",icon:<Trophy size={16}/>,label:"En vivo"}]} active={tab} onChange={cambiarTab} />

          <div key={tab} className="h19-tab-panel">
          {tab === "marcar" && marcoA && (
            <Card>
              <SLabel>Anotas para: {nombreConJugadores(marcoA)}</SLabel>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:10 }}>
                <button onClick={() => irAHoyo(Math.max(0,posInOrder-1))} disabled={posInOrder===0} style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${D.border}`,background:"transparent",color:D.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:posInOrder===0?0.3:1 }}><ChevronLeft size={18}/></button>
                <div style={{ textAlign:"center", minWidth:100 }}>
                  <div style={{ fontSize:20, fontWeight:900 }}>Hoyo {hole+1}</div>
                  <div style={{ fontSize:12, color:D.gold, fontWeight:700 }}>PAR {par}</div>
                  <div style={{ fontSize:10, color:D.textDim, marginTop:2 }}>{posInOrder+1}/{pares.length} de la ronda</div>
                  {teeSt && <div style={{ display:"inline-block", marginTop:4, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, background:teeSt.bg, color:teeSt.fg, border:`1px solid ${teeSt.border}` }}><Flag size={11} style={{display:"inline",verticalAlign:"-2px",marginRight:3}}/>Tee {tee}</div>}
                </div>
                <button onClick={() => irAHoyo(Math.min(pares.length-1,posInOrder+1))} disabled={posInOrder===pares.length-1} style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:posInOrder===pares.length-1?0.3:1 }}><ChevronRight size={18}/></button>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20 }}>
                <button onClick={() => setScore(-1)} style={{ width:52,height:52,borderRadius:"50%",border:`1px solid ${D.border}`,background:D.surface,color:D.text,cursor:"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                <div style={{ width:60, textAlign:"center", fontSize:38, fontFamily:FONT_DISPLAY, fontWeight:700 }}><CountUp value={suScore ?? par} duration={280} /></div>
                <button onClick={() => setScore(1)} style={{ width:52,height:52,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:28,display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
              </div>
              <div style={{ textAlign:"center", fontSize:11, color:D.textDim, marginTop:10 }}>{suScore===null||suScore===undefined ? "Aún no capturado (por defecto: par)" : "Capturado"}</div>
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
                {teeSt && <div style={{ display:"inline-block", marginTop:4, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, background:teeSt.bg, color:teeSt.fg, border:`1px solid ${teeSt.border}` }}><Flag size={11} style={{display:"inline",verticalAlign:"-2px",marginRight:3}}/>Tee {tee}</div>}
                <div style={{ fontSize:44, fontFamily:FONT_DISPLAY, fontWeight:700, color:D.gold, margin:"8px 0" }}>{miScore!=null ? <CountUp value={miScore} /> : "—"}</div>
                <div style={{ fontSize:11, color:D.textDim }}>Solo lectura — lo anota {meMarca?.nombre || "tu equipo compañero"}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:8 }}>
                <button onClick={() => setPosInOrder(p => Math.max(0,p-1))} disabled={posInOrder===0} style={{ padding:"6px 14px", border:`1px solid ${D.border}`, borderRadius:20, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer", opacity:posInOrder===0?0.3:1, display:"inline-flex", alignItems:"center", gap:2 }}><ChevronLeft size={13}/> Anterior</button>
                <button onClick={() => setPosInOrder(p => Math.min(pares.length-1,p+1))} disabled={posInOrder===pares.length-1} style={{ padding:"6px 14px", border:`1px solid ${D.border}`, borderRadius:20, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer", opacity:posInOrder===pares.length-1?0.3:1, display:"inline-flex", alignItems:"center", gap:2 }}>Siguiente <ChevronRight size={13}/></button>
              </div>
            </Card>
          )}

          {tab === "pos" && (
            <>
              <TablaPosiciones torneo={torneo} highlightId={unidadId} />
              <TarjetaHoyoPorHoyo torneo={torneo} />
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ANOTACIÓN DE O'YES (protegida por contraseña) ─
function OyesRecordView({ torneoId, onExit }) {
  const [torneo, setTorneo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [jugadorId, setJugadorId] = useState("");
  const [hole, setHole] = useState("");
  const [cm, setCm] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [okMsg, setOkMsg] = useState("");
  const [sortBy, setSortBy] = useState("reciente");

  useEffect(() => {
    const r = ref(db, `torneos/${torneoId}`);
    const unsub = onValue(r, snap => { setTorneo(snap.exists() ? snap.val() : null); setLoading(false); });
    return () => unsub();
  }, [torneoId]);

  if (loading) return <Spinner label="Conectando..." />;
  if (!torneo) return <Spinner label="Torneo no encontrado" />;
  if (!torneo.oyes || !torneo.oyes.password) {
    return (
      <div style={{ ...appStyle, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, padding:24, textAlign:"center" }}>
        <Target size={32} color={D.gold}/>
        <div style={{ color:D.textSub }}>Este torneo aún no tiene configurada la anotación de O'Yes.</div>
        <button onClick={onExit} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}><ChevronLeft size={14}/> Volver</button>
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:40, fontWeight:700, color:D.gold, display:"flex", alignItems:"center", gap:10, justifyContent:"center" }}><Target size={34}/> O'Yes</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:4, textAlign:"center" }}>{torneo.nombre}</div>
        <div style={{ fontSize:13, color:D.textSub, marginBottom:8 }}>Ingresa la contraseña de anotación</div>
        <input type="password" value={passInput} onChange={e=>setPassInput(e.target.value)} placeholder="Contraseña" maxLength={8}
          style={{ width:"100%", padding:14, border:`1px solid ${passError?D.danger:D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:20, textAlign:"center", letterSpacing:4, fontWeight:700 }} />
        {passError && <div style={{ color:D.danger, fontSize:13 }}>Contraseña incorrecta</div>}
        <Btn onClick={() => { if (passInput.trim().toUpperCase()===torneo.oyes.password) { setAutenticado(true); setPassError(false); } else setPassError(true); }}>Entrar</Btn>
        <button onClick={onExit} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}><ChevronLeft size={14}/> Volver</button>
      </div>
    );
  }

  const opcionesHoyo = opcionesHoyoOyes(torneo);
  const jugadores = todosLosJugadores(torneo).filter(j => j.name.toLowerCase().includes(busqueda.toLowerCase()));
  const entradas = Object.entries(torneo.oyesEntradas || {}).sort((a,b) => {
    if (sortBy==="distancia") return a[1].cm - b[1].cm;
    if (sortBy==="jugador") return a[1].jugadorNombre.localeCompare(b[1].jugadorNombre) || a[1].cm - b[1].cm;
    if (sortBy==="hoyo") return (a[1].holeJugado ?? a[1].holeFisico) - (b[1].holeJugado ?? b[1].holeFisico) || a[1].cm - b[1].cm;
    return (b[1].ts||0)-(a[1].ts||0);
  });

  const anotar = () => {
    if (!jugadorId || !hole || !cm || parseFloat(cm)<=0) return;
    const jug = todosLosJugadores(torneo).find(j=>j.id===parseInt(jugadorId) || j.id===jugadorId);
    if (!jug) return;
    const id = `E${Date.now()}`;
    set(ref(db, `torneos/${torneoId}/oyesEntradas/${id}`), {
      jugadorId: jug.id, jugadorNombre: jug.name, unidadNombre: jug.unidadNombre,
      holeFisico: hoyoFisicoDesdeJugado(torneo, parseInt(hole)), holeJugado: parseInt(hole),
      cm: Math.round(parseFloat(cm)*100)/100, ts: Date.now(),
    }).then(() => { setOkMsg(`${jug.name} — ${cm}cm en hoyo ${hole}`); setTimeout(()=>setOkMsg(""),2500); setCm(""); });
  };

  return (
    <div style={appStyle}>
      <div style={{ background:"rgba(255,255,255,0.7)", backdropFilter:GLASS_BLUR_HEADER, WebkitBackdropFilter:GLASS_BLUR_HEADER, borderBottom:`1px solid ${D.border}`, boxShadow:"0 1px 0 rgba(255,255,255,0.5) inset", padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontFamily:FONT_DISPLAY, fontSize:21, fontWeight:700, color:D.gold, display:"flex", alignItems:"center", gap:8 }}><Target size={19}/> Anotar O'Yes</div>
          <button onClick={onExit} style={{ fontSize:11, color:D.textSub, background:"none", border:`1px solid ${D.border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>Salir</button>
        </div>
        <div style={{ fontSize:12, color:D.textSub, marginTop:2 }}>{torneo.nombre}</div>
      </div>
      <div style={{ padding:"12px 12px 32px" }}>
        {okMsg && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"8px 12px", background:D.greenBg, border:`1px solid ${D.success}`, borderRadius:10, color:D.success, fontSize:12, textAlign:"center", fontWeight:600, marginBottom:10 }}><Check size={14}/>{okMsg}</div>}
        <Card>
          <SLabel>Nueva anotación</SLabel>
          <div style={{ fontSize:11, color:D.textSub, marginBottom:6 }}>Jugador</div>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar jugador..." style={{ width:"100%", padding:"9px 12px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:14, boxSizing:"border-box", marginBottom:8 }} />
          <div style={{ maxHeight:160, overflowY:"auto", border:`1px solid ${D.border}`, borderRadius:10, marginBottom:12 }}>
            {jugadores.map(j => (
              <div key={j.id} onClick={() => setJugadorId(String(j.id))} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:String(jugadorId)===String(j.id)?D.goldDim:"transparent", cursor:"pointer", borderBottom:`1px solid ${D.border}` }}>
                <Avatar name={j.name} id={j.id} size={24} />
                <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{j.name}</div>
                <div style={{ fontSize:10, color:D.textSub }}>{j.unidadNombre}</div>
              </div>
            ))}
            {jugadores.length===0 && <div style={{ padding:12, textAlign:"center", color:D.textSub, fontSize:12 }}>Sin resultados</div>}
          </div>
          <div style={{ fontSize:11, color:D.textSub, marginBottom:6 }}>Hoyo</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            {opcionesHoyo.map(opt => (
              <button key={opt.jugado} onClick={() => setHole(String(opt.jugado))} style={{ padding:"8px 14px", border:`1px solid ${String(hole)===String(opt.jugado)?D.gold:D.border}`, borderRadius:10, background:String(hole)===String(opt.jugado)?D.goldDim:"transparent", color:String(hole)===String(opt.jugado)?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer" }}>{opt.label}</button>
            ))}
          </div>
          <div style={{ fontSize:11, color:D.textSub, marginBottom:6 }}>Distancia (centímetros)</div>
          <input type="number" min="0.01" step="0.01" value={cm} onChange={e=>setCm(e.target.value)} placeholder="Ej. 245 o 245.5" style={{ width:"100%", padding:"10px 12px", border:`1px solid ${D.border}`, borderRadius:10, background:D.surface, color:D.text, fontSize:18, fontWeight:700, textAlign:"center", boxSizing:"border-box", marginBottom:14 }} />
          <Btn onClick={anotar} disabled={!jugadorId||!hole||!cm}><Target size={16}/> Guardar anotación</Btn>
        </Card>

        <Card>
          <SLabel>Todas las anotaciones ({entradas.length})</SLabel>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {[
              {key:"reciente", icon:<Clock size={13}/>, label:"Reciente"},
              {key:"distancia", icon:<Ruler size={13}/>, label:"Distancia"},
              {key:"jugador", icon:<User size={13}/>, label:"Jugador"},
              {key:"hoyo", icon:<Flag size={13}/>, label:"Hoyo"},
            ].map(o => (
              <button key={o.key} onClick={() => setSortBy(o.key)} style={{ padding:"6px 12px", border:`1px solid ${sortBy===o.key?D.gold:D.border}`, borderRadius:20, background:sortBy===o.key?D.goldDim:"transparent", color:sortBy===o.key?D.gold:D.textSub, fontSize:12, fontWeight:700, cursor:"pointer" }}>{o.label}</button>
            ))}
          </div>
          <div style={{ maxHeight:420, overflowY:"auto" }}>
          {entradas.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:12, fontSize:13 }}>Aún no hay anotaciones</div>}
          {entradas.map(([id, e]) => (
            <div key={id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:`1px solid ${D.border}` }}>
              <Avatar name={e.jugadorNombre} id={e.jugadorId} size={26} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>{e.jugadorNombre}</div>
                <div style={{ fontSize:10, color:D.textSub }}>Hoyo {e.holeJugado ?? e.holeFisico} · {e.unidadNombre}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:900, color:D.gold, marginRight:6 }}>{fmtCm(e.cm)} cm</div>
              {confirmDeleteEntry===id ? (
                <div style={{ display:"flex", gap:4 }}>
                  <button onClick={() => { remove(ref(db, `torneos/${torneoId}/oyesEntradas/${id}`)); setConfirmDeleteEntry(null); }} style={{ padding:"4px 8px", border:`1px solid ${D.danger}`, borderRadius:8, background:D.redBg, color:D.danger, fontSize:10, fontWeight:700, cursor:"pointer" }}>Sí</button>
                  <button onClick={() => setConfirmDeleteEntry(null)} style={{ padding:"4px 8px", border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:10, cursor:"pointer" }}>No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteEntry(id)} style={{ padding:"4px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}><X size={14}/></button>
              )}
            </div>
          ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
export default function H19T() {
  const [mode, setMode] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [torneoInput, setTorneoInput] = useState("");
  const [activeCodigo, setActiveCodigo] = useState(null);
  const [activeTorneoId, setActiveTorneoId] = useState(null);
  const [activeVista, setActiveVista] = useState("todo");
  const [activeOyesTorneo, setActiveOyesTorneo] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eq = params.get("equipo");
    const tr = params.get("torneo");
    const vt = params.get("vista");
    const oy = params.get("oyes");
    if (eq) { setActiveCodigo(eq.toUpperCase()); setMode("team"); }
    else if (oy) { setActiveOyesTorneo(oy); setMode("oyes"); }
    else if (tr) { setActiveTorneoId(tr); if (vt) setActiveVista(vt); setMode("spectator"); }
    else setMode("home");
  }, []);

  if (mode === null) return <Spinner label="Cargando H19T..." />;
  if (mode === "team" && activeCodigo) return <TeamPlayView codigo={activeCodigo} onExit={() => { setMode("home"); window.history.replaceState({},"",window.location.pathname); }} />;
  if (mode === "spectator" && activeTorneoId) return <SpectatorTorneoView torneoId={activeTorneoId} vistaInicial={activeVista} />;
  if (mode === "oyes" && activeOyesTorneo) return <OyesRecordView torneoId={activeOyesTorneo} onExit={() => { setMode("home"); window.history.replaceState({},"",window.location.pathname); }} />;

  if (mode === "home") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:16 }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:68, fontWeight:700, letterSpacing:-2, color:D.gold, textAlign:"center", ...GRAD_TEXT_STYLE }}>H19T</div>
        <div style={{ fontSize:12, color:D.textSub, letterSpacing:3, textTransform:"uppercase", marginBottom:16 }}>Club de Golf</div>
        <Btn onClick={() => setMode("pin")}><User size={16}/> Entrar como Admin</Btn>
        <Btn outline onClick={() => setMode("codigo-input")}><KeyRound size={16}/> Tengo un código de equipo</Btn>
        <Btn outline onClick={() => setMode("torneo-input")}><Eye size={16}/> Ver torneo en vivo</Btn>
      </div>
    );
  }

  if (mode === "pin") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:38, fontWeight:700, color:D.gold, textAlign:"center", ...GRAD_TEXT_STYLE }}>H19T</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:8 }}>Ingresa tu PIN de administrador</div>
        <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" maxLength={6}
          style={{ width:"100%", padding:14, border:`1px solid ${pinError?D.danger:D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:22, textAlign:"center", letterSpacing:8, fontWeight:700 }} />
        {pinError && <div style={{ color:D.danger, fontSize:13 }}>PIN incorrecto</div>}
        <Btn onClick={() => { if (pinInput===ADMIN_PIN) { setMode("admin"); setPinError(false); } else setPinError(true); }}>Entrar</Btn>
        <button onClick={() => { setMode("home"); setPinInput(""); setPinError(false); }} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}><ChevronLeft size={14}/> Volver</button>
      </div>
    );
  }

  if (mode === "codigo-input") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:38, fontWeight:700, color:D.gold, ...GRAD_TEXT_STYLE }}>H19T</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:8, textAlign:"center" }}>Ingresa el código de tu equipo</div>
        <input value={codigoInput} onChange={e => setCodigoInput(e.target.value.toUpperCase())} placeholder="Código" maxLength={8}
          style={{ width:"100%", padding:14, border:`1px solid ${D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:20, textAlign:"center", letterSpacing:4, fontWeight:700 }} />
        <Btn onClick={() => { if (codigoInput.trim()) { const c = codigoInput.trim(); window.history.replaceState({},"",`${window.location.pathname}?equipo=${c}`); setActiveCodigo(c); setMode("team"); } }}>Entrar</Btn>
        <button onClick={() => setMode("home")} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}><ChevronLeft size={14}/> Volver</button>
      </div>
    );
  }

  if (mode === "torneo-input") {
    return (
      <div style={{ ...appStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:14 }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:38, fontWeight:700, color:D.gold, ...GRAD_TEXT_STYLE }}>H19T</div>
        <div style={{ fontSize:14, color:D.textSub, marginBottom:8, textAlign:"center" }}>Ingresa el código del torneo</div>
        <input value={torneoInput} onChange={e => setTorneoInput(e.target.value.toUpperCase())} placeholder="Código de torneo" maxLength={8}
          style={{ width:"100%", padding:14, border:`1px solid ${D.border}`, borderRadius:12, background:D.surface, color:D.text, fontSize:20, textAlign:"center", letterSpacing:4, fontWeight:700 }} />
        <Btn onClick={() => { if (torneoInput.trim()) { const t = torneoInput.trim(); window.history.replaceState({},"",`${window.location.pathname}?torneo=${t}`); setActiveTorneoId(t); setMode("spectator"); } }}>Ver torneo</Btn>
        <button onClick={() => setMode("home")} style={{ fontSize:13, color:D.textSub, background:"none", border:"none", cursor:"pointer" }}><ChevronLeft size={14}/> Volver</button>
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
  const [confirmDeleteTorneo, setConfirmDeleteTorneo] = useState(null);
  const [confirmDeleteHist, setConfirmDeleteHist] = useState(null);
  const [oyesModo, setOyesModo] = useState("general");
  const [oyesHoles, setOyesHoles] = useState([]);
  const [oyesPremios, setOyesPremios] = useState(3);
  const [oyesSyncedFor, setOyesSyncedFor] = useState(null);

  // Elimina una ronda del historial, y de paso limpia el torneo original y sus códigos si aún existen
  const eliminarHistorialEntry = (r) => {
    get(ref(db, `torneos/${r.id}`)).then(snap => {
      const codigosDelTorneo = snap.exists() ? Object.values(snap.val().unidades||{}).filter(u=>u.codigo).map(u=>u.codigo) : [];
      Promise.all([
        ...codigosDelTorneo.map(c => remove(ref(db, `codigos/${c}`))),
        remove(ref(db, `torneos/${r.id}`)),
        remove(ref(db, `torneoHistorial/${r.id}`)),
      ]);
    });
    setConfirmDeleteHist(null);
  };

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

  // Sincroniza el formulario de O'Yes con lo guardado en el torneo, solo la primera vez que se carga
  useEffect(() => {
    if (torneo && torneoId && oyesSyncedFor !== torneoId) {
      if (torneo.oyes) {
        setOyesModo(torneo.oyes.modo || "general");
        setOyesHoles(torneo.oyes.holes || []);
        setOyesPremios(torneo.oyes.premios || 3);
      }
      setOyesSyncedFor(torneoId);
    }
  }, [torneo, torneoId, oyesSyncedFor]);

  const saveDir = (newPlayers, newNidVal) => set(ref(db, "h19tDirectorio"), { players:newPlayers, nextId:newNidVal||nid });
  const addPlayer = () => {
    const name = newName.trim(); if (!name) return;
    const hc = Math.max(0, parseInt(newHC)||0);
    saveDir([...dir, {id:nid, name, hc}], nid+1); setNid(nid+1); setNewName(""); setNewHC("");
  };
  const removePlayer = (id) => saveDir(dir.filter(p=>p.id!==id));

  const tamañoModalidad = MODALIDADES[torneo?.modalidad || modalidad].size;

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

  // Elimina un torneo por completo (útil para pruebas). Limpia también sus códigos de acceso.
  const eliminarTorneo = (t) => {
    const codigosDelTorneo = Object.values(t.unidades||{}).filter(u=>u.codigo).map(u=>u.codigo);
    Promise.all([
      ...codigosDelTorneo.map(c => remove(ref(db, `codigos/${c}`))),
      remove(ref(db, `torneos/${t.id}`)),
    ]).then(() => {
      if (torneoId === t.id) { setTorneoId(null); setTorneo(null); setScreen("dir"); }
    });
    setConfirmDeleteTorneo(null);
  };

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
    ]).then(() => { setGuardadoOk("Cambios guardados"); setTimeout(()=>setGuardadoOk(""), 2000); });
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

  // ── O'YES ──
  const toggleOyesHole = (h) => setOyesHoles(prev => prev.includes(h) ? prev.filter(x=>x!==h) : [...prev, h].sort((a,b)=>a-b));
  const generarPasswordOyes = () => set(ref(db, `torneos/${torneoId}/oyes/password`), genPassword());
  const guardarConfigOyes = () => {
    set(ref(db, `torneos/${torneoId}/oyes`), {
      modo: oyesModo, holes: oyesHoles, premios: oyesPremios,
      password: torneo?.oyes?.password || genPassword(),
    });
  };
  const compartirOyesWhatsapp = () => {
    const urlAnotar = `${window.location.origin}${window.location.pathname}?oyes=${torneoId}`;
    const urlVer = `${window.location.origin}${window.location.pathname}?torneo=${torneoId}&vista=oyes`;
    const lines = [
      `🎯 *H19T — ${torneo.nombre} — O'Yes*`, ``,
      `Para anotar distancias, entra aquí:`, urlAnotar,
      `Contraseña: *${torneo.oyes.password}*`, ``,
      `Para ver la clasificación en vivo:`, urlVer,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
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

  const verEnVivo = () => {
    const url = `${window.location.origin}${window.location.pathname}?torneo=${torneoId}`;
    const nueva = window.open(url, "_blank", "noopener,noreferrer");
    try { if (navigator.clipboard) navigator.clipboard.writeText(url); } catch(e) {}
    if (nueva) { setShareMsg("Vista en vivo abierta ✓ (link también copiado)"); }
    else { setShareMsg("El navegador bloqueó la ventana — copia el link manualmente"); }
    setTimeout(()=>setShareMsg(""), 3500);
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

  const appSt = { fontSize:14, fontFamily:FONT_SANS, color:D.text, background:"transparent", minHeight:"100vh", maxWidth:420, margin:"0 auto", paddingBottom:32 };
  const tog = (a) => ({ flex:1, padding:9, border:`1px solid ${a?D.gold:D.border}`, borderRadius:10, background:a?D.goldDim:"transparent", color:a?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer" });

  const Header = ({ title }) => (
    <div style={{ background:"rgba(255,255,255,0.7)", backdropFilter:GLASS_BLUR_HEADER, WebkitBackdropFilter:GLASS_BLUR_HEADER, borderBottom:`1px solid ${D.border}`, boxShadow:"0 1px 0 rgba(255,255,255,0.5) inset", padding:"20px 16px 14px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:25, fontWeight:700, color:D.gold, ...GRAD_TEXT_STYLE }}>H19T</div>
        <button onClick={onExit} style={{ fontSize:12, color:D.textSub, background:"none", border:`1px solid ${D.border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer" }}>Salir</button>
      </div>
      {title && <div style={{ fontSize:12.5, color:D.textSub, marginTop:3 }}>{title}</div>}
    </div>
  );

  const mainTabs = [
    {key:"dir",icon:<Users size={14}/>,label:"Jugadores"},
    {key:"nuevo",icon:<Sparkles size={14}/>,label:"Nuevo torneo"},
    {key:"hist",icon:<ClipboardList size={14}/>,label:"Historial"},
  ];
  const adminTabs = [
    {key:"unidades",icon:<User size={14}/>,label:"Unidades"},
    {key:"grupos",icon:<Link2 size={14}/>,label:"Grupos y códigos"},
    {key:"captura",icon:<Pencil size={14}/>,label:"Capturar"},
    {key:"oyes",icon:<Target size={14}/>,label:"O'Yes"},
    {key:"imprimir",icon:<Printer size={14}/>,label:"Imprimir"},
    {key:"live",icon:<Trophy size={14}/>,label:"En vivo"},
  ];

  // ── DIRECTORIO ──
  if (screen==="dir") return (
    <div style={appSt}>
      <Header title="Admin" />
      <div style={{ padding:"12px 12px" }}>
        <TabBar tabs={mainTabs} active="dir" onChange={k => setScreen(k)} />
        {listaTorneos.length > 0 && (
          <Card>
            <SLabel><Flag size={14}/> Torneos en curso</SLabel>
            {listaTorneos.map(t => (
              <div key={t.id} style={{ padding:"10px 0", borderBottom:`1px solid ${D.border}` }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <div onClick={() => abrirTorneoExistente(t)} style={{ flex:1, cursor:"pointer" }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>{t.nombre}</div>
                    <div style={{ fontSize:11, color:D.textSub }}>{CAMPOS[t.campo]?.nombre} · {MODALIDADES[t.modalidad]?.label} · {t.status}</div>
                  </div>
                  {confirmDeleteTorneo!==t.id && (
                    <>
                      <button onClick={() => setConfirmDeleteTorneo(t.id)} style={{ padding:"5px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:12, cursor:"pointer" }}><Trash2 size={14}/></button>
                      <div onClick={() => abrirTorneoExistente(t)} style={{ color:D.gold, cursor:"pointer", display:"flex", alignItems:"center" }}><ChevronRight size={18}/></div>
                    </>
                  )}
                </div>
                {confirmDeleteTorneo===t.id && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                    <span style={{ fontSize:11, color:D.danger, flex:1 }}>¿Eliminar "{t.nombre}" por completo? Esta acción no se puede deshacer.</span>
                    <button onClick={() => eliminarTorneo(t)} style={{ padding:"6px 12px", border:`1px solid ${D.danger}`, borderRadius:8, background:D.redBg, color:D.danger, fontSize:11, fontWeight:700, cursor:"pointer" }}>Sí, eliminar</button>
                    <button onClick={() => setConfirmDeleteTorneo(null)} style={{ padding:"6px 12px", border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:11, cursor:"pointer" }}>Cancelar</button>
                  </div>
                )}
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
                <button onClick={() => setConfirmDelete(p.id)} style={{ padding:"5px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}><X size={14}/></button>
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
        <Btn onClick={() => setScreen("nuevo")}><Flag size={16}/> Crear nuevo torneo</Btn>
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
                {campo===key && <Check size={13} style={{marginRight:4}}/>}{c.nombre}
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
                {modalidad===key && <Check size={13} style={{marginRight:4}}/>}{m.label} {m.size>1?`(${m.size} jugadores, scramble)`:"(1 jugador)"}
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
        <Btn outline onClick={() => setScreen("dir")} style={{ marginTop:8 }}><ChevronLeft size={14}/> Volver</Btn>
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
          <TabBar tabs={adminTabs} active="unidades" onChange={setScreen} />
          <Card>
            <SLabel>{MODALIDADES[torneo.modalidad].label} · {torneo.nHoles} hoyos · HC {torneo.hcPercent}%</SLabel>
            <div style={{ fontSize:12, color:D.textSub }}>Selecciona {tamañoModalidad} jugador{tamañoModalidad>1?"es":""} para formar {tamañoModalidad>1?"un equipo":"una unidad individual"}.</div>
          </Card>
          <Card>
            <SLabel>Jugadores disponibles ({disponibles.length})</SLabel>
            {disponibles.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Todos los jugadores del directorio ya están asignados</div>}
            {disponibles.map((p, idx) => (
              <div key={p.id} onClick={() => toggleJugadorSel(p.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:idx<disponibles.length-1?`1px solid ${D.border}`:"none", cursor:"pointer" }}>
                <div style={{ width:20,height:20,borderRadius:5,border:`2px solid ${selJugadores.has(p.id)?D.gold:D.border}`,background:selJugadores.has(p.id)?D.goldDim:"transparent",color:D.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700 }}>{selJugadores.has(p.id) && <Check size={13}/>}</div>
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
            {guardadoOk && <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, color:D.success, fontSize:12, fontWeight:600, marginBottom:8 }}><Check size={14}/>{guardadoOk}</div>}
            {unidadesList.length===0 && <div style={{ textAlign:"center", color:D.textSub, padding:16, fontSize:13 }}>Aún no hay unidades</div>}
            {unidadesList.map((u, idx) => (
              <div key={u.id} style={{ padding:"9px 0", borderBottom:idx<unidadesList.length-1?`1px solid ${D.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Avatar name={u.nombre} id={u.id} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{u.nombre}</div>
                    <div style={{ fontSize:10, color:D.textSub }}>{u.jugadores.map(j=>j.name).join(", ")} · HC aplicado {u.hcAplicado}</div>
                  </div>
                  {u.grupoId && <div style={{ fontSize:10, color:D.success, fontWeight:700 }}>Hoyo {u.hoyoSalida+1}</div>}
                  <button onClick={() => editandoUnidadId===u.id ? cancelarEdicionUnidad() : iniciarEdicionUnidad(u)} style={{ padding:"4px 8px", border:`1px solid ${editandoUnidadId===u.id?D.gold:D.border}`, borderRadius:8, background:editandoUnidadId===u.id?D.goldDim:"transparent", color:editandoUnidadId===u.id?D.gold:D.textSub, fontSize:11, cursor:"pointer" }}>{editandoUnidadId===u.id ? <X size={13}/> : "Editar"}</button>
                  {!u.grupoId && <button onClick={() => eliminarUnidad(u.id)} style={{ padding:"4px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}><Trash2 size={14}/></button>}
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
                        <div style={{ width:18,height:18,borderRadius:5,border:`2px solid ${editSelJugadores.has(p.id)?D.gold:D.border}`,background:editSelJugadores.has(p.id)?D.goldDim:"transparent",color:D.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700 }}>{editSelJugadores.has(p.id) && <Check size={13}/>}</div>
                        <Avatar name={p.name} id={p.id} size={24} />
                        <div style={{ flex:1, fontSize:12, fontWeight:600 }}>{p.name}</div>
                        <div style={{ fontSize:10, color:D.gold }}>HC {p.hc}</div>
                      </div>
                    ))}
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <button onClick={guardarEdicionUnidad} disabled={editSelJugadores.size!==tamañoModalidad} style={{ flex:1, padding:8, border:"none", borderRadius:8, background:editSelJugadores.size!==tamañoModalidad?D.border:D.gold, color:editSelJugadores.size!==tamañoModalidad?D.textDim:"#0A0E14", fontSize:12, fontWeight:700, cursor:editSelJugadores.size!==tamañoModalidad?"default":"pointer" }}>Guardar cambios</button>
                      <button onClick={cancelarEdicionUnidad} style={{ flex:1, padding:8, border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:12, cursor:"pointer" }}>Cancelar</button>
                    </div>
                    {u.grupoId && <div style={{ fontSize:10, color:D.textDim, marginTop:8 }}>Esta unidad ya está en un grupo de salida — cambiar sus integrantes no afecta su hoyo ni su código.</div>}
                  </div>
                )}
              </div>
            ))}
          </Card>
          <Btn outline onClick={() => setScreen("grupos")}>Siguiente: grupos de salida <ChevronRight size={16}/></Btn>
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
          <TabBar tabs={adminTabs} active="grupos" onChange={setScreen} />

          {sinGrupo.length>0 && (
            <Card>
              <SLabel>Armar grupo de salida</SLabel>
              <div style={{ fontSize:12, color:D.textSub, marginBottom:10 }}>Selecciona de 2 a 4 unidades (el orden en que las toques define la cadena de marcaje: la 1ª anota a la 2ª, la 2ª a la 3ª... y la última anota a la 1ª).</div>
              <div style={{ marginBottom:10 }}>
                <span style={{ fontSize:12, color:D.textSub, marginRight:8 }}>Hoyo de salida</span>
                <select value={hoyoSel} onChange={e=>setHoyoSel(parseInt(e.target.value))} style={{ padding:"6px 10px", border:`1px solid ${hoyosUsados.has(hoyoSel)?D.danger:D.border}`, borderRadius:8, background:D.surface, color:D.text, fontSize:13 }}>
                  {torneo.pares.map((_,i) => <option key={i} value={i+1}>Hoyo {i+1}{hoyosUsados.has(i+1)?" (ya ocupado)":""}</option>)}
                </select>
                {hoyosUsados.has(hoyoSel) && <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:D.danger, marginTop:6 }}><AlertTriangle size={13}/> Ya hay un grupo saliendo del hoyo {hoyoSel}. Verifica que sea correcto antes de continuar.</div>}
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
              <Btn onClick={crearGrupo} disabled={selUnidades.length<2}>Crear grupo ({selUnidades.length} unidades) <ChevronRight size={16}/></Btn>
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
                      {i<us.length-1 && <ChevronRight size={13} color={D.textDim}/>}
                    </div>
                  ))}
                  <span style={{ color:D.textDim, display:"inline-flex", alignItems:"center", gap:3 }}><ChevronRight size={13}/> ({us[0].nombre})</span>
                </div>
                <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:6 }}>
                  {us.map(u => (
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontSize:11, color:D.textSub, flex:1 }}>{u.nombre}: código <b style={{ color:D.gold }}>{u.codigo}</b></div>
                      <button onClick={() => compartirCodigoIndividual(u)} style={{ padding:"4px 10px", border:"none", borderRadius:8, background:"#25D366", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}><MessageCircle size={13}/> Enviar</button>
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
                    <button onClick={() => setConfirmDisolver(gid)} style={{ padding:"5px 10px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}><Undo2 size={13}/> Deshacer grupo (mover equipos)</button>
                  )}
                </div>
              </div>
            ))}
          </Card>

          {torneo.status !== "en_juego" && torneo.status !== "finalizada" && (
            <Btn onClick={iniciarTorneo} disabled={!todasAsignadas}>{todasAsignadas ? <><Flag size={16}/> Iniciar torneo</> : `Faltan ${sinGrupo.length} unidades por agrupar`}</Btn>
          )}
          {torneo.status === "en_juego" && (
            <div style={{ padding:"10px 12px", background:D.greenBg, border:`1px solid ${D.success}`, borderRadius:10, color:D.success, fontSize:12, fontWeight:600, textAlign:"center", marginBottom:10 }}><Check size={14} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/>Torneo en curso — los equipos ya pueden anotar</div>
          )}
        </div>
      </div>
    );
  }

  // ── O'YES: CONFIGURACIÓN ──
  if (screen==="oyes" && torneo) {
    const holesDisponibles = hoyosFisicos(torneo);
    const yaConfigurado = !!torneo.oyes?.password;
    return (
      <div style={appSt}>
        <Header title={torneo.nombre} />
        <div style={{ padding:"12px 12px" }}>
          <TabBar tabs={adminTabs} active="oyes" onChange={setScreen} />

          <Card>
            <SLabel>Modalidad de premiación</SLabel>
            {[
              {key:"general", label:"O'Yes General", desc:"Un solo premio (o varios lugares) sin importar en qué hoyo se hizo, entre todos los hoyos seleccionados."},
              {key:"hoyo", label:"O'Yes por Hoyo", desc:"Premios independientes en cada hoyo seleccionado."},
            ].map(o => (
              <button key={o.key} onClick={() => setOyesModo(o.key)} style={{ width:"100%", padding:"10px 14px", border:`1px solid ${oyesModo===o.key?D.gold:D.border}`, borderRadius:10, background:oyesModo===o.key?D.goldDim:"transparent", color:oyesModo===o.key?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer", textAlign:"left", marginBottom:8 }}>
                {oyesModo===o.key && <Check size={13} style={{marginRight:4}}/>}{o.label}
                <div style={{ fontSize:11, fontWeight:400, color:D.textDim, marginTop:2 }}>{o.desc}</div>
              </button>
            ))}
          </Card>

          <Card>
            <SLabel>Hoyos con premio de O'Yes</SLabel>
            {CAMPOS[torneo.campo]?.nueveHoyos && torneo.pares.length===18 && (
              <div style={{ fontSize:11, color:D.textSub, marginBottom:10 }}>Como este campo es de 9 hoyos jugados dos veces, cada hoyo combina automáticamente sus dos vueltas (ej. Hoyo 1 incluye lo anotado tanto en la salida de Blancas como en la de Azules).</div>
            )}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {holesDisponibles.map(h => (
                <button key={h} onClick={() => toggleOyesHole(h)} style={{ padding:"8px 14px", border:`1px solid ${oyesHoles.includes(h)?D.gold:D.border}`, borderRadius:10, background:oyesHoles.includes(h)?D.goldDim:"transparent", color:oyesHoles.includes(h)?D.gold:D.textSub, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {oyesHoles.includes(h) && <Check size={13} style={{marginRight:4}}/>}Hoyo {h}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SLabel>Número de premios (lugares) {oyesModo==="hoyo" ? "por hoyo" : ""}</SLabel>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={() => setOyesPremios(Math.max(1,oyesPremios-1))} style={{ width:34,height:34,borderRadius:"50%",border:`1px solid ${D.border}`,background:"transparent",color:D.text,cursor:"pointer",fontSize:18 }}>−</button>
              <div style={{ flex:1, textAlign:"center", fontSize:20, fontWeight:900, color:D.gold }}>{oyesPremios}</div>
              <button onClick={() => setOyesPremios(Math.min(10,oyesPremios+1))} style={{ width:34,height:34,borderRadius:"50%",border:`1px solid ${D.gold}`,background:D.goldDim,color:D.gold,cursor:"pointer",fontSize:18 }}>+</button>
            </div>
          </Card>

          <Btn onClick={guardarConfigOyes} disabled={oyesHoles.length===0}>{yaConfigurado ? "Guardar cambios" : "Activar O'Yes en este torneo"}</Btn>

          {yaConfigurado && (
            <>
              <Card style={{ marginTop:16 }}>
                <SLabel><KeyRound size={14}/> Acceso para anotar</SLabel>
                <div style={{ fontSize:12, color:D.textSub, marginBottom:10 }}>Comparte este link y la contraseña con quien vaya a anotar distancias en el campo (puede ser más de una persona, todos usan la misma contraseña).</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px", background:D.goldDim, borderRadius:10, marginBottom:10 }}>
                  <span style={{ fontSize:12, color:D.textSub }}>Contraseña</span>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:18, fontWeight:900, color:D.gold, letterSpacing:2 }}>{torneo.oyes.password}</span>
                    <button onClick={generarPasswordOyes} style={{ padding:"4px 8px", border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:10, cursor:"pointer" }}><RefreshCw size={12}/> Regenerar</button>
                  </div>
                </div>
                <button onClick={compartirOyesWhatsapp} style={{ width:"100%", padding:"12px", border:"none", borderRadius:12, background:"#25D366", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}><MessageCircle size={15}/> Compartir por WhatsApp (link + contraseña)</button>
              </Card>

              <Card>
                <SLabel><Tv size={14}/> Ver clasificación en vivo</SLabel>
                <div style={{ fontSize:12, color:D.textSub, marginBottom:8 }}>Este link es público, sin contraseña — ideal para proyectar.</div>
                <div style={{ fontSize:11, color:D.gold, wordBreak:"break-all" }}>{window.location.origin}{window.location.pathname}?torneo={torneoId}&vista=oyes</div>
              </Card>

              <OyesLiveView torneo={torneo} />
            </>
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
          <TabBar tabs={adminTabs} active="imprimir" onChange={setScreen} />
          <button onClick={() => window.print()} style={{ width:"100%", padding:"12px", border:"none", borderRadius:12, background:`linear-gradient(135deg,${D.gold},${D.goldLight})`, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}><Printer size={15}/> Imprimir esta lista</button>
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
          <TabBar tabs={adminTabs} active="live" onChange={setScreen} />
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <button onClick={verEnVivo} style={{ flex:1, padding:"10px", border:`1px solid ${D.gold}`, borderRadius:12, background:D.goldDim, color:D.gold, fontSize:12, fontWeight:700, cursor:"pointer" }}><Share2 size={13}/> Ver en vivo / Compartir link</button>
          </div>
          {shareMsg && <div style={{ textAlign:"center", color:D.success, fontSize:12, marginBottom:8 }}>{shareMsg}</div>}
          <div style={{ textAlign:"center", fontSize:11, color:D.textSub, marginBottom:10 }}>Código de torneo: <b style={{ color:D.gold }}>{torneoId}</b></div>
          <TablaPosiciones torneo={torneo} />
          <TarjetaHoyoPorHoyo torneo={torneo} />
          {torneo.status !== "finalizada" ? (
            <Btn danger onClick={finalizarTorneo}><Flag size={16}/> Finalizar torneo</Btn>
          ) : (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:12, color:D.success, fontWeight:700 }}><Trophy size={16}/> Torneo finalizado</div>
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
          <TabBar tabs={adminTabs} active="captura" onChange={setScreen} />
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
                      <button onClick={() => borrarScoreAdmin(u.id, h)} style={{ padding:"5px 8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:11, cursor:"pointer" }}><X size={14}/></button>
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
                    <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, background:D.goldDim, color:D.gold, padding:"2px 10px", borderRadius:10, fontWeight:700 }}><Trophy size={12}/> {r.ganador} ({r.netoGanador} neto)</div>
                    <div style={{ fontSize:11, color:D.textSub }}>{isOpen?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</div>
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
                    <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${D.border}` }}>
                      {confirmDeleteHist === r.id ? (
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:11, color:D.danger, flex:1 }}>¿Eliminar este torneo del historial?</span>
                          <button onClick={() => eliminarHistorialEntry(r)} style={{ padding:"6px 12px", border:`1px solid ${D.danger}`, borderRadius:8, background:D.redBg, color:D.danger, fontSize:11, fontWeight:700, cursor:"pointer" }}>Sí, eliminar</button>
                          <button onClick={() => setConfirmDeleteHist(null)} style={{ padding:"6px 12px", border:`1px solid ${D.border}`, borderRadius:8, background:"transparent", color:D.textSub, fontSize:11, cursor:"pointer" }}>Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteHist(r.id)} style={{ width:"100%", padding:"8px", border:`1px solid ${D.danger}44`, borderRadius:8, background:"transparent", color:D.danger, fontSize:12, cursor:"pointer" }}><Trash2 size={13}/> Eliminar torneo</button>
                      )}
                    </div>
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
