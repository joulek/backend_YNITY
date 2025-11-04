const express = require("express");
const axios = require("axios");
const Chapter = require("../models/Chapter.js");

const router = express.Router();

// ✅ Inline authentication middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

// ✅ Generate Chapter + Save
router.post("/chapter", ensureAuthenticated, async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user.id || req.user._id;

    if (!description) {
      return res.status(400).json({ error: "Description required" });
    }

    // ✅ Call Python API
    const fastApiRes = await axios.post(
      "https://agents-python-1.onrender.com/agent/generate-chapter",
      { description }
    );

    const chapterText = fastApiRes?.data?.reply;

    // ✅ Validate returned chapter
    if (!chapterText || chapterText.trim().length < 50) {
      console.log("⚠️ AI returned empty or invalid content:", fastApiRes.data);
      return res.status(500).json({
        error: "AI did not return valid chapter content. Try again."
      });
    }

    // ✅ Save to DB
    const newChapter = await Chapter.create({
      userId,
      description,
      chapterContent: chapterText.trim(),
    });

    res.json({
      success: true,
      message: "✅ Chapter generated & saved",
      data: newChapter
    });

  } catch (err) {
    console.error("❌ Chapter generation error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get user chapters
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
    console.error("❌ Delete chapter error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
