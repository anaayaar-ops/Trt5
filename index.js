import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL || 'your_email@example.com',
    secret: process.env.U_PASS || 'your_password',
    taskGroupId: 9969,
    depositGroupId: 66266,
    minuteInterval: 63 * 1000,
    boxInterval: 3 * 60 * 1000
};

const MY_INFO = {
    keyword: "فزآعنا",  
    ownerId: "2481425"  
};

let canOpenBoxes = true; 
let isPaused = false; 
let lastBoxCommandTime = 0; 

const numToWord = {'0':'صفر','1':'واحد','2':'اثنان','3':'ثلاثة','4':'أربعة','5':'خمسة','6':'ستة','7':'سبعة','8':'ثمانية','9':'تسعة','10':'عشرة'};
const wordToNum = {'صفر':'0','واحد':'1','اثنان':'2','ثلاثة':'3','أربعة':'4','خمسة':'5','ستة':'6','سبعة':'7','ثمانية':'8','تسعة':'9','عشرة':'10'};

const service = new WOLF();

service.on('groupMessage', async (message) => {
    try {
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        const content = message.body;
        const isMe = message.subscriberId === service.currentSubscriber.id;

        // --- 1. رصد رسالة الإيقاف الإنتاجي (تعديل النمط لضمان الاستجابة) ---
        if (content.includes("تم إيقاف الأوامر الإنتاجية مؤقتًا") && content.includes(MY_INFO.keyword)) {
            // البحث عن أي أرقام موجودة في الرسالة لاستخدامها كدقائق
            const match = content.match(/\d+/); 
            if (match) {
                const minutes = parseInt(match[0]);
                isPaused = true;
                console.log(`⚠️ توقف إنتاجي مؤقت لمدة ${minutes} دقيقة.`);

                setTimeout(() => {
                    isPaused = false;
                    console.log("✅ انتهت مدة التوقف.");
                }, minutes * 60 * 1000);
            }
            return;
        }

        if (isPaused && !content.includes("لأنك لاعب مجتهد جدًا اليوم") && !content.includes("سؤال التحقق")) return;

        // --- 2. إيقاف الصناديق عند "لا تملك مفاتيح!" ---
        if (content.includes("لا تملك مفاتيح!") && message.targetGroupId === settings.taskGroupId) {
            const currentTime = Date.now();
            if (currentTime - lastBoxCommandTime < 10000) { // التحقق في غضون 10 ثوانٍ
                canOpenBoxes = false;
                console.log("🚫 تم إيقاف أمر الصناديق.");
            }
            return;
        }

        // --- 3. طلب الفحص التلقائي ---
        if (content.includes("يوجد سؤال تحقق نشط") && content.includes("!مد فحص")) {
            await service.messaging.sendGroupMessage(message.targetGroupId, "!مد فحص");
            return;
        }

        // --- 4. حل الفخاخ (رد ثابت 5 ثوانٍ) ---
        if (isMe) return; 
        if (!content.includes("لأنك لاعب مجتهد جدًا اليوم") && !content.includes("سؤال التحقق")) return;
        if (!content.includes(MY_INFO.keyword) && !content.includes("سؤال التحقق")) return;

        let answer = null;
        if (content.includes('عضوية')) answer = MY_INFO.ownerId;
        else if (content.includes('بالكلمات')) {
            const match = content.match(/\d+/);
            if (match && numToWord[match[0]]) answer = numToWord[match[0]];
        }
        else if (content.includes('بالأرقام')) {
            for (let word in wordToNum) { if (content.includes(word)) { answer = wordToNum[word]; break; } }
        }
        else if (content.includes('اكتب') && (content.includes('كلمة') || content.includes('كما هي'))) {
            const match = content.match(/:\s*(\S+)/) || content.match(/هي\s+(\S+)/);
            if (match) answer = match[1];
        }
        else if (content.includes('صح أم خطأ') || content.includes('التحالف')) answer = "صح";
        else if (content.includes('أيهما')) {
            const nums = content.match(/\d+/g);
            if (nums && nums.length >= 2) {
                const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                answer = (content.includes('أكبر')) ? Math.max(n1, n2) : Math.min(n1, n2);
            }
        }
        else if (content.includes('ناتج')) {
            const nums = content.match(/\d+/g);
            if (nums && nums.length >= 2) {
                const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                answer = (content.includes('-')) ? n1 - n2 : n1 + n2;
            }
        }

        if (answer !== null) {
            setTimeout(async () => {
                await service.messaging.sendGroupMessage(message.targetGroupId, `!${answer}`);
            }, 5000); // الرد بعد 5 ثوانٍ ثابتة
        }
    } catch (err) {}
});

service.on('ready', async () => {
    console.log(`🚀 البوت يعمل: نظام التوقف الإنتاجي وإيقاف المفاتيح مفعّل.`);
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);
        
        setInterval(async () => {
            if (!isPaused) {
                await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
                setTimeout(() => service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل"), 3000);
            }
        }, settings.minuteInterval);

        setInterval(() => {
            if (canOpenBoxes && !isPaused) {
                lastBoxCommandTime = Date.now();
                service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح");
            }
        }, settings.boxInterval);
    } catch (e) {}
});

service.login(settings.identity, settings.secret);
