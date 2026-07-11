import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const service = new WOLF();

const GROUP_ID = 9969; // حط رقم الجروب بتاعك

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    try {
        // 1) نتأكد إن الاستيج مفعّل
        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        if (!audioConfig.enabled) {
            console.log('❌ الاستيج غير مفعّل في هذا الجروب.');
            return;
        }

        // 2) نلاقي سلوت فاضي
        const slots = await service.stage.slot.list(GROUP_ID);
        const freeSlot = slots.find(s => !s.locked && !s.occupierId && !s.reservedOccupierId);

        if (!freeSlot) {
            console.log('❌ مفيش سلوت فاضي حاليًا.');
            return;
        }

        // 3) الانضمام للسلوت
        console.log(`⏳ جاري الانضمام للسلوت ${freeSlot.id} ...`);
        await service.stage.slot.join(GROUP_ID, freeSlot.id);
        console.log('✅ تم الانضمام للاستيج.');

        // 4) نكتم نفسنا فورًا (مفيش صوت هيتبعت خالص)
        await service.stage.slot.mute(GROUP_ID, freeSlot.id);
        console.log('🔇 تم كتم الصوت. البوت واقف على الاستيج بصمت.');

    } catch (err) {
        console.error('❌ حصل خطأ:', err.message || err, err.data ?? '');
    }

    // من غير process.exit() هنا، عشان البوت يفضل شغال ومتصل
});

service.on('error', (err) => {
    console.error('❌ خطأ في تسجيل الدخول:', err);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
