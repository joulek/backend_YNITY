const mongoose = require("mongoose");

const trackingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true }, // ex: 'flashcard', 'exam', 'planning'
  prompt: String,
  output: String,
  tavilyAnswer: String,
  tavilySources: [
    {
      title: String,
      url: String,
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Tracking", trackingSchema);
