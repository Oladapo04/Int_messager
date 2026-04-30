self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (clientsList.length > 0) {
      await clientsList[0].focus();
      return;
    }
    await clients.openWindow("/");
  })());
});
