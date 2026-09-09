const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/attendance');
const Company = require('../models/Company');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { localClock } = require('../services/telegram');
const { bounds } = require('../services/dailyStats');
const saved = { company: Company.findById, lock: User.findOneAndUpdate, update: User.updateOne, count: Attendance.countDocuments, save: Attendance.prototype.save };
afterEach(() => { Company.findById=saved.company; User.findOneAndUpdate=saved.lock; User.updateOne=saved.update; Attendance.countDocuments=saved.count; Attendance.prototype.save=saved.save; });
const handler = router.stack.find(s=>s.route?.path==='/mark').route.stack.at(-1).handle;
const req = { user: { id:'a'.repeat(24), companyId:'b'.repeat(24) }, body:{qrData:'office-qr'} };
function response(){return {code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
test('second accepted scan is ketdi and count query uses Tashkent day',async()=>{
  Company.findById=async()=>({qrCodeData:'office-qr',faceIdEnabled:false});
  User.findOneAndUpdate=async()=>({}); User.updateOne=async()=>{};
  let query, record;
  Attendance.countDocuments=async q=>{query=q;return 1;};
  Attendance.prototype.save=async function(){record=this;};
  const res=response();await handler(req,res);
  assert.equal(res.code,201);assert.equal(record.type,'ketdi');assert.equal(res.body.count,2);assert.equal(res.body.status,'departed');
  assert.equal(query.timestamp.$gte.toISOString(),bounds(localClock().day).start.toISOString());
  assert.equal(query.timestamp.$lt.toISOString(),bounds(localClock().day).end.toISOString());
});
test('overlapping or rapid duplicate scans cannot create another attendance record',async()=>{
  Company.findById=async()=>({qrCodeData:'office-qr'}); User.findOneAndUpdate=async()=>null;
  Attendance.countDocuments=async()=>assert.fail('must not count without lock');
  Attendance.prototype.save=async()=>assert.fail('must not save without lock');
  const res=response();await handler(req,res);assert.equal(res.code,409);
});
