import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailConfig } from '../../config/configuration';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly backendUrl: string;

  constructor(config: ConfigService) {
    const m = config.get<MailConfig>('mail')!;
    this.resend = m.resendApiKey ? new Resend(m.resendApiKey) : null;
    this.from = `${m.fromName} <${m.fromEmail}>`;
    this.backendUrl = m.backendPublicUrl.replace(/\/$/, '');
  }

  async sendBrandVerification(
    toEmail: string,
    brandName: string,
    token: string,
  ): Promise<void> {
    // Link goes through the API so we can mark the token as used server-side
    // and then 302 the user back to the FE with a status flag.
    const verifyUrl = `${this.backendUrl}/branding/verify?token=${encodeURIComponent(token)}`;
    const subject = `Xác minh email cho thương hiệu "${brandName}"`;
    const html = this.brandVerifyHtml(brandName, verifyUrl);
    const text = this.brandVerifyText(brandName, verifyUrl);

    if (!this.resend) {
      // Dev fallback: log link to console so the developer can click it.
      this.logger.warn(
        `[MAIL DEV] RESEND_API_KEY chưa cấu hình. Verify link cho ${toEmail}: ${verifyUrl}`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: toEmail,
      subject,
      html,
      text,
    });
    if (error) {
      this.logger.error(`Resend lỗi: ${JSON.stringify(error)}`);
      throw new Error('Không gửi được email xác minh');
    }
  }

  private brandVerifyHtml(brandName: string, url: string): string {
    return `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="margin:0 0 16px;font-size:20px">Xác minh email cho "${escapeHtml(brandName)}"</h2>
      <p style="font-size:14px;line-height:1.6;color:#475569">
        Để được hiển thị tick xanh xác minh trên các tour của bạn trên Hôm Nay Đi Đâu,
        hãy bấm nút bên dưới trong vòng 24 giờ.
      </p>
      <p style="margin:24px 0">
        <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;font-size:14px">
          Xác minh email
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;line-height:1.6">
        Nếu nút không hoạt động, copy đường dẫn này:<br>
        <span style="word-break:break-all">${url}</span>
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px">
        Nếu bạn không tạo thương hiệu này, có thể bỏ qua email này.
      </p>
    </body></html>`;
  }

  private brandVerifyText(brandName: string, url: string): string {
    return `Xác minh email cho thương hiệu "${brandName}".\n\nMở liên kết này trong vòng 24 giờ:\n${url}\n\nNếu bạn không yêu cầu, bỏ qua email này.`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
