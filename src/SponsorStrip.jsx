// Franja de patrocinadores — carrusel infinito, logos estandarizados.
// Los anchos (w) y proporciones (r = alto/ancho) vienen pre-calculados en sponsors.js
// por área visual, así que no medimos imágenes ni dependemos de que carguen para animar.
//
// Vista normal: el logo más alto mide ALTURA_LOGOS px (45). Modo TV: todo se escala
// con ESCALA_TV para que el logo más alto mida ALTURA_MAX_TV px de lienzo, conservando
// la proporción entre logos.
//
// Si hay que agrandar o achicar TODA la franja, cambia únicamente estas constantes.
// Nunca ajustes el w de un logo individual para ese fin.
import { sponsors } from "./sponsors";

const ESCALA_GLOBAL = 1;
const ALTURA_LOGOS = 45; // alto del logo más alto en vista normal (px)
export const ALTURA_MAX_TV = 78; // alto del logo más alto en modo TV (px de lienzo)
const ESCALA_TV = ALTURA_MAX_TV / ALTURA_LOGOS;
const ESPACIO = 70; // separación entre logos (px), se suma al ancho, no se le resta

export default function SponsorStrip({ big }) {
  const k = (big ? ESCALA_TV : 1) * ESCALA_GLOBAL;
  const alturaMax = (big ? ALTURA_MAX_TV : ALTURA_LOGOS) * ESCALA_GLOBAL;

  // Ancho del logo (sin padding). El tope de alto es solo una red de seguridad:
  // con los valores de sponsors.js ningún logo lo rebasa.
  const tam = (s) => {
    const w = s.w * k;
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
        <div
          className="h19-marquee-track h19-sponsor-track"
          style={{ "--h19-marquee-duration": `${duracion}s`, minHeight: Math.round(alturaMax) }}
        >
          {[...sponsors, ...sponsors].map((s, i) => (
            <img
              key={`${s.id}-${i}`}
              src={s.src}
              alt={s.id}
              width={tam(s)}
              style={{
                width: tam(s),
                height: "auto",
                flexShrink: 0,
                // content-box: el padding se SUMA al ancho del logo en vez de comérselo
                boxSizing: "content-box",
                paddingRight: Math.round(ESPACIO * k),
              }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
