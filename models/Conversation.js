const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "bot","coach"], required: true },
  // on garde le texte si tu veux le ré-utiliser (Whisper, recherche, etc.)
  content: { type: String, required: true },
  // ✅ nouveau champ pour le MP3
  audioUrl: { type: String },
  timestamp: { type: Date, default: Date.now },
  imageUrl: { type: String },

});

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, default: "Nouvelle conversation" },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Conversation", conversationSchema);
