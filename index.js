client.on('ready', () => {
    console.log("--- فحص دوال المراسلة المتاحة ---");
    // هذا الأمر سيطبع لك كل الأوامر المتاحة داخل client.messaging
    console.log(Object.keys(client.messaging));
    console.log("------------------------------");
});
