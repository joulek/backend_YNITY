// 📁 backend/models/Revision.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const revisionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  courseId: {
    type: Schema.Types.ObjectId,
    ref: "Course"
  },
  title: String,
  date: String, // YYYY-MM-DD
  eventId: {
    type: String,
    required: true,
    unique: true,
  },
  startedAt: Date,
  endedAt: Date,
  durationMinutes: Number,
  reminderSent: {
  type: Boolean,
  default: false
}

});

module.exports = mongoose.model("Revision", revisionSchema);
