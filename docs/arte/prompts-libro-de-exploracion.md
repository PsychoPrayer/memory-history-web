# Memory History — Guía de prompts para el Libro de Exploración de Pancito

Prompts listos para copiar en ChatGPT (generación de imágenes). Cada bloque se pega tal
cual. Lee primero la sección 0: es lo que hace que todas las imágenes salgan coherentes
entre sí.

---

## 0. Antes de empezar (importante)

### 0.1 Adjunta siempre estas referencias
En **cada** conversación nueva con ChatGPT, adjunta estas imágenes del repo y dile
"Usa estas imágenes como referencia de estilo y de personaje":

- `public/imagenes/ui/pancito/happy.webp`, `guide.webp`, `point.webp` (Pancito)
- `public/imagenes/intro/memory-history.webp` (logo)
- `public/imagenes/historias/clavel.webp` y `orquidea.webp` (estilo acuarela)
- `public/imagenes/secciones/seccion-16.webp` (Pancito descubridor)
- `public/imagenes/atlas/ve.png` (mapa antiguo actual)

### 0.2 Una serie, una conversación
Haz cada serie (apertura, pasar página, mapas, tableros) en **su propia conversación** y
no cambies de conversación a mitad de serie. Pide primero la imagen 1; cuando te guste,
pide las siguientes **editando esa imagen** ("usa la imagen anterior y cambia solo…").
Así se mantienen la cámara, la luz y las proporciones.

### 0.3 Animaciones: se hacen en código, la IA solo da piezas planas
Lo probamos: pedir la animación por frames no funciona. La IA dibuja el libro de lado,
lo deforma al abrirlo y no lo mantiene centrado. Por eso **las animaciones de abrir el
libro y pasar página las hacemos en código** (3D en el navegador, ya hay un prototipo) y
a ChatGPT **solo le pedimos piezas planas**, como si escaneara cada parte del libro:

- **Siempre de frente y plana**, como un escaneo o una foto cenital. Nada de
  perspectiva, inclinación, libro de lado ni libro abierto.
- **Llenando el lienzo de borde a borde**: la pieza toca los cuatro bordes de la
  imagen. Sin márgenes, sin mesa, sin fondo, sin sombra proyectada.
- Si sale con perspectiva o con fondo, no la corrijas pidiendo cambios: repite el prompt
  en una conversación nueva.

Frase que conviene añadir al final de cada prompt de pieza:

```
Muy importante: vista completamente frontal y plana, como un escaneo, sin perspectiva
ni inclinación. La pieza ocupa la imagen entera de borde a borde, sin margen, sin
fondo, sin mesa y sin sombra proyectada.
```

### 0.4 Formatos
- Libro y páginas: **vertical 2:3** (1200 × 1800 px).
- Tableros de juego: **vertical 9:16** (1080 × 1920 px).
- Pide siempre **PNG**. Para piezas sueltas, **fondo transparente**.
- **Sin texto dentro de las imágenes** salvo que el prompt lo diga. La IA escribe con
  faltas; los textos los ponemos nosotros encima.

### 0.5 Bloque de estilo (pégalo al inicio de CADA prompt)

```
ESTILO MEMORY HISTORY: ilustración de libro antiguo de exploración del siglo XVIII,
acuarela y tinta sobre papel envejecido color crema (#e2d6bb), trazos de tinta marrón
oscuro (#2b2116), detalles en oro viejo (#c99f45 y #9a6f27), acentos en rojo vino
(#6d2521) y verde oliva (#4a5f38). Cuero marrón gastado, latón y pan de oro. Iluminación
cálida y suave desde arriba a la izquierda. Aspecto artesanal y didáctico, apto para
niños, rico en detalle pero limpio. Personaje: Pancito, un panecillo tostado con cara
amable, salacot de explorador, camisa y pantalón corto beige, prismáticos y bolso de
cuero (igual que en las imágenes de referencia). Sin texto, sin marcas de agua, sin
logotipos inventados.
```

---

## 1. El libro cerrado (portada)

Pieza base de todo lo demás. Hazla primero y úsala como referencia en las series 2 y 3.

```
[BLOQUE DE ESTILO]
Textura de la TAPA DELANTERA de un libro antiguo de exploración, escaneada de frente y
plana, vertical 2:3 (1200x1800). Solo la tapa: cuero marrón oscuro gastado con marcas
de uso, un doble filete dorado repujado a 60 px del borde, esquinas de latón en las
cuatro esquinas. En el centro, un medallón dorado repujado y liso, con una brújula
grabada alrededor del borde (dentro del medallón colocamos a Pancito en código).
Arriba, una cartela dorada vacía y lisa para colocar luego el título "Memory History".
Sin lomo, sin cantos de páginas, sin broche (eso lo añadimos en código).
Muy importante: vista completamente frontal y plana, como un escaneo, sin perspectiva
ni inclinación. La tapa ocupa la imagen entera de borde a borde, sin margen, sin fondo,
sin mesa y sin sombra proyectada.
```


---

## 2. Animación de apertura del libro

**Ya está hecha en el juego**, en código: tras los logos de inicio, el libro aparece
cerrado, el broche brilla, tiembla y salta con un destello, la tapa se levanta y gira
sobre el lomo izquierdo, sale polvo dorado y la cámara entra en la primera página
("Diario de viaje de…") hasta llegar al menú. Ahora se dibuja con CSS; estas piezas
solo sirven para que se vea más rico. Pide cada una en su propio mensaje, con la tapa
del punto 1 adjunta.

```
[BLOQUE DE ESTILO]
Pieza 1 — Textura de la CARA INTERIOR de la tapa del libro adjunto, escaneada de frente
y plana, vertical 2:3 (1200x1800): guardas de papel marmolado en vino y oro, con un ex
libris dorado vacío en el centro y un fino borde de cuero de 40 px alrededor.
Muy importante: vista completamente frontal y plana, como un escaneo, sin perspectiva
ni inclinación. La pieza ocupa la imagen entera de borde a borde, sin margen, sin
fondo, sin mesa y sin sombra proyectada.
```

```
[BLOQUE DE ESTILO]
Pieza 2 — Textura de una PÁGINA interior del libro, escaneada de frente y plana,
vertical 2:3 (1200x1800): papel crema envejecido con manchas suaves de humedad en las
esquinas y fibras de papel visibles, un fino filete dorado doble a 40 px del borde y
una pequeña rosa de los vientos dorada en la esquina inferior derecha. El centro
completamente vacío para colocar contenido encima. Sin texto.
Muy importante: vista completamente frontal y plana, como un escaneo, sin perspectiva
ni inclinación. La página ocupa la imagen entera de borde a borde, sin margen, sin
fondo, sin mesa y sin sombra proyectada.
```

```
[BLOQUE DE ESTILO]
Pieza 3 — Textura del CANTO de las páginas: tira vertical estrecha (120x1800) vista de
frente, como muchas hojas de papel crema apiladas, con finas líneas horizontales y los
bordes ligeramente dorados. Llena la tira entera, sin fondo.
```

```
[BLOQUE DE ESTILO]
Pieza 4 — Textura del LOMO del libro: tira vertical (160x1800) de cuero marrón oscuro
con 5 nervios horizontales en relieve y pequeños adornos dorados entre ellos, vista de
frente y plana, llenando la tira entera, sin fondo.
```

```
[BLOQUE DE ESTILO]
Pieza 5 — El BROCHE suelto: una tira de cuero marrón con costura dorada y una hebilla
rectangular de latón en el extremo izquierdo, horizontal (600x180), vista de frente y
plana, sin perspectiva. Fondo transparente, sin sombra.
```

```
[BLOQUE DE ESTILO]
Pieza 6 — FONDO detrás del libro: tablero de una mesa de madera oscura de escritorio
antiguo visto desde arriba, vertical 9:16 (1080x1920), con vetas suaves y una luz cálida
de vela en el centro que se apaga hacia los bordes. Nada encima de la mesa, sin objetos.
```

El brillo, las chispas del broche y el polvo dorado ya los hacemos en código, no hace
falta pedirlos.

---

## 3. Animación de pasar página

Ya está hecha en el juego y **no necesita imágenes**: al entrar en una pantalla, la
página actual se levanta desde el borde derecho y pasa hacia la izquierda; al volver,
la página anterior regresa desde la izquierda. Se usa la propia pantalla del juego
como hoja, así que siempre coincide con lo que se ve.

---

## 4. Páginas de cada escena (plantillas)

Cada pantalla del juego será una página del libro. Pide una plantilla por escena, con
el centro **vacío** (el contenido lo ponemos nosotros encima). Usa siempre la pieza 2
adjunta como base.

```
[BLOQUE DE ESTILO]
Usando la página adjunta como base, decora SOLO los bordes y las esquinas para la
escena: «[ESCENA]». El centro (al menos el 70% de la página) debe quedar como papel
liso, sin dibujos, para colocar botones y textos encima. Vertical 2:3 (1200x1800).
Sin texto.
Decoración: [DECORACIÓN]
```

| Escena | Decoración sugerida |
|---|---|
| Índice / menú principal | Pancito asomado por la esquina inferior izquierda saludando, una pluma y un tintero arriba a la derecha |
| Elegir país | Un globo terráqueo antiguo pequeño en una esquina y banderines de tela en el borde superior |
| Capítulos (secciones) | Siete marcapáginas de cinta de colores asomando por el borde derecho |
| Mapa de niveles | Marco de cartógrafo: regla graduada en los bordes, compás de latón en una esquina |
| Historias (álbum) | Esquineros de foto de papel kraft y una lupa apoyada en la esquina inferior |
| Tests | Un pergamino enrollado y una pluma; pequeños sellos de lacre rojo |
| Logros | Una vitrina de medallas doradas en el borde inferior y una corona de laurel arriba |
| Configuración | Engranajes de latón, un reloj de bolsillo y una llave antigua en las esquinas |
| Pantalla de carga | Pancito caminando con el libro bajo el brazo por el borde inferior |

---

## 5. Mapas nuevos de cada país

Problemas del mapa actual: los niveles quedan amontonados y algunos se tapan, y el mapa
es antiguo pero poco didáctico. Los nuevos mapas tienen que ser **ilustrados, con los
lugares de las historias dibujados**, y con un **camino claro de 10 paradas** bien
separadas.

### Reglas para los 3 mapas
- Vertical 2:3 (1200 × 1800): el mapa ocupa una página del libro.
- **10 paradas vacías** (círculos de pergamino con borde dorado, sin números) unidas por
  un camino punteado que serpentea por todo el país. Entre parada y parada debe haber
  al menos el ancho de dos paradas, y ninguna debe tapar otra.
- Las paradas 1 a 5 en la mitad superior y las 6 a 10 en la mitad inferior. Las 6 a 10
  con borde rojo vino en lugar de dorado, porque son los niveles difíciles.
- Lugares famosos dibujados como pequeñas viñetas en acuarela, cerca del camino pero
  sin tapar las paradas.
- Sin nombres de ciudades ni textos. Solo una cartela decorativa vacía para el nombre
  del país.
- Al recibirlos, mido dónde quedó cada parada y coloco los niveles encima.

```
[BLOQUE DE ESTILO]
Mapa ilustrado y didáctico de [PAÍS], estilo atlas antiguo de exploración en acuarela,
vertical 2:3 (1200x1800). Silueta del país clara y reconocible, con relieve suave de
montañas, ríos en azul tenue y mar con olas de grabado. Un camino punteado color tinta
serpentea por todo el país uniendo 10 paradas vacías (círculos de pergamino de igual
tamaño, sin números): paradas 1-5 con borde dorado en la mitad superior, paradas 6-10
con borde rojo vino en la mitad inferior. Las paradas, bien separadas, nunca se tapan.
Junto al camino, pequeñas viñetas en acuarela de: [LUGARES]. Una rosa de los vientos
dorada en una esquina, un barco antiguo en el mar y una cartela vacía arriba para el
nombre del país. Sin texto en ninguna parte.
```

**Venezuela** — LUGARES: el Ávila sobre Caracas, el Salto Ángel, los tepuyes, los
Médanos de Coro, el río Orinoco con toninas, el Pico Bolívar con el teleférico de
Mérida, el relámpago del Catatumbo sobre el lago de Maracaibo, la Colonia Tovar, el
Puente de Angostura, el Arco de Carabobo, una playa caribeña con palmeras, un araguaney
en flor, un turpial, una guacamaya, un chigüire y una orquídea.

**España** — LUGARES: el Acueducto de Segovia, la Sagrada Familia, la Alhambra, la
Giralda, la Mezquita de Córdoba, la Torre de Hércules en A Coruña, la cueva de
Covadonga en Asturias, el Camino de Santiago con su concha, la Ciudad Encantada de
Cuenca, el Museo del Prado en Madrid, una falla en Valencia, los toros de San Fermín en
Pamplona, la Tomatina en Buñol, las islas Baleares, un águila imperial ibérica, olivos
en Andalucía y, en un recuadro aparte abajo, las islas Canarias con el Teide.

**Estados Unidos** — LUGARES: la Estatua de la Libertad y el Empire State en Nueva York,
el Puente de Brooklyn, la Campana de la Libertad en Filadelfia, el Capitolio en
Washington, las Cataratas del Niágara, el Monte Rushmore, el géiser Old Faithful en
Yellowstone, las Montañas Rocosas, el Gran Cañón, la Ruta 66, un saguaro en Arizona,
secuoyas gigantes y el Golden Gate en California, el letrero de colinas de Hollywood
(sin letras), el río Mississippi con un barco de vapor, un búfalo en las praderas, un
águila calva y un cocodrilo en Florida.

**Italia** (cuando toque) — misma plantilla, con el Coliseo, la torre de Pisa, los
canales de Venecia con góndolas, el Vesubio, la catedral de Florencia, olivos de la
Toscana y Sicilia.

> Opcional, para más variedad: un mapa por capítulo (7 por país), cada uno a una hora
> del día o estación distinta (amanecer, día, atardecer, noche estrellada, otoño,
> invierno con nieve, fiesta con farolillos). Usa el mapa base como referencia y pide
> "el mismo mapa, mismo encuadre y mismas paradas, pero [ambiente]".

---

## 6. Tableros de juego (uno por cada cantidad de cartas)

Cada capítulo tiene su propia mesa de madera, que cambia de personaje y de ambiente
como las ilustraciones de cada sección. Las cartas las coloca el juego encima, así que
el tablero **no debe llevar cartas ni huecos dibujados**: solo la superficie y la
decoración del borde.

### Reglas para los 7 tableros
- Vertical 9:16 (1080 × 1920).
- **El 12% superior** queda tranquilo (madera lisa o sombra), porque ahí va la barra
  con tiempo, parejas y errores.
- **El área central** (del 15% al 90% de alto y del 5% al 95% de ancho) es madera lisa
  con veta suave, **sin objetos encima**, porque ahí van las cartas.
- Los objetos decorativos solo en los bordes, sobre todo en las esquinas y en la franja
  inferior.
- Vista cenital, como si miráramos la mesa desde arriba.

```
[BLOQUE DE ESTILO]
Tablero de juego visto exactamente desde arriba: superficie de mesa de madera para un
juego de memoria de cartas, vertical 9:16 (1080x1920). El 12% superior más oscuro y
liso. El área central amplia (del 15% al 90% de alto, del 5% al 95% de ancho) es madera
lisa y limpia, con veta suave, SIN ningún objeto encima, para colocar [N] cartas en una
cuadrícula de [COLUMNAS] columnas por [FILAS] filas. Decoración solo en los bordes y
las esquinas: [DECORACIÓN]. Luz cálida desde arriba a la izquierda, viñeteado suave.
Sin cartas, sin huecos de cartas, sin texto.
```

| Capítulo | Cartas | Cuadrícula | Madera y decoración de los bordes |
|---|---|---|---|
| I · Aprendiz | 12 | 3 × 4 | Pino claro de taller de imprenta: tipos móviles de plomo, un rodillo de tinta y hojas impresas en las esquinas |
| II · Descubridor | 16 | 4 × 4 | Roble de camarote de barco: brújula, catalejo, cabos de cuerda y una carta náutica enrollada |
| III · Historiador | 20 | 4 × 5 | Nogal de biblioteca: libros apilados, vela en candelabro de latón, lupa y pluma con tintero |
| IV · Arqueólogo | 24 | 4 × 6 | Madera de campamento con arena en las esquinas: pincel, paleta de excavación, vasija rota y fósil |
| V · Expedicionario | 28 | 4 × 7 | Mesa de campaña plegable de lona y madera: farol, cantimplora, mapa doblado y sombrero de explorador |
| VI · Maestro | 32 | 4 × 8 | Caoba con incrustaciones de latón: globo terráqueo pequeño, astrolabio y reloj de arena |
| VII · Erudito | 40 | 5 × 8 | Escritorio real de ébano con filigrana dorada: corona de laurel, sello de lacre real y pergaminos con lazo |

Para que encajen con el estilo del juego, adjunta también la ilustración del capítulo
(`public/imagenes/secciones/seccion-12.webp` … `seccion-40.webp`) y el reverso de sus
cartas (`public/imagenes/reversos/`).

---

## 7. Cosas que te faltaban (y conviene pedir también)

1. **Marcapáginas de navegación:** cintas de tela con un icono (casa, mapa, libro,
   engranaje) que asoman por el borde de la página. Son el "menú" natural de un libro.
   Pide cada cinta por separado, vertical, con fondo transparente.
2. **Medallas de nivel nuevas:** el sello de cada nivel en tres estados: bloqueado
   (lacre gris con candado), disponible (lacre dorado) y completado (lacre con 1, 2 o 3
   estrellas). Cuadradas de 256 × 256, fondo transparente.
3. **Pancito interactuando con el libro:** abriendo el libro, señalando una página,
   leyendo con lupa y celebrando con el libro en alto. Fondo transparente, para la
   pantalla de carga y los consejos.
4. **Sonidos** (no son imágenes): abrir el libro (cuero y papel), pasar página, y un
   "clac" de sello al completar un nivel. Se pueden sacar de bancos libres como
   freesound.org.
5. **Coherencia del icono de la app:** cuando el libro esté listo, conviene rehacer el
   icono con la portada del libro y Pancito.
6. **Versión del mapa para Italia**, cuando su contenido esté listo (sección 5).

---

## 8. Cómo entregarme los archivos

Guárdalos con estos nombres en una carpeta y avísame. Yo los integro, mido las paradas
de los mapas y monto las animaciones:

```
libro/portada.png, tapa-interior.png, pagina.png, canto.png, lomo.png,
      broche.png (opcional), fondo-mesa.png (opcional)
paginas/indice.png, paises.png, capitulos.png, mapa.png, historias.png,
        tests.png, logros.png, configuracion.png, carga.png
mapas/ve.png, es.png, eu.png
tableros/12.png, 16.png, 20.png, 24.png, 28.png, 32.png, 40.png
extras/marcapaginas-*.png, medalla-*.png, pancito-libro-*.png
```
