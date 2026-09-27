import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.PGC_LOCAL_DEV = '1';
process.env.NODE_ENV = 'development';

const publicDir = path.join(__dirname, 'public');
const cleanRoutes = {
  '/':'index.html','/our-story':'our-story.html','/harpers-heroes':'heroes.html','/events':'events.html',
  '/go-gold':'go-gold.html','/refer':'refer.html','/privacy':'privacy.html','/contact':'contact.html','/admin':'admin/index.html'
};
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8'};

function sendFile(res, file){
  if(!fs.existsSync(file) || !fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
  res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  fs.createReadStream(file).pipe(res);
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'); const pathname=decodeURIComponent(url.pathname);
    if(pathname.startsWith('/api/')){
      const name=pathname.slice(5).replace(/[^a-zA-Z0-9_-]/g,'');
      const file=path.join(__dirname,'api',`${name}.js`);
      if(!fs.existsSync(file)){res.writeHead(404,{'Content-Type':'application/json'});return res.end(JSON.stringify({message:'API route not found.'}));}
      delete require.cache[require.resolve(file)];
      return require(file)(req,res);
    }
    if(cleanRoutes[pathname]) return sendFile(res,path.join(publicDir,cleanRoutes[pathname]));
    const relative=pathname.replace(/^\/+/, ''); const file=path.normalize(path.join(publicDir,relative));
    if(!file.startsWith(publicDir)) {res.writeHead(403);return res.end('Forbidden');}
    return sendFile(res,file);
  }catch(err){console.error(err);if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain'});res.end('Internal server error');}
});
const port=Number(process.env.PORT||3000); server.listen(port,()=>console.log(`Project Golden Child running at http://localhost:${port}`));
