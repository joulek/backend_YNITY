const mongoose = require("mongoose");

const flashcardResultSchema = new mongoose.Schema({
  flashcard: { type: mongoose.Schema.Types.ObjectId, ref: "Flashcard" },
  correct: Boolean,
});

const attemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
  total: Number,
  correct: Number,
  flashcards: [flashcardResultSchema],
  createdAt: { type: Date, default: Date.now },
});





module.exports = mongoose.model("Attempt", attemptSchema);
