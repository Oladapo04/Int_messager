require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const notificationService = require("./server/services/notificationService");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const { Server } = require("socket.io");
const mongoose = require("mongoose");
const webPush = require("web-push");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
function sanitizeFileName(name = "file") {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const originalName = file.originalname || "file";

    const safeName = sanitizeFileName(originalName);

    const isImage = file.mimetype.startsWith("image/");
    const isAudio = file.mimetype.startsWith("audio/");
    const isVideo = file.mimetype.startsWith("video/");

    let resourceType = "raw";

    if (isImage) resourceType = "image";
    if (isAudio || isVideo) resourceType = "video";

    return {
      folder: "int-messager",
      resource_type: resourceType,
      public_id: `${Date.now()}_${safeName}`,
      overwrite: false,
      invalidate: true,
      use_filename: false,
      unique_filename: true,
    };
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype) {
      return cb(new Error("Invalid file type"));
    }

    cb(null, true);
  },
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ extended: true, limit: "1gb" }));

const PORT = process.env.PORT || 3001;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/int_messager";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const APP_BASE_URL = String(process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const PASSWORD_RESET_EXPIRES_MINUTES = Math.max(5, Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 20));
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "Int-Messager <no-reply@int-messager.local>";
const ADMIN_EMAILS_RAW = process.env.ADMIN_EMAILS || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const CALL_RING_TIMEOUT_MS = 30000; // 30 seconds before an unanswered call is marked missed
const ALLOWED_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👏", "💯", "😆", "😎", "🤔", "😡", "💔", "✅", "👀", "🙌"];

/* =========================
   SAFE CALL STATE
========================= */

const callRooms = Object.create(null);
const profileSockets = Object.create(null);

function ensureCallRoom(roomSlug) {
  if (!roomSlug) return null;

  if (!callRooms[roomSlug]) {
    callRooms[roomSlug] = {
      participants: {},
      timeoutId: null,
      answered: false,
      callType: "audio",
      callLogId: null,
    };
  }

  return callRooms[roomSlug];
}

function getCallParticipants(roomSlug) {
  return Object.values(callRooms[roomSlug]?.participants || {});
}

function rememberSocketProfile(socket, profileId) {
  if (!socket || !profileId) return;

  const nextProfileId = String(profileId);
  const previousProfileId = socket.data?.profileId ? String(socket.data.profileId) : "";

  if (previousProfileId && previousProfileId !== nextProfileId && profileSockets[previousProfileId]) {
    profileSockets[previousProfileId].delete(socket.id);
    if (!profileSockets[previousProfileId].size) delete profileSockets[previousProfileId];
  }

  socket.data.profileId = nextProfileId;
  if (!profileSockets[nextProfileId]) profileSockets[nextProfileId] = new Set();
  profileSockets[nextProfileId].add(socket.id);
}

function forgetSocketProfile(socket) {
  const profileId = socket?.data?.profileId ? String(socket.data.profileId) : "";
  if (!profileId || !profileSockets[profileId]) return;

  profileSockets[profileId].delete(socket.id);
  if (!profileSockets[profileId].size) delete profileSockets[profileId];
}

async function notifyIncomingCall(socket, roomSlug, profileId, name, ioInstance, callType = "audio") {
  if (!roomSlug) return;

  const payload = {
    roomSlug,
    fromSocketId: socket.id,
    profileId: profileId || null,
    name: name || "User",
    callType: callType === "video" ? "video" : "audio",
  };

  // Only General is a public/group room. Every other room is treated as private.
  if (roomSlug === "general") {
    socket.broadcast.emit("call:incoming", payload);
    return;
  }

  const room = await Room.findOne({ slug: roomSlug }).lean();
  const participants = Array.isArray(room?.participants) ? room.participants : [];
  participants.forEach((participantId) => {
    const participantKey = String(participantId);
    if (participantKey === String(profileId || "")) return;

    const socketIds = profileSockets[participantKey];
    if (!socketIds) return;

    socketIds.forEach((socketId) => {
      if (socketId !== socket.id) ioInstance.to(socketId).emit("call:incoming", payload);
    });
  });
}


async function resolveProfileDisplayName(profileId, fallback = "User") {
  if (!profileId) return fallback || "User";
  try {
    const profile = await Profile.findById(profileId).select("displayName").lean();
    return profile?.displayName || fallback || "User";
  } catch (error) {
    return fallback || "User";
  }
}

function getCallState(roomSlug) {
  const participants = getCallParticipants(roomSlug);
  return {
    roomSlug,
    active: participants.length > 0,
    callType: callRooms[roomSlug]?.callType || "audio",
    participants,
  };
}

function emitCallState(roomSlug, ioInstance) {
  ioInstance.to(roomSlug).emit("call:state", getCallState(roomSlug));
  ioInstance.emit("rooms_updated");
}

async function endCallRoom(roomSlug, ioInstance, reason = "ended", statusOverride = null) {
  const room = callRooms[roomSlug];
  if (!room) return;

  if (room.timeoutId) {
    clearTimeout(room.timeoutId);
    room.timeoutId = null;
  }

  const endedPayload = { roomSlug, reason };
  ioInstance.to(`call_${roomSlug}`).emit("call:ended", endedPayload);
  // Also notify users who only had an incoming-call popup and had not joined the call room yet.
  ioInstance.emit("call:ended", endedPayload);

  Object.keys(room.participants || {}).forEach((socketId) => {
    const participantSocket = ioInstance.sockets.sockets.get(socketId);
    if (participantSocket) participantSocket.leave(`call_${roomSlug}`);
  });

  await finishCallLog(roomSlug, statusOverride);
  delete callRooms[roomSlug];
  emitCallState(roomSlug, ioInstance);
  ioInstance.emit("calls_updated");
}

async function removeCallParticipant(socket, roomSlug, ioInstance) {
  const room = callRooms[roomSlug];
  if (!room?.participants?.[socket.id]) return;

  const participantCountBeforeLeave = Object.keys(room.participants || {}).length;

  delete room.participants[socket.id];

  socket.leave(`call_${roomSlug}`);

  socket.to(`call_${roomSlug}`).emit("call:user-left", {
    socketId: socket.id,
  });

  try {
    const dbRoom = await Room.findOne({ slug: roomSlug }).lean();

    // Private calls are one-to-one: if either user leaves, end for both.
    // Group/general calls must continue when one participant leaves.
    if (roomSlug !== "general" && participantCountBeforeLeave > 1) {
      await endCallRoom(roomSlug, ioInstance, "private-peer-left");
      return;
    }
  } catch (error) {
    console.error("direct call end check error:", error);
  }

  ioInstance.to(`call_${roomSlug}`).emit("call:participants", {
    roomSlug,
    participants: getCallParticipants(roomSlug),
  });

  if (!Object.keys(room.participants).length) {
    if (room.timeoutId) {
      clearTimeout(room.timeoutId);
      room.timeoutId = null;
    }
    await finishCallLog(roomSlug);
    delete callRooms[roomSlug];
    ioInstance.emit("call:ended", { roomSlug, reason: "caller-left-before-answer" });
    ioInstance.emit("calls_updated");
  }

  emitCallState(roomSlug, ioInstance);
}

/* =========================
   DATABASE
========================= */

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected");
}

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    isDirect: { type: Boolean, default: false },
    isSaved: { type: Boolean, default: false, index: true },
    ownerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", default: null, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }],
    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const messageTypeEnum = ["text", "file", "audio"];

const messageSchema = new mongoose.Schema(
  {
    roomSlug: { type: String, required: true, index: true },
    sender: { type: String, required: true, trim: true },
    senderProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      default: null,
    },
    type: { type: String, enum: messageTypeEnum, default: "text" },
    content: { type: String, required: true },
    isEncrypted: { type: Boolean, default: false },
    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    encryptedFile: { type: Boolean, default: false },

    replyTo: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },
      sender: { type: String, default: "" },
      content: { type: String, default: "" },
      type: { type: String, enum: messageTypeEnum, default: "text" },
      fileName: { type: String, default: "" },
    },

    forwardedFrom: {
      sender: { type: String, default: "" },
      roomSlug: { type: String, default: "" },
    },

    reactions: {
      type: Map,
      of: [String],
      default: {},
    },

    starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }],
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", default: null },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }],

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
  },
  { timestamps: true }
);

messageSchema.set("toObject", { flattenMaps: true });
messageSchema.set("toJSON", { flattenMaps: true });

const profileSchema = new mongoose.Schema(
  {
    installId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    email: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, index: true, trim: true },
    passwordHash: { type: String, default: "" },
    accountVerified: { type: Boolean, default: true },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    accountStatus: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, default: "", trim: true },
    lastLoginAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: "", select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    passwordResetRequestedAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    displayName: { type: String, default: "", trim: true },
    profileStatus: { type: String, default: "Available now", trim: true },
    avatarUrl: { type: String, default: "" },
    nameLocked: { type: Boolean, default: false },
    activeChat: { type: Boolean, default: false },
    username: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
    pinnedRooms: { type: [String], default: [] },
    archivedRooms: { type: [String], default: [] },
    mutedRooms: { type: [String], default: [] },
    manuallyUnreadRooms: { type: [String], default: [] },
    keepArchivedOnNewMessage: { type: Boolean, default: true },
    pushSubscriptions: {
      type: [Object],
      default: [],
    },
  },
  { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);
const Message = mongoose.model("Message", messageSchema);
const Profile = mongoose.model("Profile", profileSchema);

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
  deviceName: { type: String, default: "Unknown device" },
  browser: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  ipAddress: { type: String, default: "" },
  lastActiveAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });
const AuthSession = mongoose.model("AuthSession", sessionSchema);


const callLogSchema = new mongoose.Schema(
  {
    roomSlug: { type: String, required: true, index: true },
    title: { type: String, default: "" },
    isDirect: { type: Boolean, default: false },
    callerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", default: null },
    callerName: { type: String, default: "" },
    participantProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }],
    missedProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }],
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    answeredAt: { type: Date, default: null },
    callType: { type: String, enum: ["audio", "video"], default: "audio" },
    status: { type: String, enum: ["active", "answered", "missed", "rejected"], default: "active" },
  },
  { timestamps: true }
);

const CallLog = mongoose.model("CallLog", callLogSchema);
const chatClearSchema = new mongoose.Schema({
  roomSlug: { type: String, required: true, index: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
  clearedAt: { type: Date, default: Date.now },
}, { timestamps: true });
chatClearSchema.index({ roomSlug: 1, profileId: 1 }, { unique: true });
const ChatClear = mongoose.model("ChatClear", chatClearSchema);

const hiddenChatSchema = new mongoose.Schema({
  roomSlug: { type: String, required: true, index: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true, index: true },
  hiddenAt: { type: Date, default: Date.now },
}, { timestamps: true });
hiddenChatSchema.index({ roomSlug: 1, profileId: 1 }, { unique: true });
const HiddenChat = mongoose.model("HiddenChat", hiddenChatSchema);


async function startCallLog(roomSlug, profileId, name, callType = "audio") {
  const room = await Room.findOne({ slug: roomSlug }).lean();
  const isGeneralCall = roomSlug === "general";
  const participants = isGeneralCall
    ? Object.keys(profileSockets)
    : (Array.isArray(room?.participants) ? room.participants : []);
  const missedProfileIds = participants.filter((id) => String(id) !== String(profileId || ""));
  const log = await CallLog.create({
    roomSlug,
    title: isGeneralCall ? "General" : (room?.name || roomSlug),
    isDirect: !isGeneralCall,
    callerProfileId: profileId || null,
    callerName: name || "User",
    callType: callType === "video" ? "video" : "audio",
    participantProfileIds: profileId ? [profileId] : [],
    missedProfileIds,
    startedAt: new Date(),
    status: "active",
  });
  const callRoom = ensureCallRoom(roomSlug);
  if (callRoom) callRoom.callLogId = log._id;
  return log;
}

async function markCallAnswered(roomSlug, profileId) {
  const room = callRooms[roomSlug];
  if (!room?.callLogId || !profileId) return null;

  const log = await CallLog.findById(room.callLogId);
  if (!log) return null;

  if (!log.answeredAt) log.answeredAt = new Date();
  if (!log.participantProfileIds.some((id) => String(id) === String(profileId))) {
    log.participantProfileIds.push(profileId);
  }
  log.missedProfileIds = (log.missedProfileIds || []).filter((id) => String(id) !== String(profileId));
  log.status = "answered";
  await log.save();
  return log.answeredAt;
}

async function finishCallLog(roomSlug, statusOverride) {
  const room = callRooms[roomSlug];
  if (!room?.callLogId) return;
  const log = await CallLog.findById(room.callLogId);
  if (!log || log.endedAt) return;
  const endedAt = new Date();
  log.endedAt = endedAt;
  if (statusOverride) {
    log.status = statusOverride;
    log.durationSeconds = log.answeredAt
      ? Math.max(0, Math.round((endedAt.getTime() - new Date(log.answeredAt).getTime()) / 1000))
      : 0;
  } else if (log.missedProfileIds?.length && (!log.participantProfileIds || log.participantProfileIds.length <= 1)) {
    log.status = "missed";
    log.durationSeconds = 0;
  } else {
    log.status = "answered";
    const durationStart = log.answeredAt || log.startedAt;
    log.durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(durationStart).getTime()) / 1000));
  }
  await log.save();
}

/* =========================
   HELPERS
========================= */

function getBearerToken(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function verifyAuthToken(token) {
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function issueAuthToken(profile) {
  return jwt.sign(
    { profileId: String(profile._id), installId: profile.installId || "" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function getInstallId(req) {
  const tokenPayload = verifyAuthToken(getBearerToken(req));
  if (tokenPayload?.installId) return String(tokenPayload.installId).trim();
  return (req.headers["x-install-id"] || req.body?.installId || req.query?.installId || "")
    .toString()
    .trim();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function configuredAdminEmails() {
  return new Set(
    String(ADMIN_EMAILS_RAW || "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  );
}

function isConfiguredAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && configuredAdminEmails().has(normalized));
}

async function ensureConfiguredAdminRole(profile) {
  if (!profile) return profile;
  if (isConfiguredAdminEmail(profile.email) && profile.role !== "admin") {
    profile.role = "admin";
    await profile.save();
  }
  return profile;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^+\d]/g, "").trim();
}

const passwordResetAttempts = new Map();

function passwordResetRateKey(req, identifier = "") {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${normalizeEmail(identifier) || normalizePhone(identifier)}`;
}

function consumePasswordResetAttempt(req, identifier) {
  const key = passwordResetRateKey(req, identifier);
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const current = passwordResetAttempts.get(key);
  if (!current || now - current.startedAt > windowMs) {
    passwordResetAttempts.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= maxAttempts) return false;
  current.count += 1;
  return true;
}

function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
  };
}

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function hasUsableSmtpConfiguration() {
  const host = String(SMTP_HOST || "").trim().toLowerCase();
  const user = String(SMTP_USER || "").trim().toLowerCase();
  const pass = String(SMTP_PASS || "").trim();
  if (!host || !user || !pass) return false;
  if (host === "smtp.example.com" || host.endsWith(".example.com")) return false;
  if (user.includes("your-smtp") || user.includes("example.com")) return false;
  if (pass === "your-smtp-password" || pass.toLowerCase().includes("replace")) return false;
  return true;
}

function getMailTransporter() {
  if (!hasUsableSmtpConfiguration()) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendPasswordResetEmail(profile, resetUrl) {
  const transporter = getMailTransporter();
  const displayName = profile.displayName || "there";
  const subject = "Reset your Int-Messager password";
  const text = `Hello ${displayName},\n\nUse this link to reset your Int-Messager password:\n${resetUrl}\n\nThis link expires in ${PASSWORD_RESET_EXPIRES_MINUTES} minutes. If you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2>Reset your Int-Messager password</h2><p>Hello ${displayName},</p><p>Use the button below to choose a new password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Reset password</a></p><p>This link expires in ${PASSWORD_RESET_EXPIRES_MINUTES} minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`;
  if (!transporter) {
    console.log("\n[DEV PASSWORD RESET LINK]\n" + resetUrl + "\n");
    return { delivered: false, developmentPreview: true };
  }
  try {
    await transporter.sendMail({ from: SMTP_FROM, to: profile.email, subject, text, html });
    return { delivered: true, developmentPreview: false };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("SMTP delivery failed; using development reset link instead:", error.message);
      console.log("\n[DEV PASSWORD RESET LINK]\n" + resetUrl + "\n");
      return { delivered: false, developmentPreview: true };
    }
    throw error;
  }
}

function parseDeviceName(req) {
  const ua = String(req.headers["user-agent"] || "");
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  if (/android/i.test(ua)) return "Android device";
  if (/windows/i.test(ua)) return "Windows device";
  if (/macintosh|mac os/i.test(ua)) return "Mac";
  return "Web browser";
}

async function createAuthSession(profile, req) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await AuthSession.create({ sessionId, profileId: profile._id, deviceName: parseDeviceName(req), browser: String(req.headers["sec-ch-ua"] || ""), userAgent: String(req.headers["user-agent"] || ""), ipAddress: String(req.ip || ""), expiresAt });
  return sessionId;
}

function issueSessionToken(profile, sessionId) {
  return jwt.sign({ profileId: String(profile._id), installId: profile.installId || "", sessionId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authResponse(profile, sessionId = "") {
  return {
    token: sessionId ? issueSessionToken(profile, sessionId) : issueAuthToken(profile),
    profile: {
      installId: profile.installId,
      profileId: profile._id,
      _id: profile._id,
      email: profile.email || "",
      phone: profile.phone || "",
      displayName: profile.displayName || "",
      profileStatus: profile.profileStatus || "Available now",
      avatarUrl: profile.avatarUrl || "",
      username: profile.username || "",
      pinnedRooms: profile.pinnedRooms || [],
      archivedRooms: profile.archivedRooms || [],
      mutedRooms: profile.mutedRooms || [],
      manuallyUnreadRooms: profile.manuallyUnreadRooms || [],
      nameLocked: profile.nameLocked,
      activeChat: profile.activeChat,
      role: profile.role || (isConfiguredAdminEmail(profile.email) ? "admin" : "user"),
      accountStatus: profile.accountStatus || "active",
    },
  };
}

function idsEqual(a, b) {
  return String(a) === String(b);
}

function normalizeDirectSlug(profileIdA, profileIdB) {
  const [a, b] = [String(profileIdA), String(profileIdB)].sort();
  return `dm:${a}:${b}`;
}

async function getProfileByInstallId(installId) {
  if (!installId) return null;
  const profile = await Profile.findOne({ installId });
  if (!profile || (profile.accountStatus || "active") === "suspended") return null;
  return profile;
}

async function ensureSavedMessagesRoom(profile) {
  if (!profile?._id) return null;

  const slug = `saved:${String(profile._id)}`;
  return Room.findOneAndUpdate(
    { slug },
    {
      $set: {
        name: "Saved Messages",
        isDirect: true,
        isSaved: true,
        ownerProfileId: profile._id,
        participants: [profile._id],
      },
      $setOnInsert: { slug },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}

async function ensurePublicRoom(roomSlug) {
  return Room.findOneAndUpdate(
    { slug: roomSlug },
    {
      $setOnInsert: {
        name: roomSlug === "general" ? "General" : roomSlug,
        slug: roomSlug,
        isDirect: false,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
}

function profileCanAccessRoom(profile, room) {
  if (!profile || !room) return false;
  if (!room.isDirect) return true;
  return (room.participants || []).some((participantId) =>
    idsEqual(participantId, profile._id)
  );
}

function publicProfileShape(profile) {
  return {
    _id: profile._id,
    displayName: profile.displayName,
    profileStatus: profile.profileStatus || "Available now",
    avatarUrl: profile.avatarUrl || "",
    activeChat: profile.activeChat,
  };
}

function roomResponseShape(room, currentProfileId) {
  const isParticipant = (room.participants || []).some((id) =>
    idsEqual(id, currentProfileId)
  );

  return {
    _id: room._id,
    name: room.name,
    slug: room.slug,
    isDirect: room.isDirect,
    isSaved: Boolean(room.isSaved),
    ownerProfileId: room.ownerProfileId || null,
    participants: room.participants || [],
    lastMessageText: room.lastMessageText || "",
    lastMessageAt: room.lastMessageAt,
    activeCall: getCallParticipants(room.slug).length > 0,
    activeCallParticipants: getCallParticipants(room.slug),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    isParticipant,
  };
}

function isEncryptedMessageContent(content) { return false; }
function buildReplyPayload(sourceMessage) {
  if (!sourceMessage) return null;

  return {
    messageId: sourceMessage._id,
    sender: sourceMessage.sender || "",
    content:
      sourceMessage.type === "file"
        ? sourceMessage.fileName || sourceMessage.content || "Attachment"
        : sourceMessage.type === "audio"
          ? "Voice note"
          : isEncryptedMessageContent(sourceMessage.content)
            ? "🔒 Encrypted message"
            : sourceMessage.content || "",
    type: sourceMessage.type || "text",
    fileName: sourceMessage.fileName || "",
  };
}

function messagePreviewText(message) {
  if (!message) return "";
  if (message.isDeleted) return "This message was deleted";
  if (message.isEncrypted && message.type === "text") return "🔒 Encrypted message";
  if (message.type === "audio") return "🎤 Voice note";
  if (message.type === "file") return `📎 ${message.fileName || message.content}`;
  return message.content || "";
}

async function refreshRoomLastMessage(roomSlug) {
  const latest = await Message.findOne({
    roomSlug,
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .lean();

  await Room.updateOne(
    { slug: roomSlug },
    {
      $set: {
        lastMessageText: latest ? messagePreviewText(latest) : "",
        lastMessageAt: latest ? latest.createdAt : null,
      },
    }
  );
}

async function getAuthorizedMessageForProfile(messageId, profile) {
  if (!messageId || !profile) return { message: null, room: null };

  const message = await Message.findById(messageId);
  if (!message) return { message: null, room: null };

  const room = await Room.findOne({ slug: message.roomSlug });
  if (!room || !profileCanAccessRoom(profile, room)) return { message: null, room: null };

  return { message, room };
}

async function updateMessageStatuses(roomSlug, currentProfileId, nextStatus) {
  if (!roomSlug || !currentProfileId) return [];

  const allowedStatuses =
    nextStatus === "seen" ? ["sent", "delivered"] : ["sent"];

  const messages = await Message.find({
    roomSlug,
    senderProfileId: { $ne: currentProfileId },
    isDeleted: { $ne: true },
    status: { $in: allowedStatuses },
  });

  if (!messages.length) return [];

  const updatedIds = messages.map((msg) => msg._id);

  await Message.updateMany(
    { _id: { $in: updatedIds } },
    { $set: { status: nextStatus } }
  );

  return Message.find({ _id: { $in: updatedIds } }).lean();
}

async function getUnreadCountsForProfileId(profileId) {
  if (!profileId) return {};

  const rooms = await Room.find({
    $or: [
      { isDirect: false },
      { isDirect: true, participants: profileId },
    ],
  }).lean();

  const counts = {};

  await Promise.all(
    rooms.map(async (room) => {
      counts[room.slug] = await Message.countDocuments({
        roomSlug: room.slug,
        senderProfileId: { $ne: profileId },
        isDeleted: { $ne: true },
        status: { $ne: "seen" },
      });
    })
  );

  return counts;
}

async function emitUnreadCountsForProfile(profileId, ioInstance) {
  if (!profileId) return;

  const socketIds = profileSockets[String(profileId)];
  if (!socketIds || !socketIds.size) return;

  const counts = await getUnreadCountsForProfileId(profileId);

  socketIds.forEach((socketId) => {
    ioInstance.to(socketId).emit("unread_counts_updated", counts);
  });
}

async function emitUnreadCountsForRoom(roomSlug, ioInstance) {
  if (!roomSlug) return;

  const room = await Room.findOne({ slug: roomSlug }).lean();

  if (room?.isDirect && Array.isArray(room.participants)) {
    await Promise.all(
      room.participants.map((profileId) =>
        emitUnreadCountsForProfile(profileId, ioInstance)
      )
    );
    return;
  }

  await Promise.all(
    Object.keys(profileSockets).map((profileId) =>
      emitUnreadCountsForProfile(profileId, ioInstance)
    )
  );
}



async function sendPushToProfile(profileId, payload = {}) {
  if (!profileId || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const profile = await Profile.findById(profileId);
  if (!profile?.pushSubscriptions?.length) return;

  const subscriptions = profile.pushSubscriptions || [];
  const nextSubscriptions = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(subscription, JSON.stringify(payload));
        nextSubscriptions.push(subscription);
      } catch (error) {
        const statusCode = error?.statusCode || 0;
        if (![404, 410].includes(statusCode)) {
          nextSubscriptions.push(subscription);
          console.error("push send error:", error?.message || error);
        }
      }
    })
  );

  if (nextSubscriptions.length !== subscriptions.length) {
    profile.pushSubscriptions = nextSubscriptions;
    await profile.save();
  }
}

async function emitMessageToRoomParticipants(roomSlug, message, ioInstance) {
  if (!roomSlug || !message) return;

  const room = await Room.findOne({ slug: roomSlug }).lean();

  if (room?.isDirect && Array.isArray(room.participants)) {
    room.participants.forEach((profileId) => {
      const socketIds = profileSockets[String(profileId)];
      if (!socketIds) return;
      socketIds.forEach((socketId) => {
        ioInstance.to(socketId).emit("receive_message", message);
      });
    });
    return;
  }

  ioInstance.to(roomSlug).emit("receive_message", message);
}

async function notifyMessagePush(roomSlug, message, senderProfileId) {
  const room = await Room.findOne({ slug: roomSlug }).lean();
  if (!room) return;

  const recipientIds = room.isDirect
    ? (room.participants || []).filter((id) => String(id) !== String(senderProfileId || ""))
    : Object.keys(profileSockets).filter((id) => String(id) !== String(senderProfileId || ""));

  const body =
    message.type === "audio"
      ? `${message.sender || "Someone"}: Voice note`
      : message.type === "file"
        ? `${message.sender || "Someone"}: ${message.fileName || "Attachment"}`
        : `${message.sender || "Someone"}: ${message.content || "New message"}`;

  await Promise.all(
    recipientIds.map((profileId) =>
      sendPushToProfile(profileId, {
        type: "message",
        title: room.name || "New message",
        body,
        roomSlug,
        url: `/?room=${encodeURIComponent(roomSlug)}`,
        tag: `message-${roomSlug}`,
      })
    )
  );
}

async function notifyCallPush(roomSlug, callerProfileId, callerName, callType = "audio") {
  const room = await Room.findOne({ slug: roomSlug }).lean();
  if (!room) return;

  const recipientIds = room.isDirect
    ? (room.participants || []).filter((id) => String(id) !== String(callerProfileId || ""))
    : Object.keys(profileSockets).filter((id) => String(id) !== String(callerProfileId || ""));

  await Promise.all(
    recipientIds.map((profileId) =>
      sendPushToProfile(profileId, {
        type: "call",
        title: `${callerName || "Someone"} is calling`,
        body: callType === "video" ? "Incoming video call" : "Incoming audio call",
        roomSlug,
        url: `/?room=${encodeURIComponent(roomSlug)}&call=1`,
        tag: `call-${roomSlug}`,
      })
    )
  );
}

function safeExportFileName(name) {
  return (name || "chat-export")
    .toString()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "chat-export";
}

function exportMessageText(message) {
  if (!message) return "";
  if (message.isDeleted) return "This message was deleted";
  if (message.type === "audio") return `Voice note${message.fileName ? ` (${message.fileName})` : ""}`;
  if (message.type === "file") return `Attachment: ${message.fileName || message.content || "file"}${message.fileUrl ? ` ${message.fileUrl}` : ""}`;
  return message.content || "";
}

function buildChatExportText(room, messages) {
  const title = room?.name || room?.slug || "Chat";
  const lines = [
    `Chat export: ${title}`,
    `Room: ${room?.slug || ""}`,
    `Exported at: ${new Date().toISOString()}`,
    `Messages: ${messages.length}`,
    "",
  ];

  messages.forEach((message) => {
    const timestamp = message.createdAt ? new Date(message.createdAt).toISOString() : "";
    const sender = message.sender || "User";
    const flags = [];
    if (message.pinned) flags.push("Pinned");
    if (Array.isArray(message.starredBy) && message.starredBy.length) flags.push("Starred");
    const flagText = flags.length ? ` [${flags.join(", ")}]` : "";
    lines.push(`[${timestamp}] ${sender}${flagText}: ${exportMessageText(message)}`);

    if (message.replyTo?.content || message.replyTo?.fileName) {
      lines.push(`  ↳ Reply to ${message.replyTo.sender || "User"}: ${message.replyTo.fileName || message.replyTo.content}`);
    }

    if (message.forwardedFrom?.sender) {
      lines.push(`  ↪ Forwarded from ${message.forwardedFrom.sender}`);
    }
  });

  lines.push("");
  return lines.join("\n");
}

async function getAuthenticatedProfile(req) {
  const payload = verifyAuthToken(getBearerToken(req));
  if (!payload?.profileId) return null;
  const profile = await Profile.findById(payload.profileId);
  if (!profile) return null;
  await ensureConfiguredAdminRole(profile);
  return profile;
}

async function requireAdmin(req, res, next) {
  try {
    const profile = await getAuthenticatedProfile(req);
    if (!profile) return res.status(401).json({ success: false, error: "Sign in required" });
    if ((profile.accountStatus || "active") === "suspended") {
      return res.status(403).json({ success: false, error: "This account is suspended" });
    }
    if (profile.role !== "admin" && !isConfiguredAdminEmail(profile.email)) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    req.adminProfile = profile;
    return next();
  } catch (error) {
    console.error("admin authorization error:", error);
    return res.status(500).json({ success: false, error: "Failed to verify admin access" });
  }
}

function registeredProfileQuery() {
  return {
    $or: [
      { email: { $exists: true, $nin: [null, ""] } },
      { phone: { $exists: true, $nin: [null, ""] } },
    ],
  };
}

function adminUserShape(profile, lastActiveAt = null) {
  const id = String(profile._id);
  return {
    _id: id,
    displayName: profile.displayName || "",
    username: profile.username || "",
    email: profile.email || "",
    phone: profile.phone || "",
    avatarUrl: profile.avatarUrl || "",
    profileStatus: profile.profileStatus || "Available now",
    role: profile.role || "user",
    accountStatus: profile.accountStatus || "active",
    accountVerified: profile.accountVerified !== false,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    lastLoginAt: profile.lastLoginAt || null,
    lastActiveAt: lastActiveAt || null,
    online: Boolean(profileSockets[id]?.size),
  };
}

/* =========================
   API ROUTES
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const displayName = String(req.body.displayName || "").trim();
    const legacyInstallId = String(req.body.legacyInstallId || "").trim();

    if (!email && !phone) return res.status(400).json({ success: false, error: "Email or phone number is required" });
    if (password.length < 8) return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    if (!displayName) return res.status(400).json({ success: false, error: "Display name is required" });

    const duplicate = await Profile.findOne({ $or: [email ? { email } : null, phone ? { phone } : null].filter(Boolean) });
    if (duplicate) return res.status(409).json({ success: false, error: "An account already exists with these details" });

    let profile = legacyInstallId ? await Profile.findOne({ installId: legacyInstallId }) : null;
    if (!profile) profile = new Profile({ installId: `account-${crypto.randomUUID()}` });

    profile.email = email || undefined;
    profile.phone = phone || undefined;
    profile.passwordHash = await bcrypt.hash(password, 12);
    profile.displayName = displayName.slice(0, 30);
    profile.nameLocked = true;
    profile.activeChat = true;
    profile.lastLoginAt = new Date();
    await profile.save();
    await ensureConfiguredAdminRole(profile);

    const sessionId = await createAuthSession(profile, req);
    notificationService.welcome(profile).catch((error) => console.warn("Welcome email failed:", error.message));
    io.emit("profiles_updated");
    return res.status(201).json({ success: true, data: authResponse(profile, sessionId) });
  } catch (error) {
    console.error("auth/register error:", error);
    return res.status(500).json({ success: false, error: "Failed to create account" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const genericMessage = "If an account matches those details, password reset instructions have been sent.";
  try {
    const identifier = String(req.body.identifier || "").trim();
    if (!identifier) return res.status(400).json({ success: false, error: "Email or phone number is required" });
    if (!consumePasswordResetAttempt(req, identifier)) {
      return res.status(429).json({ success: false, error: "Too many reset attempts. Please wait 15 minutes and try again." });
    }

    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);
    const profile = await Profile.findOne({ $or: [{ email }, { phone }] }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (!profile || !profile.email) {
      return res.json({ success: true, message: genericMessage });
    }

    const { token, tokenHash } = createPasswordResetToken();
    profile.passwordResetTokenHash = tokenHash;
    profile.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);
    profile.passwordResetRequestedAt = new Date();
    await profile.save();

    const resetUrl = `${APP_BASE_URL}/?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(profile.email)}`;
    const delivery = await notificationService.passwordReset(profile, resetUrl, PASSWORD_RESET_EXPIRES_MINUTES);
    const payload = { success: true, message: genericMessage };
    if (process.env.NODE_ENV !== "production" && delivery.developmentPreview) payload.developmentResetUrl = resetUrl;
    return res.json(payload);
  } catch (error) {
    console.error("auth/forgot-password error:", error);
    return res.json({ success: true, message: genericMessage });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const newPassword = String(req.body.newPassword || "");
    if (!token) return res.status(400).json({ success: false, error: "Reset token is required" });
    if (newPassword.length < 8) return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });

    const tokenHash = hashPasswordResetToken(token);
    const profile = await Profile.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (!profile) return res.status(400).json({ success: false, error: "This reset link is invalid or has expired" });

    profile.passwordHash = await bcrypt.hash(newPassword, 12);
    profile.passwordResetTokenHash = "";
    profile.passwordResetExpiresAt = null;
    profile.passwordChangedAt = new Date();
    await profile.save();
    await AuthSession.updateMany({ profileId: profile._id, revokedAt: null }, { $set: { revokedAt: new Date() } });

    return res.json({ success: true, message: "Password reset successful. Sign in again on your devices." });
  } catch (error) {
    console.error("auth/reset-password error:", error);
    return res.status(500).json({ success: false, error: "Failed to reset password" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "").trim();
    const password = String(req.body.password || "");
    const email = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);
    const profile = await Profile.findOne({ $or: [{ email }, { phone }] });

    if (!profile?.passwordHash || !(await bcrypt.compare(password, profile.passwordHash))) {
      return res.status(401).json({ success: false, error: "Incorrect email, phone number, or password" });
    }

    await ensureConfiguredAdminRole(profile);
    if ((profile.accountStatus || "active") === "suspended") {
      return res.status(403).json({ success: false, error: "This account has been suspended. Contact the administrator if you believe this is a mistake." });
    }

    profile.lastLoginAt = new Date();
    profile.activeChat = true;
    await profile.save();
    const sessionId = await createAuthSession(profile, req);
    notificationService.loginAlert(profile, parseDeviceName(req)).catch((error) => console.warn("Login alert failed:", error.message));
    return res.json({ success: true, data: authResponse(profile, sessionId) });
  } catch (error) {
    console.error("auth/login error:", error);
    return res.status(500).json({ success: false, error: "Failed to sign in" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const payload = verifyAuthToken(getBearerToken(req));
  if (!payload?.profileId) return res.status(401).json({ success: false, error: "Sign in required" });
  if (payload.sessionId) {
    const session = await AuthSession.findOne({ sessionId: payload.sessionId, profileId: payload.profileId, revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ success: false, error: "This device session has expired" });
    session.lastActiveAt = new Date();
    await session.save();
  }
  const profile = await Profile.findById(payload.profileId);
  if (!profile) return res.status(401).json({ success: false, error: "Account no longer exists" });
  await ensureConfiguredAdminRole(profile);
  if ((profile.accountStatus || "active") === "suspended") {
    return res.status(403).json({ success: false, error: "This account has been suspended" });
  }
  return res.json({ success: true, data: authResponse(profile, payload.sessionId || "") });
});

app.get("/api/auth/sessions", async (req, res) => {
  const payload = verifyAuthToken(getBearerToken(req));
  if (!payload?.profileId) return res.status(401).json({ success: false, error: "Sign in required" });
  const sessions = await AuthSession.find({ profileId: payload.profileId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastActiveAt: -1 }).lean();
  return res.json({ success: true, data: sessions.map((item) => ({ sessionId: item.sessionId, deviceName: item.deviceName, browser: item.browser, userAgent: item.userAgent, lastActiveAt: item.lastActiveAt, createdAt: item.createdAt, current: item.sessionId === payload.sessionId })) });
});

app.delete("/api/auth/sessions/:sessionId", async (req, res) => {
  const payload = verifyAuthToken(getBearerToken(req));
  if (!payload?.profileId) return res.status(401).json({ success: false, error: "Sign in required" });
  if (req.params.sessionId === payload.sessionId) return res.status(400).json({ success: false, error: "Use Sign out to remove this device" });
  await AuthSession.updateOne({ sessionId: req.params.sessionId, profileId: payload.profileId }, { $set: { revokedAt: new Date() } });
  return res.json({ success: true });
});

app.post("/api/auth/sessions/revoke-others", async (req, res) => {
  const payload = verifyAuthToken(getBearerToken(req));
  if (!payload?.profileId) return res.status(401).json({ success: false, error: "Sign in required" });
  await AuthSession.updateMany({ profileId: payload.profileId, sessionId: { $ne: payload.sessionId }, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return res.json({ success: true });
});

app.post("/api/auth/change-password", async (req, res) => {
  try {
    const payload = verifyAuthToken(getBearerToken(req));
    if (!payload?.profileId) return res.status(401).json({ success: false, error: "Sign in required" });
    const profile = await Profile.findById(payload.profileId);
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    if (!profile || !(await bcrypt.compare(currentPassword, profile.passwordHash || ""))) {
      return res.status(400).json({ success: false, error: "Current password is incorrect" });
    }
    if (newPassword.length < 8) return res.status(400).json({ success: false, error: "New password must be at least 8 characters" });
    profile.passwordHash = await bcrypt.hash(newPassword, 12);
    profile.passwordResetTokenHash = "";
    profile.passwordResetExpiresAt = null;
    profile.passwordChangedAt = new Date();
    await profile.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to change password" });
  }
});

/* =========================
   ADMIN API
========================= */

app.get("/api/admin/access", async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    if (!profile) {
      return res.status(401).json({ success: false, error: "Sign in required" });
    }

    const adminEmails = configuredAdminEmails();
    const email = normalizeEmail(profile.email);
    const configured = Boolean(email && adminEmails.has(email));
    const allowed = profile.role === "admin" || configured;

    if (configured && profile.role !== "admin") {
      profile.role = "admin";
      await profile.save();
    }

    return res.json({
      success: true,
      data: {
        allowed,
        role: configured ? "admin" : (profile.role || "user"),
        email: profile.email || "",
        accountStatus: profile.accountStatus || "active",
        configured,
        configuredAdminCount: adminEmails.size,
        serverConfigured: adminEmails.size > 0,
        message: allowed
          ? "Admin access is enabled for this account."
          : adminEmails.size === 0
            ? "ADMIN_EMAILS is not configured on the server."
            : "This signed-in email is not listed in ADMIN_EMAILS.",
      },
    });
  } catch (error) {
    console.error("admin access diagnostic error:", error);
    return res.status(500).json({ success: false, error: "Failed to check admin access" });
  }
});

app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const registeredQuery = registeredProfileQuery();
    const onlineProfileIds = Object.entries(profileSockets)
      .filter(([, sockets]) => sockets?.size)
      .map(([profileId]) => profileId);

    const [totalUsers, activeTodayByLogin, activeTodayBySession, newThisWeek, suspendedUsers, totalMessages] = await Promise.all([
      Profile.countDocuments(registeredQuery),
      Profile.countDocuments({ $and: [registeredQuery, { lastLoginAt: { $gte: startOfToday } }] }),
      AuthSession.distinct("profileId", { lastActiveAt: { $gte: startOfToday }, revokedAt: null }),
      Profile.countDocuments({ $and: [registeredQuery, { createdAt: { $gte: sevenDaysAgo } }] }),
      Profile.countDocuments({ $and: [registeredQuery, { accountStatus: "suspended" }] }),
      Message.countDocuments({}),
    ]);

    const onlineRegistered = onlineProfileIds.length
      ? await Profile.countDocuments({ $and: [registeredQuery, { _id: { $in: onlineProfileIds } }] })
      : 0;
    const activeTodayIds = new Set((activeTodayBySession || []).map((id) => String(id)));
    const activeToday = Math.max(activeTodayByLogin, activeTodayIds.size);

    return res.json({
      success: true,
      data: {
        totalUsers,
        onlineNow: onlineRegistered,
        activeToday,
        newThisWeek,
        suspendedUsers,
        totalMessages,
        generatedAt: now,
      },
    });
  } catch (error) {
    console.error("admin dashboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to load admin dashboard" });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all").trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const filters = [registeredProfileQuery()];

    if (["active", "suspended"].includes(status)) filters.push({ accountStatus: status });
    if (q) {
      const matcher = new RegExp(escapeRegex(q), "i");
      filters.push({
        $or: [
          { displayName: matcher },
          { username: matcher },
          { email: matcher },
          { phone: matcher },
        ],
      });
    }

    const profiles = await Profile.find({ $and: filters })
      .select("displayName username email phone avatarUrl profileStatus role accountStatus accountVerified lastLoginAt createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const ids = profiles.map((profile) => profile._id);
    const sessions = ids.length
      ? await AuthSession.aggregate([
          { $match: { profileId: { $in: ids }, revokedAt: null, expiresAt: { $gt: new Date() } } },
          { $group: { _id: "$profileId", lastActiveAt: { $max: "$lastActiveAt" }, activeSessionCount: { $sum: 1 } } },
        ])
      : [];
    const sessionMap = new Map(sessions.map((row) => [String(row._id), row]));

    return res.json({
      success: true,
      data: {
        users: profiles.map((profile) => {
          const session = sessionMap.get(String(profile._id));
          return {
            ...adminUserShape(profile, session?.lastActiveAt || profile.lastLoginAt || null),
            activeSessionCount: session?.activeSessionCount || 0,
          };
        }),
      },
    });
  } catch (error) {
    console.error("admin users error:", error);
    return res.status(500).json({ success: false, error: "Failed to load users" });
  }
});

app.get("/api/admin/users/:profileId", requireAdmin, async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.profileId)
      .select("displayName username email phone avatarUrl profileStatus role accountStatus accountVerified suspendedAt suspendedReason lastLoginAt createdAt updatedAt")
      .lean();
    if (!profile) return res.status(404).json({ success: false, error: "User not found" });

    const sessions = await AuthSession.find({
      profileId: profile._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("sessionId deviceName browser userAgent ipAddress lastActiveAt createdAt expiresAt")
      .sort({ lastActiveAt: -1 })
      .lean();

    const [messageCount, callCount] = await Promise.all([
      Message.countDocuments({ senderProfileId: profile._id }),
      CallLog.countDocuments({ $or: [{ callerProfileId: profile._id }, { participantProfileIds: profile._id }] }),
    ]);
    const lastActiveAt = sessions[0]?.lastActiveAt || profile.lastLoginAt || null;

    return res.json({
      success: true,
      data: {
        profile: adminUserShape(profile, lastActiveAt),
        online: Boolean(profileSockets[String(profile._id)]?.size),
        lastActiveAt,
        activeSessionCount: sessions.length,
        messageCount,
        callCount,
        sessions: sessions.map((session) => ({
          sessionId: session.sessionId,
          deviceName: session.deviceName,
          browser: session.browser,
          userAgent: session.userAgent,
          lastActiveAt: session.lastActiveAt,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        })),
      },
    });
  } catch (error) {
    console.error("admin user detail error:", error);
    return res.status(500).json({ success: false, error: "Failed to load user details" });
  }
});

app.patch("/api/admin/users/:profileId/status", requireAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, error: "Status must be active or suspended" });
    }

    const target = await Profile.findById(req.params.profileId);
    if (!target) return res.status(404).json({ success: false, error: "User not found" });
    if (String(target._id) === String(req.adminProfile._id)) {
      return res.status(400).json({ success: false, error: "You cannot suspend your own admin account" });
    }
    if (target.role === "admin" && status === "suspended") {
      return res.status(403).json({ success: false, error: "Admin accounts cannot be suspended from this dashboard" });
    }

    target.accountStatus = status;
    target.suspendedAt = status === "suspended" ? new Date() : null;
    target.suspendedReason = status === "suspended" ? String(req.body?.reason || "Suspended by administrator").slice(0, 200) : "";
    if (status === "suspended") target.activeChat = false;
    await target.save();

    if (status === "suspended") {
      await AuthSession.updateMany({ profileId: target._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      const socketIds = profileSockets[String(target._id)];
      if (socketIds) {
        [...socketIds].forEach((socketId) => {
          io.to(socketId).emit("account_suspended", { profileId: String(target._id) });
          io.sockets.sockets.get(socketId)?.disconnect(true);
        });
      }
    }

    io.emit("profiles_updated");
    return res.json({ success: true, data: adminUserShape(target, target.lastLoginAt) });
  } catch (error) {
    console.error("admin status update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update account status" });
  }
});


app.post("/api/admin/users/:profileId/send-password-reset", requireAdmin, async (req, res) => {
  try {
    const target = await Profile.findById(req.params.profileId)
      .select("+passwordResetTokenHash +passwordResetExpiresAt displayName email accountStatus");
    if (!target) return res.status(404).json({ success: false, error: "User not found" });
    if (!target.email) {
      return res.status(400).json({
        success: false,
        error: "This user does not have an email address. A reset link cannot be delivered.",
      });
    }

    const { token, tokenHash } = createPasswordResetToken();
    target.passwordResetTokenHash = tokenHash;
    target.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);
    target.passwordResetRequestedAt = new Date();
    await target.save();

    const resetUrl = `${APP_BASE_URL}/?resetToken=${encodeURIComponent(token)}&email=${encodeURIComponent(target.email)}`;
    const delivery = await notificationService.passwordReset(target, resetUrl, PASSWORD_RESET_EXPIRES_MINUTES);

    const payload = {
      success: true,
      message: delivery?.delivered
        ? `Password reset instructions were sent to ${target.email}.`
        : "Password reset link generated successfully.",
      data: {
        email: target.email,
        expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
        delivered: Boolean(delivery?.delivered),
      },
    };

    if (process.env.NODE_ENV !== "production" && delivery?.developmentPreview) {
      payload.data.developmentResetUrl = resetUrl;
    }

    return res.json(payload);
  } catch (error) {
    console.error("admin password reset error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create password reset request",
    });
  }
});

app.post("/api/admin/users/:profileId/revoke-sessions", requireAdmin, async (req, res) => {
  try {
    const target = await Profile.findById(req.params.profileId).select("_id displayName role");
    if (!target) return res.status(404).json({ success: false, error: "User not found" });
    if (String(target._id) === String(req.adminProfile._id)) {
      return res.status(400).json({ success: false, error: "Use your Security settings to manage your own sessions" });
    }

    const result = await AuthSession.updateMany(
      { profileId: target._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    const socketIds = profileSockets[String(target._id)];
    if (socketIds) {
      [...socketIds].forEach((socketId) => {
        io.to(socketId).emit("session_revoked", { profileId: String(target._id) });
        io.sockets.sockets.get(socketId)?.disconnect(true);
      });
    }

    return res.json({ success: true, data: { revokedCount: result.modifiedCount || 0 } });
  } catch (error) {
    console.error("admin revoke sessions error:", error);
    return res.status(500).json({ success: false, error: "Failed to revoke sessions" });
  }
});

app.get("/api", (req, res) => {
  res.send("Server is working");
});

app.post("/api/session/init", async (req, res) => {
  try {
    const installId = getInstallId(req);

    if (!installId) {
      return res.status(400).json({
        success: false,
        error: "installId is required",
      });
    }

    const tokenPayload = verifyAuthToken(getBearerToken(req));
    let profile = tokenPayload?.profileId ? await Profile.findById(tokenPayload.profileId) : await Profile.findOne({ installId });

    if (!profile) {
      profile = await Profile.create({
        installId,
        displayName: "",
        nameLocked: false,
        activeChat: false,
      });
    }

    return res.json({
      success: true,
      data: {
        installId: profile.installId,
        profileId: profile._id,
        displayName: profile.displayName,
        profileStatus: profile.profileStatus || "Available now",
        avatarUrl: profile.avatarUrl || "",
        email: profile.email || "",
        phone: profile.phone || "",
        nameLocked: profile.nameLocked,
        activeChat: profile.activeChat,
        role: profile.role || (isConfiguredAdminEmail(profile.email) ? "admin" : "user"),
        accountStatus: profile.accountStatus || "active",
      },
    });
  } catch (error) {
    console.error("session/init error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to initialize session",
    });
  }
});

app.post("/api/session/set-name", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const displayName = (req.body.displayName || "").trim();

    if (!installId) {
      return res.status(400).json({
        success: false,
        error: "installId is required",
      });
    }

    if (!displayName) {
      return res.status(400).json({
        success: false,
        error: "displayName is required",
      });
    }

    if (displayName.length > 30) {
      return res.status(400).json({
        success: false,
        error: "Name must be 30 characters or fewer",
      });
    }

    const existing = await Profile.findOne({ installId });

    const duplicateName = await Profile.findOne({
      displayName,
      activeChat: true,
      nameLocked: true,
      installId: { $ne: installId },
    });

    if (duplicateName) {
      return res.status(409).json({
        success: false,
        error: "That name is already in use right now",
      });
    }

    const profile = await Profile.findOneAndUpdate(
      { installId },
      {
        $set: {
          displayName,
          nameLocked: true,
          activeChat: true,
        },
        $setOnInsert: { installId },
      },
      { upsert: true, returnDocument: "after" }
    );

    io.emit("profiles_updated");

    return res.json({
      success: true,
      data: {
        installId: profile.installId,
        profileId: profile._id,
        displayName: profile.displayName,
        profileStatus: profile.profileStatus || "Available now",
        avatarUrl: profile.avatarUrl || "",
        email: profile.email || "",
        phone: profile.phone || "",
        nameLocked: profile.nameLocked,
        activeChat: profile.activeChat,
        role: profile.role || (isConfiguredAdminEmail(profile.email) ? "admin" : "user"),
        accountStatus: profile.accountStatus || "active",
      },
    });
  } catch (error) {
    console.error("session/set-name error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to save name",
    });
  }
});


app.post("/api/profile", (req, res) => {
  upload.single("avatar")(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        console.error("Profile upload error:", uploadError);
        return res.status(400).json({
          success: false,
          error: uploadError.message || "Profile image upload failed",
        });
      }

      if (req.file && !String(req.file.mimetype || "").startsWith("image/")) {
        return res.status(400).json({
          success: false,
          error: "Please choose a valid image file.",
        });
      }

      const tokenPayload = verifyAuthToken(getBearerToken(req));
      const requestInstallId = getInstallId(req);

      // Prefer the authenticated profile ID. The install ID fallback keeps
      // previously claimed accounts compatible while they migrate to JWT auth.
      let profile = null;
      if (tokenPayload?.profileId) {
        profile = await Profile.findById(tokenPayload.profileId);
      }
      if (!profile && requestInstallId) {
        profile = await Profile.findOne({ installId: requestInstallId });
      }

      if (!profile) {
        return res.status(401).json({
          success: false,
          error: "Your session has expired. Please sign in again.",
        });
      }

      const displayName = String(req.body?.displayName || "").trim();
      const profileStatus =
        String(req.body?.profileStatus || "").trim() || "Available now";

      if (!displayName) {
        return res.status(400).json({
          success: false,
          error: "Display name is required.",
        });
      }

      const duplicateName = await Profile.findOne({
        _id: { $ne: profile._id },
        displayName: { $regex: `^${escapeRegex(displayName)}$`, $options: "i" },
      }).lean();

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          error: "That display name is already in use.",
        });
      }

      profile.displayName = displayName;
      profile.profileStatus = profileStatus;
      profile.nameLocked = true;
      profile.activeChat = true;

      if (req.file?.path) {
        profile.avatarUrl = req.file.path;
      }

      await profile.save();
      io.emit("profiles_updated");

      return res.json({
        success: true,
        data: {
          installId: profile.installId,
          profileId: profile._id,
          _id: profile._id,
          email: profile.email || "",
          phone: profile.phone || "",
          displayName: profile.displayName || "",
          profileStatus: profile.profileStatus || "Available now",
          avatarUrl: profile.avatarUrl || "",
          username: profile.username || "",
          pinnedRooms: profile.pinnedRooms || [],
          archivedRooms: profile.archivedRooms || [],
          mutedRooms: profile.mutedRooms || [],
          manuallyUnreadRooms: profile.manuallyUnreadRooms || [],
          keepArchivedOnNewMessage: profile.keepArchivedOnNewMessage !== false,
          nameLocked: profile.nameLocked,
          activeChat: profile.activeChat,
          role: profile.role || (isConfiguredAdminEmail(profile.email) ? "admin" : "user"),
          accountStatus: profile.accountStatus || "active",
        },
      });
    } catch (error) {
      console.error("Profile update error:", error);
      const message = error?.name === "ValidationError"
        ? Object.values(error.errors || {}).map((item) => item.message).join(" ")
        : error?.code === 11000
          ? "That profile name or username is already in use."
          : error?.message || "Profile update failed.";
      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  });
});


app.get("/api/chat-preferences", async (req, res) => {
  try {
    const tokenPayload = verifyAuthToken(getBearerToken(req));
    if (!tokenPayload?.profileId) return res.status(401).json({ success: false, error: "Please sign in again." });
    const profile = await Profile.findById(tokenPayload.profileId).select("pinnedRooms archivedRooms mutedRooms manuallyUnreadRooms keepArchivedOnNewMessage").lean();
    if (!profile) return res.status(404).json({ success: false, error: "Profile not found." });
    return res.json({
      success: true,
      data: {
        pinnedRooms: profile.pinnedRooms || [],
        archivedRooms: profile.archivedRooms || [],
        mutedRooms: profile.mutedRooms || [],
        manuallyUnreadRooms: profile.manuallyUnreadRooms || [],
        keepArchivedOnNewMessage: profile.keepArchivedOnNewMessage !== false,
      },
    });
  } catch (error) {
    console.error("chat preferences load error:", error);
    return res.status(500).json({ success: false, error: "Failed to load chat preferences." });
  }
});

app.patch("/api/chat-preferences/pinned-order", async (req, res) => {
  try {
    const tokenPayload = verifyAuthToken(getBearerToken(req));
    if (!tokenPayload?.profileId) return res.status(401).json({ success: false, error: "Please sign in again." });

    const requested = Array.isArray(req.body?.roomSlugs) ? req.body.roomSlugs : [];
    const roomSlugs = [...new Set(requested.map((value) => String(value || "").trim()).filter(Boolean))];
    if (roomSlugs.length > 5) return res.status(400).json({ success: false, error: "You can pin a maximum of five chats." });

    const profile = await Profile.findById(tokenPayload.profileId)
      .select("pinnedRooms archivedRooms mutedRooms manuallyUnreadRooms keepArchivedOnNewMessage");
    if (!profile) return res.status(404).json({ success: false, error: "Profile not found." });

    const rooms = await Room.find({ slug: { $in: roomSlugs } }).select("slug isSaved isDirect participants").lean();
    const roomsBySlug = new Map(rooms.map((room) => [room.slug, room]));
    for (const slug of roomSlugs) {
      const room = roomsBySlug.get(slug);
      if (!room || room.isSaved || !profileCanAccessRoom(profile, room)) {
        return res.status(400).json({ success: false, error: "One or more chats cannot be pinned." });
      }
    }

    profile.pinnedRooms = roomSlugs;
    await profile.save();
    io.emit("profiles_updated");
    return res.json({ success: true, data: {
      pinnedRooms: profile.pinnedRooms || [], archivedRooms: profile.archivedRooms || [],
      mutedRooms: profile.mutedRooms || [], manuallyUnreadRooms: profile.manuallyUnreadRooms || [],
      keepArchivedOnNewMessage: profile.keepArchivedOnNewMessage !== false,
    }});
  } catch (error) {
    console.error("pinned chat order update error:", error);
    return res.status(500).json({ success: false, error: "Failed to save pinned chat order." });
  }
});

app.patch("/api/chat-preferences/archive-behaviour", async (req, res) => {
  try {
    const tokenPayload = verifyAuthToken(getBearerToken(req));
    if (!tokenPayload?.profileId) return res.status(401).json({ success: false, error: "Please sign in again." });
    const profile = await Profile.findById(tokenPayload.profileId)
      .select("pinnedRooms archivedRooms mutedRooms manuallyUnreadRooms keepArchivedOnNewMessage");
    if (!profile) return res.status(404).json({ success: false, error: "Profile not found." });
    profile.keepArchivedOnNewMessage = req.body?.keepArchivedOnNewMessage !== false;
    await profile.save();
    return res.json({ success: true, data: {
      pinnedRooms: profile.pinnedRooms || [], archivedRooms: profile.archivedRooms || [],
      mutedRooms: profile.mutedRooms || [], manuallyUnreadRooms: profile.manuallyUnreadRooms || [],
      keepArchivedOnNewMessage: profile.keepArchivedOnNewMessage !== false,
    }});
  } catch (error) {
    console.error("archive behaviour update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update archive behaviour." });
  }
});

app.patch("/api/chat-preferences/:roomSlug", async (req, res) => {
  try {
    const tokenPayload = verifyAuthToken(getBearerToken(req));
    if (!tokenPayload?.profileId) return res.status(401).json({ success: false, error: "Please sign in again." });
    const roomSlug = String(req.params.roomSlug || "").trim();
    const action = String(req.body?.action || "").trim();
    const enabled = Boolean(req.body?.enabled);
    const fieldMap = { pin: "pinnedRooms", archive: "archivedRooms", mute: "mutedRooms", unread: "manuallyUnreadRooms" };
    const field = fieldMap[action];
    if (!roomSlug || !field) return res.status(400).json({ success: false, error: "Invalid chat preference request." });

    const profile = await Profile.findById(tokenPayload.profileId)
      .select("pinnedRooms archivedRooms mutedRooms manuallyUnreadRooms keepArchivedOnNewMessage");
    if (!profile) return res.status(404).json({ success: false, error: "Profile not found." });

    if (action === "pin") {
      const room = await Room.findOne({ slug: roomSlug }).select("slug isSaved isDirect participants").lean();
      if (!room || !profileCanAccessRoom(profile, room)) {
        return res.status(404).json({ success: false, error: "Chat not found." });
      }
      if (room.isSaved || roomSlug.startsWith("saved:")) {
        return res.status(400).json({ success: false, error: "Saved Messages is always placed first and does not need pinning." });
      }

      const current = [...new Set((profile.pinnedRooms || []).filter((slug) => slug && !String(slug).startsWith("saved:")))];
      if (enabled && !current.includes(roomSlug)) {
        if (current.length >= 5) return res.status(400).json({ success: false, error: "You can pin a maximum of five chats." });
        current.push(roomSlug);
      } else if (!enabled) {
        profile.pinnedRooms = current.filter((slug) => slug !== roomSlug);
      }
      if (enabled) profile.pinnedRooms = current;
      await profile.save();
    } else {
      const current = new Set(profile[field] || []);
      if (enabled) current.add(roomSlug); else current.delete(roomSlug);
      profile[field] = [...current];
      await profile.save();
    }

    io.emit("profiles_updated");
    return res.json({ success: true, data: {
      pinnedRooms: profile.pinnedRooms || [], archivedRooms: profile.archivedRooms || [],
      mutedRooms: profile.mutedRooms || [], manuallyUnreadRooms: profile.manuallyUnreadRooms || [],
      keepArchivedOnNewMessage: profile.keepArchivedOnNewMessage !== false,
    }});
  } catch (error) {
    console.error("chat preferences update error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to update chat preference." });
  }
});

async function restoreArchivedRoomForNewMessage(roomSlug, senderProfileId) {
  if (!roomSlug || String(roomSlug).startsWith("saved:")) return;
  await Profile.updateMany(
    { _id: { $ne: senderProfileId }, archivedRooms: roomSlug, keepArchivedOnNewMessage: false },
    { $pull: { archivedRooms: roomSlug } }
  );
}

app.get("/api/push/public-key", (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(500).json({ success: false, error: "VAPID_PUBLIC_KEY is not configured" });
  }

  return res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
});

app.post("/api/push/subscribe", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { subscription } = req.body || {};

    if (!installId || !subscription?.endpoint) {
      return res.status(400).json({ success: false, error: "installId and subscription are required" });
    }

    const profile = await getProfileByInstallId(installId);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    const current = profile.pushSubscriptions || [];
    const exists = current.some((item) => item?.endpoint === subscription.endpoint);
    if (!exists) {
      profile.pushSubscriptions = [...current, subscription];
      await profile.save();
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("push subscribe error:", error);
    return res.status(500).json({ success: false, error: "Failed to save push subscription" });
  }
});

app.get("/api/unread-counts", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) return res.json({});

    const counts = await getUnreadCountsForProfileId(currentProfile._id);
    return res.json(counts);
  } catch (error) {
    console.error("unread-counts error:", error);
    return res.status(500).json({ success: false, error: "Failed to load unread counts" });
  }
});

app.get("/api/profiles", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const currentProfile = await getProfileByInstallId(installId);

    if (
      !currentProfile ||
      !currentProfile.nameLocked ||
      !currentProfile.activeChat
    ) {
      return res.json([]);
    }

    const profiles = await Profile.find({
      _id: { $ne: currentProfile._id },
      activeChat: true,
      nameLocked: true,
      displayName: { $ne: "" },
    })
      .sort({ displayName: 1 })
      .lean();

    return res.json(profiles.map(publicProfileShape));
  } catch (error) {
    console.error("profiles error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to load users",
    });
  }
});

app.post("/api/direct-room", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { targetProfileId } = req.body;

    const currentProfile = await getProfileByInstallId(installId);

    if (
      !currentProfile ||
      !currentProfile.nameLocked ||
      !currentProfile.activeChat
    ) {
      return res.status(403).json({
        success: false,
        error: "You must start a chat session first",
      });
    }

    if (!targetProfileId) {
      return res.status(400).json({
        success: false,
        error: "targetProfileId is required",
      });
    }

    if (idsEqual(currentProfile._id, targetProfileId)) {
      return res.status(400).json({
        success: false,
        error: "You cannot start a direct chat with yourself",
      });
    }

    const targetProfile = await Profile.findById(targetProfileId);
    if (!targetProfile || !targetProfile.activeChat || !targetProfile.nameLocked) {
      return res.status(404).json({
        success: false,
        error: "Target user is not available",
      });
    }

    const slug = normalizeDirectSlug(currentProfile._id, targetProfile._id);
    const roomName = `${currentProfile.displayName} & ${targetProfile.displayName}`;

    let room = await Room.findOne({ slug });

    if (!room) {
      room = await Room.create({
        name: roomName,
        slug,
        isDirect: true,
        participants: [currentProfile._id, targetProfile._id],
      });
    }

    io.emit("rooms_updated");

    return res.json({
      success: true,
      data: roomResponseShape(room, currentProfile._id),
    });
  } catch (error) {
    console.error("direct-room error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create direct room",
    });
  }
});

app.post("/api/saved-messages", async (req, res) => {
  try {
    const currentProfile = await getProfileByInstallId(getInstallId(req));
    if (!currentProfile) {
      return res.status(401).json({ success: false, error: "Please sign in again" });
    }

    const room = await ensureSavedMessagesRoom(currentProfile);
    return res.json({ success: true, data: roomResponseShape(room, currentProfile._id) });
  } catch (error) {
    console.error("saved-messages error:", error);
    return res.status(500).json({ success: false, error: "Failed to open Saved Messages" });
  }
});

app.get("/api/rooms", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const currentProfile = await getProfileByInstallId(installId);

    if (!currentProfile) {
      return res.json([]);
    }

    await ensureSavedMessagesRoom(currentProfile);

    const hiddenRows = await HiddenChat.find({ profileId: currentProfile._id }).lean();
    const hiddenSlugs = hiddenRows.map((row) => row.roomSlug);

    const rooms = await Room.find({
      slug: { $nin: hiddenSlugs },
      $or: [
        { isDirect: false },
        { isDirect: true, participants: currentProfile._id },
      ],
    })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    return res.json(rooms.map((room) => roomResponseShape(room, currentProfile._id)));
  } catch (error) {
    console.error("rooms error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to load rooms",
    });
  }
});


app.get("/api/messages/search", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const q = (req.query.q || "").toString().trim();
    const currentProfile = await getProfileByInstallId(installId);

    if (!currentProfile) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const hiddenRows = await HiddenChat.find({ profileId: currentProfile._id }).lean();
    const hiddenSlugs = hiddenRows.map((row) => row.roomSlug);

    const accessibleRooms = await Room.find({
      slug: { $nin: hiddenSlugs },
      $or: [
        { isDirect: false },
        { isDirect: true, participants: currentProfile._id },
      ],
    }).lean();

    const roomSlugs = accessibleRooms.map((room) => room.slug);
    const roomsBySlug = Object.fromEntries(accessibleRooms.map((room) => [room.slug, room]));

    if (!roomSlugs.length) {
      return res.json({ success: true, data: [] });
    }

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(escapedQuery, "i");

    const messages = await Message.find({
      roomSlug: { $in: roomSlugs },
      isDeleted: { $ne: true },
      hiddenFor: { $ne: currentProfile._id },
      $or: [
        { content: matcher },
        { fileName: matcher },
        { sender: matcher },
        { "replyTo.content": matcher },
        { "replyTo.fileName": matcher },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const results = messages.map((message) => {
      const room = roomsBySlug[message.roomSlug];
      const preview =
        message.type === "audio"
          ? "🎤 Voice note"
          : message.type === "file"
            ? `📎 ${message.fileName || message.content || "Attachment"}`
            : message.content || message.fileName || "Message";

      return {
        _id: String(message._id),
        roomSlug: message.roomSlug,
        roomName: room?.name || message.roomSlug,
        sender: message.sender || "User",
        senderProfileId: message.senderProfileId || null,
        type: message.type || "text",
        preview,
        fileName: message.fileName || "",
        createdAt: message.createdAt,
      };
    });

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error("message search error:", error);
    return res.status(500).json({ success: false, error: "Failed to search messages" });
  }
});


app.get("/api/rooms/:roomSlug/export", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { roomSlug } = req.params;
    const format = (req.query.format || "txt").toString().toLowerCase();

    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const room = await Room.findOne({ slug: roomSlug }).lean();
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({ success: false, error: "You do not have access to this room" });
    }

    const clearRow = await ChatClear.findOne({ roomSlug, profileId: currentProfile._id }).lean();
    const query = clearRow?.clearedAt
      ? { roomSlug, createdAt: { $gt: clearRow.clearedAt }, hiddenFor: { $ne: currentProfile._id } }
      : { roomSlug, hiddenFor: { $ne: currentProfile._id } };

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .lean();

    const baseName = safeExportFileName(`${room.name || room.slug}-${new Date().toISOString().slice(0, 10)}`);

    if (format === "json") {
      const payload = {
        exportedAt: new Date().toISOString(),
        room: {
          name: room.name || "",
          slug: room.slug,
          isDirect: Boolean(room.isDirect),
        },
        messageCount: messages.length,
        messages: messages.map((message) => ({
          id: String(message._id),
          createdAt: message.createdAt,
          sender: message.sender || "User",
          type: message.type || "text",
          content: exportMessageText(message),
          rawContent: message.content || "",
          fileName: message.fileName || "",
          fileUrl: message.fileUrl || "",
          replyTo: message.replyTo || null,
          forwardedFrom: message.forwardedFrom || null,
          pinned: Boolean(message.pinned),
          pinnedAt: message.pinnedAt || null,
          starredByCount: Array.isArray(message.starredBy) ? message.starredBy.length : 0,
          reactions: message.reactions || {},
        })),
      };

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}.json"`);
      return res.send(JSON.stringify(payload, null, 2));
    }

    const text = buildChatExportText(room, messages);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.txt"`);
    return res.send(text);
  } catch (error) {
    console.error("chat export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export chat" });
  }
});

app.get("/api/messages/:roomSlug", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { roomSlug } = req.params;

    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const room = await Room.findOne({ slug: roomSlug });
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to this room",
      });
    }

    const clearRow = await ChatClear.findOne({ roomSlug, profileId: currentProfile._id }).lean();
    const query = clearRow?.clearedAt
      ? { roomSlug, createdAt: { $gt: clearRow.clearedAt }, hiddenFor: { $ne: currentProfile._id } }
      : { roomSlug, hiddenFor: { $ne: currentProfile._id } };
    const messages = await Message.find(query).sort({ createdAt: 1 }).lean();
    return res.json(messages);
  } catch (error) {
    console.error("messages error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to load messages",
    });
  }
});

app.delete("/api/rooms/:roomSlug/messages", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { roomSlug } = req.params;

    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const room = await Room.findOne({ slug: roomSlug });
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({ success: false, error: "You do not have access to this room" });
    }

    const clearedAt = new Date();
    await ChatClear.findOneAndUpdate(
      { roomSlug, profileId: currentProfile._id },
      { $set: { clearedAt } },
      { upsert: true, returnDocument: "after" }
    );

    const socketIds = profileSockets[String(currentProfile._id)];
    if (socketIds) {
      socketIds.forEach((socketId) => io.to(socketId).emit("chat_history_deleted", { roomSlug }));
    }

    return res.json({ success: true, data: { roomSlug, clearedAt } });
  } catch (error) {
    console.error("delete chat history error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete chat history" });
  }
});

app.delete("/api/rooms/:roomSlug/hide", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { roomSlug } = req.params;

    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const room = await Room.findOne({ slug: roomSlug });
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({ success: false, error: "You do not have access to this room" });
    }

    if (!room.isDirect || roomSlug === "general") {
      const now = new Date();

      await ChatClear.findOneAndUpdate(
        { roomSlug, profileId: currentProfile._id },
        { $set: { clearedAt: now } },
        { upsert: true, returnDocument: "after" }
      );

      await HiddenChat.findOneAndUpdate(
        { roomSlug, profileId: currentProfile._id },
        { $set: { hiddenAt: now } },
        { upsert: true, returnDocument: "after" }
      );

      const socketIds = profileSockets[String(currentProfile._id)];
      if (socketIds) {
        socketIds.forEach((socketId) => io.to(socketId).emit("chat_hidden", { roomSlug }));
      }

      await emitUnreadCountsForProfile(currentProfile._id, io);
      io.emit("rooms_updated");

      return res.json({ success: true, data: { roomSlug, mode: "hidden" } });
    }

    if (callRooms[roomSlug]) {
      await endCallRoom(roomSlug, io, "room-deleted", "missed");
    }

    const affectedProfileIds = Array.isArray(room.participants)
      ? room.participants.map((id) => String(id))
      : [];

    await Message.deleteMany({ roomSlug });
    await ChatClear.deleteMany({ roomSlug });
    await HiddenChat.deleteMany({ roomSlug });
    await CallLog.deleteMany({ roomSlug });
    await Room.deleteOne({ slug: roomSlug });

    io.to(roomSlug).emit("chat_deleted", { roomSlug });

    await Promise.all(
      affectedProfileIds.map((profileId) => emitUnreadCountsForProfile(profileId, io))
    );

    io.emit("rooms_updated");
    io.emit("calls_updated");

    return res.json({ success: true, data: { roomSlug, mode: "hard_deleted" } });
  } catch (error) {
    console.error("hard delete chat error:", error);
    return res.status(500).json({ success: false, error: "Failed to permanently delete chat" });
  }
});

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
const MESSAGE_DELETE_EVERYONE_WINDOW_MS = 15 * 60 * 1000;

app.patch("/api/messages/:messageId", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { messageId } = req.params;
    const content = String(req.body?.content || "").trim();
    const currentProfile = await getProfileByInstallId(installId);

    if (!currentProfile) return res.status(403).json({ success: false, error: "Unauthorized" });
    if (!content) return res.status(400).json({ success: false, error: "Message cannot be empty" });
    if (content.length > 5000) return res.status(400).json({ success: false, error: "Message is too long" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, error: "Message not found" });
    if (!idsEqual(message.senderProfileId, currentProfile._id)) {
      return res.status(403).json({ success: false, error: "You can only edit your own messages" });
    }
    if (message.isDeleted) return res.status(409).json({ success: false, error: "Deleted messages cannot be edited" });
    if (message.type !== "text") return res.status(400).json({ success: false, error: "Only text messages can be edited" });
    if (Date.now() - new Date(message.createdAt).getTime() > MESSAGE_EDIT_WINDOW_MS) {
      return res.status(409).json({ success: false, error: "Messages can only be edited within 15 minutes" });
    }

    const room = await Room.findOne({ slug: message.roomSlug });
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({ success: false, error: "You do not have access to this room" });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    await Message.updateMany(
      { "replyTo.messageId": message._id },
      { $set: { "replyTo.content": content } }
    );
    await refreshRoomLastMessage(message.roomSlug);

    const plain = message.toObject({ flattenMaps: true });
    io.to(message.roomSlug).emit("message_edited", { roomSlug: message.roomSlug, message: plain });
    io.emit("rooms_updated");
    return res.json({ success: true, data: plain });
  } catch (error) {
    console.error("edit message error:", error);
    return res.status(500).json({ success: false, error: "Failed to edit message" });
  }
});

app.delete("/api/messages/:messageId", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { messageId } = req.params;
    const mode = String(req.query.mode || req.body?.mode || "everyone").toLowerCase();
    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) return res.status(403).json({ success: false, error: "Unauthorized" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, error: "Message not found" });
    const room = await Room.findOne({ slug: message.roomSlug });
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({ success: false, error: "You do not have access to this room" });
    }

    if (mode === "me") {
      const alreadyHidden = (message.hiddenFor || []).some((id) => idsEqual(id, currentProfile._id));
      if (!alreadyHidden) {
        message.hiddenFor = [...(message.hiddenFor || []), currentProfile._id];
        await message.save();
      }
      const socketIds = profileSockets[String(currentProfile._id)] || new Set();
      socketIds.forEach((socketId) => io.to(socketId).emit("message_hidden", {
        roomSlug: message.roomSlug,
        messageId: String(message._id),
      }));
      return res.json({ success: true, data: { messageId: String(message._id), mode: "me" } });
    }

    if (!idsEqual(message.senderProfileId, currentProfile._id)) {
      return res.status(403).json({ success: false, error: "You can only delete your own messages for everyone" });
    }
    if (Date.now() - new Date(message.createdAt).getTime() > MESSAGE_DELETE_EVERYONE_WINDOW_MS) {
      return res.status(409).json({ success: false, error: "Messages can only be deleted for everyone within 15 minutes" });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = "This message was deleted";
    message.fileName = "";
    message.fileUrl = "";
    message.fileSize = 0;
    message.mimeType = "";
    message.encryptedFile = false;
    message.isEncrypted = false;
    message.reactions = {};
    message.starredBy = [];
    message.pinned = false;
    message.pinnedAt = null;
    message.pinnedBy = null;
    await message.save();

    await Message.updateMany(
      { "replyTo.messageId": message._id },
      { $set: { "replyTo.content": "This message was deleted", "replyTo.fileName": "" } }
    );
    await refreshRoomLastMessage(message.roomSlug);

    const plain = message.toObject({ flattenMaps: true });
    io.to(message.roomSlug).emit("message_deleted", {
      roomSlug: message.roomSlug,
      messageId: String(message._id),
      message: plain,
    });
    io.emit("rooms_updated");
    return res.json({ success: true, data: plain });
  } catch (error) {
    console.error("delete message error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete message" });
  }
});

app.post("/api/messages/:messageId/star", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { messageId } = req.params;
    const currentProfile = await getProfileByInstallId(installId);

    if (!currentProfile) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { message } = await getAuthorizedMessageForProfile(messageId, currentProfile);
    if (!message || message.isDeleted) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    const currentProfileId = String(currentProfile._id);
    const starredBy = (message.starredBy || []).map((id) => String(id));
    const alreadyStarred = starredBy.includes(currentProfileId);

    message.starredBy = alreadyStarred
      ? (message.starredBy || []).filter((id) => String(id) !== currentProfileId)
      : [...(message.starredBy || []), currentProfile._id];

    await message.save();
    const plainMessage = message.toObject({ flattenMaps: true });

    io.to(message.roomSlug).emit("message_flags_updated", {
      roomSlug: message.roomSlug,
      message: plainMessage,
    });

    return res.json({ success: true, data: plainMessage });
  } catch (error) {
    console.error("star message error:", error);
    return res.status(500).json({ success: false, error: "Failed to update starred message" });
  }
});

app.post("/api/messages/:messageId/pin", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { messageId } = req.params;
    const currentProfile = await getProfileByInstallId(installId);

    if (!currentProfile) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { message } = await getAuthorizedMessageForProfile(messageId, currentProfile);
    if (!message || message.isDeleted) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    message.pinned = !message.pinned;
    message.pinnedAt = message.pinned ? new Date() : null;
    message.pinnedBy = message.pinned ? currentProfile._id : null;

    await message.save();
    const plainMessage = message.toObject({ flattenMaps: true });

    io.to(message.roomSlug).emit("message_flags_updated", {
      roomSlug: message.roomSlug,
      message: plainMessage,
    });

    return res.json({ success: true, data: plainMessage });
  } catch (error) {
    console.error("pin message error:", error);
    return res.status(500).json({ success: false, error: "Failed to update pinned message" });
  }
});

app.post("/api/messages/:messageId/forward", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { messageId } = req.params;
    const { targetRoomSlug } = req.body;

    if (!targetRoomSlug) {
      return res.status(400).json({
        success: false,
        error: "targetRoomSlug is required",
      });
    }

    const currentProfile = await getProfileByInstallId(installId);
    if (
      !currentProfile ||
      !currentProfile.nameLocked ||
      !currentProfile.displayName
    ) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const sourceMessage = await Message.findById(messageId);
    if (!sourceMessage) {
      return res.status(404).json({
        success: false,
        error: "Source message not found",
      });
    }

    const sourceRoom = await Room.findOne({ slug: sourceMessage.roomSlug });
    if (!sourceRoom || !profileCanAccessRoom(currentProfile, sourceRoom)) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to the source room",
      });
    }

    let targetRoom = await Room.findOne({ slug: targetRoomSlug });
    if (!targetRoom && targetRoomSlug === "general") {
      targetRoom = await ensurePublicRoom("general");
    }

    if (!targetRoom || !profileCanAccessRoom(currentProfile, targetRoom)) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to the target room",
      });
    }

    const forwardedMessage = await Message.create({
      roomSlug: targetRoomSlug,
      sender: currentProfile.displayName,
      senderProfileId: currentProfile._id,
      type: sourceMessage.type,
      content: sourceMessage.isDeleted
        ? "Forwarded deleted message"
        : sourceMessage.content,
      isEncrypted: sourceMessage.isDeleted ? false : Boolean(sourceMessage.isEncrypted),
      fileName: sourceMessage.isDeleted ? "" : sourceMessage.fileName,
      fileUrl: sourceMessage.isDeleted ? "" : sourceMessage.fileUrl,
      fileSize: sourceMessage.isDeleted ? 0 : sourceMessage.fileSize || 0,
      mimeType: sourceMessage.isDeleted ? "" : sourceMessage.mimeType || "",
      encryptedFile: sourceMessage.isDeleted ? false : Boolean(sourceMessage.encryptedFile),
      status: "sent",
      forwardedFrom: {
        sender: sourceMessage.sender,
        roomSlug: sourceMessage.roomSlug,
      },
      replyTo: null,
    });

    await Room.updateOne(
      { slug: targetRoomSlug },
      {
        $set: {
          lastMessageText: messagePreviewText(forwardedMessage),
          lastMessageAt: forwardedMessage.createdAt,
        },
      }
    );

    const plainForwardedMessage = forwardedMessage.toObject({ flattenMaps: true });
    await emitMessageToRoomParticipants(targetRoomSlug, plainForwardedMessage, io);
    await emitUnreadCountsForRoom(targetRoomSlug, io);
    await notifyMessagePush(targetRoomSlug, plainForwardedMessage, currentProfile._id);
    io.emit("rooms_updated");

    return res.status(201).json({
      success: true,
      data: forwardedMessage.toObject({ flattenMaps: true }),
    });
  } catch (error) {
    console.error("forward message error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to forward message",
    });
  }
});

app.post("/api/messages/:messageId/reactions", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reaction",
      });
    }

    const currentProfile = await getProfileByInstallId(installId);
    if (
      !currentProfile ||
      !currentProfile.nameLocked ||
      !currentProfile.displayName
    ) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    const room = await Room.findOne({ slug: message.roomSlug });
    if (!room || !profileCanAccessRoom(currentProfile, room)) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to this room",
      });
    }

    const currentUserId = String(currentProfile._id);
    const currentList = Array.isArray(message.reactions?.get?.(emoji))
      ? message.reactions.get(emoji)
      : [];

    const hasReacted = currentList.includes(currentUserId);
    const nextList = hasReacted
      ? currentList.filter((id) => id !== currentUserId)
      : [...currentList, currentUserId];

    if (nextList.length) {
      message.reactions.set(emoji, nextList);
    } else {
      message.reactions.delete(emoji);
    }

    await message.save();

    const plainMessage = message.toObject({ flattenMaps: true });

    io.to(message.roomSlug).emit("message_reaction_updated", {
      roomSlug: message.roomSlug,
      message: plainMessage,
    });

    return res.json({
      success: true,
      data: plainMessage,
    });
  } catch (error) {
    console.error("reaction error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update reaction",
    });
  }
});

/* =========================
   SERVER + SOCKET.IO
========================= */

const server = http.createServer(app);
server.timeout = 0;

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "DELETE"],
  },
});

/* =========================
   UPLOAD
========================= */

app.post("/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    try {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            error: "File is too large. Maximum allowed size is 1 GB.",
          });
        }

        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            success: false,
            error: "Invalid file upload.",
          });
        }

        console.error("Upload middleware error:", {
  message: err.message,
  stack: err.stack,
  name: err.name,
});
        return res.status(500).json({
          success: false,
          error: err.message || "File upload failed",
        });
      }

      const installId = getInstallId(req);
      const roomSlug = req.body.roomSlug || "general";

      if (!installId) {
        return res.status(400).json({
          success: false,
          error: "installId is required",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const profile = await getProfileByInstallId(installId);
      if (!profile || !profile.nameLocked || !profile.displayName) {
        return res.status(403).json({
          success: false,
          error: "You must set and lock a name before uploading",
        });
      }

      let room = await Room.findOne({ slug: roomSlug });
      if (!room) {
        room = await ensurePublicRoom(roomSlug);
      }

      if (!profileCanAccessRoom(profile, room)) {
        return res.status(403).json({
          success: false,
          error: "You do not have access to this room",
        });
      }

      const encryptedFile = false;
      const originalFileName = (req.body.originalFileName || req.file.originalname || "").toString();
      const originalMimeType = (req.body.originalMimeType || req.file.mimetype || "").toString();
      const originalKind = (req.body.originalKind || "").toString();

      const mimeType = encryptedFile ? originalMimeType : (req.file.mimetype || originalMimeType || "");
      const lowerName = (originalFileName || req.file.originalname || "").toLowerCase();

      const isAudio =
        originalKind === "audio" ||
        mimeType.startsWith("audio/") ||
        lowerName.endsWith(".m4a") ||
        lowerName.endsWith(".mp3") ||
        lowerName.endsWith(".wav") ||
        lowerName.endsWith(".ogg") ||
        lowerName.endsWith(".webm");

      const type = isAudio ? "audio" : "file";
      const content = isAudio ? "Voice note" : originalFileName || req.file.originalname;

      const message = await Message.create({
        roomSlug,
        sender: profile.displayName,
        senderProfileId: profile._id,
        type,
        content,
        fileName: originalFileName || req.file.originalname,
        fileUrl: req.file.secure_url || req.file.path,
        fileSize: Number(req.body.originalFileSize || req.file.size || 0),
        mimeType,
        encryptedFile: false,
        isEncrypted: false,
        status: "sent",
        replyTo: null,
        forwardedFrom: null,
      });

      await Room.updateOne(
        { slug: roomSlug },
        {
          $set: {
            lastMessageText: messagePreviewText(message),
            lastMessageAt: message.createdAt,
          },
        }
      );

      await restoreArchivedRoomForNewMessage(roomSlug, profile._id);
      const plainMessage = message.toObject({ flattenMaps: true });
      await emitMessageToRoomParticipants(roomSlug, plainMessage, io);
      await emitUnreadCountsForRoom(roomSlug, io);
      await notifyMessagePush(roomSlug, plainMessage, profile._id);
      io.emit("rooms_updated");

      return res.status(201).json({
        success: true,
        data: message.toObject({ flattenMaps: true }),
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        success: false,
        error: "Upload processing failed",
      });
    }
  });
});

app.get("/api/calls", async (req, res) => {
  try {
    const installId = getInstallId(req);
    const currentProfile = await getProfileByInstallId(installId);
    if (!currentProfile) return res.json([]);

    const logs = await CallLog.find({
      $or: [
        { participantProfileIds: currentProfile._id },
        { missedProfileIds: currentProfile._id },
        { callerProfileId: currentProfile._id },
      ],
    })
      .sort({ startedAt: -1 })
      .limit(100)
      .lean();

    const roomSlugs = [...new Set(logs.map((log) => log.roomSlug).filter(Boolean))];
    const rooms = await Room.find({ slug: { $in: roomSlugs } }).lean();
    const roomsBySlug = Object.fromEntries(rooms.map((room) => [room.slug, room]));

    const profileIds = new Set();
    logs.forEach((log) => {
      if (log.callerProfileId) profileIds.add(String(log.callerProfileId));
      (log.participantProfileIds || []).forEach((id) => profileIds.add(String(id)));
      const room = roomsBySlug[log.roomSlug];
      (room?.participants || []).forEach((id) => profileIds.add(String(id)));
    });

    const profiles = await Profile.find({ _id: { $in: [...profileIds] } })
      .select("displayName avatarUrl profileStatus")
      .lean();
    const profilesById = Object.fromEntries(profiles.map((profile) => [String(profile._id), profile]));

    return res.json(
      logs.map((log) => {
        const room = roomsBySlug[log.roomSlug];
        const isMissedForMe = (log.missedProfileIds || []).some((id) => idsEqual(id, currentProfile._id));
        const caller = profilesById[String(log.callerProfileId)] || null;
        let otherUser = null;

        if (log.roomSlug === "general") {
          otherUser = null;
        } else if (room) {
          const otherId = (room.participants || []).find((id) => !idsEqual(id, currentProfile._id));
          otherUser = profilesById[String(otherId)] || null;
        } else if (log.callerProfileId && !idsEqual(log.callerProfileId, currentProfile._id)) {
          otherUser = caller;
        }

        const status = isMissedForMe ? "missed" : log.status;
        return {
          ...log,
          status,
          callType: log.callType || "audio",
          type: log.callType || "audio",
          roomName: log.roomSlug === "general" ? "General" : (room?.name || log.title || log.roomSlug),
          otherUserId: otherUser?._id || null,
          otherUserName: log.roomSlug === "general" ? "General" : (otherUser?.displayName || log.callerName || log.title || log.roomSlug),
          callerName: caller?.displayName || log.callerName || "User",
        };
      })
    );
  } catch (error) {
    console.error("calls history error:", error);
    return res.status(500).json({ success: false, error: "Failed to load call history" });
  }
});

/* =========================
   SOCKET EVENTS
========================= */

io.on("connection", (socket) => {
  io.emit("online_count", io.engine.clientsCount);

  socket.on("profile:register", async ({ installId, profileId } = {}) => {
    try {
      let resolvedProfileId = profileId || null;

      if (!resolvedProfileId && installId) {
        const profile = await getProfileByInstallId(String(installId).trim());
        resolvedProfileId = profile?._id || null;
      }

      if (!resolvedProfileId) return;

      rememberSocketProfile(socket, resolvedProfileId);
      await emitUnreadCountsForProfile(resolvedProfileId, io);
    } catch (error) {
      console.error("profile:register error:", error);
    }
  });

  /* ========= SAFE GROUP VOICE CALL SIGNALING ========= */

socket.on("call:start", async ({ roomSlug, profileId, name, callType = "audio" } = {}) => {
  try {
    if (!roomSlug) return;
    rememberSocketProfile(socket, profileId);

    const room = ensureCallRoom(roomSlug);
    room.callType = callType === "video" ? "video" : "audio";
    const callName = await resolveProfileDisplayName(profileId, name || "User");
    if (!room.callLogId) await startCallLog(roomSlug, profileId, callName, callType);

    room.answered = false;

    if (room.timeoutId) clearTimeout(room.timeoutId);
    room.timeoutId = setTimeout(async () => {
      try {
        const latestRoom = callRooms[roomSlug];
        if (!latestRoom || latestRoom.answered) return;

        await endCallRoom(roomSlug, io, "no-answer", "missed");
      } catch (error) {
        console.error("call timeout error:", error);
      }
    }, CALL_RING_TIMEOUT_MS);

    room.participants[socket.id] = {
      socketId: socket.id,
      profileId: profileId || null,
      name: callName,
    };

    socket.join(`call_${roomSlug}`);

    socket.to(`call_${roomSlug}`).emit("call:user-joined", {
      socketId: socket.id,
      profileId: profileId || null,
      name: callName,
    });

    io.to(`call_${roomSlug}`).emit("call:participants", {
      roomSlug,
      participants: getCallParticipants(roomSlug),
    });

    await notifyIncomingCall(socket, roomSlug, profileId, callName, io, callType);
    await notifyCallPush(roomSlug, profileId, callName, callType);

    emitCallState(roomSlug, io);
  } catch (error) {
    console.error("call:start error:", error);
  }
});

  socket.on("call:join", async ({ roomSlug, profileId, name } = {}) => {
    try {
      if (!roomSlug) return;
      rememberSocketProfile(socket, profileId);

      const room = ensureCallRoom(roomSlug);
      if (!room) return;

      room.answered = true;
      if (room.timeoutId) {
        clearTimeout(room.timeoutId);
        room.timeoutId = null;
      }

      const callName = await resolveProfileDisplayName(profileId, name || "User");
      const answeredAt = await markCallAnswered(roomSlug, profileId);

      room.participants[socket.id] = {
        socketId: socket.id,
        profileId: profileId || null,
        name: callName,
      };

      socket.join(`call_${roomSlug}`);

      socket.to(`call_${roomSlug}`).emit("call:user-joined", {
        socketId: socket.id,
        profileId: profileId || null,
        name: callName,
      });

      io.to(`call_${roomSlug}`).emit("call:participants", {
        roomSlug,
        participants: getCallParticipants(roomSlug),
      });

      io.to(`call_${roomSlug}`).emit("call:accepted", {
        roomSlug,
        acceptedBy: socket.id,
        profileId: profileId || null,
        name: callName,
        startedAt: answeredAt || new Date(),
      });

      emitCallState(roomSlug, io);
    } catch (error) {
      console.error("call:join error:", error);
    }
  });

  socket.on("call:leave", async ({ roomSlug } = {}) => {
    try {
      if (!roomSlug) return;
      await removeCallParticipant(socket, roomSlug, io);
    } catch (error) {
      console.error("call:leave error:", error);
    }
  });

  socket.on("call:media-state", async ({ roomSlug, profileId, name, videoEnabled } = {}) => {
    try {
      if (!roomSlug) return;
      const callName = await resolveProfileDisplayName(profileId, name || "User");
      socket.to(`call_${roomSlug}`).emit("call:media-state", {
        roomSlug,
        socketId: socket.id,
        profileId: profileId || null,
        name: callName,
        videoEnabled: Boolean(videoEnabled),
      });
    } catch (error) {
      console.error("call:media-state error:", error);
    }
  });

  socket.on("call:reject", async ({ roomSlug, fromSocketId, profileId, name } = {}) => {
    try {
      if (!roomSlug) return;
      const callName = await resolveProfileDisplayName(profileId, name || "User");

      const dbRoom = await Room.findOne({ slug: roomSlug }).lean();

      if (roomSlug !== "general") {
        io.to(`call_${roomSlug}`).emit("call:rejected", {
          roomSlug,
          profileId: profileId || null,
          name: callName,
        });

        if (fromSocketId) {
          io.to(fromSocketId).emit("call:rejected", {
            roomSlug,
            profileId: profileId || null,
            name: callName,
          });
        }

        await endCallRoom(roomSlug, io, "rejected", "rejected");
        io.emit("calls_updated");
        return;
      }

      // Declining a group/general call invitation should only dismiss the
      // invitation for that user. It must not end the active group call.
      if (fromSocketId) {
        io.to(fromSocketId).emit("call:invite-declined", {
          roomSlug,
          profileId: profileId || null,
          name: callName,
        });
      }
    } catch (error) {
      console.error("call:reject error:", error);
    }
  });

  socket.on("call:signal", ({ to, data } = {}) => {
    try {
      if (!to || !data) return;

      io.to(to).emit("call:signal", {
        from: socket.id,
        data,
      });
    } catch (error) {
      console.error("call:signal error:", error);
    }
  });

  /* ========= EXISTING CHAT EVENTS ========= */

  socket.on("join_room", async ({ roomSlug, installId }) => {
    try {
      if (!roomSlug || !installId) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile) return;
      rememberSocketProfile(socket, profile._id);

      let room = await Room.findOne({ slug: roomSlug });
      if (!room && roomSlug === "general") {
        room = await ensurePublicRoom("general");
      }

      if (!room || !profileCanAccessRoom(profile, room)) return;

      socket.join(roomSlug);
      socket.emit("call:state", getCallState(roomSlug));

      const deliveredMessages = await updateMessageStatuses(
        roomSlug,
        profile._id,
        "delivered"
      );

      if (deliveredMessages.length) {
        io.to(roomSlug).emit("messages_status_updated", {
          roomSlug,
          messages: deliveredMessages.map((msg) => ({
            ...msg,
            reactions: msg.reactions || {},
          })),
        });
      }

      const messages = await Message.find({ roomSlug, hiddenFor: { $ne: profile._id } })
        .sort({ createdAt: 1 })
        .lean();

      socket.emit("load_messages", messages);
    } catch (error) {
      console.error("join_room error:", error);
    }
  });

  socket.on("leave_room", ({ roomSlug }) => {
    if (!roomSlug) return;
    socket.leave(roomSlug);
  });

  socket.on("send_message", async (data) => {
    try {
      const roomSlug = data.roomSlug || "general";
      const installId = (data.installId || "").trim();
      const content = (data.content || "").trim();
      const isEncrypted = false;
      const replyToMessageId = data.replyToMessageId || null;
      const forwardedFrom = data.forwardedFrom && typeof data.forwardedFrom === "object"
        ? {
            sender: (data.forwardedFrom.sender || "").toString(),
            roomSlug: (data.forwardedFrom.roomSlug || "").toString(),
          }
        : null;

      if (!installId || !content) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile || !profile.nameLocked || !profile.displayName) return;

      let room = await Room.findOne({ slug: roomSlug });
      if (!room && roomSlug === "general") {
        room = await ensurePublicRoom("general");
      }

      if (!room || !profileCanAccessRoom(profile, room)) return;

      let replyTo = null;
      if (replyToMessageId) {
        const sourceReplyMessage = await Message.findById(replyToMessageId);
        if (sourceReplyMessage && sourceReplyMessage.roomSlug === roomSlug) {
          replyTo = buildReplyPayload(sourceReplyMessage);
        }
      }

      const message = await Message.create({
        roomSlug,
        sender: profile.displayName,
        senderProfileId: profile._id,
        content,
        isEncrypted,
        type: "text",
        status: "sent",
        replyTo,
        forwardedFrom,
      });

      await Room.updateOne(
        { slug: roomSlug },
        {
          $set: {
            lastMessageText: messagePreviewText(message),
            lastMessageAt: message.createdAt,
          },
        }
      );

      await restoreArchivedRoomForNewMessage(roomSlug, profile._id);
      const plainMessage = message.toObject({ flattenMaps: true });
      await emitMessageToRoomParticipants(roomSlug, plainMessage, io);
      await emitUnreadCountsForRoom(roomSlug, io);
      await notifyMessagePush(roomSlug, plainMessage, profile._id);
      io.emit("rooms_updated");
    } catch (error) {
      console.error("send_message error:", error);
    }
  });

  socket.on("mark_seen", async ({ roomSlug, installId }) => {
    try {
      if (!roomSlug || !installId) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile) return;

      const room = await Room.findOne({ slug: roomSlug });
      if (!room || !profileCanAccessRoom(profile, room)) return;

      const seenMessages = await updateMessageStatuses(
        roomSlug,
        profile._id,
        "seen"
      );

      if (seenMessages.length) {
        io.to(roomSlug).emit("messages_status_updated", {
          roomSlug,
          messages: seenMessages.map((msg) => ({
            ...msg,
            reactions: msg.reactions || {},
          })),
        });
      }

      await emitUnreadCountsForProfile(profile._id, io);
    } catch (error) {
      console.error("mark_seen error:", error);
    }
  });

  socket.on("typing", async ({ roomSlug, installId }) => {
    try {
      if (!roomSlug || !installId) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile?.displayName) return;

      const room = await Room.findOne({ slug: roomSlug });
      if (!room || !profileCanAccessRoom(profile, room)) return;

      socket.to(roomSlug).emit("user_typing", {
        roomSlug,
        profileId: String(profile._id),
        name: profile.displayName,
      });
    } catch (error) {
      console.error("typing error:", error);
    }
  });

  socket.on("stop_typing", async ({ roomSlug, installId }) => {
    try {
      if (!roomSlug || !installId) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile?.displayName) return;

      const room = await Room.findOne({ slug: roomSlug });
      if (!room || !profileCanAccessRoom(profile, room)) return;

      socket.to(roomSlug).emit("user_stop_typing", {
        roomSlug,
        profileId: String(profile._id),
        name: profile.displayName,
      });
    } catch (error) {
      console.error("stop_typing error:", error);
    }
  });

  socket.on("recording_audio", async ({ roomSlug, installId }) => {
    try {
      if (!roomSlug || !installId) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile?.displayName) return;

      const room = await Room.findOne({ slug: roomSlug });
      if (!room || !profileCanAccessRoom(profile, room)) return;

      socket.to(roomSlug).emit("user_recording_audio", {
        roomSlug,
        profileId: String(profile._id),
        name: profile.displayName,
      });
    } catch (error) {
      console.error("recording_audio error:", error);
    }
  });

  socket.on("stop_recording_audio", async ({ roomSlug, installId }) => {
    try {
      if (!roomSlug || !installId) return;

      const profile = await getProfileByInstallId(installId);
      if (!profile?.displayName) return;

      const room = await Room.findOne({ slug: roomSlug });
      if (!room || !profileCanAccessRoom(profile, room)) return;

      socket.to(roomSlug).emit("user_stop_recording_audio", {
        roomSlug,
        profileId: String(profile._id),
        name: profile.displayName,
      });
    } catch (error) {
      console.error("stop_recording_audio error:", error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      for (const roomSlug of Object.keys(callRooms)) {
        await removeCallParticipant(socket, roomSlug, io);
      }

      forgetSocketProfile(socket);
      io.emit("online_count", io.engine.clientsCount);
    } catch (error) {
      console.error("disconnect error:", error);
    }
  });
});

/* =========================
   REACT APP
========================= */

const distPath = path.join(__dirname, "client", "dist");

// Static assets must be served before the SPA fallback.
// Otherwise JavaScript requests receive index.html and fail MIME checks.
app.use(express.static(distPath, {
  index: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-store");
    }
  },
}));

app.get(
  /^(?!\/api(?:\/|$)|\/socket\.io(?:\/|$)|\/manifest\.webmanifest$|\/sw\.js$|\/icons(?:\/|$)).*/,
  (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  }
);

(async () => {
  try {
    await connectDB();

    const general = await Room.findOne({ slug: "general" });
    if (!general) {
      await Room.create({
        name: "General",
        slug: "general",
        isDirect: false,
      });
 }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup error:", error);
    process.exit(1);
  }
})();