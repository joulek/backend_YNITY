const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");

router.post("/", async (req, res) => {
  const { label } = req.body;
  const newSubject = new Subject({ label, createdBy: req.user._id });
  await newSubject.save();
  res.status(201).json(newSubject);
});

router.get("/", async (req, res) => {
  const subjects = await Subject.find({ createdBy: req.user._id });
  res.json(subjects);
});

router.put("/:id", async (req, res) => {
  const { label } = req.body;
  const updated = await Subject.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user._id },
    { label },
    { new: true }
  );
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await Subject.deleteOne({ _id: req.params.id, createdBy: req.user._id });
  res.json({ message: "Matière supprimée" });
});

module.exports = router;
