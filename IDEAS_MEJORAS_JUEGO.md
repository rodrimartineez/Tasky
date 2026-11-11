# Mejoras del juego: propuestas y plan de desarrollo

El usuario **aprobó todas las propuestas** el 11 de noviembre de 2026, con una condición: no se implementan de golpe.
Se hacen por fases, en el orden de este plan, y cada fase se valida antes de empezar la siguiente.
Las propuestas nuevas que surjan se añaden como 🟡 y no se implementan hasta que el usuario las apruebe.

Estado: ✅ aprobada (pendiente) · 🔨 en curso · ✔️ hecha y validada · 🟡 propuesta nueva (pendiente de aprobación).

---

## 1. Principio de diseño: el juego existe para motivar los hábitos

Esto pesa más que cualquier otra decisión de diseño. Toda mecánica nueva se comprueba con estas reglas:

1. **Los hábitos son la vía principal de progreso permanente.** Los puntos, y por tanto las mejoras permanentes
   del personaje, salen *solo* de cumplir hábitos. Ni el oro, ni los logros, ni jugar mucho dan poder permanente.
2. **Jugar siempre está permitido y siempre aporta algo:** oro, desbloqueos de contenido, niveles y récords.
   Ninguna mecánica bloquea el juego por no cumplir hábitos.
3. **La diferencia tiene que notarse, sobre todo a largo plazo.** Quien cumple sus hábitos sobrevive más, gana más
   oro (porque llega más lejos) y desbloquea antes. Quien no los cumple sigue jugando, pero avanza claramente más
   despacio y va notando que los enemigos le alcanzan.
4. **Fallar nunca es irreversible.** Lo comprado no se pierde nunca, las rachas se recuperan en días y volver tras
   una pausa larga es viable (`ANALISIS_ECONOMIA.md` §6). Puede haber ayudas para volver, pero solo dentro de la
   partida y nunca en forma de puntos.
5. **El vínculo hábito → juego tiene que verse a diario.** El jugador debe saber cada día qué le dará cumplir hoy
   («+4 puntos → te faltan 3 para Poder nivel 8»), no solo verlo en un saldo.
6. **Ninguna mecánica se añade por añadir.** Cada una aporta a las builds, la progresión, la dificultad, la
   economía o la experiencia del jugador, y se valida con el estudio de equilibrio.

### El ciclo que debe sentirse siempre

1. **Cumples hábitos → consigues puntos.**
2. **Consigues puntos → mejoras tu personaje.**
3. **Mejoras tu personaje → sobrevives más** y puedes afrontar niveles más difíciles.
4. **Juegas → consigues oro** y desbloqueas personajes, armas y escenarios.
5. **Descubres combinaciones nuevas → tienes nuevos objetivos** para seguir jugando y manteniendo tus hábitos.

Cada fase dice qué eslabón refuerza, y ninguna mecánica puede saltarse el primero: no hay atajo hacia el paso 2 que
no pase por los hábitos.

### Cómo se mide (en cada fase que toque la economía o el combate)

El estudio de equilibrio (`src/habits/balance/`) se vuelve a ejecutar y tiene que seguir cumpliendo:

| Indicador | Objetivo | Valor actual (Fase 4) |
|---|---|---|
| Puntos a 1 año: perfil constante (95 %) frente a irregular (50 %) | entre 6× y 15× | 9,7× |
| Supervivencia del perfil constante | estable o al alza durante 3 años | 12–30 min, al alza |
| Supervivencia del perfil irregular | baja de forma visible, sin llegar a ser inútil | de 10–12 a 5–10 min |
| Oro por partida del irregular | nunca cero | 50–290 |
| Vuelta tras 90 días sin hábitos | las partidas no se hunden | se mantienen |
| Poder permanente que no sale de hábitos | ninguno | ninguno |

---

## 2. Plan por fases

El orden sigue el que ya habíamos acordado (Fase 5 contenido → Fase 6 PWA y rendimiento → validación), con la fase
de rediseño visual (pedida el 11/11/2026) entre el rendimiento y la validación global.
Las propuestas se reparten en ese orden: antes, lo que afecta a la motivación y a las builds; después, el arte, que
conviene dibujar una sola vez sobre un contenido ya cerrado.

| Fase | Contenido | Propuestas | Depende de | Prioridad |
|---|---|---|---|---|
| **5 — Contenido** ✔️ | 16 personajes, 5 escenarios, más armas, pasivas y enemigos, 5+5 huecos | A5, B2 (parte) | Fase 4 | En curso |
| **5b — Motivación** ✔️ | Que se note cada día el vínculo hábito → juego; protección y ayudas sin regalar puntos | M1, D2, D3, D4, C4 | Fase 4 | **Máxima** (es el principio de diseño) |
| **5c — Builds** ✔️ | Evoluciones, resto de armas y pasivas, revivir/repetir/descartar | B1, B2 (resto), C1 | 5 | Alta |
| **5d — Progresión por niveles** ✔️ | Intentos ganados con hábitos, nivel solo al superar 30 min, La Muerte, 10 jefes de ciclo cada 7 niveles, hitos (×1,5/×2, infinito, reflejo) | E1 (adelantada) | 5c | **Máxima** (pedida por el usuario) |
| **6 — PWA y rendimiento** | Precarga sin conexión, rendimiento en móvil | — | 5, 5c, 5d | Alta |
| **7 — Rediseño visual y artístico** | Efectos de armas, iconos y proyectiles, evoluciones, mapas con capas y ambiente, recogidas, enemigos, tienda | A1, A2, A3, C3 (ampliadas) | 6 | Alta |
| **8 — Validación global** | Estudio de equilibrio completo, prueba en iPhone, regresión de Proyectos | — | 5–7 | Hito: juego completo |
| **9 — Sonido** | Efectos y música originales | A4 | 7 | Media |
| **10 — Largo plazo** | Logros, estadísticas, usos del oro, arcanos | C2, E2, D1, B3 | 8 (D1 antes de ~1 año de uso) | Media-baja |

Por qué este orden:

- **5b va justo después de 5** porque es el corazón del objetivo y no depende del arte ni del contenido. Además,
  cuanto antes esté, antes se obtienen datos reales de uso para ajustar C4 y D3.
- **5c antes de 6:** las evoluciones y los efectos nuevos son la carga más pesada para el rendimiento. Optimizar
  antes sería trabajo repetido.
- **El arte (7) después del rendimiento (6) y antes de la validación (8):** se dibuja una sola vez sobre el
  contenido ya cerrado, cada cambio se mide con las herramientas de rendimiento de la Fase 6, y la validación final
  con iPhone real se hace sobre el juego tal como quedará.
- **D1 (usos del oro)** tiene fecha límite: debe estar antes de que un jugador constante lo tenga todo desbloqueado
  (~1 año, según `ANALISIS_ECONOMIA.md` §7).

### Reglas de progresión que respetan todas las fases (desde la 5d)

Definidas por el usuario el 11/11/2026; detalle en `HABITS_GUIDE.md` §11:
- Los intentos solo se ganan con hábitos (+1 por diario cumplido, +3 por semanal) y no caducan. Cada partida gasta
  uno. Ninguna mecánica nueva puede dar intentos, puntos ni poder permanente por otra vía.
- El nivel solo sube al llegar al minuto 30 (La Muerte) en modalidad normal, y en los niveles de jefe (múltiplos de
  7) además venciendo al jefe. Morir no quita nada; el oro se conserva siempre.
- La dificultad de cada nivel sigue la frontera medida de un jugador constante (~1 nivel al día jugando 2 intentos).
  Todo lo que cambie el poder del jugador o de los enemigos obliga a repetir los estudios de frontera y progresión
  (`ANALISIS_ECONOMIA.md` §11).
- Infinito y reflejo nunca cambian el nivel; el modo de pruebas debe poder probar cualquier nivel, jefe y modalidad.

### Requisitos para pasar de fase (en todas)

- `tsc`, `eslint`, todos los tests y `npm run build` en verde. Proyectos sin cambios de comportamiento.
- Prueba en el navegador (escritorio y móvil de 375 px) de cada pantalla tocada, con el perfil sin conexión
  (`tasky-web-offline`), sin datos reales.
- Si la fase toca la economía o el combate: estudio de equilibrio repetido y tabla del §1 actualizada en
  `ANALISIS_ECONOMIA.md`.
- `HABITS_GUIDE.md` §9 y este documento actualizados, con el estado real de cada propuesta. Limpieza de código
  sin usar. Commit propio y validación del usuario antes de seguir.

---

## 3. Detalle por fase

### Fase 5 — Contenido ✔️
- **Propuestas:** A5 (5 huecos de arma y 5 de pasiva, arriba a la izquierda, más grandes) y parte de B2.
- **Validación:** cada personaje con su sprite y su arma inicial, cada escenario jugable 2 minutos con el bot sin
  errores, ninguna arma nueva por encima de ~2× la mejor existente y los huecos legibles en móvil.
- **Riesgo para el principio:** pasar de 6+6 a 5+5 huecos baja la potencia máxima. Si el perfil normal pierde
  supervivencia, se compensa con la dificultad (nunca regalando puntos).

### Fase 5b — Motivación (prioridad máxima) ✔️

Hecha y verificada (tests y navegador); resultados del estudio en `ANALISIS_ECONOMIA.md` §9. Pendiente de la
validación del usuario y de una decisión: el escudo da al perfil normal un +24 % de puntos (objetivo < 10 %).
| Id | Qué se hace | Cómo se valida |
|---|---|---|
| **M1** | Puente hábito → juego visible (eslabones 1–3 del ciclo): en «Hábitos» y en el campamento se ve lo que dará cumplir hoy (puntos según racha), el próximo hito de racha y la mejora más cercana que se podrá comprar. Al cerrar el día, aviso «+N puntos: ya puedes mejorar X». | Tests de los cálculos y prueba en el navegador simulando el cambio de día |
| D2 | Racha de hábitos semanales: +1 punto por cada 4 semanas seguidas, con un tope bajo | Tests en `rewards.ts`; no reescribe recompensas pasadas |
| D3 | Escudo de racha: se gana **uno cada 21 días seguidos de racha** de un hábito diario (máximo uno guardado por hábito) y protege un día fallado de ese hábito: la racha no se rompe, aunque ese día no da puntos | Tests de racha con escudo, también entre dos dispositivos; el estudio muestra que el perfil normal gana poco (< 10 %) |
| D4 | Límite contra hábitos inflados: a partir del 8.º diario activo, los adicionales dan la mitad | Tests; sin efecto con ≤ 7 hábitos |
| C4 | Ayuda de vuelta (ver detalle abajo) | El estudio de «abandona y vuelve» mejora sin tocar los puntos; el perfil que vuelve sigue por debajo del que nunca lo dejó; la regla 1 del §1 se cumple |

**Ayuda de vuelta (C4), decidida con el usuario:**
- **Se activa** tras **14 días seguidos sin cumplir ningún hábito**.
- **Es gradual:** crece poco a poco con la duración de la pausa (a partir del día 14 y con un tope hacia los 60 días)
  y, al volver, se va retirando partida a partida en lugar de desaparecer de golpe.
- **Es temporal:** solo dura unas pocas partidas tras la vuelta. Deja de reforzarse en cuanto se vuelven a cumplir
  hábitos, y se pierde del todo tras una semana de constancia o al acabarse esas partidas.
- **Solo dentro de la partida:** por ejemplo, más experiencia y algo de vida extra. Nunca puntos, oro extra
  permanente ni mejoras.
- **No compensa la falta de constancia:** como mucho cubre una parte (objetivo: menos de la mitad) de la diferencia
  de supervivencia entre quien lo dejó y quien no. Los números exactos se ajustan con el estudio y se revisan con
  el usuario antes de cerrar la fase.
- **Riesgo:** D3 y C4 suavizan el castigo. Si el cociente constante/irregular baja de 6×, se reducen.

### Fase 5c — Builds ✔️ (pendiente de tu validación)

**Primer paso:** reequilibrar la dificultad y el oro, porque con el contenido de la Fase 5 el juego se ha vuelto
mucho más fácil para los perfiles constante y normal (`ANALISIS_ECONOMIA.md` §9).
| Id | Qué se hace | Cómo se valida |
|---|---|---|
| B1 | Evoluciones: arma al nivel máximo + pasiva concreta → versión evolucionada al abrir un cofre | Test por evolución (se ofrece solo con la combinación correcta); estudio de dificultad repetido, ya que suben la potencia a partir del minuto 10–15 |
| B2 | Resto de armas y pasivas hasta ~16 + 14, con sinergias claras (cada pasiva sirve a varias armas) | Bot de 5 min por arma; ningún arma dominante ni inútil (cada una entre 0,5× y 2× de la media) |
| C1 | Revivir, Repetir elección y Descartar como mejoras permanentes **compradas con puntos de hábitos** (revivir con coste muy alto y máximo pequeño, excepción aprobada a «sin máximo») | Tests de economía; el estudio comprueba que revivir no rompe la curva |

- **Encaje con el principio:** C1 refuerza los hábitos, porque son mejoras muy deseables y solo se consiguen con puntos.

**Añadido a la 5c por petición del usuario (11/11/2026):**
- **Modo de pruebas** (`src/habits/core/release.ts`, `GAME_RELEASE.testMode`): partidas ilimitadas, siempre de nivel 1,
  todo desbloqueado y el oro no se guarda. Al pasar a producción se desactiva y se abre una temporada nueva
  (`HABITS_GUIDE.md` §10): la progresión de partidas y el oro empiezan de cero sin tocar hábitos, puntos ni mejoras.
- **Compatibilidad móvil:** cadena de motores gráficos (WebGL → WebGL ligero → canvas), resolución máxima ×2,
  recarga automática si tras un despliegue falta un trozo de código antiguo, y mensaje de error con el detalle y
  «Recargar y reintentar» en lugar del aviso genérico.
- **Escudo más escaso:** uno cada **60 días** (antes 21) y el día salvado ya no cuenta para el siguiente
  (`ANALISIS_ECONOMIA.md` §10).
- **Economía de oro a varios años:** precios de 300 a 400 000 en personajes normales, escenarios hasta 150 000 y
  4 **legendarios** con habilidades propias (Fénix 750 000, Coleccionista 1,5 M, Cronomante 4 M, Sol Eterno 10 M).
  Bonificación de oro por sobrevivir más de 10 minutos que crece con el nivel. El oro sigue sin comprar estadísticas.
  El campamento muestra el próximo objetivo y cuántas partidas faltan.

**Cambios previos a la Fase 6 (pedidos el 11/11/2026)** ✔️:
- **Selector del modo de pruebas** (herramienta de desarrollo): interruptor en el campamento que activa o desactiva
  el modo de pruebas en el momento, en cada dispositivo. Detalle y paso a producción en `HABITS_GUIDE.md` §10.
- **Apartado «Catálogo»**: quinta pestaña con todas las armas, pasivas y evoluciones, generada desde las
  definiciones del juego (`game/content/catalog.ts`), así que lo nuevo aparece solo.
- **Cabecera en móvil**: opaca y sin desenfoque (Safari ya no la sombrea bajo la barra de estado), con separación
  propia bajo la zona segura y `theme-color` igual a la cabecera mientras Hábitos está abierto.

### Fase 5d — Progresión por niveles ✔️ (pendiente de tu validación)
- Intentos ganados con hábitos, niveles que solo suben al superar los 30 minutos, La Muerte, ciclos de 7 niveles con
  10 jefes en rotación que escalan por vueltas, hitos de los niveles 20, 30 y 60, y modo de pruebas adaptado.
- Curva de dificultad y oro reajustados con dos estudios nuevos (frontera y progresión) y uno de jefes.
- **E1** (velocidad ×1,5 y ×2) queda hecha aquí, como hito del nivel 20.

### Fase 6 — PWA y rendimiento
- Lo ya previsto: precarga del juego para jugar sin conexión, rendimiento en móviles de gama media (objetivo:
  60 fps con 400 enemigos) y partidas largas sin fugas de memoria. Ahora también el modo infinito (partidas sin fin)
  y los jefes de ciclo (muchos proyectiles a la vez).
- Medido al empezar (11/11/2026): la precarga ya incluye el juego y la simulación cuesta 0,35 ms por paso de media
  con 424 enemigos (5 ms en el peor caso), así que el trabajo pendiente es sobre todo de dibujo en móvil.

### Fase 7 — Rediseño visual y artístico (amplía la antigua «Arte y sensación»)

Pedida por el usuario el 11/11/2026. Integra A1, A2, A3 y C3, que ya estaban aprobadas, y las amplía. Se coloca
**después de la Fase 6** porque esa fase deja la medición de rendimiento en móvil (fps, partículas, memoria) con la
que se controla cada cambio de esta. Va **antes de la validación global** para que esa validación, con iPhone real,
rendimiento y sincronización, se haga sobre el arte definitivo y no haya que repetirla. El contenido jugable ya está
cerrado tras la 5c, así que el arte se dibuja una sola vez.

**Análisis del estado actual** (medido en `game/sprites`):

| Elemento | Hoy | Problema | Prioridad |
|---|---|---|---|
| Efectos de armas (impactos, explosiones, rayos, áreas, estelas) | Círculos y rectángulos teñidos de un solo color | Es lo que más se ve y lo que menos satisface; las armas se confunden entre sí | **1** |
| Iconos de armas, evoluciones y mejoras | 8–10 px (más pequeños que los personajes, de 12×14) | Siluetas poco reconocibles en el HUD, al subir de nivel y en el catálogo; las evoluciones apenas se distinguen de su base | **1** |
| Proyectiles | 3–9 px, casi sin animación | Poca personalidad; no se lee la dirección ni el elemento | **1** |
| Mapas | Una baldosa de suelo por escenario y 4–5 adornos de 5–13 px | Suelo repetitivo, sin capas, sin luz ni ambiente; los mundos se parecen | **2** |
| Recogidas (A3) | Gemas y monedas sin arco ni cadena | Falta la sensación incremental | **2** |
| Enemigos | 10–12 px, 2 fotogramas; jefes de 24 | Correctos pero planos; algunos se confunden con el suelo | **3** (solo los que lo necesiten) |
| Tienda de mejoras (C3) | Lista estática | Comprar no se celebra | **3** |

**Dirección artística** (se fija antes de dibujar y se aplica a todo):
- Referencia: los personajes actuales, con contorno oscuro de 1 px, luz desde arriba a la izquierda y 2 o 3 tonos
  por material. No se cambian.
- Rejilla: iconos a 16×16, proyectiles de 6 a 12 px, adornos de 8 a 24 px y jefes de 32 px o más. Más tamaño solo
  donde mejora la silueta, no por añadir píxeles.
- Paleta limitada por escenario y un color de elemento por familia de armas (fuego, rayo, arcano, veneno, acero),
  para que cada arma se reconozca por la forma y por el color.
- Efectos por fases (anticipación → impacto → disipación), con mezcla aditiva en brillos, a pocos fotogramas y en
  pixel art: nada de degradados suaves que choquen con el estilo.

| Orden | Id | Qué se hace | Cómo se valida |
|---|---|---|---|
| 7.1 | — | Guía de estilo: paleta, rejilla y una hoja de muestra con un arma completa (icono, proyectil, impacto y evolución) | Revisión visual con el usuario **antes de seguir** |
| 7.2 | A2 | Efectos de todas las armas: impactos, explosiones por fases, rayos con ramificación animada, áreas con borde y pulso, estelas, golpes críticos | Medición de rendimiento de la Fase 6 en móvil (objetivo sin cambios); revisión en partida real |
| 7.3 | A2 | Iconos y proyectiles nuevos de las 16 armas, y versiones de evolución claramente superiores (marco, brillo y forma ampliada); iconos de pasivas y mejoras | Catálogo y HUD en escritorio y móvil; test de que todo icono existe |
| 7.4 | A1 | Mapas: suelo por capas con variaciones (baldosas mezcladas sin repetición visible), adornos grandes y pequeños, luz y sombra, partículas de ambiente propias de cada mundo (hojas, niebla, polvo de cristal, ceniza) | Primero un escenario completo como guía y revisión con el usuario; después el resto; rendimiento en móvil |
| 7.5 | A3 | Recogidas: arco de vuelo, chispa, cadena de recogidas, cofre con lluvia de monedas | Revisión en partida real |
| 7.6 | A1 | Enemigos que lo necesiten: mejor silueta y contraste con el suelo, 3–4 fotogramas, aviso visual antes de atacar. **Jefes de ciclo y La Muerte**: hoy son 5 siluetas recoloreadas; cada jefe necesita diseño propio, aviso de cada ataque y una entrada de La Muerte a la altura | Comparación lado a lado con los personajes |
| 7.7 | C3 | Tienda incremental: animación al comprar y efecto previsto en números reales | Navegador y móvil |

- **Rendimiento:** todo sigue en un único atlas (las texturas no se multiplican); las partículas tienen tope y
  bajan solas si el móvil no llega a los fps objetivo. Ningún efecto cambia la simulación: el equilibrio no varía.
- **Riesgo:** el estilo es subjetivo. Por eso se valida en 7.1 y tras el primer escenario de 7.4, antes de rehacer
  el resto.

### Fase 8 — Validación global (hito)
- Estudio completo de 3 años con todos los perfiles y la tabla del §1 actualizada: frontera, progresión y jefes
  (`ANALISIS_ECONOMIA.md` §11). Calibrar el bot con partidas reales del usuario (¿un jugador real supera más o menos
  que el bot en la misma dureza?) y reajustar la curva si hace falta.
- Prueba en un iPhone real (PWA instalada), en el escritorio (Tauri) y en el navegador. Sincronización entre dos
  dispositivos (compras, partidas y escudos).
- Regresión completa del modo Proyectos y del servidor MCP.

### Fase 9 — Sonido
- **A4:** efectos y música originales por escenario, volumen y silencio. En el móvil, silencio por defecto.

### Fase 10 — Largo plazo
| Id | Qué se hace | Regla de diseño |
|---|---|---|
| C2 | Logros (de juego y de hábitos, p. ej. «100 días de racha») | Recompensas cosméticas o de contenido, nunca puntos ni poder permanente |
| E2 | Estadísticas y récords por personaje y escenario | Los datos ya están en el ledger (`details` de cada resultado) |
| D1 | Usos del oro cuando todo esté desbloqueado: aspectos, decoración del campamento, escenarios de desafío | El oro nunca compra poder permanente |
| B3 | Arcanos: modificadores elegidos al empezar la partida (más riesgo y más oro, comportamientos nuevos) | Se desbloquean con oro; afectan solo a esa partida |

---

## 4. Catálogo de propuestas

### A. Gráficos y sensación de juego
- **A1. Rediseño del pixel art** ✅ (Fase 7). Más fotogramas y sprites de 16–24 px, escenarios con suelo por capas.
  Aporta calidad visual. Equilibrio: ninguno.
- **A2. Armas, proyectiles y efectos elaborados** ✅ (Fase 7). Rayos, láseres, explosiones y estelas, con mezcla
  aditiva. Aporta que cada arma se distinga y que subirla de nivel se vea. Equilibrio: ninguno; vigilar el rendimiento.
- **A3. Recogidas muy satisfactorias** ✅ (Fase 7). Gemas que saltan y vuelan en arco, cadenas de recogida y lluvia
  de monedas. Aporta la sensación incremental. Equilibrio: ninguno.
- **A4. Sonido y música** ✅ (Fase 9). Originales, con control de volumen. Equilibrio: ninguno.
- **A5. HUD de 5 armas + 5 pasivas** ✔️ (Fase 5). Huecos grandes arriba a la izquierda. Equilibrio: baja un poco
  la potencia máxima de una partida.

### B. Contenido y builds
- **B1. Evoluciones de armas** ✅ (Fase 5c). Dan objetivos dentro de la partida. Equilibrio: más potencia a mitad de
  partida, a compensar con la dificultad.
- **B2. Hasta ~16 armas y ~14 pasivas** ✔️ parte en la Fase 5 (13 armas, 12 pasivas), resto ✅ en la 5c. Aportan builds variadas.
  Equilibrio: más opciones diluyen la suerte (se compensa con C1).
- **B3. Arcanos** ✅ (Fase 10). Variedad a largo plazo y sumidero de oro. Afectan solo a la partida.

### C. Progresión e incremental
- **C1. Revivir, Repetir y Descartar** ✅ (Fase 5c). Mejoras permanentes con puntos de hábitos. Revivir con
  máximo pequeño.
- **C2. Logros** ✅ (Fase 10). Objetivos a medio plazo. Recompensas sin poder permanente.
- **C3. Tienda incremental** ✅ (Fase 7). Hace satisfactorio gastar puntos.
- **C4. Ayuda de vuelta tras inactividad** ✔️ (Fase 5b). Se activa tras 14 días sin cumplir ningún hábito; es gradual y temporal, solo dentro de la partida y nunca en puntos.

### D. Economía
- **D1. Usos del oro** ✅ (Fase 10, antes de ~1 año de uso). El oro sigue sirviendo, sin dar poder permanente.
- **D2. Racha de hábitos semanales** ✔️ (Fase 5b). +1 punto cada 4 semanas seguidas, con tope.
- **D3. Escudo de racha** ✔️ (Fase 5b; ajustado en la 5c). Uno cada 60 días de racha; protege un día fallado y ese día no cuenta para el siguiente.
- **D4. Límite contra hábitos inflados** ✔️ (Fase 5b). Los diarios a partir del 8.º dan la mitad.

### E. Calidad de vida
- **E1. Velocidad ×1,5 y ×2** ✔️ (Fase 5d, hito del nivel 20). Partidas más ágiles sin cambiar la simulación.
- **E2. Estadísticas y récords** ✅ (Fase 10). Seguimiento del progreso a largo plazo.

### M. Motivación
- **M1. Puente hábito → juego visible** ✔️ (Fase 5b, aprobada el 11/11/2026). Cada día muestra lo que dará cumplir los hábitos (puntos según racha,
  próximo hito) y qué mejora se podrá comprar con ello, y avisa al cerrar el día. **Problema que resuelve:** hoy
  el vínculo solo se ve en un saldo, y el principio de diseño pide que el jugador piense «necesito cumplir mis
  hábitos para mejorar». **Equilibrio:** ninguno (solo información). **Cuándo:** Fase 5b.
