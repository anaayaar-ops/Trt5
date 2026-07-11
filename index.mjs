import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const service = new WOLF();

const GROUP_ID = 9969; // حطيت رقم الجروب من الصور (targetChannelId)

// دالة تطبع object بشكل واضح من غير الـ client الضخم
function cleanStage(stage) {
    return {
        id: stage.id,
        expireTime: stage.expireTime,
        targetChannelId: stage.targetChannelId
    };
}

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    try {
        // 1) نجيب الاستيجات المتاحة ونطبعها بشكل نضيف (من غير الـ client)
        const stages = await service.stage.getAvailableStages(GROUP_ID);
        console.log('\n=== الاستيجات المتاحة (نسخة نضيفة) ===');
        console.log(stages.map(cleanStage));

        // 2) نتأكد هل احنا أصلاً عضو/عنده صلاحية في الجروب
        const group = await service.group.getById(GROUP_ID);
        console.log('\n=== معلومات الجروب ===');
        console.log({
            id: group.id,
            name: group.name,
            capabilities: group.capabilities // ده مهم: يوضح صلاحياتك في الجروب
        });

        // 3) نحاول نصعد الاستيج ونطبع النتيجة بالتفصيل
        console.log('\n⏳ جاري الصعود على الاستيج...');
        const result = await service.stage.onStage(GROUP_ID);
        console.log('نتيجة onStage:', result);

        if (result === false) {
            console.log('\n⚠️ onStage رجعت false — يعني فشل الانضمام من غير استثناء.');
            console.log('الأسباب المحتملة: مفيش سلوت فاضي / مفيش صلاحية / الاستيج مقفول.');
            return process.exit(0);
        }

        // 4) لو نجحنا، نكمل نجيب باقي التفاصيل
        const slotId = await service.stage.getSlotId(GROUP_ID);
        console.log('\n=== Slot ID ===', slotId);

        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        console.log('\n=== Audio Config ===', audioConfig);

        const broadcastState = await service.stage.getBroadcastState(GROUP_ID);
        console.log('\n=== Broadcast State ===', broadcastState);

    } catch (err) {
        console.error('\n❌ حصل خطأ:', err.message || err);
    }

    process.exit(0);
});

service.on('error', (err) => {
    console.error('❌ خطأ في تسجيل الدخول:', err);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
