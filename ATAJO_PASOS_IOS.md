# Atajo de iOS: enviar los pasos de Apple Salud a Tasky

Cada paso que registra tu iPhone se convierte en **1 punto de habilidad** en Tasky. Esos puntos se gastan en las
mejoras permanentes del personaje (Hábitos → Mejoras). Esta guía explica cómo crear en el iPhone el Atajo que lee
tus pasos y se los envía a Tasky, sin dar nada por sabido.

**Por qué no se duplican los pasos:** el Atajo siempre envía el **total del día** (no los pasos nuevos desde la última
vez). Tasky guarda cada envío y, de cada día, cuenta solo el total más alto. Puedes ejecutar el Atajo diez veces al día:
si a las 13:00 envía 4.000 y a las 23:00 envía 9.000, recibes 9.000 puntos en total, no 13.000. Volver a enviar el mismo
total no hace nada.

---

## 0. Antes de empezar (una sola vez, en el ordenador)

1. **Actualiza la base de datos.** Abre tu proyecto de Supabase → *SQL Editor* → pega el contenido completo de
   `supabase/schema.sql` → *Run*. Se puede volver a ejecutar sin problema: no borra nada. Así se crean las funciones
   `create_steps_token` e `ingest_steps`.
2. **Copia la clave pública de Supabase.** Es el valor de `VITE_SUPABASE_KEY` en el archivo `.env` del proyecto (también
   está en Supabase → *Project Settings* → *API Keys* → clave *publishable*, o *anon* si tu proyecto es antiguo). Es una
   clave pública: no es la *secret key*, y esa no la uses nunca aquí. Pásatela al iPhone (por ejemplo, con una nota
   que se sincronice o enviándotela a ti mismo).
3. **Genera tu código personal.** En Tasky (con la sesión iniciada): *Hábitos → Mejoras → Pasos del iPhone →
   Generar código del Atajo* → *Copiar código*. **Solo se muestra una vez.** Si lo pierdes, genera otro (el anterior
   deja de funcionar). Pásalo también al iPhone.

La dirección a la que enviará el Atajo es:

```
https://yfcidccclkndbqhqpmzp.supabase.co/rest/v1/rpc/ingest_steps
```

---

## 1. Crear el Atajo «Pasos a Tasky»

La app **Atajos** viene instalada en el iPhone (icono de dos cuadrados de colores). Si la borraste, búscala en el App
Store como «Atajos» (de Apple).

1. Abre **Atajos** y toca la pestaña **Atajos** (abajo).
2. Toca el **+** (arriba a la derecha). Se abre un atajo vacío.
3. Toca el nombre de arriba («Nuevo atajo») → **Renombrar** → escribe `Pasos a Tasky` → **OK**.

Ahora vas a añadir cuatro acciones. Para añadir cada una, usa la barra **Buscar acciones** (abajo), escribe el nombre
y toca la acción. Se van colocando una debajo de otra.

### Acción 1 · Buscar muestras de salud

1. Busca `muestras de salud` y toca **Buscar muestras de salud**.
2. En la acción, toca el texto azul **Tipo** (o el filtro que aparece) y elige **Pasos**.
   - Debe quedar el filtro: *Tipo* **es** *Pasos*.
3. Toca **Añadir filtro**. En el nuevo filtro, toca el primer campo y elige **Fecha de inicio**; después elige la
   condición **es hoy**.
4. Toca **Agrupar por** y elige **Día**. (Esto suma los pasos del día y evita contar dos veces lo que registran a la vez
   el iPhone y el Apple Watch.)
5. Si aparece **Unidad**, elige **recuento** (o «pasos»).
6. La primera vez, iOS te pedirá permiso para que Atajos lea tus datos de Salud: toca **Permitir** y activa **Pasos**.

### Acción 2 · Calcular estadísticas

1. Busca `estadísticas` y toca **Calcular estadísticas**.
2. Toca la operación (en azul) y elige **Suma**. La entrada debe ser **Muestras de salud** (el resultado de la acción
   anterior; normalmente ya aparece puesto).

Esto convierte el resultado en un número (por ejemplo `7234`).

### Acción 3 · Formatear fecha

1. Busca `formatear fecha` y toca **Formatear fecha**.
2. La fecha debe ser **Fecha actual**. Si aparece otra cosa, toca la fecha y elige **Fecha actual**.
3. Toca **Formato de fecha** → **Personalizado**. En **Cadena de formato**, borra lo que haya y escribe exactamente:

   ```
   yyyy-MM-dd
   ```

   (con las M en mayúscula). Abajo verás un ejemplo como `2026-11-17`. Si en *Formato de hora* aparece algo, déjalo en
   **Ninguno**.

### Acción 4 · Obtener contenido de URL

1. Busca `URL` y toca **Obtener contenido de URL**.
2. Toca el campo **URL** y pega la dirección de arriba
   (`https://yfcidccclkndbqhqpmzp.supabase.co/rest/v1/rpc/ingest_steps`).
3. Toca la flecha **>** (o «Mostrar más») para ver las opciones.
4. **Método:** elige **POST**.
5. **Cabeceras:** toca **Añadir nuevo campo** dos veces:
   - Clave `apikey` → Valor: pega tu **clave pública** de Supabase.
   - Clave `Content-Type` → Valor: `application/json`.
   - *Solo si tu clave pública empieza por `eyJ`* (claves antiguas «anon»): añade un tercer campo, clave
     `Authorization`, valor `Bearer ` (con un espacio) seguido de la misma clave.
6. **Cuerpo de la solicitud:** elige **JSON** y añade tres campos con **Añadir nuevo campo**:
   - Tipo **Texto**: clave `p_token` → valor: pega tu **código personal** de Tasky.
   - Tipo **Texto**: clave `p_day` → valor: toca el campo, y en la barra de variables que aparece sobre el teclado
     elige **Fecha formateada** (el resultado de la acción 3).
   - Tipo **Número**: clave `p_steps` → valor: elige la variable **Estadísticas** (el resultado de la acción 2).

### Acción 5 (opcional) · Ver la respuesta

Busca `mostrar resultado` y añade **Mostrar resultado** (con *Contenido de URL*). Así, al ejecutarlo a mano, verás la
respuesta de Tasky. Cuando compruebes que funciona, puedes quitarla para que la automatización no muestre nada.

Toca **OK** (o la ✓) para guardar.

### Probarlo

1. En la pestaña **Atajos**, toca el atajo **Pasos a Tasky**.
2. Debería mostrar algo como `{"ok": true, "day": "2026-11-17", "steps": 7234}`.
3. Compara `steps` con los pasos de hoy en la app **Salud** (*Resumen → Pasos*). Deberían coincidir o ser casi iguales.
4. En Tasky, *Hábitos → Progreso → Movimientos* aparecerá el día con sus puntos (tras sincronizar, unos segundos).

Si sale un error, mira la sección **Problemas frecuentes** al final.

---

## 2. Enviarlo solo, varias veces al día (automatización)

iOS **no deja leer los datos de Salud con el iPhone bloqueado**, así que una automatización a medianoche con el móvil
en la mesilla fallaría. Lo fiable es ejecutar el Atajo en momentos en que usas el iPhone. Como de cada día solo cuenta
el total más alto, ejecutarlo muchas veces no tiene ningún riesgo.

Opción recomendada: **al abrir una app que uses a menudo** (WhatsApp, Instagram, Safari…).

1. En **Atajos**, toca la pestaña **Automatización** (abajo).
2. Toca **+** (o **Nueva automatización**).
3. Elige **App**.
4. Toca **Elegir** y marca una o varias apps que abras a diario, sobre todo por la noche. Deja marcado **Se abre**.
5. Marca **Ejecutar inmediatamente** (en lugar de «Ejecutar tras confirmación») y desactiva **Notificar al ejecutarse**
   si no quieres avisos. Toca **Siguiente**.
6. Elige el atajo **Pasos a Tasky** (o *Nuevo atajo en blanco → Ejecutar atajo → Pasos a Tasky*). Toca **OK**.

Además, puedes añadir otra automatización de **Hora del día** (por ejemplo, a las 22:30, *Diariamente*, *Ejecutar
inmediatamente*) por si esa noche no abres la app elegida. Si el iPhone está bloqueado a esa hora, simplemente no
enviará nada y lo hará la siguiente ejecución.

## 3. No perder los últimos pasos del día (atajo «ayer», opcional)

Los pasos que des después de la última ejecución del día se pueden recuperar a la mañana siguiente enviando el total
de **ayer** (Tasky acepta días de hasta una semana atrás y, como siempre, solo suma la diferencia).

1. En la pestaña **Atajos**, mantén pulsado **Pasos a Tasky** → **Duplicar**. Renombra la copia como
   `Pasos de ayer a Tasky`.
2. Ábrela y añade arriba del todo la acción **Ajustar fecha**: *Restar* **1** **días** de **Fecha actual**.
3. En la acción 1 (*Buscar muestras de salud*), cambia el filtro de fecha a *Fecha de inicio* **es** y elige la variable
   **Fecha ajustada** (en lugar de «es hoy»).
4. En la acción 3 (*Formatear fecha*), cambia la fecha a la variable **Fecha ajustada**.
5. Pruébalo a mano: `steps` debe coincidir con los pasos de ayer en la app Salud.
6. En la automatización del apartado 2, añade una segunda acción **Ejecutar atajo → Pasos de ayer a Tasky** (o crea
   otra automatización de **Hora del día** por la mañana, cuando ya estés usando el móvil).

---

## Problemas frecuentes

| Respuesta o síntoma | Causa y solución |
|---|---|
| `Código del Atajo no válido` | El código está mal copiado o generaste uno nuevo después. Genera otro en *Mejoras → Pasos del iPhone* y pégalo en `p_token`. |
| `Invalid API key` / `No API key found` | Falta la cabecera `apikey` o la clave no es la pública del proyecto. Si empieza por `eyJ`, añade también `Authorization: Bearer <clave>`. |
| `Could not find the function public.ingest_steps` | No se ha ejecutado `supabase/schema.sql` actualizado (paso 0.1). |
| `Fecha fuera de rango` | La fecha no tiene el formato `yyyy-MM-dd` o es de hace más de 7 días. Revisa la cadena de formato (M mayúsculas). |
| `steps` vale 0 o un número raro | Revisa en la acción 1 que *Tipo* sea **Pasos**, *Agrupar por* **Día** y que Atajos tenga permiso de Salud (Ajustes → Salud → Acceso a datos y dispositivos → Atajos → Pasos activado). |
| Los pasos no coinciden con Salud | Suele ser que falte *Agrupar por: Día*: sin él se suman a la vez los del iPhone y el Apple Watch. |
| La automatización no envía nada | El iPhone estaba bloqueado (iOS no deja leer Salud). Usa el disparador «al abrir una app». |
| Los puntos no aparecen en Tasky | Comprueba que la app tiene la sesión iniciada y está sincronizada (el envío va directo al servidor; la app lo recibe al sincronizar). |

**Seguridad.** El código del Atajo solo sirve para enviar pasos: no permite leer ni cambiar nada más de Tasky. En el
servidor solo se guarda una huella (hash) del código, y generar uno nuevo invalida el anterior.
