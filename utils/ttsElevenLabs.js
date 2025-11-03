const axios = require("axios");

exports.textToSpeech = async (text) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) throw new Error("❌ Clé API OpenAI manquante");

  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1", // ou "tts-1-hd"
        voice: "nova",  // ou "alloy", "echo", "fable", "onyx", "shimmer"
        input: text,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    return data; // audio buffer (MPEG)
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("❌ Erreur OpenAI TTS:", msg);
    throw err;
  }
};
