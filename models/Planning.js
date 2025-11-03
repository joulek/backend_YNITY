const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema({
  title: String,
  duration: String,
  start: String,  // ⏱️ facultatif si IA donne heure exacte
  end: String,
  subjectId: String,        // ✅ ajouter
  subjectLabel: String,
});

const examSchema = new mongoose.Schema({
  type: String,
  hour: String,
});

const daySchema = new mongoose.Schema({
  date: String,
  revisions: [revisionSchema],
  exams: [examSchema],
});

const planningSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  title: {
    type: String,
    default: "Mon planning IA", // 📝 Titre personnalisable
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  nbJours: Number,
  planning: [daySchema],
});

module.exports = mongoose.model("Planning", planningSchema);
