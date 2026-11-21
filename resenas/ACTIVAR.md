# Activar las reseñas de Xebax

La landing, el formulario y el panel son archivos estáticos. Se publican con el despliegue actual de GitHub Pages. Los navegadores consultan la API HTTPS incluida con la base PostgreSQL de Supabase. El acceso de Rafael usa Supabase Auth. El visitante puede enviar una reseña sin registrarse.

## Primer acceso al panel

La cuenta de moderación del proyecto de Xebax tiene el usuario `aventura360land`. Tras publicar el ZIP, abre `/resenas/admin.html` y pulsa **Crear o recuperar mi contraseña**. Escribe tu nombre de usuario. El enlace llega a la cuenta de Outlook del negocio. Ábrelo en el mismo navegador y dispositivo, elige tu contraseña e inicia sesión. El panel muestra el nombre de usuario en **Mi perfil**. Los visitantes pueden enviar reseñas sin registrarse.

El proyecto de Supabase ya tiene las tablas, los permisos de moderación, la cuenta y la URL de recuperación configurados. La entrega del correo se comprueba al hacer el primer acceso.

## Reinstalación en otro proyecto

1. En un proyecto Supabase de Xebax, activa **Data API** para el esquema `public`. Abre **SQL Editor** y ejecuta **instalar.sql** completo. El script se puede volver a ejecutar y conserva las reseñas existentes.
2. Desde **Connect** o **Settings → API Keys**, copia la **Project URL** y la **publishable key** que empieza por `sb_publishable_`. Pégalas en `resenas/config.js`. Ese archivo se publica y contiene únicamente valores públicos.
3. En **Authentication → Users → Add user**, crea la cuenta con el correo que controla el negocio. Copia su **User UID** y reemplaza el marcador en la siguiente consulta. Usa el nombre que deba mostrar el perfil. Para esta landing, el acceso por nombre de usuario usa `adminUsername` y `adminMailDomain` de `resenas/config.js` para formar el correo que espera Supabase. Si la dirección usa otra convención, el panel también admite el correo completo. Estos valores se entregan al navegador. El permiso para moderar se comprueba por el UID de la sesión en la base de datos.

   ```sql
   insert into public.xebax_moderators(user_id, username)
   values ('UUID_DE_LA_CUENTA'::uuid, 'aventura360land')
   on conflict (user_id) do update set username = excluded.username;
   ```

4. En **Authentication → URL Configuration**, configura la Site URL de este proyecto dedicado como `https://xebaxadventure.online` y agrega a Redirect URLs la dirección exacta `https://xebaxadventure.online/resenas/recuperar.html`. En el correo de recuperación conserva el enlace estándar `{{ .ConfirmationURL }}`. Para enviar a Rafael si su correo es externo al equipo del proyecto, configura un proveedor SMTP autorizado por el negocio en Authentication. Prueba la entrega con su cuenta antes de dar el acceso por terminado.
5. El ZIP completo contiene los archivos para GitHub Pages, incluidos imágenes, videos y CNAME. Publica el contenido en la raíz del repositorio. Si la web cambió desde el commit `44ca7e5`, integra los cambios en la versión más reciente.
6. Una vez desplegado, visita **https://xebaxadventure.online/#resenas** y envía una reseña de prueba. Desde **https://xebaxadventure.online/resenas/admin.html**, inicia sesión, abre Pendientes y pulsa Publicar. En una ventana privada, actualiza la landing y comprueba la opinión y el promedio. Si ocultas la reseña, vuelve a desaparecer de ambos. Para retirar definitivamente un dato a petición del cliente puedes usar el Table Editor del proyecto.
7. Desde el panel, pulsa **Crear o recuperar mi contraseña**, escribe el nombre de usuario y abre el enlace en el mismo navegador y dispositivo desde el que lo solicitaste. Elige una contraseña nueva e inicia sesión con ella. La recuperación conserva el rol de la cuenta. El SQL configura la estructura y los permisos. Para restaurar reseñas existentes se necesita una copia de sus datos.

Comparte con los viajeros el enlace terminado en `/#resenas`. La sección está después de la galería y se puede abrir desde el menú. La clave secreta de Supabase y la contraseña de Rafael deben mantenerse fuera del repositorio.

Las políticas en PostgreSQL y los permisos por columna limitan la lectura pública a opiniones publicadas. La cuenta de moderación puede cambiar su estado. El formulario es abierto y la revisión es manual. Reintentar un envío con el mismo identificador no duplica la opinión.
