# M réso Grenoble

## Presentación

Esta integración trae **M réso**, la red de tranvías y autobuses del área de Grenoble, a Gladys. Da las **próximas salidas en tiempo real, con su retraso**, en las paradas que elijas (tres en el formulario, hasta 10 más con un botón), filtradas por línea y dirección. También sigue el **tráfico** de hasta seis líneas (normal, aviso de tráfico, alterado, muy alterado), con los avisos de tráfico: obras, desvíos, horarios modificados. Cada parada y cada línea se convierte en un dispositivo para mostrar en un panel y usar en las escenas.

Los datos proceden de los **datos abiertos oficiales de Mobilités M**, el servicio de movilidad del SMMAG, en `data.mobilites-m.fr` bajo licencia ODbL: sin cuenta ni clave. Cubren M réso y las demás redes del territorio (Cars Région Isère, Pays Voironnais, Grésivaudan): una parada de M réso da también las salidas de las otras líneas que pasan por ella. Cada parada seguida se lee con una petición, cada minuto por defecto (cada 10 minutos mientras ninguna parada anuncia nada en la próxima media hora, de noche). El tráfico se lee cada 5 minutos. La integración guarda las líneas y paradas de las redes y las vuelve a leer una vez al día y una vez por semana.

Una salida está **seguida en tiempo real** cuando Mobilités M conoce la posición del vehículo: se dan su hora estimada y su retraso. Si no, es el **horario teórico**, marcado «(teórico)». Se indican los **viajes suprimidos**.

Es una integración **cloud**: contacta con `data.mobilites-m.fr`. Nada más sale de tu red.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- Nada más: los datos abiertos de Mobilités M no piden cuenta ni clave.

## Configuración

| Campo                  | Qué escribir                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Parada 1, 2, 3         | El nombre de la parada («Chavant», «Grenoble Hôtel de Ville») o su código («SEM:GENCHV»).                       |
| Línea                  | Solo esta línea: «A», «C1», «16». Vacío: todas las líneas de la parada.                                         |
| Dirección              | Solo los destinos que contienen estas palabras: «La Poya», «Fontaine \| Seyssins». Vacío: ambos sentidos.       |
| Líneas seguidas        | Las líneas cuyo tráfico sigues, seis como máximo: «A, B, C1, 16».                                               |
| Lectura de las paradas | Cada 30 segundos, minuto, 2 minutos o 5 minutos.                                                                |
| Idioma de los textos   | Nombres de los dispositivos, resúmenes y salidas de las escenas. Paradas y avisos de tráfico quedan en francés. |

El botón **Buscar una parada** da las paradas que contienen algunas palabras, con su municipio, su código y sus líneas («Chavant (Grenoble) [SEM:GENCHV] → A, C, C1, C4»). Cuando dos municipios comparten un nombre («Hôtel de Ville»), escribe el municipio con el nombre («Grenoble Hôtel de Ville») o copia el código. **Probar la conexión** lee las redes, cada parada y cada línea de inmediato.

Una línea se escribe como en el vehículo: «A» a «E» para los tranvías, «C1», «12»… Un nombre usado por dos redes (la «C1» de M réso y el TER «C1») designa la de M réso; para la otra, escribe su código («SNC:C1»).

Más paradas que las tres del formulario (casa, trabajo, colegio…): **Añadir una parada** retoma los mismos tres campos — parada, línea, dirección — y sigue hasta 10 paradas más. **Listar las paradas** muestra todas las paradas seguidas, numeradas; **Quitar una parada** toma ese número (o el nombre). Las paradas añadidas se guardan en la configuración de Gladys, así que siguen sus copias de seguridad.

## Uso

### Dispositivos

En la pestaña **Descubrir**, crea los dispositivos que quieras:

- **M réso \<parada\>**: la próxima salida en texto («A → La Poya · 3 min (+2 min de retraso)»), la espera de la próxima salida y de la siguiente (minutos), y el retraso de la próxima (minutos, publicado solo cuando se sigue en tiempo real);
- **M réso tranvía A**, **M réso línea C1**, **Cars Région línea T83**…: el tráfico en texto («Tráfico alterado: travaux rue Diderot») y el número de avisos de tráfico en curso.

De noche, sin ninguna salida, las esperas conservan su último valor.

### Tráfico

Mobilités M da a cada línea un **nivel de servicio**: normal, alterado o muy alterado. Es el estado del dispositivo línea, y **aviso de tráfico** cuando el servicio es normal pero hay un aviso en curso (obras nocturnas más tarde, parada desplazada…). Cada aviso tiene un periodo de validez («15/07 04:00 → 19/12 03:00»), a veces horas del día («21:30–02:00»), y a menudo un documento (plano del desvío).

### Widgets del panel

![El widget Salidas M réso en Gares y el widget Tráfico M réso de los tranvías y de líneas de autobús (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-m-reso/main/docs/assets/widgets.es.png)

- **Salidas M réso**: las próximas salidas de una parada, en compacto. Una fila por línea y destino, con sus próximas salidas seguidas («2 · 17 min»). Un viaje suprimido se muestra («suprimido 21:44») y pone la fila en naranja, como un retraso de 5 minutos o más. El ajuste **Trayectos mostrados** fija el número de filas. Elige una parada seguida, o escribe cualquier parada (y una línea) en los ajustes del widget. Con **Varias paradas**, un solo widget muestra varios dispositivos de parada: los dispositivos de una misma parada se reúnen bajo su nombre; para paradas distintas, cada parada empieza con su propia fila.
- **Tráfico M réso**: el estado de cada línea, luego los avisos en curso y los de los tres próximos días, con su periodo. Toca una tarjeta para el texto completo y el documento. Las líneas seguidas, las escritas en los ajustes, o las cinco líneas de tranvía si no sigues ninguna.

### Escenas

Disparadores, una vez por cambio (la primera lectura solo sirve de referencia):

- **M réso: salida en breve**: una salida en una parada seguida sale dentro de 2, 3, 5, 10, 15 o 20 minutos, contado según su estimación en tiempo real.
- **M réso: salida suprimida**: un viaje de la próxima hora en una parada seguida queda suprimido.
- **M réso: línea alterada**: el nivel de servicio de una línea seguida pasa a alterado o muy alterado.
- **M réso: fin de la incidencia**: la línea vuelve a un nivel de servicio normal.
- **M réso: nuevo aviso de tráfico**: Mobilités M publica un aviso sobre una línea seguida, en curso o próximo.

Cada uno da una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (línea, destino, hora, retraso, título, texto, inicio y fin…). Las acciones **M réso: próximas salidas** y **M réso: tráfico de una línea** devuelven el mismo tipo de valores, para ponerlos en un mensaje o probarlos en una condición.

Ejemplos:

- Cuando el tranvía A hacia La Poya sale de Victor Hugo dentro de 5 minutos → encender en verde la lámpara de la entrada.
- Cuando se suprime una salida de tu parada, o la C1 está alterada → enviar el resumen a tu teléfono antes de salir.
- Cada día laborable a las 7:30 → leer las próximas salidas de tu parada y hacer que las anuncie el altavoz de la cocina.

### Transporte

Solo cloud: los datos vienen de internet. Solo las paradas que sigues se piden a la API de Mobilités M, una a una.

## Solución de problemas

- **«Desconocido o ambiguo»**: usa **Buscar una parada** y copia el nombre exacto (con su municipio si hace falta) o el código; para una línea, su nombre como en el vehículo («A», «C1», «16») o su código.
- **«(teórico)» tras una salida**: Mobilités M no sigue ese vehículo en tiempo real; la hora es la del horario.
- **Ninguna salida**: de noche la red duerme; la parada se lee cada 10 minutos.
- **«Los datos abiertos de Mobilités M no responden»**: la integración vuelve a intentarlo en cada lectura; las últimas salidas siguen en los widgets.
- **Para informar de un problema**: pulsa **Diagnóstico** y copia las líneas que empiezan por «M réso diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.
