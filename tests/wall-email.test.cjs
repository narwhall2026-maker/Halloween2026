const {test,afterEach} = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../web/api/wall-email');
const originalFetch = global.fetch;
const photoId = '09e1f198-15cb-465c-8902-2f7ac60d9d6e';
const origin = 'https://my-halloween2026.vercel.app';
async function request(body = {}, overrides = {}) {
  let result;
  const res = {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){result={code:this.code,body:v,headers:this.headers};return result}};
  await handler({method:'POST',headers:{origin,'content-type':'application/json'},body,...overrides},res);
  return result;
}
afterEach(()=>{global.fetch=originalFetch;delete process.env.WALL_EMAIL_ENABLED;delete process.env.RESEND_API_KEY;});
test('disabled email does not accept or transmit an address',async()=>{
  global.fetch=()=>{throw Error('must not call provider')};
  assert.deepEqual((await request({}, {method:'GET'})).body,{enabled:false});
  assert.equal((await request({email:'person@example.com',photoId})).code,503);
});
test('rejects cross-origin requests, malformed email, missing photo, and honeypot',async()=>{
  process.env.WALL_EMAIL_ENABLED='true';process.env.RESEND_API_KEY='test-not-a-real-key';
  global.fetch=()=>{throw Error('must not call provider')};
  assert.equal((await request({}, {headers:{origin:'https://another.example','content-type':'application/json'}})).code,403);
  assert.equal((await request({email:'invalid',photoId})).code,400);
  assert.equal((await request({email:['person@example.com'],photoId})).code,400);
  assert.equal((await request({email:'person@example.com'})).code,400);
  assert.equal((await request({email:'person@example.com',photoId,website:'bot'})).code,400);
});
test('does not send for old or nonexistent photos',async()=>{
  process.env.WALL_EMAIL_ENABLED='true';process.env.RESEND_API_KEY='test-not-a-real-key';
  let calls=0;
  global.fetch=async()=>{calls++;return Response.json([{public_id:photoId,created_at:'2020-01-01T00:00:00Z'}])};
  assert.equal((await request({email:'person@example.com',photoId})).code,400);
  assert.equal(calls,1);
});
test('sends fixed wall link and deduplicates normalized address without leaking email',async()=>{
  process.env.WALL_EMAIL_ENABLED='true';process.env.RESEND_API_KEY='test-not-a-real-key';
  const sends=[];
  global.fetch=async(url,options)=>{
    if(url.startsWith('https://vjugsidfdovuwtxgcvrz.supabase.co/'))return Response.json([{public_id:photoId,created_at:new Date().toISOString()}]);
    sends.push(options);return Response.json({id:'provider-message-id'});
  };
  const a=await request({email:' PERSON@example.com ',photoId});
  const b=await request({email:'person@example.com',photoId});
  assert.deepEqual(a.body,{ok:true});assert.equal(b.code,200);
  assert.equal(sends[0].headers['Idempotency-Key'],sends[1].headers['Idempotency-Key']);
  const payload=JSON.parse(sends[0].body);
  assert.deepEqual(payload.to,['person@example.com']);
  assert.equal(payload.from,'Narwhall <hello@mail.narwhall.app>');
  assert.ok(payload.text.includes(origin+'/'));
  assert.ok(payload.text.includes('does not subscribe you to marketing emails'));
  assert.ok(!JSON.stringify(a).includes('person@example.com'));
});
test('provider failure never reports success or returns provider secrets',async()=>{
  process.env.WALL_EMAIL_ENABLED='true';process.env.RESEND_API_KEY='test-not-a-real-key';
  global.fetch=async url=>url.includes('supabase.co')?Response.json([{public_id:photoId,created_at:new Date().toISOString()}]):Response.json({message:'private-provider-detail'},{status:403});
  const result=await request({email:'person@example.com',photoId});
  assert.equal(result.code,502);
  assert.ok(!JSON.stringify(result).includes('private-provider-detail'));
});
