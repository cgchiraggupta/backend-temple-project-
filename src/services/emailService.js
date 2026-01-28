// Email Service using SendGrid
const sgMail = require('@sendgrid/mail');

class EmailService {
    constructor() {
        this.initialized = false;
        this.initializeSendGrid();
    }

    initializeSendGrid() {
        const apiKey = process.env.SENDGRID_API_KEY;

        if (!apiKey) {
            console.log('⚠️ SENDGRID_API_KEY not found - emails will be simulated');
            return;
        }

        sgMail.setApiKey(apiKey);
        this.initialized = true;
        console.log('📧 SendGrid email service initialized');
        console.log('📧 From email:', process.env.EMAIL_FROM || 'Not set');
    }

    async sendEmail({ from, to, subject, html, text }) {
        const fromEmail = from || process.env.EMAIL_FROM || 'noreply@temple.com';
        const fromName = process.env.EMAIL_FROM_NAME || 'Temple Admin';
        const recipients = Array.isArray(to) ? to : [to];

        console.log('📧 Sending email via SendGrid...');
        console.log('📧 From:', `${fromName} <${fromEmail}>`);
        console.log('📧 To:', recipients.join(', '));
        console.log('📧 Subject:', subject);

        if (!this.initialized) {
            console.log('⚠️ SendGrid not initialized - simulating email');
            return {
                success: true,
                messageId: 'simulated-' + Date.now(),
                recipients: recipients.length,
                status: 'simulated'
            };
        }

        try {
            const msg = {
                to: recipients,
                from: {
                    email: fromEmail,
                    name: fromName
                },
                subject: subject,
                html: html,
                text: text || this.htmlToText(html)
            };

            const response = await sgMail.send(msg);

            console.log('✅ Email sent successfully via SendGrid!');
            console.log('📧 Status code:', response[0].statusCode);

            return {
                success: true,
                messageId: response[0].headers['x-message-id'],
                recipients: recipients.length,
                status: 'sent'
            };

        } catch (error) {
            console.error('❌ SendGrid email failed:', error.message);
            if (error.response) {
                console.error('❌ SendGrid error body:', error.response.body);
            }

            return {
                success: false,
                error: error.message,
                status: 'failed'
            };
        }
    }

    async sendBulkEmail({ from, recipients, subject, html, text }) {
        console.log('📧 Sending bulk email via SendGrid...');
        console.log('📧 Recipients:', recipients.length);

        const results = [];
        const batchSize = 10;

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            console.log(`📧 Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recipients.length / batchSize)}`);

            const batchPromises = batch.map(recipient =>
                this.sendEmail({
                    from,
                    to: recipient,
                    subject,
                    html,
                    text
                })
            );

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);

            // Delay between batches
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const failed = results.length - successful;

        console.log(`✅ Bulk email completed: ${successful} sent, ${failed} failed`);

        return {
            success: true,
            total: recipients.length,
            sent: successful,
            failed: failed,
            results: results,
            status: 'sent'
        };
    }

    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
    }

    async testConnection() {
        if (!this.initialized) {
            console.log('⚠️ SendGrid not initialized');
            return false;
        }
        console.log('✅ SendGrid API key is set');
        return true;
    }
}

module.exports = new EmailService();
