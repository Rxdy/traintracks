// Envoi d'e-mails. Sans SMTP_URL (développement), le message est seulement écrit dans la console.
import nodemailer from 'nodemailer'

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>
}

export function createMailer(smtpUrl: string | undefined, from: string): Mailer {
  if (!smtpUrl) {
    return {
      async send(to, subject, text) {
        console.log(`[mail → ${to}] ${subject}\n${text}\n`)
      },
    }
  }
  const transport = nodemailer.createTransport(smtpUrl)
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from, to, subject, text })
    },
  }
}
