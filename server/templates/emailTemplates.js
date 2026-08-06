function layout(title, body) {
  return `<div style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px;color:#111827"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #d1d5db;border-radius:16px;padding:24px"><h2 style="margin-top:0">${title}</h2>${body}<p style="margin-top:24px;color:#6b7280;font-size:13px">Int-Messager · Connecting with love</p></div></div>`;
}
exports.passwordReset = ({ displayName, resetUrl, expiresMinutes }) => ({
  subject: "Reset your Int-Messager password",
  text: `Hello ${displayName},\n\nReset your password: ${resetUrl}\n\nThis link expires in ${expiresMinutes} minutes.`,
  html: layout("Reset your password", `<p>Hello ${displayName},</p><p>Use the button below to choose a new password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Reset password</a></p><p>This link expires in ${expiresMinutes} minutes.</p>`),
});
exports.welcome = ({ displayName }) => ({ subject: "Welcome to Int-Messager", text: `Welcome ${displayName}!`, html: layout("Welcome to Int-Messager", `<p>Hello ${displayName},</p><p>Your account is ready.</p>`) });
exports.loginAlert = ({ displayName, deviceName, time }) => ({ subject: "New Int-Messager sign-in", text: `Hello ${displayName}, a new sign-in occurred on ${deviceName} at ${time}.`, html: layout("New sign-in", `<p>Hello ${displayName},</p><p>A new sign-in occurred on <strong>${deviceName}</strong> at ${time}.</p><p>If this was not you, change your password and remove the device from Settings.</p>`) });
exports.emailVerification = ({ displayName, verificationUrl }) => ({ subject: "Verify your Int-Messager email", text: `Hello ${displayName}, verify your email: ${verificationUrl}`, html: layout("Verify your email", `<p>Hello ${displayName},</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Verify email</a></p>`) });
