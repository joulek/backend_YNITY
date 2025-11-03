const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
  question: String,
  type: { type: String, enum: ["QCM", "Cours"] },
  answer: String,         // réponse de l’utilisateur
  expected: String,       // réponse correcte (pour QCM)
  correct: Boolean,
}, { _id: false });

const AttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
  answers: [AnswerSchema],
  score: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AttemptExam", AttemptSchema);
