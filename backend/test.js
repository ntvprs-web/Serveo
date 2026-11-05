// SERVEO Backend Automated API Test Suite
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Keep test data isolated from both PostgreSQL and the persistent local store.
process.env.SERVEO_TEST_MODE = 'true';
process.env.DEV_OTP_ALLOW = 'true';
process.env.NODE_ENV = 'development';
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

  // Cleanup test event
  await db.deleteEvent(created.id);
  await db.deleteEvent(orgEvent.id);
  console.log(`✅ deleteEvent: cleaned up test events.`);

  console.log('\n🎉 ALL 9 TEST SUITES PASSED! Node.js backend is fully operational.');
  fs.rmSync(testDbFile, { force: true });
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  try { fs.rmSync(testDbFile, { force: true }); } catch {}
  process.exit(1);
});
