const axios = require("axios");

exports.generateImage = async (prompt) => {
  if (!prompt) {
    throw new Error("❌ Prompt manquant pour la génération d'image");
  }

  try {
    const response = await axios.post("https://agents-python.onrender.com/agent/image", {
      prompt: prompt,
    });

    if (response.data && response.data.url) {
      return response.data.url;
    } else {
      console.error("❌ Réponse agent invalide :", response.data);
      return null;
    }
  } catch (e) {
    console.error("❌ Erreur appel agent image :", e.message || e);
    return null;
  }
};
