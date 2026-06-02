import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 80055399;
const CHANNEL_ID = 81889058; 
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- المعالجة الرئيسية ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID) return;
    if (message.targetGroupId != CHANNEL_ID) return;
    if (message.type !== 'text/image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        if (!(await isCaptchaByColor(buffer))) return;

        const playerName = await extractPlayerName(buffer);
        
        if (ALLOWED_PLAYERS.some(n => playerName.includes(n))) {
            console.log(`✅ تم التعرف على اللاعب: ${playerName} - جاري الحل...`);
            const code = await solveCaptcha(buffer);
            if (code) {
                await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
                console.log(`🚀 تم إرسال الحل: #${code}`);
            }
        } else {
            console.log(`❌ اسم اللاعب غير مسموح: ${playerName}`);
        }
    } catch (err) {
        console.error("⚠️ خطأ في معالجة الكابتشا:", err.message);
    }
});

// --- الدوال ---

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
        return match ? match[1].trim() : "";
    } catch (e) { return ""; }
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

client.on('ready', () => {
    console.log("🚀 البوت يعمل الآن (مراقب للكابتشا فقط)");

    const sendBoxCommand = async () => {
        try {
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد صندوق');
            console.log("📥 تم إرسال أمر !مد صندوق");

            const responseHandler = async (message) => {
                if (message.targetGroupId == CHANNEL_ID && message.body.startsWith('/me 📦 حالة الصناديق')) {
                    
                    const matchA = message.body.match(/حالة الضمان:\s*(.*)/);
                    const matchB = message.body.match(/الجهاز الزمني:\s*(.*)/);

                    const a = matchA ? matchA[1].trim() : "";
                    const b = matchB ? matchB[1].trim() : "";

                    let timer = 0;

                    // البحث في المتغير b
                    if (b.includes("غير نشط")) {
                        // البحث في المتغير a فقط
                        if (!a.includes("غير جاهز")) {
                            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد صندوق ضمان وقت');
                            timer = 3 * 60 * 60; // 3 ساعات بالثواني
                        } else {
                            timer = 0;
                        }
                    } else {
                        // استخراج الوقت من b وحسابه بالثواني
                        const h = b.match(/(\d+)س/);
                        const m = b.match(/(\d+)د/);
                        const s = b.match(/(\d+)ث/);

                        if (h) timer += parseInt(h[1]) * 3600;
                        if (m) timer += parseInt(m[1]) * 60;
                        if (s) timer += parseInt(s[1]);
                    }

                    console.log("قيمة a:", a);
                    console.log("قيمة b:", b);
                    console.log("قيمة timer (بالثواني):", timer);

                    client.removeListener('groupMessage', responseHandler);
                }
            };

            client.on('groupMessage', responseHandler);

            setTimeout(() => {
                client.removeListener('groupMessage', responseHandler);
            }, 5000);

        } catch (err) {
            console.error("⚠️ خطأ في تنفيذ أمر مد الصندوق:", err.message);
        }
    };

    sendBoxCommand();
    setInterval(sendBoxCommand, 30 * 60 * 1000);
});

client.login(process.env.U_MAIL, process.env.U_PASS);
