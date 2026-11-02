import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configurado=Boolean(url&&key&&!url.includes('TU-PROYECTO')&&!key.includes('TU_CLAVE'));
const db=configurado?createClient(url,key):null;
export function supabaseBrowser(){if(!db)throw new Error('Completa el archivo .env con la URL y la clave pública de tu proyecto Supabase y reinicia npm run dev.');return db;}
