import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(__dirname,'public');
const port=Number(process.env.PORT||3000);

const apiMap={
  '/api/health':'api/health.js',
  '/sitemap.xml':'api/sitemap.js',
  '/robots.txt':'api/robots.js',
  '/api/referrals':'api/referrals.js',
  '/api/events':'api/events.js',
  '/api/go-gold':'api/go-gold.js',
  '/api/contact':'api/contact.js',
  '/api/admin/login':'api/admin/login.js',
  '/api/admin/logout':'api/admin/logout.js',
  '/api/admin/session':'api/admin/session.js',
  '/api/admin/summary':'api/admin/summary.js',
  '/api/admin/referrals':'api/admin/referrals.js',
  '/api/admin/heroes':'api/admin/heroes.js',
  '/api/admin/hero-actions':'api/admin/hero-actions.js',
  '/api/admin/events':'api/admin/events.js',
  '/api/admin/generate-event':'api/admin/generate-event.js',
  '/api/admin/upload':'api/admin/upload.js',
  '/api/admin/go-gold':'api/admin/go-gold.js',
  '/api/admin/contacts':'api/admin/contacts.js',
  '/api/admin/event-media':'api/admin/event-media.js'
};
const pageMap={
  '/':'index.html','/our-story':'our-story.html','/harpers-heroes':'heroes.html','/events':'events.html','/go-gold':'go-gold.html','/refer':'refer.html','/privacy':'privacy.html','/contact':'contact.html','/admin':'admin/index.html'
};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};

function securityHeaders(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), geolocation=(), microphone=(self), payment=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https:; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}
async function readBody(req){
  const chunks=[];let total=0;
  for await(const chunk of req){total+=chunk.length;if(total>6*1024*1024) throw Object.assign(new Error('Body too large'),{statusCode:413});chunks.push(chunk)}
  if(!chunks.length)return {};
  const raw=Buffer.concat(chunks).toString('utf8');
  if((req.headers['content-type']||'').includes('application/json')){try{return JSON.parse(raw)}catch{return {}}}
  return raw;
}
function serveFile(res,file,method='GET'){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end('Not found');return}
  res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');
  if(method==='HEAD'){res.statusCode=200;res.end();return}
  fs.createReadStream(file).pipe(res);
}

const server=http.createServer(async(req,res)=>{
  securityHeaders(res);
  const url=new URL(req.url||'/','http://localhost');
  const pathname=decodeURIComponent(url.pathname).replace(/\/+$/,'')||'/';
  try{
    if(apiMap[pathname]){
      req.query=Object.fromEntries(url.searchParams.entries());
      if(!['GET','HEAD'].includes(req.method||'GET')) req.body=await readBody(req);
      const mod=await import(pathToFileURL(path.join(__dirname,apiMap[pathname])).href+`?v=${Date.now()}`);
      return await mod.default(req,res);
    }
    if(pathname.startsWith('/uploads/')){
      const rel=pathname.replace('/uploads/','');
      const file=path.resolve(__dirname,'.data','uploads',rel);
      const root=path.resolve(__dirname,'.data','uploads');
      if(!file.startsWith(root)) {res.statusCode=403;return res.end('Forbidden')}
      return serveFile(res,file,req.method);
    }
    const mapped=pageMap[pathname];
    if(mapped) return serveFile(res,path.join(publicDir,mapped),req.method);
    const rel=pathname.replace(/^\//,'');
    const file=path.resolve(publicDir,rel);
    if(file.startsWith(publicDir) && fs.existsSync(file)) return serveFile(res,file,req.method);
    res.statusCode=404;res.end('Not found');
  }catch(err){
    console.error(err);
    res.statusCode=err.statusCode||500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:err.statusCode===413?'Request too large':'Server error'}));
  }
});
server.listen(port,()=>console.log(`Project Golden Child running at http://localhost:${port}`));
