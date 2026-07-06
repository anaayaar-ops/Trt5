import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL,
    secret: process.env.U_PASS,
    targetRoomId: 9969,
    command1: "!مد مهام",
    command2: "!مد تحالف ايداع كل",
    delayBetweenCommands: 1000,    // 1 ثانية
    delayBeforeRepeat: 62000       // 62 ثانية
};

const service = new WOLF();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// دالة تنفيذ المهام التلقائية
const runAutoTasks = async () => {
    console.log(`🟢 [نظام المهام] بدأ العمل في الروم: ${settings.targetRoomId}`);
    
    while (true) {
        try {
            // إرسال الأمر الأول
            await service.messaging.sendGroupMessage(settings.targetRoomId, settings.command1);
            console.log(`✅ تم إرسال: ${settings.command1}`);

            // انتظار ثانية
            await sleep(settings.delayBetweenCommands);

            // إرسال الأمر الثاني
            await service.messaging.sendGroupMessage(settings.targetRoomId, settings.command2);
            console.log(`✅ تم إرسال: ${settings.command2}`);

            // انتظار 62 ثانية قبل التكرار
            await sleep(settings.delayBeforeRepeat);

        } catch (err) {
            console.error(`❌ حدث خطأ أثناء تنفيذ الأوامر: ${err.message}`);
            // انتظار قصير قبل المحاولة التالية في حال حدوث خطأ
            await sleep(5000);
        }
    }
};

service.on('ready', () => {
    console.log(`✅ البوت متصل بنجاح: ${service.currentSubscriber.nickname}`);
    // بدء تنفيذ المهام فور اتصال البوت
    runAutoTasks();
});

// تسجيل الدخول
service.login(settings.identity, settings.secret);
