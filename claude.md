# Un mensaje para quienes están empezando con IA

Hola a todos,

Si están en esta clase de Claude Code, ya dieron el paso más difícil: decidieron que querían crear, no solo consumir.

La inteligencia artificial no está aquí para reemplazar su curiosidad, está aquí para multiplicarla. Hoy, una persona con una idea clara y las herramientas correctas puede construir en un fin de semana lo que antes tomaba meses y un equipo completo. Eso no es magia, es una oportunidad — y depende de ustedes aprovecharla.

No tengan miedo de equivocarse. Cada error que cometan programando con IA es información, no fracaso. Prueben, rompan cosas, pregunten "¿por qué funciona así?" y luego pregúntenle a la IA "¿cómo lo haría diferente?". La mejor forma de aprender esta herramienta es usándola sin miedo.

No se queden solo en la teoría. Abran una terminal, escriban una idea por loca que parezca, y vean qué pasa. El proyecto que no empiezan hoy por "no saber lo suficiente" es exactamente el proyecto con el que van a aprender lo que les falta.

El límite ya no es la técnica. El límite es la imaginación y la constancia. Así que imaginen en grande, empiecen en pequeño, y no dejen de construir.

Nos vemos del otro lado del código.

— Jesús Vargas

---

# Proyecto de hoy: Simulación 3D del Perseverance

## Descripción

Hoy vamos a construir, en vivo y en 60 minutos, una simulación 3D del rover Perseverance, el robot de la NASA que explora Marte. La idea es que la clase vea de principio a fin cómo se construye algo con IA: desde una carpeta vacía hasta un rover moviéndose sobre un terreno marciano en el navegador.

**Objetivo:** tener al final de la clase una página web con una escena 3D donde se vea el rover Perseverance (modelo simplificado), sobre un terreno tipo Marte (rojizo, con rocas/cráteres), que se pueda mover y/o la cámara se pueda orbitar alrededor.

## Stack elegido

- **Three.js** (vía CDN o npm) para el renderizado 3D en el navegador — rápido de levantar, visual, funciona en cualquier navegador sin instalar nada pesado.
- HTML + JavaScript plano (sin frameworks pesados) para que el código sea fácil de seguir en vivo durante la clase.

## Plan de la clase (60 minutos)

1. **(0–5 min) Setup inicial**
   - Crear estructura del proyecto (`index.html`, `main.js`, `style.css`).
   - Levantar un servidor local simple para ver los cambios en vivo.

2. **(5–15 min) Escena base en Three.js**
   - Crear la escena, cámara y renderer.
   - Agregar luces (ambiente + direccional, simulando el sol marciano).
   - Fondo tipo cielo de Marte (color anaranjado/rosado).

3. **(15–25 min) Terreno marciano**
   - Crear un plano/terreno con textura o color rojizo.
   - Agregar relieve simple (ruido/desplazamiento de vértices) para simular el terreno irregular de Marte.
   - Agregar algunas rocas (geometrías simples dispersas).

4. **(25–40 min) El rover Perseverance**
   - Construir el rover con geometrías básicas (cuerpo, 6 ruedas, mástil con cámaras, panel solar/RTG, brazo robótico simplificado).
   - Posicionarlo sobre el terreno.

5. **(40–50 min) Interacción**
   - Agregar controles de órbita (OrbitControls) para que la clase pueda mover la cámara y ver el rover desde todos los ángulos.
   - (Opcional si da el tiempo) Animar el movimiento del rover sobre el terreno.

6. **(50–60 min) Cierre**
   - Repaso rápido de lo construido.
   - Mostrar cómo seguir iterando después de clase (más detalle al modelo, texturas reales de Marte, animaciones de las ruedas, polvo, etc.)

## Estado del avance

- [x] Setup del proyecto
- [x] Escena base (cámara, luces, cielo) — cielo anaranjado, niebla de polvo, sol cálido con sombras, OrbitControls adelantados
- [x] Terreno marciano — `terrain.js`: colinas con ruido fractal, 5 cráteres con borde, color por altura, ~160 rocas, centro aplanado, `heightAt(x, z)` para apoyar el rover
- [x] Modelo del rover — `rover.js`: cuerpo, 6 ruedas con garras, suspensión rocker-bogie, mástil con Mastcam-Z y SuperCam, brazo con taladro, RTG, antenas; `placeOnTerrain()` lo inclina según la pendiente
- [x] Controles de cámara / interacción — manejo con WASD/flechas (aceleración suave, giro en su lugar), ruedas girando según la velocidad de cada lado, rover se inclina con el relieve, cámara y sol siguen al rover, instrucciones en pantalla
- [x] Pulido final — rocas grandes bloquean el paso con alerta "OBSTÁCULO DETECTADO" (las chicas se pasan por encima, como el real), telemetría en pantalla (velocidad, distancia, rumbo, cámara), tecla C para la vista en primera persona desde la Mastcam-Z, rocas sin grietas

## Cómo ejecutarlo

```bash
npm start          # = python3 -m http.server 8080 → abrir http://localhost:8080
npm run check      # chequeo completo (necesita internet y Chrome o Chromium)
npm run fotos      # renovar las fotos de las cámaras (ver Pedido 6)
```

Hace falta servirlo con un servidor (no abrir el `.html` directo) porque usa módulos de JavaScript. El proyecto no tiene dependencias: no hay que correr `npm install`.

Repositorio: `git@github.com:lilseniorj/perseverancia.git` (rama `main`).

| Tecla | Acción |
|---|---|
| W / S o ↑ / ↓ | Avanzar / retroceder |
| A / D o ← / → | Girar (también en su lugar) |
| C | Alternar cámara órbita / Mastcam-Z (la cámara real del mástil) |
| E | Tomar una muestra (con una roca u objeto al alcance) |
| T | Mostrar / ocultar el control de misión |
| Clic en un punto azul | Foto real de esa cámara (← → más fotos, Esc para volver) |
| Mouse | Orbitar y hacer zoom (vista órbita) |

## Estructura del proyecto

- `index.html` — página, import map de Three.js, instrucciones y telemetría
- `style.css` — estilos de la interfaz
- `main.js` — escena, luces, conducción, colisiones, cámaras, polvo, suspensión y telemetría
- `terrain.js` — terreno, cráteres, rocas con tipo, meteoritos y restos (semilla fija)
- `rover.js` — rover simple (respaldo si el modelo no carga), su brazo y `placeOnTerrain()`
- `model.js` — modelo de la NASA: carga, llantas separadas, mástil desplegado, suspensión rocker-bogie
- `nasa-arm.js` — cinemática inversa del brazo real de la NASA
- `sampling.js` — toma de muestras (funciona con cualquiera de los dos brazos)
- `effects.js` — huellas y polvo
- `mission-control.js` + `ephemeris.js` — control de misión y tiempo de luz Tierra → Marte
- `camera-photos.js` + `photos.js` — puntos sobre las cámaras y visor de fotos reales
- `openmct-percy-plugin.js` — plugin para ver la telemetría de Percy en Open MCT
- `mapa-del-repo.html` — explicación de Open MCT (también publicada como artefacto)
- `scripts/check.mjs`, `scripts/test-percy-plugin.mjs`, `scripts/fotos.mjs` — chequeo, prueba del plugin y renovación de fotos
- `public/models/perseverance.glb` — modelo 3D oficial de la NASA

## Ideas para seguir después de la clase

- Agregar el helicóptero Ingenuity volando cerca del rover
- ~~Huellas de las ruedas sobre la arena~~ *(hecho)*
- ~~Usar el brazo para tomar una muestra de roca~~ *(hecho, con el brazo real de la NASA)*
- Ciclo de día y noche marciano (un "sol" dura 24 h 39 min)
- Texturas reales usando imágenes públicas de la NASA

---

# Extensión: huellas y polvo

## Contexto

El plan original de la clase (los 6 pasos) está completo. Como siguiente mejora elegimos que **se note el movimiento**: el rover deja huellas en la arena y levanta polvo con las ruedas al avanzar.

**Estado del proyecto al empezar la extensión:**
- La simulación funciona con terreno, rover, conducción, colisiones, telemetría y la cámara Mastcam-Z.
- Se ejecuta con `python3 -m http.server 8080` y se abre en http://localhost:8080.
- La carpeta `.playwright-mcp/` tiene capturas de las pruebas automáticas y conviene borrarla antes de compartir el proyecto.

## Enfoque

- **Módulo nuevo `effects.js`**, en un archivo aparte igual que `terrain.js` y `rover.js`:
  - **Huellas:** un `InstancedMesh` de planos chicos y oscuros con un búfer circular de unas 1500 huellas, que reemplaza las más viejas. Usa la rueda trasera de cada lado, deja una huella cada 0.3 m y la apoya sobre el terreno con `heightAt`.
  - **Polvo:** una reserva de unos 150 sprites con una textura difusa generada en canvas. Las partículas nacen en las ruedas, suben, crecen y se desvanecen en unos 1.5 s, con el color del cielo marciano.
- **Conexión en `main.js`:** se llama desde `drive()` solo cuando el rover se mueve. Si está bloqueado por una roca no deja huellas ni polvo.

## Avance

- [x] Paso 1: crear `effects.js` (huellas + polvo)
- [x] Paso 2: huellas conectadas en `main.js`, hechas continuas (marca cada 0.15 m, hasta 4000 marcas). El **polvo** también está conectado (ver "Cierre de pendientes").
- [x] Paso 3: las huellas se apoyan en el terreno con su inclinación (normal calculada con `heightAt`)
- [x] Verificación en el navegador (huellas continuas detrás del modelo NASA)

---

# Extensión: toma de muestras de rocas y objetos

## Contexto

La misión real del Perseverance es **recolectar muestras** de roca en tubos sellados para que algún día vuelvan a la Tierra. Lleva 43 tubos. Esta extensión convierte la simulación en un pequeño juego de exploración: hay que acercarse a rocas y objetos, desplegar el brazo robótico y tomar muestras.

## Enfoque

- **Rocas con tipo** (en `terrain.js`): cada roca es basalto, arenisca, arcilla o carbonato, y no se sabe cuál hasta tomar la muestra.
- **Objetos especiales** para encontrar: meteoritos metálicos y restos de la nave de aterrizaje.
- **Brazo articulado** (en `rover.js`): hombro, codo y torreta con taladro. Apunta solo a la roca usando cinemática inversa de 2 segmentos (ley de cosenos).
- **Módulo `sampling.js`**: detecta qué hay al alcance del brazo, lo marca con un anillo y ejecuta la secuencia desplegar → taladrar → guardar el brazo.
- **Tecla E** para tomar la muestra con el rover detenido. Mientras el brazo trabaja no se puede manejar.
- **Interfaz**: contador "Muestras n / 43", aviso cuando hay algo al alcance, mensaje con el tipo de muestra y un dato curioso, y lista de las últimas muestras.

## Avance

- [x] Rocas con tipo + meteoritos + restos de la nave (+ una roca de práctica y un meteorito cerca del inicio)
- [x] Brazo articulado con cinemática inversa (en el rover simple; con el modelo NASA el brazo animado no se ve, ver abajo)
- [x] Lógica de muestreo (`sampling.js`)
- [x] Interfaz (contador, aviso, mensaje, lista)
- [x] Verificación en el navegador: aviso a 3.1 m de la roca de práctica, E → "Muestra #1: Arenisca", el rover no se mueve mientras el brazo trabaja

---

# Extensión: modelo oficial de la NASA

## Instrucción

> Descargar el modelo 3D oficial de Perseverance de la NASA en `public/models/`. Ponerlo a tamaño real sobre el terreno, que se maneje con WASD, que deje huellas y que la cámara lo siga. En la consola, escribir los nombres de las piezas que son cámaras (las usaremos al final).

## Lo que se hizo

- **Descarga:** `public/models/perseverance.glb` (5 MB) desde el repositorio `nasa/NASA-3D-Resources`.
- **`model.js`:** carga el GLB con `GLTFLoader` + `DRACOLoader`, porque el modelo viene comprimido con Draco.
- **Tamaño real:** el modelo ya viene en metros (2.7 m de ancho, 1.85 m de alto con el mástil plegado y 3.1 m de largo), así que no se escala. Solo se centra y se apoya sobre y = 0.
- **Orientación:** ya mira hacia +z, igual que nuestro rover (el RTG queda en z = −1.07 y las Hazcams delanteras en z = +1.15).
- **Integración:** el modelo se agrega dentro de `rover.group` y el rover simple se oculta. Así la conducción WASD, la inclinación, las colisiones, la cámara que sigue al rover, las huellas y las muestras funcionan sin cambios. Si el modelo no carga, se sigue viendo el rover simple.
- **Colisión:** el radio subió a 1.5 m porque el modelo real es más grande.

## Piezas que son cámaras (se imprimen en la consola con `console.table`)

| Pieza en el modelo | Qué es |
|---|---|
| `Mastcam_Z_cams` | Mastcam-Z: las dos cámaras "ojos" con zoom, en la cabeza del mástil |
| `NavCams` | Cámaras de navegación, también en el mástil |
| `lens` | Lente en la cabeza del mástil (probablemente SuperCam, por su posición) |
| `hazcams_front` | Cámaras de obstáculos delanteras |
| `hazcams_rear` | Cámaras de obstáculos traseras |
| `WATSON` | Cámara de primer plano en la torreta del brazo |
| `Up_Look_Camera` | Cámara que mira hacia arriba |
| `Down_Look_Camera` | Cámara que mira hacia abajo |

Quedan guardadas en `rover.cameraParts` (nombre → objeto 3D) para usarlas al final.

## Pendiente / notas

- ~~El mástil viene plegado~~ **Resuelto:** se despliega con su propia animación (ver "Cierre de pendientes").
- ~~Las ruedas del modelo son un solo objeto~~ **Resuelto (física de llantas):**
  - `splitWheels()` en `model.js` separa `Wheels_objs` (3 mallas con las 6 llantas fundidas) en 6 llantas. Agrupa los triángulos por lado (signo de x) y por eje (k-means sobre z). Radio medido: 0.263 m, que coincide con los 52.5 cm de diámetro reales.
  - Cada llanta gira según la distancia recorrida, con distinta velocidad por lado al doblar.
  - `placeOnTerrain()` apoya el rover en sus **6 puntos de contacto reales**, con un plano por mínimos cuadrados que da la altura, el pitch y el roll.
  - Las huellas salen de la posición real de las llantas traseras.
  - ~~Pendiente: articular la suspensión rocker-bogie~~ **Resuelto** (ver "Cierre de pendientes").
- ~~El brazo del modelo no se anima~~ **Resuelto** con cinemática inversa sobre `arm003`/`arm002`/`arm`/`arm004` (ver "Cierre de pendientes").

---

# Investigación: Open MCT (software de control de misión de la NASA)

- Clonado en `/Users/lilseniorj/Developer/openmct`, sin instalar ni modificar nada.
- Dos subagentes en paralelo mapearon la arquitectura y siguieron el viaje de un dato de telemetría.
- **Patrón clave aprendido:**
  - Cada dato declara **metadatos**: key, nombre, unidad y pistas (`domain` para el tiempo, `range` para el valor).
  - Los **proveedores** se registran con `openmct.telemetry.addProvider(...)` (`src/api/telemetry/TelemetryAPI.js:167`) y dicen qué pueden servir con `supportsRequest`/`request` (historial, una Promise) y `supportsSubscribe`/`subscribe` (en vivo, devuelve cómo desuscribirse).
  - La gráfica (`src/plugins/plot/configuration/PlotSeries.js`) pide el historial y además se suscribe a lo que llega en vivo.
- **Artefacto:** `mapa-del-repo.html`, publicado en https://claude.ai/artifact/UsHXB5f1ETpCczVTnUSF69. Es privado hasta que se comparta desde el menú Compartir.
  - Contenido: una frase que lo explica, un diagrama de cajas y flechas con archivo:línea en cada caja, las 5 piezas clave y la sección "Cómo conectamos Percy" (tabla Open MCT ↔ `mission-control.js` y el plugin real `openmct-percy-plugin.js`, probado con un openmct simulado; versión 2 del artefacto).
  - Verificación: se leyeron en el código las 20 referencias citadas y se abrieron 3 al azar con su contexto (`example/generator/plugin.js:166`, `ViewRegistry.js:77`, `PlotSeries.js:436`); todas coinciden.

# Pedido 5: control de misión dentro del juego

## Qué es

Un panel "CONTROL DE MISIÓN" a la derecha de la pantalla, que se oculta y muestra con la **tecla T**. Usa el patrón de Open MCT: cada dato tiene nombre, unidad y proveedor, y los proveedores implementan `supportsRequest`/`request` y `supportsSubscribe`/`subscribe`.

| Dato | Proveedor | Valor (24-oct-2026) |
|---|---|---|
| Distancia recorrida | NASA · `M20_waypoints.json` (campo `dist_total_m`) | 45.22 km (sol 2009) |
| Altura del terreno | NASA · `M20_waypoints.json` (`elev_geoid`) | −1937 m (subió 632 m desde el aterrizaje) |
| Inclinación | NASA · `M20_waypoints.json` (`tilt`) | 9.6° (máximo de la misión: 20.7°) |
| Tiempo de luz Tierra → Marte | Cálculo en vivo (órbitas aproximadas de JPL), se actualiza cada segundo | ~12 min 23 s |

Cada dato muestra su valor, una gráfica de toda la misión (eje en sols) y una frase simple que explica qué significa.

## Archivos

- `mission-control.js`: metadatos, proveedores, mini TelemetryAPI e interfaz (gráficas en canvas).
- `ephemeris.js`: posiciones de la Tierra y Marte con los elementos orbitales de JPL, tiempo de luz y conversión fecha ↔ sol.
  - Validado: al aterrizar da **11 min 22 s**, el valor real.
  - En la oposición de 2020 da 3 min 29 s, contra unos 3 min 27 s reales.
- `package.json` + `scripts/check.mjs`: el comando `npm run check`, sin dependencias.

## Notas sobre los datos de la NASA

- El JSON permite CORS (`access-control-allow-origin: *`), así que se lee en vivo desde el navegador.
- Las 131 localizaciones "a mitad de manejo" traen `dist_total_m = 0` como relleno. Para la distancia se usan solo los puntos con distancia mayor que 0, y así la serie siempre crece.

## `npm run check`

- **Sin dependencias:** usa el `http` y el `WebSocket` de Node y el Chrome ya instalado, sin ventana, controlado por el protocolo de DevTools.
- **Qué revisa:**
  1. La sintaxis de todos los módulos.
  2. Que los 4 datos carguen con estado `ok` y un valor dentro de un rango creíble.
  3. Que la tecla T oculte y muestre el panel.
  4. Que la consola no tenga errores.
- **Probado con sabotaje:** un `console.error` agregado a propósito hace que el chequeo falle.
- **Ícono:** se agregó `<link rel="icon" href="data:,">` para que el 404 de `favicon.ico` no ensucie la consola.

# Pedido 6: las cámaras de Percy toman fotos reales de Marte

## Qué hace

- **4 puntos azules que brillan** sobre las piezas reales del modelo de la NASA: `Mastcam_Z_cams`, `NavCams`, `hazcams_front` y `WATSON`. Al pasar el mouse muestran el nombre y para qué sirve cada cámara.
- **Al hacer clic:**
  1. Se cierra el obturador y salta un flash.
  2. La foto se revela poco a poco: de blanca y borrosa a nítida y a color, en unos 2.6 s.
  3. Queda quieta, grande y fácil de ver. Clic para ampliar (×2.2 donde hiciste clic), ← → para ver más fotos de esa cámara, Esc para volver al juego.
- **Cada foto dice** la cámara, el sol, hace cuántos días se tomó (calculado al momento con `date_taken_utc`), cuál es de cuántas y una frase de qué se ve.
- **Con el visor abierto**, las flechas no mueven el rover.

## Cómo se eligieron las fotos (19 en total, sols 2009–2018)

- **Fuente:** API `raw_images` de la NASA, con CORS abierto. Se pidieron 300 fotos recientes por cámara.
- **Filtros automáticos:**
  - Solo cuadros completos: fuera las miniaturas y las tiras de panorámica.
  - Mastcam-Z solo con filtros `RGB`: fuera los de banda angosta y los `ND`, que son para fotografiar el sol.
  - WATSON solo con prefijo `SIF`, el único a color; los `SI1` y `SI3` son en blanco y negro.
  - Máximo 3 fotos por secuencia, para que haya variedad.
  - Saturación de color medida con `sips`, la herramienta de macOS, sin instalar nada.
- **Revisión a mano:** todas las candidatas se miraron en hojas de contactos numeradas.
  - Se descartaron: el sol (N3), el cielo vacío (N4, N5), el blanco de calibración (M5), las fotos casi negras (M4, M6), las piezas del rover sin paisaje (M0, M1) y las fotos de WATSON teñidas de azul por la luz ultravioleta (W0, W21).
- **Elegidas:** horizontes, el brazo sobre el suelo, ruedas junto a rocas, huellas en la arena y abrasiones vistas de cerca.
- Las fotos y sus pies están en `photos.js`. Se cargan directo desde mars.nasa.gov, sin copias locales.

## Archivos

- `photos.js`: las fotos elegidas y los datos de cada cámara.
- `camera-photos.js`: los puntos sobre el modelo (proyectados en cada cuadro y separados si se enciman) y el visor.
- `scripts/check.mjs`: la sección nueva del chequeo.

## `npm run check` (ampliado)

- Hace **clic real con el mouse**, por el protocolo de DevTools, en cada uno de los 4 puntos.
- Espera a que la foto termine de revelarse y confirma que es una imagen real de `mars.nasa.gov/mars2020-raw-images/`.
- Guarda la captura con la foto abierta en `check-output/foto-<cámara>.png`.
- También prueba que → cambia de foto y que Esc cierra el visor.

---

# Cierre de pendientes y limpieza (25-oct-2026)

Trabajo hecho sin supervisión, con un commit y un push por cada punto. Ningún commit se subió sin que `npm run check` pasara, salvo `9e1e4a8`, que se corrigió en `8a07a37`; está explicado abajo.

| Pendiente | Qué se hizo | Cómo se comprobó |
|---|---|---|
| Mástil plegado y vista C | El modelo traía la animación `CylinderAction`, que levanta el mástil entre 0 y 5 s. Se congela en el segundo 7.5, con la Mastcam-Z a 1.97 m. La vista C sale de `Mastcam_Z_cams`. | Capturas de costado y desde la vista C |
| Polvo | `createDust` conectado: sale de las ruedas traseras hacia atrás según el sentido de marcha y se asienta solo. | Captura en marcha atrás |
| Brazo al tomar muestras | La animación incluida levanta el brazo en vez de bajarlo, así que no sirve. `nasa-arm.js` resuelve la cinemática inversa sobre las 4 articulaciones reales: los ejes se leen de sus animaciones y un descenso de gradiente con 3 poses iniciales deja la punta del taladro sobre la roca con el taladro vertical. `sampling.js` usa un `armDriver` común para el brazo simple y el de la NASA, y solo vuelve a buscar cuando el rover se mueve. | Captura de frente: brazo extendido sobre la roca y "Muestra #1" |
| Suspensión rocker-bogie | `articulateSuspension()` corta la pieza `suspension` en rocker y bogie de cada lado. Los pivotes se midieron en una vista lateral con cuadrícula de 10 cm. Las llantas cuelgan de su pieza y, en cada cuadro, lo que cada una queda sobre o bajo el plano del cuerpo se reparte entre los dos ángulos por mínimos cuadrados (máximo ±0.35 rad). | Render de costado con colores por pieza, en reposo y articulada (delantera +15 cm, trasera −10 cm) |
| Fotos fijas | `npm run fotos` baja las candidatas recientes con los mismos filtros, arma `fotos-candidatas.html` para mirarlas y `npm run fotos -- escribir` regenera `photos.js` con las elegidas en `fotos-elegidas.json`. La elección sigue siendo humana, como pedía el pedido 6. | Ciclo completo probado y `photos.js` original restaurado |
| Plugin de Open MCT sin probar | Ahora es un archivo real, `openmct-percy-plugin.js`, con una prueba de contrato (`scripts/test-percy-plugin.mjs`) usando un openmct simulado. Es el paso 2 de `npm run check`. | 11 comprobaciones con datos reales. Sabotaje: con el orden invertido falla. **Aún no probado dentro de Open MCT real** (requeriría instalar sus dependencias). |
| `check` dependía de Chrome en macOS | Busca `CHROME_PATH`, Chrome o Chromium en macOS y Linux, y avisa claro si no hay ninguno. Sigue necesitando internet para los datos reales. | — |

## Bugs encontrados en el camino

- **Puntos de cámara en la esquina:** al crearse aparecían un instante en (0, 0). Ahora nacen ocultos, y el chequeo espera dos lecturas iguales antes de hacer clic.
- **El punto escapaba del mouse:** el agrandado con `scale` también multiplicaba el `transform: translate` que lo ubica, así que el punto se alejaba del cursor y el clic caía en el canvas. Se ubica con la propiedad `translate`.
  - Esto causó el commit `9e1e4a8` con el chequeo fallando: un `grep` en la cadena de comandos dejó pasar el commit. Desde entonces se usa `if npm run check; then commit`.

## Limpieza antes de compartir

- **Borrado:** `.playwright-mcp/` (capturas y páginas de prueba) y `check-output/` (se vuelve a generar con `npm run check`).
- **En `.gitignore`:** esas dos carpetas, `.vscode/` y los archivos de trabajo de `npm run fotos`.
- **Servidores de prueba detenidos.**
- **Pendiente del dueño:** compartir el artefacto de Open MCT desde su menú Compartir; hasta entonces es privado.
