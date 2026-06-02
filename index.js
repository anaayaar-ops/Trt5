import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات المشتركة ---
const TARGET_USER_ID = 80055399; 
const CHANNEL_TASKS = 81889058;
const CHANNEL_ALLIANCE = 81889058;
const TARGET_PLAYER_NAME = 'أوكسجينه';

// --- متغيرات الحالة (مجمعة) ---
let isFarming = false;
let currentInterval = 306000;
let lastRequestTime = 0;
let retryTimeout = null;
let isWaitingForBoxStatus = false;
let resetTimer = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. منطق فتح الصناديق (من الكود الأول) ---
async function executeFarmingStrategy(gold, silver, bronze, currentPoints, status) {
    if (isFarming) return;
    const isReady = status.includes('جاهز');
    if (isReady && currentPoints >= 40) return;

    isFarming = true;
    let p = currentPoints;
    let g = gold, s = silver, b = bronze;
    let queue = [];

    while (g > 0 || s > 0 || b > 0) {
        if (isReady && p >= 40) break;
        if (g > 0) { queue.push('!مد صندوق فتح ذهبي'); g--; p += 4; }
        else if (s > 0) { queue.push('!مد صندوق فتح فضي'); s--; p += 2; }
        else if (b > 0) { queue.push('!مد صندوق فتح برونزي'); b--; p += 1; }
        else break;
    }
    
    for (const cmd of queue) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, cmd);
        await new Promise(r => setTimeout(r, 20000));
    }
    isFarming = false;
}

// --- 2. منطق المهام والتوقيت (من الكود الثاني) ---
async function runTaskLoop() {
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

async function requestBoxStatus() {
    lastRequestTime = Date.now();
    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
    isWaitingForBoxStatus = true;
}

// --- 3. منطق الكابتشا وقراءة النصوص (من الكود الثالث) ---
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

// --- التشغيل ---
client.on('ready', async () => {
    console.log("🚀 البوت متصل.");
    setInterval(runTaskLoop, 60000); // المهام كل دقيقة
    setInterval(requestBoxStatus, 30 * 60 * 1000); // الصناديق كل 30 دقيقة
    requestBoxStatus();
});

client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;

    // معالجة الكابتشا
    if (message.type === 'text/image_link') {
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (await isCaptchaByColor(buffer)) {
                const name = await extractPlayerName(buffer);
                if (name.toLowerCase().includes(TARGET_PLAYER_NAME.toLowerCase())) {
                    const code = await solveCaptcha(buffer);
                    if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
                }
            }
        } catch (err) { console.error("⚠️ خطأ في الكابتشا"); }
    }

    // معالجة الصناديق
    const body = message.body;
    const gMatch = body.match(/ذهبي:\s*(\d+)/);
    const pMatch = body.match(/نقاط الضمان:\s*(\d+)/);
    const statusMatch = body.match(/حالة الضمان:\s*(.*)/);

    if (gMatch && pMatch && statusMatch) {
        isWaitingForBoxStatus = false;
        const gold = parseInt(gMatch[1]);
        const silver = parseInt(body.match(/فضي:\s*(\d+)/)[1]);
        const bronze = parseInt(body.match(/برونزي:\s*(\d+)/)[1]);
        const points = parseInt(pMatch[1]);
        const status = statusMatch[1].trim();

        await executeFarmingStrategy(gold, silver, bronze, points, status);
    }
});

client.login(process.env.U_MAIL, process.env.U_PASS);
