// backend/models/Course.js
const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true },
    file:        { type: String, required: true },         // chemin PDF
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject:     { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },

    flashcards:  [{ question: String, answer: String }],

    summaryText: { type: String },                         // 🔹 texte généré par IA
    /* facultatif : si tu stockes aussi la version PDF */
    summaryPdf:  { type: String },                         // ex : "resumes/summary-123.pdf"
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Course || mongoose.model("Course", courseSchema);
