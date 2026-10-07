// Franja de patrocinadores — carrusel infinito, logos estandarizados.
// Los anchos (w) vienen pre-calculados en sponsors.js por área visual, así que
// no medimos imágenes ni dependemos de que carguen para animar: el ancho de
// cada <img> se fija de entrada y la animación nunca se recalcula.
//
// Si hay que agrandar o achicar TODA la franja, cambia únicamente esta constante.
// Nunca ajustes el w de un logo individual para ese fin.
const ESCALA_GLOBAL = 1;

import { sponsors } from "./sponsors";

export default function SponsorStrip({ big }) {
  // Modo TV: banda más baja (70% del tamaño). El escalado a la pantalla lo hace TVCanvas; esto solo
  // reduce proporcionalmente todos los logos por igual para que la franja sea delgada.
  const k = big ? 0.7 : 1;
  if (!sponsors || sponsors.length === 0) return null;
  const duracion = Math.min(50, Math.max(35, sponsors.length * 6)); // 35–50s según cantidad de logos

  return (
    <div style={{ width: "100%", padding: big ? "4px 0 0" : "12px 10px" }}>
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
              width={Math.round(s.w * ESCALA_GLOBAL * k)}
              style={{ width: Math.round(s.w * ESCALA_GLOBAL * k), height: "auto", flexShrink: 0, paddingRight: Math.round(70 * k) }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
