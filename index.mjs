import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const service = new WOLF();

// دالة تطبع تفاصيل أي دالة: عدد الباراميترات + شكل الكود (لو متاح)
function inspectFunction(obj, name) {
    const fn = obj[name];
    if (typeof fn !== 'function') return;
    console.log(`\n>>> ${name}  (عدد الباراميترات: ${fn.length})`);
    console.log(fn.toString().slice(0, 300)); // أول 300 حرف بس من كود الدالة
}

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    const importantMethods = [
        'getAvailableStages',
        'onStage',
        'getSlotId',
        'getAudioConfig',
        'updateAudioConfig',
        'getBroadcastState',
        'play',
        'stop'
    ];

    console.log("\n=== تفاصيل دوال الاستيج المهمة ===");
    importantMethods.forEach(name => inspectFunction(service.stage, name));

    // لو عايز تجرب فعليًا على جروب معين، حط الـ ID هنا
    // const targetGroupId = 123456;
    // const stages = await service.stage.getAvailableStages(targetGroupId);
    // console.log("\n=== الاستيجات المتاحة في الجروب ===");
    // console.log(stages);

    process.exit(0);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
