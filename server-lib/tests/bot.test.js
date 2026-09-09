const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/bot');
const Company = require('../models/Company');
const Delivery = require('../models/TelegramDelivery');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { testDelivery } = require('../services/botConnection');
const original = { company: Company.findById, init: Delivery.init, update: Delivery.updateOne, claim: Delivery.findOneAndUpdate, find: Delivery.findOne, users: User.find, rows: Attendance.find, fetch: global.fetch };
const company = { _id: 'a'.repeat(24), name: 'Private company', telegramBotToken: '111:fake-token', telegramWebhookSecret: 'test-hook-secret', telegramBotUsername: 'hodim_test_bot', telegramChatId: '-1001' };
let jobs, sent;
beforeEach(() => {
  jobs = new Map(); sent = [];
  Company.findById = () => ({ select: async () => company });
  Delivery.init = async () => {};
  Delivery.updateOne = async ({key}, change) => {
    if (change.$setOnInsert && !jobs.has(key)) jobs.set(key, { ...change.$setOnInsert, chunks: [], save: async () => {} });
    const job = jobs.get(key);
    if (change.$set) Object.assign(job, change.$set);
    if (change.$unset) for (const k of Object.keys(change.$unset)) delete job[k];
  };
  Delivery.findOneAndUpdate = async ({key}, change) => {
    const job = jobs.get(key); if (job.status === 'sent' || job.leaseUntil > new Date()) return null;
    Object.assign(job,change.$set); return job;
  };
  Delivery.findOne = ({key}) => ({ select: async () => jobs.get(key) });
  global.fetch = async (_, options) => { sent.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ok:true,result:{message_id:7}}) }; };
});
afterEach(() => {
  Company.findById=original.company; Delivery.init=original.init; Delivery.updateOne=original.update; Delivery.findOneAndUpdate=original.claim; Delivery.findOne=original.find; User.find=original.users; Attendance.find=original.rows; global.fetch=original.fetch;
});
const handler=router.stack.find(s=>s.route).route.stack[0].handle;
function response(){return {sendStatus(n){this.code=n; return this;}};}
function request(text,id=9,chat=42){return {params:{id:company._id}, headers:{'x-telegram-bot-api-secret-token':'test-hook-secret'},body:{update_id:id,message:{text,chat:{id:chat,type:'private'},from:{is_bot:false}}}};}
test('webhook refuses invalid secret without sending messages',async()=>{
  const req=request('/start');req.headers['x-telegram-bot-api-secret-token']='bad';const res=response();await handler(req,res);assert.equal(res.code,401);assert.equal(sent.length,0);
});
test('start sends welcome and Chat ID, repeating the same update does not send twice',async()=>{
  const res=response();await handler(request('/start'),res);assert.equal(res.code,200);assert.match(sent[0].text,/Xush kelibsiz/);assert.match(sent[0].text,/42/);assert.ok(sent[0].reply_markup.keyboard);
  await handler(request('/start'),response());assert.equal(sent.length,1);
});
test('sinov replies while report from unauthorized chat does not read employee data',async()=>{
  User.find=()=>assert.fail('Private employee data accessed');
  await handler(request('sinov',1),response());assert.match(sent[0].text,/Bot ishlayapti/);
  await handler(request('/hisobot',2),response());assert.match(sent[1].text,/huquqi berilmagan/);assert.ok(!sent[1].text.includes('Private company'));
});
test('authorized group receives current daily statistics',async()=>{
  User.find=()=>({select:()=>({lean:async()=>[{_id:'user',fullName:'Ali',role:'employee'}]})});
  Attendance.find=()=>({select:()=>({lean:async()=>[]})});
  const res=response();await handler(request('/hisobot',3,-1001),res);assert.equal(res.code,200);assert.match(sent[0].text,/Jami xodimlar: 1/);assert.match(sent[0].text,/Qayd yo‘q: 1/);
});
test('commands addressed to another bot are ignored',()=>{
  assert.equal(router.command('/start@another_bot','hodim_test_bot'),'');
  assert.equal(router.command('/hisobot@hodim_test_bot','hodim_test_bot'),'hisobot');
});
test('bot cannot be configured as its own report destination',async()=>{
  global.fetch=async()=>({ok:true,json:async()=>({ok:true,result:{id:111,username:'hodim_test_bot'}})});
  await assert.rejects(testDelivery({...company,save:async()=>{}}),/botning o‘zi/);
});
