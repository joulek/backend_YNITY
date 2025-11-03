// utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Envoie un mail
 * @param {Object} options - { to, subject, html }
 */
async function sendMail(options) {
  const mailOptions = {
    from: `"Ynity Learn" <${process.env.EMAIL_SENDER}>`,
    replyTo: "no-reply@ynitylearn.com", // ⛔ Empêche les réponses
    ...options,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = sendMail;
