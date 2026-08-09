self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Int-Messager", body: event.data ? event.data.text() : "New activity" };
  }

  const title = payload.title || "Int-Messager";
  const options = {
    body: payload.body || "New activity",
    icon: payload.senderAvatarUrl || "/vite.svg",
    badge: "/vite.svg",
    tag: payload.tag || `int-messager-${Date.now()}`,
    renotify: true,
    data: {
      url: payload.url || "/",
      roomSlug: payload.roomSlug || "",
      type: payload.type || "message",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("navigate" in client) {
        await client.navigate(targetUrl);
      }
      if ("focus" in client) {
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(targetUrl);
  })());
});
