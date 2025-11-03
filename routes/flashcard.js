const express = require("express");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const Flashcard = require("../models/Flashcard");
const Course = require("../models/Course");
const sendMail = require("../utils/mailer");
const { trackUsage } = require("../utils/trackUsage");

const router = express.Router();
const { convertToText } = require("../utils/textExtractor");

const generateFlashcardsWithIA = async (text) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "Tu es un générateur de flashcards de type QCM. Réponds uniquement avec un tableau JSON contenant 5 à 10 objets au format : { question, answer, choices }. Chaque objet doit contenir une question claire, une réponse correcte (answer), et un tableau choices contenant 3 à 5 propositions incluant la bonne réponse. Ne donne aucun texte hors du JSON.",
          },
          {
            role: "user",
            content: `Voici le texte du cours :\n${text}`,
          },
        ],
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices?.[0]?.message?.content?.trim();
    const jsonStart = content.indexOf("[");
    const jsonEnd = content.lastIndexOf("]");

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("❌ Aucun tableau JSON détecté dans la réponse IA.");
    }

    const jsonString = content.substring(jsonStart, jsonEnd + 1);
    const flashcards = JSON.parse(jsonString);

    if (!Array.isArray(flashcards)) {
      throw new Error("❌ Format retourné non conforme à un tableau.");
    }

    const validFlashcards = flashcards.filter(
      (f) =>
        f.question &&
        f.answer &&
        Array.isArray(f.choices) &&
        f.choices.includes(f.answer)
    );

    if (validFlashcards.length === 0) {
      throw new Error("❌ Aucune flashcard valide trouvée.");
    }

    return validFlashcards;
  } catch (error) {
    console.error(
      "❌ Erreur IA Flashcards :",
      error?.response?.data || error.message
    );
    return [];
  }
};

/**
 * 📥 POST /generate/:courseId – Génère les flashcards d’un cours PDF/DOCX/PPTX
 */
router.post("/generate/:courseId", async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: "Cours introuvable" });

    let text = "";
    try {
      console.log("📂 Lecture fichier :", course.file);
      text = await convertToText(course.file);
      console.log("📄 Texte extrait (début) :", text.slice(0, 200));
    } catch (extractErr) {
      console.error("❌ Erreur extraction texte :", extractErr);
      return res
        .status(400)
        .json({ message: "Impossible de lire le fichier du cours." });
    }

    const flashcards = await generateFlashcardsWithIA(text);

    if (!flashcards.length) {
      return res.status(500).json({ message: "Aucune flashcard générée." });
    }

    const saved = await Flashcard.insertMany(
      flashcards.map((f) => ({
        courseId: course._id,
        question: f.question,
        answer: f.answer,
        choices: f.choices,
      }))
    );
    try {
      await sendMail({
        to: req.user.email,
        subject: "📚 Your flashcards have been generated!",
        html: `
      <h2>Hello ${req.user.name || "User"},</h2>
      <p>The flashcards for the course <strong>${course.title}</strong> have been successfully generated! 🎉</p>
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
      type: "flashcard", // ou "exam"
      prompt: "Génération de flashcards pour le cours XYZ",
      output: JSON.stringify(flashcards), // ou examData
    });
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Erreur génération flashcards :", err);
    res.status(500).json({ message: "Erreur lors de la génération." });
  }
});

/**
 * 📤 GET /:courseId – Récupérer les flashcards d’un cours
 */
router.get("/:courseId", async (req, res) => {
  try {
    const flashcards = await Flashcard.find({ courseId: req.params.courseId });
    res.json(flashcards);
  } catch (err) {
    console.error("❌ Erreur récupération flashcards :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
