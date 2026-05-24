// ملف الـ Service Worker للتعامل مع الإشعارات في الخلفية
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'يوتوبيا لاند', body: 'لديكِ تحديث جديد ✨' };
    
    const options = {
        body: data.body,
        icon: 'https://ywbmamklqyrahwqifqdj.supabase.co/storage/v1/object/public/books-images/55555.jpg',
        vibrate: [300, 100, 300, 100, 400],
        tag: 'utopia-chat-msg',
        renotify: true,
        data: { url: self.location.origin }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
            // إذا كان الموقع مفتوحاً بالفعل في أي تبويب
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.startsWith(targetUrl) && 'focus' in client) {
                    return client.focus().then(c => {
                        return c.postMessage({ action: 'open-support' });
                    });
                }
            }
            // إذا كان الموقع مغلقاً، نفتحه مع باراميتر يخبر الكود بفتح الشات فوراً
            if (clients.openWindow) {
                return clients.openWindow(targetUrl + '?openSupport=true');
            }
        })
    );
});