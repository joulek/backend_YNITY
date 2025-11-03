const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  try {
    const result = await resend.emails.send({
      from: 'Ynity Learn <onboarding@resend.dev>',         // adresse autorisée par Resend
      to: 'nourheneabbes12@gmail.com',                           // ✅ ton adresse validée
      subject: '✅ Test Resend Email (internal)',
      html: `
        <h2>Hello YnityLearn 👋</h2>
        <p>This is a <strong>Resend test email</strong> sent to your own address (as allowed in testing mode).</p>
        <p>You’ll need to verify a custom domain to send to other users.</p>
        <p>🛠️ See <a href="https://resend.com/domains">resend.com/domains</a> to get started.</p>
      `,
      reply_to: 'ynitylearn@gmail.com',
    });

    console.log("✅ Email sent successfully:", result);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
}

test();
