import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.timquanhday.de',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'no-reply@timquanhday.de',
    pass: process.env.SMTP_PASS || '',
  },
});

export async function sendOTPEmail(email, code) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Tìm Quanh Đây" <no-reply@timquanhday.de>',
      to: email,
      subject: 'Mã xác nhận đặt lại mật khẩu - Tìm Quanh Đây',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 56px; height: 56px; border-radius: 14px; background: #E8F4FD; display: inline-flex; align-items: center; justify-content: center;">
              <span style="font-size: 28px;">📍</span>
            </div>
          </div>
          <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; text-align: center;">Mã xác nhận</h1>
          <p style="font-size: 14px; color: #6B7280; text-align: center; margin-bottom: 24px;">
            Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>${email}</strong>
          </p>
          <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #6B7280; margin-bottom: 8px;">Mã xác nhận của bạn</p>
            <p style="font-size: 36px; font-weight: 800; color: #2563EB; letter-spacing: 8px; margin: 0;">${code}</p>
            <p style="font-size: 12px; color: #9CA3AF; margin-top: 8px;">Mã có hiệu lực trong 10 phút</p>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; text-align: center;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
          </p>
          <div style="border-top: 1px solid #E5E7EB; margin-top: 24px; padding-top: 16px; text-align: center;">
            <p style="font-size: 11px; color: #D1D5DB;">Tìm Quanh Đây — Khám phá những người xung quanh bạn</p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[Mailer] Send OTP error:', err);
    return false;
  }
}