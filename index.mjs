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
            if (typeof obj[name] === 'function') {
                methods.add(name);
            }
        });
        current = Object.getPrototypeOf(current);
    }
    return [...methods];
}

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    // 1) اطبع كل "المدراء" (managers) المتوفرة في الكلينت الرئيسي
    console.log("\n=== كل الخصائص المتوفرة في service ===");
    console.log(Object.keys(service));

    // 2) دور تحديدًا على أي خاصية اسمها فيها كلمة event
    const eventRelatedKeys = Object.keys(service).filter(k => 
        k.toLowerCase().includes('event')
    );
    console.log("\n=== الخصائص المتعلقة بـ event ===");
    console.log(eventRelatedKeys);

    // 3) لكل خاصية متعلقة بـ event، اطبع كل الدوال جواها
    eventRelatedKeys.forEach(key => {
        console.log(`\n--- دوال ${key} ---`);
        console.log(getAllMethods(service[key]));
    });

    // 4) احتياطي: لو الاسم مختلف تمامًا، دور بكل الكلينت عن أي دالة اسمها فيها "event"
    console.log("\n=== كل دوال service نفسها (فلترة event) ===");
    console.log(getAllMethods(service).filter(m => m.toLowerCase().includes('event')));

    process.exit(0);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
