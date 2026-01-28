// SendGrid Email Service - Real email sending via Twilio SendGrid
const sgMail = require('@sendgrid/mail');

class SendGridEmailService {
    constructor() {
        const apiKey = process.env.SENDGRID_API_KEY;

        if (!apiKey) {
            console.error('⚠️  SENDGRID_API_KEY not found in environment variables');
            console.log('📧 Email service will not work until API key is configured');
            console.log('💡 Add SENDGRID_API_KEY=your_key to .env file');
            return;
        }

        if (!apiKey.startsWith('SG.')) {
            console.error('⚠️  Invalid SendGrid API key format (should start with SG.)');
            return;
        }

        sgMail.setApiKey(apiKey);
        console.log('✅ SendGrid Email Service initialized');
        console.log('📧 Mode: Production (real emails will be sent)');
    }

    async sendEmail({ from, to, subject, html, text }) {
        try {
            const recipients = Array.isArray(to) ? to : [to];

            console.log('\n📧 ===== SENDING EMAIL VIA SENDGRID =====');
            console.log('📤 From:', from || process.env.EMAIL_FROM);
            console.log('📥 To:', recipients.join(', '));
            console.log('📋 Subject:', subject);
            console.log('👥 Recipients:', recipients.length);

            const msg = {
                from: from || process.env.EMAIL_FROM || 'noreply@temple.com',
                to: recipients,
                subject: subject,
                html: html,
                text: text || this.htmlToText(html)
            };

            const response = await sgMail.send(msg);

            console.log('✅ Email sent successfully!');
            console.log('   Status Code:', response[0].statusCode);
            console.log('   Message ID:', response[0].headers['x-message-id']);
            console.log('========================================\n');

            return {
                success: true,
                messageId: response[0].headers['x-message-id'],
                statusCode: response[0].statusCode,
                recipients: recipients
            };

        } catch (error) {
            console.error('\n❌ ===== SENDGRID EMAIL ERROR =====');
            console.error('Error:', error.message);

            if (error.response) {
                console.error('Status Code:', error.response.statusCode);
                console.error('Error Body:', JSON.stringify(error.response.body, null, 2));

                // Provide helpful error messages
                if (error.response.statusCode === 401) {
                    console.error('💡 Invalid API key. Check SENDGRID_API_KEY in .env');
                } else if (error.response.statusCode === 403) {
                    console.error('💡 Sender email not verified. Verify in SendGrid dashboard');
                } else if (error.response.statusCode === 429) {
                    console.error('💡 Rate limit exceeded. Upgrade your SendGrid plan');
                }
            }
            console.error('====================================\n');

            throw error;
        }
    }

    async sendBulkEmail({ from, recipients, subject, html, text }) {
        try {
            console.log('\n📧 ===== SENDING BULK EMAIL VIA SENDGRID =====');
            console.log('👥 Total Recipients:', recipients.length);

            const results = {
                success: [],
                failed: []
            };

            // Send emails one by one (can be optimized with SendGrid's batch API)
            for (let i = 0; i < recipients.length; i++) {
                const recipient = recipients[i];
                console.log(`\n[${i + 1}/${recipients.length}] Sending to: ${recipient}`);

                try {
                    await this.sendEmail({
                        from,
                        to: recipient,
                        subject,
                        html,
                        text
                    });
                    results.success.push(recipient);
                    console.log(`✅ Sent to ${recipient}`);
                } catch (error) {
                    results.failed.push({
                        email: recipient,
                        error: error.message
                    });
                    console.error(`❌ Failed to send to ${recipient}:`, error.message);
                }

                // Add small delay to avoid rate limiting
                if (i < recipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log('\n✅ ===== BULK EMAIL COMPLETED =====');
            console.log('✅ Success:', results.success.length);
            console.log('❌ Failed:', results.failed.length);
            console.log('====================================\n');

            return results;

        } catch (error) {
            console.error('❌ Bulk email error:', error.message);
            throw error;
        }
    }

    // Convert HTML to plain text
    htmlToText(html) {
        if (!html) return '';
        return html
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Test email configuration
    async testConnection() {
        try {
            console.log('🧪 Testing SendGrid connection...');

            const testEmail = {
                from: process.env.EMAIL_FROM || 'test@example.com',
                to: process.env.EMAIL_FROM || 'test@example.com',
                subject: 'SendGrid Test Email',
                html: '<h1>Test Email</h1><p>If you receive this, SendGrid is working!</p>',
                text: 'Test Email - If you receive this, SendGrid is working!'
            };

            await this.sendEmail(testEmail);
            console.log('✅ SendGrid connection test successful!');
            return true;

        } catch (error) {
            console.error('❌ SendGrid connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = new SendGridEmailService();
