import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const service = new WOLF();

// ⚠️ حط هنا ID الجروب اللي عايز تصعد فيه الاستيج
const GROUP_ID = 9969; // <-- غيّر الرقم ده

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    if (!GROUP_ID) {
        console.log('❌ لازم تحط GROUP_ID الصحيح فوق في الكود قبل ما تشغّله');
        return process.exit(1);
    }

    try {
        // 1) نشوف الاستيجات المتاحة في الجروب
        const stages = await service.stage.getAvailableStages(GROUP_ID);
        console.log('\n=== الاستيجات المتاحة ===');
        console.log(stages);

        // 2) نصعد على الاستيج
        console.log('\n⏳ جاري الصعود على الاستيج...');
        const result = await service.stage.onStage(GROUP_ID);
        console.log('✅ نتيجة onStage:', result);

        // 3) نتأكد من السلوت اللي واخده
        const slotId = await service.stage.getSlotId(GROUP_ID);
        console.log('\n=== Slot ID ===');
        console.log(slotId);

        // 4) نشوف إعدادات الصوت الحالية
        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        console.log('\n=== Audio Config ===');
        console.log(audioConfig);

        // 5) نشوف حالة البث
        const broadcastState = await service.stage.getBroadcastState(GROUP_ID);
        console.log('\n=== Broadcast State ===');
        console.log(broadcastState);

    } catch (err) {
        console.error('\n❌ حصل خطأ:', err.message || err);
    }

    process.exit(0);
});

service.on('error', (err) => {
    console.error('❌ خطأ في تسجيل الدخول:', err);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
