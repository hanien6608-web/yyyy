// ملف الـ Service Worker للتعامل مع الإشعارات في الخلفية
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'يوتوبيا لاند', body: 'لديكِ تحديث جديد ✨' };
    
    const options = {
        body: data.body,
        icon: 'https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/55555.png',
        badge: 'https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/55555.png',
        vibrate: [100, 50, 100],
        data: { url: self.location.origin }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});