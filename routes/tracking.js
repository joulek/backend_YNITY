const express = require("express");
const router = express.Router();
const Tracking = require("../models/Tracking"); // ton modèle MongoDB
const { trackUsage } = require("../utils/trackUsage");

// 🔐 Middleware d’auth (ex: req.user)
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Non authentifié" });
}

// 📥 GET - récupérer tous les usages de l’utilisateur
router.get("/",  ensureAuth,async (req, res) => {
  try {
    const usages = await Tracking.find().sort({ createdAt: -1 }).populate("user", "name"); // << Ici
    res.json(usages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📤 POST - ajouter un usage manuellement (optionnel si auto via trackUsage)
router.post("/", ensureAuth, async (req, res) => {
  const { type, prompt, output } = req.body;
  try {
    await trackUsage({ user: req.user._id, type, prompt, output });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Erreur tracking:", err.message);
    res.status(500).json({ error: "Erreur tracking" });
  }
});

module.exports = router;
