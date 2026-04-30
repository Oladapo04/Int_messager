const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    roomSlug: { type: String, required: true, index: true },
    sender: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "file"], default: "text" },
    content: { type: String, required: true },
    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);