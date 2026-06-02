import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_TASKS = 224;
const CHANNEL_ALLIANCE = 224;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- متغيرات النظام ---
let lastKnownState = null; 
let b = null;
let isFarming = false; 

// --- 1. دالة المهام (المؤقت) ---
async function performTasks() {
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

function setTimer(isActive) {
    if (lastKnownState === isActive) return; // الحارس لمنع التكرار
    lastKnownState = isActive;
    if (b) clearInterval(b);
    let intervalMs = isActive ? 64000 : 306000;
    console.log(`[LOG] ✅ الحالة: ${isActive ? "نشط" : "غير نشط"}. المؤقت: ${intervalMs/1000} ثانية.`);
    performTasks();
    b = setInterval(performTasks, intervalMs);
}

// --- 2. دوال الكابتشا ---
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0, totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / totalPixels) * 100 > 40;
}

async function solveCaptcha(buffer) {
    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();
    return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
}

// --- 3. دالة فتح الصناديق ---
async function handleBoxFarming(body) {
    if (isFarming) return;
    const gMatch = body.match(/ذهبي:\s*(\d+)/);
    const pMatch = body.match(/نقاط الضمان:\s*(\d+)/);
    const isReady = body.includes('جاهز');

    if (!gMatch || !pMatch) return;
    
    let g = parseInt(gMatch[1]), p = parseInt(pMatch[1]);
    if (isReady && p >= 40) return;

    isFarming = true;
    while (g > 0 && p < 40) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح ذهبي');
        g--; p += 4;
        await new Promise(r => setTimeout(r, 8000));
    }
    isFarming = false;
}

// --- المعالجة الرئيسية ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;

    // أ) معالجة الكابتشا
    if (message.type === 'text/image_link') {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (await isCaptchaByColor(buffer)) {
            const code = await solveCaptcha(buffer);
            if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
        }
        return;
    }

    // ب) معالجة الحالة والمؤقت
    const lines = message.body.split('\n');
    const timeLine = lines.find(line => line.includes('الجهاز الزمني'));
    if (timeLine) {
        setTimer(!timeLine.includes('غير نشط'));
    }

    // ج) فتح الصناديق
    if (message.body.includes('حالة الصناديق')) {
        handleBoxFarming(message.body);
    }
});

client.on('ready', async () => {
    console.log("🚀 البوت متصل. جاري بدء المهام...");
    // تنفيذ أمر البدء
    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
});

client.login(process.env.U_MAIL, process.env.U_PASS);
