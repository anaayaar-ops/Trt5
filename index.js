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

// متغيرات التحكم
let canOpenBoxes = true; 
let lastCommandWasMine = false; 
let isPaused = false; // متغير جديد لحالة التوقف المؤقت

const numToWord = {'0':'صفر','1':'واحد','2':'اثنان','3':'ثلاثة','4':'أربعة','5':'خمسة','6':'ستة','7':'سبعة','8':'ثمانية','9':'تسعة','10':'عشرة'};
const wordToNum = {'صفر':'0','واحد':'1','اثنان':'2','ثلاثة':'3','أربعة':'4','خمسة':'5','ستة':'6','سبعة':'7','ثمانية':'8','تسعة':'9','عشرة':'10'};

const service = new WOLF();

service.on('groupMessage', async (message) => {
    try {
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        const content = message.body;
        const isMe = message.subscriberId === service.currentSubscriber.id;

        // --- 1. ميزة التوقف المؤقت عند رصد رسالة الإيقاف الإنتاجي ---
        if (content.includes("تم إيقاف الأوامر الإنتاجية مؤقتًا") && content.includes(MY_INFO.keyword)) {
            // استخراج الأرقام من الرسالة (الدقائق)
            const match = content.match(/مدة\s*(\d+)/);
            if (match) {
                const minutes = parseInt(match[1]);
                isPaused = true;
                console.log(`⚠️ تم رصد توقف إنتاجي! البوت سيتوقف لمدة ${minutes} دقيقة.`);

                // إعادة التشغيل بعد انقضاء المدة
                setTimeout(() => {
                    isPaused = false;
                    console.log("✅ انتهت مدة التوقف، البوت يعاود العمل الآن.");
                }, minutes * 60 * 1000);
            }
            return;
        }

        // إذا كان البوت في حالة توقف، لا يكمل معالجة أي شيء آخر باستثناء الفخاخ (لحمايتك)
        if (isPaused && !content.includes("لأنك لاعب مجتهد جدًا اليوم") && !content.includes("سؤال التحقق")) return;

        // --- 2. ميزة نسخ "ضمان وقت" ---
        if (!isMe && content.includes("!مد صندوق ضمان وقت")) {
            await service.messaging.sendGroupMessage(message.targetGroupId, "!مد صندوق ضمان وقت");
            return;
        }

        // --- 3. نظام تعقب طلبات الصناديق ---
        if (isMe && content.includes("!مد صندوق فتح")) {
            lastCommandWasMine = true;
            return;
        }

        if (content.includes("لا تملك مفاتيح!") && message.targetGroupId === settings.taskGroupId) {
            if (lastCommandWasMine) {
                canOpenBoxes = false;
                console.log("🚫 توقف نهائي للمفاتيح.");
            }
            lastCommandWasMine = false;
            return;
        }

        if (!isMe) lastCommandWasMine = false;

        // --- 4. التعامل مع "!مد فحص" ---
        if (content.includes("يوجد سؤال تحقق نشط") && content.includes("!مد فحص")) {
            await service.messaging.sendGroupMessage(message.targetGroupId, "!مد فحص");
            return;
        }

        // --- 5. المحرك الذكي لحل الفخاخ ---
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
            }, 5000); 
        }
    } catch (err) {}
});

service.on('ready', async () => {
    console.log(`🚀 البوت نشط وجاهز مع ميزة التوقف المؤقت.`);
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);
        
        // الأوامر التلقائية
        setInterval(async () => {
            if (!isPaused) { // لا يرسل الأوامر إذا كان متوقفاً مؤقتاً
                await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
                setTimeout(() => service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل"), 3000);
            }
        }, settings.minuteInterval);

        // فتح الصناديق
        setInterval(() => {
            if (canOpenBoxes && !isPaused) { // لا يرسل الصناديق إذا كان متوقفاً مؤقتاً
                service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح");
            }
        }, settings.boxInterval);
    } catch (e) {}
});

service.login(settings.identity, settings.secret);
