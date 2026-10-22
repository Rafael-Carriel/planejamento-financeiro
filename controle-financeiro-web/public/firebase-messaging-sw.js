// Compatibility cleanup for previous Planeora versions. No push delivery.
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    ...['firestore-cache','auth-cache'].map(name => caches.delete(name)),
    self.registration.pushManager?.getSubscription().then(subscription => subscription?.unsubscribe()).catch(() => undefined),
  ]));
});
