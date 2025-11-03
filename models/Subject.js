const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// ✅ éviter OverwriteModelError
module.exports =
  mongoose.models.Subject || mongoose.model("Subject", subjectSchema);
