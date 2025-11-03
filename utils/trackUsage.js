const Tracking = require("../models/Tracking"); // ton modèle MongoDB
const axios = require("axios");

// Fonction d'enrichissement via Tavily
async function enrichWithTavily(prompt) {
  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        query: prompt,
        api_key: process.env.TAVILY_API_KEY, // ajoute cette clé dans ton .env
        include_answer: true,
        max_results: 3,
      }
    );
    return response.data;
  } catch (err) {
    console.error("❌ Tavily API error:", err.message);
    return null;
  }
}

// Fonction principale de tracking
exports.trackUsage = async ({ user, type, prompt, output }) => {
  try {
    const tavilyData = await enrichWithTavily(prompt);

    await Tracking.create({
      user,
      type,
      prompt,
      output,
      tavilyAnswer: tavilyData?.answer || null,
      tavilySources: tavilyData?.results || [],
    });

    console.log("✅ Usage tracked with Tavily enrichment");
  } catch (err) {
    console.error("❌ Erreur tracking:", err.message);
  }
};
