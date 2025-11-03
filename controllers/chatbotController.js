
const path = require("path");

const axios = require("axios");
const getChatbotResponse = require("../utils/uAgentChatbot");
const Conversation = require("../models/Conversation");
const { textToSpeech } = require("../utils/ttsElevenLabs");
const fs = require("fs");
const { generateTextFile, generatePDF } = require("../utils/fileGenerator");
const { generateImage } = require("../utils/imageGenerator");


exports.askChatbot = async (req, res) => {
  const { question, conversationId, useVoice } = req.body;
  const userId = req.user._id;

  if (!question) return res.status(400).json({ error: "Missing question" });

  try {
    let isNew = false;
    let conversation =
      conversationId &&
      (await Conversation.findOne({ _id: conversationId, userId }));

    if (!conversation || conversation.messages.length > 50) {
      isNew = true;
      conversation = new Conversation({ userId, messages: [] });
    }

    // 🔹 Add user message
    conversation.messages.push({ role: "user", content: question });

    // 🔹 Check if message should trigger the CoachAgent
    const lowerQuestion = question.toLowerCase();

   const triggers = [
  // ENGLISH
  "i'm tired", "i feel tired", "so tired", "i'm exhausted", "i feel exhausted",
  "i feel down", "i'm discouraged", "i feel discouraged", "i feel lost",
  "i'm lost", "i can't anymore", "i give up", "i feel stuck",
  "no motivation", "i have no motivation", "i lost motivation",
  "i'm unmotivated", "i feel empty", "i feel hopeless", "i'm hopeless",
  "i feel useless", "i'm stressed", "i'm overwhelmed", "i feel overwhelmed",
  "i'm anxious", "i feel anxious", "i panic", "i feel panic",
  "i feel sad", "i’m sad", "i'm depressed", "i feel depressed",
  "i need support", "i need help", "help me", "please help me",
  "i can't handle this", "i don't know what to do",
  "everything is too much", "i feel weak", "i feel like crying",
  "i'm burned out", "burned out", "i want to quit",
  "i feel pressure", "i'm not okay", "i'm not fine",

  // Slang / casual English
  "i'm done", "i'm so done", "mentally drained", "i’m drained",
  "life is hard", "struggling", "i can't fight anymore",
  "i fail", "i keep failing", "nothing works",

  // FRENCH 🇫🇷
  "je suis fatigué", "je suis fatiguée", "trop fatigué", "épuisé", "épuisée",
  "je suis épuisé", "je suis épuisée", "je n’en peux plus",
  "j’en peux plus", "c’est trop", "c’est dur", "je suis découragé",
  "je suis découragée", "je me sens perdu", "je me sens perdue",
  "je suis perdu", "je suis perdue", "je me sens vide",
  "je suis stressé", "je suis stressée", "je suis dépassé",
  "je suis dépassée", "je suis triste", "je me sens triste",
  "je suis anxieux", "je suis anxieuse", "je panique",
  "je n’ai plus de motivation", "pas de motivation",
  "j’ai perdu la motivation", "je veux abandonner",
  "je baisse les bras", "j'abandonne", "j’ai peur",
  "je ne vais pas bien", "ça ne va pas", "aidez moi",
  "j’ai besoin d’aide", "aide moi", "s'il vous plaît aidez moi",
  "je ne sais plus quoi faire", "je me sens inutile",
  "je suis à bout", "ça suffit", "marre de tout",
  "je craque", "je pleure", "envie de pleurer",
  "je suis en burn out", "burnout", "trop de pression",
  "je n’y arrive pas", "rien ne marche", "je suis perdu mentalement"
];


    const isCoachMessage = triggers.some(trigger =>
      lowerQuestion.includes(trigger)
    );

    if (isCoachMessage) {
      // 🔹 Call CoachAgent only for motivational messages
      const coachRes = await axios.post("http://127.0.0.1:8002/agent/chat", {
        prompt: question,
      });

      const coachReply =
        coachRes.data?.reply || "I'm here to encourage you and help you move forward!";

      // 🔹 Add coach message to conversation
      conversation.messages.push({
        role: "coach",
        content: coachReply,
      });

      // 🔹 Generate title if it's a new conversation
      if (isNew) {
        conversation.title = `Motivational Support - ${new Date().toLocaleDateString()}`;
      }

      await conversation.save();

      return res.json({
        content: coachReply,
        source: "coach",
        conversationId: conversation._id,
        title: conversation.title,
      });
    }

    // 🔹 Standard chatbot processing
    const historyPrompt =
      conversation.messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n") + `\nUser: ${question}`;

    const chatbotRes = await axios.post("http://127.0.0.1:8001/agent/chat", {
      prompt: historyPrompt,
    });

    const replyText = chatbotRes.data.reply || "I'm not sure I understand your question.";

    // 🔹 Generate title for new conversation
    if (isNew) {
      const titlePrompt = `Generate a short title for this conversation: ${question}`;
      const titleRes = await axios.post("http://127.0.0.1:8001/agent/chat", {
        prompt: titlePrompt,
      });
      conversation.title = (titleRes.data.reply || "New conversation").slice(0, 50);
    }

    // 🔹 Special response formats
    let audioUrl = null;
    let fileUrl = null;
    let imageUrl = null;

    const wantsVoice =
      useVoice ||
      lowerQuestion.includes("voice reply") ||
      lowerQuestion.includes("respond in voice");

    if (wantsVoice) {
      const audioBuffer = await textToSpeech(replyText);
      const fileName = `resp-${Date.now()}.mp3`;
      const audioPath = path.join(__dirname, "../public/audio", fileName);
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      fs.writeFileSync(audioPath, audioBuffer);
      audioUrl = `/audio/${fileName}`;
    }

    if (lowerQuestion.includes("pdf file") || lowerQuestion.includes("pdf")) {
      fileUrl = generatePDF(replyText);
    }

    if (lowerQuestion.includes("image")) {
      const generatedImage = await generateImage(question);
      if (generatedImage) {
        imageUrl = generatedImage;
      }
    }

    // 🔹 Add assistant reply to conversation
    conversation.messages.push({
      role: "bot",
      content: replyText,
      ...(audioUrl && { audioUrl }),
      ...(imageUrl && { imageUrl }),
      ...(fileUrl && { fileLink: fileUrl }),
    });

    await conversation.save();

    res.json({
      content: replyText,
      source: "bot",
      ...(audioUrl && { audioUrl }),
      ...(fileUrl && { fileUrl }),
      ...(imageUrl && { imageUrl }),
      conversationId: conversation._id,
      title: conversation.title,
    });

  } catch (err) {
    console.error("❌ Chatbot error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getConversationHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversation = await Conversation.findOne({ userId }).sort({
      createdAt: -1,
    });

    if (!conversation) return res.json({ messages: [] });
    res.json({ messages: conversation.messages });
  } catch (err) {
    console.error("❌ Erreur historique:", err);
    res
      .status(500)
      .json({ error: "Erreur lors du chargement de l'historique" });
  }
};

exports.getAllConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    const conversations = await Conversation.find({ userId }).sort({
      createdAt: -1,
    });
    res.json(conversations);
  } catch (err) {
    console.error("Erreur getAllConversations:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

exports.getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!conversation)
      return res.status(404).json({ error: "Conversation introuvable" });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: "Erreur récupération conversation" });
  }
};

exports.createConversation = async (req, res) => {
  const { title } = req.body;
  const conversation = new Conversation({
    userId: req.user._id,
    title: title || "New conversation",
    messages: [],
  });
  await conversation.save();
  res.json(conversation);
};

// ✅ Renommer une conversation
exports.renameConversation = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const userId = req.user._id;

  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, userId },
      { title },
      { new: true }
    );
    if (!conversation)
      return res.status(404).json({ error: "Conversation not found" });
    res.json(conversation);
  } catch (err) {
    console.error("Erreur renommage :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// ✅ Supprimer une conversation
exports.deleteConversation = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const result = await Conversation.deleteOne({ _id: id, userId });
    res.json({ success: result.deletedCount === 1 });
  } catch (err) {
    console.error("Erreur suppression :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

exports.transcribeAudio = async (req, res) => {
  const filePath = req.file.path;

  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("model", "whisper-1");

    const whisperRes = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    res.json({ text: whisperRes.data.text });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Erreur de transcription" });
  } finally {
    fs.unlinkSync(filePath);
  }
};

exports.chatbotReplyWithTTS = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message vide" });

  try {
    const reply = await getChatbotResponse([
      { role: "user", content: message },
    ]);
    const audioBuffer = await textToSpeech(reply);

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    console.error("Erreur de réponse vocale :", err);
    res
      .status(500)
      .json({ error: "Erreur dans la génération de la réponse vocale" });
  }
};
