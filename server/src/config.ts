export interface Config {
  port: number
  databaseUrl: string
  appUrl: string // adresse publique du site (liens des e-mails)
  smtpUrl?: string
  googleClientId?: string // connexion avec Google : active seulement si l'identifiant ET le secret sont fournis
  googleClientSecret?: string
  mailFrom: string
  secureCookies: boolean
  trustProxy: boolean
  dailyTz: string
  exportSecret: string // signe les fichiers d'export de données (EXPORT_SECRET : à fixer en production)
  legal: { name: string; contact: string; host: string } // mentions légales (variables LEGAL_*)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL est obligatoire')
  const appUrl = (env.APP_URL ?? 'http://localhost:8090').replace(/\/$/, '')
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    appUrl,
    smtpUrl: env.SMTP_URL,
    googleClientId: env.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || undefined,
    mailFrom: env.MAIL_FROM ?? 'Train Tracks <no-reply@traintracks.local>',
    // Cookie « Secure » seulement si le site est en https (sinon le navigateur le refuse et la connexion échoue).
    secureCookies: appUrl.startsWith('https://'),
    trustProxy: env.TRUST_PROXY === '1',
    dailyTz: env.DAILY_TZ ?? 'Europe/Paris',
    exportSecret: env.EXPORT_SECRET ?? 'dev-export-secret-change-me',
    legal: { name: env.LEGAL_NAME ?? '', contact: env.LEGAL_CONTACT ?? '', host: env.LEGAL_HOST ?? '' },
  }
}
