const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* 🔥 Helper — découpe texte pour éviter limite tokens */
function chunkText(text, maxLen = 7000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks;
}

/* 🔥 Helper — appel Groq */
async function callGroq(prompt) {
  while (true) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 1500, // ✅ reduced to avoid TPM spikes
        messages: [
          {
            role: "system",
            content:
              "Tu es un expert en synthèse universitaire. Résume avec titres, puces, exemples.",
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    const text = await res.text();

    // ✅ If OK, return summary
    if (res.ok) {
      const data = JSON.parse(text);
      return data.choices?.[0]?.message?.content?.trim() || "";
    }

    // ✅ If rate limit: wait then retry
    if (text.includes("rate_limit_exceeded")) {
      const match = text.match(/try again in ([0-9.]+)s/i);
      const waitSeconds = match ? parseFloat(match[1]) : 5;

      console.log(`⏳ Rate limit — waiting ${waitSeconds}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }

    // ❌ Other error
    throw new Error(text);
  }
}


/* ✅ Fonction principale */
async function summarizeTextWithIA(text, mode = "long") {
  if (!text || text.length < 50) throw new Error("Texte trop court pour résumé.");

  const prompts = {
    short: `Résumé clair en 20-30 lignes en bullet points.\n\n${text}`,
    medium: `Résumé structuré 50-70 lignes: introduction, points clés, exemple, conclusion.\n\n${text}`,
    long: `Synthèse détaillée style universitaire, titres + bullets + exemples.\n\n${text}`,
    bullets: `Résumé uniquement en bullet points:\n\n${text}`,
    plan: `Plan détaillé I/II/III avec A/B/C basé sur:\n\n${text}`,
    flash: `Créer 8 flashcards (Question -> Réponse) à partir du texte:\n\n${text}`,
    elevator: `Résumé en 5 lignes pour un CEO:\n\n${text}`
  };

  const userPrompt = prompts[mode] || prompts["long"];

  // 🔥 Split le texte si trop long
  const chunks = chunkText(text);
  let summaries = [];

  console.log(`📚 Texte divisé en ${chunks.length} parties`);

  for (let i = 0; i < chunks.length; i++) {
    console.log(`✏️ Résumé chunk ${i + 1}/${chunks.length}`);
    const summary = await callGroq(`Résumé de cette partie:\n\n${chunks[i]}`);
    summaries.push(summary);
  }

  // ✅ Fusionner les résumés partiels en un seul
  const finalPrompt = `
Fusionne ces résumés partiels en un résumé clair, cohérent, structuré:

${summaries.join("\n\n---\n\n")}
  
Format attendu :
- ✅ Introduction
- ✅ Points clés structurés
- ✅ Exemple concret
- ✅ Conclusion courte
`;

  return await callGroq(finalPrompt);
}

module.exports = summarizeTextWithIA;
