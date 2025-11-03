const axios = require("axios");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const mammoth = require("mammoth");

module.exports = async (req, res) => {
  const file = req.file;
  const { userPrompt } = req.body;

  if (!file) return res.status(400).json({ message: "Aucun fichier fourni." });

  try {
    let extractedText = "";

    if (file.mimetype === "application/pdf") {
      const buffer = fs.readFileSync(file.path);
      const pdf = await pdfParse(buffer);
      extractedText = pdf.text;
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const buffer = fs.readFileSync(file.path);
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (file.mimetype.startsWith("image/")) {
      const result = await Tesseract.recognize(file.path, "eng+fra");
      extractedText = result.data.text;
    } else {
      return res.status(400).json({ message: "Format non supporté." });
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant pédagogique expert qui répond aux questions basées sur des fichiers.",
          },
          {
            role: "user",
            content: `${userPrompt}\n\nVoici le contenu du fichier :\n\n${extractedText}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data.choices?.[0]?.message?.content || "Pas de réponse générée.";
    res.json({ response: result });
  } catch (err) {
    console.error("❌ Erreur analyse fichier :", err);
    res.status(500).json({ message: "Erreur serveur." });
  } finally {
    fs.unlink(file.path, () => {});
  }
};
