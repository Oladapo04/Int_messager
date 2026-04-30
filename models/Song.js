const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, default: "", trim: true },
    lyrics: [{
      line: { type: String, required: true },
      order: { type: Number, required: true },
      isChorus: { type: Boolean, default: false },
      isBridge: { type: Boolean, default: false }
    }],
    key: { type: String, default: "", trim: true }, // musical key
    tempo: { type: String, default: "", trim: true },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Song", songSchema);