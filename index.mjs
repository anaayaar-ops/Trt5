import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF, OnlineState } = wolfjs;

const service = new WOLF();

const GROUP_ID = 9969; // حط رقم الجروب بتاعك

// نخلي البوت يقفل نفسه بنفسه شوية قبل ما الـ 4 ساعات تخلص فعليًا
// (احتياط عشان يقدر يسيب السلوت بلطف قبل ما GitHub تقفل الجوب بالقوة)
const RUN_DURATION_MS = (3 * 60 + 55) * 60 * 1000; // 3 ساعات و55 دقيقة

let currentSlotId = null;

// دالة تنظيف: تسيب السلوت بلطف قبل ما نقفل البرنامج
async function gracefulShutdown(reason) {
    console.log(`\n🛑 جاري إيقاف البوت بسبب: ${reason}`);

    try {
        if (currentSlotId !== null) {
            await service.stage.slot.leave(GROUP_ID, currentSlotId);
            console.log('✅ تم مغادرة الاستيج بلطف.');
        }
    } catch (err) {
        console.error('⚠️ حصل خطأ أثناء مغادرة الاستيج (ممكن يكون خرج بالفعل):', err.message || err);
    }

    process.exit(0);
}

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    // 1) نضبط الحالة إلى "بعيد"
    try {
        await service.setOnlineState(OnlineState.AWAY);
        console.log('✅ تم ضبط الحالة بنجاح إلى: بعيد (Away)');
    } catch (err) {
        console.error('⚠️ فشل ضبط الحالة:', err.message || err);
    }

    // 2) نصعد الاستيج ميوت
    try {
        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        if (!audioConfig.enabled) {
            console.log('❌ الاستيج غير مفعّل في هذا الجروب.');
        } else {
            const slots = await service.stage.slot.list(GROUP_ID);
            const freeSlot = slots.find(s => !s.locked && !s.occupierId && !s.reservedOccupierId);

            if (!freeSlot) {
                console.log('❌ مفيش سلوت فاضي حاليًا.');
            } else {
                console.log(`⏳ جاري الانضمام للسلوت ${freeSlot.id} ...`);
                await service.stage.slot.join(GROUP_ID, freeSlot.id);
                currentSlotId = freeSlot.id;
                console.log('✅ تم الانضمام للاستيج.');

                await service.stage.slot.mute(GROUP_ID, freeSlot.id);
                console.log('🔇 تم كتم الصوت. البوت واقف على الاستيج بصمت.');
            }
        }
    } catch (err) {
        console.error('❌ حصل خطأ أثناء الصعود على الاستيج:', err.message || err, err.data ?? '');
    }

    // 3) نظبط مؤقّت لإيقاف البوت بلطف بعد المدة المحددة
    console.log(`\n⏱️ البوت هيشتغل لمدة ${RUN_DURATION_MS / 1000 / 60} دقيقة ثم يتوقف تلقائيًا.`);
    setTimeout(() => gracefulShutdown('انتهاء مدة التشغيل المحددة'), RUN_DURATION_MS);
});

// نتعامل مع أي إيقاف مفاجئ (زي Ctrl+C أو إشارة إيقاف من GitHub Actions) بنفس اللطف
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

service.on('error', (err) => {
    console.error('❌ خطأ في تسجيل الدخول:', err);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
