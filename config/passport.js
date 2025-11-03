const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const mongoose = require("mongoose");

// ✅ Modèle utilisateur
const User = require("../models/User");

// 🎯 Sérialisation de l'utilisateur (en session)
passport.serializeUser((user, done) => {
  done(null, user.id); // Stocker l'id MongoDB
});

// 🎯 Désérialisation de l'utilisateur
passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => done(null, user))
    .catch(err => done(err, null));
});

// ✅ Configuration de la stratégie Google
passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,               // 🔐 depuis .env
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,       // 🔐 depuis .env
    callbackURL: process.env.GOOGLE_CALLBACK_URL          // ✅ ne pas laisser localhost
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Vérifie si l'utilisateur existe déjà
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        return done(null, existingUser);
      }

      // Crée un nouvel utilisateur
      const newUser = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0]?.value || "",
        avatar: profile.photos?.[0]?.value || ""
      });

      await newUser.save();
      done(null, newUser);
    } catch (err) {
      done(err, null);
    }
  }
));
