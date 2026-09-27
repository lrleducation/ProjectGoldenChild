import { json,setSessionCookie } from '../../lib/http.mjs';
import { bodyObject } from '../../lib/request.mjs';
import { findAdmin,verifyPassword,verifyTotp,signSession } from '../../lib/security.mjs';
import { isProduction,sessionSecret } from '../../lib/config.mjs';
import { audit } from '../../lib/db.mjs';
export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  if(isProduction && !sessionSecret) return json(res,503,{ok:false,error:'Admin authentication is not configured.'});
  const body=bodyObject(req); const admin=findAdmin(body.email);
  const passwordOk=verifyPassword(String(body.password||''),admin);
  const otpOk=admin ? verifyTotp(admin.totpSecret,String(body.otp||'')) : false;
  if(!admin || !passwordOk || !otpOk){ await new Promise(r=>setTimeout(r,450)); return json(res,401,{ok:false,error:'Email, password or authentication code is incorrect.'}); }
  const token=signSession({email:admin.email,name:admin.name||admin.email,role:admin.role||'admin'});
  setSessionCookie(res,token); await audit(admin.email,'admin_login','session','',{});
  return json(res,200,{ok:true,user:{email:admin.email,name:admin.name||admin.email,role:admin.role||'admin'}});
}
