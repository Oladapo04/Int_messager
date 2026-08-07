import React, { useMemo, useState } from "react";

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function fileNameOf(item) {
  return item?.fileName || item?.originalName || item?.name || "Attachment";
}

function extensionOf(name) {
  const part = String(name || "").split(".").pop();
  return part && part !== name ? part.toUpperCase() : "FILE";
}

function isPdf(item) {
  const mime = String(item?.mimeType || item?.fileType || "").toLowerCase();
  const name = fileNameOf(item).toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function detectKind(item) {
  const mime = String(item?.mimeType || item?.fileType || "").toLowerCase();
  const name = fileNameOf(item).toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(name)) return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(name)) return "audio";
  return "file";
}

export default function AttachmentRenderer({ item, resolveMediaUrl = (value) => value }) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = fileNameOf(item);
  const url = resolveMediaUrl(item?.fileUrl || item?.url || "");
  const kind = useMemo(() => detectKind(item), [item]);
  const size = formatBytes(item?.fileSize || item?.size);
  const meta = [extensionOf(name), size].filter(Boolean).join(" · ");

  if (!url) {
    return <div className="wa7-attachment-error">Attachment unavailable</div>;
  }

  if (kind === "image" && !imageFailed) {
    return (
      <figure className="wa7-media-card wa7-image-card">
        <a href={url} target="_blank" rel="noreferrer" className="wa7-media-link" aria-label={`Open ${name}`}>
          <img src={url} alt={name} loading="lazy" onError={() => setImageFailed(true)} />
        </a>
        <figcaption className="wa7-media-caption">
          <span className="wa7-media-name" title={name}>{name}</span>
          {size ? <span className="wa7-media-size">{size}</span> : null}
        </figcaption>
      </figure>
    );
  }

  if (kind === "video") {
    return (
      <figure className="wa7-media-card wa7-video-card">
        <video src={url} controls preload="metadata" playsInline />
        <figcaption className="wa7-media-caption">
          <span className="wa7-media-name" title={name}>{name}</span>
          {size ? <span className="wa7-media-size">{size}</span> : null}
        </figcaption>
      </figure>
    );
  }

  if (kind === "audio") {
    return (
      <div className="wa7-audio-card">
        <div className="wa7-file-icon audio">AUDIO</div>
        <div className="wa7-file-main">
          <div className="wa7-file-name" title={name}>{name}</div>
          <audio src={url} controls preload="metadata" />
        </div>
      </div>
    );
  }

  if (isPdf(item)) {
    return (
      <article className="wa10-pdf-card" aria-label={`PDF attachment: ${name}`}>
        <div className="wa10-pdf-icon" aria-hidden="true">
          <span>PDF</span>
        </div>

        <div className="wa10-pdf-content">
          <div className="wa10-pdf-name" title={name}>{name}</div>
          <div className="wa10-pdf-meta">{size ? `${size} · PDF document` : "PDF document"}</div>
        </div>

        <div className="wa10-pdf-actions">
          <a className="wa10-pdf-open" href={url} target="_blank" rel="noreferrer">
            Open
          </a>
          <a className="wa10-pdf-download" href={url} download={name} aria-label={`Download ${name}`}>
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </article>
    );
  }

  return (
    <div className="wa7-file-card">
      <div className={`wa7-file-icon ${extensionOf(name).toLowerCase()}`}>{extensionOf(name).slice(0, 4)}</div>
      <div className="wa7-file-main">
        <div className="wa7-file-name" title={name}>{name}</div>
        <div className="wa7-file-meta">{meta || "Document"}</div>
      </div>
      <div className="wa7-file-actions">
        <a href={url} target="_blank" rel="noreferrer">Open</a>
        <a href={url} download={name}>↓</a>
      </div>
    </div>
  );
}
