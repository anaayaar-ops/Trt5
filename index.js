import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL,
    secret: process.env.U_PASS,
    taskGroupId: 224,
    depositGroupId: 224,
    minuteInterval: 303 * 1000,
    boxInterval: 3 * 60 * 1000
};

const MY_INFO = {
    keyword: "فزآعنا",
    ownerId: "2481425",
    monitorId: 80055399 // العضوية المراقبة للهجوم
};

let canOpenBoxes = true;
let isPaused = false;
let lastBoxCommandTime = 0;
let lastRoutineCommandTime = 0;

const numToWord = {'0':'صفر','1':'واحد','2':'اثنان','3':'ثلاثة','4':'أربعة','5':'خمسة','6':'ستة','7':'سبعة','8':'ثمانية','9':'تسعة','10':'عشرة'};
const wordToNum = {'صفر':'0','واحد':'1','اثنان':'2','ثلاثة':'3','أربعة':'4','خمسة':'5','ستة':'6','سبعة':'7','ثمانية':'8','تسعة':'9','عشرة':'10'};

const service = new WOLF();

// دالة بروتوكول الطوارئ (تنفيذ الأوامر ورا بعض)
const runEmergencyProtocol = async () => {
    isPaused = true;
    console.log("🚨 [طوارئ] تم رصد هجوم ناجح! بدء الحماية في روم 224...");

    const commands = [
        "!مد تحالف سحب كل",
        "!مد تحالف مغادرة",
        "!مد تحالف انشاء  ٍٍِِِ",
        "!مد تحالف ايداع كل",
        "!مد تحالف سلاح شراء 5",
        "!مد تفعيل 5",
        "!مد تحالف سلاح شراء 4",
        "!مد تفعيل 4"
    ];

    for (const cmd of commands) {
        try {
            await service.messaging.sendGroupMessage(settings.depositGroupId, cmd);
            await new Promise(r => setTimeout(r, 1500)); 
        } catch (e) {}
    }

    isPaused = false;
    sendRoutineCommands();
};

const sendRoutineCommands = async () => {
    if (isPaused) return;
    try {
        lastRoutineCommandTime = Date.now();
        await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
        setTimeout(async () => {
            if (!isPaused) {
                lastRoutineCommandTime = Date.now();
                await service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل");
            }
        }, 3000);
    } catch (e) {}
};

// مراقبة الخاص بنظام الصيد (لحل مشكلة عدم الاستجابة للهجوم)
service.on('message', async (message) => {
    try {
        if (!message.isGroup && (message.sourceSubscriberId === MY_INFO.monitorId || message.authorId === MY_INFO.monitorId)) {
            const content = message.body || "";
            if (content.includes("هجوم ناجح من")) {
                await runEmergencyProtocol();
            }
        }
    } catch (err) {}
});

// معالجة رسائل المجموعات (الفخاخ والتحقق)
service.on('groupMessage', async (message) => {
    try {
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup || message.subscriberId === service.currentSubscriber.id) return;

        const content = message.body;

        // 1. نظام التحقق (فحص) بحد 1 ثانية
        if (content.includes("يوجد سؤال تحقق نشط")) {
            const now = Date.now();
            if ((now - lastRoutineCommandTime <= 1000) || (now - lastBoxCommandTime <= 1000)) {
                await service.messaging.sendGroupMessage(message.targetGroupId, "!مد فحص");
            }
            return;
        }

        // 2. محرك حل الفخاخ الشامل
        const isTrap = (content.includes("لأنك لاعب مجتهد") || content.includes("سؤال التحقق")) && content.includes(MY_INFO.keyword);
        
        if (isTrap) {
            let answer = null;

            if (content.includes('عضوية')) {
                answer = MY_INFO.ownerId;
            } 
            else if (content.includes('بالكلمات') || content.includes('بالحروف')) {
                const match = content.match(/\d+/);
                if (match && numToWord[match[0]]) answer = numToWord[match[0]];
            } 
            else if (content.includes('بالأرقام') || content.includes('بالارقام')) {
                for (let word in wordToNum) {
                    if (content.includes(word)) { answer = wordToNum[word]; break; }
                }
            } 
            else if (content.includes('اكتب') && (content.includes('كما هي') || content.includes('كلمة'))) {
                const match = content.match(/:\s*(\S+)/) || content.match(/هي\s+(\S+)/);
                if (match) answer = match[1];
            } 
            else if (content.includes('صح أم خطأ') || content.includes('صح أو خطأ') || content.includes('التحالف') || content.includes('الصناديق')) {
                answer = "صح";
            } 
            else if (content.includes('أيهما') || content.includes('ايهما')) {
                const nums = content.match(/\d+/g);
                if (nums && nums.length >= 2) {
                    const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                    answer = (content.includes('أكبر') || content.includes('اكبر')) ? Math.max(n1, n2) : Math.min(n1, n2);
                }
            } 
            else if (content.includes('ناتج') || content.includes('+') || content.includes('-') || content.includes('جمع') || content.includes('طرح')) {
                const nums = content.match(/\d+/g);
                if (nums && nums.length >= 2) {
                    const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                    answer = (content.includes('-') || content.includes('طرح') || content.includes('ناقص')) ? n1 - n2 : n1 + n2;
                }
            }

            if (answer !== null) {
                setTimeout(async () => {
                    // الرد بـ # قبل الإجابة كما في كودك
                    await service.messaging.sendGroupMessage(message.targetGroupId, `#${answer}`);
                    setTimeout(() => sendRoutineCommands(), 2000);
                }, 5000);
            }
        }
    } catch (err) {}
});

service.on('ready', () => {
    console.log(`✅ فزآعنا متصل وجاهز. مراقبة الهجمات وفخاخ الذكاء نشطة.`);
    try {
        service.group.joinById(settings.taskGroupId);
        service.group.joinById(settings.depositGroupId);
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
