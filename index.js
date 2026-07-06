import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const client = new WOLF();

client.on('ready', async () => {
    console.log('🚀 البوت متصل! جاري استخراج الدوال المتاحة...');

    // فحص الدوال الموجودة داخل client.messaging
    console.log("--- الدوال المتاحة في client.messaging ---");
    if (client.messaging) {
        console.log(Object.keys(client.messaging));
    } else {
        console.log("client.messaging غير موجود!");
    }

    // فحص الدوال الموجودة داخل client.group (غالباً ما تكون دالة الإرسال هنا في النسخ الحديثة)
    console.log("--- الدوال المتاحة في client.group ---");
    if (client.group) {
        console.log(Object.keys(client.group));
    } else {
        console.log("client.group غير موجود!");
    }
    
    console.log("--- انتهى الفحص ---");
});

// تسجيل الدخول
client.login(process.env.U_MAIL, process.env.U_PASS);
