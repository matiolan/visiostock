# VisioStock nuevo para VS Code

Diseño empresarial claro: blanco, azul oscuro y tablas ordenadas. Proyecto independiente del repositorio anterior. React + TypeScript + Vite, con Supabase Auth y PostgreSQL. El contenido de cada archivo se puede copiar directamente en un archivo de igual nombre en VS Code.

## 1 Crear la carpeta

Extrae este ZIP y abre la carpeta que contiene `package.json` con **VS Code → Archivo → Abrir carpeta**. No coloques este código encima del proyecto anterior. Si copias manualmente, respeta los nombres y rutas de los archivos.

Instala Node.js en una versión LTS compatible. Vite requiere Node 20.19+ o 22.12+; se recomienda una LTS más reciente compatible.

En **Terminal → Nueva terminal**, ejecuta:

```powershell
node --version
npm install
```

## 2 Crear Supabase

1. Ingresa a https://supabase.com/dashboard con tu cuenta.
2. Selecciona **New project**. Usa un proyecto nuevo para esta aplicación.
3. Elige organización, nombre `visiostock`, región apropiada y una contraseña segura para la base. Guárdala en tu gestor de contraseñas; no la pegues en GitHub.
4. Espera a que termine la creación.
5. Abre **SQL Editor → New query**.
6. Copia TODO `supabase/esquema.sql` y ejecútalo una sola vez con **Run**. El archivo no borra tablas. Si aparece un error, no continúes ni vuelvas a pegar partes al azar: conserva el mensaje para corregirlo.

No uses el esquema nuevo contra el Supabase antiguo si ya contiene tablas `vs_`. Crea un proyecto aparte como se indica.

## 3 Conectar VS Code con Supabase

Desde el diálogo **Connect** o los ajustes de API de Supabase, copia:

- La URL del proyecto, por ejemplo `https://abcdefgh.supabase.co`.
- La **publishable key** pública. También funciona la clave pública legacy `anon` si tu proyecto todavía la ofrece.

Copia `.env.example` a `.env` en la raíz de este proyecto:

```powershell
Copy-Item .env.example .env
```

Edita `.env`:

```dotenv
VITE_SUPABASE_URL=https://AQUI_TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=AQUI_TU_CLAVE_PUBLICA
```

Reemplaza ambos valores con los de tu proyecto. No uses comillas adicionales ni espacios alrededor del signo igual. Estas son las dos únicas variables del frontend. **No pongas una secret key, service_role, contraseña de base de datos o token de GitHub.** La clave pública identifica el proyecto; las políticas RLS protegen los registros.

## 4 Crear tu administrador

1. En Supabase ve a **Authentication → Users → Add user → Create new user**.
2. Usa tu correo y una contraseña propia segura. Confirma el correo mediante el flujo correspondiente o utiliza la opción de confirmación del administrador del proyecto para esta cuenta de prueba.
3. Abre `supabase/crear_administrador.sql` en VS Code.
4. Reemplaza `CAMBIA_POR_TU_CORREO` por ese correo exacto. Conserva las comillas simples del SQL.
5. Copia todo el archivo en una consulta nueva del SQL Editor y ejecútalo.

Este procedimiento inicial se realiza dentro de Supabase, con permiso del dueño del proyecto. La web no permite que una persona se convierta sola en administrador ni incluye un usuario/contraseña compartido.

## 5 Ejecutar la web

```powershell
npm run dev
```

Abre la dirección **Local** que imprima la terminal, normalmente `http://127.0.0.1:5173`. Inicia sesión con tu administrador. Si aparece la pantalla de configuración, revisa `.env` y reinicia el servidor.

El menú de administrador incluye **Resumen**, **Inventario**, **Movimientos** y **Administración**.

## 6 Crear empresas y clientes

1. En la web, abre **Administración → Nueva empresa**.
2. Crea un almacén para esa empresa.
3. En Supabase, crea la cuenta del cliente en **Authentication → Users** con su correo y una contraseña que él establezca o cambie mediante recuperación. No publiques esa contraseña.
4. En la web, usa **Asignar cliente**, selecciona la empresa y escribe el correo de esa cuenta.
5. Cierra sesión e ingresa como cliente. El menú no mostrará Administración y las consultas estarán limitadas por RLS a su empresa.

La opción **Asignar cliente** asigna una cuenta ya existente; **no envía correos de invitación** ni crea cuentas en Supabase Auth. Se mantiene así para no exponer una clave administrativa en el navegador. El administrador de la plataforma puede consultar todas las empresas, como se acordó.

## 7 Registrar inventario y movimientos

- Ve a **Inventario**, selecciona empresa y almacén correspondientes, ingresa SKU, nombre y stock inicial, y guarda.
- En una sesión de cliente, la empresa se obtiene de su pertenencia en la base, no de una elección del navegador.
- En **Movimientos**, selecciona producto, entrada o salida y una cantidad entera positiva.
- El movimiento y el stock se guardan en una sola transacción. Una salida superior al stock se rechaza.
- El botón **Exportar inventario CSV** descarga las filas disponibles en la tabla.
- **Actualizar** vuelve a consultar la base. No se presenta como actualización automática en tiempo real.

La primera versión consulta un máximo de 1000 registros por tabla. No utilices el CSV como una exportación completa de una instalación que ya superó ese límite; habrá que agregar paginación para ese volumen.

## 8 Comprobar separación entre empresas

Crea Empresa A y Empresa B, un almacén y un producto para cada una. Crea dos cuentas cliente y asigna una a cada empresa. Prueba desde dos navegadores o ventanas privadas:

1. A solo ve su empresa, almacén, productos y movimientos.
2. B solo ve sus datos.
3. Un cliente no puede crear empresas ni asignarse un rol administrativo mediante la API de Supabase.
4. Una salida sin stock suficiente no modifica el saldo ni registra un movimiento.
5. Dos salidas simultáneas no dejan el stock negativo.

`supabase/prueba_aislamiento.sql` ofrece una comprobación adicional con fixtures y rollback. Ejecútala primero en el Supabase nuevo de pruebas, después del esquema. Las pruebas contra tu proveedor son necesarias antes de utilizar datos reales.

## 9 Recuperación de contraseña

En Supabase configura **Authentication → URL Configuration**:

- **Site URL**: el origen real de tu web.
- **Redirect URLs**: agrega la dirección local que estés usando, terminada en `/recuperar`, y después `https://TU-SITIO.vercel.app/recuperar`.

La web ofrece **Configurar o recuperar contraseña**. Primero solicita un enlace con el correo. Abre ese enlace y completa la contraseña nueva. El envío depende de la configuración y los límites de correo de Supabase; para producción configura un proveedor SMTP adecuado.

## 10 Subir a GitHub desde VS Code

1. Crea en GitHub un repositorio nuevo, por ejemplo `visiostock-nuevo`. Déjalo vacío para el primer envío.
2. En VS Code usa **Control de código fuente → Inicializar repositorio**.
3. Confirma que `.env`, `node_modules` y `dist` NO aparecen entre los archivos que se van a confirmar. `.gitignore` ya los excluye.
4. Escribe el mensaje `feat: iniciar VisioStock multiempresa` y crea el commit.
5. Usa **Publicar rama / Publish Branch** y selecciona el repositorio nuevo, con la visibilidad que tú decidas.

Si prefieres la terminal y ya tienes Git instalado y tu sesión configurada:

```powershell
git init
git add .
git commit -m "feat: iniciar VisioStock multiempresa"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/visiostock-nuevo.git
git push -u origin main
```

Reemplaza `TU_USUARIO` y el nombre del repositorio. No pegues contraseñas ni tokens en comandos o archivos. Git puede pedir que inicies sesión con tu cuenta.

## 11 Publicar en Vercel

1. Ingresa a Vercel y selecciona **Add New → Project**.
2. Importa el repositorio nuevo de GitHub.
3. Framework: **Vite**. Root Directory: la carpeta donde está `package.json` (la raíz si subiste este proyecto tal cual).
4. Build Command: `npm run build`. Output Directory: `dist`.
5. En **Environment Variables**, agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los mismos valores del proyecto Supabase nuevo.
6. Publica con **Deploy**.
7. Añade el dominio publicado a las redirecciones de Supabase descritas antes.
8. Comprueba login, cierre de sesión, aislamiento, alta de producto y registro de movimiento en la versión publicada.

Si cambias variables de Vercel, genera un despliegue nuevo: Vite incorpora las variables al compilar. El archivo `vercel.json` mantiene las rutas `/portal` y `/recuperar` al recargar.

## 12 Qué incluye y qué falta integrar

Incluye acceso con Supabase, recuperación, roles administrador/cliente, separación por empresa, almacenes, productos, stock, movimientos manuales, exportación e importación CSV. No incluye cuentas ni datos ficticios que se hagan pasar por registros reales.

La nueva sección Verificación visual permite captura de cámara, carga de foto, conteo manual o asistido, evidencia privada, historial y seguimiento de diferencias. El conteo asistido requiere un servicio Python activo y un modelo validado para los productos del almacén. No incluye pesos entrenados ni seguimiento continuo de video. Lee vision/README.md para activar el detector.

## Fuentes oficiales

- Vite: https://vite.dev/guide/
- Supabase Auth y usuarios: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vite en Vercel: https://vercel.com/docs/frameworks/frontend/vite

## 13 Importar inventario CSV

En Inventario, usa el panel Importar inventario CSV. Selecciona empresa y almacén, elige el archivo, revisa la vista previa y pulsa Importar. Se admiten hasta 500 productos por archivo y 1 MB, separados por coma o punto y coma.

Encabezados: `sku,nombre,stock_inicial` o `SKU,Producto,Stock`. El CSV de Importaciones Lali entregado también funciona: se usa stock_inicial y se ignoran zona y stock_registrado. El destino siempre es el almacén seleccionado.

La importación agrega productos nuevos. Si un SKU ya existe en ese almacén, se rechaza el lote completo: elimina esa fila del CSV o registra una entrada/salida desde Movimientos. No modifica el stock de productos existentes. Los errores de formato deben corregirse antes de guardar. El stock debe ser un entero no negativo.

No requiere SQL adicional si ya ejecutaste esquema.sql. El acceso sigue dependiendo del usuario y las políticas de Supabase. La importación es un alta de inventario inicial, no un movimiento de entrada de productos existentes. El CSV de Lali contiene datos de ejemplo, no registros comerciales verificados.

## 14 Portada pública y acceso privado

La ruta `/` presenta VisioStock: plataforma, proceso, tecnología y preguntas frecuentes. Los botones Iniciar sesión abren `/acceso`; tras ingresar, el usuario llega a `/portal`. El panel incluye Resumen, Inventario, Verificación visual, Alertas y Movimientos. Administración solo aparece para el administrador. La portada se puede abrir incluso antes de conectar Supabase; los datos requieren una sesión y una empresa autorizadas.

## 15 Activar historial y evidencias

Ejecuta **solo** `supabase/02_verificaciones.sql` en el SQL Editor del mismo proyecto Supabase donde ya ejecutaste esquema.sql. No vuelvas a ejecutar el esquema inicial sobre la base existente. La migración crea el historial, el bucket privado vs-evidencias y los permisos por empresa, sin borrar productos ni movimientos. Si el asistente ya aplicó esta migración en tu sesión, no necesitas repetirla.

Con la migración lista, entra a Verificación visual, selecciona producto, toma o carga una foto, escribe el conteo observado y guarda. El sistema compara con el stock vigente. Consulta la foto y la diferencia en el historial. En Alertas puedes documentar una revisión; para ajustar existencias registra después una entrada o salida autorizada.

Para YOLO, sigue `vision/README.md`. Sin un modelo activo, el panel ofrece la revisión manual y explica el estado real del detector.
