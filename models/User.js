const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  googleId:  { type: String, sparse: true }, // ✅ retirer unique
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  avatar:    { type: String },
  password:  { type: String, minlength: 8 },
  provider:  { type: String, enum: ["local", "google"], default: "local" },
  createdAt: { type: Date, default: Date.now },
  resetToken: String,
  resetTokenExpire: Date,
});

/* ----------- Hachage mot de passe ----------- */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ----------- Méthode de comparaison ----------- */
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
