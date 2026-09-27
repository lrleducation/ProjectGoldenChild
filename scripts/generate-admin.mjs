import crypto from 'node:crypto';
const [,,email,password,name='Admin',role='director']=process.argv;
if(!email||!password){console.error('Usage: npm run admin:user -- email@example.com "strong password" "Name" director');process.exit(1)}
const salt=crypto.randomBytes(16).toString('hex');
const passwordHash=crypto.scryptSync(password,salt,64).toString('hex');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const bytes=crypto.randomBytes(20);let bits='';for(const b of bytes)bits+=b.toString(2).padStart(8,'0');let totpSecret='';for(let i=0;i<bits.length;i+=5)totpSecret+=alphabet[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];
console.log(JSON.stringify({email:email.toLowerCase(),name,role,salt,passwordHash,totpSecret},null,2));
console.log('\nAdd this object to ADMIN_USERS_JSON. Add the TOTP secret to an authenticator app manually or via your password manager.');
