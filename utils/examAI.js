const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function trimContentToMaxWords(text, maxWords = 1000) {
  return text.split(/\s+/).slice(0, maxWords).join(" ");
}

function extractJsonArray(text) {
  try {
    if (!text || typeof text !== "string") throw new Error("Réponse vide ou invalide");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) throw new Error("Aucun tableau JSON trouvé");
    const json = text.substring(start, end + 1);
    return JSON.parse(json);
  } catch (err) {
    console.error("❌ Erreur d'extraction JSON:", err.message);
    return [];
  }
}

async function callLLaMA(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        }),
      });

      const text = await res.text();

      if (res.status === 429) {
        console.warn("⏳ Trop de requêtes (429). Pause 3s...");
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      if (!res.ok) throw new Error(`API error: ${res.status} - ${text}`);

      const data = JSON.parse(text);
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Réponse vide de LLaMA");
      return content;
    } catch (err) {
      console.error(`Tentative ${attempt} échouée:`, err.message);
      if (attempt === maxRetries)
        throw new Error("Échec après plusieurs tentatives: " + err.message);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function generateQCMQuestions(content, count) {
  const prompt = `
Tu es un générateur expert. Crée EXACTEMENT ${count} questions QCM dans ce format JSON :
[
  {
    "type": "QCM",
    "question": "Texte de la question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Bonne réponse (texte identique à une option)",
    "explanation": "Justification courte"
  }
]

Contenu :
${trimContentToMaxWords(content, 1000)}
`;

  try {
    const response = await callLLaMA(prompt);
    const parsed = extractJsonArray(response);
    return JSON.stringify(parsed.slice(0, count));
  } catch (err) {
    console.error("Erreur génération QCM:", err.message);
    return JSON.stringify([
      {
        type: "QCM",
        question: "Service temporairement indisponible",
        options: ["A", "B", "C", "D"],
        answer: "A",
        explanation: "Fallback",
      },
    ]);
  }
}

async function generateCourseQuestions(content, count) {
  const prompt = `
Tu es un professeur. Crée EXACTEMENT ${count} questions ouvertes dans ce format :
[
  {
    "type": "Cours",
    "question": "Texte de la question",
    "answer": "Réponse attendue",
    "keywords": ["mot1", "mot2"]
  }
]

Contenu :
${trimContentToMaxWords(content, 1000)}
`;

  try {
    const response = await callLLaMA(prompt);
    const parsed = extractJsonArray(response);
    return JSON.stringify(parsed.slice(0, count));
  } catch (err) {
    console.error("Erreur génération Cours:", err.message);
    return JSON.stringify([
      {
        type: "Cours",
        question: "Décrivez le concept central (service indisponible)",
        answer: "Réponse par défaut",
        keywords: ["fallback"],
      },
    ]);
  }
}

async function generateMixedQuestions(content, count) {
  const prompt = `
Génère ${count} questions mixtes (moitié QCM, moitié Cours) dans ce format strict :
[
  {
    "type": "QCM",
    "question": "Texte de la question",
    "options": ["A", "B", "C", "D"],
    "answer": "Bonne réponse",
    "explanation": "Explication"
  },
  {
    "type": "Cours",
    "question": "Texte question ouverte",
    "answer": "Réponse attendue",
    "keywords": ["mot1", "mot2"]
  }
]

Contenu :
${trimContentToMaxWords(content, 1000)}
`;

  try {
    const response = await callLLaMA(prompt);
    const parsed = extractJsonArray(response);
    return JSON.stringify(parsed.slice(0, count));
  } catch (err) {
    console.error("Erreur génération Mixte:", err.message);
    return JSON.stringify([]);
  }
}

module.exports = {
  trimContentToMaxWords,
  extractJsonArray,
  callLLaMA,
  generateQCMQuestions,
  generateCourseQuestions,
  generateMixedQuestions,
};
