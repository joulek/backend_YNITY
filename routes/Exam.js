/* backend/routes/exam.js */
const express = require("express");
const path = require("path");
const router = express.Router();

const Exam = require("../models/Exam");
const Course = require("../models/Course");
const Attempt = require("../models/Attempt");
const AttemptExam = require("../models/AttemptExam");
const { trackUsage } = require("../utils/trackUsage");

const {
  generateQCMQuestions,
  generateCourseQuestions,
  generateMixedQuestions,
  trimContentToMaxWords,
} = require("../utils/examAI");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const stringSimilarity = require("string-similarity");

/* ---------- Auth ---------- */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ message: "Non authentifié" });
}

/* ---------- Helpers ---------- */
async function getCourseContentForExam(course) {
  if (course.extractedText?.length > 100) return course.extractedText;
  if (course.summaryText?.length > 100) return course.summaryText;

  if (course.file) {
    try {
      const absPath = path.join(__dirname, "..", course.file);
      const pdfText = await extractTextFromPDF(absPath);
      if (pdfText.length > 100) {
        course.extractedText = pdfText;
        await course.save();
        return pdfText;
      }
    } catch (err) {
      console.error(`❌ PDF extraction échouée (${course.title}) :`, err.message);
    }
  }
  return "";
}

/* ---------- GET /api/exam/my ---------- */
router.get("/my", ensureAuthenticated, async (req, res) => {
  try {
    const exams = await Exam.find({ user: req.user._id })
      .populate("courses")
      .sort({ createdAt: -1 });

    res.json(exams);
  } catch (err) {
    console.error("Erreur récupération examens :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ---------- DELETE /api/exam/:id ---------- */
router.delete("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Examen non trouvé." });

    if (!exam.user.equals(req.user._id)) {
      return res.status(403).json({ message: "Accès interdit." });
    }

    await exam.deleteOne();
    res.json({ message: "Examen supprimé avec succès." });
  } catch (err) {
    console.error("Erreur suppression examen :", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ---------- POST /api/exam/generate ---------- */
router.post("/generate", ensureAuthenticated, async (req, res) => {
  const { courseIds, type, questionCount } = req.body;

  if (!Array.isArray(courseIds) || courseIds.length === 0)
    return res.status(400).json({ message: "CourseIds doit être un tableau non vide." });

  if (!["QCM", "Cours", "Mixte"].includes(type))
    return res.status(400).json({ message: "Type d'examen invalide." });

 const qty = Math.min(
  Math.max(Number(questionCount) || 10, 1),
  50
);


  try {
    const courses = await Course.find({ _id: { $in: courseIds } });
    if (courses.length === 0)
      return res.status(404).json({ message: "Aucun cours trouvé." });

    const contents = await Promise.all(
      courses.map(async c => `### ${c.title}\n\n${await getCourseContentForExam(c)}`)
    );

    const combinedContent = trimContentToMaxWords(contents.join("\n\n"), 1500);
    const wordCount = combinedContent.split(/\s+/).length;
    if (wordCount < 30)
      return res.status(400).json({ message: "Contenu insuffisant", details: `${wordCount} mots trouvés` });

    const generator = { QCM: generateQCMQuestions, Cours: generateCourseQuestions, Mixte: generateMixedQuestions }[type];
    let finalList = [];

    while (finalList.length < qty) {
      const remaining = qty - finalList.length;
      const batch = await generator(combinedContent, remaining);
      const parsed = JSON.parse(batch);
      if (parsed.length === 0) break;
      finalList = finalList.concat(parsed).slice(0, qty);
    }

    const exam = await Exam.create({
      user: req.user._id,
      type,
      questions: finalList,
      courses: courseIds,
      questionCount: qty,
      isCombined: courseIds.length > 1,
      combinedTitle: courseIds.length > 1 ? courses.map(c => c.title).join(" + ") : undefined,
    });
    await trackUsage({
      user: req.user._id,
      type: "exam",
      prompt: "Examen sur le cours de Big Data",
      output: "Score: 15/20",
    });
    res.json(exam);
  } catch (err) {
    console.error("🔥 Erreur création examen :", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});



// ✅ Place cette route en HAUT du fichier, avant toute route avec "/:id"
router.get("/my-attempts", ensureAuthenticated, async (req, res) => {
  try {
    const attempts = await AttemptExam.find({ user: req.user._id })
      .populate({
        path: "exam",
        populate: {
          path: "courses",
          populate: { path: "subject" }
        }
      })
      .sort({ submittedAt: -1 });

    const formatted = attempts
      .filter(a => a.exam && Array.isArray(a.exam.courses) && a.exam.courses.length > 0)
      .map(a => ({
        _id: a._id,
        score: a.score,
        total: a.answers.length,
        submittedAt: a.submittedAt,
        exam: a.exam._id,
        course: a.exam.courses[0]._id,
        courseTitle: a.exam.courses[0].title || "Unknown",
        subject: a.exam.courses[0].subject || null
      }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Erreur récupération des tentatives :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ❌ Cette route doit rester EN DERNIER
router.get("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate("courses");
    if (!exam) return res.status(404).json({ message: "Examen introuvable." });
    res.json(exam);
  } catch (err) {
    console.error("Erreur récupération examen:", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});


/* ---------- POST /api/exam/:id/submit ---------- */
router.post("/:id/submit", ensureAuthenticated, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate("courses");
    if (!exam) return res.status(404).json({ message: "Examen non trouvé." });

    const { answers } = req.body;
    const normalize = s => (s || "")
      .trim()
      .replace(/^[0-9]+[.)-]?\s*/, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const feedback = exam.questions.map((q, i) => {
      const userAns = normalize(answers[i]?.answer);
      const expected = normalize(q.answer);
      const correct = q.type === "QCM"
        ? userAns === expected
        : stringSimilarity.compareTwoStrings(userAns, expected) >= 0.7;

      return {
        question: q.question,
        type: q.type,
        answer: answers[i]?.answer,
        expected: q.answer,
        correct
      };
    });

    const score = feedback.filter(f => f.correct).length;

    await AttemptExam.create({
      user: req.user._id,
      exam: exam._id,
      answers: feedback,
      score,
      submittedAt: new Date(),
    });

    res.json({ score, total: exam.questions.length, feedback });
  } catch (err) {
    console.error("Erreur soumission examen :", err);
    res.status(500).json({ message: "Erreur lors de la soumission." });
  }
});

/* ---------- GET /api/exam/by-course/:courseId ---------- */
router.get("/by-course/:courseId", ensureAuthenticated, async (req, res) => {
  try {
    const exam = await Exam.findOne({
      user: req.user._id,
      courses: req.params.courseId,
    }).sort({ createdAt: -1 });

    if (!exam) return res.status(404).json({ message: "Aucun examen trouvé." });
    res.json(exam);
  } catch (err) {
    console.error("Erreur recherche examen par cours:", err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});




module.exports = router;
