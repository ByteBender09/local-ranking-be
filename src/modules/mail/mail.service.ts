import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailConfig } from '../../config/configuration';

// Inbox for partner inquiries. Keep in one place so a future config-driven
// override (e.g. PARTNER_INBOX env var) is a single change.
const PARTNER_INBOX = 'partners@homnaydidau.xyz';

export interface PartnerInquiryPayload {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  partnershipType: string;
  location?: string;
  website?: string;
  message: string;
}

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

  // Partner inquiry — anonymous "Liên hệ hợp tác" form submission. Mails the
  // partners inbox with the structured form fields and sets reply-to to the
  // applicant so a reply lands back in their inbox directly.
  async sendPartnerInquiry(payload: PartnerInquiryPayload): Promise<void> {
    const subject = `[Đối tác] ${payload.partnershipType} · ${payload.name}`;
    const html = this.partnerInquiryHtml(payload);
    const text = this.partnerInquiryText(payload);

    if (!this.resend) {
      this.logger.warn(
        `[MAIL DEV] RESEND_API_KEY chưa cấu hình. Partner inquiry từ ${payload.email}:\n${text}`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: PARTNER_INBOX,
      replyTo: payload.email,
      subject,
      html,
      text,
    });
    if (error) {
      this.logger.error(`Resend lỗi (partner inquiry): ${JSON.stringify(error)}`);
      throw new Error('Không gửi được yêu cầu hợp tác');
    }
  }

  private partnerInquiryHtml(p: PartnerInquiryPayload): string {
    const row = (label: string, value?: string) =>
      value && value.trim().length > 0
        ? `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;font-size:14px;color:#0f172a;word-break:break-word">${escapeHtml(value)}</td></tr>`
        : '';
    return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;max-width:640px;margin:0 auto;color:#0f172a;background:#f8fafc">
      <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0">
        <div style="font-size:12px;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Yêu cầu hợp tác</div>
        <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(p.name)} muốn trở thành đối tác</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          ${row('Loại hình', p.partnershipType)}
          ${row('Tổ chức', p.organization)}
          ${row('Email', p.email)}
          ${row('Điện thoại', p.phone)}
          ${row('Địa bàn', p.location)}
          ${row('Website / Social', p.website)}
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:8px">Lời nhắn</div>
          <div style="font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-wrap">${escapeHtml(p.message)}</div>
        </div>
        <div style="margin-top:24px;font-size:12px;color:#94a3b8">
          Reply trực tiếp email này để liên hệ với ${escapeHtml(p.name)} (${escapeHtml(p.email)}).
        </div>
      </div>
    </body></html>`;
  }

  private partnerInquiryText(p: PartnerInquiryPayload): string {
    const lines = [
      `Yêu cầu hợp tác mới từ ${p.name} (${p.email})`,
      '',
      `Loại hình: ${p.partnershipType}`,
      p.organization ? `Tổ chức: ${p.organization}` : null,
      p.phone ? `Điện thoại: ${p.phone}` : null,
      p.location ? `Địa bàn: ${p.location}` : null,
      p.website ? `Website/Social: ${p.website}` : null,
      '',
      'Lời nhắn:',
      p.message,
    ].filter(Boolean);
    return lines.join('\n');
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
