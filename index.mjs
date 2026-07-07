import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const CHANNEL_ID = 9969; 
const X = 63000; // اضبط الوقت هنا (بالملي ثانية)

// --- دالة الإرسال ---
async function sendMessage(message) {
    try {
        await client.messaging.sendChannelMessage(CHANNEL_ID, message);
        console.log(`تم إرسال: ${message}`);
    } catch (e) {
        console.error("خطأ أثناء الإرسال:", e.message);
    }
}

// --- منطق التشغيل ---
client.on('ready', async () => {
    console.log("✅ البوت متصل!");
    
    // محاولة دخول الغرفة
    try {
        await client.group.join(CHANNEL_ID);
        console.log(`تم الانضمام للغرفة: ${CHANNEL_ID}`);
    } catch (e) {
        console.log("ربما البوت موجود مسبقاً في الغرفة.");
    }

    // حلقة العمليات المستمرة
    while (true) {
        // 1. إرسال المهام
        await sendMessage('!مد مهام');
        
        // 2. انتظار ثانية
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 3. إرسال تحالف ايداع
        await sendMessage('!مد تحالف ايداع كل');
        
        // 4. انتظار المدة المحددة X
        await new Promise(resolve => setTimeout(resolve, X));
    }
});

// تسجيل الدخول
client.login(process.env.U_MAIL, process.env.U_PASS);
