import Portal from './Portal';import Acceso from './Acceso';import Recuperar from './Recuperar';import Inicio from './Inicio';import {configurado} from './lib/supabase';
export default function App(){
 if(window.location.pathname==='/')return <Inicio/>;
 if(!configurado)return <main className="setup"><div className="brand-symbol">V</div><h1>Conecta VisioStock con Supabase</h1><p>El proyecto está listo para configurar. Todavía no hay una conexión a tu base de datos.</p><ol><li>Crea el proyecto Supabase y ejecuta <code>supabase/esquema.sql</code>.</li><li>Copia <code>.env.example</code> a <code>.env</code>.</li><li>Pega la URL del proyecto y su clave pública.</li><li>Reinicia <code>npm run dev</code>.</li></ol><small>No uses una service_role ni una secret key en este proyecto frontend.</small></main>;
 if(window.location.pathname==='/recuperar')return <Recuperar/>;
 if(window.location.pathname==='/portal')return <Portal/>;
 return <Acceso/>;
}
