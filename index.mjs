import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- دالة تشخيصية لعرض محتويات client ---
function debugClient(c) {
    console.log("--- 🔍 تشخيص كائن الـ Client ---");
    console.log("الخصائص الأساسية في Client:", Object.keys(c));
    
    // فحص خاص لوحدة المراسلة إذا كانت موجودة
    if (c.messaging) {
        console.log("✅ وجدنا 'messaging'! الخصائص بداخلها:", Object.keys(c.messaging));
    } else {
        console.log("❌ لم نجد 'messaging'. هل هي موجودة باسم آخر؟");
    }
    
    // فحص خاص إذا كان هناك 'chat'
    if (c.chat) {
        console.log("✅ وجدنا 'chat'! الخصائص بداخلها:", Object.keys(c.chat));
    }
    
    console.log("----------------------------------");
}

// --- دالة الإرسال الآمنة ---
async function safeSend(groupId, message) {
    // محاولة الإرسال عبر messaging (المسار الأول)
    if (client.messaging && typeof client.messaging.sendGroupMessage === 'function') {
        return await client.messaging.sendGroupMessage(groupId, message);
    }
    // محاولة الإرسال عبر messaging.send (المسار الثاني)
    if (client.messaging && typeof client.messaging.send === 'function') {
        return await client.messaging.send(groupId, message);
    }
    // محاولة الإرسال عبر chat (المسار الثالث)
    if (client.chat && typeof client.chat.sendGroupMessage === 'function') {
        return await client.chat.sendGroupMessage(groupId, message);
    }
    
    console.log("❌ تعذر العثور على دالة الإرسال!");
    return false;
}

// --- باقي الكود (نفس منطقك السابق) ---
const TARGET_USER_ID = 76023268;
const CHANNEL_ID = 9969;
const ALLOWED_PLAYERS = ['تركي.'];
let globalTimer = 0;

function cleanText(text) {
    if (!text) return "";
    const match = text.match(/[a-zA-Z0-9\u0621-\u064A]+/g);
    return match ? match.join('') : "";
}

function formatAnswer(text) { return "#" + cleanText(text); }

// (باقي الدوال: isCaptchaByColor, extractPlayerName, solveCaptcha, processBoxOpening - اتركها كما هي)
// ملاحظة: اختصرت هنا لتوفير المساحة، انسخ دوالك السابقة وضعها هنا
async function isCaptchaByColor(buffer) { /* ... */ return true; }
async function extractPlayerName(buffer) { /* ... */ return ""; }
async function solveCaptcha(buffer) { /* ... */ return null; }
async function processBoxOpening(g, s, b, currentPoints, isNotReady) { /* ... */ }

// --- الأحداث ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId == TARGET_USER_ID && message.targetGroupId == CHANNEL_ID && message.type === 'text/image_link') {
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (!(await isCaptchaByColor(buffer))) return;
            const playerName = await extractPlayerName(buffer);
            if (ALLOWED_PLAYERS.some(n => playerName.includes(n))) {
                const code = await solveCaptcha(buffer);
                if (code) await safeSend(CHANNEL_ID, formatAnswer(code));
            }
        } catch (err) { console.error("⚠️ خطأ كابتشا:", err.message); }
    }
});

client.on('ready', async () => {
    console.log("✅ البوت متصل!");
    
    // تنفيذ التشخيص
    debugClient(client); 
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    // (باقي الـ ready)
    console.log("تم فحص المحتويات، البوت يعمل...");
});

client.login(process.env.U_MAIL, process.env.U_PASS);
