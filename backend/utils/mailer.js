// utils/mailer.js
require("dotenv").config();
const nodemailer = require("nodemailer");

const {
  APP_NAME = "Oncoinmeta Security",
  SMTP_HOST,
  SMTP_PORT = "465",
  SMTP_SECURE = "true",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_NAME = "Oncoinmeta Security",
  SMTP_FROM_EMAIL,
  SMTP_IGNORE_TLS_ERRORS = "false",
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: String(SMTP_SECURE) === "true",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: String(SMTP_IGNORE_TLS_ERRORS) === "true" ? { rejectUnauthorized: false } : undefined,
});

const FROM = `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL || SMTP_USER}>`;

async function sendMailText(to, subject, text) {
  return transporter.sendMail({ from: FROM, to, subject, text });
}

async function sendMailHTML(to, subject, html) {
  return transporter.sendMail({ from: FROM, to, subject, html });
}

function baseTemplate({ title, bodyHtml, footerNote }) {
  const year = new Date().getFullYear();
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
    </head>
    <body style="margin:0;background:#0b1020;padding:24px;">
      <div style="max-width:620px;margin:0 auto;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:18px;overflow:hidden;font-family:Segoe UI,Arial,sans-serif;color:#eaf0ff;">
        <div style="padding:22px 22px 14px;background:linear-gradient(135deg, rgba(99,102,241,0.28), rgba(168,85,247,0.22));border-bottom:1px solid rgba(255,255,255,0.10);">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.10);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.14);">
              <span style="font-size:18px;">🛡️</span>
            </div>
            <div>
              <div style="font-weight:800;font-size:16px;letter-spacing:0.2px;">${APP_NAME}</div>
              <div style="opacity:0.85;font-size:12px;margin-top:2px;">Security Notification</div>
            </div>
          </div>
        </div>

        <div style="padding:22px;">
          <h2 style="margin:0 0 12px;font-size:18px;letter-spacing:0.2px;">${title}</h2>
          <div style="font-size:14px;line-height:1.7;opacity:0.95;">
            ${bodyHtml}
          </div>

          <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.10);font-size:12px;opacity:0.78;line-height:1.6;">
            ${footerNote || `If you didn’t request this, you can safely ignore this email.`}
          </div>
        </div>

        <div style="padding:14px 22px;border-top:1px solid rgba(255,255,255,0.10);font-size:12px;opacity:0.70;">
          © ${year} ${APP_NAME}. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
}

function otpTemplate({ appName = APP_NAME, name = "User", otp, minutes = 5 }) {
  return baseTemplate({
    title: `${appName} OTP Verification`,
    bodyHtml: `
      <p style="margin:0 0 10px;">Hello <strong>${name}</strong>,</p>
      <p style="margin:0 0 14px;">Use the OTP below to verify your account:</p>

      <div style="margin:14px 0 16px;text-align:center;">
        <div style="display:inline-block;padding:14px 22px;border-radius:14px;
                    background:rgba(255,255,255,0.08);
                    border:1px dashed rgba(168,85,247,0.85);
                    font-size:26px;font-weight:900;letter-spacing:6px;color:#ffffff;">
          ${otp}
        </div>
      </div>

      <p style="margin:0;">This OTP expires in <strong>${minutes} minutes</strong>. Do not share it with anyone.</p>
    `,
  });
}

function loginAlertTemplate({ appName = APP_NAME, name = "User", when }) {
  return baseTemplate({
    title: "Login Alert",
    bodyHtml: `
      <p style="margin:0 0 10px;">Hello <strong>${name}</strong>,</p>
      <p style="margin:0 0 12px;">Your account was just logged into.</p>
      <p style="margin:0 0 8px;font-weight:800;">${when}</p>
      <p style="margin:0;font-size:12px;opacity:0.85;">If this wasn’t you, change your password immediately and contact support.</p>
    `,
  });
}

function resetTemplate({ appName = APP_NAME, otp }) {
  return baseTemplate({
    title: `${appName} Password Reset`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Use the OTP below to reset your password:</p>
      <div style="margin:14px 0 16px;text-align:center;">
        <div style="display:inline-block;padding:14px 22px;border-radius:14px;
                    background:rgba(255,255,255,0.08);
                    border:1px dashed rgba(34,197,94,0.95);
                    font-size:26px;font-weight:900;letter-spacing:6px;color:#ffffff;">
          ${otp}
        </div>
      </div>
      <p style="margin:0;">If you didn’t request a reset, ignore this email.</p>
    `,
  });
}

// Convenience wrappers
async function sendOTPEmail({ to, name, otp, appName = APP_NAME }) {
  return sendMailHTML(to, `Verify Your ${appName} Account`, otpTemplate({ appName, name, otp, minutes: 5 }));
}

async function sendLoginAlertEmail({ to, name, when = new Date().toLocaleString(), appName = APP_NAME }) {
  return sendMailHTML(to, `${appName} Login Alert`, loginAlertTemplate({ appName, name, when }));
}

async function sendPasswordResetEmail({ to, otp, appName = APP_NAME }) {
  return sendMailHTML(to, `${appName} Password Reset`, resetTemplate({ appName, otp }));
}

module.exports = {
  transporter,
  sendMailText,
  sendMailHTML,
  sendOTPEmail,
  sendLoginAlertEmail,
  sendPasswordResetEmail,
};
