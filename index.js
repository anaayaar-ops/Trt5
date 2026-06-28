import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const client = new WOLF();

const TARGET_CHANNEL = 9969;

client.on('ready', async () => {
    console.log('🚀 البوت متصل وجاهز للعمل!');

    // الانضمام للقناة المطلوبة
    try {
        await client.group.joinById(TARGET_CHANNEL);
        console.log(`تم الانضمام للقناة: ${TARGET_CHANNEL}`);
    } catch (err) {
        console.error("❌ خطأ في الانضمام للقناة:", err.message);
    }

    // إرسال الأمر كل 20 ثانية
    setInterval(async () => {
        try {
            await client.messaging.sendGroupMessage(TARGET_CHANNEL, '!مط ضرب 3');
            console.log('✅ تم إرسال "!مط ضرب 3" بنجاح.');
        } catch (err) {
            console.error("❌ خطأ في إرسال الرسالة:", err.message);
        }
    }, 20000); // 20,000 مللي ثانية = 20 ثانية
});

// تسجيل الدخول
client.login(process.env.U_MAIL, process.env.U_PASS);
