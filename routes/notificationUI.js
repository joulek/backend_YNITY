const express = require("express");
const router = express.Router();
const Attempt = require("../models/Attempt");
const Course = require("../models/Course");

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ message: "Non authentifié" });
}

router.get("/ui", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    const attempts = await Attempt.find({ user: userId }).populate("course");

    const validAttempts = attempts.filter(a => a.course && a.course._id);

    const courseMap = new Map();
    for (const a of validAttempts) {
      courseMap.set(String(a.course._id), a.course);
    }
    const courses = Array.from(courseMap.values());

    const map = {};

    for (const course of courses) {
      const courseAttempts = validAttempts.filter(
        a => String(a.course._id) === String(course._id)
      );

      if (courseAttempts.length === 0) {
        map[course.title] = "Aucune tentative encore réalisée pour cette matière.";
      } else {
        // ✅ Calcule le meilleur score basé sur correct/total
        const scores = courseAttempts.map(a => {
          const correct = a.correct || 0;
          const total = a.total || 1; // éviter division par 0
          return (correct / total) * 100;
        });

        const best = Math.max(...scores);

        if (best >= 80) {
          map[course.title] = "🎉 This subject is now mastered.";
        } else {
          map[course.title] = "⏳ This subject is still in progress.";
        }
      }
    }

    return res.json(map);
  } catch (err) {
    console.error("Erreur notifications UI", err);
    res.status(500).json({ message: "Erreur interne" });
  }
});

module.exports = router;
