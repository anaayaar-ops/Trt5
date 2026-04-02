process.env.WOLF_JS_IGNORE_VOICE = 'true'; 

import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL,
    secret: process.env.U_PASS,
    targetGroupId: 9969, // رقم القناة (الغرفة)
    commandToSend: "!مد مهام", // الأمر المطلوب إرساله
    intervalDuration: 60 * 1000 // دقيقة واحدة (60 ثانية)
};

const service = new WOLF();

// وظيفة إرسال الرسالة بشكل متكرر
const startSendingLoop = () => {
    setInterval(async () => {
        try {
            await service.messaging.sendGroupMessage(settings.targetGroupId, settings.commandToSend);
            console.log(` ✅ تم إرسال الأمر: "${settings.commandToSend}" إلى القناة: ${settings.targetGroupId}`);
        } catch (err) {
            console.error(" ❌ فشل في إرسال الرسالة:", err.message);
        }
    }, settings.intervalDuration);
};

service.on('ready', async () => {
    console.log(`✅ البوت متصل باسم: ${service.currentSubscriber.nickname}`);
    
    try {
        // محاولة الانضمام للقناة أولاً للتأكد من القدرة على الإرسال
        await service.group.joinById(settings.targetGroupId);
        console.log(` 🏠 تم الدخول إلى القناة رقم: ${settings.targetGroupId}`);
        
        // إرسال أول رسالة فور الدخول
        await service.messaging.sendGroupMessage(settings.targetGroupId, settings.commandToSend);
        
        // بدء الحلقة التكرارية (كل دقيقة)
        startSendingLoop();
        
    } catch (err) {
        console.error(" ❌ حدث خطأ أثناء الانضمام أو الإرسال الأول:", err.message);
    }
});

service.login(settings.identity, settings.secret);
