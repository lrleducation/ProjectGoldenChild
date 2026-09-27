export function bodyObject(req){
  if(!req.body) return {};
  if(typeof req.body==='object') return req.body;
  try{return JSON.parse(req.body)}catch{return {}}
}
export function queryObject(req){
  if(req.query) return req.query;
  try{return Object.fromEntries(new URL(req.url,'http://local').searchParams.entries())}catch{return {}}
}
