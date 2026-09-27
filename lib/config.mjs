export const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
export const isPreview = process.env.VERCEL_ENV === 'preview';
export const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'local-development-only-change-me');
export const baseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const adminUsersJson = process.env.ADMIN_USERS_JSON || '';
export const fromEmail = process.env.FROM_EMAIL || 'Project Golden Child <hello@example.invalid>';
export const notificationEmail = process.env.NOTIFICATION_EMAIL || '';
export const resendApiKey = process.env.RESEND_API_KEY || '';
export const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';
export const requireTurnstile = process.env.REQUIRE_TURNSTILE === 'true';
export const openAiApiKey = process.env.OPENAI_API_KEY || '';
export const openAiModel = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
export const storageBucket = process.env.SUPABASE_PUBLIC_EVENT_BUCKET || 'event-public';

export function productionReady() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey && sessionSecret && adminUsersJson);
}

export function getAdminUsers() {
  if (!adminUsersJson) {
    if (isProduction) return [];
    return [{
      email: 'admin@local.test',
      name: 'Adam',
      role: 'director',
      salt: 'local-dev-salt',
      passwordHash: '',
      plainPassword: 'GoldenChildLocal!2026',
      totpSecret: ''
    }];
  }
  try {
    const parsed = JSON.parse(adminUsersJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
