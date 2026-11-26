const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { INITIAL_EVENTS, INITIAL_CONTACTS } = require('./seeds');

// Haversine formula to compute distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class DatabaseManager {
  constructor() {
    this.mode = 'postgres'; // 'postgres' or 'fallback'
    this.pool = null;
    this.fallbackFile = path.join(__dirname, 'data', 'serveo-db.json');
    this.fallbackData = null;
    this.demoDataEnabled = false;
    this.publicMode = (process.env.SERVEO_DATA_MODE || (process.env.NODE_ENV === 'production' ? 'public' : 'private')).toLowerCase() === 'public';
  }

  async initialize() {
    // Automated tests must never connect to a developer's or production database.
    if (process.env.SERVEO_TEST_MODE === 'true') {
      this.mode = 'fallback';
      this.initFallback();
      return;
    }

    const databaseUrl = process.env.DATABASE_URL || 
      `postgres://${process.env.POSTGRES_USER || 'serveo'}:${process.env.POSTGRES_PASSWORD || 'serveo-local-only'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'serveo'}`;

    try {
      const isRemoteDb = /supabase\.co|pooler\.supabase\.com|sslmode=require/i.test(databaseUrl);
      this.pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 10000,
        ...(isRemoteDb ? { ssl: { rejectUnauthorized: false } } : {}),
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();
      this.mode = 'postgres';
      console.log('✅ Connected to PostgreSQL database');

      // Initialize schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await this.pool.query(schemaSql);
      }

      const demoEventIds = INITIAL_EVENTS.map(event => String(event.id));
      if (this.publicMode) await this.pool.query('DELETE FROM events WHERE id = ANY($1::varchar[])', [demoEventIds]);

      // Check if events table needs initial seeding
      const res = await this.pool.query('SELECT COUNT(*) FROM events');
      if (!this.publicMode && parseInt(res.rows[0].count, 10) === 0) {
        console.log('🌱 Seeding initial 18 public-service events into PostgreSQL...');
        for (const ev of INITIAL_EVENTS) {
          await this.pool.query(
            `INSERT INTO events (id, title, category, organizer, verified, city, address, lat, lng, date, start_time, end_time, volunteers_needed, volunteers_joined, urgency, description, donation_link, tags, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT (id) DO NOTHING`,
            [
              ev.id, ev.title, ev.category, ev.organizer, ev.verified,
              ev.city, ev.address, ev.lat, ev.lng, ev.date,
              ev.startTime, ev.endTime, ev.volunteersNeeded, ev.volunteersJoined,
              ev.urgency, ev.description, ev.donationLink, ev.tags || [], ev.status || 'approved'
            ]
          );

          const contact = INITIAL_CONTACTS[ev.id];
          if (contact) {
            await this.pool.query(
              `INSERT INTO event_contacts (event_id, org_type, contact, email)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (event_id) DO NOTHING`,
              [ev.id, contact.orgType, contact.contact, contact.email]
            );
          }
        }
        console.log('✅ PostgreSQL seeding complete.');
      }
      await this.seedPrivateDemoData();
    } catch (err) {
      console.warn(`⚠️ PostgreSQL connection not available (${err.message}).`);
      console.log('🔄 Initializing embedded persistent local datastore (backend/data/serveo-db.json)...');
      this.mode = 'fallback';
      this.initFallback();
      await this.seedPrivateDemoData();
    }
  }

  initFallback() {
    const dataDir = path.dirname(this.fallbackFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(this.fallbackFile)) {
      try {
        this.fallbackData = JSON.parse(fs.readFileSync(this.fallbackFile, 'utf8'));
      } catch (e) {
        this.fallbackData = null;
      }
    }

    if (!this.fallbackData || !Array.isArray(this.fallbackData.events)) {
      this.fallbackData = {
        users: [],
        events: this.publicMode ? [] : JSON.parse(JSON.stringify(INITIAL_EVENTS)),
        event_contacts: this.publicMode ? {} : JSON.parse(JSON.stringify(INITIAL_CONTACTS)),
        volunteer_applications: [],
        attendance: [],
        event_reviews: [],
        notifications: [],
        urgent_blood_requests: [],
        urgent_blood_offers: []
      };
      this.saveFallback();
      if (!this.publicMode) console.log('🌱 Seeded 18 public welfare events into local database file.');
    }
    if (this.publicMode) {
      const demoIds = new Set(INITIAL_EVENTS.map(event => String(event.id)));
      this.fallbackData.events = this.fallbackData.events.filter(event => !demoIds.has(String(event.id)));
      for (const id of demoIds) delete this.fallbackData.event_contacts[id];
    }
    if (!Array.isArray(this.fallbackData.event_reviews)) this.fallbackData.event_reviews = [];
    if (!Array.isArray(this.fallbackData.notifications)) this.fallbackData.notifications = [];
    if (!Array.isArray(this.fallbackData.urgent_blood_requests)) this.fallbackData.urgent_blood_requests = [];
    if (!Array.isArray(this.fallbackData.urgent_blood_offers)) this.fallbackData.urgent_blood_offers = [];
    if (!Array.isArray(this.fallbackData.terms_acceptances)) this.fallbackData.terms_acceptances = [];
    if (!Array.isArray(this.fallbackData.organizer_verification_documents)) this.fallbackData.organizer_verification_documents = [];
    if (!Array.isArray(this.fallbackData.event_reports)) this.fallbackData.event_reports = [];
    if (!Array.isArray(this.fallbackData.blood_donations)) this.fallbackData.blood_donations = [];
    if (!Array.isArray(this.fallbackData.blood_bank_stock)) this.fallbackData.blood_bank_stock = [];
    if (!Array.isArray(this.fallbackData.donation_certificates)) this.fallbackData.donation_certificates = [];
    if (!Array.isArray(this.fallbackData.food_posts)) this.fallbackData.food_posts = [];
    if (!Array.isArray(this.fallbackData.food_post_notifications)) this.fallbackData.food_post_notifications = [];
    if (!Array.isArray(this.fallbackData.food_reports)) this.fallbackData.food_reports = [];
    if (!Array.isArray(this.fallbackData.premium_activations)) this.fallbackData.premium_activations = [];
    if (!Array.isArray(this.fallbackData.website_inquiries)) this.fallbackData.website_inquiries = [];
    if (!Array.isArray(this.fallbackData.blood_donor_profiles)) this.fallbackData.blood_donor_profiles = [];
    if (!Array.isArray(this.fallbackData.volunteer_attendance_records)) this.fallbackData.volunteer_attendance_records = [];
    if (!Array.isArray(this.fallbackData.volunteer_hours_certificates)) this.fallbackData.volunteer_hours_certificates = [];
    if (!Array.isArray(this.fallbackData.impact_demo_monthly_samples)) this.fallbackData.impact_demo_monthly_samples = [];
    if (!Array.isArray(this.fallbackData.disaster_mode_audit)) this.fallbackData.disaster_mode_audit = [];
    if (!this.fallbackData.disaster_mode) this.fallbackData.disaster_mode = { active: false };
    if (!Array.isArray(this.fallbackData.notifications)) this.fallbackData.notifications = [];
    for (const user of this.fallbackData.users) if (!user.verificationStatus) user.verificationStatus = 'unverified';
    console.log('✅ Local persistent datastore ready.');
  }

  async seedPrivateDemoData(){
    if(this.publicMode||process.env.SERVEO_TEST_MODE==='true'||String(process.env.SERVEO_DEMO_DATA||'true').toLowerCase()==='false')return;
    this.demoDataEnabled=true;
    const monthAgo=new Date(Date.now()-35*86400000),weekAgo=new Date(Date.now()-7*86400000),eventDay=new Date(Date.now()-14*86400000),iso=value=>value.toISOString(),day=value=>value.toISOString().slice(0,10);
    const demoMonthlyCounts=[[1200,45],[2400,78],[4800,120],[7800,175],[11500,240],[15800,315],[19200,390],[23100,470],[26400,560],[28400,650]];
    const demoMonthRows=demoMonthlyCounts.map(([volunteersMobilized,welfareDrivesCompleted],index)=>({month:new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()-9+index,1)),volunteersMobilized,welfareDrivesCompleted,donorsRegistered:volunteersMobilized,donationsConfirmed:Math.round(volunteersMobilized*.08),mealsDelivered:welfareDrivesCompleted*200,volunteerHours:volunteersMobilized*4,citiesCovered:Math.min(30,3+index*3)}));
    const demoFoodItems=['Fresh fruit and packaged snacks','Sealed vegetable rice meals','Bread and dairy recovery pack','Fresh lentil curry and rice','Packed breakfast boxes','Seasonal produce crates','Vegetable pulao meal trays','Safe-to-serve bakery items','Fresh chapati and paneer meals','Community lunch meal boxes'];
    const people=[
      {id:'demo_volunteer',name:'Demo Volunteer',username:'demo_volunteer',email:'demo-volunteer@example.invalid',phone:'+919900000001',bloodGroup:'O+',lastDonationDate:day(new Date(Date.now()-125*86400000)),donationCooldownDays:90,verificationStatus:'unverified'},
      {id:'demo_organizer',name:'Demo Relief Collective',username:'demo_relief',email:'demo-relief@example.invalid',phone:'+919900000002',organizationType:'ngo',verificationStatus:'approved'},
      {id:'demo_blood_bank',name:'Demo City Blood Bank',username:'demo_bloodbank',email:'demo-bloodbank@example.invalid',phone:'+919900000003',organizationType:'blood_bank',verificationStatus:'approved'},
      {id:'demo_restaurant',name:'Demo Community Kitchen',username:'demo_kitchen',email:'demo-kitchen@example.invalid',phone:'+919900000004',organizationType:'restaurant',verificationStatus:'approved'},
      {id:'demo_recipient',name:'Demo Neighborhood NGO',username:'demo_recipient',email:'demo-recipient@example.invalid',phone:'+919900000005',organizationType:'ngo',verificationStatus:'approved'}
    ];
    if(this.mode==='postgres'){
      for(const p of people)await this.pool.query(`INSERT INTO users(id,name,username,email,phone,password_hash,blood_group,last_donation_date,donation_cooldown_days,organization_type,verification_status,home_city,notifications_enabled,notification_lat,notification_lng) VALUES($1,$2,$3,$4,$5,'demo-account-no-password',$6,$7,$8,$9,$10,'Delhi',TRUE,28.6139,77.2090) ON CONFLICT(id) DO NOTHING`,[p.id,p.name,p.username,p.email,p.phone,p.bloodGroup||null,p.lastDonationDate||null,p.donationCooldownDays||null,p.organizationType||null,p.verificationStatus]);
      for(const sample of demoMonthRows)await this.pool.query('INSERT INTO impact_demo_monthly_samples(month,volunteers_mobilized,welfare_drives_completed,donors_registered,donations_confirmed,meals_delivered,volunteer_hours,cities_covered) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(month) DO UPDATE SET volunteers_mobilized=EXCLUDED.volunteers_mobilized,welfare_drives_completed=EXCLUDED.welfare_drives_completed,donors_registered=EXCLUDED.donors_registered,donations_confirmed=EXCLUDED.donations_confirmed,meals_delivered=EXCLUDED.meals_delivered,volunteer_hours=EXCLUDED.volunteer_hours,cities_covered=EXCLUDED.cities_covered',[day(sample.month),sample.volunteersMobilized,sample.welfareDrivesCompleted,sample.donorsRegistered,sample.donationsConfirmed,sample.mealsDelivered,sample.volunteerHours,sample.citiesCovered]);
      const events=[['demo_event_held','Demo Community Health Camp','medical','demo_organizer','completed'],['demo_event_reported','Demo Relief Supply Drive','disaster','demo_organizer','approved']];
      for(const [id,title,category,owner,status]of events)await this.pool.query(`INSERT INTO events(id,owner_id,title,category,organizer,verified,city,address,lat,lng,date,start_time,end_time,volunteers_needed,volunteers_joined,urgency,description,status) VALUES($1,$2,$3,$4,$5,TRUE,'Delhi','Demo service location',28.6139,77.2090,$6,'09:00','12:00',20,4,'upcoming','Private demo scenario record',$7) ON CONFLICT(id) DO NOTHING`,[id,owner,title,category,people.find(p=>p.id===owner).name,day(eventDay),status]);
      await this.pool.query(`INSERT INTO event_reviews(id,event_id,user_id,organizer_id,rating,outcome,comment,created_at) VALUES('demo_review','demo_event_held','demo_volunteer','demo_organizer',5,'event_held','Private demo confirmation',$1) ON CONFLICT(id) DO NOTHING`,[iso(eventDay)]);
      await this.pool.query(`INSERT INTO event_reports(id,event_id,reporter_id,reason,note,status) VALUES('demo_event_report','demo_event_reported','demo_volunteer','outdated','Private demo report','pending') ON CONFLICT(id) DO NOTHING`);
      const donationDay=new Date(Date.now()-125*86400000);await this.pool.query(`INSERT INTO blood_donations(id,donor_id,donation_date,city,cooldown_days,status,confirmed_by,confirmed_at) VALUES('demo_donation','demo_volunteer',$1,'Delhi',90,'confirmed','demo_blood_bank',$2) ON CONFLICT(id) DO NOTHING`,[day(donationDay),iso(donationDay)]);
      await this.pool.query(`INSERT INTO blood_bank_stock(id,organization_id,city,address,lat,lng,blood_group,need_level,updated_at) VALUES('demo_stock','demo_blood_bank','Delhi','Demo Blood Bank, Central Delhi',28.6139,77.2090,'AB+','critical',CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING`);
      await this.pool.query(`INSERT INTO food_posts(id,restaurant_id,item_description,approximate_meals,cooked_at,pickup_by,address,city,lat,lng,contact,status,claimed_by,restaurant_confirmed_at,recipient_confirmed_at,completed_at) VALUES('demo_food_completed','demo_restaurant','Sealed vegetable rice meals',24,$1,$2,'Demo Kitchen, Central Delhi','Delhi',28.614,77.210,'Private demo contact','completed','demo_recipient',$3,$3,$3) ON CONFLICT(id) DO NOTHING`,[iso(new Date(weekAgo.getTime()-2*3600000)),iso(new Date(weekAgo.getTime()-3600000)),iso(weekAgo)]);
      await this.pool.query(`INSERT INTO food_posts(id,restaurant_id,item_description,approximate_meals,cooked_at,pickup_by,address,city,lat,lng,contact,status) VALUES('demo_food_open','demo_restaurant','Fresh fruit and packaged snacks',12,CURRENT_TIMESTAMP-INTERVAL '20 minutes',CURRENT_TIMESTAMP+INTERVAL '2 hours','Demo Kitchen, Central Delhi','Delhi',28.614,77.210,'Private demo contact','posted') ON CONFLICT(id) DO NOTHING`);
      const demoFoodLocations=[['Delhi',28.6139,77.2090],['Mumbai',19.0760,72.8777],['Bengaluru',12.9716,77.5946],['Patna',25.5941,85.1376],['Pune',18.5204,73.8567]];
      for(let index=0;index<demoFoodItems.length;index++){const[city,lat,lng]=demoFoodLocations[index%demoFoodLocations.length],id=`demo_food_open_${String(index+1).padStart(2,'0')}`;await this.pool.query(`INSERT INTO food_posts(id,restaurant_id,item_description,approximate_meals,cooked_at,pickup_by,address,city,lat,lng,contact,status) VALUES($1,'demo_restaurant',$2,$3,CURRENT_TIMESTAMP-INTERVAL '25 minutes',CURRENT_TIMESTAMP+INTERVAL '2 hours',$4,$5,$6,$7,'Private demo contact','posted') ON CONFLICT(id) DO NOTHING`,[id,demoFoodItems[index],18+index*7,`Demo community pickup point, ${city}`,city,lat,lng]);}
      await this.pool.query(`INSERT INTO food_reports(id,food_post_id,reporter_id,reason,note,status) VALUES('demo_food_report','demo_food_open','demo_volunteer','other','Private walkthrough report','pending') ON CONFLICT(id) DO NOTHING`);
      await this.pool.query(`INSERT INTO volunteer_applications(id,event_id,user_id,applicant_name,applicant_phone,applicant_email,organizer_id,status,tracking_consent,ticket_code_hash,phone_verified) VALUES('demo_application','demo_event_held','demo_volunteer','Demo Volunteer','+919900000001','demo-volunteer@example.invalid','demo_organizer','registered',FALSE,REPEAT('a',64),TRUE) ON CONFLICT(id) DO NOTHING`);
      await this.pool.query(`INSERT INTO volunteer_attendance_records(id,application_id,event_id,user_id,checked_in_at,checked_out_at,hours,marked_by) VALUES('demo_hours','demo_application','demo_event_held','demo_volunteer',$1,$2,2.5,'demo_organizer') ON CONFLICT(id) DO NOTHING`,[iso(new Date(eventDay.getTime()+9*3600000)),iso(new Date(eventDay.getTime()+11.5*3600000))]);
      await this.pool.query(`INSERT INTO urgent_blood_requests(id,requester_id,patient_name,blood_group,units,hospital,address,city,lat,lng,contact_phone,details,status,expires_at,matching_wave,last_wave_at) VALUES('demo_blood_request','demo_recipient','Demo Patient','AB+',1,'Demo General Hospital','Demo hospital location','Delhi',28.6139,77.2090,'+919900000005','Private matching walkthrough','open',CURRENT_TIMESTAMP+INTERVAL '12 hours',1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING`);
      await this.pool.query(`INSERT INTO notifications(id,user_id,urgent_request_id,title,message,delivered) VALUES('demo_blood_notice','demo_volunteer','demo_blood_request','Compatible AB+ blood needed','Demo request nearby. O+ is compatible; contact is not shared before acceptance.',TRUE) ON CONFLICT(id) DO NOTHING`);
      return;
    }
    for(const p of people)if(!this.fallbackData.users.some(user=>String(user.id)===p.id))this.fallbackData.users.push({...p,passwordHash:'demo-account-no-password',phoneVerified:true,notificationsEnabled:true,notificationLat:28.6139,notificationLng:77.2090,homeCity:'Delhi',createdAt:iso(monthAgo),updatedAt:iso(monthAgo)});
    for(const sample of demoMonthRows){const month=day(sample.month),existing=this.fallbackData.impact_demo_monthly_samples.find(row=>row.month===month);if(existing)Object.assign(existing,{volunteersMobilized:sample.volunteersMobilized,welfareDrivesCompleted:sample.welfareDrivesCompleted,donorsRegistered:sample.donorsRegistered,donationsConfirmed:sample.donationsConfirmed,mealsDelivered:sample.mealsDelivered,volunteerHours:sample.volunteerHours,citiesCovered:sample.citiesCovered});else this.fallbackData.impact_demo_monthly_samples.push({month,volunteersMobilized:sample.volunteersMobilized,welfareDrivesCompleted:sample.welfareDrivesCompleted,donorsRegistered:sample.donorsRegistered,donationsConfirmed:sample.donationsConfirmed,mealsDelivered:sample.mealsDelivered,volunteerHours:sample.volunteerHours,citiesCovered:sample.citiesCovered});}
    const event=(id,title,category,status)=>({id,ownerId:'demo_organizer',title,category,organizer:'Demo Relief Collective',verified:true,city:'Delhi',address:'Demo service location',lat:28.6139,lng:77.2090,date:day(eventDay),startTime:'09:00',endTime:'12:00',volunteersNeeded:20,volunteersJoined:4,urgency:'upcoming',description:'Private demo scenario record',status,createdAt:iso(monthAgo),updatedAt:iso(monthAgo)});
    for(const e of [event('demo_event_held','Demo Community Health Camp','medical','completed'),event('demo_event_reported','Demo Relief Supply Drive','disaster','approved')])if(!this.fallbackData.events.some(row=>String(row.id)===e.id))this.fallbackData.events.push(e);
    if(!this.fallbackData.event_reviews.some(x=>x.id==='demo_review'))this.fallbackData.event_reviews.push({id:'demo_review',eventId:'demo_event_held',userId:'demo_volunteer',organizerId:'demo_organizer',rating:5,outcome:'event_held',comment:'Private demo confirmation',createdAt:iso(eventDay)});
    if(!this.fallbackData.event_reports.some(x=>x.id==='demo_event_report'))this.fallbackData.event_reports.push({id:'demo_event_report',eventId:'demo_event_reported',reporterId:'demo_volunteer',reason:'outdated',note:'Private demo report',status:'pending',createdAt:iso(monthAgo)});
    const donationDay=new Date(Date.now()-125*86400000);if(!this.fallbackData.blood_donations.some(x=>x.id==='demo_donation'))this.fallbackData.blood_donations.push({id:'demo_donation',donorId:'demo_volunteer',donationDate:day(donationDay),city:'Delhi',cooldownDays:90,status:'confirmed',confirmedBy:'demo_blood_bank',confirmedAt:iso(donationDay),createdAt:iso(donationDay)});
    if(!this.fallbackData.blood_bank_stock.some(x=>x.id==='demo_stock'))this.fallbackData.blood_bank_stock.push({id:'demo_stock',organizationId:'demo_blood_bank',city:'Delhi',address:'Demo Blood Bank, Central Delhi',lat:28.6139,lng:77.2090,bloodGroup:'AB+',needLevel:'critical',updatedAt:new Date().toISOString()});
    for(const p of [{id:'demo_food_completed',itemDescription:'Sealed vegetable rice meals',approximateMeals:24,cookedAt:iso(new Date(weekAgo.getTime()-2*3600000)),pickupBy:iso(new Date(weekAgo.getTime()-3600000)),address:'Demo Kitchen, Central Delhi',city:'Delhi',lat:28.614,lng:77.210,contact:'Private demo contact',status:'completed',claimedBy:'demo_recipient',restaurantConfirmedAt:iso(weekAgo),recipientConfirmedAt:iso(weekAgo),completedAt:iso(weekAgo),createdAt:iso(weekAgo),restaurantId:'demo_restaurant'},{id:'demo_food_open',itemDescription:'Fresh fruit and packaged snacks',approximateMeals:12,cookedAt:iso(new Date(Date.now()-20*60000)),pickupBy:iso(new Date(Date.now()+2*3600000)),address:'Demo Kitchen, Central Delhi',city:'Delhi',lat:28.614,lng:77.210,contact:'Private demo contact',status:'posted',createdAt:new Date().toISOString(),restaurantId:'demo_restaurant'}])if(!this.fallbackData.food_posts.some(row=>row.id===p.id))this.fallbackData.food_posts.push(p);
    const demoFoodLocations=[['Delhi',28.6139,77.2090],['Mumbai',19.0760,72.8777],['Bengaluru',12.9716,77.5946],['Patna',25.5941,85.1376],['Pune',18.5204,73.8567]];
    for(let index=0;index<demoFoodItems.length;index++){const[city,lat,lng]=demoFoodLocations[index%demoFoodLocations.length],id=`demo_food_open_${String(index+1).padStart(2,'0')}`;if(!this.fallbackData.food_posts.some(row=>row.id===id))this.fallbackData.food_posts.push({id,restaurantId:'demo_restaurant',itemDescription:demoFoodItems[index],approximateMeals:18+index*7,cookedAt:iso(new Date(Date.now()-25*60000)),pickupBy:iso(new Date(Date.now()+2*3600000)),address:`Demo community pickup point, ${city}`,city,lat,lng,contact:'Private demo contact',status:'posted',createdAt:new Date().toISOString()});}
    if(!this.fallbackData.food_reports.some(x=>x.id==='demo_food_report'))this.fallbackData.food_reports.push({id:'demo_food_report',foodPostId:'demo_food_open',reporterId:'demo_volunteer',reason:'other',note:'Private walkthrough report',status:'pending',createdAt:iso(monthAgo)});
    if(!this.fallbackData.volunteer_applications.some(x=>x.id==='demo_application'))this.fallbackData.volunteer_applications.push({id:'demo_application',eventId:'demo_event_held',userId:'demo_volunteer',applicantName:'Demo Volunteer',applicantPhone:'+919900000001',applicantEmail:'demo-volunteer@example.invalid',organizerId:'demo_organizer',status:'registered',trackingConsent:false,ticketCodeHash:'a'.repeat(64),phoneVerified:true,createdAt:iso(eventDay)});
    if(!this.fallbackData.volunteer_attendance_records.some(x=>x.id==='demo_hours'))this.fallbackData.volunteer_attendance_records.push({id:'demo_hours',applicationId:'demo_application',eventId:'demo_event_held',userId:'demo_volunteer',checkedInAt:iso(new Date(eventDay.getTime()+9*3600000)),checkedOutAt:iso(new Date(eventDay.getTime()+11.5*3600000)),hours:2.5,markedBy:'demo_organizer',createdAt:iso(eventDay)});
    if(!this.fallbackData.urgent_blood_requests.some(x=>x.id==='demo_blood_request'))this.fallbackData.urgent_blood_requests.push({id:'demo_blood_request',requesterId:'demo_recipient',patientName:'Demo Patient',bloodGroup:'AB+',units:1,hospital:'Demo General Hospital',address:'Demo hospital location',city:'Delhi',lat:28.6139,lng:77.2090,contactPhone:'+919900000005',details:'Private matching walkthrough',status:'open',createdAt:new Date().toISOString(),expiresAt:iso(new Date(Date.now()+12*3600000)),matchingWave:1,lastWaveAt:new Date().toISOString()});
    if(!this.fallbackData.notifications.some(x=>x.id==='demo_blood_notice'))this.fallbackData.notifications.push({id:'demo_blood_notice',userId:'demo_volunteer',urgentRequestId:'demo_blood_request',title:'Compatible AB+ blood needed',message:'Demo request nearby. O+ is compatible; contact is not shared before acceptance.',delivered:true,createdAt:new Date().toISOString()});
    this.saveFallback();
  }

  saveFallback() {
    try {
      fs.writeFileSync(this.fallbackFile, JSON.stringify(this.fallbackData, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save fallback data:', e);
    }
  }

  async getTermsAcceptance({ userId, guestId, version }) {
    if (this.mode === 'postgres') {
      if (userId) {
        const userResult = await this.pool.query(
          'SELECT terms_version, accepted_at FROM terms_acceptances WHERE user_id = $1 AND terms_version = $2 LIMIT 1',
          [String(userId), version]
        );
        if (userResult.rows[0]) return { version: userResult.rows[0].terms_version, acceptedAt: userResult.rows[0].accepted_at };
      }
      if (!guestId) return null;
      const guestResult = await this.pool.query(
        'SELECT terms_version, accepted_at FROM terms_acceptances WHERE guest_id = $1 AND terms_version = $2 LIMIT 1',
        [guestId, version]
      );
      if (!guestResult.rows[0]) return null;
      if (userId) {
        await this.pool.query(
          'UPDATE terms_acceptances SET user_id = $1, guest_id = NULL WHERE guest_id = $2 AND terms_version = $3 AND NOT EXISTS (SELECT 1 FROM terms_acceptances WHERE user_id = $1 AND terms_version = $3)',
          [String(userId), guestId, version]
        );
      }
      return { version: guestResult.rows[0].terms_version, acceptedAt: guestResult.rows[0].accepted_at };
    }

    const records = this.fallbackData.terms_acceptances || [];
    let record = userId && records.find(item => item.userId === String(userId) && item.termsVersion === version);
    if (!record && guestId) record = records.find(item => item.guestId === guestId && item.termsVersion === version);
    if (record && userId && record.guestId === guestId) {
      const alreadyLinked = records.some(item => item.userId === String(userId) && item.termsVersion === version);
      if (!alreadyLinked) {
        record.userId = String(userId);
        record.guestId = null;
        this.saveFallback();
      }
    }
    return record ? { version: record.termsVersion, acceptedAt: record.acceptedAt } : null;
  }

  async recordTermsAcceptance({ userId, guestId, version }) {
    const acceptedAt = new Date().toISOString();
    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `INSERT INTO terms_acceptances (user_id, guest_id, terms_version, accepted_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING accepted_at`,
        [userId ? String(userId) : null, userId ? null : guestId, version, acceptedAt]
      );
      const existing = result.rows[0] || await this.getTermsAcceptance({ userId, guestId, version });
      return { version, acceptedAt: existing?.acceptedAt || acceptedAt };
    }

    const current = await this.getTermsAcceptance({ userId, guestId, version });
    if (current) return current;
    const record = { userId: userId ? String(userId) : null, guestId: userId ? null : guestId, termsVersion: version, acceptedAt };
    this.fallbackData.terms_acceptances.push(record);
    this.saveFallback();
    return { version, acceptedAt };
  }

  // ==================== EVENTS ====================

  async archiveExpiredEvents() {
    const now = new Date();
    if (this.mode === 'postgres') {
      const result = await this.pool.query(`UPDATE events SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE status NOT IN ('archived','hidden') AND ((date + end_time::time) AT TIME ZONE 'Asia/Kolkata') <= CURRENT_TIMESTAMP RETURNING id`);
      return result.rowCount;
    }
    let changed = 0;
    for (const event of this.fallbackData.events) {
      if (['archived', 'hidden'].includes(event.status)) continue;
      const end = Date.parse(`${event.date}T${event.endTime || '23:59'}:00+05:30`);
      if (Number.isFinite(end) && end <= now.getTime()) {
        event.status = 'archived';
        event.archivedAt = now.toISOString();
        event.updatedAt = now.toISOString();
        changed++;
      }
    }
    if (changed) this.saveFallback();
    return changed;
  }

  async submitVerificationDocument(userId, document) {
    const record = { id: 'doc_' + crypto.randomUUID(), userId: String(userId), storagePath: document.storagePath, mimeType: document.mimeType, originalName: document.originalName, requestedType: document.requestedType || 'organizer', status: 'pending', reviewReason: '', createdAt: new Date().toISOString(), reviewedAt: null };
    if (this.mode === 'postgres') {
      await this.pool.query('INSERT INTO organizer_verification_documents (id,user_id,storage_path,mime_type,original_name,requested_type,status) VALUES ($1,$2,$3,$4,$5,$6,\'pending\') ON CONFLICT (user_id) DO UPDATE SET id=$1,storage_path=$3,mime_type=$4,original_name=$5,requested_type=$6,status=\'pending\',review_reason=NULL,created_at=CURRENT_TIMESTAMP,reviewed_at=NULL', [record.id, record.userId, record.storagePath, record.mimeType, record.originalName, record.requestedType]);
      await this.pool.query("UPDATE users SET verification_status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [record.userId]);
    } else {
      this.fallbackData.organizer_verification_documents = this.fallbackData.organizer_verification_documents.filter(item => item.userId !== record.userId);
      this.fallbackData.organizer_verification_documents.push(record);
      const user = this.fallbackData.users.find(item => String(item.id) === record.userId);
      if (user) user.verificationStatus = 'pending';
      this.saveFallback();
    }
    return { status: 'pending' };
  }

  async getVerificationStatus(userId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query('SELECT status, review_reason, requested_type, created_at FROM organizer_verification_documents WHERE user_id=$1', [String(userId)]);
      return result.rows[0] ? { status: result.rows[0].status, reason: result.rows[0].review_reason, submittedAt: result.rows[0].created_at, organizationType: result.rows[0].requested_type } : { status: 'unverified', reason: null, submittedAt: null, organizationType: null };
    }
    const doc = this.fallbackData.organizer_verification_documents.find(item => item.userId === String(userId));
    return doc ? { status: doc.status, reason: doc.reviewReason || null, submittedAt: doc.createdAt, organizationType: doc.requestedType || null } : { status: 'unverified', reason: null, submittedAt: null, organizationType: null };
  }

  async listVerificationQueue() {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("SELECT d.id,d.user_id,d.mime_type,d.original_name,d.requested_type,d.status,d.created_at,u.name AS organizer_name FROM organizer_verification_documents d JOIN users u ON u.id=d.user_id WHERE d.status='pending' ORDER BY d.created_at");
      return result.rows.map(row => ({ id: row.id, userId: row.user_id, mimeType: row.mime_type, originalName: row.original_name, requestedType: row.requested_type, status: row.status, submittedAt: row.created_at, organizerName: row.organizer_name }));
    }
    return this.fallbackData.organizer_verification_documents.filter(doc => doc.status === 'pending').map(doc => ({ id: doc.id, userId: doc.userId, mimeType: doc.mimeType, originalName: doc.originalName, requestedType: doc.requestedType, status: doc.status, submittedAt: doc.createdAt, organizerName: this.fallbackData.users.find(user => String(user.id) === doc.userId)?.name || 'Organizer' }));
  }

  async getVerificationDocumentById(id) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query('SELECT id,user_id,storage_path,mime_type,original_name FROM organizer_verification_documents WHERE id=$1', [String(id)]);
      const row = result.rows[0];
      return row ? { id: row.id, userId: row.user_id, storagePath: row.storage_path, mimeType: row.mime_type, originalName: row.original_name } : null;
    }
    const doc = this.fallbackData.organizer_verification_documents.find(item => item.id === String(id));
    return doc ? { id: doc.id, userId: doc.userId, storagePath: doc.storagePath, mimeType: doc.mimeType, originalName: doc.originalName } : null;
  }

  async reviewVerificationDocument(id, decision, reason = '') {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("UPDATE organizer_verification_documents SET status=$2,review_reason=$3,reviewed_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending' RETURNING user_id,requested_type", [String(id), decision, reason]);
      if (!result.rowCount) return false;
      await this.pool.query('UPDATE users SET verification_status=$1,organization_type=CASE WHEN $1=\'approved\' THEN $2 ELSE organization_type END,updated_at=CURRENT_TIMESTAMP WHERE id=$3', [decision, result.rows[0].requested_type, result.rows[0].user_id]);
      await this.pool.query('UPDATE events SET verified=$1,updated_at=CURRENT_TIMESTAMP WHERE owner_id=$2', [decision === 'approved', result.rows[0].user_id]);
      return true;
    }
    const doc = this.fallbackData.organizer_verification_documents.find(item => item.id === String(id) && item.status === 'pending');
    if (!doc) return false;
    doc.status = decision; doc.reviewReason = reason; doc.reviewedAt = new Date().toISOString();
    const user = this.fallbackData.users.find(item => String(item.id) === doc.userId);
    if (user) { user.verificationStatus = decision; if (decision === 'approved') user.organizationType = doc.requestedType; }
    this.fallbackData.events.filter(event => String(event.ownerId || '') === doc.userId).forEach(event => { event.verified = decision === 'approved'; });
    this.saveFallback(); return true;
  }

  async createEventReport({ eventId, reporterId, reason, note }) {
    if (this.mode === 'postgres') {
      const event = await this.pool.query('SELECT owner_id FROM events WHERE id=$1', [String(eventId)]);
      if (!event.rowCount) return { error: 'not_found' };
      if (event.rows[0].owner_id && String(event.rows[0].owner_id) === String(reporterId)) return { error: 'own_event' };
      const id = 'report_' + crypto.randomUUID();
      try {
        await this.pool.query('INSERT INTO event_reports (id,event_id,reporter_id,reason,note) VALUES ($1,$2,$3,$4,$5)', [id,String(eventId),String(reporterId),reason,note]);
      } catch (error) { if (error.code === '23505') return { error: 'duplicate' }; throw error; }
      const count = Number((await this.pool.query("SELECT COUNT(DISTINCT reporter_id) AS count FROM event_reports WHERE event_id=$1 AND status='pending'", [String(eventId)])).rows[0].count);
      const threshold = Math.max(1, Number(process.env.REPORT_HIDE_THRESHOLD) || 3);
      if (count >= threshold) await this.pool.query("UPDATE events SET status='hidden',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status <> 'archived'", [String(eventId)]);
      return { id, autoHidden: count >= threshold };
    }
    const event = this.fallbackData.events.find(item => String(item.id) === String(eventId));
    if (!event) return { error: 'not_found' };
    if (event.ownerId && String(event.ownerId) === String(reporterId)) return { error: 'own_event' };
    if (this.fallbackData.event_reports.some(report => report.eventId === String(eventId) && report.reporterId === String(reporterId))) return { error: 'duplicate' };
    const report = { id: 'report_' + crypto.randomUUID(), eventId: String(eventId), reporterId: String(reporterId), reason, note, status: 'pending', createdAt: new Date().toISOString() };
    this.fallbackData.event_reports.push(report);
    const count = this.fallbackData.event_reports.filter(item => item.eventId === String(eventId) && item.status === 'pending').length;
    const autoHidden = count >= Math.max(1, Number(process.env.REPORT_HIDE_THRESHOLD) || 3);
    if (autoHidden && event.status !== 'archived') event.status = 'hidden';
    this.saveFallback(); return { id: report.id, autoHidden };
  }

  async listEventReports() {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("SELECT r.id,r.event_id,r.reason,r.note,r.status,r.created_at,e.title,e.owner_id,e.organizer,COUNT(*) OVER(PARTITION BY r.event_id) AS report_count FROM event_reports r JOIN events e ON e.id=r.event_id WHERE r.status='pending' ORDER BY r.created_at");
      return result.rows.map(row => ({ id: row.id, eventId: row.event_id, reason: row.reason, note: row.note, status: row.status, createdAt: row.created_at, title: row.title, organizer: row.organizer, reportCount: Number(row.report_count) }));
    }
    return this.fallbackData.event_reports.filter(report => report.status === 'pending').map(report => {
      const event = this.fallbackData.events.find(item => String(item.id) === report.eventId);
      return { id: report.id, eventId: report.eventId, reason: report.reason, note: report.note, status: report.status, createdAt: report.createdAt, title: event?.title || 'Removed event', organizer: event?.organizer || '', reportCount: this.fallbackData.event_reports.filter(item => item.eventId === report.eventId && item.status === 'pending').length };
    });
  }

  async reviewEventReport(id, action, reason = '') {
    const status = action === 'dismiss' ? 'dismissed' : action === 'hide' ? 'hidden' : 'organizer_restricted';
    if (this.mode === 'postgres') {
      const result = await this.pool.query('UPDATE event_reports SET status=$2,note=CASE WHEN $3=\'\' THEN note ELSE note || E\'\\nModerator: \' || $3 END,reviewed_at=CURRENT_TIMESTAMP WHERE id=$1 AND status=\'pending\' RETURNING event_id', [String(id), status, reason]);
      if (!result.rowCount) return false;
      const eventId = result.rows[0].event_id;
      if (action === 'hide') await this.pool.query("UPDATE events SET status='hidden',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [eventId]);
      if (action === 'restrict_organizer') await this.pool.query('UPDATE users SET organization_banned=TRUE,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT owner_id FROM events WHERE id=$1)', [eventId]);
      return true;
    }
    const report = this.fallbackData.event_reports.find(item => item.id === String(id) && item.status === 'pending');
    if (!report) return false;
    report.status = status; report.reviewedAt = new Date().toISOString(); if (reason) report.moderatorReason = reason;
    const event = this.fallbackData.events.find(item => String(item.id) === report.eventId);
    if (event && action === 'hide') event.status = 'hidden';
    if (event && action === 'restrict_organizer' && event.ownerId) {
      const owner = this.fallbackData.users.find(user => String(user.id) === String(event.ownerId));
      if (owner) owner.organizationBanned = true;
    }
    this.saveFallback(); return true;
  }

  async getEvents({ status = 'approved', category, search, urgency, lat, lng, radiusKm }) {
    if (this.mode === 'postgres') {
      let query = `
        SELECT e.*, 
               ec.contact, ec.email as contact_email, ec.org_type,
               u.organization_banned
        FROM events e
        LEFT JOIN event_contacts ec ON e.id = ec.event_id
        LEFT JOIN users u ON e.owner_id = u.id
        WHERE (u.organization_banned IS NULL OR u.organization_banned = FALSE)
      `;
      if (status !== 'all') query += ` AND e.status NOT IN ('archived','hidden') AND ((e.date + e.end_time::time) AT TIME ZONE 'Asia/Kolkata') > CURRENT_TIMESTAMP`;
      const params = [];

      if (status && status !== 'all') {
        params.push(status);
        query += ` AND e.status = $${params.length}`;
      }

      if (category && category !== 'all') {
        params.push(category);
        query += ` AND e.category = $${params.length}`;
      }

      if (urgency && urgency !== 'all') {
        params.push(urgency);
        query += ` AND e.urgency = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(e.title) LIKE $${params.length} OR LOWER(e.city) LIKE $${params.length} OR LOWER(e.state) LIKE $${params.length} OR LOWER(e.district) LIKE $${params.length} OR LOWER(e.organizer) LIKE $${params.length} OR LOWER(e.address) LIKE $${params.length})`;
      }

      query += ` ORDER BY e.created_at DESC`;

      const res = await this.pool.query(query, params);
      let events = res.rows.map(this.formatPostgresEvent);

      if (lat != null && lng != null && radiusKm) {
        events = events.filter(ev => {
          const d = haversineDistance(Number(lat), Number(lng), ev.lat, ev.lng);
          ev.distanceKm = d;
          return d <= radiusKm;
        });
      }

      return events;
    } else {
      let list = this.fallbackData.events.filter(e => {
        // Exclude banned organizers
        if (e.ownerId) {
          const owner = this.fallbackData.users.find(u => u.id === e.ownerId);
          if (owner && owner.organizationBanned) return false;
        }

        if (status !== 'all') {
          if (['archived', 'hidden'].includes(e.status)) return false;
          const endsAt = Date.parse(`${e.date}T${e.endTime || '23:59'}:00+05:30`);
          if (Number.isFinite(endsAt) && endsAt <= Date.now()) return false;
        }

        if (status && status !== 'all' && e.status !== status) return false;
        if (category && category !== 'all' && e.category !== category) return false;
        if (urgency && urgency !== 'all' && e.urgency !== urgency) return false;
        if (search && search.trim()) {
          const s = search.trim().toLowerCase();
          const match =
            (e.title && e.title.toLowerCase().includes(s)) ||
            (e.city && e.city.toLowerCase().includes(s)) ||
            (e.state && e.state.toLowerCase().includes(s)) ||
            (e.district && e.district.toLowerCase().includes(s)) ||
            (e.organizer && e.organizer.toLowerCase().includes(s)) ||
            (e.address && e.address.toLowerCase().includes(s));
          if (!match) return false;
        }
        return true;
      });

      if (lat != null && lng != null && radiusKm) {
        list = list.filter(ev => {
          const d = haversineDistance(Number(lat), Number(lng), ev.lat, ev.lng);
          ev.distanceKm = d;
          return d <= radiusKm;
        });
      }

      return list;
    }
  }

  async getEventById(id) {
    if (this.mode === 'postgres') {
      const query = `
        SELECT e.*, 
               ec.contact, ec.email as contact_email, ec.org_type,
               u.organization_banned
        FROM events e
        LEFT JOIN event_contacts ec ON e.id = ec.event_id
        LEFT JOIN users u ON e.owner_id = u.id
        WHERE e.id = $1
      `;
      const res = await this.pool.query(query, [String(id)]);
      if (res.rows.length === 0) return null;
      const event = this.formatPostgresEvent(res.rows[0]);
      if (!['hidden', 'archived'].includes(event.status) && Date.parse(`${event.date}T${event.endTime || '23:59'}:00+05:30`) <= Date.now()) event.status = 'archived';
      return event;
    } else {
      const ev = this.fallbackData.events.find(e => String(e.id) === String(id));
      if (!ev) return null;
      const contact = this.fallbackData.event_contacts[id] || null;
      const event = { ...ev, contactInfo: contact };
      if (!['hidden', 'archived'].includes(event.status) && Date.parse(`${event.date}T${event.endTime || '23:59'}:00+05:30`) <= Date.now()) event.status = 'archived';
      return event;
    }
  }

  async createEvent(eventData, contactData, ownerId = null) {
    const id = eventData.id || 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const formattedEvent = {
      id: String(id),
      ownerId: ownerId,
      title: eventData.title,
      category: eventData.category,
      organizer: eventData.organizer,
      verified: Boolean(eventData.verified),
      city: eventData.city,
      state: eventData.state || null,
      district: eventData.district || null,
      address: eventData.address,
      pincode: eventData.pincode ? String(eventData.pincode) : null,
      lat: Number(eventData.lat),
      lng: Number(eventData.lng),
      date: eventData.date,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      volunteersNeeded: Math.max(1, Number(eventData.volunteersNeeded) || 50),
      volunteersJoined: Number(eventData.volunteersJoined) || 0,
      urgency: eventData.urgency || 'upcoming',
      description: eventData.description || '',
      donationLink: eventData.donationLink || null,
      tags: Array.isArray(eventData.tags) ? eventData.tags : [eventData.category],
      status: eventData.status || 'approved',
      notifiedCount: 0,
      createdAt: now,
      updatedAt: now
    };

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO events (id, owner_id, title, category, organizer, verified, city, state, district, address, pincode, lat, lng, date, start_time, end_time, volunteers_needed, volunteers_joined, urgency, description, donation_link, tags, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
        [
          formattedEvent.id, ownerId, formattedEvent.title, formattedEvent.category,
          formattedEvent.organizer, formattedEvent.verified, formattedEvent.city,
          formattedEvent.state, formattedEvent.district, formattedEvent.address, formattedEvent.pincode, formattedEvent.lat, formattedEvent.lng,
          formattedEvent.date, formattedEvent.startTime, formattedEvent.endTime,
          formattedEvent.volunteersNeeded, formattedEvent.volunteersJoined,
          formattedEvent.urgency, formattedEvent.description, formattedEvent.donationLink,
          formattedEvent.tags, formattedEvent.status, now, now
        ]
      );

      if (contactData) {
        await this.pool.query(
          `INSERT INTO event_contacts (event_id, owner_id, org_type, contact, email, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (event_id) DO UPDATE SET contact = $4, email = $5, org_type = $3`,
          [formattedEvent.id, ownerId, contactData.orgType || null, contactData.contact || '', contactData.email || '', now]
        );
      }
    } else {
      this.fallbackData.events.unshift(formattedEvent);
      if (contactData) {
        this.fallbackData.event_contacts[formattedEvent.id] = {
          orgType: contactData.orgType || null,
          contact: contactData.contact || '',
          email: contactData.email || '',
          createdAt: now
        };
      }
      this.saveFallback();
    }

    // Process notification receipts for users opted in within 1 km
    await this.generateNearbyNotificationReceipts(formattedEvent, 1.0);

    return formattedEvent;
  }

  async updateEventStatus(id, patch) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      const allowed = ['status', 'urgency', 'volunteers_joined'];
      const setClauses = ['updated_at = $1'];
      const params = [now, String(id)];

      if (patch.status !== undefined) {
        params.push(patch.status);
        setClauses.push(`status = $${params.length}`);
      }
      if (patch.urgency !== undefined) {
        params.push(patch.urgency);
        setClauses.push(`urgency = $${params.length}`);
      }
      if (patch.volunteersJoined !== undefined) {
        params.push(Number(patch.volunteersJoined));
        setClauses.push(`volunteers_joined = $${params.length}`);
      }

      await this.pool.query(
        `UPDATE events SET ${setClauses.join(', ')} WHERE id = $2`,
        params
      );
      return await this.getEventById(id);
    } else {
      const ev = this.fallbackData.events.find(e => String(e.id) === String(id));
      if (!ev) return null;
      if (patch.status !== undefined) ev.status = patch.status;
      if (patch.urgency !== undefined) ev.urgency = patch.urgency;
      if (patch.volunteersJoined !== undefined) ev.volunteersJoined = Number(patch.volunteersJoined);
      ev.updatedAt = now;
      this.saveFallback();
      return ev;
    }
  }

  async deleteEvent(id) {
    if (this.mode === 'postgres') {
      await this.pool.query('DELETE FROM events WHERE id = $1', [String(id)]);
      return true;
    } else {
      const idx = this.fallbackData.events.findIndex(e => String(e.id) === String(id));
      if (idx !== -1) {
        this.fallbackData.events.splice(idx, 1);
        delete this.fallbackData.event_contacts[id];
        this.saveFallback();
        return true;
      }
      return false;
    }
  }

  async joinEvent(id, user = null) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `UPDATE events SET volunteers_joined = volunteers_joined + 1, updated_at = $1 WHERE id = $2 RETURNING volunteers_joined`,
        [now, String(id)]
      );
      if (user) {
        await this.pool.query(
          `INSERT INTO volunteer_applications (id, event_id, user_id, applicant_name, applicant_phone, applicant_email, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'registered', $7)
           ON CONFLICT (event_id, user_id) DO NOTHING`,
          ['app_' + Date.now(), String(id), user.id, user.name, user.phone, user.email, now]
        );
      }
      return res.rows[0]?.volunteers_joined || 1;
    } else {
      const ev = this.fallbackData.events.find(e => String(e.id) === String(id));
      if (ev) {
        ev.volunteersJoined = (ev.volunteersJoined || 0) + 1;
        ev.updatedAt = now;
        if (user) {
          this.fallbackData.volunteer_applications.push({
            id: 'app_' + Date.now(),
            eventId: String(id),
            userId: user.id,
            applicantName: user.name,
            applicantPhone: user.phone,
            applicantEmail: user.email,
            status: 'registered',
            createdAt: now
          });
        }
        this.saveFallback();
        return ev.volunteersJoined;
      }
      return 1;
    }
  }

  async getContact(id) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM event_contacts WHERE event_id = $1', [String(id)]);
      if (res.rows.length === 0) return null;
      return {
        orgType: res.rows[0].org_type,
        contact: res.rows[0].contact,
        email: res.rows[0].email,
        createdAt: res.rows[0].created_at
      };
    } else {
      return this.fallbackData.event_contacts[String(id)] || null;
    }
  }

  // ==================== USER ACCOUNTS & AUTH ====================

  async findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const phoneClean = identifier.trim();

    if (this.mode === 'postgres') {
      const query = `
        SELECT * FROM users 
        WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR phone = $2
      `;
      const res = await this.pool.query(query, [clean, phoneClean]);
      if (res.rows.length === 0) return null;
      return this.formatPostgresUser(res.rows[0]);
    } else {
      const user = this.fallbackData.users.find(u => 
        u.email.toLowerCase() === clean ||
        u.username.toLowerCase() === clean ||
        u.phone === phoneClean
      );
      return user || null;
    }
  }

  async findUserById(id) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [String(id)]);
      if (res.rows.length === 0) return null;
      return this.formatPostgresUser(res.rows[0]);
    } else {
      return this.fallbackData.users.find(u => String(u.id) === String(id)) || null;
    }
  }

  async createUser({ name, username, email, phone, passwordHash, notificationLat, notificationLng, bloodGroup, homeCity }) {
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const user = {
      id,
      name,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      emailVerified: true,
      phone: phone.trim(),
      phoneVerified: true,
      passwordHash,
      bloodGroup: bloodGroup || null,
      lastDonationDate: null,
      donationCooldownDays: null,
      donationReminderSentDate: null,
      leaderboardOptOut: false,
      homeCity: homeCity || null,
      notificationLat: notificationLat || null,
      notificationLng: notificationLng || null,
      notificationsEnabled: true,
      pushTokens: [],
      subscriptionStatus: 'free',
      organizationBanned: false,
      falseAlarmCount: 0,
      isAdmin: false,
      createdAt: now,
      updatedAt: now
    };

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO users (id, name, username, email, email_verified, phone, phone_verified, password_hash, blood_group, notification_lat, notification_lng, notifications_enabled, subscription_status, organization_banned, false_alarm_count, is_admin, home_city, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          user.id, user.name, user.username, user.email, user.emailVerified,
          user.phone, user.phoneVerified, user.passwordHash, user.bloodGroup, user.notificationLat,
          user.notificationLng, user.notificationsEnabled, user.subscriptionStatus,
          user.organizationBanned, user.falseAlarmCount, user.isAdmin, user.homeCity, now, now
        ]
      );
    } else {
      this.fallbackData.users.push(user);
      this.saveFallback();
    }

    return user;
  }

  async updateUserLocation(userId, lat, lng) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      await this.pool.query(
        `UPDATE users SET notification_lat = $1, notification_lng = $2, updated_at = $3 WHERE id = $4`,
        [Number(lat), Number(lng), now, String(userId)]
      );
    } else {
      const u = this.fallbackData.users.find(x => String(x.id) === String(userId));
      if (u) {
        u.notificationLat = Number(lat);
        u.notificationLng = Number(lng);
        u.updatedAt = now;
        this.saveFallback();
      }
    }
  }

  async updateDonorProfile(userId, bloodGroup, lat, lng, city = null, details = {}) {
    const now = new Date().toISOString();
    const age = Number.isFinite(Number(details.age)) ? Number(details.age) : 25;
    const weightKg = Number.isFinite(Number(details.weightKg)) ? Number(details.weightKg) : 60;
    const phone = details.phone ? String(details.phone).trim() : '';
    const availability = details.availability ? String(details.availability).trim() : 'anytime';
    const recentIllnessFree = details.recentIllnessFree !== false;
    const recentTattooFree = details.recentTattooFree !== false;
    const consentAlerts = details.consentAlerts !== false;
    const resolvedCity = city || 'India';

    if (this.mode === 'postgres') {
      await this.pool.query('UPDATE users SET blood_group = $1, notification_lat = $2, notification_lng = $3, home_city=COALESCE($4,home_city), notifications_enabled = TRUE, updated_at = $5 WHERE id = $6', [bloodGroup, Number(lat), Number(lng), city, now, String(userId)]);
      await this.pool.query(
        `INSERT INTO blood_donor_profiles (user_id, blood_group, age, weight_kg, city, lat, lng, phone, availability, recent_illness_free, recent_tattoo_free, consent_alerts, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (user_id) DO UPDATE SET
           blood_group = EXCLUDED.blood_group,
           age = EXCLUDED.age,
           weight_kg = EXCLUDED.weight_kg,
           city = EXCLUDED.city,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           phone = EXCLUDED.phone,
           availability = EXCLUDED.availability,
           recent_illness_free = EXCLUDED.recent_illness_free,
           recent_tattoo_free = EXCLUDED.recent_tattoo_free,
           consent_alerts = EXCLUDED.consent_alerts,
           updated_at = EXCLUDED.updated_at`,
        [String(userId), bloodGroup, age, weightKg, resolvedCity, Number(lat), Number(lng), phone, availability, recentIllnessFree, recentTattooFree, consentAlerts, now]
      );
      const openRequests = (await this.pool.query("SELECT id, requester_id, blood_group, units, hospital, city, lat, lng FROM urgent_blood_requests WHERE status = 'open' AND expires_at > NOW() AND blood_group = $1 AND requester_id <> $2 AND EXISTS(SELECT 1 FROM users u WHERE u.id=$2 AND (u.last_donation_date IS NULL OR u.last_donation_date+COALESCE(u.donation_cooldown_days,90)<=(NOW() AT TIME ZONE 'Asia/Kolkata')::date))", [bloodGroup, String(userId)])).rows;
      const existing = (await this.pool.query('SELECT urgent_request_id FROM notifications WHERE user_id = $1 AND urgent_request_id IS NOT NULL', [String(userId)])).rows;
      const notified = new Set(existing.map(row => String(row.urgent_request_id)));
      for (const request of openRequests) {
        const distance = haversineDistance(Number(lat), Number(lng), Number(request.lat), Number(request.lng));
        if (distance > 25 || notified.has(String(request.id))) continue;
        const cap=await this.pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND urgent_request_id IS NOT NULL AND created_at>=(date_trunc('day',NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')",[String(userId)]);if(cap.rows[0].count>=5)break;
        await this.pool.query('INSERT INTO notifications (id, user_id, urgent_request_id, distance_km, title, message, delivered, created_at) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)', ['notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), String(userId), request.id, distance, `Urgent ${bloodGroup} blood needed`, `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${distance.toFixed(1)} km away).`, now]);
      }
      return;
    }
    const user = this.fallbackData.users.find(item => String(item.id) === String(userId));
    if (!user) return;
    user.bloodGroup = bloodGroup;
    user.notificationLat = Number(lat);
    user.notificationLng = Number(lng);
    if (city) user.homeCity = city;
    user.notificationsEnabled = true;
    user.updatedAt = now;
    const profiles = this.fallbackData.blood_donor_profiles || [];
    const existingIdx = profiles.findIndex(p => String(p.userId) === String(userId));
    const profileRec = { userId: String(userId), bloodGroup, age, weightKg, city: resolvedCity, lat: Number(lat), lng: Number(lng), phone, availability, recentIllnessFree, recentTattooFree, consentAlerts, updatedAt: now };
    if (existingIdx >= 0) profiles[existingIdx] = profileRec;
    else profiles.push(profileRec);
    this.fallbackData.blood_donor_profiles = profiles;
    const notified = new Set(this.fallbackData.notifications.filter(item => String(item.userId) === String(userId) && item.urgentRequestId).map(item => String(item.urgentRequestId)));
    for (const request of this.fallbackData.urgent_blood_requests) {
      if (request.status !== 'open' || new Date(request.expiresAt) <= new Date() || request.bloodGroup !== bloodGroup || String(request.requesterId) === String(userId) || notified.has(String(request.id))) continue;
      if(user.lastDonationDate&&Date.parse(user.lastDonationDate+'T00:00:00')+Number(user.donationCooldownDays||90)*86400000>Date.now())continue;
      if(this.fallbackData.notifications.filter(item=>String(item.userId)===String(userId)&&item.urgentRequestId&&Date.parse(item.createdAt)>=new Date().setHours(0,0,0,0)).length>=5)break;
      const distance = haversineDistance(Number(lat), Number(lng), Number(request.lat), Number(request.lng));
      if (distance > 25) continue;
      this.fallbackData.notifications.push({ id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), userId: String(userId), urgentRequestId: request.id, distanceKm: distance, title: `Urgent ${bloodGroup} blood needed`, message: `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${distance.toFixed(1)} km away).`, delivered: true, createdAt: now });
    }
    this.saveFallback();
  }

  async getDonorProfile(userId) {
    if (this.mode === 'postgres') {
      const { rows } = await this.pool.query(
        `SELECT user_id, blood_group, age, weight_kg, city, lat, lng, phone, availability, recent_illness_free, recent_tattoo_free, consent_alerts, updated_at
         FROM blood_donor_profiles WHERE user_id = $1 LIMIT 1`,
        [String(userId)]
      );
      const r = rows[0];
      if (!r) return null;
      return {
        userId: r.user_id,
        bloodGroup: r.blood_group,
        age: r.age,
        weightKg: r.weight_kg,
        city: r.city,
        lat: Number(r.lat),
        lng: Number(r.lng),
        phone: r.phone || '',
        availability: r.availability,
        recentIllnessFree: r.recent_illness_free,
        recentTattooFree: r.recent_tattoo_free,
        consentAlerts: r.consent_alerts,
        updatedAt: r.updated_at
      };
    }
    return (this.fallbackData.blood_donor_profiles || []).find(p => String(p.userId) === String(userId)) || null;
  }

  async createUrgentBloodRequest(data) {
    const now = new Date();
    const request = {
      id: 'blood_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      requesterId: String(data.requesterId), patientName: data.patientName, bloodGroup: data.bloodGroup,
      units: Number(data.units), hospital: data.hospital, address: data.address, city: data.city,
      lat: Number(data.lat), lng: Number(data.lng), contactPhone: data.contactPhone, details: data.details || '',
      status: 'open', createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
    };
    const compatible={ 'O-':['O-'],'O+':['O-','O+'],'A-':['O-','A-'],'A+':['O-','O+','A-','A+'],'B-':['O-','B-'],'B+':['O-','O+','B-','B+'],'AB-':['O-','A-','B-','AB-'],'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+'] };
    const acceptedGroups=compatible[request.bloodGroup]||[request.bloodGroup];
    const donors = this.mode === 'postgres'
      ? (await this.pool.query(`SELECT u.id,u.blood_group,u.notification_lat,u.notification_lng,u.last_donation_date,u.donation_cooldown_days,(SELECT COUNT(*) FROM urgent_blood_offers o WHERE o.donor_id=u.id AND o.accepted_at>=NOW()-INTERVAL '90 days') AS responsiveness FROM users u WHERE u.notifications_enabled=TRUE AND u.blood_group=ANY($1::varchar[]) AND u.notification_lat IS NOT NULL AND u.notification_lng IS NOT NULL AND u.id<>$2 AND (u.last_donation_date IS NULL OR u.last_donation_date+COALESCE(u.donation_cooldown_days,90)<=(NOW() AT TIME ZONE 'Asia/Kolkata')::date)`, [acceptedGroups, request.requesterId])).rows
      : this.fallbackData.users.filter(user => user.notificationsEnabled && acceptedGroups.includes(user.bloodGroup) && user.notificationLat != null && user.notificationLng != null && String(user.id) !== request.requesterId && (!user.lastDonationDate || Date.parse(user.lastDonationDate+'T00:00:00')+Number(user.donationCooldownDays||90)*86400000<=Date.now()));
    const matches = donors.map(user => {
      const lat = user.notification_lat ?? user.notificationLat;
      const lng = user.notification_lng ?? user.notificationLng;
      const group=user.blood_group??user.bloodGroup;
      const distance=haversineDistance(Number(lat),Number(lng),request.lat,request.lng);
      const responsiveness=Number(user.responsiveness)||this.fallbackData.urgent_blood_offers.filter(offer=>String(offer.donorId)===String(user.id)&&Date.parse(offer.acceptedAt||offer.createdAt)>Date.now()-90*86400000).length;
      return { id:user.id,group,distance,compatible:group!==request.bloodGroup,responsiveness };
    }).filter(user => user.distance <= 25).sort((a,b)=>Number(a.compatible)-Number(b.compatible)||b.responsiveness-a.responsiveness||a.distance-b.distance).slice(0,10);
    request.matchingWave=1;request.lastWaveAt=now.toISOString();

    if (this.mode === 'postgres') {
      await this.pool.query(`INSERT INTO urgent_blood_requests (id, requester_id, patient_name, blood_group, units, hospital, address, city, lat, lng, contact_phone, details, status, created_at, expires_at,matching_wave,last_wave_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open',$13,$14,1,$13)`, [request.id, request.requesterId, request.patientName, request.bloodGroup, request.units, request.hospital, request.address, request.city, request.lat, request.lng, request.contactPhone, request.details, request.createdAt, request.expiresAt]);
      for (const donor of matches) {const capped=await this.pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND urgent_request_id IS NOT NULL AND created_at>=CURRENT_DATE",[donor.id]);if(capped.rows[0].count>=5)continue;await this.pool.query(`INSERT INTO notifications (id, user_id, urgent_request_id, distance_km, title, message, delivered, created_at) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)`, ['notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), donor.id, request.id, donor.distance, `${donor.compatible?'Compatible':'Matching'} ${request.bloodGroup} blood needed`, `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${donor.distance.toFixed(1)} km away). ${donor.compatible?`Your ${donor.group} group is compatible.`:'Same blood group.'}`, request.createdAt]);}
    } else {
      this.fallbackData.urgent_blood_requests.push(request);
      for (const donor of matches) {const count=this.fallbackData.notifications.filter(n=>String(n.userId)===String(donor.id)&&n.urgentRequestId&&Date.parse(n.createdAt)>=new Date().setHours(0,0,0,0)).length;if(count>=5)continue;this.fallbackData.notifications.push({ id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), userId: donor.id, urgentRequestId: request.id, distanceKm: donor.distance, title: `${donor.compatible?'Compatible':'Matching'} ${request.bloodGroup} blood needed`, message: `${request.units} unit(s) requested at ${request.hospital}, ${request.city} (${donor.distance.toFixed(1)} km away). ${donor.compatible?`Your ${donor.group} group is compatible.`:'Same blood group.'}`, delivered: true, createdAt: request.createdAt });}
      this.saveFallback();
    }
    return { ...request, notifiedDonors: matches.length };
  }

  async processUrgentBloodWaves(){
    const now=Date.now(),requests=this.mode==='postgres'?(await this.pool.query("SELECT * FROM urgent_blood_requests WHERE status='open' AND expires_at>NOW() AND matching_wave<3 AND last_wave_at<NOW()-INTERVAL '15 minutes' AND NOT EXISTS(SELECT 1 FROM urgent_blood_offers o WHERE o.request_id=urgent_blood_requests.id)")).rows:this.fallbackData.urgent_blood_requests.filter(r=>r.status==='open'&&Date.parse(r.expiresAt)>now&&Number(r.matchingWave||1)<3&&Date.parse(r.lastWaveAt||r.createdAt)<now-15*60000&&!this.fallbackData.urgent_blood_offers.some(o=>o.requestId===r.id));
    for(const raw of requests){const r={id:raw.id,bloodGroup:raw.blood_group??raw.bloodGroup,requesterId:raw.requester_id??raw.requesterId,units:raw.units,hospital:raw.hospital,city:raw.city,lat:Number(raw.lat),lng:Number(raw.lng),matchingWave:Number(raw.matching_wave??raw.matchingWave??1)};const wave=r.matchingWave+1,radius=wave===2?50:100,groups=({'O-':['O-'],'O+':['O-','O+'],'A-':['O-','A-'],'A+':['O-','O+','A-','A+'],'B-':['O-','B-'],'B+':['O-','O+','B-','B+'],'AB-':['O-','A-','B-','AB-'],'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+']})[r.bloodGroup]||[r.bloodGroup];let candidates=this.mode==='postgres'?(await this.pool.query(`SELECT id,blood_group,notification_lat,notification_lng FROM users u WHERE notifications_enabled=TRUE AND blood_group=ANY($1::varchar[]) AND notification_lat IS NOT NULL AND notification_lng IS NOT NULL AND id<>$3 AND (last_donation_date IS NULL OR last_donation_date+COALESCE(donation_cooldown_days,90)<=(NOW() AT TIME ZONE 'Asia/Kolkata')::date) AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=u.id AND n.urgent_request_id=$2)`,[groups,r.id,r.requesterId])).rows:this.fallbackData.users.filter(u=>u.notificationsEnabled&&groups.includes(u.bloodGroup)&&String(u.id)!==String(r.requesterId)&&u.notificationLat!=null&&u.notificationLng!=null&&!this.fallbackData.notifications.some(n=>String(n.userId)===String(u.id)&&n.urgentRequestId===r.id)&&(!u.lastDonationDate||Date.parse(u.lastDonationDate+'T00:00:00')+Number(u.donationCooldownDays||90)*86400000<=now));candidates=candidates.map(u=>{const distance=haversineDistance(Number(u.notification_lat??u.notificationLat),Number(u.notification_lng??u.notificationLng),r.lat,r.lng),responsiveness=this.mode==='postgres'?0:this.fallbackData.urgent_blood_offers.filter(o=>String(o.donorId)===String(u.id)&&Date.parse(o.acceptedAt||o.createdAt)>now-90*86400000).length;return{id:u.id,group:u.blood_group??u.bloodGroup,distance,responsiveness};}).filter(u=>u.distance<=radius).sort((a,b)=>Number(a.group!==r.bloodGroup)-Number(b.group!==r.bloodGroup)||b.responsiveness-a.responsiveness||a.distance-b.distance).slice(0,10);for(const donor of candidates){if(this.mode==='postgres'){const cap=await this.pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND urgent_request_id IS NOT NULL AND created_at>=(date_trunc('day',NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')",[donor.id]);if(cap.rows[0].count>=5)continue;await this.pool.query('INSERT INTO notifications(id,user_id,urgent_request_id,distance_km,title,message,delivered) VALUES($1,$2,$3,$4,$5,$6,TRUE)',['notif_'+crypto.randomUUID(),donor.id,r.id,donor.distance,`${donor.group===r.bloodGroup?'Matching':'Compatible'} ${r.bloodGroup} blood needed`,`${r.units} unit(s) at ${r.hospital}, ${r.city} (${donor.distance.toFixed(1)} km away). ${donor.group===r.bloodGroup?'Same blood group.':`Your ${donor.group} group is compatible.`}`]);}else{const cap=this.fallbackData.notifications.filter(n=>String(n.userId)===String(donor.id)&&n.urgentRequestId&&Date.parse(n.createdAt)>=new Date().setHours(0,0,0,0)).length;if(cap<5)this.fallbackData.notifications.push({id:'notif_'+crypto.randomUUID(),userId:String(donor.id),urgentRequestId:r.id,distanceKm:donor.distance,title:`${donor.group===r.bloodGroup?'Matching':'Compatible'} ${r.bloodGroup} blood needed`,message:`${r.units} unit(s) at ${r.hospital}, ${r.city} (${donor.distance.toFixed(1)} km away).`,createdAt:new Date().toISOString(),delivered:true});}}
      if(this.mode==='postgres')await this.pool.query('UPDATE urgent_blood_requests SET matching_wave=$2,last_wave_at=NOW() WHERE id=$1',[r.id,wave]);else{const current=this.fallbackData.urgent_blood_requests.find(x=>x.id===r.id);current.matchingWave=wave;current.lastWaveAt=new Date().toISOString();this.saveFallback();}}
  }

  async listUrgentBloodRequests() {
    const requests = this.mode === 'postgres'
      ? (await this.pool.query("SELECT id, requester_id, patient_name, blood_group, units, hospital, address, city, lat, lng, details, status, created_at, expires_at FROM urgent_blood_requests WHERE status = 'open' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 100")).rows
      : this.fallbackData.urgent_blood_requests.filter(request => request.status === 'open' && new Date(request.expiresAt) > new Date());
    return requests.map(row => ({ id: row.id, requesterId: row.requester_id ?? row.requesterId, patientName: row.patient_name ?? row.patientName, bloodGroup: row.blood_group ?? row.bloodGroup, units: row.units, hospital: row.hospital, address: row.address, city: row.city, lat: Number(row.lat), lng: Number(row.lng), details: row.details || '', status: row.status, createdAt: row.created_at ?? row.createdAt, expiresAt: row.expires_at ?? row.expiresAt }));
  }

  async closeUrgentBloodRequest(requestId, requesterId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("UPDATE urgent_blood_requests SET status = 'closed' WHERE id = $1 AND requester_id = $2 AND status = 'open' RETURNING id", [String(requestId), String(requesterId)]);
      return result.rowCount > 0;
    }
    const request = this.fallbackData.urgent_blood_requests.find(item => item.id === String(requestId) && String(item.requesterId) === String(requesterId) && item.status === 'open');
    if (!request) return false;
    request.status = 'closed';
    this.saveFallback();
    return true;
  }

  async expressBloodDonationInterest(requestId, donor) {
    const compatible={ 'O-':['O-'],'O+':['O-','O+'],'A-':['O-','A-'],'A+':['O-','O+','A-','A+'],'B-':['O-','B-'],'B+':['O-','O+','B-','B+'],'AB-':['O-','A-','B-','AB-'],'AB+':['O-','O+','A-','A+','B-','B+','AB-','AB+'] };
    const eligible=!donor.lastDonationDate||Date.parse(String(donor.lastDonationDate).slice(0,10)+'T00:00:00')+Number(donor.donationCooldownDays||90)*86400000<=Date.now();
    if(!eligible)return null;
    if (this.mode === 'postgres') {
      const result = await this.pool.query("SELECT requester_id, blood_group FROM urgent_blood_requests WHERE id = $1 AND status = 'open' AND expires_at > NOW()", [String(requestId)]);
      if (!result.rows[0]) return null;
      if (!(compatible[result.rows[0].blood_group]||[result.rows[0].blood_group]).includes(donor.bloodGroup) || String(result.rows[0].requester_id) === String(donor.id)) return null;
      const offer = await this.pool.query('INSERT INTO urgent_blood_offers (id, request_id, donor_id, created_at,accepted_at) VALUES ($1,$2,$3,$4,$4) ON CONFLICT (request_id, donor_id) DO NOTHING RETURNING id', ['offer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), String(requestId), String(donor.id), new Date().toISOString()]);
      if (!offer.rows[0]) return { success: true, alreadyResponded: true };
      await this.pool.query('INSERT INTO notifications (id, user_id, urgent_request_id, title, message, delivered, created_at) VALUES ($1,$2,$3,$4,$5,TRUE,$6)', ['notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), result.rows[0].requester_id, String(requestId), 'A matching donor accepted', `${donor.name} (${donor.bloodGroup}) accepted. Contact: ${donor.phone}`, new Date().toISOString()]);
      return { success: true };
    }
    const request = this.fallbackData.urgent_blood_requests.find(item => item.id === String(requestId) && item.status === 'open' && new Date(item.expiresAt) > new Date());
    if (!request || !(compatible[request.bloodGroup]||[request.bloodGroup]).includes(donor.bloodGroup) || String(request.requesterId) === String(donor.id)) return null;
    if (this.fallbackData.urgent_blood_offers.some(offer => offer.requestId === request.id && String(offer.donorId) === String(donor.id))) return { success: true, alreadyResponded: true };
    this.fallbackData.urgent_blood_offers.push({ id: 'offer_' + Date.now(), requestId: request.id, donorId: String(donor.id), createdAt: new Date().toISOString(), acceptedAt:new Date().toISOString() });
    this.fallbackData.notifications.push({ id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), userId: request.requesterId, urgentRequestId: request.id, title: 'A matching donor accepted', message: `${donor.name} (${donor.bloodGroup}) accepted. Contact: ${donor.phone}`, delivered: true, createdAt: new Date().toISOString() });
    this.saveFallback();
    return { success: true };
  }

  // ==================== REVIEWS & FALSE ALARM BAN ====================

  async getEventReviews(eventId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `SELECT r.id, r.rating, r.outcome, r.comment, r.photos, r.created_at, u.name AS reviewer_name
         FROM event_reviews r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.event_id = $1
         ORDER BY r.created_at DESC`,
        [String(eventId)]
      );
      return result.rows.map(row => ({
        id: row.id,
        rating: Number(row.rating),
        outcome: row.outcome,
        comment: row.comment || '',
        photos: Array.isArray(row.photos) ? row.photos : [],
        createdAt: row.created_at,
        reviewerName: row.reviewer_name || 'Community member'
      }));
    }

    return this.fallbackData.event_reviews
      .filter(review => String(review.eventId) === String(eventId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(review => ({
        id: review.id,
        rating: Number(review.rating),
        outcome: review.outcome,
        comment: review.comment || '',
        photos: Array.isArray(review.photos) ? review.photos : [],
        createdAt: review.createdAt,
        reviewerName: this.fallbackData.users.find(user => String(user.id) === String(review.userId))?.name || 'Community member'
      }));
  }

  async getOrganizerOverview(identifier) {
    const key = String(identifier || '').trim();
    if (!key) return { eventCount: 0, categories: [] };

    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `SELECT COUNT(*) AS event_count, ARRAY_AGG(DISTINCT category) AS categories
         FROM events
         WHERE status IN ('approved', 'completed')
           AND (owner_id = $1 OR LOWER(organizer) = LOWER($1))`,
        [key]
      );
      return {
        eventCount: Number(result.rows[0]?.event_count) || 0,
        categories: Array.isArray(result.rows[0]?.categories) ? result.rows[0].categories : []
      };
    }

    const matching = this.fallbackData.events.filter(event =>
      ['approved', 'completed'].includes(event.status) &&
      (String(event.ownerId || '') === key || String(event.organizer || '').toLowerCase() === key.toLowerCase())
    );
    return {
      eventCount: matching.length,
      categories: [...new Set(matching.map(event => event.category).filter(Boolean))]
    };
  }

  async createReview({ eventId, userId, rating, outcome, comment, photos = [] }) {
    const now = new Date().toISOString();
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const organizerId = event.ownerId || null;
    const reviewId = 'rev_' + Date.now();

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO event_reviews (id, event_id, user_id, organizer_id, rating, outcome, comment, photos, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (event_id, user_id) DO UPDATE SET rating = $5, outcome = $6, comment = $7, photos = $8, created_at = $9`,
        [reviewId, String(eventId), String(userId), organizerId, rating, outcome, comment, JSON.stringify(photos), now]
      );

      // Check false-alarm rule: 2 distinct false-alarm reviews restrict the organizer
      if (outcome === 'false_alarm' && organizerId) {
        const falseAlarmRes = await this.pool.query(
          `SELECT COUNT(DISTINCT user_id) as false_count FROM event_reviews WHERE organizer_id = $1 AND outcome = 'false_alarm'`,
          [organizerId]
        );
        const count = parseInt(falseAlarmRes.rows[0].false_count, 10);
        if (count >= 2) {
          console.warn(`🚨 Organizer ${organizerId} has received ${count} distinct false-alarm reviews! Banning organizer and suspending public events.`);
          await this.pool.query(
            `UPDATE users SET organization_banned = TRUE, false_alarm_count = $1 WHERE id = $2`,
            [count, organizerId]
          );
          await this.pool.query(
            `UPDATE events SET status = 'suspended' WHERE owner_id = $1`,
            [organizerId]
          );
        }
      }
    } else {
      const existingIdx = this.fallbackData.event_reviews.findIndex(r => r.eventId === String(eventId) && r.userId === String(userId));
      const record = { id: reviewId, eventId: String(eventId), userId: String(userId), organizerId, rating, outcome, comment, photos, createdAt: now };
      if (existingIdx !== -1) {
        this.fallbackData.event_reviews[existingIdx] = record;
      } else {
        this.fallbackData.event_reviews.push(record);
      }

      if (outcome === 'false_alarm' && organizerId) {
        const distinctReviewers = new Set(
          this.fallbackData.event_reviews
            .filter(r => r.organizerId === organizerId && r.outcome === 'false_alarm')
            .map(r => r.userId)
        );
        if (distinctReviewers.size >= 2) {
          console.warn(`🚨 Organizer ${organizerId} has received ${distinctReviewers.size} distinct false-alarm reviews. Banning organizer.`);
          const org = this.fallbackData.users.find(u => u.id === organizerId);
          if (org) org.organizationBanned = true;
          this.fallbackData.events.forEach(e => {
            if (e.ownerId === organizerId) e.status = 'suspended';
          });
        }
      }
      this.saveFallback();
    }
  }

  // ==================== VOLUNTEERS & LOCATION TRACKING ====================

  async createVolunteerApplication({ eventId, userId, applicantName, applicantPhone, applicantEmail, trackingConsent }) {
    const ticketCode = `SRV-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
    const ticketCodeHash = crypto.createHash('sha256').update(ticketCode).digest('hex');
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      const existing = await this.pool.query(
        `SELECT id, ticket_code_hash FROM volunteer_applications WHERE event_id = $1 AND applicant_phone = $2 AND status = 'registered' LIMIT 1`,
        [String(eventId), applicantPhone]
      );
      if (existing.rows[0]?.ticket_code_hash) {
        const error = new Error('This mobile number already has a registration for this event.');
        error.code = 'DUPLICATE_EVENT_REGISTRATION';
        throw error;
      }
      if (existing.rows[0]) {
        await this.pool.query(
          `UPDATE volunteer_applications SET applicant_name = $1, applicant_email = $2, ticket_code_hash = $3, phone_verified = TRUE WHERE id = $4`,
          [applicantName, applicantEmail, ticketCodeHash, existing.rows[0].id]
        );
        return { id: existing.rows[0].id, ticketCode, createdAt: now, existingRegistration: true };
      }
    } else if (this.fallbackData.volunteer_applications.some(application =>
      application.eventId === String(eventId) && application.applicantPhone === applicantPhone && application.status === 'registered' && application.ticketCodeHash
    )) {
      const error = new Error('This mobile number already has a registration for this event.');
      error.code = 'DUPLICATE_EVENT_REGISTRATION';
      throw error;
    }
    if (this.mode !== 'postgres') {
      const previousRegistration = this.fallbackData.volunteer_applications.find(application =>
        application.eventId === String(eventId) && application.applicantPhone === applicantPhone && application.status === 'registered'
      );
      if (previousRegistration) {
        previousRegistration.applicantName = applicantName;
        previousRegistration.applicantEmail = applicantEmail;
        previousRegistration.ticketCodeHash = ticketCodeHash;
        previousRegistration.phoneVerified = true;
        previousRegistration.checkedInAt = null;
        this.saveFallback();
        return { id: previousRegistration.id, ticketCode, createdAt: now, existingRegistration: true };
      }
    }
    const id = 'vapp_' + crypto.randomUUID();
    const event = await this.getEventById(eventId);

    if (this.mode === 'postgres') {
      await this.pool.query(
        `INSERT INTO volunteer_applications (id, event_id, user_id, applicant_name, applicant_phone, applicant_email, organizer_id, status, tracking_consent, ticket_code_hash, phone_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered', $8, $9, TRUE, $10)`,
        [id, String(eventId), userId, applicantName, applicantPhone, applicantEmail, event?.ownerId || null, Boolean(trackingConsent), ticketCodeHash, now]
      );
      await this.pool.query(
        'UPDATE events SET volunteers_joined = volunteers_joined + 1, updated_at = $1 WHERE id = $2',
        [now, String(eventId)]
      );
    } else {
      this.fallbackData.volunteer_applications.push({
        id,
        eventId: String(eventId),
        userId,
        applicantName,
        applicantPhone,
        applicantEmail,
        organizerId: event?.ownerId || null,
        status: 'registered',
        trackingConsent: Boolean(trackingConsent),
        ticketCodeHash,
        phoneVerified: true,
        checkedInAt: null,
        trackingLat: null,
        trackingLng: null,
        createdAt: now
      });
      const fallbackEvent = this.fallbackData.events.find(item => String(item.id) === String(eventId));
      if (fallbackEvent) {
        fallbackEvent.volunteersJoined = (fallbackEvent.volunteersJoined || 0) + 1;
        fallbackEvent.updatedAt = now;
      }
      this.saveFallback();
    }
    return { id, ticketCode, createdAt: now };
  }

  async updateVolunteerTracking(applicationId, lat, lng) {
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      // Live location is only sent after volunteer consent
      await this.pool.query(
        `UPDATE volunteer_applications 
         SET tracking_lat = $1, tracking_lng = $2, tracking_updated_at = $3 
         WHERE id = $4 AND tracking_consent = TRUE`,
        [Number(lat), Number(lng), now, String(applicationId)]
      );
    } else {
      const app = this.fallbackData.volunteer_applications.find(a => a.id === String(applicationId));
      if (app && app.trackingConsent) {
        app.trackingLat = Number(lat);
        app.trackingLng = Number(lng);
        app.trackingUpdatedAt = now;
        this.saveFallback();
      }
    }
  }

  async getEventVolunteers(eventId) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT id, applicant_name, applicant_phone, applicant_email, status, tracking_consent, tracking_lat, tracking_lng, tracking_updated_at, ticket_code_hash, phone_verified, checked_in_at, created_at 
         FROM volunteer_applications WHERE event_id = $1 ORDER BY created_at DESC`,
        [String(eventId)]
      );
      return res.rows.map(r => ({
        id: r.id,
        name: r.applicant_name,
        phone: r.applicant_phone,
        email: r.applicant_email,
        status: r.status,
        ticketIssued: Boolean(r.ticket_code_hash),
        phoneVerified: Boolean(r.phone_verified),
        checkedInAt: r.checked_in_at,
        trackingConsent: r.tracking_consent,
        tracking: r.tracking_consent && r.tracking_lat != null ? { lat: r.tracking_lat, lng: r.tracking_lng, updatedAt: r.tracking_updated_at } : null,
        createdAt: r.created_at
      }));
    } else {
      return this.fallbackData.volunteer_applications
        .filter(a => a.eventId === String(eventId))
        .map(a => ({
          id: a.id,
          name: a.applicantName,
          phone: a.applicantPhone,
          email: a.applicantEmail,
          status: a.status,
          ticketIssued: Boolean(a.ticketCodeHash),
          phoneVerified: Boolean(a.phoneVerified),
          checkedInAt: a.checkedInAt || null,
          trackingConsent: a.trackingConsent,
          tracking: a.trackingConsent && a.trackingLat != null ? { lat: a.trackingLat, lng: a.trackingLng, updatedAt: a.trackingUpdatedAt } : null,
          createdAt: a.createdAt
        }));
    }
  }

  async checkInVolunteerByTicket(eventId, ticketCode) {
    const codeHash = crypto.createHash('sha256').update(String(ticketCode)).digest('hex');
    const now = new Date().toISOString();
    if (this.mode === 'postgres') {
      const result = await this.pool.query(
        `UPDATE volunteer_applications
         SET checked_in_at = $1
         WHERE event_id = $2 AND ticket_code_hash = $3 AND checked_in_at IS NULL
         RETURNING applicant_name, applicant_phone, applicant_email, phone_verified, checked_in_at`,
        [now, String(eventId), codeHash]
      );
      if (result.rows[0]) return { status: 'checked_in', ...result.rows[0] };
      const existing = await this.pool.query(
        `SELECT applicant_name, applicant_phone, applicant_email, phone_verified, checked_in_at
         FROM volunteer_applications WHERE event_id = $1 AND ticket_code_hash = $2`,
        [String(eventId), codeHash]
      );
      if (existing.rows[0]?.checked_in_at) return { status: 'already_checked_in', ...existing.rows[0] };
      return null;
    }
    const application = this.fallbackData.volunteer_applications.find(item =>
      item.eventId === String(eventId) && item.ticketCodeHash === codeHash
    );
    if (!application) return null;
    if (application.checkedInAt) return { status: 'already_checked_in', name: application.applicantName, phone: application.applicantPhone, email: application.applicantEmail, phoneVerified: Boolean(application.phoneVerified), checkedInAt: application.checkedInAt };
    application.checkedInAt = now;
    this.saveFallback();
    return { status: 'checked_in', name: application.applicantName, phone: application.applicantPhone, email: application.applicantEmail, phoneVerified: Boolean(application.phoneVerified), checkedInAt: now };
  }

  async getUserVolunteerApplications(userId) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT va.event_id AS id, va.status, va.created_at,
                e.title, e.category, e.organizer, e.date, e.city, e.address
         FROM volunteer_applications va
         LEFT JOIN events e ON e.id = va.event_id
         WHERE va.user_id = $1
         ORDER BY va.created_at DESC`,
        [String(userId)]
      );
      return res.rows.map(row => ({
        id: String(row.id), kind: 'volunteer', status: row.status,
        title: row.title || 'Community event', category: row.category || 'other',
        organizer: row.organizer || '', date: row.date || '', city: row.city || '', address: row.address || '',
        createdAt: row.created_at,
      }));
    }

    const applications = this.fallbackData.volunteer_applications
      .filter(application => String(application.userId || '') === String(userId))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return Promise.all(applications.map(async application => {
      const event = await this.getEventById(application.eventId);
      return {
        id: String(application.eventId), kind: 'volunteer', status: application.status || 'registered',
        title: event?.title || 'Community event', category: event?.category || 'other',
        organizer: event?.organizer || '', date: event?.date || '', city: event?.city || '', address: event?.address || '',
        createdAt: application.createdAt,
      };
    }));
  }

  // ==================== NOTIFICATIONS ====================

  async generateNearbyNotificationReceipts(event, maxDistanceKm = 1.0) {
    const now = new Date().toISOString();
    if (!event || event.lat == null || event.lng == null) return;

    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT id, notification_lat, notification_lng FROM users 
         WHERE notifications_enabled = TRUE AND notification_lat IS NOT NULL AND notification_lng IS NOT NULL`
      );

      for (const u of res.rows) {
        const dist = haversineDistance(u.notification_lat, u.notification_lng, event.lat, event.lng);
        if (dist <= maxDistanceKm) {
          await this.pool.query(
            `INSERT INTO notifications (id, user_id, event_id, distance_km, title, message, delivered, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`,
            [
              'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
              u.id, event.id, dist,
              `🚨 Nearby Event: ${event.title}`,
              `${event.organizer} is hosting ${event.title} approximately ${dist.toFixed(1)} km away.`,
              now
            ]
          );
        }
      }
    } else {
      const users = this.fallbackData.users.filter(u => u.notificationsEnabled && u.notificationLat != null && u.notificationLng != null);
      for (const u of users) {
        const dist = haversineDistance(u.notificationLat, u.notificationLng, event.lat, event.lng);
        if (dist <= maxDistanceKm) {
          this.fallbackData.notifications.push({
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            userId: u.id,
            eventId: event.id,
            distanceKm: dist,
            title: `🚨 Nearby Event: ${event.title}`,
            message: `${event.organizer} is hosting ${event.title} approximately ${dist.toFixed(1)} km away.`,
            delivered: true,
            createdAt: now
          });
        }
      }
      this.saveFallback();
    }
  }

  async getUserNotifications(userId) {
    if (this.mode === 'postgres') {
      const res = await this.pool.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [String(userId)]
      );
      return res.rows;
    } else {
      return this.fallbackData.notifications
        .filter(n => n.userId === String(userId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  // ==================== FORMATTERS ====================

  async saveDonorEligibility(userId, donationDate, cooldownDays) {
    if (this.mode === 'postgres') {
      await this.pool.query('UPDATE users SET last_donation_date=$1,donation_cooldown_days=$2,donation_reminder_sent_date=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$3', [donationDate, cooldownDays, String(userId)]);
    } else {
      const user = this.fallbackData.users.find(item => String(item.id) === String(userId));
      if (!user) return false;
      user.lastDonationDate = donationDate || null; user.donationCooldownDays = cooldownDays || null; user.donationReminderSentDate = null; this.saveFallback();
    }
    return true;
  }

  async recordBloodDonation(userId, donationDate, cooldownDays, city = null) {
    const id = 'don_' + crypto.randomUUID();
    if (this.mode === 'postgres') {
      await this.pool.query('INSERT INTO blood_donations (id,donor_id,donation_date,city,cooldown_days) VALUES ($1,$2,$3,$4,$5)', [id, String(userId), donationDate, city, cooldownDays]);
      await this.saveDonorEligibility(userId, donationDate, cooldownDays);
    } else {
      this.fallbackData.blood_donations.push({ id, donorId: String(userId), donationDate, city, cooldownDays, status: 'pending', confirmedBy: null, confirmedAt: null, reminderSentAt: null, createdAt: new Date().toISOString() });
      await this.saveDonorEligibility(userId, donationDate, cooldownDays);
    }
    return { id, donationDate, status: 'pending' };
  }

  async listDonationsForUser(userId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query('SELECT id,donation_date,status,confirmed_at,created_at FROM blood_donations WHERE donor_id=$1 ORDER BY donation_date DESC', [String(userId)]);
      return result.rows.map(row => ({ id: row.id, donationDate: String(row.donation_date).slice(0,10), status: row.status, confirmedAt: row.confirmed_at, createdAt: row.created_at }));
    }
    return this.fallbackData.blood_donations.filter(item => item.donorId === String(userId)).map(({ id, donationDate, status, confirmedAt, createdAt }) => ({ id, donationDate, status, confirmedAt, createdAt }));
  }

  async confirmBloodDonation(donationId, confirmerId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("UPDATE blood_donations SET status='confirmed',confirmed_by=$2,confirmed_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='pending' AND donor_id<>$2 RETURNING id,donor_id,donation_date", [String(donationId), String(confirmerId)]);
      return result.rows[0] ? { id: result.rows[0].id, donorId: result.rows[0].donor_id, donationDate: String(result.rows[0].donation_date).slice(0,10) } : null;
    }
    const record = this.fallbackData.blood_donations.find(item => item.id === String(donationId) && item.status === 'pending' && item.donorId !== String(confirmerId));
    if (!record) return null;
    record.status = 'confirmed'; record.confirmedBy = String(confirmerId); record.confirmedAt = new Date().toISOString(); this.saveFallback();
    return { id: record.id, donorId: record.donorId, donationDate: record.donationDate };
  }

  async addBloodStock(userId, stock) {
    const id = 'stock_' + crypto.randomUUID();
    if (this.mode === 'postgres') {
      const result = await this.pool.query(`INSERT INTO blood_bank_stock (id,organization_id,city,address,lat,lng,blood_group,need_level)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (organization_id,blood_group) DO UPDATE SET city=$3,address=$4,lat=$5,lng=$6,need_level=$8,updated_at=CURRENT_TIMESTAMP RETURNING id,city,address,lat,lng,blood_group,need_level,updated_at`, [id,String(userId),stock.city,stock.address,stock.lat,stock.lng,stock.bloodGroup,stock.needLevel]);
      const row = result.rows[0]; return { id: row.id, city: row.city, address: row.address, lat: Number(row.lat), lng: Number(row.lng), bloodGroup: row.blood_group, needLevel: row.need_level, updatedAt: row.updated_at };
    }
    const found = this.fallbackData.blood_bank_stock.find(item => item.organizationId === String(userId) && item.bloodGroup === stock.bloodGroup);
    const record = { ...(found || {}), id: found?.id || id, organizationId: String(userId), ...stock, updatedAt: new Date().toISOString() };
    if (found) Object.assign(found, record); else this.fallbackData.blood_bank_stock.push(record);
    this.saveFallback(); return { id: record.id, ...stock, updatedAt: record.updatedAt };
  }

  async listBloodStock({ city, lat, lng, radiusKm } = {}) {
    let rows;
    if (this.mode === 'postgres') {
      const params = [];
      let query = `SELECT s.*,u.name AS organization_name FROM blood_bank_stock s JOIN users u ON u.id=s.organization_id
        WHERE u.verification_status='approved' AND u.organization_type IN ('blood_bank','hospital') AND s.updated_at >= CURRENT_TIMESTAMP - INTERVAL '48 hours'`;
      if (city) { params.push(`%${String(city).toLowerCase()}%`); query += ` AND LOWER(s.city) LIKE $${params.length}`; }
      query += ' ORDER BY s.updated_at DESC';
      rows = (await this.pool.query(query, params)).rows.map(row => ({ id: row.id, organizationId: row.organization_id, organizationName: row.organization_name, city: row.city, address: row.address, lat: Number(row.lat), lng: Number(row.lng), bloodGroup: row.blood_group, needLevel: row.need_level, updatedAt: row.updated_at }));
    } else {
      const verified = new Set(this.fallbackData.users.filter(user => user.verificationStatus === 'approved' && ['blood_bank','hospital'].includes(user.organizationType)).map(user => String(user.id)));
      rows = this.fallbackData.blood_bank_stock.filter(item => verified.has(String(item.organizationId)) && Date.now() - Date.parse(item.updatedAt) < 48 * 60 * 60 * 1000 && (!city || String(item.city).toLowerCase().includes(String(city).toLowerCase()))).map(item => ({ ...item, organizationName: this.fallbackData.users.find(user => String(user.id) === String(item.organizationId))?.name || 'Verified blood bank' }));
    }
    if (lat != null && lng != null && Number.isFinite(Number(radiusKm))) rows = rows.filter(item => haversineDistance(Number(lat), Number(lng), item.lat, item.lng) <= Number(radiusKm));
    return rows;
  }

  async getDonorLeaderboard() {
    if (this.mode === 'postgres') {
      const rows = (await this.pool.query(`SELECT u.id,u.name,COUNT(d.id)::int AS donations FROM users u JOIN blood_donations d ON d.donor_id=u.id
        WHERE d.status='confirmed' AND u.leaderboard_opt_out=FALSE GROUP BY u.id,u.name ORDER BY donations DESC,u.name LIMIT 100`)).rows;
      return rows.map(row => ({ name: row.name, donations: row.donations, badges: this.donationBadges(Number(row.donations)) }));
    }
    const counts = new Map();
    for (const donation of this.fallbackData.blood_donations) if (donation.status === 'confirmed') counts.set(donation.donorId, (counts.get(donation.donorId) || 0) + 1);
    return [...counts.entries()].map(([id, donations]) => {
      const user = this.fallbackData.users.find(item => String(item.id) === id);
      return { name: user?.name || 'Community donor', donations, optedOut: Boolean(user?.leaderboardOptOut), badges: this.donationBadges(donations) };
    }).filter(item => !item.optedOut).map(({ optedOut, ...item }) => item).sort((a,b) => b.donations-a.donations || a.name.localeCompare(b.name)).slice(0,100);
  }

  donationBadges(count) { return [{ threshold: 1, name: 'First donation' },{ threshold: 3, name: '3 donations' },{ threshold: 5, name: '5 donations' },{ threshold: 10, name: '10 donations' }].filter(badge => count >= badge.threshold).map(badge => badge.name); }

  async setLeaderboardOptOut(userId, optOut) {
    if (this.mode === 'postgres') await this.pool.query('UPDATE users SET leaderboard_opt_out=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [Boolean(optOut), String(userId)]);
    else { const user = this.fallbackData.users.find(item => String(item.id) === String(userId)); if (!user) return false; user.leaderboardOptOut = Boolean(optOut); this.saveFallback(); }
    return true;
  }

  async issueDonationCertificate(donationId, donorId) {
    if (this.mode === 'postgres') {
      const donation = await this.pool.query("SELECT d.id,d.donor_id,d.donation_date,u.name FROM blood_donations d JOIN users u ON u.id=d.donor_id WHERE d.id=$1 AND d.donor_id=$2 AND d.status='confirmed'", [String(donationId),String(donorId)]);
      if (!donation.rowCount) return null;
      const existing = await this.pool.query('SELECT id FROM donation_certificates WHERE donation_id=$1', [String(donationId)]);
      const id = existing.rows[0]?.id || `CERT-${crypto.randomUUID().toUpperCase()}`;
      if (!existing.rowCount) await this.pool.query('INSERT INTO donation_certificates (id,donation_id,donor_id) VALUES ($1,$2,$3)', [id,String(donationId),String(donorId)]);
      const row = donation.rows[0]; return { id, donorId: row.donor_id, name: row.name, donationDate: String(row.donation_date).slice(0,10) };
    }
    const donation = this.fallbackData.blood_donations.find(item => item.id === String(donationId) && item.donorId === String(donorId) && item.status === 'confirmed');
    if (!donation) return null;
    let cert = this.fallbackData.donation_certificates.find(item => item.donationId === donation.id);
    if (!cert) { cert = { id: `CERT-${crypto.randomUUID().toUpperCase()}`, donationId: donation.id, donorId: String(donorId), issuedAt: new Date().toISOString() }; this.fallbackData.donation_certificates.push(cert); this.saveFallback(); }
    return { id: cert.id, donorId: String(donorId), name: this.fallbackData.users.find(item => String(item.id) === String(donorId))?.name || 'SERVEO donor', donationDate: donation.donationDate };
  }

  async verifyDonationCertificate(id) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query(`SELECT c.id,u.name,d.donation_date FROM donation_certificates c JOIN users u ON u.id=c.donor_id JOIN blood_donations d ON d.id=c.donation_id WHERE c.id=$1 AND d.status='confirmed'`, [String(id)]);
      const row = result.rows[0]; return row ? { valid: true, name: row.name, donationDate: String(row.donation_date).slice(0,10) } : { valid: false };
    }
    const cert = this.fallbackData.donation_certificates.find(item => item.id === String(id));
    const donation = cert && this.fallbackData.blood_donations.find(item => item.id === cert.donationId && item.status === 'confirmed');
    return donation ? { valid: true, name: this.fallbackData.users.find(item => String(item.id) === cert.donorId)?.name || 'SERVEO donor', donationDate: donation.donationDate } : { valid: false };
  }

  async sendDueDonationReminders() {
    const todayIndia = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0,10);
    if (this.mode === 'postgres') {
      const due = (await this.pool.query(`UPDATE users SET donation_reminder_sent_date=last_donation_date WHERE last_donation_date IS NOT NULL AND donation_cooldown_days IS NOT NULL AND donation_reminder_sent_date IS DISTINCT FROM last_donation_date AND (last_donation_date + donation_cooldown_days) <= $1::date RETURNING id,last_donation_date`, [todayIndia])).rows;
      for (const user of due) {
        const noticeId = `notif_elig_${crypto.createHash('sha256').update(`${user.id}:${user.last_donation_date}`).digest('hex').slice(0,40)}`;
        await this.pool.query('INSERT INTO notifications (id,user_id,title,message,delivered,created_at) VALUES ($1,$2,$3,$4,TRUE,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING', [noticeId,user.id,'You can donate blood again','Your saved donation cooldown has passed. Confirm eligibility with a blood bank before donating.']);
      }
      return due.length;
    }
    let count = 0;
    for (const user of this.fallbackData.users) {
      if (user.lastDonationDate && user.donationCooldownDays && user.donationReminderSentDate !== user.lastDonationDate && Date.parse(`${user.lastDonationDate}T00:00:00Z`) + user.donationCooldownDays * 86400000 <= Date.parse(`${todayIndia}T00:00:00Z`)) {
        user.donationReminderSentDate = user.lastDonationDate;
        const digest = crypto.createHash('sha256').update(`${user.id}:${user.lastDonationDate}`).digest('hex').slice(0,40);
        if (!this.fallbackData.notifications.some(item => item.id === `notif_elig_${digest}`)) this.fallbackData.notifications.push({ id: `notif_elig_${digest}`, userId: user.id, title: 'You can donate blood again', message: 'Your saved donation cooldown has passed. Confirm eligibility with a blood bank before donating.', delivered: true, createdAt: new Date().toISOString() });
        count++;
      }
    }
    if (count) this.saveFallback(); return count;
  }

  async createFoodPost(data) {
    const record = { id: `food_${crypto.randomUUID()}`, restaurantId: String(data.restaurantId), itemDescription: data.itemDescription, approximateMeals: Number(data.approximateMeals), cookedAt: data.cookedAt, pickupBy: data.pickupBy, address: data.address, city: data.city, lat: Number(data.lat), lng: Number(data.lng), contact: data.contact, status: 'posted', claimedBy: null, restaurantConfirmedAt: null, recipientConfirmedAt: null, createdAt: new Date().toISOString() };
    if (this.mode === 'postgres') {
      await this.pool.query(`INSERT INTO food_posts (id,restaurant_id,item_description,approximate_meals,cooked_at,pickup_by,address,city,lat,lng,contact,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'posted')`, [record.id,record.restaurantId,record.itemDescription,record.approximateMeals,record.cookedAt,record.pickupBy,record.address,record.city,record.lat,record.lng,record.contact]);
    } else { this.fallbackData.food_posts.unshift(record); this.saveFallback(); }
    await this.notifyFoodPostWave(record.id);
    return this.publicFoodPost(record);
  }

  publicFoodPost(record) {
    const safeHours = Math.max(1, Math.min(12, Number(process.env.FOOD_SAFE_HOURS) || 4));
    return { id: record.id, itemDescription: record.itemDescription, approximateMeals: Number(record.approximateMeals), cookedAt: record.cookedAt, pickupBy: record.pickupBy, safeUntil: new Date(Date.parse(record.cookedAt) + safeHours * 3600000).toISOString(), safeHours, address: record.address, city: record.city, lat: Number(record.lat), lng: Number(record.lng), status: record.status, createdAt: record.createdAt };
  }

  async expireFoodPosts() {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("UPDATE food_posts SET status='expired' WHERE status IN ('posted','claimed','picked_up') AND pickup_by <= CURRENT_TIMESTAMP");
      return result.rowCount;
    }
    let count = 0;
    for (const post of this.fallbackData.food_posts) if (['posted','claimed','picked_up'].includes(post.status) && Date.parse(post.pickupBy) <= Date.now()) { post.status = 'expired'; count++; }
    if (count) this.saveFallback(); return count;
  }

  async listFoodPosts({ city, lat, lng, radiusKm } = {}) {
    await this.expireFoodPosts();
    let posts;
    if (this.mode === 'postgres') {
      const params = [];
      let query = "SELECT p.*,u.name AS restaurant_name FROM food_posts p JOIN users u ON u.id=p.restaurant_id WHERE p.status IN ('posted','claimed','picked_up') AND p.pickup_by > CURRENT_TIMESTAMP";
      if (city) { params.push(`%${String(city).toLowerCase()}%`); query += ` AND LOWER(city) LIKE $${params.length}`; }
      query += ' ORDER BY p.pickup_by ASC';
      posts = (await this.pool.query(query, params)).rows.map(row => ({ id: row.id, restaurantId: row.restaurant_id, restaurantName: row.restaurant_name, itemDescription: row.item_description, approximateMeals: row.approximate_meals, cookedAt: row.cooked_at, pickupBy: row.pickup_by, address: row.address, city: row.city, lat: Number(row.lat), lng: Number(row.lng), status: row.status, claimedBy: row.claimed_by, createdAt: row.created_at }));
    } else posts = this.fallbackData.food_posts.filter(post => ['posted','claimed','picked_up'].includes(post.status) && Date.parse(post.pickupBy) > Date.now() && (!city || post.city.toLowerCase().includes(String(city).toLowerCase()))).map(post => ({ ...post, restaurantName: this.fallbackData.users.find(user => String(user.id) === post.restaurantId)?.name || 'Verified restaurant' }));
    if (lat != null && lng != null && Number.isFinite(Number(radiusKm))) posts = posts.filter(post => haversineDistance(Number(lat),Number(lng),Number(post.lat),Number(post.lng)) <= Number(radiusKm));
    return posts.map(post => ({ ...this.publicFoodPost(post), restaurantName: post.restaurantName || 'Verified restaurant' }));
  }

  async getFoodPostForUser(id, userId) {
    await this.expireFoodPosts();
    let post, restaurantName = '';
    if (this.mode === 'postgres') {
      const row = (await this.pool.query('SELECT p.*,u.name AS restaurant_name FROM food_posts p JOIN users u ON u.id=p.restaurant_id WHERE p.id=$1', [String(id)])).rows[0];
      if (!row) return null;
      post = { id: row.id, restaurantId: row.restaurant_id, itemDescription: row.item_description, approximateMeals: row.approximate_meals, cookedAt: row.cooked_at, pickupBy: row.pickup_by, address: row.address, city: row.city, lat: Number(row.lat), lng: Number(row.lng), contact: row.contact, status: row.status, claimedBy: row.claimed_by, restaurantConfirmedAt: row.restaurant_confirmed_at, recipientConfirmedAt: row.recipient_confirmed_at, createdAt: row.created_at }; restaurantName = row.restaurant_name;
    } else {
      post = this.fallbackData.food_posts.find(item => item.id === String(id)); if (!post) return null;
      restaurantName = this.fallbackData.users.find(user => String(user.id) === post.restaurantId)?.name || 'Food donor';
    }
    const userKey = String(userId);
    const isParticipant = post.restaurantId === userKey || post.claimedBy === userKey;
    return { ...this.publicFoodPost(post), restaurantName, ...(isParticipant ? { contact: post.contact, isRestaurant: post.restaurantId === userKey, isRecipient: post.claimedBy === userKey, restaurantConfirmed: Boolean(post.restaurantConfirmedAt), recipientConfirmed: Boolean(post.recipientConfirmedAt) } : {}) };
  }

  async listFoodPostsForUser(userId) {
    await this.expireFoodPosts();
    if (this.mode === 'postgres') {
      const rows = (await this.pool.query('SELECT p.*,u.name AS restaurant_name FROM food_posts p JOIN users u ON u.id=p.restaurant_id WHERE p.restaurant_id=$1 OR p.claimed_by=$1 ORDER BY p.created_at DESC LIMIT 100', [String(userId)])).rows;
      return rows.map(row => {
        const post={id:row.id,restaurantId:row.restaurant_id,restaurantName:row.restaurant_name,itemDescription:row.item_description,approximateMeals:row.approximate_meals,cookedAt:row.cooked_at,pickupBy:row.pickup_by,address:row.address,city:row.city,lat:Number(row.lat),lng:Number(row.lng),contact:row.contact,status:row.status,claimedBy:row.claimed_by,restaurantConfirmedAt:row.restaurant_confirmed_at,recipientConfirmedAt:row.recipient_confirmed_at,createdAt:row.created_at};
        return {...this.publicFoodPost(post),restaurantName:post.restaurantName,contact:post.contact,isRestaurant:String(post.restaurantId)===String(userId),isRecipient:String(post.claimedBy)===String(userId),restaurantConfirmed:Boolean(post.restaurantConfirmedAt),recipientConfirmed:Boolean(post.recipientConfirmedAt)};
      });
    }
    return this.fallbackData.food_posts.filter(post=>post.restaurantId===String(userId)||post.claimedBy===String(userId)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,100).map(post=>({...this.publicFoodPost(post),restaurantName:this.fallbackData.users.find(user=>String(user.id)===post.restaurantId)?.name||'Verified restaurant',contact:post.contact,isRestaurant:post.restaurantId===String(userId),isRecipient:post.claimedBy===String(userId),restaurantConfirmed:Boolean(post.restaurantConfirmedAt),recipientConfirmed:Boolean(post.recipientConfirmedAt)}));
  }

  async claimFoodPost(id, recipientId) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query(`UPDATE food_posts SET status='claimed',claimed_by=$2 WHERE id=$1 AND status='posted' AND pickup_by>CURRENT_TIMESTAMP AND restaurant_id<>$2 AND EXISTS (SELECT 1 FROM users WHERE id=$2 AND verification_status='approved' AND organization_type IN ('orphanage','ngo')) RETURNING id,item_description,approximate_meals,pickup_by,address,city,contact`, [String(id),String(recipientId)]);
      const row = result.rows[0];
      if (!row) return null;
      const noticeId=`notif_food_claim_${crypto.createHash('sha256').update(`${id}:${recipientId}`).digest('hex').slice(0,30)}`;
      await this.pool.query('INSERT INTO notifications (id,user_id,food_post_id,title,message,delivered,created_at) SELECT $1,restaurant_id,$2,$3,$4,TRUE,CURRENT_TIMESTAMP FROM food_posts WHERE id=$2 ON CONFLICT (id) DO NOTHING',[noticeId,row.id,'A food pickup was claimed','A verified community organization claimed your food pickup. Open SERVEO to coordinate handover.']);
      return { id: row.id, itemDescription: row.item_description, approximateMeals: row.approximate_meals, pickupBy: row.pickup_by, address: row.address, city: row.city, contact: row.contact };
    }
    const recipient = this.fallbackData.users.find(user => String(user.id) === String(recipientId));
    const post = this.fallbackData.food_posts.find(item => item.id === String(id) && item.status === 'posted' && Date.parse(item.pickupBy) > Date.now() && item.restaurantId !== String(recipientId));
    if (!recipient || recipient.verificationStatus !== 'approved' || !['orphanage','ngo'].includes(recipient.organizationType) || !post) return null;
    post.status = 'claimed'; post.claimedBy = String(recipientId);
    const digest=crypto.createHash('sha256').update(`${id}:${recipientId}`).digest('hex').slice(0,30);
    this.fallbackData.notifications.push({id:`notif_food_claim_${digest}`,userId:post.restaurantId,foodPostId:post.id,title:'A food pickup was claimed',message:'A verified community organization claimed your food pickup. Open SERVEO to coordinate handover.',delivered:true,createdAt:new Date().toISOString()});
    this.saveFallback();
    return { id: post.id, itemDescription: post.itemDescription, approximateMeals: post.approximateMeals, pickupBy: post.pickupBy, address: post.address, city: post.city, contact: post.contact };
  }

  async confirmFoodHandover(id, userId, role) {
    if (this.mode === 'postgres') {
      const column = role === 'restaurant' ? 'restaurant_confirmed_at' : 'recipient_confirmed_at';
      const predicate = role === 'restaurant' ? 'restaurant_id=$2' : 'claimed_by=$2';
      const result = await this.pool.query(`UPDATE food_posts SET ${column}=COALESCE(${column},CURRENT_TIMESTAMP),status=CASE WHEN (${role === 'restaurant' ? 'recipient_confirmed_at' : 'restaurant_confirmed_at'}) IS NOT NULL THEN 'completed' ELSE 'picked_up' END,completed_at=CASE WHEN (${role === 'restaurant' ? 'recipient_confirmed_at' : 'restaurant_confirmed_at'}) IS NOT NULL THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE completed_at END WHERE id=$1 AND ${predicate} AND status IN ('claimed','picked_up') AND pickup_by>CURRENT_TIMESTAMP RETURNING id,status`, [String(id),String(userId)]);
      return result.rows[0] ? { id: result.rows[0].id, status: result.rows[0].status } : null;
    }
    const post = this.fallbackData.food_posts.find(item => item.id === String(id) && ['claimed','picked_up'].includes(item.status) && Date.parse(item.pickupBy) > Date.now());
    if (!post || (role === 'restaurant' ? post.restaurantId !== String(userId) : post.claimedBy !== String(userId))) return null;
    const now = new Date().toISOString();
    if (role === 'restaurant') post.restaurantConfirmedAt = post.restaurantConfirmedAt || now; else post.recipientConfirmedAt = post.recipientConfirmedAt || now;
    post.status = post.restaurantConfirmedAt && post.recipientConfirmedAt ? 'completed' : 'picked_up';
    if (post.status === 'completed') post.completedAt = post.completedAt || now;
    this.saveFallback(); return { id: post.id, status: post.status };
  }

  async cancelFoodPost(id, userId, isAdmin = false) {
    if (this.mode === 'postgres') {
      const result = await this.pool.query("UPDATE food_posts SET status='cancelled' WHERE id=$1 AND status IN ('posted','claimed') AND ($3=TRUE OR restaurant_id=$2) RETURNING id", [String(id),String(userId),Boolean(isAdmin)]);
      return Boolean(result.rowCount);
    }
    const post = this.fallbackData.food_posts.find(item => item.id === String(id) && ['posted','claimed'].includes(item.status) && (isAdmin || item.restaurantId === String(userId)));
    if (!post) return false; post.status = 'cancelled'; this.saveFallback(); return true;
  }

  async notifyFoodPostWave(id) {
    let post, candidates, notifiedIds, wave;
    if (this.mode === 'postgres') {
      const row = (await this.pool.query("SELECT id,city,lat,lng,pickup_by FROM food_posts WHERE id=$1 AND status='posted' AND pickup_by>CURRENT_TIMESTAMP", [String(id)])).rows[0]; if (!row) return 0;
      post = { id: row.id, city: row.city, lat: Number(row.lat), lng: Number(row.lng), pickupBy: row.pickup_by };
      candidates = (await this.pool.query("SELECT id,notification_lat,notification_lng FROM users WHERE verification_status='approved' AND organization_type IN ('orphanage','ngo') AND notifications_enabled=TRUE AND notification_lat IS NOT NULL AND notification_lng IS NOT NULL")).rows.map(user => ({ id: String(user.id), lat: Number(user.notification_lat), lng: Number(user.notification_lng) }));
      notifiedIds = new Set((await this.pool.query('SELECT user_id FROM food_post_notifications WHERE food_post_id=$1', [String(id)])).rows.map(item => String(item.user_id)));
      wave = (await this.pool.query('SELECT COALESCE(MAX(wave),-1)+1 AS wave FROM food_post_notifications WHERE food_post_id=$1', [String(id)])).rows[0].wave;
    } else {
      post = this.fallbackData.food_posts.find(item => item.id === String(id) && item.status === 'posted' && Date.parse(item.pickupBy) > Date.now()); if (!post) return 0;
      candidates = this.fallbackData.users.filter(user => user.verificationStatus === 'approved' && ['orphanage','ngo'].includes(user.organizationType) && user.notificationsEnabled && user.notificationLat != null && user.notificationLng != null).map(user => ({ id: String(user.id), lat: Number(user.notificationLat), lng: Number(user.notificationLng) }));
      notifiedIds = new Set(this.fallbackData.food_post_notifications.filter(item => item.foodPostId === String(id)).map(item => item.userId));
      wave = this.fallbackData.food_post_notifications.filter(item => item.foodPostId === String(id)).reduce((max,item) => Math.max(max,item.wave),-1)+1;
    }
    const radius = Math.max(1,Math.min(250,Number(process.env.FOOD_DONATION_RADIUS_KM)||50));
    const eligible = candidates.filter(user => !notifiedIds.has(user.id)).map(user => ({ ...user, distance: haversineDistance(post.lat,post.lng,user.lat,user.lng) })).filter(user => user.distance <= radius).sort((a,b) => a.distance-b.distance).slice(0,10);
    for (const user of eligible) {
      const notificationId = `notif_food_${crypto.createHash('sha256').update(`${post.id}:${user.id}`).digest('hex').slice(0,36)}`;
      if (this.mode === 'postgres') {
        await this.pool.query('INSERT INTO food_post_notifications (food_post_id,user_id,wave) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [post.id,user.id,wave]);
        await this.pool.query('INSERT INTO notifications (id,user_id,food_post_id,title,message,delivered,created_at) VALUES ($1,$2,$3,$4,$5,TRUE,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING', [notificationId,user.id,post.id,'Food pickup available',`A verified food pickup is available in ${post.city}. Claim promptly to see pickup details.`]);
      } else {
        this.fallbackData.food_post_notifications.push({ foodPostId: post.id, userId: user.id, wave, notifiedAt: new Date().toISOString() });
        this.fallbackData.notifications.push({ id: notificationId, userId: user.id, foodPostId: post.id, title: 'Food pickup available', message: `A verified food pickup is available in ${post.city}. Claim promptly to see pickup details.`, delivered: true, createdAt: new Date().toISOString() });
      }
    }
    if (this.mode !== 'postgres' && eligible.length) this.saveFallback();
    return eligible.length;
  }

  async processFoodPostNotifications() {
    await this.expireFoodPosts();
    let ids;
    if (this.mode === 'postgres') ids = (await this.pool.query("SELECT id FROM food_posts WHERE status='posted' AND pickup_by>CURRENT_TIMESTAMP")).rows.map(row => row.id);
    else ids = this.fallbackData.food_posts.filter(post => post.status === 'posted' && Date.parse(post.pickupBy) > Date.now()).map(post => post.id);
    const waveMinutes = Math.max(1,Number(process.env.FOOD_CLAIM_WAVE_MINUTES)||15);
    for (const id of ids) {
      let lastWaveAt = null;
      if (this.mode === 'postgres') lastWaveAt = (await this.pool.query('SELECT MAX(notified_at) AS notified_at FROM food_post_notifications WHERE food_post_id=$1',[id])).rows[0].notified_at;
      else lastWaveAt = this.fallbackData.food_post_notifications.filter(item => item.foodPostId === id).reduce((latest,item) => !latest || Date.parse(item.notifiedAt)>Date.parse(latest) ? item.notifiedAt : latest,null);
      if (!lastWaveAt || Date.now()-Date.parse(lastWaveAt)>=waveMinutes*60000) await this.notifyFoodPostWave(id);
    }
  }

  async createFoodReport({ foodPostId, reporterId, reason, note }) {
    if (this.mode === 'postgres') {
      const post = await this.pool.query('SELECT restaurant_id FROM food_posts WHERE id=$1',[String(foodPostId)]); if (!post.rowCount) return { error:'not_found' };
      if (String(post.rows[0].restaurant_id)===String(reporterId)) return { error:'own_post' };
      const id=`food_report_${crypto.randomUUID()}`;
      try { await this.pool.query('INSERT INTO food_reports (id,food_post_id,reporter_id,reason,note) VALUES ($1,$2,$3,$4,$5)',[id,String(foodPostId),String(reporterId),reason,note]); }
      catch(error){ if(error.code==='23505')return {error:'duplicate'}; throw error; }
      return {id};
    }
    const post=this.fallbackData.food_posts.find(item=>item.id===String(foodPostId)); if(!post)return {error:'not_found'};
    if(post.restaurantId===String(reporterId))return {error:'own_post'};
    if(this.fallbackData.food_reports.some(item=>item.foodPostId===String(foodPostId)&&item.reporterId===String(reporterId)))return {error:'duplicate'};
    const report={id:`food_report_${crypto.randomUUID()}`,foodPostId:String(foodPostId),reporterId:String(reporterId),reason,note,status:'pending',createdAt:new Date().toISOString()}; this.fallbackData.food_reports.push(report); this.saveFallback(); return {id:report.id};
  }

  async listFoodReports() {
    if(this.mode==='postgres'){
      const rows=(await this.pool.query("SELECT r.id,r.food_post_id,r.reason,r.note,r.created_at,p.item_description,p.city FROM food_reports r JOIN food_posts p ON p.id=r.food_post_id WHERE r.status='pending' ORDER BY r.created_at")).rows;
      return rows.map(row=>({id:row.id,foodPostId:row.food_post_id,reason:row.reason,note:row.note,createdAt:row.created_at,itemDescription:row.item_description,city:row.city}));
    }
    return this.fallbackData.food_reports.filter(item=>item.status==='pending').map(item=>{const post=this.fallbackData.food_posts.find(p=>p.id===item.foodPostId);return {id:item.id,foodPostId:item.foodPostId,reason:item.reason,note:item.note,createdAt:item.createdAt,itemDescription:post?.itemDescription||'',city:post?.city||''};});
  }

  async reviewFoodReport(id, action) {
    if(!['dismiss','hide'].includes(action))return false;
    const status=action==='dismiss'?'dismissed':'hidden';
    if(this.mode==='postgres'){
      const result=await this.pool.query("UPDATE food_reports SET status=$2 WHERE id=$1 AND status='pending' RETURNING food_post_id",[String(id),status]); if(!result.rowCount)return false;
      if(action==='hide') await this.pool.query("UPDATE food_posts SET status='cancelled' WHERE id=$1 AND status IN ('posted','claimed')",[result.rows[0].food_post_id]); return true;
    }
    const report=this.fallbackData.food_reports.find(item=>item.id===String(id)&&item.status==='pending');if(!report)return false;
    report.status=status;if(action==='hide'){const post=this.fallbackData.food_posts.find(item=>item.id===report.foodPostId);if(post&&['posted','claimed'].includes(post.status))post.status='cancelled';}
    this.saveFallback();return true;
  }

  async getDisasterMode() {
    if(this.mode==='postgres'){
      const expired=(await this.pool.query("SELECT s.reason,s.region,s.ends_at,a.admin_id FROM disaster_mode_state s JOIN disaster_mode_audit a ON a.id=s.audit_id WHERE s.singleton=TRUE AND s.active=TRUE AND s.ends_at<=CURRENT_TIMESTAMP")).rows[0];
      if(expired){await this.pool.query('INSERT INTO disaster_mode_audit(id,admin_id,action,reason,region,ends_at) VALUES($1,$2,\'expired\',$3,$4,$5)',[`disaster_${crypto.randomUUID()}`,expired.admin_id,expired.reason,expired.region,expired.ends_at]);await this.pool.query("UPDATE disaster_mode_state SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE singleton=TRUE");}
      const row=(await this.pool.query('SELECT active,reason,region,ends_at FROM disaster_mode_state WHERE singleton=TRUE')).rows[0];
      return row?{active:row.active,reason:row.reason,region:row.region,endsAt:row.ends_at}: {active:false};
    }
    const state=this.fallbackData.disaster_mode;
    if(state.active&&Date.parse(state.endsAt)<=Date.now()){state.active=false;this.fallbackData.disaster_mode_audit.push({action:'expired',reason:state.reason,region:state.region,createdAt:new Date().toISOString()});this.saveFallback();}
    return {...state};
  }

  async setDisasterMode({adminId,active,reason,region,endsAt}){
    const action=active?'enabled':'disabled',id=`disaster_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    if(this.mode==='postgres'){
      const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('INSERT INTO disaster_mode_audit(id,admin_id,action,reason,region,ends_at) VALUES($1,$2,$3,$4,$5,$6)',[id,String(adminId),action,reason,region,endsAt]);await client.query('UPDATE disaster_mode_state SET audit_id=$1,active=$2,reason=$3,region=$4,ends_at=$5,updated_at=CURRENT_TIMESTAMP WHERE singleton=TRUE',[id,active,active?reason:null,active?region:null,active?endsAt:null]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }else{this.fallbackData.disaster_mode={active,reason:active?reason:null,region:active?region:null,endsAt:active?endsAt:null};this.fallbackData.disaster_mode_audit.push({id,adminId:String(adminId),action,reason,region,endsAt,createdAt:new Date().toISOString()});this.saveFallback();}
    return this.getDisasterMode();
  }

  async getDemandHeatmap(){
    if(this.mode==='postgres'){
      const result=await this.pool.query(`WITH demand_points AS (SELECT lat,lng,1 AS weight FROM urgent_blood_requests WHERE status='open' AND expires_at>NOW() UNION ALL SELECT lat,lng,1 FROM food_posts WHERE status='posted' AND pickup_by>NOW() UNION ALL SELECT lat,lng,CASE WHEN need_level='critical' THEN 3 ELSE 1 END FROM blood_bank_stock WHERE updated_at>NOW()-INTERVAL '48 hours' AND need_level IN ('critical','low')), demand AS (SELECT lat,lng,SUM(weight)::int AS amount FROM demand_points GROUP BY lat,lng), supply AS (SELECT lat,lng FROM events WHERE status='approved' AND date>=CURRENT_DATE UNION ALL SELECT lat,lng FROM blood_bank_stock WHERE need_level='ok' AND updated_at>NOW()-INTERVAL '48 hours') SELECT d.lat,d.lng,d.amount,COUNT(s.lat)::int AS supply FROM demand d LEFT JOIN supply s ON ABS(s.lat-d.lat)<0.08 AND ABS(s.lng-d.lng)<0.08 GROUP BY d.lat,d.lng,d.amount`);
      return result.rows.map(row=>({lat:Number(row.lat),lng:Number(row.lng),intensity:Number(row.amount)/(1+Number(row.supply))}));
    }
    const demands=[];for(const request of this.fallbackData.urgent_blood_requests.filter(x=>x.status==='open'&&Date.parse(x.expiresAt)>Date.now()))demands.push({lat:Number(request.lat),lng:Number(request.lng),weight:1});for(const post of this.fallbackData.food_posts.filter(x=>x.status==='posted'&&Date.parse(x.pickupBy)>Date.now()))demands.push({lat:Number(post.lat),lng:Number(post.lng),weight:1});for(const stock of this.fallbackData.blood_bank_stock.filter(x=>['low','critical'].includes(x.needLevel)&&Date.now()-Date.parse(x.updatedAt)<48*3600000))demands.push({lat:Number(stock.lat),lng:Number(stock.lng),weight:stock.needLevel==='critical'?3:1});const supplies=[...this.fallbackData.events.filter(e=>e.status==='approved'&&String(e.date)>=new Date().toISOString().slice(0,10)).map(e=>({lat:Number(e.lat),lng:Number(e.lng)})),...this.fallbackData.blood_bank_stock.filter(s=>s.needLevel==='ok'&&Date.now()-Date.parse(s.updatedAt)<48*3600000).map(s=>({lat:Number(s.lat),lng:Number(s.lng)}))];return demands.map(point=>({lat:point.lat,lng:point.lng,intensity:point.weight/(1+supplies.filter(s=>Math.abs(s.lat-point.lat)<0.08&&Math.abs(s.lng-point.lng)<0.08).length)}));
  }

  async getImpactStats({ fromDate = null, toDate = null, city = null } = {}) {
    if (this.mode === 'postgres') {
      const params=[fromDate,toDate,city];
      const [events,donors,donations,meals,hours,cities] = await Promise.all([
        this.pool.query(`SELECT COUNT(DISTINCT r.event_id)::int AS value FROM event_reviews r JOIN events e ON e.id=r.event_id WHERE r.outcome='event_held' AND ($1::date IS NULL OR r.created_at::date >= $1::date) AND ($2::date IS NULL OR r.created_at::date <= $2::date) AND ($3::text IS NULL OR LOWER(e.city)=LOWER($3::text))`,params),
        this.pool.query(`SELECT COUNT(*)::int AS value FROM users WHERE blood_group IS NOT NULL AND ($1::date IS NULL OR created_at::date >= $1::date) AND ($2::date IS NULL OR created_at::date <= $2::date) AND ($3::text IS NULL OR LOWER(home_city)=LOWER($3::text))`,params),
        this.pool.query(`SELECT COUNT(*)::int AS value FROM blood_donations WHERE status='confirmed' AND ($1::date IS NULL OR donation_date >= $1::date) AND ($2::date IS NULL OR donation_date <= $2::date) AND ($3::text IS NULL OR LOWER(city)=LOWER($3::text))`,params),
        this.pool.query(`SELECT SUM(approximate_meals)::int AS value FROM food_posts WHERE status='completed' AND completed_at IS NOT NULL AND ($1::date IS NULL OR completed_at::date >= $1::date) AND ($2::date IS NULL OR completed_at::date <= $2::date) AND ($3::text IS NULL OR LOWER(city)=LOWER($3::text))`,params),
        this.pool.query(`SELECT ROUND(COALESCE(SUM(a.hours),0),2)::float AS value FROM volunteer_attendance_records a JOIN events e ON e.id=a.event_id WHERE a.checked_out_at IS NOT NULL AND ($1::date IS NULL OR a.checked_out_at::date >= $1::date) AND ($2::date IS NULL OR a.checked_out_at::date <= $2::date) AND ($3::text IS NULL OR LOWER(e.city)=LOWER($3::text))`,params),
        this.pool.query(`SELECT COUNT(DISTINCT e.city)::int AS value FROM event_reviews r JOIN events e ON e.id=r.event_id WHERE r.outcome='event_held' AND ($1::date IS NULL OR r.created_at::date >= $1::date) AND ($2::date IS NULL OR r.created_at::date <= $2::date) AND ($3::text IS NULL OR LOWER(e.city)=LOWER($3::text))`,params)
      ]);
      const n=result=>Number(result.rows[0]?.value)||0;
      let demo={events:0,donors:0,donations:0,meals:0,hours:0,cities:0};
      if(this.demoDataEnabled&&!city){const row=(await this.pool.query(`SELECT COALESCE(SUM(welfare_drives_completed),0)::int AS events,(ARRAY_AGG(donors_registered ORDER BY month DESC))[1] AS donors,COALESCE(SUM(donations_confirmed),0)::int AS donations,COALESCE(SUM(meals_delivered),0)::int AS meals,COALESCE(SUM(volunteer_hours),0)::float AS hours,COALESCE(MAX(cities_covered),0)::int AS cities FROM impact_demo_monthly_samples WHERE ($1::date IS NULL OR month>=DATE_TRUNC('month',$1::date)::date) AND ($2::date IS NULL OR month<=DATE_TRUNC('month',$2::date)::date)`,[fromDate,toDate])).rows[0];demo={events:Number(row.events)||0,donors:Number(row.donors)||0,donations:Number(row.donations)||0,meals:Number(row.meals)||0,hours:Number(row.hours)||0,cities:Number(row.cities)||0};}
      return { eventsHeld:n(events)+demo.events||null, donorsRegistered:n(donors)+demo.donors||null, donationsConfirmed:n(donations)+demo.donations||null, mealsDelivered:n(meals)+demo.meals||null, volunteerHours:Math.round((n(hours)+demo.hours)*100)/100||null, citiesCovered:Math.max(n(cities),demo.cities)||null };
    }
    const matchesDate=value=>{const date=String(value||'').slice(0,10);return (!fromDate||date>=fromDate)&&(!toDate||date<=toDate);};
    const matchesCity=value=>!city||String(value||'').toLowerCase()===String(city).toLowerCase();
    const heldEventIds=new Set(this.fallbackData.event_reviews.filter(review=>review.outcome==='event_held'&&matchesDate(review.createdAt)).filter(review=>matchesCity(this.fallbackData.events.find(event=>String(event.id)===String(review.eventId))?.city)).map(review=>String(review.eventId)));
    const donors=this.fallbackData.users.filter(user=>user.bloodGroup&&matchesDate(user.createdAt)&&matchesCity(user.homeCity)).length;
    const donations=this.fallbackData.blood_donations.filter(item=>item.status==='confirmed'&&matchesDate(item.donationDate)&&matchesCity(item.city)).length;
    const completed=this.fallbackData.food_posts.filter(item=>item.status==='completed'&&item.completedAt&&matchesDate(item.completedAt)&&matchesCity(item.city));
    const attendance=this.fallbackData.volunteer_attendance_records.filter(item=>item.checkedOutAt&&item.hours!=null&&matchesDate(item.checkedOutAt)&&matchesCity(this.fallbackData.events.find(event=>String(event.id)===String(item.eventId))?.city));
    const coveredCities=new Set([...heldEventIds].map(id=>this.fallbackData.events.find(event=>String(event.id)===id)?.city).filter(Boolean));
    let demo={events:0,donors:0,donations:0,meals:0,hours:0,cities:0};
    if(this.demoDataEnabled&&!city){const rows=this.fallbackData.impact_demo_monthly_samples.filter(row=>(!fromDate||row.month>=fromDate.slice(0,7)+'-01')&&(!toDate||row.month<=toDate.slice(0,7)+'-31'));if(rows.length)demo={events:rows.reduce((sum,row)=>sum+Number(row.welfareDrivesCompleted||0),0),donors:Number(rows.at(-1).donorsRegistered)||0,donations:rows.reduce((sum,row)=>sum+Number(row.donationsConfirmed||0),0),meals:rows.reduce((sum,row)=>sum+Number(row.mealsDelivered||0),0),hours:rows.reduce((sum,row)=>sum+Number(row.volunteerHours||0),0),cities:Math.max(...rows.map(row=>Number(row.citiesCovered)||0))};}
    const nullable=value=>value||null;
    return { eventsHeld:nullable(heldEventIds.size+demo.events), donorsRegistered:nullable(donors+demo.donors), donationsConfirmed:nullable(donations+demo.donations), mealsDelivered:nullable(completed.reduce((sum,item)=>sum+Number(item.approximateMeals||0),0)+demo.meals), volunteerHours:nullable(Math.round((attendance.reduce((sum,item)=>sum+Number(item.hours||0),0)+demo.hours)*100)/100), citiesCovered:nullable(Math.max(coveredCities.size,demo.cities)) };
  }

  async getImpactTrends({fromDate=null,toDate=null,city=null}={}){
    const tenMonthStart=new Date();tenMonthStart.setUTCDate(1);tenMonthStart.setUTCMonth(tenMonthStart.getUTCMonth()-9);
    const toDay=toDate||new Date().toISOString().slice(0,10),fromDay=fromDate||tenMonthStart.toISOString().slice(0,10);
    const firstMonth=new Date(`${fromDay.slice(0,7)}-01T00:00:00Z`),lastMonth=new Date(`${toDay.slice(0,7)}-01T00:00:00Z`);
    while((lastMonth.getUTCFullYear()-firstMonth.getUTCFullYear())*12+lastMonth.getUTCMonth()-firstMonth.getUTCMonth()>11)firstMonth.setUTCMonth(firstMonth.getUTCMonth()+1);
    const chartFromDay=firstMonth.toISOString().slice(0,10),monthKeys=[];for(const cursor=new Date(firstMonth);cursor<=lastMonth;cursor.setUTCMonth(cursor.getUTCMonth()+1))monthKeys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth()+1).padStart(2,'0')}`);
    if(this.mode==='postgres'){
      const params=[chartFromDay,toDay,city];
      const queries=[
        `SELECT TO_CHAR(DATE_TRUNC('month',r.created_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM') AS month,COUNT(*)::int AS value FROM event_reviews r JOIN events e ON e.id=r.event_id WHERE r.outcome='event_held' AND (r.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR LOWER(e.city)=LOWER($3::text)) GROUP BY 1`,
        `SELECT TO_CHAR(DATE_TRUNC('month',confirmed_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM') AS month,COUNT(*)::int AS value FROM blood_donations WHERE status='confirmed' AND (confirmed_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR LOWER(city)=LOWER($3::text)) GROUP BY 1`,
        `SELECT TO_CHAR(DATE_TRUNC('month',completed_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM') AS month,COALESCE(SUM(approximate_meals),0)::int AS value FROM food_posts WHERE status='completed' AND completed_at IS NOT NULL AND (completed_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR LOWER(city)=LOWER($3::text)) GROUP BY 1`,
        `SELECT TO_CHAR(DATE_TRUNC('month',a.checked_out_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM') AS month,ROUND(COALESCE(SUM(a.hours),0),2)::float AS value FROM volunteer_attendance_records a JOIN events e ON e.id=a.event_id WHERE a.checked_out_at IS NOT NULL AND (a.checked_out_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR LOWER(e.city)=LOWER($3::text)) GROUP BY 1`,
        `SELECT TO_CHAR(DATE_TRUNC('month',a.checked_out_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM') AS month,COUNT(*)::int AS value FROM volunteer_attendance_records a JOIN events e ON e.id=a.event_id WHERE a.checked_out_at IS NOT NULL AND (a.checked_out_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR LOWER(e.city)=LOWER($3::text)) GROUP BY 1`
      ];
      const results=await Promise.all(queries.map(query=>this.pool.query(query,params)));
      const series=new Map(monthKeys.map(month=>[month,{month,eventsHeld:0,donationsConfirmed:0,mealsDelivered:0,volunteerHours:0,volunteersMobilized:0}]));for(const row of results.flatMap((result,index)=>result.rows.map(row=>({...row,key:['eventsHeld','donationsConfirmed','mealsDelivered','volunteerHours','volunteersMobilized'][index]}))))if(series.has(row.month))series.get(row.month)[row.key]=Number(row.value)||0;
      if(this.demoDataEnabled){const samples=(await this.pool.query("SELECT TO_CHAR(month,'YYYY-MM') AS month,volunteers_mobilized,welfare_drives_completed FROM impact_demo_monthly_samples WHERE month BETWEEN DATE_TRUNC('month',$1::date)::date AND DATE_TRUNC('month',$2::date)::date",[chartFromDay,toDay])).rows;for(const sample of samples){const row=series.get(sample.month);if(row){row.volunteersMobilized+=Number(sample.volunteers_mobilized)||0;row.eventsHeld+=Number(sample.welfare_drives_completed)||0;}}}
      return [...series.values()];
    }
    const inRange=value=>{const day=String(value||'').slice(0,10);return day>=chartFromDay&&day<=toDay;},matchesCity=value=>!city||String(value||'').toLowerCase()===String(city).toLowerCase(),series=new Map(monthKeys.map(month=>[month,{month,eventsHeld:0,donationsConfirmed:0,mealsDelivered:0,volunteerHours:0,volunteersMobilized:0}]));
    const monthFor=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
    const entry=month=>series.get(month)||{month,eventsHeld:0,donationsConfirmed:0,mealsDelivered:0,volunteerHours:0,volunteersMobilized:0};
    for(const review of this.fallbackData.event_reviews.filter(item=>item.outcome==='event_held'&&inRange(item.createdAt))){const event=this.fallbackData.events.find(item=>String(item.id)===String(review.eventId));if(event&&matchesCity(event.city))entry(monthFor(review.createdAt)).eventsHeld++;}
    for(const donation of this.fallbackData.blood_donations.filter(item=>item.status==='confirmed'&&item.confirmedAt&&inRange(item.confirmedAt)&&matchesCity(item.city)))entry(monthFor(donation.confirmedAt)).donationsConfirmed++;
    for(const post of this.fallbackData.food_posts.filter(item=>item.status==='completed'&&item.completedAt&&inRange(item.completedAt)&&matchesCity(item.city)))entry(monthFor(post.completedAt)).mealsDelivered+=Number(post.approximateMeals||0);
    for(const record of this.fallbackData.volunteer_attendance_records.filter(item=>item.checkedOutAt&&inRange(item.checkedOutAt))){const event=this.fallbackData.events.find(row=>String(row.id)===String(record.eventId));if(event&&matchesCity(event.city)){entry(monthFor(record.checkedOutAt)).volunteerHours+=Number(record.hours||0);entry(monthFor(record.checkedOutAt)).volunteersMobilized++;}}
    if(this.demoDataEnabled)for(const sample of this.fallbackData.impact_demo_monthly_samples){const month=sample.month.slice(0,7),row=series.get(month);if(row){row.volunteersMobilized+=Number(sample.volunteersMobilized)||0;row.eventsHeld+=Number(sample.welfareDrivesCompleted)||0;}}
    return [...series.values()].sort((a,b)=>a.month.localeCompare(b.month));
  }

  async getEventAttendance(eventId) {
    if(this.mode==='postgres'){
      const rows=(await this.pool.query(`SELECT va.id AS application_id,COALESCE(u.name,va.applicant_name,'Volunteer') AS name,va.status,a.checked_in_at,a.checked_out_at,a.hours
        FROM volunteer_applications va LEFT JOIN users u ON u.id=va.user_id LEFT JOIN volunteer_attendance_records a ON a.application_id=va.id
        WHERE va.event_id=$1 AND va.user_id IS NOT NULL AND va.status='registered' ORDER BY va.created_at`,[String(eventId)])).rows;
      return rows.map(row=>({applicationId:row.application_id,name:row.name,status:row.status,checkedInAt:row.checked_in_at,checkedOutAt:row.checked_out_at,hours:row.hours==null?null:Number(row.hours)}));
    }
    return this.fallbackData.volunteer_applications.filter(app=>app.eventId===String(eventId)&&app.userId&&app.status==='registered').map(app=>{const record=this.fallbackData.volunteer_attendance_records.find(item=>item.applicationId===app.id);return {applicationId:app.id,name:this.fallbackData.users.find(user=>String(user.id)===String(app.userId))?.name||app.applicantName||'Volunteer',status:app.status,checkedInAt:record?.checkedInAt||null,checkedOutAt:record?.checkedOutAt||null,hours:record?.hours??null};});
  }

  async markVolunteerCheckIn(eventId, applicationId, markedBy, checkedInAt) {
    const id=`att_${crypto.randomUUID()}`;
    if(this.mode==='postgres'){
      const result=await this.pool.query(`INSERT INTO volunteer_attendance_records (id,application_id,event_id,user_id,checked_in_at,marked_by)
        SELECT $1,va.id,va.event_id,va.user_id,$4,$3 FROM volunteer_applications va WHERE va.id=$2 AND va.event_id=$5 AND va.user_id IS NOT NULL AND va.status='registered'
        ON CONFLICT (application_id) DO NOTHING RETURNING id`,[id,String(applicationId),String(markedBy),checkedInAt,String(eventId)]);
      return result.rowCount>0;
    }
    const app=this.fallbackData.volunteer_applications.find(item=>item.id===String(applicationId)&&item.eventId===String(eventId)&&item.userId&&item.status==='registered');
    if(!app||this.fallbackData.volunteer_attendance_records.some(item=>item.applicationId===app.id))return false;
    this.fallbackData.volunteer_attendance_records.push({id,applicationId:app.id,eventId:String(eventId),userId:String(app.userId),checkedInAt,checkedOutAt:null,hours:null,markedBy:String(markedBy),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});this.saveFallback();return true;
  }

  async markVolunteerCheckOut(eventId, applicationId, checkedOutAt) {
    if(this.mode==='postgres'){
      const result=await this.pool.query(`UPDATE volunteer_attendance_records SET checked_out_at=$3,hours=ROUND((EXTRACT(EPOCH FROM ($3::timestamptz-checked_in_at))/3600)::numeric,2),updated_at=CURRENT_TIMESTAMP WHERE event_id=$1 AND application_id=$2 AND checked_out_at IS NULL AND $3::timestamptz>checked_in_at RETURNING hours`,[String(eventId),String(applicationId),checkedOutAt]);
      return result.rows[0]?Number(result.rows[0].hours):null;
    }
    const record=this.fallbackData.volunteer_attendance_records.find(item=>item.eventId===String(eventId)&&item.applicationId===String(applicationId)&&!item.checkedOutAt);
    if(!record||Date.parse(checkedOutAt)<=Date.parse(record.checkedInAt))return null;
    record.checkedOutAt=checkedOutAt;record.hours=Math.round(((Date.parse(checkedOutAt)-Date.parse(record.checkedInAt))/3600000)*100)/100;record.updatedAt=new Date().toISOString();this.saveFallback();return record.hours;
  }

  async getVolunteerHours(userId) {
    const sampleSessions=this.demoDataEnabled?[{id:'DEMO-HRS-01',eventId:'demo_event_held',title:'Demo Community Health Camp',date:new Date(Date.now()-14*86400000).toISOString().slice(0,10),city:'Delhi',hours:2.5,isDemo:true},{id:'DEMO-HRS-02',eventId:'demo_event_reported',title:'Demo Relief Supply Drive',date:new Date(Date.now()-28*86400000).toISOString().slice(0,10),city:'Mumbai',hours:4,isDemo:true},{id:'DEMO-HRS-03',eventId:'demo_event_held',title:'Demo Community Health Camp',date:new Date(Date.now()-42*86400000).toISOString().slice(0,10),city:'Bengaluru',hours:3.5,isDemo:true},{id:'DEMO-HRS-04',eventId:'demo_event_reported',title:'Demo Relief Supply Drive',date:new Date(Date.now()-56*86400000).toISOString().slice(0,10),city:'Delhi',hours:5,isDemo:true}]:[];
    if(this.mode==='postgres'){
      const result=await this.pool.query(`SELECT a.id,a.hours,a.checked_in_at,a.checked_out_at,e.id AS event_id,e.title,e.date,e.city FROM volunteer_attendance_records a JOIN events e ON e.id=a.event_id WHERE a.user_id=$1 AND a.checked_out_at IS NOT NULL ORDER BY a.checked_out_at DESC`,[String(userId)]);
      const sessions=result.rows.map(row=>({id:row.id,eventId:row.event_id,title:row.title,date:row.date instanceof Date?row.date.toISOString().slice(0,10):String(row.date).slice(0,10),city:row.city,checkedInAt:row.checked_in_at,checkedOutAt:row.checked_out_at,hours:Number(row.hours)}));
      const totalHours=Math.round(sessions.reduce((sum,item)=>sum+item.hours,0)*100)/100;
      return {totalHours,sessions,sampleSessions,displaySessions:[...sessions,...sampleSessions],displayTotalHours:Math.round((totalHours+sampleSessions.reduce((sum,item)=>sum+item.hours,0))*100)/100};
    }
    const sessions=this.fallbackData.volunteer_attendance_records.filter(item=>item.userId===String(userId)&&item.checkedOutAt).map(item=>{const event=this.fallbackData.events.find(entry=>String(entry.id)===item.eventId);return {id:item.id,eventId:item.eventId,title:event?.title||'Community event',date:event?.date||'',city:event?.city||'',checkedInAt:item.checkedInAt,checkedOutAt:item.checkedOutAt,hours:Number(item.hours||0)};}).sort((a,b)=>Date.parse(b.checkedOutAt)-Date.parse(a.checkedOutAt));
    const totalHours=Math.round(sessions.reduce((sum,item)=>sum+item.hours,0)*100)/100;
    return {totalHours,sessions,sampleSessions,displaySessions:[...sessions,...sampleSessions],displayTotalHours:Math.round((totalHours+sampleSessions.reduce((sum,item)=>sum+item.hours,0))*100)/100};
  }

  async issueVolunteerHoursCertificate(userId) {
    const hours=await this.getVolunteerHours(userId);if(!hours.sessions.length)return null;
    const id=`HRS-${crypto.randomUUID().toUpperCase()}`;
    if(this.mode==='postgres'){
      const result=await this.pool.query('INSERT INTO volunteer_hours_certificates (id,user_id) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET issued_at=CURRENT_TIMESTAMP RETURNING id',[id,String(userId)]);
      const user=await this.findUserById(userId);return {id:result.rows[0].id,name:user?.name||'Volunteer',...hours};
    }
    let cert=this.fallbackData.volunteer_hours_certificates.find(item=>item.userId===String(userId));
    if(!cert){cert={id,userId:String(userId),issuedAt:new Date().toISOString()};this.fallbackData.volunteer_hours_certificates.push(cert);}else cert.issuedAt=new Date().toISOString();
    this.saveFallback();return {id:cert.id,name:this.fallbackData.users.find(item=>String(item.id)===String(userId))?.name||'Volunteer',...hours};
  }

  async verifyVolunteerHoursCertificate(id) {
    let userId,name,issuedAt;
    if(this.mode==='postgres'){
      const result=await this.pool.query('SELECT c.user_id,c.issued_at,u.name FROM volunteer_hours_certificates c JOIN users u ON u.id=c.user_id WHERE c.id=$1',[String(id)]);
      if(!result.rows[0])return {valid:false};userId=result.rows[0].user_id;name=result.rows[0].name;issuedAt=result.rows[0].issued_at;
    }else{
      const cert=this.fallbackData.volunteer_hours_certificates.find(item=>item.id===String(id));if(!cert)return {valid:false};userId=cert.userId;issuedAt=cert.issuedAt;name=this.fallbackData.users.find(item=>String(item.id)===userId)?.name||'Volunteer';
    }
    const hours=await this.getVolunteerHours(userId);return {valid:true,name,totalHours:hours.totalHours,recordCount:hours.sessions.length,issuedAt};
  }

  formatPostgresEvent(r) {
    return {
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      category: r.category,
      organizer: r.organizer,
      verified: r.verified,
      city: r.city,
      state: r.state || '',
      district: r.district || '',
      address: r.address,
      pincode: r.pincode || '',
      lat: Number(r.lat),
      lng: Number(r.lng),
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      startTime: r.start_time,
      endTime: r.end_time,
      volunteersNeeded: r.volunteers_needed,
      volunteersJoined: r.volunteers_joined,
      urgency: r.urgency,
      description: r.description,
      donationLink: r.donation_link,
      tags: r.tags || [],
      status: r.status,
      notifiedCount: r.notified_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      contactInfo: r.contact ? {
        contact: r.contact,
        email: r.contact_email,
        orgType: r.org_type
      } : null
    };
  }

  formatPostgresUser(r) {
    return {
      id: r.id,
      name: r.name,
      username: r.username,
      email: r.email,
      emailVerified: r.email_verified,
      phone: r.phone,
      phoneVerified: r.phone_verified,
      bloodGroup: r.blood_group || null,
      lastDonationDate: r.last_donation_date ? String(r.last_donation_date).slice(0,10) : null,
      donationCooldownDays: r.donation_cooldown_days || null,
      leaderboardOptOut: Boolean(r.leaderboard_opt_out),
      homeCity: r.home_city || null,
      passwordHash: r.password_hash,
      notificationLat: r.notification_lat,
      notificationLng: r.notification_lng,
      notificationsEnabled: r.notifications_enabled,
      pushTokens: r.push_tokens,
      subscriptionStatus: r.subscription_status,
      organizationBanned: r.organization_banned,
      falseAlarmCount: r.false_alarm_count,
      isAdmin: r.is_admin,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  async createPremiumActivation({ userId = null, name, email, phone, plan = 'demo_premium' }) {
    const id = `prem_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = new Date().toISOString();
    if (this.mode === 'postgres') {
      const { rows } = await this.pool.query(
        `INSERT INTO premium_activations (id, user_id, name, email, phone, plan, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, name, email, phone, plan, created_at`,
        [id, userId || null, name, email, phone, plan, createdAt]
      );
      if (userId) {
        await this.pool.query(
          `UPDATE users SET subscription_status = 'premium', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [userId]
        );
      }
      const r = rows[0];
      return { id: r.id, userId: r.user_id, name: r.name, email: r.email, phone: r.phone, plan: r.plan, createdAt: r.created_at };
    }
    const record = { id, userId: userId || null, name, email, phone, plan, createdAt };
    this.fallbackData.premium_activations.push(record);
    if (userId) {
      const u = this.fallbackData.users.find(x => x.id === userId);
      if (u) u.subscriptionStatus = 'premium';
    }
    this.saveFallback();
    return record;
  }

  async createInquiry({ userId = null, guestId = null, name, email, phone = '', topic = 'general', message }) {
    const id = `inq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = new Date().toISOString();
    if (this.mode === 'postgres') {
      const { rows } = await this.pool.query(
        `INSERT INTO website_inquiries (id, user_id, guest_id, name, email, phone, topic, message, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', $9)
         RETURNING id, user_id, guest_id, name, email, phone, topic, message, status, created_at`,
        [id, userId || null, guestId || null, name, email, phone || '', topic || 'general', message, createdAt]
      );
      const r = rows[0];
      return {
        id: r.id, userId: r.user_id, guestId: r.guest_id, name: r.name,
        email: r.email, phone: r.phone, topic: r.topic, message: r.message,
        status: r.status, createdAt: r.created_at
      };
    }
    const record = {
      id, userId: userId || null, guestId: guestId || null, name,
      email, phone: phone || '', topic: topic || 'general', message,
      status: 'new', createdAt
    };
    this.fallbackData.website_inquiries.push(record);
    this.saveFallback();
    return record;
  }

  async listInquiries() {
    if (this.mode === 'postgres') {
      const { rows } = await this.pool.query(
        `SELECT id, user_id, guest_id, name, email, phone, topic, message, status, created_at
         FROM website_inquiries ORDER BY created_at DESC LIMIT 200`
      );
      return rows.map(r => ({
        id: r.id, userId: r.user_id, guestId: r.guest_id, name: r.name,
        email: r.email, phone: r.phone, topic: r.topic, message: r.message,
        status: r.status, createdAt: r.created_at
      }));
    }
    return [...(this.fallbackData.website_inquiries || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

const db = new DatabaseManager();
module.exports = db;
