import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 80055399 ;
const CHANNEL_TASKS = 81889058;
const CHANNEL_ALLIANCE = 81889058;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- متغيرات الحالة ---
let isFarming = false;
let lastRequestTime = 0;
let isSystemActive = false;
let b = null; 

// --- 1. دوال الكابتشا ---
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    const totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / totalPixels) * 100 > 40;
}

async function extractPlayerName(buffer) {
    try {
        const processedBuffer = await sharp(buffer).greyscale().threshold(160).toBuffer();
        const worker = await createWorker('ara+eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        await worker.terminate();
        const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
        return match ? match[1].trim() : "لم يتم العثور";
    } catch (e) { return "خطأ"; }
}

async function solveCaptcha(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            if (data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] < 100) {
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }
    if (!found) return null;
    const margin = 10;
    const processedBuffer = await sharp(buffer)
        .extract({ left: minX + margin, top: minY + margin, width: (maxX - minX) - (margin * 2), height: (maxY - minY) - (margin * 2) })
        .greyscale().normalize().linear(1.5, -0.2).sharpen().toBuffer();
    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();
    return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
}

// --- 2. إدارة المهام والزراعة ---
async function performTasks() {
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

async function sendRequestWithRetry() {
    console.log("[LOG] 📤 طلب بيانات الصناديق...");
    lastRequestTime = Date.now();
    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
    
    setTimeout(async () => {
        if (Date.now() - lastRequestTime > 4000) {
            console.log("[LOG] ⏳ لم تصل البيانات، إعادة المحاولة...");
            sendRequestWithRetry();
        }
    }, 10000);
}

// منطق الزراعة الذكي
async function executeFarmingStrategy(gold, silver, bronze, currentPoints, status) {
    if (isFarming) return;
    const isReady = status.includes('جاهز');
    
    // الهدف: إذا كان جاهزاً نتوقف عند 45. إذا لم يكن جاهزاً، نفتح كل الصناديق (نضع رقماً كبيراً كهدف)
    const targetPoints = isReady ? 45 : 99999; 

    isFarming = true;
    console.log(`[LOG] 🧮 بدء الزراعة: الحالة (${status}) | الهدف: ${isReady ? '45 نقطة' : 'جميع الصناديق'}`);

    let p = currentPoints;
    let g = gold, s = silver, b = bronze;
    
    // الحلقة تستمر طالما أننا لم نصل للهدف ولدينا صناديق
    while (p < targetPoints && (g > 0 || s > 0 || b > 0)) {
        let cmd = "";
        
        // الأولوية: ذهبي > فضي > برونزي
        if (g > 0) { cmd = '!مد صندوق فتح ذهبي'; g--; p += 4; }
        else if (s > 0) { cmd = '!مد صندوق فتح فضي'; s--; p += 2; }
        else if (b > 0) { cmd = '!مد صندوق فتح برونزي'; b--; p += 1; }
        
        if (cmd) {
            console.log(`[LOG] 📦 تنفيذ: ${cmd} (نقاط حالية: ${p})`);
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, cmd);
            await new Promise(r => setTimeout(r, 10000)); // 10 ثوانٍ بين الأوامر
        } else break;
    }
    
    isFarming = false;
    console.log("[LOG] ✅ انتهت عملية فتح الصناديق.");
}

// --- 3. المعالجة الرئيسية ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID) return;

    // أ) معالجة الكابتشا
    if (message.type === 'text/image_link' && (message.targetGroupId === CHANNEL_TASKS || message.targetGroupId === CHANNEL_ALLIANCE)) {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (await isCaptchaByColor(buffer)) {
            const name = await extractPlayerName(buffer);
            if (ALLOWED_PLAYERS.some(n => name.includes(n))) {
                const code = await solveCaptcha(buffer);
                if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
            }
        }
        return;
    }

    // ب) معالجة البيانات والزراعة
    const body = message.body;
    if (body.includes('حالة الصناديق')) {
        if (Date.now() - lastRequestTime > 4000) return;

        const gMatch = body.match(/ذهبي:\s*(\d+)/);
        const pMatch = body.match(/نقاط الضمان:\s*(\d+)/);
        const statusMatch = body.match(/حالة الضمان:\s*(.*)/);

        if (gMatch && pMatch && statusMatch) {
            const gold = parseInt(gMatch[1]);
            const silver = parseInt(body.match(/فضي:\s*(\d+)/)?.[1] || 0);
            const bronze = parseInt(body.match(/برونزي:\s*(\d+)/)?.[1] || 0);
            const points = parseInt(pMatch[1]);
            const status = statusMatch[1].trim();

            await executeFarmingStrategy(gold, silver, bronze, points, status);
            
            const timeMatch = body.match(/الجهاز الزمني:\s*(.*)/);
            const newIsActive = timeMatch && (timeMatch[1].includes('س') || timeMatch[1].includes('د'));
            if (newIsActive !== isSystemActive) {
                isSystemActive = newIsActive;
                if (b) clearInterval(b);
                b = setInterval(performTasks, isSystemActive ? 64000 : 306000);
            }
        }
    }
});

client.on('ready', () => {
    console.log("🚀 البوت متصل ومستعد.");
    sendRequestWithRetry();
    setInterval(sendRequestWithRetry, 30 * 60 * 1000);
});

client.login(process.env.U_MAIL, process.env.U_PASS);
