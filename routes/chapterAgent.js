const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const Chapter = require("../models/Chapter.js");

const router = express.Router();

// ✅ Inline authentication middleware (simple, no external file)
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}


// ✅ Generate Chapter + Save
router.post("/chapter", ensureAuthenticated, async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user.id || req.user._id; // JWT user format

    if (!description) {
      return res.status(400).json({ error: "Description required" });
    }

    // Call Python Agent
    const fastApiRes = await axios.post(
      "http://127.0.0.1:8004/agent/generate-chapter",
      { description }
    );

    const chapterText = fastApiRes.data.reply;

    // Save to DB
    const newChapter = await Chapter.create({
      userId,
      description,
      chapterContent: chapterText
    });

    res.json({
      success: true,
      message: "✅ Chapter generated & saved",
      data: newChapter
    });

  } catch (err) {
    console.log("❌ Chapter generation error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get logged-in user chapters
router.get("/chapters", ensureAuthenticated, async (req, res) => {
  const userId = req.user.id || req.user._id;

  const list = await Chapter.find({ userId }).sort({ createdAt: -1 });
  res.json(list);
});
// ✅ Delete chapter
router.delete("/chapter/:id", ensureAuthenticated, async (req, res) => {
  try {
    const chapterId = req.params.id;
    const userId = req.user.id || req.user._id;

    // ⚠️ Check if chapter exists and belongs to user
    const chapter = await Chapter.findOne({ _id: chapterId, userId });

    if (!chapter) {
      return res.status(404).json({ error: "Chapitre introuvable ou accès refusé" });
    }

    await Chapter.findByIdAndDelete(chapterId);

    res.json({
      success: true,
      message: "🗑️ Chapter deleted successfully",
      id: chapterId
    });

  } catch (err) {
    console.error("❌ Delete chapter error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});


router.delete("/chapter/:id", ensureAuthenticated, async (req, res) => {
  try {
    const chapterId = req.params.id;
    const userId = req.user.id || req.user._id;

    // ⚠️ Check if chapter exists and belongs to user
    const chapter = await Chapter.findOne({ _id: chapterId, userId });

    if (!chapter) {
      return res.status(404).json({ error: "Chapitre introuvable ou accès refusé" });
    }

    await Chapter.findByIdAndDelete(chapterId);

    res.json({
      success: true,
      message: "🗑️ Chapter deleted successfully",
      id: chapterId
    });

  } catch (err) {
    console.error("❌ Delete chapter error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;