const { GROQ_API_KEY } = process.env;

async function generatePlanningIA({
  courses = [],
  exams = [],
  nbJours = 7
}) {
  const today = new Date().toISOString().split("T")[0];

  const courseList = courses
    .map(
      (c) =>
        `- ${c.title} [id: ${c.id}] (poids ${c.weight || 1})${
          c.summaryExists ? " [résumé]" : ""
        }`
    )
    .join("\n");

  const examList = exams.length
    ? exams
        .map(
          (e) =>
            `- ${new Date(e.date).toLocaleDateString()} à ${new Date(
              e.date
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })} : ${e.type} (${e.course || "cours non précisé"})`
        )
        .join("\n")
    : "Aucun examen fourni.";

  const prompt = `Tu es un assistant d'organisation scolaire pour étudiants.
Ta tâche est de générer un planning de révision personnalisé sur ${nbJours} jours à partir de la date du jour (${today}).

### Cours à réviser :
${courseList}

### Examens à venir :
${examList}

### Contraintes :
- Ne jamais planifier de révision le jour d’un examen.
- Répartir les révisions selon les poids indiqués.
- Pas plus de 4 h de révision par jour.
- Commencer par les matières les plus importantes.
- Répartir les révisions sur plusieurs jours si besoin.
- Si un résumé existe pour un cours, ajoute "summaryExists: true" dans la révision correspondante.
- Ne pas inclure de texte explicatif ou commentaire.
- Ta réponse doit être uniquement du JSON brut comme ci‑dessous.

### Format attendu :
[
  {
    "date": "2025-06-21",
    "revisions": [
      {
        "title": "PHP",
        "courseId": "_id",
        "start": "14:00",
        "end": "16:00",
        "summaryExists": true
      }
    ],
    "exams": []
  }
]`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "Tu es un assistant de planification IA.",
          },
          { role: "user", content: prompt },
        ],
      }),
    }
  );

  const result = await response.json();
  const fullText = result?.choices?.[0]?.message?.content || "[]";
  const match = fullText.match(/\[.*\]/s);
  const jsonText = match ? match[0] : "[]";

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    console.error("❌ Erreur parsing JSON IA :", err);
    return [];
  }
}

module.exports = { generatePlanningIA };
