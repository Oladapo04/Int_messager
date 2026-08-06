const nodemailer = require("nodemailer");
const templates = require("../templates/emailTemplates");

function usable(value) { return String(value || "").trim(); }
function smtpConfigured(env = process.env) {
  const host = usable(env.SMTP_HOST).toLowerCase();
  const user = usable(env.SMTP_USER).toLowerCase();
  const pass = usable(env.SMTP_PASS);
  if (!host || !user || !pass) return false;
  if (host.includes("example.com") || user.includes("your-smtp") || pass.toLowerCase().includes("replace")) return false;
  return true;
}

class NotificationService {
  constructor(env = process.env) { this.env = env; this.transporter = null; }
  getTransporter() {
    if (!smtpConfigured(this.env)) return null;
    if (!this.transporter) this.transporter = nodemailer.createTransport({ host: this.env.SMTP_HOST, port: Number(this.env.SMTP_PORT || 587), secure: String(this.env.SMTP_SECURE || "false") === "true", auth: { user: this.env.SMTP_USER, pass: this.env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
    return this.transporter;
  }
  async sendEmail({ to, template, data, developmentUrl = "" }) {
    if (!to) return { delivered: false, skipped: true };
    const builder = templates[template];
    if (!builder) throw new Error(`Unknown email template: ${template}`);
    const message = builder(data || {});
    const transporter = this.getTransporter();
    if (!transporter) {
      if (developmentUrl) console.log(`\n[DEV ${template.toUpperCase()} LINK]\n${developmentUrl}\n`);
      return { delivered: false, developmentPreview: true };
    }
    await transporter.sendMail({ from: this.env.SMTP_FROM || "Int-Messager <no-reply@localhost>", to, ...message });
    return { delivered: true, developmentPreview: false };
  }
  passwordReset(profile, resetUrl, expiresMinutes) { return this.sendEmail({ to: profile.email, template: "passwordReset", data: { displayName: profile.displayName || "there", resetUrl, expiresMinutes }, developmentUrl: resetUrl }); }
  welcome(profile) { return this.sendEmail({ to: profile.email, template: "welcome", data: { displayName: profile.displayName || "there" } }); }
  loginAlert(profile, deviceName) { return this.sendEmail({ to: profile.email, template: "loginAlert", data: { displayName: profile.displayName || "there", deviceName, time: new Date().toLocaleString() } }); }
}
module.exports = new NotificationService();
