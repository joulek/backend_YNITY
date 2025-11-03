const cron = require("node-cron");
const Planning = require("./models/Planning");
const Revision = require("./models/Revision");
const sendMail = require("./utils/mailer");
const User = require("./models/User");

// Cette tâche tourne chaque minute
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const inFiveMin = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    // 1️⃣ Synchroniser les sessions de Planning en Revision
    const plannings = await Planning.find({}).lean();

    for (const planning of plannings) {
      const userId = planning.userId;
      for (const day of planning.planning) {
        const dayDate = day.date;
        for (const rev of day.revisions || []) {
          const [h, m] = rev.start.split(":").map(Number);
          const dateTime = new Date(`${dayDate}T${rev.start}:00`);
          const eventId = `${userId}_${rev.title}_${dayDate}_${rev.start}`;

          const exists = await Revision.exists({ eventId });
          if (!exists) {
            await Revision.create({
              user: userId,
              courseId: rev.courseId || null,
              title: rev.title,
              date: dateTime,
              eventId,
              reminderSent: false,
            });
            console.log(
              `🆕 Révision ajoutée : ${rev.title} à ${rev.start} pour ${userId}`
            );
          }
        }
      }
    }

    // 2️⃣ Notification 5 minutes avant la session
    const revisions = await Revision.find({
      date: { $gte: now, $lte: inFiveMin },
      reminderSent: false,
    }).populate("user courseId");

    for (const rev of revisions) {
      console.log(
        `⏳ Vérification : révision à ${rev.date} pour ${rev.user.email}`
      );
      if (!rev.user?.email) continue;

      try {
        await sendMail({
          to: rev.user.email,
          subject: `📚 Rappel : Révision à ${new Date(rev.date).toLocaleTimeString()}`,
          html: `
  <p>Hello ${rev.user.name || ""},</p>
  <p>Your revision session for the course <strong>${rev.courseId?.title || rev.title}</strong> starts in less than 5 minutes.</p>
  <p>Good luck and stay focused!</p>
  <p><em>Ynity Learn Community</em></p>
`,
        });

        rev.reminderSent = true;
        await rev.save();

        console.log(
          `📤 Mail de rappel envoyé à ${rev.user.email} pour ${rev.title}`
        );
      } catch (err) {
        console.error("❌ Erreur envoi mail de rappel :", err.message);
      }
    }

    // 3️⃣ Notification si session oubliée (non démarrée après l’heure)
    const missed = await Revision.find({
      date: { $lt: now },
      startedAt: { $exists: false },
      reminderSent: true,
    }).populate("user courseId");

    for (const rev of missed) {
      if (!rev.user?.email) continue;

      try {
        await sendMail({
          to: rev.user.email,
          subject: "⏰ Session manquée : pensez à la reprogrammer",
          html: `
  <p>Hello ${rev.user.name || ""},</p>
  <p>You had a revision session scheduled for <strong>${rev.courseId?.title || rev.title}</strong>, but it was not started.</p>
  <p>We recommend rescheduling it to maintain a consistent study rhythm.</p>
  <p><a href="${process.env.FRONTEND_URL}/planning">📅 View my study plan</a></p>
  <p>Ynity Learn Community</p>

  <p style="font-size: 0.9em; color: gray;">
    ⚠️ This is an automated message. Please do not reply.
  </p>
`,
        });

        rev.endedAt = new Date();
        rev.durationMinutes = 0;
        await rev.save();

        console.log(
          `📮 Notification de session oubliée envoyée à ${rev.user.email}`
        );
      } catch (err) {
        console.error("❌ Erreur envoi mail session oubliée :", err.message);
      }
    }
  } catch (err) {
    console.error("❌ Erreur globale dans reminderScheduler :", err.message);
  }
});
