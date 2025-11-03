const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// ✅ Nouvelle route pour récupérer l'utilisateur connecté
router.get("/auth/user", (req, res) => {
  if (req.isAuthenticated()) {
    const user = {
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar || req.user.photo || req.user.picture || null,
      createdAt: req.user.createdAt, // 🔥 Très important !
    };
    res.json(user);
    console.log("✅ Utilisateur connecté :", req.user);
  } else {
    res.status(401).json({ message: "Non authentifié" });
  }
});
// POST /auth/reset-password/:token
router.post("/auth/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // 🔒 Vérifie que le mot de passe n'est pas vide ou trop court
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "Le mot de passe est trop court" });
  }

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré" });
    }

    // ✅ Le mot de passe est mis à jour brut, le modèle s’occupe du hash
    user.password = password;

    // 🧹 On efface les données de reset
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;

    // ✅ Sauvegarde avec hash automatique (si `pre('save')` est bien en place dans le modèle)
    await user.save();

    res.json({ message: "Mot de passe mis à jour avec succès" });
  } catch (err) {
    console.error("❌ Erreur réinitialisation mot de passe :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});


router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    // Générer un token
    const token = crypto.randomBytes(32).toString("hex");

    user.resetToken = token;
    user.resetTokenExpire = Date.now() + 3600000; // 1h
    await user.save();

    // Config envoi email (ex: Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SENDER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    await transporter.sendMail({
      to: user.email,
      subject: "Réinitialisation de mot de passe",
      html: `<p>Cliquez ici pour réinitialiser votre mot de passe : <a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    res.json({ message: "Email de réinitialisation envoyé" });
  } catch (err) {
    console.error("Erreur mot de passe oublié :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ Login (connexion)
router.post("/auth/login", async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res
        .status(401)
        .json({ message: "Email ou mot de passe incorrect" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: "Mot de passe incorrect" });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      res.json({
        message: "Connexion réussie",
        user: { name: user.name, email: user.email },
      });
    });
  } catch (err) {
    console.error("❌ Erreur login :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ Register (inscription)
router.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email déjà utilisé" });

    const newUser = await User.create({
      name,
      email,
      password, // 🔥 Laissez le modèle s’occuper du hash
    });

    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ message: "Erreur login" });
      res.status(201).json({
        message: "Inscription réussie",
        user: { name: newUser.name, email: newUser.email },
      });
    });
  } catch (err) {
    console.error("❌ Erreur d'inscription :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
 // ✅ Route pour changer le mot de passe

// ... les autres routes d'authentification comme /auth/google, /auth/logout, etc.
router.post("/auth/change-password", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Non autorisé" });

    const { currentPassword = "", newPassword = "" } = req.body;

    // 1️⃣  Validation newPassword
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    // 2️⃣  Cas GOOGLE sans mot de passe local
    if (user.provider === "google" && !user.password) {
      user.password = newPassword;          // sera hashé par le pré-hook
      await user.save();
      return res.json({ message: "Mot de passe défini avec succès" });
    }

    // 3️⃣  Cas LOCAL ou Google + déjà un mdp
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mot de passe actuel incorrect" });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: "Mot de passe changé avec succès" });
  } catch (err) {
    console.error("Erreur changement de mot de passe :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
module.exports = router;
