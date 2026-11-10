import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '../config/config.service';

type DarajaToken = { access_token: string; expires_in: string };
@Injectable()
export class MpesaService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService) {}

  private setting(name: 'MPESA_CONSUMER_KEY'|'MPESA_CONSUMER_SECRET'|'MPESA_PASSKEY'|'MPESA_SHORT_CODE'|'MPESA_CALLBACK_URL'|'MPESA_ENV') {
    return this.config.get(name);
  }
  private baseUrl() {
    return this.setting('MPESA_ENV') === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  }
  private async token(): Promise<string> {
    const key=this.setting('MPESA_CONSUMER_KEY'), secret=this.setting('MPESA_CONSUMER_SECRET');
    if(!key||!secret) throw new ServiceUnavailableException('M-Pesa Daraja is not configured');
    const auth=Buffer.from(key+':'+secret).toString('base64');
    const response=await fetch(this.baseUrl()+'/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+auth}});
    if(!response.ok) throw new ServiceUnavailableException('M-Pesa authentication failed');
    const data=await response.json() as DarajaToken;
    if(!data.access_token) throw new ServiceUnavailableException('M-Pesa did not return an access token');
    return data.access_token;
  }
  private timestamp() {
    const d=new Date();
    return d.getFullYear().toString()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0');
  }
  private normalizePhone(input:string) {
    const digits=String(input||'').replace(/\D/g,'');
    const phone=digits.startsWith('0')?'254'+digits.slice(1):digits.startsWith('7')||digits.startsWith('1')?'254'+digits:digits;
    if(!/^254[17]\d{8}$/.test(phone)) throw new BadRequestException('Enter a valid Kenyan M-Pesa phone number, e.g. 07XXXXXXXX');
    return phone;
  }

  async initiate(user:{agencyId:string;role:string}, invoiceId:string, phoneInput:string) {
    if(!['owner','admin'].includes(user.role)) throw new BadRequestException('Only company owners and administrators can pay invoices');
    if(!/^[0-9a-f-]{36}$/i.test(invoiceId)) throw new BadRequestException('Invalid invoice ID');
    const phone=this.normalizePhone(phoneInput);
    const callback=this.setting('MPESA_CALLBACK_URL'), shortcode=this.setting('MPESA_SHORT_CODE'), passkey=this.setting('MPESA_PASSKEY');
    if(!callback||!shortcode||!passkey) throw new ServiceUnavailableException('M-Pesa callback URL, shortcode and passkey must be configured');
    let invoiceResult=await this.db.query<any>(`SELECT i.id,i.agency_id,i.invoice_number,i.status,i.currency,i.total_minor
      FROM billing_invoices i WHERE i.id=$1 AND i.agency_id=$2`,[invoiceId,user.agencyId]);
    if(!invoiceResult.rowCount) throw new NotFoundException('Invoice not found');
    const invoice=invoiceResult.rows[0];
    if(invoice.status==='paid') throw new BadRequestException('This invoice has already been paid');
    if(invoice.status!=='open'||invoice.currency!=='KES') throw new BadRequestException('Only open KES invoices can be paid using M-Pesa');
    const amount=BigInt(invoice.total_minor);
    if(amount<=0n||amount%100n!==0n) throw new BadRequestException('M-Pesa STK Push requires an invoice total in whole KES');
    const existing=await this.db.query<any>(`SELECT id FROM billing_payments WHERE agency_id=$1 AND invoice_id=$2 AND provider='mpesa' AND status='pending' AND created_at>now()-interval '10 minutes' LIMIT 1`,[user.agencyId,invoiceId]);
    if(existing.rowCount) throw new BadRequestException('An M-Pesa payment request is already pending for this invoice. Wait for its result before retrying.');
    const accessToken=await this.token();
    const timestamp=this.timestamp();
    const password=Buffer.from(String(shortcode)+String(passkey)+timestamp).toString('base64');
    const body={BusinessShortCode:shortcode,Password:password,Timestamp:timestamp,TransactionType:'CustomerPayBillOnline',Amount:Number(amount/100n),PartyA:phone,PartyB:shortcode,PhoneNumber:phone,CallBackURL:callback,AccountReference:String(invoice.invoice_number).slice(0,12),TransactionDesc:'ARA subscription'};
    const response=await fetch(this.baseUrl()+'/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json().catch(()=>({})) as any;
    if(!response.ok||String(result.ResponseCode)!=='0'||!result.CheckoutRequestID||!result.MerchantRequestID) throw new ServiceUnavailableException('M-Pesa could not start the payment request');
    await this.db.query(`INSERT INTO billing_payments(agency_id,invoice_id,provider,provider_payment_ref,status,amount_minor,currency,provider_payload,mpesa_checkout_request_id,mpesa_merchant_request_id,mpesa_phone)
      VALUES($1,$2,'mpesa',NULL,'pending',$3,'KES',$4,$5,$6,$7)`,
      [user.agencyId,invoiceId,amount.toString(),JSON.stringify({customerMessage:result.CustomerMessage||null}),result.CheckoutRequestID,result.MerchantRequestID,phone]);
    return {status:'pending',message:result.CustomerMessage||'Check your phone and enter your M-Pesa PIN to complete payment.',checkoutRequestId:result.CheckoutRequestID};
  }

  async callback(payload:any) {
    const stk=payload?.Body?.stkCallback;
    const checkoutId=String(stk?.CheckoutRequestID||'');
    const merchantId=String(stk?.MerchantRequestID||'');
    if(!checkoutId||!merchantId) return {ResultCode:0,ResultDesc:'Ignored: missing checkout reference'};
    const code=Number(stk?.ResultCode);
    const metadata=Array.isArray(stk?.CallbackMetadata?.Item)?stk.CallbackMetadata.Item:[];
    const value=(name:string)=>metadata.find((item:any)=>item.Name===name)?.Value;
    const receipt=String(value('MpesaReceiptNumber')||'');
    const paidAmount=Number(value('Amount'));
    const phone=String(value('PhoneNumber')||'');
    return this.db.transaction(async client=>{
      const payment=await client.query<any>(`SELECT id,agency_id,invoice_id,status,amount_minor,mpesa_phone,mpesa_merchant_request_id
        FROM billing_payments WHERE provider='mpesa' AND mpesa_checkout_request_id=$1 FOR UPDATE`,[checkoutId]);
      if(!payment.rowCount) return {ResultCode:0,ResultDesc:'Accepted'};
      const p=payment.rows[0];
      if(p.mpesa_merchant_request_id!==merchantId) return {ResultCode:0,ResultDesc:'Accepted'};
      if(p.status!=='pending') return {ResultCode:0,ResultDesc:'Duplicate callback accepted'};
      if(code!==0) {
        await client.query(`UPDATE billing_payments SET status='failed',provider_payload=$2,updated_at=now() WHERE id=$1`,[p.id,JSON.stringify({resultCode:code,resultDescription:stk?.ResultDesc||'Payment failed'})]);
        return {ResultCode:0,ResultDesc:'Accepted'};
      }
      const invoice=await client.query<any>('SELECT id,agency_id,total_minor,currency,subscription_id FROM billing_invoices WHERE id=$1 AND agency_id=$2 FOR UPDATE',[p.invoice_id,p.agency_id]);
      if(!invoice.rowCount||invoice.rows[0].currency!=='KES'||BigInt(p.amount_minor)!==BigInt(invoice.rows[0].total_minor)||paidAmount*100!==Number(p.amount_minor)||phone!==p.mpesa_phone||!receipt) {
        await client.query(`UPDATE billing_payments SET status='failed',provider_payload=$2,updated_at=now() WHERE id=$1`,[p.id,JSON.stringify({resultCode:code,validation:'callback_mismatch'})]);
        return {ResultCode:0,ResultDesc:'Accepted'};
      }
      await client.query(`UPDATE billing_payments SET status='succeeded',provider_payment_ref=$2,provider_payload=$3,updated_at=now() WHERE id=$1`,[p.id,receipt,JSON.stringify({receipt,amount:paidAmount,phone,checkoutId})]);
      await client.query(`UPDATE billing_invoices SET status='paid',paid_at=COALESCE(paid_at,now()) WHERE id=$1 AND agency_id=$2`,[p.invoice_id,p.agency_id]);
      if(invoice.rows[0].subscription_id) await client.query(`UPDATE company_subscriptions SET status='active',updated_at=now() WHERE id=$1 AND agency_id=$2 AND status IN ('past_due','suspended')`,[invoice.rows[0].subscription_id,p.agency_id]);
      return {ResultCode:0,ResultDesc:'Accepted'};
    });
  }
}
