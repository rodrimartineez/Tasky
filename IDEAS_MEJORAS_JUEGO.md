# Ideas y mejoras del juego (pendientes de aprobación)

Propuestas para el modo Hábitos y su videojuego. **Ninguna está implementada**: cada una necesita la aprobación
expresa del usuario. Cada propuesta indica qué es, qué problema resuelve o qué aporta, su efecto en el equilibrio y
la progresión, y cuándo tendría sentido abordarla.

Estado: 🟡 propuesta · ✅ aprobada · ❌ descartada (por el usuario).

---

## A. Gráficos y sensación de juego

### A1. Rediseño completo del pixel art 🟡
- **Qué:** personajes con más fotogramas (andar en 4 direcciones, golpe, muerte), enemigos con animación propia,
  escenarios con suelo por capas y decoración variada, sprites de 16–24 px en lugar de 8–12.
- **Aporta:** el juego actual es funcional pero visualmente sencillo; es lo que más impacto tiene en la sensación
  de calidad.
- **Equilibrio:** ninguno.
- **Cuándo:** después de la Fase 5 (cuando el contenido esté fijado, para no dibujar dos veces) y antes de la
  validación final, o como fase propia «Fase 5b: arte». Conviene hacerlo por escenario: un escenario completo
  rediseñado sirve de guía de estilo para el resto.

### A2. Armas, proyectiles y efectos elaborados 🟡
- **Qué:** rayos con brillo y ramificaciones, láseres con haz animado, explosiones por fases (destello, onda,
  humo), estelas en los proyectiles, mezcla aditiva para la luz, impactos con chispas según el arma. Sustituir los
  círculos simples (auras, áreas) por formas dibujadas (runas, llamas, anillos con textura).
- **Aporta:** que cada arma se distinga a primera vista y que subir de nivel un arma «se vea».
- **Equilibrio:** ninguno; vigilar el rendimiento en móvil (límite de partículas, texturas en el atlas).
- **Cuándo:** junto con A1 o justo después; parte puede adelantarse en la Fase 5 si se crean armas nuevas (dibujar
  ya con el estilo nuevo).

### A3. Recogida de monedas y experiencia muy satisfactoria 🟡
- **Qué:** gemas que saltan al caer y vuelan en curva hacia el personaje, chispa y sonido ascendente al encadenar
  recogidas, contador de oro que «rebota», imán con estela, cofre que se abre con lluvia de monedas.
- **Aporta:** la sensación de juego incremental que se busca: recoger es una recompensa en sí misma.
- **Equilibrio:** ninguno.
- **Cuándo:** Fase 5 o A1; es barato y de mucho efecto, buena candidata para adelantarse.

### A4. Sonido y música 🟡
- **Qué:** efectos (golpes, recogidas, subir de nivel, jefe) y música por escenario, generados o compuestos de forma
  original, con control de volumen y silencio por defecto en el móvil.
- **Aporta:** gran parte del «feeling» de este género.
- **Equilibrio:** ninguno.
- **Cuándo:** tras A1–A3.

### A5. HUD de armas y pasivas al estilo del género 🟡 (en parte previsto en la Fase 5)
- **Qué:** 5 huecos de arma y 5 de pasiva arriba a la izquierda, más grandes, con el nivel visible y una marca
  cuando un arma puede evolucionar.
- **Aporta:** claridad sobre la build durante la partida.
- **Equilibrio:** reducir de 6+6 a 5+5 huecos baja ligeramente la potencia máxima de una partida (se compensará en
  el estudio de la Fase 5).
- **Cuándo:** Fase 5 (ya incluido en su plan, porque el usuario lo pidió expresamente).

## B. Contenido y variedad de builds

### B1. Evoluciones de armas 🟡
- **Qué:** cada arma al nivel máximo + una pasiva concreta se transforma (al abrir un cofre) en una versión
  mucho más potente y vistosa.
- **Aporta:** objetivos dentro de la partida y motivo para elegir pasivas concretas.
- **Equilibrio:** sube mucho la potencia a partir del minuto 10–15; habría que repetir el estudio de dificultad.
- **Cuándo:** Fase 5 si da tiempo, o justo después.

### B2. Más armas y pasivas hasta ~16 + 14 🟡 (parcialmente en la Fase 5)
- **Qué:** completar la lista de HABITS_GUIDE §5.2 (látigo, bumerán, minas, torreta, láser giratorio, meteoritos…).
- **Aporta:** builds distintas en cada partida.
- **Equilibrio:** más opciones diluyen la probabilidad de conseguir una concreta; se compensa con la suerte y con
  «repetir elección» (C3).
- **Cuándo:** Fase 5 añade una parte; el resto, por tandas posteriores.

### B3. Arcanos / modificadores de partida 🟡
- **Qué:** cartas que se eligen al empezar (p. ej. «los proyectiles rebotan», «más enemigos pero más oro»).
- **Aporta:** variedad a largo plazo cuando ya se tiene todo desbloqueado.
- **Equilibrio:** algunas aumentan el riesgo a cambio de oro; útiles como sumidero de oro (D1).
- **Cuándo:** tras completar el contenido base (más de 6 meses de uso).

## C. Progresión e incremental

### C1. Mejoras permanentes adicionales: Revivir, Repetir y Descartar 🟡
- **Qué:** revivir una vez por partida (coste muy alto), volver a tirar las opciones de mejora, descartar una opción.
- **Aporta:** decisiones durante la partida y un objetivo caro a largo plazo.
- **Equilibrio:** revivir equivale a casi duplicar la vida efectiva: precio exponencial y máximo pequeño (excepción
  a «sin máximo», que el usuario debería aprobar).
- **Cuándo:** después de la Fase 5.

### C2. Hitos y logros con recompensa 🟡
- **Qué:** logros («sobrevive 20 min con la Guardiana», «100 días de racha en un hábito») que dan oro, títulos o
  desbloquean contenido secreto.
- **Aporta:** objetivos a medio plazo además de comprar mejoras.
- **Equilibrio:** las recompensas en oro adelantan desbloqueos; mejor recompensas cosméticas o de contenido.
- **Cuándo:** tras la Fase 5.

### C3. Sensación incremental en el campamento 🟡
- **Qué:** animación al comprar mejoras, números que suben, previsualización del efecto en el personaje
  («+5 % de daño → 112 de daño por golpe»), gráfico de progreso del nivel de cada mejora.
- **Aporta:** que gastar puntos sea satisfactorio.
- **Equilibrio:** ninguno.
- **Cuándo:** junto con A3.

### C4. Ayuda de vuelta tras inactividad 🟡
- **Qué:** si se vuelve tras muchos días sin cumplir hábitos y la supervivencia media cae mucho, la siguiente
  partida da un pequeño bonus temporal (p. ej. +20 % de experiencia).
- **Aporta:** el estudio muestra que el perfil irregular baja a 5–10 min a los 2–3 años; esto evita que se
  desmotive sin regalar puntos (que deben salir solo de los hábitos).
- **Equilibrio:** solo afecta a la partida, no a la economía permanente.
- **Cuándo:** cuando haya datos reales de uso (2–3 meses).

## D. Economía

### D1. Más usos del oro (sumideros) 🟡
- **Qué:** cuando todo esté desbloqueado el oro deja de servir: aspectos de personaje, mejoras cosméticas del
  campamento, arcanos (B3), escenarios de desafío.
- **Aporta:** que el oro siga teniendo valor tras 2 años.
- **Equilibrio:** el oro nunca debe comprar poder permanente (eso es de los hábitos).
- **Cuándo:** antes de que el contenido base se complete (~1 año de uso).

### D2. Racha de hábitos semanales 🟡
- **Qué:** +1 punto por cada 4 semanas seguidas cumpliendo un hábito semanal (con un máximo bajo).
- **Aporta:** coherencia con los diarios; ahora un semanal da siempre 3.
- **Equilibrio:** pequeño (+10–20 % en puntos de semanales).
- **Cuándo:** en cualquier momento; es un cambio pequeño en `rewards.ts` y no reescribe recompensas pasadas.

### D3. Protección de racha 🟡
- **Qué:** un «escudo» que se gana cada X días de racha y evita que un día fallado la rompa (uno a la vez).
- **Aporta:** reduce la frustración de perder una racha larga por un día malo (enfermedad, viaje).
- **Equilibrio:** sube un poco los puntos del perfil normal; hay que decidir si es automático o se elige.
- **Cuándo:** tras unas semanas de uso real, si romper rachas resulta frustrante.

### D4. Límite contra «inflar» hábitos 🟡
- **Qué:** como cada hábito diario da puntos, crear 20 hábitos triviales multiplicaría los puntos. Propuesta: a
  partir del 8.º hábito diario activo, los adicionales dan la mitad, o un tope diario de puntos.
- **Aporta:** protege la economía si se usa de forma poco honesta (la app es personal, así que es opcional).
- **Equilibrio:** ninguno para un uso normal (≤ 7 hábitos).
- **Cuándo:** solo si se ve que hace falta.

## E. Calidad de vida

### E1. Velocidad ×2 y pausa automática al recibir notificaciones 🟡
- **Qué:** botón de velocidad doble en los primeros minutos, que son fáciles.
- **Aporta:** partidas más cortas cuando se juega con prisa.
- **Equilibrio:** ninguno (la simulación es la misma).
- **Cuándo:** Fase 6 (rendimiento) o posterior.

### E2. Estadísticas y récords por personaje y escenario 🟡
- **Qué:** mejor tiempo, enemigos, daño por arma, historial de partidas.
- **Aporta:** seguimiento del progreso a largo plazo.
- **Equilibrio:** ninguno. Los datos ya se guardan en el ledger (`details` de cada resultado).
- **Cuándo:** tras la Fase 5.
