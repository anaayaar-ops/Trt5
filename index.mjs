import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF, OnlineState } = wolfjs;

const service = new WOLF();

const GROUP_ID = 18432094; 
const WATCHED_SUBSCRIBER_IDS = [51660277, 35543686, 80014666]; 
const LEAVE_COMMAND = '!كات نزول';
const JOIN_COMMAND = '!كات صعود';


const RUN_DURATION_MS = 5 * 60 * 60 * 1000; // 5 ساعات
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 دقايق
const MAX_OCCUPANTS_TO_JOIN = 1;

let currentSlotId = null;
let checkIntervalHandle = null;


let manualStop = false;


async function forceRefreshSlots(targetChannelId) {
    try {
        const channel = await service.channel.getById(targetChannelId);
        channel.slots = null;
    } catch (err) {
        console.error('⚠️ فشل تفريغ الكاش:', err.message || err);
    }
}

async function gracefulShutdown(reason) {
    console.log(`\n🛑 جاري إيقاف البوت بسبب: ${reason}`);

    if (checkIntervalHandle) {
        clearInterval(checkIntervalHandle);
    }

    try {
        if (currentSlotId !== null) {
            await forceRefreshSlots(GROUP_ID);
            await service.stage.slot.leave(GROUP_ID, currentSlotId);
            console.log('✅ تم مغادرة الاستيج بلطف.');
        }
    } catch (err) {
        console.error('⚠️ حصل خطأ أثناء مغادرة الاستيج (ممكن يكون خرج بالفعل):', err.message || err);
    }

    process.exit(0);
}

async function checkStageAndJoin() {
    try {
        if (manualStop) {
            console.log('\n⏸️ البوت متوقف يدويًا (بعد أمر "كات نزول")، مفيش فحص تلقائي للاستيج حتى يوصل أمر "كات صعود" أو يعاد تشغيل البوت.');
            return;
        }

        if (currentSlotId !== null) {
            console.log('\nℹ️ البوت أصلاً واقف على الاستيج، مفيش داعي لفحص جديد.');
            return;
        }

        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        if (!audioConfig.enabled) {
            console.log('\n❌ الاستيج غير مفعّل في هذا الجروب.');
            return;
        }

        await forceRefreshSlots(GROUP_ID);
        const slots = await service.stage.slot.list(GROUP_ID);
        const occupants = slots.filter(s => !!s.occupierId);

        console.log(`\n🔍 فحص الاستيج: عدد الأشخاص الموجودين حاليًا = ${occupants.length}`);

        if (occupants.length > MAX_OCCUPANTS_TO_JOIN) {
            console.log(`⏸️ يوجد ${occupants.length} أشخاص (أكتر من الحد المسموح ${MAX_OCCUPANTS_TO_JOIN})، مش هنصعد دلوقتي.`);
            return;
        }

        const freeSlot = slots.find(s => !s.occupierId && !s.reservedOccupierId);

        if (!freeSlot) {
            console.log('❌ مفيش سلوت فاضي حاليًا رغم إن العدد قليل (ممكن كله محجوز مؤقتًا).');
            return;
        }

        console.log(`✅ العدد مناسب (${occupants.length} شخص/أشخاص) — جاري الانضمام للسلوت ${freeSlot.id} ...`);
        await service.stage.slot.join(GROUP_ID, freeSlot.id);
        currentSlotId = freeSlot.id;
        console.log('✅ تم الانضمام للاستيج بصمت.');

    } catch (err) {
        console.error('❌ حصل خطأ أثناء فحص/الانضمام للاستيج:', err.message || err, err.data ?? '');
    }
}


async function forceJoinStage() {
    try {
        if (currentSlotId !== null) {
            console.log('\nℹ️ البوت أصلاً واقف على الاستيج.');
            return;
        }

        const audioConfig = await service.stage.getAudioConfig(GROUP_ID);
        if (!audioConfig.enabled) {
            console.log('\n❌ الاستيج غير مفعّل في هذا الجروب.');
            return;
        }

        await forceRefreshSlots(GROUP_ID);
        const slots = await service.stage.slot.list(GROUP_ID);
        const freeSlot = slots.find(s => !s.occupierId && !s.reservedOccupierId);

        if (!freeSlot) {
            console.log('❌ مفيش سلوت فاضي حاليًا حتى مع أمر الصعود الإجباري.');
            return;
        }

        console.log(`✅ صعود إجباري بأمر من المستخدم — جاري الانضمام للسلوت ${freeSlot.id} ...`);
        await service.stage.slot.join(GROUP_ID, freeSlot.id);
        currentSlotId = freeSlot.id;
        console.log('✅ تم الانضمام للاستيج بنجاح (صعود إجباري).');

    } catch (err) {
        console.error('❌ حصل خطأ أثناء الصعود الإجباري:', err.message || err, err.data ?? '');
    }
}

service.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول: ${service.currentSubscriber.nickname}`);

    try {
        await service.setOnlineState(OnlineState.BUSY);
        console.log('✅ تم ضبط الحالة بنجاح إلى: بعيد (Away)');
    } catch (err) {
        console.error('⚠️ فشل ضبط الحالة:', err.message || err);
    }

    await checkStageAndJoin();

    checkIntervalHandle = setInterval(checkStageAndJoin, CHECK_INTERVAL_MS);

    console.log(`\n⏱️ البوت هيشتغل لمدة ${RUN_DURATION_MS / 1000 / 60} دقيقة ثم يتوقف تلقائيًا.`);
    setTimeout(() => gracefulShutdown('انتهاء مدة التشغيل المحددة'), RUN_DURATION_MS);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

service.on('error', (err) => {
    console.error('❌ خطأ في تسجيل الدخول:', err);
});

service.on('privateMessage', async (message) => {
    try {
        const senderId = Number(message.authorId || message.sourceSubscriberId);
        const text = message.content || message.body || '';

        if (!WATCHED_SUBSCRIBER_IDS.includes(senderId)) {
            return;
        }

        if (text.includes(LEAVE_COMMAND)) {
            console.log(`\n📥 استلمنا أمر النزول من العضوية ${senderId}`);

            manualStop = true; // يبقى متوقف تمامًا لحد أمر الصعود أو إعادة التشغيل

            if (currentSlotId !== null) {
                await forceRefreshSlots(GROUP_ID);
                await service.stage.slot.leave(GROUP_ID, currentSlotId);
                currentSlotId = null;
                console.log('✅ "كات صعود" أو إعادة التشغيل.');
            } else {
                console.log('ℹ️ "كات صعود".');
            }

        } else if (text.includes(JOIN_COMMAND)) {
            console.log(`\n📥 استلمنا أمر الصعود الإجباري من العضوية ${senderId}`);

            manualStop = false; // نلغي حالة التوقف اليدوي
            await forceJoinStage();
        }

    } catch (err) {
        console.error('❌ خطأ أثناء معالجة الرسالة:', err.message || err);
    }
});

service.login(process.env.U_MAIL, process.env.U_PASS);
