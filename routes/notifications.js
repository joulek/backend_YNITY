const express = require("express");
const router = express.Router();
const Attempt = require("../models/Attempt");
const sendMail = require("../utils/mailer");

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ message: "Non authentifié" });
}
router.post("/low-score", ensureAuthenticated, async (req, res) => {
  try {
    const { courseTitle, score, attemptId } = req.body;
    const attempt = await Attempt.findById(attemptId);

    if (!attempt || attempt.notified) {
      return res
        .status(400)
        .json({ message: "Déjà notifié ou tentative invalide." });
    }

    const userEmail = req.user.email;
    const userName = req.user.name || "";

    const subject = `⚠️ Score faible en ${courseTitle} / Low score in ${courseTitle}`;
    const html = `
  <p>Hello ${userName},</p>
  <p>You scored <strong>${score}%</strong> in the course <strong>${courseTitle}</strong>.</p>
  <p>We recommend reviewing this course to improve your learning progress. You can schedule a new study session now to strengthen your understanding.</p>

  <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;" />

  <p style="margin-top: 20px;">— <strong>Ynity Learn Team</strong></p>

  <p style="font-size: 0.9em; color: gray;">
    ⚠️ This is an automated message. Please do not reply to it.
  </p>
`;
    await sendMail({ to: userEmail, subject, html });

    attempt.notified = true;
    await attempt.save();

    res.json({ message: "Notification envoyée ✅" });
  } catch (err) {
    console.error("Erreur envoi email :", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

router.post("/check-progress", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    const allAttempts = await Attempt.find({
      user: userId,
      notifiedProgress: { $ne: true },
    });

    const eligible = allAttempts.find((a) => {
      const correct = a.correct || 0;
      const total = a.total || 1;
      const score = (correct / total) * 100;
      return score >= 80;
    });

    if (!eligible) {
      return res.json({ message: "Aucune tentative éligible." });
    }

    const score = Math.round((eligible.correct / eligible.total) * 100);
    const userEmail = req.user.email;
    const userName = req.user.name || "";

    const subject = "🎉 Bravo ! Progression atteinte";
    const html = `
  <p>Hello ${userName},</p>
  <p>🎉 Congratulations! You’ve successfully completed a session or a flashcard set with an excellent score of <strong>${score}%</strong>.</p>
  <p>Keep up the great work to maintain your progress!</p>

  <p style="margin-top: 20px;">— <strong>Ynity Learn Community</strong></p>

  <p style="font-size: 0.9em; color: gray;">
    ⚠️ This is an automated message. Please do not reply.
  </p>
`;

    await sendMail({ to: userEmail, subject, html });

    eligible.notifiedProgress = true;
    await eligible.save();

    return res.json({ message: "✅ Notification progression envoyée" });
  } catch (err) {
    console.error("❌ Erreur progression :", err);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
