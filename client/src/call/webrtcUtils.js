// WebRTC production helpers for Int_messager.

export function buildRtcConfig() {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return {
    iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
}

export async function safeSetRemoteDescription(pc, description, options = {}) {
  if (!pc || !description || pc.signalingState === "closed") return false;

  const { requiredState, label = description.type || "description" } = options;

  if (requiredState && pc.signalingState !== requiredState) {
    console.warn(`Ignoring stale WebRTC ${label}; state=${pc.signalingState}, expected=${requiredState}`);
    return false;
  }

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(description));
    return true;
  } catch (err) {
    console.warn(`Unable to apply remote ${label}:`, err);
    return false;
  }
}

export function safeRestartIce(pc) {
  if (!pc || pc.signalingState === "closed") return false;
  try {
    pc.restartIce?.();
    return true;
  } catch (err) {
    console.warn("ICE restart failed:", err);
    return false;
  }
}

export async function replaceOutgoingVideoTrack(pc, nextTrack, stream) {
  if (!pc || !nextTrack || pc.signalingState === "closed") return false;

  const sender = pc.getSenders().find((item) => item.track?.kind === "video");
  if (!sender?.replaceTrack) return false;

  await sender.replaceTrack(nextTrack);

  if (stream && !stream.getVideoTracks().includes(nextTrack)) {
    try { stream.addTrack(nextTrack); } catch {}
  }

  return true;
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    try { track.stop(); } catch {}
  });
}
