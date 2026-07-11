import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const service = new WOLF();

// دالة تفحص أي object وتطلع كل الدوال المرتبطة بها (حتى الموروثة من الـ prototype)
function getAllMethods(obj) {
    let methods = new Set();
    let current = obj;
    while (current) {
        Object.getOwnPropertyNames(current).forEach(name => {
            if (typeof current[name] === 'function') { // تم تصليح الخطأ هنا
                methods.add(name);
            }
        });
        current = Object.getPrototypeOf(current);
    }
    return [...methods];
}

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    // 1) كل الخصائص المتوفرة في service
    console.log("\n=== كل الخصائص المتوفرة في service ===");
    console.log(Object.keys(service));

    // 2) دور على أي خاصية اسمها فيها كلمة stage
    const stageRelatedKeys = Object.keys(service).filter(k =>
        k.toLowerCase().includes('stage')
    );
    console.log("\n=== الخصائص المتعلقة بـ stage ===");
    console.log(stageRelatedKeys);

    // 3) لكل خاصية متعلقة بـ stage، اطبع كل الدوال جواها
    stageRelatedKeys.forEach(key => {
        console.log(`\n--- دوال ${key} ---`);
        console.log(getAllMethods(service[key]));
    });

    // 4) احتياطي: دور بكل دوال service نفسها عن أي اسم فيه "stage"
    console.log("\n=== دوال service نفسها (فلترة stage) ===");
    console.log(getAllMethods(service).filter(m => m.toLowerCase().includes('stage')));

    // 5) لو فيه group منضم له، جرب تفحص أي خاصية جواه اسمها فيها stage
    // (لازم تحط ID الجروب بتاعك هنا لو عايز تجرب الجزء ده)
    // const group = await service.group.getById(GROUP_ID);
    // console.log("\n=== خصائص group ===");
    // console.log(Object.keys(group));
    // const groupStageKeys = Object.keys(group).filter(k => k.toLowerCase().includes('stage'));
    // console.log("=== خصائص group متعلقة بـ stage ===", groupStageKeys);

    process.exit(0);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
