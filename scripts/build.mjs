import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'client');
const output=path.join(root,'dist');
const configured=process.env.SEGUNDS_CLIENT_API_URL||'';
let api;
try { api=new URL(configured); } catch { throw Error('Define SEGUNDS_CLIENT_API_URL como origen HTTPS del backend.'); }
if(api.protocol!=='https:'||api.username||api.password||api.pathname!=='/'||api.search||api.hash)
  throw Error('SEGUNDS_CLIENT_API_URL debe ser un origen HTTPS sin ruta, credenciales ni parámetros.');

await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ['app.js','styles.css','logo.png','404.html','route.js'])
  await cp(path.join(source,name),path.join(output,name));
const html=(await readFile(path.join(source,'index.html'),'utf8')).replaceAll('__API_ORIGIN__',api.origin);
if(html.includes('__API_ORIGIN__'))throw Error('No se pudo configurar la política de contenido.');
await writeFile(path.join(output,'index.html'),html);
await writeFile(path.join(output,'config.js'),`window.SEGUNDS_API_BASE_URL=${JSON.stringify(api.origin)};\n`);
await writeFile(path.join(output,'.nojekyll'),'');
console.log('Sitio estático de SEGUNDS generado; solo incluye código público y la URL pública del backend.');
