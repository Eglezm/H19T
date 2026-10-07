// Patrocinadores H19T: logos recortados y con ancho calculado por área visual.
// Para recalcular: ancho = sqrt(AREA * proporción), con AREA=9000 y tope de 220x95 px.
// Coparmex + Personas Primero es un logo doble: lleva el doble de área y tope de 320 px.
// r = alto/ancho de cada PNG (precalculado, para limitar la altura máxima sin medir imágenes en el navegador).
// Si la franja se ve muy chica o muy grande en la pantalla, multiplica todos los 'w' por el mismo factor.
export const sponsors = [
  { id: 'long-shot', src: '/logos/sponsor-long-shot.png', w: 148, r: 0.4108 },
  { id: 'grupo-robri', src: '/logos/sponsor-grupo-robri.png', w: 204, r: 0.2171 },
  { id: 'golfersin', src: '/logos/sponsor-golfersin.png', w: 129, r: 0.5388 },
  { id: 'funambulo', src: '/logos/sponsor-funambulo.png', w: 177, r: 0.2875 },
  { id: 'coparmex-personas-primero', src: '/logos/sponsor-coparmex-personas-primero.png', w: 320, r: 0.1333 },
  { id: 'cachito-mio', src: '/logos/sponsor-cachito-mio.png', w: 155, r: 0.375 },
  { id: 'arta', src: '/logos/sponsor-arta.png', w: 133, r: 0.5081 },
  { id: 'maja', src: '/logos/sponsor-maja.png', w: 177, r: 0.2883 },
  { id: 'la-huerta', src: '/logos/sponsor-la-huerta.png', w: 121, r: 0.618 },
  { id: 'sipanel', src: '/logos/sponsor-sipanel.png', w: 220, r: 0.085 },
  { id: 'ep-seguros', src: '/logos/sponsor-ep-seguros.png', w: 116, r: 0.6726 },
  { id: 'defender', src: '/logos/sponsor-defender.png', w: 122, r: 0.6083 },
  { id: 'revidere-dfk', src: '/logos/sponsor-revidere-dfk.png', w: 151, r: 0.3967 },
  { id: 'sunpower', src: '/logos/sponsor-sunpower.png', w: 169, r: 0.3142 },
  { id: 'topolino', src: '/logos/sponsor-topolino.png', w: 129, r: 0.5429 },
  { id: 'banyan-tree', src: '/logos/sponsor-banyan-tree.png', w: 89, r: 1.0638 },
  { id: 'ws', src: '/logos/sponsor-ws.png', w: 150, r: 0.3976 },
  { id: 'arboterra', src: '/logos/sponsor-arboterra.png', w: 99, r: 0.9141 },
  { id: 'mazda-serdan', src: '/logos/sponsor-mazda-serdan.png', w: 145, r: 0.4307 },
  { id: 'camiones-rivera', src: '/logos/sponsor-camiones-rivera.png', w: 183, r: 0.2681 },
];
