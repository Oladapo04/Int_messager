const mongoose = require("mongoose");

const keyPointSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    category: {
      type: String,
      enum: ["main-point", "quote", "prayer-request", "announcement", "other"],
      default: "main-point"
    },
    speaker: { type: String, default: "", trim: true },
    timestamp: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    sessionId: { type: String, default: "", trim: true }, // for grouping points from same session
  },
  { timestamps: true }
);

module.exports = mongoose.model("KeyPoint", keyPointSchema);