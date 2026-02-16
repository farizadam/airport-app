const nodemailer = require("nodemailer");

// Configure via env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
// Using port 465 with SSL for better cloud provider compatibility
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
  secure: process.env.SMTP_SECURE !== "false", // Default to true for port 465
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

async function sendEmail({ to, subject, text, html }) {
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  if (!from) throw new Error("FROM_EMAIL or SMTP_USER must be configured");
  return transporter.sendMail({ from, to, subject, text, html });
}

module.exports = { sendEmail };

// Improve reliability with connection pooling and sensible timeouts
try {
  transporter.pool = true;
  transporter.verify().catch((err) => {
    console.warn(
      "Mailer verify failed:",
      err && err.message ? err.message : err,
    );
  });
} catch (e) {
  // ignore
}
