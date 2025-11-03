const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ["QCM", "Cours", "Mixte"], // On conserve Mixte ici aussi pour flexibilité
    required: true 
  },
  question: { type: String, required: true },
  options: { 
    type: [String], 
    required: function() {
      return this.type === "QCM"; // Seulement requis pour les QCM
    }
  },
  answer: { type: String, required: true },
  sourceCourse: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Course"
  }
});

const ExamSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { 
    type: String, 
    enum: ["QCM", "Cours", "Mixte"], // Mixte bien maintenu ici !
    required: true 
  },
  questions: [QuestionSchema],
  courses: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Course",
    required: true
  }],
  questionCount: { 
    type: Number, 
    default: 10,
    min: 1,
    max: 50 
  },
  isCombined: {
    type: Boolean,
    default: function() {
      return this.courses.length > 1;
    }
  },
  combinedTitle: {
    type: String,
    required: function() {
      return this.isCombined;
    }
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true }); // Alternative pour createdAt/updatedAt

module.exports = mongoose.model("Exam", ExamSchema);