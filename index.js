import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const client = new WOLF();

const CHANNEL_ID = 9969;

// دالة بسيطة للانتظار
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on('ready', async () => {
    console.log(`🚀 البوت متصل! يبدأ العمل في القناة: ${CHANNEL_ID}`);
    
    try {
        await client.group.joinById(CHANNEL_ID);
        console.log(`✅ تم الانضمام للقناة: ${CHANNEL_ID}`);
        
        // بدء حلقة المهام
        startTaskLoop();
    } catch (err) {
        console.error("❌ خطأ في الانضمام للقناة:", err.message);
    }
});

async function startTaskLoop() {
    while (true) {
        try {
            // 1. إرسال أمر المهام
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد مهام');
            console.log('✅ تم إرسال "!مد مهام"');

            // 2. انتظار ثانية واحدة
            await sleep(1000);

            // 3. إرسال أمر التحالف
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد تحالف ايداع كل');
            console.log('✅ تم إرسال "!مد تحالف ايداع كل"');

            // 4. انتظار 61 ثانية قبل التكرار
            console.log('⏳ بانتظار 61 ثانية للدورة القادمة...');
            await sleep(61000);

        } catch (err) {
            console.error("❌ حدث خطأ أثناء إرسال الرسائل، سيتم المحاولة مجدداً:", err.message);
            await sleep(5000); // انتظار 5 ثواني عند الخطأ قبل إعادة المحاولة
        }
    }
}

// تسجيل الدخول
client.login(process.env.U_MAIL, process.env.U_PASS);
