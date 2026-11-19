import { Injectable, HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';

export type OtpPurpose = 'company_auth' | 'admin_auth';

@Injectable()
export class EmailOtpService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService) {}

  private digest(challengeId: string, code: string): string {
    return createHmac('sha256', this.config.get('JWT_SECRET')).update(challengeId + ':' + code).digest('hex');
  }

  async issue(emailValue: string, principalId: string, purpose: OtpPurpose) {
    const email = String(emailValue || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new UnauthorizedException('A valid account email is required');

    const smtpHost = this.config.get('SMTP_HOST');
    const smtpPort = this.config.get('SMTP_PORT');
    const smtpSecure = this.config.get('SMTP_SECURE');
    const smtpUser = this.config.get('SMTP_USER');
    const smtpPass = this.config.get('SMTP_PASS');
    const from = this.config.get('ARA_AUTH_EMAIL_FROM') || smtpUser;
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !from) {
      throw new ServiceUnavailableException('Gmail SMTP is not configured. Contact the platform administrator.');
    }

    const recent = await this.db.query(
      'SELECT sent_at FROM auth_email_otps WHERE lower(email)=lower($1) AND purpose=$2 AND sent_at>now()-interval \'60 seconds\' ORDER BY sent_at DESC LIMIT 1',
      [email, purpose],
    );
    if (recent.rowCount) throw new HttpException('Please wait 60 seconds before requesting another code.', 429);

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const challengeId = randomUUID();
    await this.db.query(
      'UPDATE auth_email_otps SET consumed_at=now() WHERE lower(email)=lower($1) AND purpose=$2 AND consumed_at IS NULL',
      [email, purpose],
    );
    await this.db.query(
      'INSERT INTO auth_email_otps(id,email,purpose,principal_id,code_hash,expires_at,sent_at) VALUES($1,$2,$3,$4,$5,now()+interval \'5 minutes\',now())',
      [challengeId, email, purpose, principalId, this.digest(challengeId, code)],
    );

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        requireTLS: !smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
      await transporter.sendMail({
        from: { name: 'ARA', address: from },
        to: email,
        subject: 'Your ARA verification code',
        text: 'Your ARA verification code is ' + code + '. It expires in 5 minutes. If you did not request this code, you can ignore this email.',
        html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#172033"><h2>Verify your ARA sign-in</h2><p>Enter this one-time code to continue:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#f2f5fa;border-radius:12px;text-align:center">' + code + '</div><p>This code expires in 5 minutes and can only be used once.</p><p>If you did not request this code, ignore this email.</p></div>',
      });
      transporter.close();
    } catch (error: any) {
      await this.db.query('UPDATE auth_email_otps SET consumed_at=now() WHERE id=$1', [challengeId]);
      const diagnostic = {
        code: String(error?.code || 'UNKNOWN').slice(0, 40),
        command: String(error?.command || '').slice(0, 40),
        responseCode: Number(error?.responseCode) || undefined,
        response: String(error?.response || error?.message || '').replace(/\s+/g, ' ').slice(0, 240),
      };
      console.error('[ARA][SMTP] Gmail OTP delivery failed', diagnostic);
      const code = diagnostic.code;
      const hint = code === 'EAUTH' || diagnostic.responseCode === 535
        ? 'Gmail rejected SMTP authentication. Generate a fresh Google App Password and confirm SMTP_USER is the matching Gmail account.'
        : code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ESOCKET'
          ? 'ARA could not establish a Gmail SMTP connection. Check host, port and TLS settings.'
          : 'Check the Gmail SMTP sender, app password and authorised sender address.';
      throw new ServiceUnavailableException('We could not send the verification email. ' + hint);
    } finally {
      transporter.close();
    }

    return { requiresOtp: true, challengeId, email, expiresIn: 300, resendAfter: 60, message: 'A six-digit verification code has been sent to your email.' };
  }

  async resend(challengeIdValue: string, purpose: OtpPurpose) {
    const challengeId = String(challengeIdValue || '');
    if (!/^[0-9a-f-]{36}$/i.test(challengeId)) throw new UnauthorizedException('Verification request is invalid.');
    const row = await this.db.query(
      'SELECT email,principal_id AS "principalId" FROM auth_email_otps WHERE id=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at>now()',
      [challengeId, purpose],
    );
    if (!row.rowCount) throw new UnauthorizedException('This verification request has expired. Sign in again.');
    return this.issue(row.rows[0].email, row.rows[0].principalId, purpose);
  }

  async verify(challengeIdValue: string, codeValue: string, purpose: OtpPurpose) {
    const challengeId = String(challengeIdValue || '');
    const code = String(codeValue || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) throw new UnauthorizedException('Enter the six-digit verification code.');
    const outcome = await this.db.transaction(async client => {
      const result = await client.query(
        'SELECT id,email,purpose,principal_id AS "principalId",code_hash AS "codeHash",expires_at AS "expiresAt",attempts,consumed_at AS "consumedAt" FROM auth_email_otps WHERE id=$1 AND purpose=$2 FOR UPDATE',
        [challengeId, purpose],
      );
      const row = result.rows[0];
      if (!row || row.consumedAt || new Date(row.expiresAt).getTime() <= Date.now()) return { error: 'This verification code has expired. Request a new one.' };
      if (Number(row.attempts) >= 5) {
        await client.query('UPDATE auth_email_otps SET consumed_at=now() WHERE id=$1', [challengeId]);
        return { error: 'Too many incorrect attempts. Request a new code.' };
      }
      const actual = Buffer.from(this.digest(challengeId, code), 'hex');
      const expected = Buffer.from(row.codeHash, 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        await client.query('UPDATE auth_email_otps SET attempts=attempts+1, consumed_at=CASE WHEN attempts+1>=5 THEN now() ELSE consumed_at END WHERE id=$1', [challengeId]);
        return { error: 'Incorrect verification code.' };
      }
      await client.query('UPDATE auth_email_otps SET consumed_at=now() WHERE id=$1', [challengeId]);
      return { principalId: row.principalId, email: row.email };
    });
    if ('error' in outcome) throw new UnauthorizedException(outcome.error);
    return outcome;
  }
}
