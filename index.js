import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const client = new WOLF();

async function startTaskLoop() {
    while (true) {
        try {
            // استبدلنا sendGroupMessage بـ send
            await client.messaging.send(CHANNEL_ID, '!مد مهام');
            console.log('✅ تم إرسال "!مد مهام"');

            await sleep(1000);

            // استبدلنا sendGroupMessage بـ send
            await client.messaging.send(CHANNEL_ID, '!مد تحالف ايداع كل');
            console.log('✅ تم إرسال "!مد تحالف ايداع كل"');

            console.log('⏳ بانتظار 61 ثانية للدورة القادمة...');
            await sleep(61000);

        } catch (err) {
            console.error("❌ حدث خطأ:", err.message);
            await sleep(5000);
        }
    }
}


// تسجيل الدخول
client.login(process.env.U_MAIL, process.env.U_PASS);
