import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- متغيرات النظام ---
let isSystemActive = false; // "a" الذي يحدد الحالة
let b = null; // المؤقت "b"

// --- دالة الكابتشا (OCR) ---
async function extractNameFromCaptcha(buffer) {
    const worker = await createWorker();
    await worker.loadLanguage('ara+eng');
    await worker.initialize('ara+eng');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text.trim();
}

// --- دالة المهام (مع تأخير ثانيتين) ---
async function performTasks() {
    console.log(`[LOG] 🚀 بدء دورة المهام.`);
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        console.log(`[LOG] ⏱️ انتظار ثانيتين...`);
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
        console.log(`[LOG] ✅ تم تنفيذ المهام والإيداع.`);
    } catch (e) {
        console.error(`[ERROR] خطأ في التنفيذ: ${e.message}`);
    }
}

// --- إدارة المؤقت B بناءً على الحالة (a) ---
function manageTimer() {
    // إذا كان isSystemActive (a) صحيحاً، السرعة 64 ثانية. وإلا 306 ثانية.
    let intervalMs = isSystemActive ? 64000 : 306000;
    
    console.log(`[LOG] ⚙️ تحليل القرار: الحالة ${isSystemActive ? 'نشطة' : 'خاملة'}. المؤقت B مضبوط كل ${intervalMs/1000} ثانية.`);

    if (b) clearInterval(b);
    performTasks(); // تنفيذ فوري عند تغيير السرعة
    b = setInterval(performTasks, intervalMs);
}

// --- معالجة الرسائل ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;

    // 1. معالجة الصور (الكابتشا)
    if (message.type === 'text/image_link') {
        console.log(`[LOG] 🖼️ استلام صورة كابتشا.`);
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            
            const extractedName = await extractNameFromCaptcha(buffer);
            console.log(`[LOG] 🔍 الاسم المستخرج من الكابتشا: "${extractedName}"`);
            
            // تحقق إذا كان أي اسم من القائمة موجوداً في النص المستخرج
            const isMatch = ALLOWED_PLAYERS.some(name => extractedName.includes(name));
            
            if (isMatch) {
                console.log(`[LOG] ✅ تطابق! اسم من القائمة موجود. جاري الحل...`);
                // هنا منطق إرسال الحل
                await client.messaging.sendGroupMessage(message.targetGroupId, `#1234`); 
            } else {
                console.log(`[LOG] ❌ الاسم غير موجود في القائمة.`);
            }
        } catch (e) { console.error(`[ERROR] خطأ في الكابتشا: ${e.message}`); }
        return;
    }

    // 2. معالجة النصوص (حالة الجهاز والضمان)
    const body = message.body;
    const timeMatch = body.match(/الجهاز الزمني[:\s]+(.*)/);
    const guaranteeMatch = body.match(/حالة الضمان[:\s]+(.*)/);

    if (timeMatch) {
        const timeStatus = timeMatch[1].trim();
        let isReady = guaranteeMatch ? guaranteeMatch[1].includes('جاهز') : false;

        console.log(`[LOG] 🔎 الحالة: [${timeStatus}] | الضمان: [${isReady ? 'جاهز' : 'غير جاهز'}]`);

        // تحديث الحالة (a)
        if (timeStatus.includes('س') || timeStatus.includes('د')) {
            // الجهاز نشط
            isSystemActive = true; 
            console.log(`[LOG] ⏳ الجهاز نشط.`);
        } 
        else if (timeStatus.includes('غير نشط')) {
            if (isReady) {
                console.log(`[LOG] 💎 الضمان جاهز! إرسال أمر.`);
                await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
                isSystemActive = true; // نعتبره نشطاً لساعة
            } else {
                isSystemActive = false; // خامل (كل 306 ثانية)
                console.log(`[LOG] ⚙️ الجهاز غير نشط والضمان غير جاهز.`);
            }
        }
        
        // إعادة ضبط المؤقت بناءً على الحالة الجديدة
        manageTimer();
    }
});

client.on('ready', () => {
    console.log("🚀 البوت متصل. بدء النظام.");
    manageTimer();
});

client.login(process.env.U_MAIL, process.env.U_PASS);
