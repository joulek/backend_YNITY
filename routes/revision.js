const express = require("express");
const Revision = require("../models/Revision");
const router = express.Router();

/* ────────── Auth ────────── */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ message: "Non authentifié" });
}

router.use(ensureAuthenticated);

/* ────────── HELPERS ────────── */
const upsertRevision = async (userId, eventId, payload) =>
  Revision.findOneAndUpdate(
    { user: userId, eventId },
    { $setOnInsert: { user: userId, eventId }, ...payload },
    { new: true, upsert: true }
  );

/* ────────── ▶ START ──────────
   POST /api/revision/start/:eventId
─────────────────────────────── */
router.post("/start/:id", async (req, res) => {
  try {
    const { id: eventId } = req.params;

    // + d’infos passées dans le body si tu veux (title, courseId, date…)
    const { title, courseId, date } = req.body;

    const revision = await upsertRevision(req.user._id, eventId, {
      title,
      courseId,
      date,
      startedAt: new Date(),
      endedAt: undefined,
      durationMinutes: undefined,
    });

    return res.json({ message: "Révision démarrée ✅", revision });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ────────── ⏹ END ──────────
   POST /api/revision/end/:eventId
────────────────────────────── */
router.post("/end/:id", async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { courseId, date, title } = req.body;

    let revision = await Revision.findOne({ user: req.user._id, eventId });

    if (!revision || !revision.startedAt)
      return res.status(400).json({ message: "Révision non démarrée." });

    // ✅ PATCH courseId manquant si fourni dans le body
    if (!revision.courseId && courseId) {
      revision.courseId = courseId;
    }

    revision.endedAt = new Date();
    revision.durationMinutes = Math.round(
      (revision.endedAt - revision.startedAt) / 60000
    );

    await revision.save();

    return res.json({ message: "Révision terminée ✅", revision });
  } catch (err) {
    console.error("Erreur lors de la terminaison :", err);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: err.message });
  }
});

/* ────────── HISTORIQUE ──────────
   GET /api/revision/my   → utilisé pour la page “Progression”
────────────────────────────────── */
router.get("/my", async (req, res) => {
  try {
    const list = await Revision.find({ user: req.user._id })
      .sort({ date: -1, startedAt: 1 })
      .populate("courseId", "title")
      .lean();

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
// POST /api/revision/analyze
// routes/revision.js ─────────

// helper pour extraire un JSON d’un texte « pollué »
function extractJSON(raw) {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("JSON introuvable");
  const json = raw.slice(first, last + 1);
  return JSON.parse(json);
}
router.post("/analyze", ensureAuthenticated, async (req, res) => {
  try {
    const revisions = await Revision.find({ user: req.user._id });

    const payload = revisions
      .map((r) => `${r.title} | ${r.date} | ${r.durationMinutes || 0} min`)
      .join("\n");

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: `
Tu es un agent IA pédagogique de type Prosus Track. Ton rôle est :
- Analyser les comportements de révision de l’utilisateur
- Déduire son niveau d’engagement et d’émotion à partir des temps de session
- Donner une suggestion personnalisée de motivation
- Identifier la plage horaire la plus fréquente si possible

Réponds uniquement en JSON avec cette structure stricte :
{
  "totalMinutes": number,
  "emotion": string,
  "suggestion": string,
  "motivationScore": number,        // de 0 à 100
  "breakdown": [{ "title": string, "date": string, "duration": number }]
}
              `.trim(),
            },
            {
              role: "user",
              content: `Voici l’historique des révisions (titre | date | minutes) :\n${payload}`,
            },
          ],
        }),
      }
    );

    const json = await response.json();
    const raw = json.choices[0].message.content;
    const data = extractJSON(raw); // 💥 important

    res.json(data);
  } catch (err) {
    console.error("Erreur analyse IA :", err);
    res.status(500).json({ message: "Erreur analyse IA", details: err.message });
  }
});



module.exports = router;
