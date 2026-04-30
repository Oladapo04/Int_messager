const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    isDirect: { type: Boolean, default: false },
    participants: [{ type: String, trim: true }],
    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);