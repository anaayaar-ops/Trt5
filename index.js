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

// دالة موحدة لإرسال الأوامر التلقائية مع فحص حالة التوقف
const sendRoutineCommands = async () => {
    if (isPaused) return;
    try {
        await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
        // تأخير بسيط لإرسال أمر الإيداع بعد المهام
        setTimeout(async () => {
            if (!isPaused) {
                await service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل");
            }
        }, 3000);
    } catch (e) {}
};

service.on('groupMessage', async (message) => {
    try {
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        const content = message.body;
        const isMe = message.subscriberId === service.currentSubscriber.id;

        // --- 1. رصد التوقف الإنتاجي ---
        if (content.includes("تم إيقاف الأوامر الإنتاجية مؤقتًا") && content.includes(MY_INFO.keyword)) {
            const match = content.match(/\d+/); 
            if (match) {
                const minutes = parseInt(match[0]);
                isPaused = true;
                console.log(`⚠️ توقف إنتاجي لمدة ${minutes} دقيقة.`);
                setTimeout(() => { isPaused = false; }, minutes * 60 * 1000);
            }
            return;
        }

        // --- 2. رصد نفاذ المفاتيح ---
        if (content.includes("لا تملك مفاتيح!") && message.targetGroupId === settings.taskGroupId) {
            if (Date.now() - lastBoxCommandTime < 10000) {
                canOpenBoxes = false;
                console.log("🚫 توقف أمر الصناديق لنفاذ المفاتيح.");
            }
            return;
        }

        // --- 3. الأولوية القصوى: حل الأسئلة والفخاخ ---
        const isTrap = content.includes("لأنك لاعب مجتهد جدًا اليوم") || content.includes("سؤال التحقق الخاص بك هو");
        const isSafetyAlert = content.includes("يوجد سؤال تحقق نشط");

        if ((isTrap && content.includes(MY_INFO.keyword)) || isSafetyAlert || (isTrap && content.includes("سؤال التحقق"))) {
            
            // طلب الفحص فوراً إذا كان تنبيهاً
            if (isSafetyAlert) {
                await service.messaging.sendGroupMessage(message.targetGroupId, "!مد فحص");
                return;
            }

            console.log(`🎯 تم رصد سؤال.. الأولوية للحل الآن في الروم ${message.targetGroupId}`);
            let answer = null;

            // منطق استخراج الإجابة
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
                // الرد بعد 5 ثوانٍ ثابتة
                setTimeout(async () => {
                    await service.messaging.sendGroupMessage(message.targetGroupId, `!${answer}`);
                    console.log(`✅ تم الحل. العودة للأوامر الروتينية...`);
                    
                    // العودة لتنفيذ المهام فوراً بعد الحل لضمان عدم ضياع الوقت
                    setTimeout(() => sendRoutineCommands(), 2000);
                }, 5000);
            }
        }
    } catch (err) {}
});

service.on('ready', async () => {
    console.log(`🚀 البوت يعمل بنظام الأولوية للحل ثم الأوامر.`);
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);
        
        // تشغيل الدورة الأولى
        sendRoutineCommands();

        // جدولة الأوامر التلقائية
        setInterval(() => sendRoutineCommands(), settings.minuteInterval);

        // جدولة فتح الصناديق
        setInterval(() => {
            if (canOpenBoxes && !isPaused) {
                lastBoxCommandTime = Date.now();
                service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح");
            }
        }, settings.boxInterval);
    } catch (e) {}
});

service.login(settings.identity, settings.secret);
