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
// هنا قمنا بتغيير المتغير لدعم قائمة أسماء
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// متغيرات التحكم
let currentInterval = 306000;
let isWaitingForBoxStatus = false;
let lastBoxCommandTime = 0;
let resetTimer = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function requestBoxStatus() {
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
        isWaitingForBoxStatus = true;
        lastBoxCommandTime = Date.now();
        setTimeout(() => { isWaitingForBoxStatus = false; }, 10000); 
    } catch (err) {
        console.error("❌ خطأ في طلب الصندوق:", err.message);
    }
}

async function manageGuaranteePoints(points, gold, silver, bronze, isReady) {
    let currentPoints = points;
    let g = gold, s = silver, b = bronze;

    while (true) {
        if (isReady && currentPoints >= 40 && currentPoints <= 45) break;
        if (g === 0 && s === 0 && b === 0) break;

        if (g > 0) {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح ذهبي');
            g--; currentPoints += 4;
        } else if (s > 0) {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح فضي');
            s--; currentPoints += 2;
        } else if (b > 0) {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح برونزي');
            b--; currentPoints += 1;
        }
        isReady = (currentPoints >= 50);
        await sleep(1500);
    }
}

client.on('ready', async () => {
    console.log(`🚀 البوت متصل!`);
    await client.group.joinById(CHANNEL_TASKS);
    await client.group.joinById(CHANNEL_ALLIANCE);
    await requestBoxStatus();
});

// المهام الدورية
setInterval(async () => { try { await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح'); } catch (err) {} }, 5 * 60 * 1000);
setInterval(async () => { try { await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت'); } catch (err) {} }, 60 * 60 * 1000);
setInterval(async () => { await requestBoxStatus(); }, 30 * 60 * 1000);

// حلقة المهام الأساسية
(async () => {
    while (true) {
        try {
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
            await sleep(2000);
            await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
            await sleep(currentInterval);
        } catch (err) { console.error("❌ خطأ:", err.message); await sleep(5000); }
    }
})();

client.on('groupMessage', async (message) => {
    // 1. معالجة حالة الصناديق
    if (isWaitingForBoxStatus && message.sourceSubscriberId === TARGET_USER_ID) {
        const body = message.body;
        const bronzeMatch = body.match(/برونزي:\s*(\d+)/);
        const silverMatch = body.match(/فضي:\s*(\d+)/);
        const goldMatch = body.match(/ذهبي:\s*(\d+)/);
        const pointsMatch = body.match(/نقاط الضمان:\s*(\d+)\/50/);
        const statusMatch = body.match(/حالة الضمان:\s*([^\n\r]+)/);
        const timeMatch = body.match(/الجهاز الزمني[:\s]+(.*)/);

        if (pointsMatch && statusMatch && bronzeMatch && silverMatch && goldMatch) {
            const points = parseInt(pointsMatch[1]);
            const isReady = statusMatch[1].includes('جاهز');
            const timeStatus = timeMatch ? timeMatch[1].trim() : "غير نشط";

            if (timeStatus.includes('غير نشط')) {
                if (isReady) {
                    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
                } else {
                    await manageGuaranteePoints(points, parseInt(goldMatch[1]), parseInt(silverMatch[1]), parseInt(bronzeMatch[1]), isReady);
                    currentInterval = 306000;
                }
            } else {
                currentInterval = 64000;
                const minMatch = timeStatus.match(/(\d+)د/);
                const secMatch = timeStatus.match(/(\d+)ث/);
                const totalSeconds = (minMatch ? parseInt(minMatch[1]) * 60 : 0) + (secMatch ? parseInt(secMatch[1]) : 0);
                if (resetTimer) clearTimeout(resetTimer);
                resetTimer = setTimeout(() => { currentInterval = 306000; }, totalSeconds * 1000);
            }
            isWaitingForBoxStatus = false;
        }
    }

    // 2. معالجة الكابتشا باستخدام القائمة
    const isTargetChannel = (message.targetGroupId === CHANNEL_TASKS || message.targetGroupId === CHANNEL_ALLIANCE);
    if (!isTargetChannel || message.sourceSubscriberId != TARGET_USER_ID || message.type !== 'text/image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!(await isCaptchaByColor(buffer))) return;

        const name = await extractPlayerName(buffer);
        
        // التحقق مما إذا كان الاسم المستخرج موجوداً في القائمة
        const isAllowed = ALLOWED_PLAYERS.some(allowedName => name.includes(allowedName));
        
        if (isAllowed) {
            const code = await solveCaptcha(buffer);
            if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
        }
    } catch (err) { console.error("⚠️ خطأ في الكابتشا:", err.message); }
});

// --- دوال الصور ---
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

client.login(process.env.U_MAIL, process.env.U_PASS);
