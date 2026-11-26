// SERVEO Backend Automated API Test Suite
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Keep test data isolated from both PostgreSQL and the persistent local store.
process.env.SERVEO_TEST_MODE = 'true';
process.env.DEV_OTP_ALLOW = 'true';
process.env.NODE_ENV = 'development';
process.env.SERVEO_DATA_MODE = 'private';
process.env.PORT = '3001';

const db = require('./db');
const testDbFile = path.join(os.tmpdir(), `serveo-test-${process.pid}-${Date.now()}.json`);
db.fallbackFile = testDbFile;

async function runTests() {
  console.log('🧪 Starting SERVEO Backend Test Suite...\n');

  // 1. Initialize DB
  await db.initialize();
  console.log(`✅ DB Initialized in ${db.mode} mode.`);

  // 2. Test Get Approved Events
  const approvedEvents = await db.getEvents({ status: 'approved' });
  assert(Array.isArray(approvedEvents), 'Approved events should be an array');
  assert(approvedEvents.length >= 18, `Should have at least 18 seeded events, got ${approvedEvents.length}`);
  console.log(`✅ getEvents({ status: 'approved' }): returned ${approvedEvents.length} events.`);

  // 3. Test Get Single Event
  const single = await db.getEventById('1');
  assert(single !== null, 'Event 1 should exist');
  assert.strictEqual(single.category, 'blood', 'Event 1 should be a blood drive');
  console.log(`✅ getEventById('1'): correctly returned "${single.title}".`);

  // 4. Test Event Contact
  const contact = await db.getContact('1');
  assert(contact !== null, 'Contact for Event 1 should exist');
  assert(contact.contact.includes('2371'), 'Contact number should match seed data');
  console.log(`✅ getContact('1'): correctly returned contact "${contact.contact}".`);

  // 5. Test Create Event
  const newEventData = {
    title: 'Automated Test Blood Drive',
    category: 'blood',
    organizer: 'Red Cross Test Wing',
    city: 'Ghaziabad',
    address: 'ABESIT Campus, Ghaziabad',
    lat: 28.6327,
    lng: 77.4475,
    date: '2026-08-30',
    startTime: '10:00',
    endTime: '15:00',
    volunteersNeeded: 100,
    volunteersJoined: 0,
    urgency: 'upcoming',
    description: 'Test blood drive at college campus.',
    status: 'approved'
  };
  const newContactData = {
    orgType: 'Student Body',
    contact: '+91 98765 43210',
    email: 'test@abesit.in'
  };
  const created = await db.createEvent(newEventData, newContactData);
  assert(created && created.id, 'Created event should have an id');
  console.log(`✅ createEvent: created event with ID ${created.id}.`);

  // 6. Test Volunteer Join
  const countBefore = created.volunteersJoined;
  const countAfter = await db.joinEvent(created.id);
  assert.strictEqual(countAfter, countBefore + 1, 'Volunteer count should increase by 1');
  console.log(`✅ joinEvent: volunteers joined count updated from ${countBefore} to ${countAfter}.`);

  // 7. Test Auth & User Creation
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash('Secret123!', 10);
  const testUser = await db.createUser({
    name: 'Nishant Swami',
    username: 'nishant_' + Date.now(),
    email: `nishant_${Date.now()}@example.com`,
    phone: '+91987654' + Math.floor(1000 + Math.random() * 9000),
    passwordHash
  });
  assert(testUser && testUser.id, 'User should be created');
  console.log(`✅ createUser: created user ${testUser.name} (${testUser.username}).`);

  // 8. Test Find User by email, username, and phone
  const byEmail = await db.findUserByIdentifier(testUser.email);
  const byUsername = await db.findUserByIdentifier(testUser.username);
  const byPhone = await db.findUserByIdentifier(testUser.phone);
  assert(byEmail && byEmail.id === testUser.id, 'Should find user by email');
  assert(byUsername && byUsername.id === testUser.id, 'Should find user by username');
  assert(byPhone && byPhone.id === testUser.id, 'Should find user by Indian phone');
  console.log(`✅ findUserByIdentifier: successfully found user by email, username, and phone.`);

  // 9. Test False Alarm Governance Rule (2 distinct false alarm reviews ban organizer)
  const orgUser = await db.createUser({
    name: 'Shady Organizer',
    username: 'shady_' + Date.now(),
    email: `shady_${Date.now()}@example.com`,
    phone: '+9199999' + Math.floor(10000 + Math.random() * 90000),
    passwordHash
  });
  const orgEvent = await db.createEvent({
    title: 'Fake Event for Test',
    category: 'disaster',
    organizer: 'Shady Organizer',
    city: 'Delhi',
    address: 'Nowhere',
    lat: 28.6,
    lng: 77.2,
    date: '2026-08-30',
    startTime: '10:00',
    endTime: '12:00',
    volunteersNeeded: 10,
    status: 'approved'
  }, null, orgUser.id);

  // Reviewer 1 reports false alarm
  await db.createReview({
    eventId: orgEvent.id,
    userId: testUser.id,
    rating: 1,
    outcome: 'false_alarm',
    comment: 'Nothing was there!'
  });

  // Reviewer 2 reports false alarm
  const testUser2 = await db.createUser({
    name: 'Piyush Chaudhary',
    username: 'piyush_' + Date.now(),
    email: `piyush_${Date.now()}@example.com`,
    phone: '+91987655' + Math.floor(1000 + Math.random() * 9000),
    passwordHash
  });
  await db.createReview({
    eventId: orgEvent.id,
    userId: testUser2.id,
    rating: 1,
    outcome: 'false_alarm',
    comment: 'Event never happened!'
  });

  const refreshedOrg = await db.findUserById(orgUser.id);
  assert(refreshedOrg.organizationBanned === true, 'Organizer should be banned after 2 distinct false-alarm reviews');
  console.log(`✅ False-Alarm Governance: organizer banned automatically after 2 distinct false-alarm reports.`);

  // Phase 1 trust/safety endpoint coverage (HTTP, including auth and validation).
  const { app } = require('./server');
  const { generateToken } = require('./auth');
  const apiServer = app.listen(0, '127.0.0.1');
  await new Promise(resolve => apiServer.once('listening', resolve));
  const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
  const tokenFor = user => generateToken(user);
  const adminUser = await db.createUser({ name: 'Test Admin', username: `admin_${Date.now()}`, email: `admin_${Date.now()}@example.com`, phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`, passwordHash });
  adminUser.isAdmin = true;
  db.saveFallback();
  const adminToken = tokenFor(adminUser);
  const userToken = tokenFor(testUser);
  const ownerToken = tokenFor(orgUser);
  const request = (url, { token, ...options } = {}) => fetch(`${apiBase}${url}`, {
    ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const body = value => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  let phaseResponse;

  // Phase 4: private organizer-marked attendance and verified hours records.
  const istDay=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  const hoursEvent=await db.createEvent({title:'Volunteer Hours Test',category:'disaster',organizer:'Test Admin',city:'Delhi',address:'Test field',lat:28.6,lng:77.2,date:istDay,startTime:'09:00',endTime:'18:00',volunteersNeeded:5,status:'approved'},null,adminUser.id);
  const registration=await db.createVolunteerApplication({eventId:hoursEvent.id,userId:testUser.id,applicantName:testUser.name,applicantPhone:testUser.phone,applicantEmail:testUser.email,trackingConsent:false});
  phaseResponse=await request(`/api/events/${hoursEvent.id}/attendance`);
  assert.strictEqual(phaseResponse.status,401,'attendance list requires authentication');
  phaseResponse=await request(`/api/events/${hoursEvent.id}/attendance`,{token:userToken});
  assert.strictEqual(phaseResponse.status,403,'only organizer or admin can view attendance');
  phaseResponse=await request(`/api/events/${hoursEvent.id}/attendance`,{token:adminToken});
  assert.strictEqual(phaseResponse.status,200,'admin can list registered volunteers');
  const checkIn=new Date(Date.now()-90*60*1000).toISOString(),checkOut=new Date(Date.now()-30*60*1000).toISOString();
  phaseResponse=await request(`/api/events/${hoursEvent.id}/attendance/${registration.id}/check-in`,{method:'POST',token:adminToken,...body({checkedInAt:new Date(Date.now()+3600000).toISOString()})});
  assert.strictEqual(phaseResponse.status,400,'attendance rejects future check-in');
  phaseResponse=await request(`/api/events/${hoursEvent.id}/attendance/${registration.id}/check-in`,{method:'POST',token:adminToken,...body({checkedInAt:checkIn})});
  assert.strictEqual(phaseResponse.status,201,'organizer can check in registered volunteer');
  phaseResponse=await request(`/api/events/${hoursEvent.id}/attendance/${registration.id}/check-out`,{method:'POST',token:adminToken,...body({checkedOutAt:checkOut})});
  assert.strictEqual(phaseResponse.status,200,'organizer can check out registered volunteer');
  assert(Number((await phaseResponse.json()).hours)>0,'server computes attendance hours');
  phaseResponse=await request('/api/volunteers/hours/mine',{token:userToken});
  assert.strictEqual(phaseResponse.status,200,'volunteer can view own verified hours');
  phaseResponse=await request('/api/volunteer-hours/certificate.pdf',{token:userToken});
  assert.strictEqual(phaseResponse.status,200,'volunteer can download verified PDF record');

  phaseResponse = await request('/api/impact?city=Delhi');
  assert.strictEqual(phaseResponse.status, 200, 'public impact API applies city filters');
  const impactStats = await phaseResponse.json();
  assert(Object.hasOwn(impactStats, 'mealsDelivered') && Object.hasOwn(impactStats, 'volunteerHours'), 'impact response contains stored metrics');
  phaseResponse=await request('/api/impact/trends?city=Delhi');
  assert.strictEqual(phaseResponse.status,200,'impact charts return city-filtered monthly data');
  assert(Array.isArray((await phaseResponse.json()).months),'impact trends include monthly buckets');
  phaseResponse=await request('/api/impact/trends?to=bad-date');
  assert.strictEqual(phaseResponse.status,400,'impact trends reject invalid date filters');
  phaseResponse = await request('/api/impact?from=not-a-date');
  assert.strictEqual(phaseResponse.status, 400, 'impact API rejects invalid date filters');
  phaseResponse = await request('/api/volunteers/hours/mine');
  assert.strictEqual(phaseResponse.status, 401, 'volunteer hours requires authentication');
  phaseResponse = await request('/api/volunteer-hours/certificate.pdf', { token: userToken });
  assert.strictEqual(phaseResponse.status, 200, 'volunteer can download own verified PDF record');

  phaseResponse = await request('/api/disaster-mode');
  assert.strictEqual(phaseResponse.status, 200, 'active disaster mode is publicly readable');
  phaseResponse = await request('/api/admin/disaster-mode', { method: 'POST', ...body({ active: true, reason: 'Storm response', region: 'Delhi', endsAt: new Date(Date.now()+3600000).toISOString() }) });
  assert.strictEqual(phaseResponse.status, 401, 'disaster mode toggle requires authentication');
  phaseResponse = await request('/api/admin/disaster-mode', { method: 'POST', token: userToken, ...body({ active: true, reason: 'Storm response', region: 'Delhi', endsAt: new Date(Date.now()+3600000).toISOString() }) });
  assert.strictEqual(phaseResponse.status, 403, 'only admins can toggle disaster mode');
  phaseResponse = await request('/api/admin/disaster-mode', { method: 'POST', token: adminToken, ...body({ active: true, reason: '', region: 'Delhi', endsAt: new Date(Date.now()+3600000).toISOString() }) });
  assert.strictEqual(phaseResponse.status, 400, 'disaster mode validates reason');
  phaseResponse = await request('/api/admin/disaster-mode', { method: 'POST', token: adminToken, ...body({ active: true, reason: 'Storm response', region: 'Delhi', endsAt: new Date(Date.now()+3600000).toISOString() }) });
  assert.strictEqual(phaseResponse.status, 200, 'admin can enable disaster mode');
  assert.strictEqual((await phaseResponse.json()).active, true);
  phaseResponse = await request('/api/admin/impact-heatmap', { token: userToken });
  assert.strictEqual(phaseResponse.status, 403, 'impact heatmap is admin only');
  phaseResponse = await request('/api/admin/impact-heatmap', { token: adminToken });
  assert.strictEqual(phaseResponse.status, 200, 'admin can view demand heatmap data');
  phaseResponse = await request('/api/admin/disaster-mode', { method: 'POST', token: adminToken, ...body({ active: false, reason: 'Response complete', region: 'Delhi' }) });
  assert.strictEqual(phaseResponse.status, 200, 'admin can disable disaster mode');

  // Phase 5: compatible, eligibility-aware blood matching and consent-gated contact.
  await db.updateDonorProfile(testUser.id,'O+',28.6,77.2,'Delhi');
  phaseResponse=await request('/api/urgent-blood-requests',{method:'POST',...body({patientName:'Test Patient',bloodGroup:'AB+',units:1,hospital:'Test Hospital',address:'Test Road',city:'Delhi',lat:28.6,lng:77.2,contactPhone:'+919876543210'})});
  assert.strictEqual(phaseResponse.status,401,'urgent blood request creation requires authentication');
  phaseResponse=await request('/api/urgent-blood-requests',{method:'POST',token:adminToken,...body({patientName:'Test Patient',bloodGroup:'XX',units:1,hospital:'Test Hospital',address:'Test Road',city:'Delhi',lat:28.6,lng:77.2,contactPhone:'+919876543210'})});
  assert.strictEqual(phaseResponse.status,400,'urgent blood request validates blood group');
  phaseResponse=await request('/api/urgent-blood-requests',{method:'POST',token:adminToken,...body({patientName:'Test Patient',bloodGroup:'AB+',units:1,hospital:'Test Hospital',address:'Test Road',city:'Delhi',lat:28.6,lng:77.2,contactPhone:'+919876543210'})});
  assert.strictEqual(phaseResponse.status,201,'valid urgent blood request is stored');
  const matchedRequest=(await phaseResponse.json()).request;
  assert(matchedRequest.notifiedDonors>=1,'first matching wave notifies nearby compatible donors');
  phaseResponse=await request('/api/notifications',{token:userToken});
  const donorNotice=(await phaseResponse.json()).find(item=>item.urgentRequestId===matchedRequest.id);
  assert(donorNotice&&/compatible/i.test(donorNotice.title),'compatible blood group is clearly marked to donor');
  assert(!donorNotice.message.includes(testUser.phone),'donor contact is not exposed before donor acceptance');
  phaseResponse=await request(`/api/urgent-blood-requests/${matchedRequest.id}/interested`,{method:'POST',token:userToken});
  assert.strictEqual(phaseResponse.status,200,'eligible donor can accept a matching request');
  phaseResponse=await request('/api/notifications',{token:adminToken});
  const acceptedNotice=(await phaseResponse.json()).find(item=>item.urgentRequestId===matchedRequest.id);
  assert(acceptedNotice?.message.includes(testUser.phone),'requester receives donor contact only after acceptance');

  let response = await request('/api/organizer/verification-status');
  assert.strictEqual(response.status, 401, 'verification status requires authentication');
  response = await request('/api/organizer/verification-status', { token: ownerToken });
  assert.strictEqual(response.status, 200, 'organizer can view own verification status');
  assert.strictEqual((await response.json()).status, 'unverified');

  response = await request('/api/organizer/verification-document', { method: 'POST', ...body({}) });
  assert.strictEqual(response.status, 401, 'document upload requires authentication');
  response = await request('/api/organizer/verification-document', { method: 'POST', token: ownerToken, ...body({ fileName: 'bad.exe', data: 'data:application/octet-stream;base64,YQ==' }) });
  assert.strictEqual(response.status, 400, 'document upload rejects invalid file type');
  const pdfData = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n').toString('base64')}`;
  response = await request('/api/organizer/verification-document', { method: 'POST', token: ownerToken, ...body({ fileName: 'authorization.pdf', data: pdfData }) });
  assert.strictEqual(response.status, 201, 'valid organizer document accepted');
  const verificationDoc = (await db.listVerificationQueue())[0];
  assert(verificationDoc?.id, 'uploaded document appears in admin queue');
  response = await request('/api/admin/organizer-verifications');
  assert.strictEqual(response.status, 401, 'admin verification queue requires authentication');
  response = await request('/api/admin/organizer-verifications', { token: userToken });
  assert.strictEqual(response.status, 403, 'non-admin cannot view verification queue');
  response = await request(`/api/admin/organizer-verifications/${verificationDoc.id}/document`, { token: userToken });
  assert.strictEqual(response.status, 403, 'non-admin cannot read verification documents');
  response = await request(`/api/admin/organizer-verifications/${verificationDoc.id}/document`, { token: adminToken });
  assert.strictEqual(response.status, 200, 'admin can inspect private verification document');
  response = await request(`/api/admin/organizer-verifications/${verificationDoc.id}`, { method: 'PATCH', token: adminToken, ...body({ decision: 'bad-value' }) });
  assert.strictEqual(response.status, 400, 'verification review validates decision');
  response = await request(`/api/admin/organizer-verifications/${verificationDoc.id}`, { method: 'PATCH', token: adminToken, ...body({ decision: 'approved' }) });
  assert.strictEqual(response.status, 200, 'admin can approve verification document');
  assert.strictEqual((await db.getVerificationStatus(orgUser.id)).status, 'approved', 'approval updates organizer verification status');

  const hospitalUser = await db.createUser({ name: 'Test City Hospital', username: `hospital_${Date.now()}`, email: `hospital_${Date.now()}@example.com`, phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`, passwordHash });
  const hospitalToken = tokenFor(hospitalUser);
  response = await request('/api/organizer/verification-document', { method: 'POST', token: hospitalToken, ...body({ fileName: 'hospital.pdf', data: pdfData, organizationType: 'hospital' }) });
  assert.strictEqual(response.status, 201, 'hospital can submit verification document');
  const hospitalDoc = (await db.listVerificationQueue()).find(item => item.userId === hospitalUser.id);
  response = await request(`/api/admin/organizer-verifications/${hospitalDoc.id}`, { method: 'PATCH', token: adminToken, ...body({ decision: 'approved' }) });
  assert.strictEqual(response.status, 200, 'admin can approve hospital verification');
  const uploadedDocumentIds = [verificationDoc.id, hospitalDoc.id];

  response = await request('/api/donors/eligibility-date');
  assert.strictEqual(response.status, 401, 'eligibility date requires authentication');
  response = await request('/api/donors/eligibility-date', { method: 'PUT', token: userToken, ...body({ lastDonationDate: 'not-a-date', cooldownDays: 90 }) });
  assert.strictEqual(response.status, 400, 'eligibility date validates date input');
  response = await request('/api/donors/eligibility-date', { method: 'PUT', token: userToken, ...body({ lastDonationDate: null, cooldownDays: null }) });
  assert.strictEqual(response.status, 200, 'donor can save optional eligibility date');
  response = await request('/api/donors/donations', { method: 'POST', ...body({ donationDate: '2026-01-01', cooldownDays: 90 }) });
  assert.strictEqual(response.status, 401, 'donation record requires authentication');
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0,10);
  response = await request('/api/donors/donations', { method: 'POST', token: userToken, ...body({ donationDate: '2099-01-01', cooldownDays: 90 }) });
  assert.strictEqual(response.status, 400, 'donation record rejects future date');
  const donatedOn = new Date(Date.now() - 100 * 86400000).toISOString().slice(0,10);
  response = await request('/api/donors/donations', { method: 'POST', token: userToken, ...body({ donationDate: donatedOn, cooldownDays: 90 }) });
  assert.strictEqual(response.status, 201, 'donor can record donation');
  const donationId = (await response.json()).donation.id;
  response = await request('/api/donors/donations/mine');
  assert.strictEqual(response.status, 401, 'private donation history requires authentication');
  response = await request('/api/donors/donations/mine', { token: userToken });
  assert.strictEqual(response.status, 200, 'donor can view own donation history');
  response = await request(`/api/donors/donations/${donationId}/confirm`, { method: 'POST', token: userToken });
  assert.strictEqual(response.status, 403, 'unverified donor cannot confirm a donation');
  response = await request(`/api/donors/donations/${donationId}/confirm`, { method: 'POST', token: hospitalToken });
  assert.strictEqual(response.status, 200, 'verified hospital can confirm a donation');
  response = await request(`/api/donor-certificates/${donationId}.pdf`);
  assert.strictEqual(response.status, 401, 'certificate download requires donor authentication');
  response = await request(`/api/donor-certificates/${donationId}.pdf`, { token: userToken });
  assert.strictEqual(response.status, 200, 'donor can download confirmed donation certificate');
  assert(response.headers.get('content-type').includes('application/pdf'), 'certificate response is a PDF');
  const certificateId = db.fallbackData.donation_certificates.at(-1).id;
  response = await request(`/api/certificates/${certificateId}/verify`);
  const certificateVerification = await response.json();
  assert.strictEqual(response.status, 200, 'certificate has public verification endpoint');
  assert.deepStrictEqual(Object.keys(certificateVerification).sort(), ['donationDate','name','valid'], 'public verification returns only validity, name, and date');
  response = await request(`/api/certificates/${certificateId}/verify`);
  assert.strictEqual((await response.json()).valid, true, 'issued certificate verifies');
  response = await request('/api/certificates/not-a-cert/verify');
  assert.strictEqual(response.status, 400, 'certificate verification validates ID');

  response = await request('/api/donors/leaderboard');
  assert.strictEqual(response.status, 200, 'leaderboard is public');
  assert((await response.json()).some(row => row.name === testUser.name && row.donations === 1), 'leaderboard counts confirmed donations');
  response = await request('/api/donors/leaderboard', { method: 'PATCH', ...body({ optOut: true }) });
  assert.strictEqual(response.status, 401, 'leaderboard privacy setting requires authentication');
  response = await request('/api/donors/leaderboard', { method: 'PATCH', token: userToken, ...body({ optOut: 'yes' }) });
  assert.strictEqual(response.status, 400, 'leaderboard privacy setting validates boolean');
  response = await request('/api/donors/leaderboard', { method: 'PATCH', token: userToken, ...body({ optOut: true }) });
  assert.strictEqual(response.status, 200, 'donor can opt out of leaderboard');
  assert(!(await db.getDonorLeaderboard()).some(row => row.name === testUser.name), 'opted-out donor is hidden');
  response = await request('/api/donors/leaderboard', { method: 'PATCH', token: userToken, ...body({ optOut: false }) });
  assert.strictEqual(response.status, 200);

  response = await request('/api/blood-bank-stock?lat=bad');
  assert.strictEqual(response.status, 400, 'stock board validates proximity filter');
  response = await request('/api/blood-bank-stock');
  assert.strictEqual(response.status, 200, 'stock board is publicly readable');
  response = await request('/api/blood-bank-stock', { method: 'POST', ...body({}) });
  assert.strictEqual(response.status, 401, 'stock posting requires authentication');
  response = await request('/api/blood-bank-stock', { method: 'POST', token: userToken, ...body({}) });
  assert.strictEqual(response.status, 403, 'unverified organization cannot post stock');
  response = await request('/api/blood-bank-stock', { method: 'POST', token: hospitalToken, ...body({ city: 'Delhi', address: 'Hospital Road', lat: 28.6, lng: 77.2, bloodGroup: 'ZZ', needLevel: 'critical' }) });
  assert.strictEqual(response.status, 400, 'stock post validates blood group');
  response = await request('/api/blood-bank-stock', { method: 'POST', token: hospitalToken, ...body({ city: 'Delhi', address: 'Hospital Road', lat: 28.6, lng: 77.2, bloodGroup: 'O-', needLevel: 'critical' }) });
  assert.strictEqual(response.status, 201, 'verified hospital can post blood stock need');
  assert((await db.listBloodStock({ city: 'Delhi' })).some(item => item.bloodGroup === 'O-'), 'stock board returns verified, recent entries');

  const dueDate = new Date(Date.now() - 100 * 86400000).toISOString().slice(0,10);
  await db.saveDonorEligibility(testUser.id, dueDate, 90);
  assert.strictEqual(await db.sendDueDonationReminders(), 1, 'cooldown sends one due reminder');
  assert.strictEqual(await db.sendDueDonationReminders(), 0, 'cooldown reminder does not duplicate');
  assert((await db.getUserNotifications(testUser.id)).some(item => item.title === 'You can donate blood again'), 'cooldown reminder uses notification store');

  async function createVerifiedOrganization(name, type, latitude = 28.6, longitude = 77.2) {
    const suffix = `${Date.now()}_${Math.floor(Math.random()*10000)}`;
    const user = await db.createUser({ name, username: `${type}_${suffix}`, email: `${type}_${suffix}@example.com`, phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`, passwordHash, notificationLat: latitude, notificationLng: longitude });
    const token = tokenFor(user);
    const uploadResponse = await request('/api/organizer/verification-document', { method: 'POST', token, ...body({ fileName: `${type}.pdf`, data: pdfData, organizationType: type }) });
    assert.strictEqual(uploadResponse.status, 201, `${type} can submit verification document`);
    const document = (await db.listVerificationQueue()).find(item => item.userId === user.id);
    uploadedDocumentIds.push(document.id);
    const approvalResponse = await request(`/api/admin/organizer-verifications/${document.id}`, { method: 'PATCH', token: adminToken, ...body({ decision: 'approved' }) });
    assert.strictEqual(approvalResponse.status, 200, `admin can approve ${type}`);
    return { user, token };
  }
  const restaurant = await createVerifiedOrganization('Test Verified Restaurant', 'restaurant');
  const recipientOne = await createVerifiedOrganization('Test Local NGO', 'ngo', 28.61, 77.21);
  const recipientTwo = await createVerifiedOrganization('Test Local Orphanage', 'orphanage', 28.62, 77.22);

  response = await request('/api/food-posts?lat=bad');
  assert.strictEqual(response.status, 400, 'food pickup list validates filters');
  response = await request('/api/food-posts');
  assert.strictEqual(response.status, 200, 'food pickup list is public');
  response = await request('/api/food-posts', { method: 'POST', ...body({}) });
  assert.strictEqual(response.status, 401, 'food surplus posting requires authentication');
  const nowMs = Date.now();
  const cookedAt = new Date(nowMs - 30 * 60 * 1000).toISOString();
  const pickupBy = new Date(nowMs + 2 * 60 * 60 * 1000).toISOString();
  const foodPayload = { itemDescription: 'Fresh vegetable rice trays', approximateMeals: 35, cookedAt, pickupBy, address: '12 Market Road', city: 'Delhi', lat: 28.6, lng: 77.2, contact: '+91 98765 43210' };
  response = await request('/api/food-posts', { method: 'POST', token: userToken, ...body(foodPayload) });
  assert.strictEqual(response.status, 403, 'unverified user cannot post food surplus');
  response = await request('/api/food-posts', { method: 'POST', token: restaurant.token, ...body({ ...foodPayload, pickupBy: new Date(nowMs + 7 * 60 * 60 * 1000).toISOString() }) });
  assert.strictEqual(response.status, 400, 'food pickup must be within six hours and food safety window');
  response = await request('/api/food-posts', { method: 'POST', token: restaurant.token, ...body(foodPayload) });
  assert.strictEqual(response.status, 201, 'verified restaurant can post surplus food');
  const foodPostId = (await response.json()).post.id;
  response = await request('/api/food-posts');
  const publicFoodRows = await response.json();
  assert(!JSON.stringify(publicFoodRows).includes(foodPayload.contact), 'public food listings do not reveal contact details');
  assert(publicFoodRows.some(post => post.id === foodPostId && post.safeHours === 4), 'food listing includes computed food safety window');
  response = await request(`/api/food-posts/${foodPostId}`);
  assert.strictEqual(response.status, 401, 'food pickup details require authentication');
  response = await request(`/api/food-posts/${foodPostId}`, { token: userToken });
  assert.strictEqual(response.status, 403, 'non-participant cannot view food pickup contact');
  response = await request(`/api/food-posts/${foodPostId}/claim`, { method: 'POST', token: hospitalToken });
  assert.strictEqual(response.status, 403, 'verified hospital cannot claim as orphanage/NGO');
  response = await request(`/api/food-posts/${foodPostId}/claim`, { method: 'POST', token: userToken });
  assert.strictEqual(response.status, 403, 'unverified organization cannot claim food pickup');
  const claimAttempts = await Promise.all([recipientOne, recipientTwo].map(async recipient => ({ recipient, response: await request(`/api/food-posts/${foodPostId}/claim`, { method: 'POST', token: recipient.token }) })));
  assert.strictEqual(claimAttempts.filter(attempt => attempt.response.status === 200).length, 1, 'only one simultaneous recipient claim can win');
  assert.strictEqual(claimAttempts.filter(attempt => attempt.response.status === 409).length, 1, 'other simultaneous claim receives conflict');
  const claimWinner = claimAttempts.find(attempt => attempt.response.status === 200).recipient;
  const winnerDetailsResponse = await request(`/api/food-posts/${foodPostId}`, { token: claimWinner.token });
  assert.strictEqual(winnerDetailsResponse.status, 200, 'winning claimant can view pickup contact');
  assert.strictEqual((await winnerDetailsResponse.json()).contact, foodPayload.contact, 'private food pickup contact is returned to claimant');
  response = await request(`/api/food-posts/${foodPostId}/reports`, { method: 'POST', ...body({ reason: 'unsafe' }) });
  assert.strictEqual(response.status, 401, 'food report requires authentication');
  response = await request(`/api/food-posts/${foodPostId}/reports`, { method: 'POST', token: userToken, ...body({ reason: 'invalid' }) });
  assert.strictEqual(response.status, 400, 'food report validates reason');
  response = await request(`/api/food-posts/${foodPostId}/reports`, { method: 'POST', token: restaurant.token, ...body({ reason: 'unsafe' }) });
  assert.strictEqual(response.status, 403, 'restaurant cannot report own food post');
  response = await request(`/api/food-posts/${foodPostId}/reports`, { method: 'POST', token: userToken, ...body({ reason: 'unsafe', note: 'Food looks unsafe.' }) });
  assert.strictEqual(response.status, 201, 'food abuse report accepted');
  response = await request(`/api/food-posts/${foodPostId}/reports`, { method: 'POST', token: userToken, ...body({ reason: 'spam' }) });
  assert.strictEqual(response.status, 409, 'duplicate food report rejected');
  response = await request('/api/admin/food-reports', { token: userToken });
  assert.strictEqual(response.status, 403, 'non-admin cannot see food reports');
  response = await request('/api/admin/food-reports', { token: adminToken });
  assert.strictEqual(response.status, 200, 'admin can view food report queue');
  const foodReport = db.fallbackData.food_reports.at(-1);
  response = await request(`/api/admin/food-reports/${foodReport.id}`, { method: 'PATCH', token: adminToken, ...body({ action: 'invalid' }) });
  assert.strictEqual(response.status, 400, 'food moderation validates action');
  response = await request(`/api/admin/food-reports/${foodReport.id}`, { method: 'PATCH', token: adminToken, ...body({ action: 'dismiss' }) });
  assert.strictEqual(response.status, 200, 'admin can dismiss food report');
  response = await request('/api/food-posts/mine');
  assert.strictEqual(response.status, 401, 'my food posts requires authentication');
  response = await request('/api/food-posts/mine', { token: claimWinner.token });
  assert((await response.json()).some(post => post.id === foodPostId && post.contact === foodPayload.contact), 'recipient can view own claim and contact');
  response = await request(`/api/food-posts/${foodPostId}/confirm-pickup`, { method: 'POST', token: restaurant.token });
  assert.strictEqual(response.status, 200, 'restaurant can confirm handover');
  response = await request(`/api/food-posts/${foodPostId}/confirm-received`, { method: 'POST', token: claimWinner.token });
  assert.strictEqual(response.status, 200, 'claiming organization can confirm receipt');
  assert.strictEqual((await db.getFoodPostForUser(foodPostId, claimWinner.user.id)).status, 'completed', 'both handover confirmations complete food post');

  response = await request('/api/food-posts', { method: 'POST', token: restaurant.token, ...body(foodPayload) });
  assert.strictEqual(response.status, 201, 'restaurant can post second pickup');
  const cancelFoodId = (await response.json()).post.id;
  response = await request(`/api/food-posts/${cancelFoodId}/cancel`, { method: 'POST', token: userToken });
  assert.strictEqual(response.status, 403, 'non-owner cannot cancel food post');
  response = await request(`/api/food-posts/${cancelFoodId}/cancel`, { method: 'POST', token: restaurant.token });
  assert.strictEqual(response.status, 200, 'restaurant can cancel its food post');

  const expiredPost = db.fallbackData.food_posts.find(post => post.id === foodPostId);
  expiredPost.pickupBy = new Date(Date.now() - 1000).toISOString();
  await db.listFoodPosts();
  assert.strictEqual(expiredPost.status, 'completed', 'completed handover remains completed after pickup window');
  const cancelPostRecord = db.fallbackData.food_posts.find(post => post.id === cancelFoodId);
  assert.strictEqual(cancelPostRecord.status, 'cancelled', 'cancelled pickup remains cancelled');

  response = await request(`/api/events/${orgEvent.id}/reports`, { method: 'POST', ...body({ reason: 'fake' }) });
  assert.strictEqual(response.status, 401, 'event report requires authentication');
  response = await request(`/api/events/${orgEvent.id}/reports`, { method: 'POST', token: userToken, ...body({ reason: 'bogus' }) });
  assert.strictEqual(response.status, 400, 'event report validates reason');
  response = await request(`/api/events/${orgEvent.id}/reports`, { method: 'POST', token: ownerToken, ...body({ reason: 'fake' }) });
  assert.strictEqual(response.status, 403, 'organizer cannot report own event');
  response = await request(`/api/events/${orgEvent.id}/reports`, { method: 'POST', token: userToken, ...body({ reason: 'fake', note: 'Please review this listing.' }) });
  assert.strictEqual(response.status, 201, 'valid event report accepted');
  const report = db.fallbackData.event_reports.at(-1);
  response = await request(`/api/events/${orgEvent.id}/reports`, { method: 'POST', token: userToken, ...body({ reason: 'spam' }) });
  assert.strictEqual(response.status, 409, 'duplicate per-user event report rejected');
  response = await request('/api/admin/event-reports', { token: userToken });
  assert.strictEqual(response.status, 403, 'non-admin cannot view report queue');
  response = await request('/api/admin/event-reports', { token: adminToken });
  assert.strictEqual(response.status, 200, 'admin can view event report queue');
  const queueBody = await response.json();
  assert(!JSON.stringify(queueBody).includes(testUser.email), 'report queue does not expose reporter identity');
  response = await request(`/api/admin/event-reports/${report.id}`, { method: 'PATCH', token: adminToken, ...body({ action: 'bad-value' }) });
  assert.strictEqual(response.status, 400, 'moderation action validates input');
  response = await request(`/api/admin/event-reports/${report.id}`, { method: 'PATCH', token: adminToken, ...body({ action: 'dismiss' }) });
  assert.strictEqual(response.status, 200, 'admin can dismiss event report');
  await new Promise(resolve => apiServer.close(resolve));
  for (const id of uploadedDocumentIds) {
    const uploadedDoc = await db.getVerificationDocumentById(id);
    if (uploadedDoc) try { fs.unlinkSync(uploadedDoc.storagePath); } catch {}
  }
  const privateUploadDir = path.join(__dirname, 'private_verification');
  try { fs.rmdirSync(privateUploadDir); } catch {}
  console.log('✅ Trust/Safety API: auth, authorization, validation, upload, reporting, and moderation verified.');

  // Cleanup test event
  await db.deleteEvent(created.id);
  await db.deleteEvent(orgEvent.id);
  console.log(`✅ deleteEvent: cleaned up test events.`);

  const DemoDatabase=Object.getPrototypeOf(db).constructor,previousTestMode=process.env.SERVEO_TEST_MODE,previousDataMode=process.env.SERVEO_DATA_MODE;
  delete process.env.SERVEO_TEST_MODE;process.env.SERVEO_DATA_MODE='private';
  const demoDb=new DemoDatabase();demoDb.mode='fallback';demoDb.fallbackFile=path.join(os.tmpdir(),`serveo-demo-test-${process.pid}.json`);demoDb.initFallback();await demoDb.seedPrivateDemoData();
  assert.strictEqual(demoDb.demoDataEnabled,true,'private demo mode is marked for the impact page');
  const demoStats=await demoDb.getImpactStats();
  assert(demoStats.eventsHeld>0&&demoStats.donationsConfirmed>0&&demoStats.mealsDelivered>0&&demoStats.volunteerHours>0,'private demo scenarios seed real chart data for each impact measure');
  assert(demoStats.donorsRegistered>=28000&&demoStats.mealsDelivered>=100000,'private demo impact cards contain larger sample totals');
  assert(demoDb.fallbackData.food_posts.filter(post=>post.status==='posted'&&post.id.startsWith('demo_food_open_')).length>=10,'private food preview seeds multiple pickup cards');
  const demoHours=await demoDb.getVolunteerHours('preview_user');
  assert(demoHours.sampleSessions.length>=4&&demoHours.sampleSessions.every(row=>row.isDemo),'private volunteer-hours preview contains clearly marked sample records');
  assert.strictEqual(demoHours.totalHours,0,'sample volunteer hours do not inflate verified totals');
  assert(demoHours.displayTotalHours>=15&&demoHours.displaySessions.length>=4,'private preview displays sample hours in the main total and records list');
  const demoTrends=await demoDb.getImpactTrends();
  assert(demoTrends.length>=10&&Math.max(...demoTrends.map(item=>item.volunteersMobilized))>=28000,'private impact graph has ten months of large sample turnout values');
  assert(demoDb.fallbackData.event_reports.some(row=>row.id==='demo_event_report')&&demoDb.fallbackData.food_reports.some(row=>row.id==='demo_food_report'),'private samples cover event and food reporting queues');
  fs.rmSync(demoDb.fallbackFile,{force:true});
  process.env.SERVEO_TEST_MODE=previousTestMode;process.env.SERVEO_DATA_MODE=previousDataMode;
  const publicDb=new DemoDatabase();publicDb.publicMode=true;publicDb.mode='fallback';publicDb.fallbackFile=path.join(os.tmpdir(),`serveo-public-test-${process.pid}.json`);publicDb.initFallback();await publicDb.seedPrivateDemoData();
  assert.strictEqual(publicDb.demoDataEnabled,false,'public mode never enables demo preview fallback');
  assert.strictEqual(publicDb.fallbackData.users.length,0,'public mode does not seed fake demo accounts');
  assert.strictEqual(publicDb.fallbackData.events.length,0,'public mode does not seed fake events');
  assert.strictEqual(publicDb.fallbackData.impact_demo_monthly_samples.length,0,'public mode does not seed fake graph values');
  assert.strictEqual((await publicDb.getVolunteerHours('preview_user')).sampleSessions.length,0,'public mode never exposes sample volunteer hours');
  fs.rmSync(publicDb.fallbackFile,{force:true});

  console.log('\n🎉 ALL TEST SUITES PASSED! Node.js backend is fully operational.');
  fs.rmSync(testDbFile, { force: true });
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  try { fs.rmSync(testDbFile, { force: true }); } catch {}
  process.exit(1);
});
