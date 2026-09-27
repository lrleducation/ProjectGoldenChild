import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { hashPassword, generateTotpSecret } = require('../lib/security.js');
const [email,password,name='Administrator',role='admin'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run admin:user -- email@example.com "strong password" "Name" role');
  process.exit(1);
}
const totpSecret = generateTotpSecret();
const out = { email, name, role, passwordHash:hashPassword(password), totpSecret };
console.log(JSON.stringify(out,null,2));
console.log(`\nAuthenticator secret: ${totpSecret}`);
console.log(`otpauth://totp/Project%20Golden%20Child:${encodeURIComponent(email)}?secret=${totpSecret}&issuer=Project%20Golden%20Child`);
