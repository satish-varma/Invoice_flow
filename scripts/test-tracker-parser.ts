import { extractStallAndLocation, isGarbageText } from '../src/lib/tracker/parser';
import assert from 'assert';

console.log('Testing Tracker Parser...');

// 1. Broadridge tests
{
  const res = extractStallAndLocation(
    'INV-933995_payment_advice_JuicytailesJuiceCounter_Broadridge_Financial_Solutions_India_Private_Limited_-20261012-20261014-4497.pdf'
  );
  assert.strictEqual(res.location, 'Broadridge');
  assert.strictEqual(res.stall, 'Juicytailes Juice Counter');
  assert.strictEqual(res.serviceDateRange, '2026-10-12 to 2026-10-14');
}

// 2. CGI Information Systems tests
{
  const res = extractStallAndLocation(
    'INV-934313_payment_advice_SipnByteDLF_CGI_Information_Systems___Management_Consultants_Pvt_Ltd-20261012-20261014-10333'
  );
  assert.strictEqual(res.location, 'CGI Information Systems');
  assert.strictEqual(res.stall, 'SipnByte DLF');
  assert.strictEqual(res.serviceDateRange, '2026-10-12 to 2026-10-14');
}

// 3. IBM tests
{
  const res = extractStallAndLocation(
    'INV-812942_payment_advice_LiveCounter_IBM-20260504-20260506-38305.pdf'
  );
  assert.strictEqual(res.location, 'IBM');
  assert.strictEqual(res.stall, 'Live Counter');
  assert.strictEqual(res.serviceDateRange, '2026-05-04 to 2026-05-06');
}

// 4. NTT Data tests
{
  const res = extractStallAndLocation(
    'INV-930315_payment_advice_TuckshopNTTDATA_NTT_Data-20261008-20261011-9515'
  );
  assert.strictEqual(res.location, 'NTT Data');
  assert.strictEqual(res.stall, 'Tuckshop NTT DATA');
}

// 5. Garbage detection
{
  assert.strictEqual(isGarbageText('SettlementId: 934313 Payment Advice'), true);
  assert.strictEqual(isGarbageText('Payment Advice raised by'), true);
  assert.strictEqual(isGarbageText('Unknown Stall'), true);
  assert.strictEqual(isGarbageText('Other'), true);
  assert.strictEqual(isGarbageText('Live Counter'), false);
  assert.strictEqual(isGarbageText('IBM'), false);
}

console.log('✅ All 5 tracker parser tests passed successfully!');
