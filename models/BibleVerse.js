const mongoose = require("mongoose");

const bibleVerseSchema = new mongoose.Schema(
  {
    book: { type: String, required: true, trim: true },
    chapter: { type: Number, required: true },
    verse: { type: Number, required: true },
    text: { type: String, required: true },
    version: { type: String, default: "KJV", trim: true },
    reference: { type: String, required: true, trim: true }, // e.g., "John 3:16"
  },
  { timestamps: true }
);

module.exports = mongoose.model("BibleVerse", bibleVerseSchema);