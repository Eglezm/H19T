// Franja de patrocinadores — carrusel infinito, logos estandarizados.
// Los anchos (w) vienen pre-calculados en sponsors.js por área visual, así que
// no medimos imágenes ni dependemos de que carguen para animar: el ancho de
// cada <img> se fija de entrada y la animación nunca se recalcula.
//
// Si hay que agrandar o achicar TODA la franja, cambia únicamente esta constante.
// Nunca ajustes el w de un logo individual para ese fin.
const ESCALA_GLOBAL = 1;
export const ALTURA_MAX_TV = 78; // altura máxima de un logo en la franja del modo TV (px de lienzo)

import { useState, useEffect } from "react";
import { sponsors as catalogo } from "./sponsors";

// Lista de logos de ESTE torneo: los del catálogo (public/logos + sponsors.js) que el admin marcó,
// más los logos que subió desde la app (torneo.logos.patrocinadores). Si el torneo nunca se
// personalizó (patrocinadoresPers sin marcar), se muestran todos los del catálogo, como antes.
export function patrocinadoresDeTorneo(torneo) {
  const base = !torneo || !torneo.patrocinadoresPers
    ? catalogo
    : catalogo.filter(s => torneo.patrocinadoresSel && torneo.patrocinadoresSel[s.id]);
  const propios = ((torneo && torneo.logos && torneo.logos.patrocinadores) || [])
    .map((p, i) => ({ id: `propio-${(p && p.id) || i}`, src: typeof p === "string" ? p : (p && p.url) || "", custom: true }))
    .filter(p => p.src);
  return [...base, ...propios];
}

export default function SponsorStrip({ big, torneo }) {
  const lista = patrocinadoresDeTorneo(torneo);
  // Los logos subidos desde la app no traen w/r precalculados: se miden al cargar (solo esos).
  const [medidas, setMedidas] = useState({});
  const clave = lista.filter(s => s.custom).map(s => s.src).join("|");
  useEffect(() => {
    let vivo = true;
    clave.split("|").filter(Boolean).forEach(src => {
      const im = new Image();
      im.onload = () => { if (vivo && im.naturalWidth) setMedidas(m => ({ ...m, [src]: im.naturalHeight / im.naturalWidth })); };
      im.src = src;
    });
    return () => { vivo = false; };
  }, [clave]);
  const sponsors = lista.map(s => {
    if (!s.custom) return s;
    const r = medidas[s.src] || 0.5;
    return { ...s, r, w: Math.min(220, Math.round(Math.sqrt(9000 / r))) }; // misma regla de área que el catálogo
  });
  // Modo TV: los logos van al 100% de su ancho w y su altura se limita a ALTURA_MAX_TV (px de lienzo)
  // para que la franja blanca quede casi del tamaño de los logos. El escalado a la pantalla lo hace
  // TVCanvas. La altura sale de r (alto/ancho precalculado en sponsors.js), sin medir imágenes.
  const k = 1;
  const alturaMax = big ? ALTURA_MAX_TV : Infinity;
  const tam = (s) => {
    const w = s.w * ESCALA_GLOBAL * k;
    const h = w * (s.r || 0.5);
    const f = h > alturaMax ? alturaMax / h : 1;
    return Math.round(w * f);
  };
  if (!sponsors || sponsors.length === 0) return null;
  const duracion = Math.min(50, Math.max(35, sponsors.length * 6)); // 35–50s según cantidad de logos

  return (
    <div style={{ width: "100%", padding: big ? "0" : "12px 10px" }}>
      {!big && (
        <div style={{ fontSize: 9, color: "#A6AC9C", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, textAlign: "center", marginBottom: 2 }}>
          Patrocinado por
        </div>
      )}
      <div style={{ overflow: "hidden", width: "100%" }}>
        <div className="h19-marquee-track h19-sponsor-track" style={{ "--h19-marquee-duration": `${duracion}s` }}>
          {[...sponsors, ...sponsors].map((s, i) => (
            <img
              key={`${s.id}-${i}`}
              src={s.src}
              alt={s.id}
              width={tam(s)}
              style={{ width: tam(s), height: "auto", flexShrink: 0, paddingRight: Math.round(70 * k) }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
