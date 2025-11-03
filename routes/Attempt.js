const express = require("express");
const Attempt = require("../models/Attempt");
const Course = require("../models/Course");

const router = express.Router();

/* ─────────────────── helper auth ─────────────────── */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Non authentifié" });
}

/* ─────────────── POST /api/attempts ───────────────
   Enregistre UNE tentative complète
──────────────────────────────────────────────────── */
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    const { courseId, total, correct, flashcardResults } = req.body;

    // ✅ Récupération du cours et de sa matière
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Cours introuvable" });

    const subjectId = course.subject;

    const attempt = await Attempt.findOneAndUpdate(
      { user: req.user._id, course: courseId },
      {
        $set: {
          subject: subjectId,
          total,
          correct,
          flashcards: flashcardResults,
          createdAt: new Date()
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json(attempt);
  } catch (err) {
    console.error("❌ Erreur POST /attempts :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ─────────────── GET /api/attempts/my ───────────────
   Récupère les tentatives de l’utilisateur connecté
──────────────────────────────────────────────────── */
router.get("/my", ensureAuthenticated, async (req, res) => {
  try {
    const attempts = await Attempt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("course", "title")
      .populate("subject", "label");

    res.json(attempts);
  } catch (err) {
    console.error("Erreur récupération progression :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ─────────────── DELETE /api/attempts/:id ───────────────
   Supprime UNE tentative. L’utilisateur doit être propriétaire.
────────────────────────────────────────────────────────── */
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) return res.status(404).json({ message: "Tentative introuvable" });

    // Vérifie la propriété
    if (attempt.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    await attempt.deleteOne();
    res.json({ message: "Tentative supprimée" });
  } catch (err) {
    console.error("Erreur suppression tentative :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
