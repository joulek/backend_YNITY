const axios = require("axios");
 import { removeStopwords } from "stopword";

/** 🔹 Nettoie un texte PDF brut (sauts de lignes, caractères spéciaux…) */
export function cleanText(txt) {
  return txt
    .replace(/\n{2,}/g, "\n")
    .replace(/[^\w\sÀ-ÿ.,;:!?()"'’\-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 🔹 Transforme une phrase en ensemble de tokens significatifs */
function tokenSet(str) {
  const raw = str
    .toLowerCase()
    .replace(/[^\w\sÀ-ÿ]/g, " ")
    .split(/\s+/);
  return new Set(removeStopwords(raw));
}

/** 🔹 Vérifie que ≥ 60 % des mots de la réponse apparaissent dans le texte */
export function answerInSource(answer, sourceTokens) {
  const ansTokens = tokenSet(answer);
  if (ansTokens.size === 0) return false;

  let overlap = 0;
  ansTokens.forEach((t) => {
    if (sourceTokens.has(t)) overlap += 1;
  });
  return overlap / ansTokens.size >= 0.6;
}

const generateFlashcardsWithIA = async (text) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
          model:"llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
  "Tu es un expert en pédagogie. À partir du texte fourni (issu d'un cours PowerPoint), génère uniquement des flashcards QCM pertinentes et fidèles au contenu. N'invente rien. Chaque flashcard doit correspondre exactement à une idée, une définition ou une notion mentionnée dans le texte.",
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

    // Extraction propre
    const content = response.data.choices?.[0]?.message?.content;

    // Sécurité : tentative de parse
    const flashcards = JSON.parse(content);

    if (!Array.isArray(flashcards)) throw new Error("Format de réponse invalide");

    return flashcards;
  } catch (error) {
    console.error("❌ Erreur IA Flashcards :", error?.response?.data || error.message);
    return []; // retourner une liste vide en cas d'erreur
  }
};
