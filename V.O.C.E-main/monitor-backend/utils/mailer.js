const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail', // O Gmail simplifica a configuração de host/port
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendMail = async (to, subject, htmlContent) => {
    const mailOptions = {
        from: `"V.O.C.E - Suporte" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('E-mail enviado: ' + info.response);
        return info;
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        throw error;
    }
};

module.exports = sendMail;