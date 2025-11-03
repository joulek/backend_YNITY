const express = require("express");
const router = express.Router();
const Course = require("../models/Course");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { trackUsage } = require("../utils/trackUsage");
const sendMail = require("../utils/mailer");
const { extractTextFromPDF, saveTextAsPDF } = require("../utils/pdfUtils");
const summarizeTextWithIA = require("../utils/summarizeIA");
const Flashcard = require("../models/Flashcard");
// ✅ Cette route retourne uniquement les cours ayant au moins une flashcard
router.get("/with-flashcards", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    const coursesWithFlashcards = await Flashcard.aggregate([
      {
        $group: {
          _id: "$courseId",
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $match: { "course.createdBy": userId }, // ✅ suffisant
      },
      {
        $project: {
          _id: "$course._id",
          title: "$course.title",
        },
      },
    ]);

    res.json(coursesWithFlashcards);
  } catch (err) {
    console.error("Erreur /with-flashcards:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// ✅ Middleware d’authentification
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Non authentifié" });
}
// ✅ Récupérer le résumé existant
// 1️⃣ Générer le résumé (IA)  → POST /api/course/summarize/:id
const { extractText } = require("../utils/fileExtractor");

router.post("/summarize/:id", ensureAuthenticated, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course || !course.file)
      return res.status(404).json({ error: "Cours introuvable" });

    const filePath = path.join(__dirname, "..", course.file);
    const text = await extractText(filePath);

    const mode = req.body.mode === "short" ? "short" : "long";
    const summary = await summarizeTextWithIA(text, mode);

    course.summaryText = summary;
    await course.save();
     try {
          await sendMail({
            to: req.user.email,
            subject: "📚 Your summarize have been generated!",
            html: `
          <h2>Hello ${req.user.name || "User"},</h2>
          <p>The summarize for the course <strong>${course.title}</strong> have been successfully generated! 🎉</p>
          <p>You can now view them in your YnityLearn dashboard.</p>
          <p style="margin-top: 20px;">Thank you for using our platform,<br>The YnityLearn Team</p>
        `,
          });
          console.log("✅ Email sent to", req.user.email);
        } catch (mailErr) {
          console.error("❌ Failed to send mail:", mailErr);
        }
    await trackUsage({
      user: req.user._id,
      type: "summary",
      prompt: `Résumé ${mode} du cours : ${course.title}`,
      output: summary,
    });
    res.json({ success: true, summaryText: summary, courseId: course._id });
  } catch (err) {
    console.error("Erreur résumé IA :", err);
    res.status(500).json({ error: "Erreur lors du résumé" });
  }
});


// ───────────────────────────────────────────────────────────────────────────
// 2️⃣ Récupérer le résumé  → GET /api/course/:id/summary
router.get("/:id/summary", ensureAuthenticated, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course || !course.summaryText)
      return res.status(404).json({ error: "Résumé introuvable" });

    res.json({
      title: course.title,
      summaryText: course.summaryText,
      summaryPdf: course.summaryPdf || null, // si jamais tu as un PDF
    });
  } catch (err) {
    console.error("Erreur fetch résumé :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Configuration de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  },
});

router.get("/by-subject/:subjectId", ensureAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({
      subject: req.params.subjectId,
      createdBy: req.user._id, // ✅ champ correct
    }).populate("subject");

    res.json(courses);
  } catch (err) {
    console.error("Erreur récupération cours par matière :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Créer un cours
router.post(
  "/create",
  ensureAuthenticated,
  upload.single("file"),
  async (req, res) => {
    const { title } = req.body;
    const filePath = req.file?.path;

    const course = new Course({
      title,
      file: filePath,
      createdBy: req.user._id,
      subject: req.body.subjectId,
    });

    await course.save();
    res.status(201).json(course);
  }
);

// ✅ Modifier un cours
router.put(
  "/update/:id",
  ensureAuthenticated,
  upload.single("file"),
  async (req, res) => {
    try {
      const { title } = req.body;
      const filePath = req.file?.path;
      const update = { title };
      if (filePath) update.file = filePath;

      const updated = await Course.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user._id },
        update,
        { new: true }
      );
      if (!updated)
        return res.status(404).json({ message: "Cours non trouvé" });

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

// ✅ Supprimer un cours
router.delete("/delete/:id", ensureAuthenticated, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Cours introuvable" });

    if (course.file && fs.existsSync(course.file)) fs.unlinkSync(course.file);
    if (course.summary && fs.existsSync(`uploads/${course.summary}`))
      fs.unlinkSync(`uploads/${course.summary}`);

    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Cours supprimé avec succès" });
  } catch (err) {
    console.error("Erreur suppression cours :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ Lister les cours de l’utilisateur
router.get("/my", ensureAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({ user: req.user._id }).populate(
      "subject"
    );
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/by-subject/:subjectId", async (req, res) => {
  try {
    const courses = await Course.find({
      subject: req.params.subjectId,
      user: req.user._id,
    }).populate("subject"); // pour récupérer tout l'objet subject

    const formattedCourses = courses.map((course) => ({
      _id: course._id,
      title: course.title,
      description: course.description,
      chapters: course.chapters,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      subject: {
        _id: course.subject._id,
        label: course.subject.label || course.subject.title || "inconnu",
      },
    }));

    res.json(formattedCourses);
  } catch (err) {
    console.error("Erreur récupération cours :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});


// ✅ Résumer un cours en IA et générer un PDF

// 📁 routes/courseRoutes.js

// 🔗 /api/course/my-summaries  (renvoie uniquement les cours ayant summaryText)
router.get("/my-summaries", ensureAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({
      createdBy: req.user._id,
      summaryText: { $exists: true, $ne: "" },
    })
      .select("title summaryText summaryPdf createdAt") // champs utiles
      .sort({ updatedAt: -1 });

    res.json(courses);
  } catch (err) {
    console.error("Erreur my-summaries :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Supprimer un résumé (texte ou PDF)
router.delete("/summary/:id", ensureAuthenticated, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course || (!course.summaryText && !course.summaryPdf)) {
      return res
        .status(404)
        .json({ error: "Aucun résumé trouvé à supprimer." });
    }

    // Supprimer le fichier PDF s’il existe
    if (course.summaryPdf) {
      const summaryPath = path.join(__dirname, "..", course.summaryPdf);
      if (fs.existsSync(summaryPath)) fs.unlinkSync(summaryPath);
      course.summaryPdf = undefined;
    }

    // Supprimer le résumé texte
    course.summaryText = undefined;

    await course.save();
    res.json({ message: "Résumé supprimé avec succès." });
  } catch (err) {
    console.error("Erreur suppression résumé :", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});
router.get("/by-title/:title", ensureAuthenticated, async (req, res) => {
  try {
    const course = await Course.findOne({
      title: new RegExp(`^${req.params.title}$`, "i"), // recherche insensible à la casse
      createdBy: req.user._id,
    })
      .populate("subject", "label")
      .lean();

    if (!course) return res.status(404).json({ error: "Cours introuvable" });

    res.json({
      _id: course._id,
      title: course.title,
      file: course.file,
      summaryExists: !!course.summaryText,
      subject: course.subject?.label || "Non spécifié",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
