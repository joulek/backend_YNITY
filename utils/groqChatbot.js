const axios = require("axios");

async function getChatbotReplyFromLLM(conversationMessages) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant pédagogique intelligent et bienveillant qui aide les étudiants à mieux comprendre leurs cours et à apprendre plus facilement.",
        },
        ...conversationMessages.map((msg) => ({
          role: msg.role === "bot" ? "assistant" : "user",
          content: msg.content,
        })),
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

module.exports = getChatbotReplyFromLLM;
