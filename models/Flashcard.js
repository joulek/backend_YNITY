const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  choices: {
    type: [String], // tableau de propositions
    required: true,
    validate: {
      validator: function (val) {
        return val.length >= 3 && val.includes(this.answer);
      },
      message: "Le champ 'choices' doit contenir au moins 3 propositions incluant la bonne réponse.",
    },
  },
});

module.exports = mongoose.model("Flashcard", flashcardSchema);
