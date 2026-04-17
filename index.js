import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL || 'your_email@example.com',
    secret: process.env.U_PASS || 'your_password',
    taskGroupId: 330865 ,
    depositGroupId: 224,
    minuteInterval: 63 * 1000,
    boxInterval: 3 * 60 * 1000
};

const MY_INFO = {
    keyword: "فزآعنا",  
    ownerId: "2481425"  
};

// متغيرات التحكم والحالة
let canOpenBoxes = true; 
let isPaused = false; 
let lastBoxCommandTime = 0; 

const numToWord = {'0':'صفر','1':'واحد','2':'اثنان','3':'ثلاثة','4':'أربعة','5':'خمسة','6':'ستة','7':'سبعة','8':'ثمانية','9':'تسعة','10':'عشرة'};
const wordToNum = {'صفر':'0','واحد':'1','اثنان':'2','ثلاثة':'3','أربعة':'4','خمسة':'5','ستة':'6','سبعة':'7','ثمانية':'8','تسعة':'9','عشرة':'10'};

const service = new WOLF();

// دالة الأوامر التلقائية (مهام + إيداع)
const sendRoutineCommands = async () => {
    if (isPaused) return;
    try {
        await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
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

        // 1. رصد التوقف الإنتاجي (استخراج الدقائق بدقة)
        if (content.includes("تم إيقاف الأوامر الإنتاجية مؤقتًا") && content.includes(MY_INFO.keyword)) {
            const match = content.match(/\d+/); 
            if (match) {
                const minutes = parseInt(match[0]);
                isPaused = true;
                console.log(`⚠️ توقف إنتاجي لمدة ${minutes} دقيقة.`);
                setTimeout(() => { isPaused = false; console.log("✅ انتهى التوقف."); }, minutes * 60 * 1000);
            }
            return;
        }

        // 2. رصد نفاذ المفاتيح (إيقاف الأمر فوراً)
        if (content.includes("لا تملك مفاتيح!") && message.targetGroupId === settings.taskGroupId) {
            if (Date.now() - lastBoxCommandTime < 10000) {
                canOpenBoxes = false;
                console.log("🚫 تم إيقاف الصناديق لنفاذ المفاتيح.");
            }
            return;
        }

        // 3. نظام الأولوية القصوى (الفخاخ + التحقق)
        const isTrap = content.includes("لأنك لاعب مجتهد جدًا اليوم") || content.includes("سؤال التحقق الخاص بك هو");
        const isSafetyAlert = content.includes("يوجد سؤال تحقق نشط");

        if ((isTrap && content.includes(MY_INFO.keyword)) || isSafetyAlert || (isTrap && content.includes("سؤال التحقق"))) {
            
            if (isSafetyAlert) {
                await service.messaging.sendGroupMessage(message.targetGroupId, "!مد فحص");
                return;
            }

            console.log(`🎯 رصد سؤال في ${message.targetGroupId}.. جاري الحل بالأولوية.`);
            let answer = null;

            // --- محرك الحل الشامل (تم دمج كافة شروط الكود القديم) ---
            
            // أ. عضوية المالك
            if (content.includes('عضوية')) {
                answer = MY_INFO.ownerId;
            }
            
            // ب. تحويل الكلمات/الأرقام
            else if (content.includes('بالكلمات') || content.includes('بالحروف')) {
                const match = content.match(/\d+/);
                if (match && numToWord[match[0]]) answer = numToWord[match[0]];
            }
            else if (content.includes('بالأرقام') || content.includes('بالارقام')) {
                for (let word in wordToNum) {
                    if (content.includes(word)) { answer = wordToNum[word]; break; }
                }
            }

            // ج. اكتب الكلمة كما هي
            else if (content.includes('اكتب') && (content.includes('كلمة') || content.includes('كما هي'))) {
                const match = content.match(/:\s*(\S+)/) || content.match(/هي\s+(\S+)/);
                if (match) answer = match[1];
            }

            // د. صح أم خطأ
            else if (content.includes('صح أم خطأ') || content.includes('صح أو خطأ') || content.includes('التحالف') || content.includes('الصناديق')) {
                answer = "صح";
            }

            // هـ. المقارنة (أكبر / أصغر)
            else if (content.includes('أيهما') || content.includes('ايهما')) {
                const nums = content.match(/\d+/g);
                if (nums && nums.length >= 2) {
                    const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                    answer = (content.includes('أكبر') || content.includes('اكبر')) ? Math.max(n1, n2) : Math.min(n1, n2);
                }
            }

            // و. العمليات الحسابية
            else if (content.includes('ناتج') || content.includes('+') || content.includes('-')) {
                const nums = content.match(/\d+/g);
                if (nums && nums.length >= 2) {
                    const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                    answer = (content.includes('-') || content.includes('طرح') || content.includes('ناقص')) ? n1 - n2 : n1 + n2;
                }
            }

            // إرسال الإجابة بعد 5 ثوانٍ ثم استئناف الأوامر
            if (answer !== null) {
                setTimeout(async () => {
                    await service.messaging.sendGroupMessage(message.targetGroupId, `!${answer}`);
                    console.log(`✅ تم الإرسال: !${answer}`);
                    
                    // استئناف الأوامر فوراً بعد الحل
                    setTimeout(() => sendRoutineCommands(), 2000);
                }, 5000);
            }
        }
    } catch (err) {}
});

service.on('ready', async () => {
    console.log(`🚀 البوت متصل.. الأولوية للحل ونظام الرومين نشط.`);
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);
        
        sendRoutineCommands();
        setInterval(() => sendRoutineCommands(), settings.minuteInterval);

        setInterval(() => {
            if (canOpenBoxes && !isPaused) {
                lastBoxCommandTime = Date.now();
                service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح");
            }
        }, settings.boxInterval);
    } catch (e) {}
});

service.login(settings.identity, settings.secret);
