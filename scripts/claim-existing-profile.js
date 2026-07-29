require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const [profileId, emailArg, password] = process.argv.slice(2);
if (!profileId || !emailArg || !password) {
  console.error("Usage: node scripts/claim-existing-profile.js <profileId> <email> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const profileSchema = new mongoose.Schema({}, { strict: false, collection: "profiles" });
const Profile = mongoose.model("RecoveryProfile", profileSchema);

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/int_messager");
    const email = emailArg.trim().toLowerCase();
    const duplicate = await Profile.findOne({ email, _id: { $ne: profileId } });
    if (duplicate) throw new Error("That email is already attached to another profile.");
    const profile = await Profile.findById(profileId);
    if (!profile) throw new Error("Profile not found.");
    profile.set({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      installId: profile.get("installId") || `account-${crypto.randomUUID()}`,
      nameLocked: true,
      activeChat: true,
      accountVerified: true,
    });
    await profile.save();
    console.log(`Recovered account for ${profile.get("displayName") || profileId} using ${email}.`);
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
