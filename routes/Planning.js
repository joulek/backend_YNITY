// backend/routes/planning.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Planning = require("../models/Planning");
const Course = require("../models/Course"); // ✅ pour vérifier/compléter les cours
const { generatePlanningIA } = require("../utils/groqPlanning");
const { trackUsage } = require("../utils/trackUsage");

/* ─────────────────────────  Middleware ───────────────────────── */
function ensureAuthenticated(req, _res, next) {
  if (req.isAuthenticated?.() || req.user) return next();
  return _res.status(401).json({ message: "Non authentifié" });
}

/* ─────────────────────────  GET /api/planning/my  ───────────────────────── */
router.get("/my", ensureAuthenticated, async (req, res) => {
  try {
    const list = await Planning.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(list);
  } catch (err) {
    console.error("Erreur listing planning :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ─────────────────────────  POST /api/planning/generate  ───────────────────────── */

router.post("/generate", ensureAuthenticated, async (req, res) => {
  const {
    title = "Mon planning IA",
    totalDays,
    courses = [],
    exams = [],
  } = req.body;

  if (!totalDays || !Array.isArray(courses) || courses.length === 0) {
    return res
      .status(400)
      .json({ message: "totalDays et au moins un cours sont requis." });
  }

  try {
    const dbCourses = await Course.find({
      _id: { $in: courses.map((c) => c.id) },
    }).populate("subject");

    const courseMap = {};
    for (const course of dbCourses) {
      courseMap[course._id.toString()] = {
        subjectId: course.subject?._id?.toString() || "inconnu",
        subjectLabel:
          course.subject?.label || course.subject?.title || "Matière",
      };
    }

    const mergedCourses = courses.map((c) => {
      const found = dbCourses.find((x) => x._id.toString() === c.id);
      return {
        id: c.id,
        title: found?.title || c.title || "Cours",
        weight: Number(c.weight) || 1,
        summaryExists: !!found?.summaryText,
      };
    });

    const planningArray = await generatePlanningIA({
      courses: mergedCourses,
      exams,
      nbJours: totalDays,
    });

    for (const day of planningArray) {
      for (const rev of day.revisions || []) {
        const map = courseMap[rev.courseId];
        rev.subjectId = map?.subjectId || "manquant";
        rev.subjectLabel = map?.subjectLabel || "Matière";

        // ✅ Ajouter un eventId unique
        rev.eventId = `${req.user._id}_${rev.subjectLabel}_${day.date}_${
          rev.start || "00:00"
        }`.replace(/\s+/g, "_");
        // ou : rev.eventId = crypto.randomUUID();
      }
    }

    const saved = await Planning.create({
      userId: req.user._id,
      title,
      nbJours: totalDays,
      planning: planningArray,
    });

    res.json({
      _id: saved._id,
      title: saved.title,
      planning: planningArray,
    });
     await trackUsage({
      user: req.user._id,
      type: "planning",
      prompt: `Génération de planning pour ${totalDays} jours avec ${courses.length} cours.`,
      output: JSON.stringify(planningArray),
    });
  } catch (err) {
    console.error("❌ Erreur génération planning :", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─────────────────────────  DELETE /api/planning/:id  ───────────────────────── */
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Planning.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });
    if (!doc) return res.status(404).json({ message: "Planning introuvable" });

    res.json({ message: "Planning supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression planning :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
