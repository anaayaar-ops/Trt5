import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF, OnlineState } = wolfjs;

const service = new WOLF();

const GROUP_ID = 224; // حط رقم الجروب بتاعك

const RUN_DURATION_MS = (3 * 60 + 55) * 60 * 1000; // 3 ساعات و55 دقيقة

let currentSlotId = null;

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

    try {
        await service.setOnlineState(OnlineState.AWAY);
        console.log('✅ تم ضبط الحالة بنجاح إلى: بعيد (Away)');
    } catch (err) {
        console.error('⚠️ فشل ضبط الحالة:', err.message || err);
    }

    try {
        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        if (!audioConfig.enabled) {
            console.log('❌ الاستيج غير مفعّل في هذا الجروب.');
        } else {
            const slots = await service.stage.slot.list(GROUP_ID);
            console.log('\n=== السلوتات المتاحة (تشخيص) ===');
            console.log(slots.map(s => ({ id: s.id, locked: s.locked, occupierId: s.occupierId, reservedOccupierId: s.reservedOccupierId })));

            // ملحوظة: شلنا شرط "!s.locked" لأن دالة join() نفسها في المكتبة
            // مش بتتأكد من خاصية locked أصلاً، وبما إنك أدمن مفروض تقدر
            // تدخل أي سلوت مش محجوز فعليًا (occupierId / reservedOccupierId)
            const freeSlot = slots.find(s => !s.occupierId && !s.reservedOccupierId);

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

    console.log(`\n⏱️ البوت هيشتغل لمدة ${RUN_DURATION_MS / 1000 / 60} دقيقة ثم يتوقف تلقائيًا.`);
    setTimeout(() => gracefulShutdown('انتهاء مدة التشغيل المحددة'), RUN_DURATION_MS);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

service.on('error', (err) => {
    console.error('❌ خطأ في تسجيل الدخول:', err);
});

service.login(process.env.U_MAIL, process.env.U_PASS);
