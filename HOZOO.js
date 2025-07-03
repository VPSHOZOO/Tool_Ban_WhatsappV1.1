const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Load message templates
const messageTemplates = {
    ban: JSON.parse(fs.readFileSync('message_ban_whatsapp.json')),
    unban: JSON.parse(fs.readFileSync('message_unban_whatsapp.json'))
};

// Country list with codes
const COUNTRIES = [
    { name: 'Indonesia', code: 'ID', prefix: '+62', pattern: '08|62-8|628' },
    { name: 'United States', code: 'US', prefix: '+1', pattern: '' },
    { name: 'India', code: 'IN', prefix: '+91', pattern: '' }
    // Add more countries as needed
];

// Initialize Telegram bot
const bot = new TelegramBot('7252116522:AAHJlPUkFJJHjN3AufQ6jh6Zm1BIIN1RHLA', {polling: true});

// WhatsApp endpoints
const WHATSAPP_ENDPOINTS = {
    contact: 'https://www.whatsapp.com/contact/?subject=messenger',
    noclient: 'https://www.whatsapp.com/contact/noclient/'
};

// User sessions
const userSessions = {};

// Helper function to validate phone numbers
function isValidPhoneNumber(phone, countryCode = 'ID') {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (!country) return false;

    const regexPatterns = {
        'ID': /^(\+62|62)?[\s-]?0?8[1-9]{1}\d{1}[\s-]?\d{4}[\s-]?\d{2,5}$/,
        'US': /^\+1\d{10}$/,
        'IN': /^\+91\d{10}$/
        // Add more country patterns
    };

    return regexPatterns[countryCode] ? regexPatterns[countryCode].test(phone) : /^\+[\d]{10,15}$/.test(phone);
}

// Bot commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `🚀 WhatsApp Management Bot\n\n` +
        `/validate +628xxxx - Validate a phone number\n` +
        `/report +628xxxx - Report/ban a number\n` +
        `/unban +628xxxx - Request unban for a number\n` +
        `/status - Check active reports\n` +
        `/stop - Stop all active actions`
    );
});

bot.onText(/\/validate (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1].trim();
    
    // Check if number is valid for any country
    const validCountries = COUNTRIES.filter(country => 
        isValidPhoneNumber(phoneNumber, country.code)
        .map(country => country.name);
    
    if (validCountries.length > 0) {
        bot.sendMessage(chatId,
            `✅ Valid phone number\n` +
            `📱 Number: ${phoneNumber}\n` +
            `🌍 Valid in: ${validCountries.join(', ')}`
        );
    } else {
        bot.sendMessage(chatId, '❌ Invalid phone number format');
    }
});

bot.onText(/\/report (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1].trim();
    
    if (!isValidPhoneNumber(phoneNumber, 'ID')) {
        return bot.sendMessage(chatId, '❌ Invalid Indonesian number format. Example: /report +6281234567890');
    }
    
    // Ask for confirmation
    userSessions[chatId] = {
        action: 'ban',
        phoneNumber,
        status: 'pending_confirmation'
    };
    
    bot.sendMessage(chatId,
        `⚠️ Confirm WhatsApp Ban Request\n\n` +
        `📱 Number: ${phoneNumber}\n` +
        `🔢 Country: Indonesia (ID)\n\n` +
        `Are you sure you want to ban this number?`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Yes, ban', callback_data: 'confirm_ban' }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_action' }]
                ]
            }
        }
    );
});

bot.onText(/\/unban (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1].trim();
    
    if (!isValidPhoneNumber(phoneNumber, 'ID')) {
        return bot.sendMessage(chatId, '❌ Invalid Indonesian number format. Example: /unban +6281234567890');
    }
    
    // Ask for confirmation
    userSessions[chatId] = {
        action: 'unban',
        phoneNumber,
        status: 'pending_confirmation'
    };
    
    bot.sendMessage(chatId,
        `⚠️ Confirm WhatsApp Unban Request\n\n` +
        `📱 Number: ${phoneNumber}\n` +
        `🔢 Country: Indonesia (ID)\n\n` +
        `Are you sure you want to request unban for this number?`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Yes, unban', callback_data: 'confirm_unban' }],
                    [{ text: '❌ Cancel', callback_data: 'cancel_action' }]
                ]
            }
        }
    );
});

// Handle button callbacks
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const session = userSessions[chatId];
    
    if (!session) return;
    
    try {
        if (data === 'confirm_ban') {
            session.status = 'processing';
            await bot.sendMessage(chatId, `🚀 Starting ban process for ${session.phoneNumber}...`);
            await submitWhatsAppRequest(chatId, 'ban');
        } 
        else if (data === 'confirm_unban') {
            session.status = 'processing';
            await bot.sendMessage(chatId, `🚀 Starting unban process for ${session.phoneNumber}...`);
            await submitWhatsAppRequest(chatId, 'unban');
        }
        else if (data === 'cancel_action') {
            delete userSessions[chatId];
            await bot.sendMessage(chatId, '❌ Action cancelled');
        }
        
        // Answer the callback query
        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('Callback error:', error);
        await bot.sendMessage(chatId, '⚠️ An error occurred while processing your request');
    }
});

// Status command
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session) {
        return bot.sendMessage(chatId, 'ℹ️ No active sessions');
    }
    
    bot.sendMessage(chatId,
        `📊 Current Session Status\n\n` +
        `📱 Number: ${session.phoneNumber}\n` +
        `⚡ Action: ${session.action}\n` +
        `🔄 Status: ${session.status}\n` +
        `📅 Last update: ${new Date().toLocaleString()}`
    );
});

// Stop command
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (!session) {
        return bot.sendMessage(chatId, 'ℹ️ No active session to stop');
    }
    
    delete userSessions[chatId];
    bot.sendMessage(chatId, '🛑 Active session stopped');
});

// Main function to submit requests to WhatsApp
async function submitWhatsAppRequest(chatId, action) {
    const session = userSessions[chatId];
    if (!session) return;
    
    try {
        // Get random country for diversity
        const randomCountry = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        
        // Get CSRF tokens
        const { fb_dtsg, jazoest, cookies } = await getWhatsAppTokens();
        
        // Prepare form data based on action
        const formData = new URLSearchParams();
        formData.append('fb_dtsg', fb_dtsg);
        formData.append('jazoest', jazoest);
        formData.append('phone', session.phoneNumber);
        formData.append('country', randomCountry.code);
        
        if (action === 'ban') {
            formData.append('email', `user${Math.floor(Math.random() * 10000)}@gmail.com`);
            formData.append('platform', 'Android');
            formData.append('issue', 'spam');
            formData.append('description', messageTemplates.ban.message.replace('${phone}', session.phoneNumber));
        } else {
            formData.append('email', `user${Math.floor(Math.random() * 10000)}@gmail.com`);
            formData.append('description', messageTemplates.unban.message.replace('${phone}', session.phoneNumber));
        }
        
        // Submit the request
        const response = await axios.post(
            action === 'ban' ? WHATSAPP_ENDPOINTS.contact : WHATSAPP_ENDPOINTS.noclient,
            formData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': WHATSAPP_ENDPOINTS.contact,
                    'Origin': 'https://www.whatsapp.com',
                    'Cookie': cookies
                },
                maxRedirects: 0,
                validateStatus: null
            }
        );
        
        if (response.status === 200 || response.status === 302) {
            session.status = 'completed';
            session.lastResponse = 'success';
            
            await bot.sendMessage(chatId,
                `✅ ${action === 'ban' ? 'Ban' : 'Unban'} request successful!\n\n` +
                `📱 Number: ${session.phoneNumber}\n` +
                `🌍 Country: ${randomCountry.name}\n` +
                `📅 Completed at: ${new Date().toLocaleString()}`
            );
        } else {
            throw new Error(`Unexpected status: ${response.status}`);
        }
    } catch (error) {
        console.error(`${action} error:`, error);
        session.status = 'error';
        session.lastError = error.message;
        
        await bot.sendMessage(chatId,
            `❌ ${action === 'ban' ? 'Ban' : 'Unban'} request failed\n\n` +
            `Error: ${error.message}\n\n` +
            `We'll retry in 5 minutes...`
        );
        
        // Retry after delay
        setTimeout(() => submitWhatsAppRequest(chatId, action), 5 * 60 * 1000);
    }
}

// Helper function to get WhatsApp tokens
async function getWhatsAppTokens() {
    const response = await axios.get(WHATSAPP_ENDPOINTS.contact, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    
    const $ = cheerio.load(response.data);
    return {
        fb_dtsg: $('input[name="fb_dtsg"]').val(),
        jazoest: $('input[name="jazoest"]').val(),
        cookies: response.headers['set-cookie']?.join('; ') || ''
    };
}

console.log('🤖 WhatsApp Management Bot is running...');
