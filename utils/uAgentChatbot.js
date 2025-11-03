const axios = require("axios");

const getAgentChatbotResponse = async (messages) => {
  try {
    const res = await axios.post("http://localhost:8003/agent/chat", {
      messages,
    });
    return res.data.reply;
  } catch (err) {
    console.error("Erreur appel uAgent :", err.message);
    return "Désolé, je n'ai pas pu répondre pour l'instant.";
  }
};

module.exports = getAgentChatbotResponse;
